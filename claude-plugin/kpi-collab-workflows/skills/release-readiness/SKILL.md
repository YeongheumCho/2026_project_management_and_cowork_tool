---
description: Check whether a KPI collaboration change is ready for handoff by verifying touched services, commands, and obvious deployment risks.
---

# Release Readiness

Use this skill before handoff, demo, or merge.

## Checklist

1. List the touched services: backend, frontend, realtime, ai-chatbot, database, docs, or compose files.
2. For each touched service, identify the minimum command that should have been run.
3. Confirm whether any environment variable or compose change requires operator attention.
4. Note whether the change affects:
   - auth
   - project type templates
   - verification workflow
   - dashboard numbers
   - calendar rendering
   - chatbot integrations
5. Report any gaps between claimed verification and actual verification.

## Expected Output

- Ready or not-ready conclusion
- Concrete blockers first
- Short handoff notes for the next engineer or reviewer
