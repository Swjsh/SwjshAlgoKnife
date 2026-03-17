# SwjshAK — Oracle Cloud Deployment (Free Forever)

Oracle Cloud's **Always Free Tier** gives you a genuine Ubuntu server at $0/month, permanently.
No credit card charge, no time limit, no spin-down.

**What you get:**
- 1 AMD VM (1 OCPU, 1 GB RAM)
- 50 GB storage
- 10 TB outbound bandwidth/month

---

## Part 1 — Create your Oracle Cloud account & VM (15 min, one-time)

### 1.1 Create the account

1. Go to **https://cloud.oracle.com** and click **Start for free**
2. Fill in your details. You'll need a credit card for identity verification — **you will not be charged** on the Always Free tier.
3. Choose your **Home Region** — pick the one closest to you (US East: Ashburn, or EU: Frankfurt). **You cannot change this later.**
4. Complete email verification and log in.

---

### 1.2 Create the Ubuntu VM

1. In the Oracle Cloud Console, click the **hamburger menu (☰)** → **Compute** → **Instances**
2. Click **Create Instance**
3. Configure it:

   | Setting | Value |
   |---------|-------|
   | **Name** | `swjsh-server` (or anything) |
   | **Image** | Canonical Ubuntu 22.04 |
   | **Shape** | VM.Standard.E2.1.Micro ← **this is the Always Free shape** |
   | **SSH Keys** | Generate a key pair OR paste your existing public key |

4. If you generate keys: **download the private key immediately** — Oracle won't show it again. Save it as `oracle_key.key` on your Windows machine (e.g. `C:\Users\jackw\oracle_key.key`).

5. Click **Create** — the VM will be running in ~2 minutes.

6. Note your VM's **Public IP address** from the Instance Details page.

---

### 1.3 Open port 3000 in Oracle's Cloud Firewall

Oracle has TWO firewall layers. You need to open both.

**Layer 1 — OS firewall** (the setup script handles this automatically)

**Layer 2 — Oracle Cloud Security List** (do this manually in the console):

1. In Oracle Console: **Networking** → **Virtual Cloud Networks**
2. Click your VCN (there's usually one default one)
3. Click **Security Lists** in the left sidebar
4. Click **Default Security List**
5. Click **Add Ingress Rules**
6. Fill in:
   - **Source CIDR:** `0.0.0.0/0`
   - **IP Protocol:** TCP
   - **Destination Port Range:** `3000`
7. Click **Add Ingress Rules**

---

## Part 2 — Bootstrap the server (5 min, one-time)

### 2.1 SSH into your VM

Open **PowerShell** on your Windows machine:

```powershell
ssh -i "C:\Users\jackw\oracle_key.key" ubuntu@YOUR_SERVER_IP
```

If it says "WARNING: UNPROTECTED PRIVATE KEY FILE", run this first:
```powershell
icacls "C:\Users\jackw\oracle_key.key" /inheritance:r /grant:r "jackw:(R)"
```

---

### 2.2 Run the bootstrap script

Once you're SSH'd in, run:

```bash
# Download and run the setup script
curl -fsSL https://raw.githubusercontent.com/YOUR_GITHUB_USERNAME/SwjshAlgoKnife/main/setup_oracle.sh -o setup_oracle.sh
chmod +x setup_oracle.sh
./setup_oracle.sh
```

**OR** if you haven't pushed to GitHub yet, you can upload and run it directly. From PowerShell on Windows:
```powershell
scp -i "C:\Users\jackw\oracle_key.key" setup_oracle.sh ubuntu@YOUR_SERVER_IP:~/
ssh -i "C:\Users\jackw\oracle_key.key" ubuntu@YOUR_SERVER_IP "chmod +x setup_oracle.sh && ./setup_oracle.sh"
```

The script takes ~3 minutes and installs everything: Node.js 20, Python 3, PM2, Python bot dependencies, and configures the firewall.

---

## Part 3 — Deploy the app (3 min, initial + any future updates)

### 3.1 Configure PUSH_TO_SERVER.ps1

Open `PUSH_TO_SERVER.ps1` in your project folder and fill in the two lines at the top:

```powershell
$SERVER_IP   = "YOUR_ORACLE_VM_IP"
$SSH_KEY     = "C:\Users\jackw\oracle_key.key"
```

---

### 3.2 Deploy

In PowerShell from your project folder:

```powershell
.\PUSH_TO_SERVER.ps1
```

This will:
1. Zip your project (excluding `node_modules`, `.next`, `data/`)
2. Upload it to the server
3. Upload your `.env.local` (API keys)
4. Run `npm install` + `npm run build` on the server
5. Start everything via PM2 (`AK-Dashboard`, `AK-BitcoinBob`, `AK-Sterling`)

First run takes ~5 minutes (building native modules + Next.js bundle). Future deploys take ~2 minutes.

---

### 3.3 Verify it's running

From your browser: **http://YOUR_SERVER_IP:3000**

From PowerShell (watch live logs):
```powershell
ssh -i "C:\Users\jackw\oracle_key.key" ubuntu@YOUR_SERVER_IP "pm2 list"
```

You should see something like:
```
┌─────┬──────────────────┬─────────┬──────────┬────────┐
│ id  │ name             │ status  │ cpu      │ mem    │
├─────┼──────────────────┼─────────┼──────────┼────────┤
│ 0   │ AK-Dashboard     │ online  │ 0%       │ 180mb  │
│ 1   │ AK-BitcoinBob    │ online  │ 0%       │ 95mb   │
│ 2   │ AK-Sterling      │ online  │ 0%       │ 90mb   │
└─────┴──────────────────┴─────────┴──────────┴────────┘
```

---

## Daily usage (from your laptop)

You never need to touch PowerShell again unless you're deploying an update.

### Watch your bots in real time
```powershell
# All logs
ssh -i "C:\Users\jackw\oracle_key.key" ubuntu@YOUR_SERVER_IP "pm2 logs"

# Just Bitcoin Bob
ssh -i "C:\Users\jackw\oracle_key.key" ubuntu@YOUR_SERVER_IP "pm2 logs AK-BitcoinBob"

# Just Sterling
ssh -i "C:\Users\jackw\oracle_key.key" ubuntu@YOUR_SERVER_IP "pm2 logs AK-Sterling"
```

### Restart a bot
```powershell
ssh -i "C:\Users\jackw\oracle_key.key" ubuntu@YOUR_SERVER_IP "pm2 restart AK-BitcoinBob"
```

### Check if bots are alive
```powershell
ssh -i "C:\Users\jackw\oracle_key.key" ubuntu@YOUR_SERVER_IP "pm2 list"
```

### Deploy code updates
```powershell
# Just run this from your project folder — does everything automatically
.\PUSH_TO_SERVER.ps1
```

---

## Troubleshooting

**Dashboard loads but shows no data**
- Check that `data/journal.db` exists on the server: `ssh ... "ls ~/SwjshAlgoKnife/data/"`
- Verify `.env.local` was uploaded: `ssh ... "head -3 ~/SwjshAlgoKnife/.env.local"`

**Bots keep restarting (PM2 shows error status)**
- Check error logs: `ssh ... "pm2 logs AK-BitcoinBob --err --lines 30"`
- Common cause: missing Python package → `ssh ... "pip3 install yfinance pandas numpy requests"`

**Can't access http://YOUR_IP:3000**
- Double-check the Oracle Cloud Security List has port 3000 open (Part 1.3 above)
- Verify the OS firewall: `ssh ... "sudo iptables -L INPUT -n | grep 3000"`
- Confirm Next.js is running: `ssh ... "pm2 list"`

**SSH key permission error on Windows**
```powershell
icacls "C:\Users\jackw\oracle_key.key" /inheritance:r /grant:r "$env:USERNAME:(R)"
```

**"python: command not found" in PM2 logs**
```bash
# SSH in and run:
sudo ln -sf /usr/bin/python3 /usr/bin/python
pm2 restart all
```

---

## Adding a custom domain + HTTPS (optional, free)

If you want `https://yourdomain.com` instead of `http://ip:3000`:

1. Point your domain's A record to your Oracle VM IP
2. SSH in and run:
   ```bash
   sudo apt install -y nginx certbot python3-certbot-nginx
   sudo nano /etc/nginx/sites-available/swjsh
   ```
   Paste:
   ```nginx
   server {
       server_name yourdomain.com;
       location / {
           proxy_pass http://localhost:3000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
   }
   ```
   ```bash
   sudo ln -s /etc/nginx/sites-available/swjsh /etc/nginx/sites-enabled/
   sudo nginx -t && sudo systemctl reload nginx
   sudo certbot --nginx -d yourdomain.com
   ```
3. Also open port 80 and 443 in Oracle Security Lists (same steps as port 3000)

---

## Summary

| What | How |
|------|-----|
| Initial setup | Run `setup_oracle.sh` on the VM once |
| First deploy + future deploys | `.\PUSH_TO_SERVER.ps1` from Windows |
| Watch logs | `ssh ... "pm2 logs"` |
| Restart bots | `ssh ... "pm2 restart AK-BitcoinBob"` |
| Dashboard | `http://YOUR_VM_IP:3000` |
| Trades page | `http://YOUR_VM_IP:3000/trades` |
| Cost | **$0/month, forever** |
