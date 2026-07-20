# AI Finance Officer

An autonomous AI agent that handles customer quotation workflows end-to-end, with a mandatory human-in-the-loop approval gate before any email is sent.

A customer sends a quote request by email. The AI Finance Officer reads it, searches inventory, calculates pricing with bulk discounts, drafts a professional quotation email, and pauses for human approval via Telegram. Only after explicit approval does it send the email.

Every action is logged to an auditable step trace.

---

## What It Does

1. **Ingests requests** — Reads quote requests from incoming emails or manual triggers
2. **Checks inventory** — Semantic search over a product catalog stored in Qdrant
3. **Calculates quotes** — Applies line-item pricing and automatic 5% bulk discounts for quantities over 100
4. **Drafts emails** — Generates professional HTML quotation emails with styled tables
5. **Requests approval** — Sends a structured summary to a human approver via Telegram with Approve/Reject buttons
6. **Sends on approval** — Dispatches the email via Gmail SMTP only after explicit human consent
7. **Logs everything** — Every tool call is recorded as a step in Postgres for full auditability

---

## Architecture

```
Customer Request
      |
      v
FastAPI Backend  ------>  Ollama (Local LLM)
      |                          |
      |----> Qdrant (Vector DB)  |
      |----> Postgres (Tasks)    |
      |----> Redis (Cache)      |
      |
      v
Telegram Bot  <----  Human Approver
      |
      v
Gmail SMTP  ------>  Customer Inbox
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend API | FastAPI, SQLAlchemy, Alembic |
| AI / LLM | Ollama (`kimi-k2.6:cloud`) with tool-calling and text-parsing fallback |
| Vector Search | Qdrant (product embedding and semantic search) |
| Database | PostgreSQL (tasks, employees, approvals, audit steps) |
| Cache / Queue | Redis |
| Approval Channel | Telegram Bot API (inline keyboard buttons) |
| Email Delivery | Gmail SMTP with multipart HTML + plain text |
| Dashboard | Next.js 14, TypeScript, Tailwind CSS, lucide-react |
| Infrastructure | Docker Compose (6 services) |

---

## Prerequisites

| Requirement | How to Obtain |
|-------------|---------------|
| Docker Desktop | [docker.com](https://docker.com) — must be running |
| Ollama | [ollama.com](https://ollama.com) — run `ollama pull kimi-k2.6:cloud` |
| Telegram Bot Token | Message [@BotFather](https://t.me/botfather) on Telegram |
| Telegram Chat ID | Message [@userinfobot](https://t.me/userinfobot) on Telegram |
| Gmail App Password | Google Account → Security → 2-Step Verification → App Passwords |

---

## Setup

### 1. Clone and Configure

```bash
git clone https://github.com/Ladychka/Orchestrix.git
cd Orchestrix
cp .env.example .env
```

Edit `.env` and fill in your credentials:

```env
# Ollama (local LLM)
OLLAMA_URL=http://host.docker.internal:11434
OLLAMA_MODEL=kimi-k2.6:cloud

# Telegram Bot
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_APPROVER_CHAT_ID=your_chat_id_here

# Gmail SMTP
EMAIL_USER=your@gmail.com
EMAIL_PASS=your_app_password_here
```

### 2. Start Services

```bash
docker compose up --build -d
```

Verify all 6 containers are running:

```bash
docker ps
```

Expected containers: `aiep_backend`, `aiep_frontend`, `aiep_nginx`, `aiep_postgres`, `aiep_qdrant`, `aiep_redis`.

### 3. Initialize Data

```bash
# Seed the AI Finance Officer employee
docker exec aiep_backend python init_db.py

# Load products into Qdrant
docker exec aiep_backend python -m ingestion.ingest
```

### 4. Verify

```bash
curl http://localhost:8000/health
# Expected: {"status": "ok"}

curl -I http://localhost:3000
# Expected: HTTP/1.1 200 OK
```

---

## How to Use

### Trigger a Task

```bash
curl -X POST http://localhost:8000/tasks \
  -H "Content-Type: application/json" \
  -d '{"from_email":"customer@example.com","subject":"Quote request","body":"Please quote 200 units of SKU-101.","employee_id":1}'
```

Or use the dashboard at `http://localhost:3000` and click **Trigger Demo Task**.

### Watch the Agent Work

Poll the task to see the step trace grow:

```bash
curl http://localhost:8000/tasks/1
```

The agent runs these tools in order:

| Step | Tool | Purpose |
|------|------|---------|
| 0 | `check_inventory` | Searches Qdrant for the requested SKU |
| 1 | `calculate_quote` | Computes line items, discounts, and total |
| 2 | `draft_quotation_email` | Generates HTML + plain text email body |
| 3 | `request_approval` | Pauses and sends Telegram approval request |

### Approve via Telegram

You will receive a message like:

```
APPROVAL REQUEST — Task #1
━━━━━━━━━━━━━━━━━━━━

Quotation Summary
- Customer: customer@example.com
- Product: ProBook 15-inch Laptop (SKU-101)
- Quantity: 200 units
- Unit Price: $899.00
- Bulk Discount: -$8,990.00
- Total: $170,810.00 USD

Warning: Only 45 units currently in stock.

[ Approve & Send ]  [ Reject ]
```

Tap **Approve & Send** — the email is dispatched immediately.

### Verify Completion

The task status changes to `completed`. A new `send_email` step appears in the trace. The HTML quotation email arrives in the customer's inbox with a styled table, gradient header, and validity banner.

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Human-in-the-Loop Approval** | The AI cannot send emails autonomously. Every quotation requires explicit human approval via Telegram, creating a trust and safety boundary. |
| **Full Audit Trail** | Every tool call is persisted as a `TaskStep` in Postgres. The dashboard renders this as a live timeline for complete transparency. |
| **Local LLM (Ollama)** | No external API keys or rate limits. Runs entirely on the host machine. The agent uses tool-calling when supported, with a text-parsing fallback. |
| **Exact SKU Lookup** | Semantic search alone matched wrong products for SKU codes. We added payload-filtered exact lookup for SKU strings while keeping semantic search for product descriptions. |
| **Multipart HTML Emails** | Plain text emails look unprofessional. The system sends both HTML (styled table, gradient header, validity banner) and plain text (fallback) in a single MIME message. |

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `docker compose up` fails | Ensure Docker Desktop is running. Run `docker ps` first to confirm. |
| Backend returns 500 on tasks | Ollama is not reachable from the container. Verify Ollama is running on `localhost:11434` and `.env` uses `OLLAMA_URL=http://host.docker.internal:11434`. |
| Telegram messages not arriving | Verify `TELEGRAM_BOT_TOKEN` and `TELEGRAM_APPROVER_CHAT_ID`. The bot starts automatically when the backend container boots. |
| Emails not sending | Use a Gmail **App Password**, not your regular account password. Requires 2-Step Verification to be enabled first. |
| Tasks stuck at "received" | The orchestrator crashed before calling tools. Check `docker compose logs backend` for Ollama connection or model errors. |
| Frontend is unstyled white page | The Next.js build failed. Check `docker compose logs frontend` and re-run `docker compose up --build`. |

---

## Project Structure

```
Orchestrix/
├── backend/
│   ├── app/
│   │   ├── api/              # REST endpoints (tasks, employees)
│   │   ├── orchestrator/     # Ollama agent loop with tool routing
│   │   ├── services/         # Qdrant, Telegram, Ollama clients
│   │   ├── tools/            # check_inventory, calculate_quote, draft_email, send_email, log_step
│   │   └── models/           # SQLAlchemy: Task, TaskStep, Approval, AIEmployee
│   ├── ingestion/            # products.json → Qdrant embedding pipeline
│   └── init_db.py            # Seeds the AI Finance Officer
├── frontend/
│   └── src/app/
│       ├── page.tsx          # Dashboard: employee card + recent tasks
│       ├── tasks/page.tsx    # Full task list with status filters
│       └── tasks/[id]/       # Task detail with live step timeline
├── nginx/                    # Reverse proxy (dev + prod configs)
├── docker-compose.yml        # 6-service orchestration
└── .env                      # Secrets (gitignored)
```

---

## Testing

```bash
# Verify tools in isolation
docker exec aiep_backend python test_tools.py

# Trigger a task via API
curl -X POST http://localhost:8000/tasks -H "Content-Type: application/json" \
  -d '{"from_email":"test@test.com","subject":"Quote","body":"Quote 50 units of SKU-102","employee_id":1}'

# Poll task status
curl http://localhost:8000/tasks/1
```

---

## License

MIT
