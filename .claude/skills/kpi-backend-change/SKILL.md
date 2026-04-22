---
description: Use when changing FastAPI backend endpoints, auth rules, schemas, models, or project workflow logic in this KPI collaboration repository.
---

# KPI Backend Change

Use this skill when the request primarily belongs to `backend/`.

## Goals

- Keep business logic in the backend as the source of truth.
- Minimize regressions in auth, roles, project workflow, and validation.
- Keep frontend contract compatibility in mind.

## Workflow

1. Read the affected backend router, schema, model, and any related tests before editing.
2. Identify whether the change also affects mirrored frontend types in `frontend/app/lib/api.ts` or UI forms.
3. Make the smallest backend change that correctly implements the requested behavior.
4. Update or add backend tests when behavior changes.
5. If response fields, enums, or status labels changed, update the corresponding frontend types or labels in the same task.
6. Run `pytest` in `backend/` when feasible.

## Pay Extra Attention To

- Role checks between admin and member users
- Date validation and completion rules
- Project type templates and status transitions
- Response shape compatibility with the frontend
- SQLAlchemy and Pydantic consistency

## Output Expectations

- Explain the root cause or design rationale briefly.
- List any mirrored frontend files that were updated because of contract changes.
- State exactly what was verified and what could not be verified.
