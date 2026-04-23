# Codex Project Instructions

This repository uses Codex as a practical coding agent inside a multi-service KPI project management tool.

These instructions are adapted from the "Everything Claude Code" workflow system and narrowed to fit this project safely.

## Core Priorities

1. Plan before editing when a task spans multiple files or services.
2. Keep service ownership clear.
3. Prefer testable, reversible changes over broad rewrites.
4. Treat security, auth, and progress logic as product-critical.
5. Verify the smallest meaningful surface before closing a task.

## Project Shape

- `frontend/`: Next.js App Router UI in TypeScript
- `backend/`: FastAPI REST API and persistence rules
- `realtime/`: FastAPI WebSocket and Redis-backed realtime features
- `ai-chatbot/`: FastAPI service for AI features
- `database/`: SQL bootstrap assets
- `docs/`: product, deployment, and implementation notes

Preserve these boundaries unless the repo already establishes a shared path.

## Operating Model

- Explore first, then implement.
- Read the owning service before changing behavior.
- If a request touches calendars, project types, verification states, assignees, or progress:
  - inspect backend models and schemas
  - inspect backend routers
  - inspect frontend API types and labels
- Do not mix unrelated cleanup into feature work.

## ECC-Inspired Working Rules

### Plan First

Use a short implementation plan for:
- cross-service changes
- auth or role behavior changes
- schema or API contract changes
- calendar or progress behavior changes
- Docker or deployment changes

### Security First

Before finishing security-sensitive work, check:
- no hardcoded secrets
- user input validated at boundaries
- auth and role checks preserved
- no accidental exposure of internal-only endpoints
- error messages do not leak sensitive data

Never commit credentials, tokens, or private keys.

### Testing Mindset

Prefer a TDD-style approach for behavior changes:
1. identify expected behavior
2. add or update the narrowest useful test when practical
3. implement the smallest change that satisfies it
4. run relevant verification

We do not require synthetic test churn. If adding a test is disproportionate to the task, explain the gap clearly.

### Review Mindset

After writing code, re-check for:
- regressions in admin/member behavior
- backend/frontend contract drift
- type mismatches
- date validation issues
- Docker/runtime configuration impact

## Coding Guidance

- Prefer minimal, localized edits.
- Preserve existing naming unless it is actively harmful.
- Keep files focused; avoid opportunistic refactors.
- Add comments only when they clarify non-obvious logic.
- Be careful with encoding-sensitive files. If text is already garbled, avoid broad cleanup unless the task is specifically about encoding.
- Avoid mutating shared state carelessly; prefer explicit data transformations.

## Product-Critical Areas

Treat these as high-risk:
- progress calculation
- completion rules
- work log and timer aggregation
- role-based permissions
- project/subproject assignment
- calendar filtering and schedule visibility
- Docker networking and internal deployment behavior

For these areas, verify behavior, not just syntax.

## Verification Expectations

Run the smallest relevant verification set:

- Frontend UI/state changes: `npm run lint` in `frontend/`
- Backend API/auth/model changes: `pytest` in `backend/`
- Realtime changes: `pytest` in `realtime/`
- AI chatbot changes: `pytest` in `ai-chatbot/`
- Docker/config/deployment changes:
  - validate touched config files
  - rebuild relevant containers when possible

If a command cannot run because dependencies or infrastructure are missing, say exactly what was not verified.

## Docker And Deployment

- `docker-compose.yml` is the default full-stack source of truth.
- Prefer access through the intended reverse-proxy path rather than exposing internal services directly.
- When changing LAN/server access behavior, check CORS, proxy routing, and firewall assumptions together.

## Docs And Knowledge Capture

- Update docs when behavior, setup, or operator workflow changes.
- Reuse existing docs locations before creating new top-level files.
- Do not duplicate the same explanation in multiple places unless there is a clear operator need.

## Current Repo Notes

- Backend is the source of truth for enums, validation, and persistence rules.
- Frontend mirrors many backend types in `frontend/app/lib/api.ts`; keep them aligned.
- Realtime and AI chatbot should remain separate services.
- Keep Korean product terminology consistent with the existing UI and docs where possible.

## Good Outcomes

A task is in good shape when:
- the correct service owns the change
- the change is small and understandable
- backend and frontend contracts still match
- the relevant verification was run, or the gap was clearly stated
- the user can operate the feature or deployment path with less ambiguity than before
