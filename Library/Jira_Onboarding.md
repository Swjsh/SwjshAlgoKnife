# Jira Onboarding Guide

**Created**: 2026-03-19
**Last Updated**: 2026-03-19
**Purpose**: Step-by-step guide to set up Jira for a new project using our framework

---

## Prerequisites

- Jira Cloud account (free tier works)
- Jira API token ([Generate here](https://id.atlassian.com/manage-profile/security/api-tokens))
- Python 3.x installed
- Access to your project's `scripts/` folder

---

## Quick Start (If Scripts Already Exist)

If you're setting up a second project and the scripts already exist:

```powershell
# 1. Generate keyfile (skip if ~/.swjsh/jira.key exists)
python scripts/jira_creds.py generate-key

# 2. Encrypt your Jira API token
python scripts/jira_creds.py encrypt

# 3. Create all projects
python scripts/jira_setup.py full-setup

# 4. Verify
python scripts/jira_setup.py status
```

---

## Full Setup (First Time)

### Step 1: Get Your Jira API Token

1. Go to: https://id.atlassian.com/manage-profile/security/api-tokens
2. Click "Create API token"
3. Name it something like "OpenClaw Automation"
4. Copy the token immediately (you won't see it again)

### Step 2: Create the Credential Manager Script

Create `scripts/jira_creds.py` with these capabilities:
- `generate-key` — Creates AES-256 keyfile at `~/.swjsh/jira.key`
- `encrypt` — Encrypts your API token to `~/.swjsh/jira.enc`
- `decrypt` — Tests decryption
- `show` — Outputs raw token (for piping to other scripts)

**Key files created:**
```
~/.swjsh/
├── jira.key          # AES-256 encryption key (BACK THIS UP)
├── jira.enc          # Encrypted API token
└── jira_config.json  # Email + base URL (not sensitive)
```

### Step 3: Encrypt Your Credentials

```powershell
# Generate the keyfile (one-time)
python scripts/jira_creds.py generate-key

# Encrypt your token (will prompt for token + email)
python scripts/jira_creds.py encrypt
```

**You'll be prompted for:**
- API Token (hidden input)
- Jira email (e.g., `jack.watergun@gmail.com`)

### Step 4: Create the Project Setup Script

Create `scripts/jira_setup.py` that:
- Reads encrypted credentials via `jira_creds.get_credentials()`
- Creates projects via Jira REST API
- Registers labels by creating/deleting temporary issues

### Step 5: Define Your Projects

Edit the `PROJECTS` dict in `jira_setup.py`:

```python
PROJECTS = {
    "KEY": {
        "name": "Project Name",
        "description": "What this project tracks",
        "labels": ["label1", "label2", "label3"]
    },
    # ... more projects
}
```

**Naming conventions:**
- Keys: 2-10 uppercase letters (e.g., `MGMT`, `LEARN`, `PULSE`)
- Labels: lowercase, hyphenated (e.g., `knowledge-share`, `tech-debt`)

### Step 6: Run the Setup

```powershell
# Test connection first
python scripts/jira_setup.py status

# Create everything
python scripts/jira_setup.py full-setup
```

---

## Project Structure We Use

| Project | Purpose | Example Labels |
|---------|---------|----------------|
| **MGMT** | Cross-project coordination | sync, review, decision, brainstorm |
| **LEARN** | Knowledge/patterns learned | lesson, pattern, insight, hypothesis |
| **GRADE** | Quality reviews | trade-review, audit, grade-a/b/c/d/f |
| **PULSE** | Health monitoring | incident, alert, health-check, outage |
| **INFRA** | Technical improvements | improvement, automation, tech-debt |
| **BACK** | Ideas backlog | idea, research, future, mvp |

---

## Jira Free Tier Limits

- **Users**: Up to 10
- **Projects**: Unlimited
- **Storage**: 2GB
- **Issue types**: Default only (Bug, Task, Story, Epic, Subtask)
- **Custom fields**: Limited
- **Automation**: 100 rules/month

**Workaround for custom issue types**: Use labels instead (free and unlimited)

---

## API Reference

**Base URL**: `https://{your-domain}.atlassian.net/rest/api/3`

**Authentication**: Basic Auth with `email:api_token` base64 encoded

**Useful endpoints:**
```
GET  /myself                    # Test connection
GET  /project                   # List all projects
POST /project                   # Create project
GET  /project/{key}             # Get project details
POST /issue                     # Create issue
DELETE /issue/{key}             # Delete issue
```

---

## Hurdles & Solutions

### Hurdle 1: "Project key already exists"
**Solution**: The script handles this gracefully — it skips existing projects.

### Hurdle 2: Labels don't appear in Jira UI
**Reason**: Jira Cloud creates labels lazily (only when first used).
**Solution**: We create temporary issues with each label, then delete them.

### Hurdle 3: API token not working
**Check**:
1. Token was copied correctly (no extra spaces)
2. Email matches your Atlassian account
3. Account has admin access to create projects

### Hurdle 4: "You do not have permission to create projects"
**Solution**:
1. Go to Jira Settings → System → Project roles
2. Ensure your account has "Administrators" role
3. Or ask your Jira admin to grant project creation permission

---

## Verification Checklist

After setup, verify:

- [ ] `python scripts/jira_creds.py status` shows all files exist
- [ ] `python scripts/jira_setup.py status` shows "Connected as: [your name]"
- [ ] All projects appear in Jira UI
- [ ] Labels appear when creating issues in each project

---

## Security Notes

1. **Never commit credentials** — `.swjsh/` is in your home directory, not the repo
2. **Back up the keyfile** — Without `~/.swjsh/jira.key`, encrypted tokens are useless
3. **Rotate tokens periodically** — Re-run `encrypt` with a new token
4. **Restrict API token scope** — Use project-specific tokens if possible

---

## Adding a New Project Later

```python
# Add to PROJECTS dict in jira_setup.py
"NEWKEY": {
    "name": "New Project Name",
    "description": "What it's for",
    "labels": ["label1", "label2"]
}
```

Then run:
```powershell
python scripts/jira_setup.py full-setup
```

Existing projects are skipped; only new ones are created.

---

## Related Documentation

- [n8n Setup Guide](./n8n_Setup.md) — How to configure n8n automation
- [Jira REST API Docs](https://developer.atlassian.com/cloud/jira/platform/rest/v3/intro/)
- [Atlassian API Tokens](https://id.atlassian.com/manage-profile/security/api-tokens)
