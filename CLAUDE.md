# CLAUDE.md

## Project Intent

This repository contains a multi-service KPI project management and cowork tool for KEFICO-style workflows.
The stack is split across:

- `backend/`: FastAPI REST API for auth, users, projects, and persistence
- `realtime/`: FastAPI WebSocket service backed by Redis pub/sub
- `frontend/`: Next.js App Router UI in TypeScript
- `ai-chatbot/`: FastAPI service for LLM-backed chatbot features
- `database/`: SQL bootstrap and database assets
- `docs/`: supporting product and deployment notes

Prefer preserving the existing multi-service boundaries instead of inventing shared abstractions too early.

## Working Style

- Explore first, then plan, then edit.
- Keep changes scoped to the service that owns the behavior.
- Do not refactor unrelated files while implementing a feature or fix.
- When a request touches project types, verification states, progress rules, or calendars, inspect both backend schemas/models and frontend labels/types before editing.
- Call out assumptions quickly when Korean product terminology is ambiguous.

## Architecture Notes

- Backend is the source of truth for data rules, enums, status transitions, and persistence.
- Frontend mirrors many backend enums and labels in `frontend/app/lib/api.ts`; keep these in sync with backend changes.
- Realtime and AI chatbot are separate services. Do not route their responsibilities through the main backend unless the repo already does so.
- `docker-compose.yml` is the source of truth for full-stack local orchestration.
- The repo currently favors simple service-local setup over a monorepo task runner.

## Commands

Run commands from the owning service directory unless the task is Docker-wide.

### Frontend

- Install: `npm install`
- Dev: `npm run dev`
- Build: `npm run build`
- Lint: `npm run lint`

### Backend

- Install: `pip install -r requirements.txt`
- Dev: `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`
- Tests: `pytest`

### Realtime

- Install: `pip install -r requirements.txt`
- Dev: `uvicorn app.main:app --reload --host 0.0.0.0 --port 8001`
- Tests: `pytest`

### AI Chatbot

- Install: `pip install -r requirements.txt`
- Dev: `uvicorn app.main:app --reload --host 0.0.0.0 --port 8002`
- Tests: `pytest`

### Full Stack

- Production-like compose: `docker compose up --build`
- Dev compose with live reload: `docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build`

## Verification Expectations

Choose the smallest verification set that proves the change.

- Frontend-only UI or state changes: run `npm run lint` in `frontend/`
- Backend API or auth changes: run `pytest` in `backend/`
- Realtime changes: run `pytest` in `realtime/`
- AI chatbot changes: run `pytest` in `ai-chatbot/`
- Cross-service contract changes:
  - verify backend schema or response shape
  - verify frontend usage of the changed fields
  - run the relevant service checks on every touched service

If a command cannot be run because dependencies or infrastructure are unavailable, say so clearly and explain what remains unverified.

## Editing Guidance

- Prefer minimal, localized edits over wide rewrites.
- Preserve existing naming unless the current name is clearly wrong and the rename is part of the task.
- Add comments only when the code would otherwise be hard to follow.
- Keep strings and labels consistent with the existing Korean product language.
- Watch for encoding-sensitive files. If a file already contains garbled text, avoid opportunistic cleanup unless the task is specifically about encoding.
- Do not manually edit generated artifacts unless the task requires it.

## Data And Product Rules

- Project type and verification-related changes often affect:
  - backend models
  - backend schemas
  - backend routers
  - frontend API types and labels
  - UI forms and pages
- Progress and completion logic are product-critical. Any change here should be treated as a behavior change, not a cosmetic refactor.
- Date validation and completion constraints should remain enforced on the backend.
- Admin/member role behavior should be checked for regressions whenever auth, team, or assignment flows change.

## Good Task Patterns

- "Read backend and frontend project-type handling, then implement the new status end-to-end and run the relevant checks."
- "Fix the bug with the smallest safe change, explain the root cause, and verify in the owning service."
- "Update the API contract and the matching frontend labels together."

## Avoid

- Changing multiple services without checking the interface between them
- Updating frontend labels without verifying backend enum support
- Mixing unrelated cleanup with feature work
- Claiming something is verified without running the relevant command
