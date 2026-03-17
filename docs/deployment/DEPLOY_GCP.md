# SwjshAK — Google Cloud Deployment (Free Forever)

**Always Free tier:** 1 `e2-micro` VM in `us-central1`, `us-east1`, or `us-west1`.
1 shared vCPU, 1 GB RAM, 30 GB disk, 1 TB outbound/month. No expiration.

> **Learning note:** This guide teaches GCP concepts as you go.
> Everything in `> boxes` is a GCP concept worth knowing for work.

---

## Part 1 — GCP account + project setup (10 min)

> **Project** — Every resource in GCP lives inside a Project. Think of it as a
> folder that groups your VMs, storage, networking, and billing together.
> Most companies have one Project per product or environment (dev/staging/prod).

### 1.1 Create your account

1. Go to **https://console.cloud.google.com**
2. Sign in with your Google account
3. Click **Try for free** — you get a $300 credit for 90 days PLUS the Always Free tier that never expires
4. Billing must be enabled (required to unlock free tier — you won't be charged)

### 1.2 Create a project

1. Top of the console → click the project dropdown → **New Project**
2. Name it `swjsh-algo-knife` (or anything — this is just a label)
3. Click **Create**
4. Make sure it's selected in the dropdown at the top

---

## Part 2 — Install gcloud CLI on your Windows machine (5 min)

> **gcloud CLI** — The command-line tool for GCP. Everything in the Google
> Cloud Console UI can also be done via `gcloud` commands. At work you'll
> use this constantly — it's faster than clicking through the UI and lets
> you script deployments.

### 2.1 Install

Download and run the installer:
**https://cloud.google.com/sdk/docs/install-sdk#windows**

(It's a standard `.exe` installer — just click through it.)

### 2.2 Initialize (links the CLI to your account)

Open a **new** PowerShell window after installing and run:

```powershell
gcloud init
```

It will:
1. Open a browser tab — log in with your Google account
2. Ask which project to use — pick `swjsh-algo-knife`
3. Ask which region — pick `us-central1` (Iowa) for best free-tier availability

Verify it worked:
```powershell
gcloud auth list        # should show your Google account as ACTIVE
gcloud config list      # shows your project and region settings
```

---

## Part 3 — Create the VM (5 min)

> **Compute Engine** — GCP's virtual machine service (equivalent to AWS EC2).
> `e2-micro` is the Always Free shape. The "e2" family is cost-optimized shared
> CPU. For production workloads at work you'd use `n2`, `c2`, or `c3` families.

> **Zone** — A zone is a specific datacenter within a region.
> `us-central1-a` means region `us-central1`, zone `a`.
> Always Free VMs must be in `us-central1`, `us-east1`, or `us-west1`.

### 3.1 Create the VM with one command

Paste this as a **single line** in PowerShell (backtick line-continuation breaks if there's a trailing space):

```powershell
gcloud compute instances create swjsh-server --project=swjsh-algo-knife --zone=us-central1-a --machine-type=e2-micro --image-family=ubuntu-2204-lts --image-project=ubuntu-os-cloud --boot-disk-size=30GB --boot-disk-type=pd-standard --tags=swjsh-server --metadata=serial-port-enable=TRUE
```

This creates:
- Ubuntu 22.04 VM
- `e2-micro` (Always Free)
- 30GB disk (Always Free)
- Network tag `swjsh-server` (we'll use this for the firewall rule)

### 3.2 Get your VM's external IP

```powershell
gcloud compute instances list
```

Note the `EXTERNAL_IP` — you'll need it later.

---

## Part 4 — Open port 3000 (2 min)

> **Firewall Rules** — GCP's VPC (Virtual Private Cloud) has a firewall that
> controls what traffic can reach your VMs. Rules are matched by network tags —
> if a VM has the tag `swjsh-server` and a firewall rule targets that tag,
> the rule applies to that VM. This is cleaner than IP-based rules.

```powershell
gcloud compute firewall-rules create allow-swjsh-dashboard --project=swjsh-algo-knife --direction=INGRESS --action=ALLOW --rules=tcp:3000 --source-ranges=0.0.0.0/0 --target-tags=swjsh-server --description="SwjshAK trading dashboard"
```

Verify it was created:
```powershell
gcloud compute firewall-rules list --filter="name=allow-swjsh-dashboard"
```

---

## Part 5 — Bootstrap the server (5 min, one-time)

> **gcloud compute ssh** — Connects to your VM without managing SSH keys manually.
> gcloud generates a key pair, uploads the public key to the VM, and handles
> everything. At work this is how you'll SSH into GCP VMs — no key files to manage.

### 5.1 SSH into your VM

```powershell
gcloud compute ssh swjsh-server --zone=us-central1-a --project=swjsh-algo-knife
```

First time: gcloud generates an SSH key and asks you to set a passphrase (can be empty).

### 5.2 Run the bootstrap script

You're now in the VM's terminal. Run:

```bash
curl -fsSL https://raw.githubusercontent.com/YOUR_GITHUB/SwjshAlgoKnife/main/setup_oracle.sh -o setup_oracle.sh
chmod +x setup_oracle.sh
./setup_oracle.sh
```

**If you haven't pushed to GitHub yet**, upload the script directly from Windows.
Open a second PowerShell window (keep the SSH session open) and run:

```powershell
gcloud compute scp setup_oracle.sh swjsh-server:/home/$env:USERNAME/setup_oracle.sh `
  --zone=us-central1-a --project=swjsh-algo-knife
```

Then back in the SSH session:
```bash
chmod +x ~/setup_oracle.sh && ~/setup_oracle.sh
```

The script takes ~3 minutes. When it finishes, type `exit` to leave the SSH session.

---

## Part 6 — Deploy the app (3 min initial, ~1 min after that)

### 6.1 Configure PUSH_TO_GCP.ps1

Open `PUSH_TO_GCP.ps1` in your project folder and set the two variables at the top:

```powershell
$GCP_PROJECT  = "swjsh-algo-knife"
$GCP_INSTANCE = "swjsh-server"
$GCP_ZONE     = "us-central1-a"
```

### 6.2 Deploy

```powershell
.\PUSH_TO_GCP.ps1
```

This:
1. Zips the project (excluding `node_modules`, `.next`, `data/`)
2. Uses `gcloud compute scp` to upload to the VM
3. Uploads your `.env.local` (API keys)
4. SSHs in to run `npm install`, `npm run build`, start PM2

First run: ~5 minutes. Future deploys: ~2 minutes.

---

## Everyday usage

### Watch your bots live
```powershell
# All three processes (dashboard + Bob + Sterling)
gcloud compute ssh swjsh-server --zone=us-central1-a -- "pm2 logs"

# Just Bitcoin Bob
gcloud compute ssh swjsh-server --zone=us-central1-a -- "pm2 logs AK-BitcoinBob"

# Just Sterling
gcloud compute ssh swjsh-server --zone=us-central1-a -- "pm2 logs AK-Sterling"
```

> **Tip:** The `--` after the SSH flags separates gcloud options from the
> remote command. Everything after `--` runs on the server.

### Check process health
```powershell
gcloud compute ssh swjsh-server --zone=us-central1-a -- "pm2 list"
```

### Restart a bot
```powershell
gcloud compute ssh swjsh-server --zone=us-central1-a -- "pm2 restart AK-BitcoinBob"
```

### Deploy code updates
```powershell
.\PUSH_TO_GCP.ps1
```

---

## GCP console vs gcloud CLI quick reference

| Action | Console UI | gcloud CLI |
|--------|-----------|------------|
| List VMs | Compute Engine → VM Instances | `gcloud compute instances list` |
| SSH in | Click SSH button next to VM | `gcloud compute ssh swjsh-server --zone=us-central1-a` |
| Copy files | — | `gcloud compute scp file.txt swjsh-server:/home/user/` |
| View firewall | VPC Network → Firewall | `gcloud compute firewall-rules list` |
| Check billing | Billing → Overview | `gcloud billing accounts list` |
| Stop VM | VM list → ⋮ → Stop | `gcloud compute instances stop swjsh-server --zone=us-central1-a` |
| Start VM | VM list → ⋮ → Start | `gcloud compute instances start swjsh-server --zone=us-central1-a` |

---

## Troubleshooting

**`gcloud: command not found` after installing**
Close all PowerShell windows and open a new one. The installer adds gcloud to PATH but existing sessions don't see it.

**Dashboard not loading at `http://YOUR_IP:3000`**
1. Verify firewall rule: `gcloud compute firewall-rules list`
2. Check PM2 is running: `gcloud compute ssh swjsh-server --zone=us-central1-a -- "pm2 list"`
3. Verify port is open on the OS: `gcloud compute ssh swjsh-server --zone=us-central1-a -- "sudo iptables -L INPUT -n | grep 3000"`

**Bots showing `errored` in pm2 list**
```powershell
gcloud compute ssh swjsh-server --zone=us-central1-a -- "pm2 logs AK-BitcoinBob --err --lines 30"
```
Most common cause: missing Python packages → `pip3 install yfinance pandas numpy requests`

**VM stopped / not accessible**
Always Free VMs stop if you accidentally set them as `SPOT` (preemptible) instead of `STANDARD`. Check:
```powershell
gcloud compute instances describe swjsh-server --zone=us-central1-a --format="get(scheduling.preemptible)"
```
Should return `False`. If `True`, the VM was created as preemptible — delete and recreate with the command in Part 3.

---

## Optional: Custom domain + HTTPS

Point a domain's A record to your VM IP, then:

```powershell
# SSH in
gcloud compute ssh swjsh-server --zone=us-central1-a

# Install nginx + certbot
sudo apt install -y nginx certbot python3-certbot-nginx

# Create nginx config
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
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/swjsh /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d yourdomain.com
```

Also open ports 80 and 443:
```powershell
gcloud compute firewall-rules create allow-http-https `
  --direction=INGRESS --action=ALLOW --rules=tcp:80,tcp:443 `
  --source-ranges=0.0.0.0/0 --target-tags=swjsh-server `
  --project=swjsh-algo-knife
```

---

## What you just learned (GCP concepts used in this guide)

| Concept | What it is | Where you used it |
|---------|-----------|------------------|
| **Project** | Resource container | `swjsh-algo-knife` project |
| **Compute Engine** | GCP's VM service | `e2-micro` VM |
| **e2-micro** | Always Free VM shape | Your server |
| **Zone** | Specific datacenter | `us-central1-a` |
| **VPC** | Virtual network for your resources | Your VM lives in the default VPC |
| **Firewall Rules** | Traffic control via network tags | Port 3000 rule |
| **Network Tags** | Labels that attach firewall rules to VMs | `swjsh-server` tag |
| **gcloud CLI** | Command-line interface for GCP | All deploy/ssh commands |
| **gcloud compute ssh** | SSH without managing key files | Connecting to the VM |
| **gcloud compute scp** | Secure file copy to/from GCP VMs | Uploading your code |
