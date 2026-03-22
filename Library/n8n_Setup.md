# n8n Setup Guide

**Created**: 2026-03-19
**Last Updated**: 2026-03-19
**Purpose**: Step-by-step guide to set up, wipe, and configure n8n for automation projects

---

## Prerequisites

- Docker installed on your server
- Server with at least 1GB RAM (n8n uses ~200-400MB)
- Port 5678 available
- (Optional) Claude Code with n8n-mcp configured

---

## Quick Reference

| Task | Command |
|------|---------|
| Check n8n status | `docker ps \| grep n8n` |
| View logs | `docker logs n8n --tail 100` |
| Restart n8n | `docker restart n8n` |
| Stop n8n | `docker stop n8n` |
| Wipe workflows (keep creds) | Use n8n-mcp or API |
| Full nuclear wipe | `docker rm -f n8n && docker volume rm n8n_data` |

---

## Fresh Installation

### Step 1: SSH into Your Server

```bash
ssh root@<YOUR_SERVER_IP>
```

### Step 2: Create n8n Directory

```bash
mkdir -p /root/n8n && cd /root/n8n
```

### Step 3: Generate Secure Password

```bash
N8N_PASSWORD=$(openssl rand -base64 24)
echo "Save this password: $N8N_PASSWORD"
```

### Step 4: Run n8n Container

```bash
docker run -d \
  --name n8n \
  --restart always \
  -p 5678:5678 \
  -e N8N_BASIC_AUTH_ACTIVE=true \
  -e N8N_BASIC_AUTH_USER=admin \
  -e N8N_BASIC_AUTH_PASSWORD="$N8N_PASSWORD" \
  -e N8N_HOST=0.0.0.0 \
  -e GENERIC_TIMEZONE=America/New_York \
  -e N8N_SECURE_COOKIE=false \
  -v n8n_data:/home/node/.n8n \
  n8nio/n8n:latest
```

### Step 5: Verify Installation

```bash
# Check container is running
docker ps | grep n8n

# Check health endpoint
curl -s http://localhost:5678/healthz && echo " OK"

# View logs
docker logs n8n --tail 20
```

### Step 6: Access n8n UI

Open in browser: `http://<YOUR_SERVER_IP>:5678`

Login with:
- **Username**: admin
- **Password**: (the one you generated)

---

## Generate n8n API Key

Required for Claude Code integration and automation.

1. Login to n8n UI
2. Click your user icon (top right) → Settings
3. Go to **API** tab
4. Click **Create API Key**
5. Copy and save the key securely

---

## Configure Claude Code for n8n

Add to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "n8n-mcp": {
      "command": "npx",
      "args": ["n8n-mcp"],
      "env": {
        "N8N_API_URL": "http://<YOUR_SERVER_IP>:5678/api/v1",
        "N8N_API_KEY": "<YOUR_N8N_API_KEY>"
      }
    }
  }
}
```

Then restart Claude Code to load the MCP.

---

## Wiping n8n (Clean Slate)

### Option A: Delete Workflows Only (Keep Credentials)

Using Claude Code with n8n-mcp:
```
# Claude will use mcp__n8n__n8n_list_workflows and mcp__n8n__n8n_delete_workflow
```

Or via API:
```bash
# List all workflows
curl -X GET "http://localhost:5678/api/v1/workflows" \
  -H "X-N8N-API-KEY: <YOUR_API_KEY>"

# Delete specific workflow
curl -X DELETE "http://localhost:5678/api/v1/workflows/<WORKFLOW_ID>" \
  -H "X-N8N-API-KEY: <YOUR_API_KEY>"
```

### Option B: Full Nuclear Wipe (Everything Gone)

```bash
# Stop and remove container
docker stop n8n
docker rm n8n

# Delete all data
docker volume rm n8n_data

# Reinstall fresh (see installation steps above)
```

**Warning**: This deletes ALL workflows, credentials, and execution history.

---

## Environment Variables Reference

| Variable | Purpose | Example |
|----------|---------|---------|
| `N8N_BASIC_AUTH_ACTIVE` | Enable login | `true` |
| `N8N_BASIC_AUTH_USER` | Login username | `admin` |
| `N8N_BASIC_AUTH_PASSWORD` | Login password | `<secure-password>` |
| `N8N_HOST` | Listen address | `0.0.0.0` |
| `N8N_PORT` | Listen port | `5678` |
| `GENERIC_TIMEZONE` | Timezone for schedules | `America/New_York` |
| `N8N_SECURE_COOKIE` | HTTPS-only cookies | `false` (for HTTP) |
| `WEBHOOK_URL` | External webhook URL | `http://your-domain:5678/` |
| `N8N_ENCRYPTION_KEY` | Encrypt credentials at rest | `<32-byte-hex>` |

---

## Firewall Configuration

### UFW (Ubuntu)
```bash
ufw allow 5678/tcp
ufw reload
```

### iptables
```bash
iptables -A INPUT -p tcp --dport 5678 -j ACCEPT
```

---

## n8n-mcp Commands (Claude Code)

Once configured, Claude Code can use these tools:

| Tool | Purpose |
|------|---------|
| `mcp__n8n__n8n_list_workflows` | List all workflows |
| `mcp__n8n__n8n_get_workflow` | Get workflow details |
| `mcp__n8n__n8n_create_workflow` | Create new workflow |
| `mcp__n8n__n8n_update_full_workflow` | Update entire workflow |
| `mcp__n8n__n8n_delete_workflow` | Delete a workflow |
| `mcp__n8n__n8n_health_check` | Check n8n status |
| `mcp__n8n__search_nodes` | Search available nodes |
| `mcp__n8n__get_node` | Get node documentation |
| `mcp__n8n__validate_workflow` | Validate workflow JSON |

---

## Hurdles & Solutions

### Hurdle 1: "Cannot connect to n8n"
**Check**:
1. Container is running: `docker ps | grep n8n`
2. Port is exposed: `netstat -tlnp | grep 5678`
3. Firewall allows port 5678
4. Using correct IP (not localhost from external)

### Hurdle 2: "Secure cookie" blocking login over HTTP
**Solution**: Set `N8N_SECURE_COOKIE=false` in environment

### Hurdle 3: Workflows not persisting after restart
**Solution**: Ensure volume is mounted: `-v n8n_data:/home/node/.n8n`

### Hurdle 4: Timezone issues with scheduled workflows
**Solution**: Set both `GENERIC_TIMEZONE` and `TZ` to your timezone

### Hurdle 5: n8n-mcp not connecting
**Check**:
1. API key is correct
2. URL includes `/api/v1` suffix
3. Claude Code was restarted after config change
4. n8n is accessible from your local machine

---

## Backup & Restore

### Backup Workflows
```bash
# Export all workflows via API
curl -X GET "http://localhost:5678/api/v1/workflows" \
  -H "X-N8N-API-KEY: <KEY>" \
  -o workflows_backup_$(date +%Y%m%d).json
```

### Backup Entire n8n Data
```bash
# Stop n8n first
docker stop n8n

# Backup volume
docker run --rm -v n8n_data:/data -v $(pwd):/backup \
  alpine tar czf /backup/n8n_backup_$(date +%Y%m%d).tar.gz /data

# Restart n8n
docker start n8n
```

### Restore from Backup
```bash
# Stop n8n
docker stop n8n

# Restore volume
docker run --rm -v n8n_data:/data -v $(pwd):/backup \
  alpine tar xzf /backup/n8n_backup_YYYYMMDD.tar.gz -C /

# Start n8n
docker start n8n
```

---

## Resource Usage

| Metric | Typical Value |
|--------|---------------|
| Memory (idle) | 200-300 MB |
| Memory (active) | 300-500 MB |
| CPU (idle) | < 1% |
| CPU (executing) | 5-20% |
| Disk (base) | ~500 MB |
| Disk (with data) | 1-5 GB |

---

## Monitoring n8n Health

### Basic Health Check
```bash
curl -s http://localhost:5678/healthz
# Returns: {"status":"ok"}
```

### Check Execution Queue
```bash
curl -X GET "http://localhost:5678/api/v1/executions" \
  -H "X-N8N-API-KEY: <KEY>" | jq '.data | length'
```

### Monitor Logs
```bash
# Follow logs in real-time
docker logs -f n8n

# Last 100 lines
docker logs n8n --tail 100
```

---

## Security Best Practices

1. **Use strong password** — Generate with `openssl rand -base64 24`
2. **Enable HTTPS** — Use reverse proxy (nginx/caddy) with SSL
3. **Restrict network access** — Firewall rules for trusted IPs only
4. **Use encryption key** — Set `N8N_ENCRYPTION_KEY` for credential encryption
5. **Regular backups** — Automate daily workflow backups
6. **Audit webhooks** — Review exposed webhook URLs periodically

---

## Related Documentation

- [Jira Onboarding Guide](./Jira_Onboarding.md) — Set up Jira integration
- [n8n Official Docs](https://docs.n8n.io/)
- [n8n Docker Setup](https://docs.n8n.io/hosting/installation/docker/)
- [n8n API Reference](https://docs.n8n.io/api/)
