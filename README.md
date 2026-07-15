# AI Employee Platform — AI Finance Officer MVP

A narrow, fully demoable slice of the AI Digital Employee Platform: an **AI Finance Officer** that handles quotation workflows with human-in-the-loop approval.

## Stack

- **Backend:** FastAPI, SQLAlchemy, Alembic
- **AI / Vector:** Gemini (function calling), Qdrant, sentence-transformers
- **Queue / Cache:** Redis
- **Approval:** Telegram Bot API
- **Frontend:** Next.js (Phase 7)
- **Infra:** Docker Compose

## Quick Start

1. Copy environment file and fill in your secrets:
   ```bash
   cp .env.example .env
   ```

2. Start all services:
   ```bash
   docker compose up --build
   ```

3. Check health:
   ```bash
   curl http://localhost:8000/health
   ```

## Build Plan

See [ai-employee-platform-build-plan.md](ai-employee-platform-build-plan.md) for the full phased build plan.
