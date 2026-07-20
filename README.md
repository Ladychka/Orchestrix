# 🤖 AI Finance Officer — Autonomous AI Agent with Human-in-the-Loop Approval

> **An AI employee that handles quotation workflows end-to-end: reads requests, checks inventory, calculates quotes, drafts emails, and stops for human approval before sending.**

---

## 🎬 What It Does (30-Second Pitch)

A customer emails a quote request → The **AI Finance Officer** (an autonomous agent powered by a local LLM) springs into action:

1. 🔍 **Checks inventory** via semantic search in Qdrant
2. 🧮 **Calculates a quote** with automatic bulk discounts (>100 units = 5% off)
3. ✉️ **Drafts a professional HTML email** with a styled quotation table
4. ⏸️ **Pauses and asks for human approval** via Telegram (Approve ❌ Reject)
5. ✅ **On approval** → sends the email, logs every step to Postgres, and marks complete

**The human is always in control.** The AI never sends an email without explicit approval.

---

## 🏗️ Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│   Customer  │────▶│  FastAPI     │────▶│  Ollama (Local) │
│   Email     │     │  Backend     │     │  kimi-k2.6      │
└─────────────┘     └──────────────┘     └─────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
   ┌─────────┐      ┌─────────┐       ┌──────────┐
   │ Qdrant  │      │ Postgres│       │  Redis   │
   │ (Vector)│      │ (Tasks) │       │ (Cache)  │
   └─────────┘      └─────────┘       └──────────┘
        │
        ▼
   ┌──────────────────────────────────────────┐
   │          Telegram Bot                    │
   │   [ ✅ Approve ]  [ ❌ Reject ]          │
   └──────────────────────────────────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │   Gmail     │
                    │   (SMTP)    │
                    └─────────────┘
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Backend** | FastAPI + SQLAlchemy + Alembic |
| **AI / LLM** | Ollama (`kimi-k2.6:cloud`) — function calling + text fallback |
| **Vector DB** | Qdrant (semantic product search) |
| **Database** | PostgreSQL (tasks, employees, approvals, audit trail) |
| **Queue / Cache** | Redis |
| **Approval** | Telegram Bot API (inline keyboard buttons) |
| **Email** | Gmail SMTP with multipart HTML + plain text |
| **Frontend** | Next.js 14 + TypeScript + Tailwind CSS + lucide-react |
| **Infra** | Docker Compose (6 services) |

---

## 📋 Prerequisites

Before you start, you need:

| Requirement | How to Get It |
|-------------|---------------|
| **Docker Desktop** | [docker.com](https://docker.com) — must be running |
| **Ollama** | [ollama.com](https://ollama.com) — `ollama pull kimi-k2.6:cloud` |
| **Telegram Bot** | Message [@BotFather](https://t.me/botfather) → create bot → copy token |
| **Telegram Chat ID** | Message [@userinfobot](https://t.me/userinfobot) → get your numeric ID |
| **Gmail App Password** | Google Account → Security → 2-Step Verification → App Passwords |

---

## 🚀 Quick Start (5 Minutes)

### Step 1 — Clone & Configure

```bash
git clone https://github.com/Ladychka/Orchestrix.git
cd Orchestrix
```

Copy the environment file and fill in your secrets:

```bash
cp .env.example .env
```

Edit `.env` with your real values:

```env
# Ollama (local LLM)
OLLAMA_URL=http://host.docker.internal:11434
OLLAMA_MODEL=kimi-k2.6:cloud

# Telegram Bot
TELEGRAM_BOT_TOKEN=YOUR_BOT_TOKEN_HERE
TELEGRAM_APPROVER_CHAT_ID=YOUR_CHAT_ID_HERE

# Gmail SMTP
EMAIL_USER=your@gmail.com
EMAIL_PASS=your_app_password_here  # NOT your regular password!
```

### Step 2 — Start All Services

```bash
docker compose up --build -d
```

Verify all 6 containers are running:

```bash
docker ps
```

Expected: `aiep_backend`, `aiep_frontend`, `aiep_nginx`, `aiep_postgres`, `aiep_qdrant`, `aiep_redis`.

### Step 3 — Initialize Database

```bash
# Seed the AI Finance Officer
docker exec aiep_backend python init_db.py

# Load products into Qdrant
docker exec aiep_backend python -m ingestion.ingest
```

### Step 4 — Verify

```bash
# Backend health
curl http://localhost:8000/health
# → {"status": "ok"}

# Frontend
curl -I http://localhost:3000
# → HTTP/1.1 200 OK
```

---

## 🎮 Demo Script (3 Minutes)

### 1. Open the Dashboard
Go to `http://localhost:3000`

You should see:
- **AI Finance Officer** profile card (name, role, permissions, tools, stats)
- **Recent Tasks** table (empty if first run)

### 2. Trigger a Demo Task
Click **"Trigger Demo Task"** or run:

```bash
curl -X POST http://localhost:8000/tasks \
  -H "Content-Type: application/json" \
  -d '{"from_email":"customer@example.com","subject":"Quote request","body":"Please quote 200 units of SKU-101.","employee_id":1}'
```

### 3. Watch the Agent Work
The task appears in the table with status **"Processing"** (blue pulsing). Click **"View trace"** to see the live step-by-step reasoning:

| Step | Tool | What Happens |
|------|------|--------------|
| 0 | 🔍 `check_inventory` | Searches Qdrant for SKU-101 (ProBook Laptop) |
| 1 | 🧮 `calculate_quote` | Computes $170,810 with 5% bulk discount |
| 2 | ✉️ `draft_quotation_email` | Generates professional HTML email |
| 3 | ⏸️ `request_approval` | **Pauses** — sends Telegram approval request |

### 4. Approve via Telegram
Open Telegram. You'll see a message like:

```
🔔 APPROVAL REQUEST — Task #X
━━━━━━━━━━━━━━━━━━━━

📋 Quotation Summary
• 👤 Customer: customer@example.com
• 📦 Product: ProBook 15-inch Laptop (SKU-101)
• 📊 Quantity: 200 units
• 💵 Unit Price: $899.00
• 🏷️ Bulk Discount: -$8,990.00
• 💰 Total: $170,810.00 USD

⚠️ Warning: Only 45 units in stock.

━━━━━━━━━━━━━━━━━━━━

Please choose an action:
[ ✅ Approve & Send ]  [ ❌ Reject ]
```

**Tap ✅ Approve & Send** → The email is sent immediately.

### 5. Verify Completion
- Dashboard status flips to **"Completed"** (green)
- New step appears: 📤 `send_email` — ✅ sent
- Check your Gmail inbox for the HTML quotation email with a styled table

---

## 📸 Screenshots

| Page | Description |
|------|-------------|
| `http://localhost:3000` | Employee profile card + recent tasks |
| `http://localhost:3000/tasks` | Full task list with filters |
| `http://localhost:3000/tasks/1` | Step-by-step trace with timeline |
| Telegram | Approval request with bullet-point summary |
| Gmail | Professional HTML quotation email |

*(Replace with actual screenshots for your submission)*

---

## 🔑 Key Features

| Feature | Why It Matters |
|---------|----------------|
| **Human-in-the-Loop Approval** | The AI never sends emails autonomously — a human must approve every quotation via Telegram |
| **Full Audit Trail** | Every tool call is logged to Postgres as a `TaskStep` — complete transparency |
| **Semantic Product Search** | Qdrant vector search finds products by name, description, or SKU |
| **Bulk Discount Automation** | >100 units triggers 5% discount automatically |
| **Multipart HTML Emails** | Customers receive professionally styled quotation tables, not plain text |
| **Live Dashboard** | 3-second polling updates task status and step trace in real time |
| **Local LLM (Ollama)** | No API keys or rate limits — runs entirely on your machine |

---

## 🧪 Testing

```bash
# Test tools in isolation (no LLM)
docker exec aiep_backend python test_tools.py

# Test full task flow via API
curl -X POST http://localhost:8000/tasks -H "Content-Type: application/json" \
  -d '{"from_email":"test@test.com","subject":"Quote","body":"Quote 50 units of SKU-102","employee_id":1}'

# Poll for status
curl http://localhost:8000/tasks/1
```

---

## 🛠️ Troubleshooting

| Problem | Fix |
|---------|-----|
| `docker compose up` fails | Make sure **Docker Desktop** is running. Run `docker ps` first. |
| Backend returns 500 on tasks | Ollama not reachable from Docker. Ensure Ollama is running on `localhost:11434` and `.env` has `OLLAMA_URL=http://host.docker.internal:11434`. |
| Telegram messages not arriving | Double-check `TELEGRAM_BOT_TOKEN` and `TELEGRAM_APPROVER_CHAT_ID`. The bot must be started *after* Docker is up. |
| Emails not sending | Use a **Gmail App Password**, not your regular password. Enable 2-Step Verification first. |
| Tasks stuck at "received" | The orchestrator crashed. Check `docker compose logs backend` for Ollama or model errors. |
| Frontend shows unstyled white page | The Next.js build failed. Check `docker compose logs frontend` and re-run `docker compose up --build`. |

---

## 📁 Project Structure

```
Orchestrix/
├── backend/                 # FastAPI backend
│   ├── app/
│   │   ├── api/             # REST endpoints
│   │   ├── orchestrator/    # Ollama AI agent loop
│   │   ├── services/        # Qdrant, Telegram, Ollama clients
│   │   ├── tools/           # Inventory, quote, email, audit
│   │   └── models/          # SQLAlchemy schemas
│   ├── ingestion/           # Product catalog → Qdrant
│   └── init_db.py           # Seed AI Finance Officer
├── frontend/                # Next.js 14 dashboard
│   └── src/app/
│       ├── page.tsx         # Home (employee + tasks)
│       ├── tasks/page.tsx   # Full task list
│       └── tasks/[id]/      # Task detail trace
├── nginx/                   # Reverse proxy config
├── docker-compose.yml       # 6-service orchestration
└── .env                     # Your secrets (gitignored)
```

---

## 🏆 Built For

This project was built as a **demo-ready MVP** showcasing:
- Autonomous AI agents with tool calling
- Human-in-the-loop safety guardrails
- Real-time monitoring dashboards
- End-to-end workflow automation (inventory → quote → email)

**Perfect for:** hackathons, pitch decks, AI agent prototypes, and production finance automation pipelines.

---

## 📄 License

MIT — free to use, modify, and deploy.
