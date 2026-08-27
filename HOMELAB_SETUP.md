# AutoApply — Homelab Deployment & Tailscale Guide
### Fedora KDE (16GB RAM) • 100% Isolated Docker Container Setup

This guide allows you to run **AutoApply** as a centralized, self-hosted web application inside your home lab with zero interference with any existing containers.

---

## 1. Isolation Architecture Guarantee

- **Dedicated Network**: `autoapply_isolated_network` (custom bridge driver). It does not join default bridges or share traffic with other homelab containers.
- **Dedicated Volume**: `autoapply_persistent_data` mapped to `/app/data`. Your master profile, Kanban job tracker SQLite/JSON records, and compiled PDFs stay persisted across restarts and image updates.
- **Host Port**: Binds to `8080` by default (can be changed to any port in `.env` like `7331` or `9090` without rebuilding).
- **Resource Constraints**: Capped at 2GB RAM max (leaving plenty of memory for your 16GB Fedora host and other services).

---

## 2. Quick Setup on Fedora KDE

### Step 1: Create directory and extract files
```bash
mkdir -p ~/homelab/autoapply
cd ~/homelab/autoapply

# Unzip the downloaded autoapply_homelab_package.zip here
unzip ~/Downloads/autoapply_homelab_package.zip
```

### Step 2: Configure Environment Variables
Create your `.env` file:
```bash
cp .env.docker.example .env
nano .env
```
Set your Google AI Studio API key and desired port:
```env
GEMINI_API_KEY=AIzaSy...your_gemini_api_key...
AUTOAPPLY_PORT=8080
NODE_ENV=production
```

### Step 3: Build & Launch Container
```bash
# Build and start in detached background mode
docker compose up -d --build
```

Check container status and logs:
```bash
docker compose ps
docker compose logs -f
```

---

## 3. Centralized Access via Tailscale

Since your Fedora KDE homelab machine is connected to your Tailscale network:

### Method A: Direct Access via MagicDNS or Tailscale IP
1. Find your Fedora machine's Tailscale IP:
   ```bash
   tailscale ip -4
   # Example: 100.85.120.44
   ```
2. On any connected device (iPhone, Android, MacBook, Windows, iPad), open your browser:
   ```
   http://100.85.120.44:8080
   ```
   Or use the host's MagicDNS name:
   ```
   http://fedora-homelab:8080
   ```

### Method B (Optional): Automatic HTTPS with Tailscale Serve
To get valid SSL/HTTPS on all your devices:
```bash
tailscale serve --bg 8080
```
You can now access AutoApply securely at:
```
https://fedora-homelab.your-tailnet.ts.net
```

---

## 4. Fedora Firewall (Firewalld) Configuration (If Required)

If Fedora's default firewall blocks traffic on the Tailscale interface, allow the `tailscale0` zone:
```bash
# Allow Tailscale interface traffic
sudo firewall-cmd --permanent --zone=trusted --add-interface=tailscale0
sudo firewall-cmd --reload
```

---

## 5. Maintenance & Persistent Backups

- **Update container**: `docker compose pull && docker compose up -d --build`
- **Restart container**: `docker compose restart`
- **Backup your persistent tracker and profile**:
  ```bash
  # Backup container data volume to a timestamped tar archive
  docker run --rm -v autoapply_persistent_data:/data -v $(pwd):/backup \
    alpine tar czf /backup/autoapply_backup_$(date +%Y%m%d).tar.gz -C /data .
  ```
