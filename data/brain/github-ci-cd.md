# GitHub & CI/CD

> Central reference for all GitHub workflows, branch protection, and deployment automation.

---

## Branch Protection (ENFORCED)

**Main branch is protected. No one can push directly to `main`.**

All changes must go through Pull Requests with:
- ✅ CI passing (`build` status check)
- ✅ 1 approval (Jack)
- ✅ No bypassing (even admins)

**Full setup guide**: `docs/BRANCH_PROTECTION.md` in repo

---

## Required Workflow for All Agents

```bash
# 1. Create feature branch
git checkout -b scrum/SCRUM-42-feature-name

# 2. Commit changes
git commit -m "feat(SCRUM-42): Description"

# 3. Push branch (NOT main!)
git push -u origin scrum/SCRUM-42-feature-name

# 4. Create PR
gh pr create --title "feat(SCRUM-42): ..." --body "..."

# 5. Wait for approval + merge
```

---

## Branch Naming

| Prefix | Project | Example |
|--------|---------|---------|
| `scrum/` | SCRUM | `scrum/SCRUM-42-position-sync` |
| `infra/` | INFRA | `infra/INFRA-15-ci-pipeline` |
| `pulse/` | PULSE | `pulse/PULSE-10-health` |
| `back/` | BACK | `back/BACK-12-research` |
| `learn/` | LEARN | `learn/LEARN-8-patterns` |
| `mgmt/` | MGMT | `mgmt/MGMT-5-coord` |

---

## GitHub Actions Workflows

| File | Trigger | Purpose |
|------|---------|---------|
| `ci.yml` | PR + feature push | Lint, test, build |
| `deploy.yml` | PR merged to main | Deploy to Contabo |
| `pr-review.yml` | PR opened | AI review, Jira link |
| `change-notification.yml` | Big change PR | Notifications |

---

## Big Change Detection

PRs flagged when:
- 10+ files changed
- 500+ lines added
- `src/lib/db.ts` modified (database)
- `*_engine.py` modified (trading bots)
- Auth/security changes
- `.github/` or Docker changes

**Notifications sent to:**
1. Activity Log API: `POST /api/activity-log` with `requires_verification: true`
2. Discord webhook
3. GitHub labels: `requires-verification`, `big-change`
4. Auto-request review from repo owner

---

## Activity Log API

Agent coordination is now database-backed:

### Log Work
```bash
POST /api/activity-log
{
  "agent": "Ops",
  "project": "SCRUM",
  "issue": "SCRUM-42",
  "status": "in_progress",
  "notes": "Working on position sync"
}
```

### Report Blocker
```bash
POST /api/activity-log/blockers
{
  "agent": "Ops",
  "issue": "SCRUM-42",
  "blocker": "gh CLI not installed"
}
```

### Record Pattern
```bash
POST /api/activity-log/patterns
{
  "id": "P052",
  "agent": "Cortana",
  "confidence": 0.85,
  "description": "Pattern description",
  "category": "trading"
}
```

---

## GitHub Secrets Required

Configure in: **Settings → Secrets → Actions**

| Secret | Purpose |
|--------|---------|
| `VPS_HOST` | Contabo IP |
| `VPS_USERNAME` | SSH user |
| `VPS_SSH_KEY` | Full private key |
| `DISCORD_WEBHOOK_URL` | Deploy notifications |
| `N8N_WEBHOOK_URL` | Code review webhook |
| `SWJSHAK_API_URL` | Activity log API |

---

## Quick Links

- [[Agent System]] - How agents work
- [[Jira Agent System]] - Jira integration
- [[Deployment]] - VPS deployment details
- [[n8n Automation]] - Workflow automation

---

## Docs in Repo

- `docs/CI_CD_SETUP.md` - Full CI/CD documentation
- `docs/BRANCH_PROTECTION.md` - GitHub settings guide
- `.github/workflows/` - All workflow files
- `.github/labeler.yml` - Auto-labeling rules
- `.github/PULL_REQUEST_TEMPLATE.md` - PR template
