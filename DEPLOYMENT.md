# Deployment Guide - Proxmox + Cloudflare Tunnel

This guide walks through deploying the wedding registry application on Proxmox with Cloudflare Tunnel for secure external access.

## Prerequisites

- Proxmox server running on your local network
- Cloudflare account with a domain registered
- Basic familiarity with Linux command line

## Part 1: Create LXC Container in Proxmox

### 1.1 Create Ubuntu Container

1. Log into Proxmox web interface
2. Click **Create CT** (top right)
3. Configure the container:
   - **General Tab:**
     - Node: (select your node)
     - CT ID: (use default or choose)
     - Hostname: `wedding-registry`
     - Password: (set root password)
     - ✅ Unprivileged container
   - **Template Tab:**
     - Storage: (select storage)
     - Template: `ubuntu-22.04-standard` (or latest)
   - **Root Disk:**
     - Disk size: `8 GB` (more than enough)
   - **CPU:**
     - Cores: `1` (can increase later)
   - **Memory:**
     - Memory: `512 MB`
     - Swap: `512 MB`
   - **Network:**
     - ✅ DHCP (or assign static IP)
     - IPv6: auto (or DHCP)
4. Click **Finish** to create
5. Start the container

### 1.2 Access the Container

```bash
# From Proxmox host terminal, or click "Console" in web UI
pct enter <CT_ID>
```

## Part 2: Install Node.js and Dependencies

### 2.1 Update System

```bash
apt update && apt upgrade -y
```

### 2.2 Install Node.js 20 (LTS)

```bash
# Install curl if not present
apt install -y curl

# Add NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -

# Install Node.js
apt install -y nodejs

# Verify installation
node --version  # Should show v20.x.x
npm --version   # Should show npm version
```

### 2.3 Install Additional Tools

```bash
# Install git, build tools (needed for better-sqlite3)
apt install -y git build-essential python3

# Install PM2 for process management (optional but recommended)
npm install -g pm2
```

## Part 3: Deploy the Application

### 3.1 Create Application User (Best Practice)

```bash
# Create dedicated user for running the app
useradd -m -s /bin/bash wedding
su - wedding
```

### 3.2 Clone or Upload the Repository

**Option A: Clone from GitHub**
```bash
cd ~
git clone https://github.com/matthew-smith734/wedding-registry.git
cd wedding-registry
```

**Option B: Upload files manually**
```bash
# On your local machine (from the repo directory):
# scp -r . root@<PROXMOX_CONTAINER_IP>:/home/wedding/wedding-registry/

# Then in the container:
cd /home/wedding/wedding-registry
chown -R wedding:wedding /home/wedding/wedding-registry
```

### 3.3 Install Dependencies

```bash
# As the wedding user
cd ~/wedding-registry
npm install
```

### 3.4 Configure Environment Variables

```bash
# Create production environment file
cp .env.example .env

# Edit the file
nano .env
```

Set these values:
```
NODE_ENV=production
PORT=3000
SESSION_SECRET=<generate-strong-random-string>
```

**Generate a strong session secret:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3.5 Test the Application

```bash
# Run the app to verify it works
npm start

# You should see:
# Wedding Registry server running on http://localhost:3000
```

Press Ctrl+C to stop. If it works, proceed to the next step.

## Part 4: Set Up Systemd Service

### 4.1 Create Service File

Exit from the `wedding` user back to root:
```bash
exit  # Back to root user
```

Create the systemd service:
```bash
nano /etc/systemd/system/wedding-registry.service
```

Paste the service configuration (from wedding-registry.service file in repo).

### 4.2 Enable and Start Service

```bash
# Reload systemd to recognize new service
systemctl daemon-reload

# Enable service to start on boot
systemctl enable wedding-registry

# Start the service
systemctl start wedding-registry

# Check status
systemctl status wedding-registry
```

The app should now be running! Verify with:
```bash
curl http://localhost:3000
```

## Part 5: Set Up Cloudflare Tunnel

### 5.1 Install Cloudflared in Container

```bash
# Download and install cloudflared
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o cloudflared.deb
dpkg -i cloudflared.deb

# Verify installation
cloudflared --version
```

### 5.2 Authenticate with Cloudflare

```bash
# This will open a browser for authentication
cloudflared tunnel login
```

This opens a browser window. If you're on a headless server, you'll see a URL - copy it and open in your browser on another machine, then authorize.

### 5.3 Create a Tunnel

```bash
# Create tunnel named "wedding-registry"
cloudflared tunnel create wedding-registry

# Note the tunnel ID shown in the output
# Save the credentials file location (usually ~/.cloudflared/<TUNNEL-ID>.json)
```

### 5.4 Configure DNS

```bash
# Create DNS record pointing to your tunnel
# Replace <TUNNEL-ID> with your actual tunnel ID
cloudflared tunnel route dns wedding-registry registry.yourdomain.com

# Or use a subdomain of your choice
# cloudflared tunnel route dns wedding-registry wedding.yourdomain.com
```

### 5.5 Create Tunnel Configuration

```bash
mkdir -p ~/.cloudflared
nano ~/.cloudflared/config.yml
```

Paste this configuration:
```yaml
tunnel: <TUNNEL-ID>
credentials-file: /root/.cloudflared/<TUNNEL-ID>.json

ingress:
  - hostname: registry.yourdomain.com
    service: http://localhost:3000
  - service: http_status:404
```

Replace:
- `<TUNNEL-ID>` with your tunnel ID
- `registry.yourdomain.com` with your chosen subdomain

### 5.6 Test the Tunnel

```bash
# Run tunnel in foreground to test
cloudflared tunnel run wedding-registry
```

Open `https://registry.yourdomain.com` in your browser. You should see the login page!

Press Ctrl+C to stop.

### 5.7 Run Tunnel as a Service

```bash
# Install as a system service
cloudflared service install

# Start the service
systemctl start cloudflared

# Enable on boot
systemctl enable cloudflared

# Check status
systemctl status cloudflared
```

## Part 6: Verify Everything Works

### 6.1 Check Services are Running

```bash
# Check app service
systemctl status wedding-registry

# Check tunnel service
systemctl status cloudflared

# Check app logs
journalctl -u wedding-registry -f

# Check tunnel logs
journalctl -u cloudflared -f
```

### 6.2 Test External Access

1. Open your domain in a browser: `https://registry.yourdomain.com`
2. You should see the login page
3. Log in with default credentials:
   - Admin: `admin` / `admin123`
4. **IMPORTANT:** Change default passwords immediately!

## Part 7: Security Hardening

### 7.1 Change Default Credentials

After first login as admin:
1. Create a new admin user with a strong password
2. Delete or disable the default `admin` account
3. Change or remove demo user accounts

### 7.2 Update Environment Variables

```bash
su - wedding
cd ~/wedding-registry
nano .env
```

Update `SESSION_SECRET` if you haven't already.

### 7.3 Set Up Firewall (Optional)

```bash
# In the container, only allow local connections
apt install -y ufw
ufw default deny incoming
ufw default allow outgoing
ufw allow from 10.0.0.0/8  # Allow from local network (adjust range)
ufw enable
```

The app is only accessible via Cloudflare Tunnel, so direct access is blocked.

## Part 8: Backup Strategy

### 8.1 Backup the Database

```bash
# Create backup script
nano /home/wedding/backup-db.sh
```

Paste:
```bash
#!/bin/bash
BACKUP_DIR="/home/wedding/backups"
mkdir -p $BACKUP_DIR
cp /home/wedding/wedding-registry/registry.db "$BACKUP_DIR/registry-$(date +%Y%m%d-%H%M%S).db"

# Keep only last 7 days
find $BACKUP_DIR -name "registry-*.db" -mtime +7 -delete
```

Make executable:
```bash
chmod +x /home/wedding/backup-db.sh
chown wedding:wedding /home/wedding/backup-db.sh
```

### 8.2 Schedule Daily Backups

```bash
# As wedding user
crontab -e

# Add this line (runs daily at 2 AM):
0 2 * * * /home/wedding/backup-db.sh
```

### 8.3 Backup Proxmox Container

In Proxmox web UI:
1. Select the container
2. Click **Backup** → **Backup now**
3. Set up scheduled backups in Datacenter → Backup

## Maintenance Commands

### Update the Application

```bash
su - wedding
cd ~/wedding-registry
git pull
npm install
exit
systemctl restart wedding-registry
```

### View Logs

```bash
# App logs
journalctl -u wedding-registry -f

# Tunnel logs  
journalctl -u cloudflared -f

# Last 100 lines
journalctl -u wedding-registry -n 100
```

### Restart Services

```bash
systemctl restart wedding-registry
systemctl restart cloudflared
```

## Troubleshooting

### App won't start

```bash
# Check logs
journalctl -u wedding-registry -n 50

# Check if port is in use
netstat -tlnp | grep 3000

# Test manually
su - wedding
cd ~/wedding-registry
npm start
```

### Can't access via domain

```bash
# Check tunnel status
systemctl status cloudflared
journalctl -u cloudflared -n 50

# Test tunnel manually
cloudflared tunnel run wedding-registry

# Verify DNS in Cloudflare dashboard
```

### Database issues

```bash
# Check file permissions
ls -la /home/wedding/wedding-registry/registry.db

# Should be owned by wedding:wedding
chown wedding:wedding /home/wedding/wedding-registry/registry.db
```

## Cost Breakdown

- **Proxmox hosting:** $0 (self-hosted)
- **Cloudflare Tunnel:** $0 (free tier)
- **Domain:** ~$10-15/year (if you don't already have one)
- **Electricity:** ~$2-5/month (depending on hardware)

**Total monthly cost:** ~$0-5 🎉

## Next Steps

- Monitor resource usage in Proxmox
- Set up proper logging/monitoring
- Configure automated backups
- Change all default passwords
- Consider adding fail2ban for additional security
- Plan for multi-tenancy features
