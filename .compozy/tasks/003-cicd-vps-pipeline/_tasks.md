# CI/CD Pipeline + Branch & Commit Standards — Task List

## Tasks

| # | Title | Status | Complexity | Dependencies |
|---|-------|--------|------------|--------------|
| 01 | Commitlint setup — package.json, config, Lefthook hook | done | low | — |
| 02 | VPS deploy script — scripts/deploy.sh | done | low | — |
| 03 | CI quality gate workflow — .github/workflows/ci.yml | done | medium | task_01 |
| 04 | CD deploy pipeline — .github/workflows/cd.yml | done | medium | task_02, task_03 |
| 05 | Repository configuration — Secrets, Ruleset, GHCR visibility | pending | low | task_04 |
