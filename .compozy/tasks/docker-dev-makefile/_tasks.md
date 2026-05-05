# Docker Dev Makefile — Task List

## Tasks

| # | Title | Status | Complexity | Dependencies |
|---|-------|--------|------------|--------------|
| 01 | Create `.dockerignore` | done | low | — |
| 02 | Create multi-stage `Dockerfile` | completed | medium | task_01 |
| 03 | Extend `docker-compose.yml` with `app` service and watch blocks | completed | medium | task_02 |
| 04 | Makefile: core targets (`help`, `setup`, `dev`, `dev-docker`) | completed | medium | task_02, task_03 |
| 05 | Makefile: ops targets (quality gates, build, preview, db-*, lifecycle, deploy) | completed | medium | task_04 |
| 06 | Create `CONTRIBUTING.md` | pending | low | task_05 |
