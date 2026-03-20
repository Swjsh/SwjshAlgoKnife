# SwjshAK Library

**Purpose**: Reusable setup guides and documentation for spinning up new projects with this framework.

---

## Guides

| Document | Purpose |
|----------|---------|
| **[Autonomous Business Plan](./AUTONOMOUS_BUSINESS_PLAN.md)** | **THE VISION** — AI agents run the business, Jack is CEO |
| **[Automation Hunterure](./AUTOMATION_ARCHITECTURE.md)** | How n8n, OpenClaw, Discord, Jira, and SwjshAK connect |
| [Jira Onboarding](./Jira_Onboarding.md) | Set up Jira projects with encrypted credentials, labels, and project structure |
| [n8n Setup](./n8n_Setup.md) | Install, configure, wipe, and manage n8n automation |
| [n8n Advanced Workflows](./n8n_Advanced_Workflow_Ideas.md) | Complex multi-step workflows with Claude AI, Jira triage, autonomous agents |

---

## Quick Spinup Checklist

When starting a new project with this framework:

### 1. Infrastructure
- [ ] Server provisioned (Contabo VPS or similar)
- [ ] Docker installed
- [ ] n8n running ([guide](./n8n_Setup.md))

### 2. Project Management
- [ ] Jira account created
- [ ] API token generated
- [ ] Credentials encrypted ([guide](./Jira_Onboarding.md))
- [ ] Projects created (MGMT, LEARN, GRADE, PULSE, INFRA, BACK)

### 3. Integration
- [ ] n8n API key generated
- [ ] Claude Code configured with n8n-mcp
- [ ] Jira credentials available to scripts

### 4. Automation (Phase 2)
- [ ] n8n workflows built
- [ ] OpenClaw connected
- [ ] Jira ticket automation running

---

## Project Structure

```
SwjshAlgoKnife/
├── Library/                    # You are here
│   ├── README.md              # This file
│   ├── Jira_Onboarding.md     # Jira setup guide
│   └── n8n_Setup.md           # n8n setup guide
│
├── scripts/
│   ├── jira_creds.py          # Jira credential encryption
│   └── jira_setup.py          # Jira project creation
│
└── ~/.swjsh/                   # Credentials (in home directory)
    ├── jira.key               # Encryption key
    ├── jira.enc               # Encrypted API token
    └── jira_config.json       # Email + base URL
```

---

## Adding New Guides

When you solve a new setup challenge, add a guide here:

1. Create `Library/<Topic>_Guide.md`
2. Include: Prerequisites, Steps, Hurdles, Verification
3. Update this README with link

---

## Framework Philosophy

1. **Encrypted credentials** — Never commit secrets
2. **Idempotent scripts** — Re-running is safe
3. **Document hurdles** — Future you will thank present you
4. **Verify after setup** — Always include verification steps
