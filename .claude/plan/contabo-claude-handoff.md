# SwjshAlgoKnife Project Handoff — Contabo Server Claude

Copy this entire prompt into the fresh Claude instance on the Contabo VPS.

---

## You Are The Remote Infrastructure Agent

You are Claude Code running on a Contabo VPS (IP: 209.145.55.101). Your mission is to establish secure connectivity between this server and the Windows workstation where the main SwjshAlgoKnife project runs.

**IMPORTANT**: You have limited context. This handoff provides everything you need to know.

---

## Project Overview

**SwjshAlgoKnife** is an algorithmic trading platform with:
- **Frontend**: Next.js 15 dashboard (runs on Windows at localhost:3000)
- **Agents**: 6 autonomous Claude-powered trading agents ("HALO" system)
- **Automation**: n8n workflow server (runs on THIS Contabo server at port 5678)
- **Database**: SQLite for trades and signals
- **Brain**: Obsidian vault for knowledge management

### Current Problem

The n8n server (on THIS machine) cannot reach the Next.js API (on Windows) because:
- n8n is at 209.145.55.101:5678
- Next.js is at Jack's Windows PC at localhost:3000
- These are different machines with no direct connectivity

### Solution: Tailscale

Tailscale creates a private mesh VPN where both machines get stable IPs in the 100.x.x.x range. After setup:
- This server gets a Tailscale IP (e.g., 100.64.0.2)
- Jack's Windows gets a Tailscale IP (e.g., 100.64.0.1)
- n8n can reach the Next.js API at http://100.64.0.1:3000

---

## Your Tasks

### Task 1: Install and Configure Tailscale

```bash
# Install Tailscale
curl -fsSL https://tailscale.com/install.sh | sh

# Start Tailscale and authenticate
sudo tailscale up

# This will print a URL - Jack needs to approve the device in Tailscale admin
# Or use an auth key: sudo tailscale up --authkey=tskey-xxxxx
```

After authentication:
```bash
# Check your Tailscale IP
tailscale ip -4

# Check network status
tailscale status
```

**Report back**: Your Tailscale IP address (starts with 100.)

---

### Task 2: Wait for Jack's Windows to Join Tailscale

Jack will:
1. Install Tailscale on his Windows workstation
2. Authenticate with the same Tailscale account
3. Report his Tailscale IP

Once both machines are on Tailscale:
```bash
# Test connectivity to Jack's Windows
ping <jack-tailscale-ip>

# Test HTTP connectivity to the Next.js API
curl http://<jack-tailscale-ip>:3000/api/health
```

---

### Task 3: Update n8n Workflows

Once connectivity is confirmed, update the n8n workflows that reference localhost:3000.

**n8n Access**:
- Web UI: http://209.145.55.101:5678 (or http://localhost:5678 from this server)
- API: http://localhost:5678/api/v1
- API Key: Check environment variable N8N_API_KEY

**Workflows to Update** (replace `localhost:3000` with Jack's Tailscale IP):

1. **WF-S02: Self-Healing Incident Response** (ID: lufP4pVA7blAeDCa)
   - Currently DEACTIVATED (was failing every 2 minutes)
   - Update all webhook URLs from `localhost:3000` to `<jack-tailscale-ip>:3000`
   - After update, reactivate the workflow

2. **Any other workflows** with localhost:3000 references
   - Search all workflows for "localhost" or "127.0.0.1"
   - Update to use Jack's Tailscale IP

**Using n8n API to list workflows**:
```bash
curl -H "X-N8N-API-KEY: $N8N_API_KEY" http://localhost:5678/api/v1/workflows
```

**Using n8n API to get workflow details**:
```bash
curl -H "X-N8N-API-KEY: $N8N_API_KEY" http://localhost:5678/api/v1/workflows/lufP4pVA7blAeDCa
```

---

### Task 4: Reactivate WF-S02

After updating the URLs:
```bash
# Activate the workflow via API
curl -X PATCH \
  -H "X-N8N-API-KEY: $N8N_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"active": true}' \
  http://localhost:5678/api/v1/workflows/lufP4pVA7blAeDCa
```

---

### Task 5: Verify Everything Works

1. **Check n8n health endpoint from Windows**:
   ```
   curl http://<contabo-tailscale-ip>:5678/api/v1/workflows
   ```

2. **Check SwjshAlgoKnife API from this server**:
   ```bash
   curl http://<jack-tailscale-ip>:3000/api/health
   curl http://<jack-tailscale-ip>:3000/api/n8n/health
   ```

3. **Monitor WF-S02 executions**:
   - Check n8n UI for recent executions
   - No more failures should appear

---

## Important Files on This Server

- **n8n data**: Usually in ~/.n8n/ or /home/<user>/.n8n/
- **n8n config**: Check for .env or environment variables
- **systemd service**: If n8n runs as a service, check `/etc/systemd/system/n8n.service`

---

## Security Notes

1. **Tailscale is private** - Only devices authenticated with the same Tailscale account can communicate
2. **No ports exposed to public internet** - The 100.x.x.x IPs are only visible within the Tailscale mesh
3. **This is the recommended approach** for connecting services across machines securely

---

## Communication Protocol

After completing each task, report back with:
1. Your Tailscale IP
2. Confirmation of connectivity test results
3. List of workflows updated
4. Any errors encountered

Jack will coordinate from his Windows machine and provide his Tailscale IP when ready.

---

## Quick Reference

| Item | Value |
|------|-------|
| This server's public IP | 209.145.55.101 |
| n8n port | 5678 |
| n8n API base | http://localhost:5678/api/v1 |
| API key env var | N8N_API_KEY |
| Target workflow ID | lufP4pVA7blAeDCa |
| Next.js port (Jack's PC) | 3000 |
| Tailscale admin | https://login.tailscale.com/admin |

---

Start with Task 1: Install Tailscale.
