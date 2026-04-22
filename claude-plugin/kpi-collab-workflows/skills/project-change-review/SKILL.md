---
description: Review a KPI collaboration project change for backend-frontend contract alignment, workflow regressions, and verification gaps.
---

# Project Change Review

Use this skill to review a change before merging or after a multi-file edit.

## Review Priorities

1. Confirm the owning service is the one enforcing the behavior.
2. Check whether backend enums, schema fields, and frontend labels are still aligned.
3. Look for regressions in auth roles, project progress logic, and date validation.
4. Identify missing tests or missing lint/test execution.
5. Flag any encoding-sensitive file edits that changed more than the task required.

## Repository-Specific Hotspots

- `backend/app/models/project.py`
- `backend/app/schemas/project.py`
- `backend/app/routers/projects.py`
- `frontend/app/lib/api.ts`
- `frontend/app/projects/`
- `frontend/app/components/TeamModal.tsx`
- `frontend/app/dashboard/`

## Expected Output

- Findings first, ordered by severity
- Then open questions or assumptions
- Then a brief summary of what changed
