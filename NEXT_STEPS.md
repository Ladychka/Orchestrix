# Next Steps — From Code Written to Demo Ready

**Status:** All code files are created, but **zero acceptance criteria have been verified**. The project will not run until these steps are completed in strict order.

---

## Step 1 — Start Docker Desktop

**Why:** `docker compose up` failed earlier because the Docker engine was not running.

**Action:**
- Open Docker Desktop on your machine.
- Wait until the engine status shows "Running".

**Verify:**
```bash
docker ps
```
Should return an empty table (no error).

---

## Step 2 — Fill in Real Secrets

**Why:** `.env` currently has empty placeholders. Gemini, Telegram, and email will fail without real values.

**Action:**
Edit `W:\FirstWave\.env` and replace placeholders with real credentials:

| Variable | How to get it |
|----------|---------------|
| `GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com/app/apikey) |
| `TELEGRAM_BOT_TOKEN` | Message [@BotFather](https://t.me/botfather) on Telegram, create a new bot, copy the token |
| `TELEGRAM_APPROVER_CHAT_ID` | Message [@userinfobot](https://t.me/userinfobot) on Telegram to get your chat ID |
| `EMAIL_USER` | Your Gmail address |
| `EMAIL_PASS` | Gmail App Password (not your regular password) — generate at Google Account → Security → 2-Step Verification → App passwords |

**Do not commit this file.** `.gitignore` already ignores `.env`.

---

## Step 3 — Start All Services

**Why:** Phase 0 acceptance criteria require all four services to start without errors.

**Action:**
```bash
cd W:\FirstWave
docker compose up --build -d
```

**Verify:**
```bash
docker ps
```
You should see containers: `aiep_backend`, `aiep_postgres`, `aiep_qdrant`, `aiep_redis`.

---

## Step 4 — Health Check

**Why:** Phase 0 acceptance criteria.

**Action:**
```bash
curl http://localhost:8000/health
```

**Expected:**
```json
{"status": "ok"}
```

---

## Step 5 — Initialize Database + Seed Employee

**Why:** Phase 1 acceptance criteria.

**Action:**
```bash
docker exec aiep_backend python init_db.py
```

**Verify:**
```bash
docker exec -it aiep_postgres psql -U aiep -d aiep -c "SELECT * FROM ai_employees;"
```

**Expected:** One row with `role='finance_officer'` and `permissions={"can_send_email": false, "requires_approval": true}`.

---

## Step 6 — Ingest Products into Qdrant

**Why:** Phase 2 acceptance criteria.

**Action:**
```bash
docker exec aiep_backend python -m ingestion.ingest
```

**Verify (manual search):**
```bash
docker exec -it aiep_backend python -c "
from app.services.qdrant_client import QdrantService
svc = QdrantService()
results = svc.search('laptop', top_k=3)
for r in results:
    print(r)
"
```

**Expected:** At least 3 laptop results with correct SKUs, prices, and stock quantities.

---

## Step 7 — Test Tools in Isolation

**Why:** Phase 3 acceptance criteria — tools must work standalone before the LLM touches them.

**Action:**
```bash
docker exec aiep_backend python test_tools.py
```

**Expected:**
- `check_inventory` returns products for "laptop"
- `calculate_quote` returns correct total with 5% bulk discount for qty > 100
- `draft_quotation_email` returns a professional email body
- `send_email` result depends on credentials — if configured, a real email should land in your inbox

---

## Step 8 — Send a Real Test Email

**Why:** Phase 3 acceptance criteria — prove SMTP credentials work before demo day.

**Action:**
```bash
docker exec -it aiep_backend python -c "
from app.tools.send_email import send_email
result = send_email('YOUR_EMAIL@gmail.com', 'Test from AI Finance Officer', 'This is a test email.')
print('Sent:', result)
"
```

**Expected:** `Sent: True` and the email appears in your inbox within seconds.

If this fails, fix `EMAIL_USER` / `EMAIL_PASS` in `.env` and restart the backend container.

---

## Step 9 — Run a Full Task Through the Orchestrator

**Why:** Phase 4 acceptance criteria — verify the agent calls the right tools in order and stops at `request_approval`.

**Action:**
```bash
curl -X POST http://localhost:8000/tasks \
  -H "Content-Type: application/json" \
  -d '{"from_email":"customer@example.com","subject":"Quote request","body":"Please quote 200 units of SKU-101.","employee_id":1}'
```

**Verify:**
1. The response returns a `task_id`.
2. Poll `GET http://localhost:8000/tasks/{task_id}` until status becomes `awaiting_approval`.
3. Check the step trace — you should see:
   - Step 0: `check_inventory`
   - Step 1: `calculate_quote`
   - Step 2: `draft_quotation_email`
   - Step 3: `request_approval`
   - **No `send_email` step should exist.**

---

## Step 10 — Verify Telegram Approval

**Why:** Phase 5 acceptance criteria.

**Action:**
1. Open Telegram on your phone.
2. Find the message from your bot with the quote summary and **Approve / Reject** buttons.

**Verify Approve path:**
- Tap **Approve**.
- Check your email inbox — the quotation email should arrive.
- Poll `GET /tasks/{task_id}` — status should become `completed`.
- A new `send_email` step should appear in the trace.

**Verify Reject path:**
- Create another task via `POST /tasks`.
- Tap **Reject** in Telegram.
- Poll `GET /tasks/{task_id}` — status should become `rejected`.
- **No email should be sent.**

---

## Step 11 — Start the Dashboard and Watch Live

**Why:** Phase 7 acceptance criteria.

**Action:**
```bash
cd W:\FirstWave\frontend
npm run dev
```

**Verify:**
1. Open `http://localhost:3000` in your browser.
2. Click **Trigger Demo Task**.
3. Watch the task list update in near-real time.
4. Click **View trace** on the new task.
5. Watch steps appear live as the agent works.
6. Approve via Telegram.
7. Watch status flip to `completed` on the dashboard without refreshing.

---

## Step 12 — Deploy to AWS EC2

**Why:** Phase 8 acceptance criteria — public HTTPS demo link.

**Prerequisites:**
- EC2 instance (Ubuntu 22.04, t3.medium recommended)
- Security group: ports 22, 80, 443 open
- Domain name pointing to the EC2 public IP

**Action:**
```bash
# Copy code
rsync -avz --exclude='node_modules' --exclude='.next' --exclude='__pycache__' ./ ubuntu@YOUR_EC2_IP:/opt/aiep/

# Copy secrets
scp .env ubuntu@YOUR_EC2_IP:/opt/aiep/.env

# Run deploy script
./deploy.sh ubuntu@YOUR_EC2_IP yourdomain.com
```

**Verify:**
- `https://yourdomain.com` loads the dashboard.
- Run the full flow (trigger → approve via Telegram → email sent → completed) on the deployed instance.

---

## Summary Checklist

| # | Step | Done? |
|---|------|-------|
| 1 | Docker Desktop running | [ ] |
| 2 | `.env` filled with real secrets | [ ] |
| 3 | `docker compose up --build` succeeds | [ ] |
| 4 | `GET /health` returns `{"status": "ok"}` | [ ] |
| 5 | `init_db.py` ran, tables + seeded employee verified | [ ] |
| 6 | `ingest.py` ran, Qdrant search returns products | [ ] |
| 7 | `test_tools.py` passes | [ ] |
| 8 | Real test email sent successfully | [ ] |
| 9 | Orchestrator runs task: inventory → quote → draft → approval | [ ] |
| 10 | Full `TaskStep` trace visible and correct | [ ] |
| 11 | Telegram Approve sends email, task completes | [ ] |
| 12 | Telegram Reject stops flow, no email | [ ] |
| 13 | Dashboard live demo works (trigger → watch → approve → complete) | [ ] |
| 14 | Deployed to EC2, full dry run passes on public URL | [ ] |

---

**Do not skip steps.** The build plan explicitly forbids jumping ahead. If any step fails, fix it before proceeding.
