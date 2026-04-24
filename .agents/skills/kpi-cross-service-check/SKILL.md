---
description: Use when a request spans backend, frontend, realtime, or ai-chatbot and needs an end-to-end impact check in this KPI collaboration repository.
---

# KPI Cross-Service Check

Use this skill when a task crosses service boundaries or when the safest path is to inspect impact before coding.

## Goals

- Prevent one-service fixes from breaking another service.
- Make interface changes explicit.
- Verify the smallest cross-service surface that proves the change.

## Workflow

1. Identify the owning service and every dependent service.
2. Read the source-of-truth implementation first:
   - backend for business rules and API shapes
   - realtime for live event behavior
   - ai-chatbot for assistant-specific API behavior
   - frontend for labels, rendering, and user flows
3. Write down the contract points that might change:
   - endpoint paths
   - request/response fields
   - enum values
   - status labels
   - auth expectations
4. Implement changes service by service, keeping the contract aligned.
5. Run the relevant checks in each touched service when feasible.

## Verification Matrix

- Backend + frontend: `pytest` in `backend/`, `npm run lint` in `frontend/`
- Realtime changes: `pytest` in `realtime/`
- AI chatbot changes: `pytest` in `ai-chatbot/`
- Docker or environment changes: verify compose files and explain any runtime checks not performed

## Output Expectations

- Summarize the contract change plainly.
- List each touched service.
- Be explicit about what was and was not verified.
