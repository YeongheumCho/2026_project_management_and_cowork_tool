---
description: Use when changing Next.js pages, forms, dashboards, calendars, or API-driven UI flows in this KPI collaboration repository.
---

# KPI Frontend Flow

Use this skill when the request primarily belongs to `frontend/`.

## Goals

- Preserve the current App Router structure.
- Keep API usage aligned with backend contracts.
- Avoid cosmetic rewrites when the task is about behavior.

## Workflow

1. Read the target page/component and the relevant helpers in `frontend/app/lib/`.
2. Trace the API fields back to `frontend/app/lib/api.ts`.
3. If the request depends on backend enums, labels, or status values, verify the backend source before editing.
4. Implement the smallest cohesive UI change.
5. Keep form labels, validation messaging, and Korean product terminology consistent with the current UI.
6. Run `npm run lint` in `frontend/` when feasible.

## Pay Extra Attention To

- Pages under `dashboard/`, `projects/`, `team-calendar/`, and `personal-calendar/`
- Role-based rendering and assignment flows
- Local storage auth token usage
- API error handling and label mappings
- Shared components in `frontend/app/components/`

## Output Expectations

- Mention the user-visible change in one or two sentences.
- Call out any backend dependency or contract assumption.
- State whether `npm run lint` ran successfully.
