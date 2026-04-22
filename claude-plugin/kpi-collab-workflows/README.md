# kpi-collab-workflows

This plugin packages reusable Claude Code workflows for the KPI project management and cowork tool.

## What It Includes

- `kpi-collab-workflows:project-change-review`
- `kpi-collab-workflows:release-readiness`

## Why A Plugin Exists Here

The standalone skills under `.claude/skills/` are the fastest path for this repository.
This plugin is the shareable version for teams that want the same workflows across multiple repositories or through a plugin marketplace.

## Local Testing

From the repository root:

```powershell
claude --plugin-dir ./claude-plugin/kpi-collab-workflows
```

Then run:

```text
/kpi-collab-workflows:project-change-review
/kpi-collab-workflows:release-readiness
```
