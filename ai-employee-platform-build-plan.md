# AI Finance Officer — MVP Build Plan
### (Narrow slice of the "AI Digital Employee Platform" — one role, one workflow, fully demoable)

**Scope for this build:** One AI employee — an **AI Finance Officer** — that handles the quotation workflow: receives a quote request by email, checks inventory, generates a quotation, waits for human approval via Telegram, then sends the quote by email and logs it.

**Stack:** FastAPI, PostgreSQL, Qdrant, Redis, Gemini (function calling), Next.js (dashboard, built last), Telegram Bot API, Docker Compose.

Each phase below is self-contained: goal, tasks, files to create, and acceptance criteria. Feed one phase at a time to your AI coding agent — don't jump ahead until the acceptance criteria for the current phase pass.

---

## Phase 0 — Project Setup & Repo Structure

**Goal:** A clean, runnable skeleton before any business logic exists.

**Tasks:**
1. Create a monorepo with this structure:
   ```
   /backend
     /app
       /api          # FastAPI routes
       /orchestrator  # agent/tool-calling logic
       /tools         # individual tool implementations
       /models        # SQLAlchemy models
       /schemas       # Pydantic schemas
       /services      # Qdrant, Redis, Gemini clients
       main.py
     Dockerfile
     requirements.txt
   /frontend            # Next.js (built in Phase 8)
   /ingestion           # knowledge base ingestion scripts
   docker-compose.yml
   .env.example
   README.md
   ```
2. Set up `docker-compose.yml` with services: `backend`, `postgres`, `qdrant`, `redis`.
3. Set up `.env.example` with placeholders: `GEMINI_API_KEY`, `DATABASE_URL`, `QDRANT_URL`, `REDIS_URL`, `TELEGRAM_BOT_TOKEN`, `EMAIL_USER`, `EMAIL_PASS`.
4. Create a minimal FastAPI app with a `/health` endpoint.

**Acceptance criteria:**
- `docker compose up` starts all four services without errors.
- `GET /health` returns `{"status": "ok"}`.

---

## Phase 1 — Database Schema

**Goal:** Persistent storage for employees, tasks, and approvals.

**Tasks:**
1. Define SQLAlchemy models in `/backend/app/models/`:
   - `AIEmployee`: id, name, role, permissions (JSON), connected_tools (JSON), knowledge_collection (string, Qdrant collection name), created_at.
   - `Task`: id, employee_id (FK), trigger_source (email/manual), input_payload (JSON), status (enum: received, processing, awaiting_approval, approved, rejected, completed, failed), created_at, updated_at.
   - `TaskStep`: id, task_id (FK), step_number, tool_called (string, nullable), tool_input (JSON), tool_output (JSON), created_at — this is your audit log/trace of what the agent did.
   - `Approval`: id, task_id (FK), status (pending/approved/rejected), requested_at, resolved_at, resolved_by (string).
2. Set up Alembic (or simple SQL migration scripts) to create these tables.
3. Seed one `AIEmployee` row manually: role="finance_officer", permissions={"can_send_email": false, "requires_approval": true}.

**Acceptance criteria:**
- Tables exist in Postgres after running migrations.
- You can insert and query the seeded employee via a Python shell or a temporary test script.

---

## Phase 2 — Knowledge Base Ingestion Pipeline

**Goal:** A script that takes documents (product catalog, pricing rules) and makes them searchable.

**Tasks:**
1. In `/ingestion/`, write a script `ingest.py` that:
   - Reads source documents (start with a simple JSON or CSV file of products: name, sku, unit_price, stock_quantity).
   - Chunks text content if using unstructured docs (for MVP, structured JSON/CSV may not need chunking — index each product as one record).
   - Generates embeddings using `sentence-transformers` (e.g. `all-MiniLM-L6-v2` or a multilingual model if you expect Khmer product names).
   - Upserts into a Qdrant collection named `finance_officer_knowledge`, storing product metadata as payload.
2. Add a `/backend/app/services/qdrant_client.py` wrapper with `search(query, top_k)` and `upsert(records)` functions, reused by both ingestion and the orchestrator.

**Acceptance criteria:**
- Running `python ingestion/ingest.py` populates Qdrant with at least 10 sample products.
- A manual test query (e.g. "laptop") returns the correct product via `qdrant_client.search()`.

---

## Phase 3 — Tool Implementations

**Goal:** The concrete functions the AI agent will be allowed to call. Build and unit-test these **before** wiring up the LLM — they must work correctly on their own first.

**Tasks:**
1. In `/backend/app/tools/`, implement each as a plain Python function with a clear docstring (used later for the Gemini function schema):
   - `check_inventory(product_query: str) -> list[dict]` — searches Qdrant, returns matching products with stock and price.
   - `calculate_quote(items: list[dict]) -> dict` — takes {sku, quantity} pairs, returns line items + total price, applying any discount rules you define (e.g. bulk discount >100 units).
   - `draft_quotation_email(customer_email: str, quote: dict) -> str` — generates the email body text (can use Gemini here too, or a template for MVP).
   - `send_email(to: str, subject: str, body: str) -> bool` — actually sends via SMTP/Gmail API. **This tool must be gated by the approval flow — never called directly by the agent without approval.**
   - `log_task_step(task_id, step_data)` — writes to `TaskStep` table.
2. Write a small test script that calls each tool directly with fake data and confirms correct output — no LLM involved yet.

**Acceptance criteria:**
- Each tool function works correctly when called directly in isolation.
- `send_email` successfully sends a test email to your own inbox when called manually (proves email credentials/integration work before the agent touches it).

---

## Phase 4 — AI Orchestrator (Gemini Function Calling Loop)

**Goal:** The core "agent" — receives a task, decides which tools to call, in what order, and produces a final result or pauses for approval.

**Tasks:**
1. In `/backend/app/orchestrator/`, define the Gemini function-calling schema for each tool from Phase 3 (name, description, parameters — Gemini's function declarations format).
2. Write `run_task(task_id: int)`:
   - Load the task and its employee config from Postgres.
   - Build the initial prompt: system instructions (role, permissions, "you must check inventory before quoting, and you must never call send_email directly — instead call request_approval") + the task input (e.g. the incoming email text).
   - Loop: call Gemini with the conversation history + available tools → if it returns a function call, execute the corresponding Phase 3 tool, log the step (`TaskStep`), append the result to the conversation, and call Gemini again → repeat until Gemini returns a final text response or calls `request_approval`.
   - Cap the loop at e.g. 8 iterations to prevent runaway loops — fail the task with status `failed` if exceeded.
3. Implement `request_approval(task_id, summary)` as a special tool: creates an `Approval` row with status `pending`, sets `Task.status = awaiting_approval`, and triggers Phase 5's notification.

**Acceptance criteria:**
- Given a fake task ("Please quote 200 units of SKU-123"), the orchestrator correctly calls `check_inventory`, then `calculate_quote`, then `draft_quotation_email`, then stops at `request_approval` — without ever calling `send_email` directly.
- Every tool call and result is visible in the `TaskStep` table afterward (full audit trail).

---

## Phase 5 — Approval Workflow (Telegram)

**Goal:** A human reviews and approves/rejects before anything external (like sending an email) actually happens.

**Tasks:**
1. Set up a Telegram bot (reuse your TKA bot pattern) with a webhook or polling loop in `/backend/app/services/telegram_bot.py`.
2. When `request_approval` is called (Phase 4), send a Telegram message to the configured approver with: a summary of the quote, and two inline buttons: **Approve** / **Reject**.
3. Handle the button callback:
   - On **Approve**: update `Approval.status = approved`, `Task.status = approved`, then resume the task — call `send_email` with the drafted quote, mark `Task.status = completed`.
   - On **Reject**: update `Approval.status = rejected`, `Task.status = rejected`, stop.

**Acceptance criteria:**
- Triggering a task end-to-end sends you a real Telegram message with quote details and buttons.
- Tapping Approve results in a real email being sent and the task status updating to `completed`.
- Tapping Reject stops the flow with no email sent.

---

## Phase 6 — API Endpoints (tie it all together)

**Goal:** External-facing FastAPI routes so tasks can be triggered and monitored.

**Tasks:**
1. `POST /employees` — create a new AI employee config (for demo, you may only ever create one).
2. `POST /tasks` — accepts a trigger payload (for MVP, simulate an incoming email as JSON: `{from, subject, body}`), creates a `Task` row, kicks off `run_task()` (as a background task or Redis queue job).
3. `GET /tasks/{id}` — returns task status and its full `TaskStep` trace (useful for demo day — show the "reasoning trail").
4. `GET /tasks` — list all tasks, for the dashboard.
5. Optional: `POST /email-webhook` — a real inbound email webhook (e.g. via SendGrid inbound parse) if you want a fully live email trigger instead of a simulated POST for your demo.

**Acceptance criteria:**
- You can `POST /tasks` with a sample quote request and watch it progress through statuses by polling `GET /tasks/{id}`.
- The full tool-call trace is visible and makes sense when read top to bottom.

---

## Phase 7 — Minimal Dashboard (Next.js)

**Goal:** Just enough UI to make the demo visually convincing — not a full product.

**Tasks:**
1. One page: list of tasks with status badges (color-coded: received/processing/awaiting_approval/completed/rejected).
2. Click into a task → show the step-by-step trace (what the agent did, in order) — this is your best "wow" moment for judges.
3. A simple "Trigger Demo Task" button that calls `POST /tasks` with a pre-filled sample quote request, so you don't have to use Postman live on stage.

**Acceptance criteria:**
- You can click one button on stage and watch a task move from "received" to "awaiting_approval" in near-real time on the dashboard, approve it on your phone via Telegram, and see it complete live.

---

## Phase 8 — Deployment

**Goal:** A publicly reachable demo link.

**Tasks:**
1. Push the Docker Compose stack to an AWS EC2 instance (same pattern as your MedRAG project).
2. Set up Nginx + Let's Encrypt for HTTPS on the dashboard and API.
3. Set environment variables securely (not committed to git).
4. Do a full end-to-end dry run on the deployed instance at least once before demo day.

**Acceptance criteria:**
- The dashboard is reachable at a public HTTPS URL.
- A full task (trigger → approve via Telegram → email sent → task completed) works on the deployed instance, not just locally.

---

## Phase 9 — Demo Script (for pitch day, not code)

Write out the literal words and clicks for your 3-minute demo:
1. "Here's our AI Finance Officer, configured to handle quote requests." (show dashboard)
2. Click "Trigger Demo Task" — simulates a customer emailing "Please quote 200 laptops."
3. Narrate the trace live as it appears: "It's checking inventory... calculating pricing with a bulk discount... drafting the email..."
4. Show your phone — the Telegram approval message arrives.
5. Tap Approve on stage.
6. Show the dashboard updating to "completed," and (ideally) show the actual sent email arriving in an inbox.
7. Close with the audit trail: "Every decision it made is logged — nothing happens without a human sign-off."

---

## Notes for Your AI Coding Agent

- Build and test each phase in isolation before moving to the next — do not let the agent skip ahead to Phase 4 before Phase 3's tools are proven to work standalone.
- Do not use any data, code, or pipeline from prior employer/internship work — all sample data (products, prices) should be fabricated or from public sources only.
- Keep secrets (API keys, email credentials) in `.env`, never hard-coded or committed.
- Favor the smallest working version of each phase over a "complete" version — this is a 2-month demo build, not a production system.
