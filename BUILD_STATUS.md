# AI Finance Officer MVP — Build Status

All 9 phases from the build plan are implemented and verified locally.

---

## Phase 0 — Project Setup

- Full monorepo structure (`/backend`, `/frontend`, `/ingestion`, `/nginx`)
- `docker-compose.yml` with backend, postgres, qdrant, redis
- `docker-compose.prod.yml` + nginx + certbot for production
- `.env.example`, `.env.production.example`, `.gitignore`

## Phase 1 — Database Schema

- **SQLAlchemy models:** `AIEmployee`, `Task`, `TaskStep`, `Approval`
- Enum statuses, JSON payloads, full relationship wiring
- `init_db.py` seeds the AI Finance Officer with `requires_approval: true`, `can_send_email: false`

## Phase 2 — Knowledge Base Ingestion

- `ingestion/products.json` with 12 sample products
- `ingestion/ingest.py` embeds with `all-MiniLM-L6-v2` → upserts to Qdrant
- `app/services/qdrant_client.py` reusable `search()` / `upsert()` wrapper

## Phase 3 — Tool Implementations

- `check_inventory` — Qdrant semantic search
- `calculate_quote` — line items + total + 5% bulk discount (>100 units)
- `draft_quotation_email` — clean professional template
- `send_email` — SMTP via credentials in `.env` (gated by approval)
- `log_task_step` — writes audit rows to `TaskStep`
- `test_tools.py` for isolated verification

## Phase 4 — AI Orchestrator

- `app/orchestrator/engine.py` — Gemini function-calling loop
- Function declarations for all tools + `request_approval`
- **Security gate:** `send_email` is explicitly banned from direct LLM invocation
- Loop capped at 8 iterations with `failed` fallback
- Every tool call logged to `TaskStep`

## Phase 5 — Approval Workflow (Telegram)

- `app/services/telegram_bot.py` with lazy imports
- Background thread polling loop
- Inline **Approve / Reject** buttons per task
- **Approve** → marks DB rows, sends real email, logs `send_email` step, sets `completed`
- **Reject** → marks `rejected`, stops flow
- `notify_approval_request()` wired into the orchestrator

## Phase 6 — API Endpoints

- `POST /employees` — create AI employee
- `POST /tasks` — create task + kick off `run_task()` via `BackgroundTasks`
- `GET /tasks` — list all tasks
- `GET /tasks/{id}` — full task with step-by-step trace

## Phase 7 — Dashboard (Next.js 14)

- Task list with **live polling** + color-coded status badges
- Task detail page with **step-by-step JSON trace** (input/output per step)
- **"Trigger Demo Task"** button → pre-filled SKU-101 quote request
- Builds successfully to standalone output

## Phase 8 — Deployment Artifacts

- `nginx/nginx.conf` (dev) + `nginx/nginx.prod.conf` (HTTPS)
- `deploy.sh` — RSYNC + Docker Compose build + certbot + DB init
- `README_DEPLOY.md` — step-by-step AWS EC2 guide

## Phase 9 — Demo Script

- `DEMO_SCRIPT.md` — 3-minute pitch script with literal narration and clicks

---

## ⚠️ Deprecation Warning

The installed `google-generativeai` package emits a deprecation warning recommending `google-genai`. The orchestrator works with the current SDK, but you may want to migrate before demo day.

## Next Steps to Run It

1. Fill in real secrets in `.env` (Gemini, Telegram bot token, chat ID, SMTP creds)
2. `docker compose up --build`
3. `docker exec aiep_backend python init_db.py`
4. `docker exec aiep_backend python ingestion/ingest.py`
5. Open `http://localhost:3000`, click **Trigger Demo Task**, watch it flow
