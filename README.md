# Nano IPAM

A fast, lightweight, self-hosted IP Address Management (IPAM) solution with an intuitive web dashboard and REST API. Built with **TypeScript**, **Node.js**, and zero-dependency **SQLite**, specifically optimized to run in modest resource environments like **Proxmox LXC containers** (< 50MB RAM footprint).

---

## ✨ Features

- **Subnet & CIDR Management**:
  - Automatic network boundary, netmask, broadcast, usable IP range, and host count calculation.
  - Automatic overlap detection prevents IP address conflicts.
  - Support for VLAN tagging and descriptions.
- **IP Allocation & Tracking**:
  - **"Next Available IP"** calculation with a single click or API call.
  - Allocation status tracking: `Active`, `Reserved`, `DHCP`, or `Inactive`.
  - Hostname, MAC address (with auto-normalization), VLAN ID, and notes.
- **Modern Responsive Web UI**:
  - Subnet explorer with visual utilization progress bars.
  - Instant IP matrix / list view with allocation modals.
  - Global search across IP, Hostname, MAC address, and descriptions.
  - Dark / Light mode toggle with persistent preference.
- **Zero-Config Persistence**:
  - Embedded SQLite database via Node's native storage or fallback SQLite driver.
  - Zero external database server overhead (no Postgres/MySQL daemon needed).
- **Ready for Proxmox LXC & Docker**:
  - Automated 1-step installer script for Debian/Ubuntu LXCs.
  - Production-ready `systemd` service unit.
  - Multi-stage `Dockerfile` and `docker-compose.yml`.

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- Node.js (v20+ or v22+)
- npm

### Installation
```bash
git clone https://github.com/besselman/nano-ipam.git
cd nano-ipam
npm install
```

### Run in Development Mode
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### Run Tests
```bash
npm test
```

### Build & Run Production Server
```bash
npm run build
npm start
```

---

## 📦 Proxmox LXC Deployment

### Option 1: Automated 1-Command LXC Installer
Create a lightweight Debian 12 (Bookworm) or Ubuntu 24.04 LXC container in Proxmox (512MB RAM and 4GB disk is plenty).

Inside the LXC container shell (as root), run:
```bash
curl -fsSL https://raw.githubusercontent.com/besselman/nano-ipam/main/deploy/lxc-install.sh | bash
```
The installer script will:
1. Install Node.js LTS and Git.
2. Clone `nano-ipam` to `/opt/nano-ipam`.
3. Build the application.
4. Set up `/var/lib/nano-ipam/ipam.db` for persistent data.
5. Install and start the `systemd` service (`nano-ipam.service`) configured to auto-start on boot.

Access the web UI at `http://<LXC_IP_ADDRESS>:3000`.

---

### Option 2: Systemd Service Manual Setup
If you cloned the repo manually into `/opt/nano-ipam`:
```bash
# 1. Install & build
cd /opt/nano-ipam
npm ci
npm run build

# 2. Setup persistent directory
mkdir -p /var/lib/nano-ipam

# 3. Copy systemd service file
cp deploy/nano-ipam.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now nano-ipam
```

Check status or logs:
```bash
systemctl status nano-ipam
journalctl -u nano-ipam -f
```

---

## 🐳 Docker Deployment

### Using Docker Compose
```bash
docker compose up -d
```

### Using Docker CLI
```bash
docker build -t nano-ipam .
docker run -d \
  --name nano-ipam \
  -p 3000:3000 \
  -v nano_ipam_data:/app/data \
  --restart unless-stopped \
  nano-ipam
```

---

## ⚙️ Configuration & Environment Variables

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `3000` | Port for web server & REST API (set to `443` for standard HTTPS) |
| `HOST` | `0.0.0.0` | Bind address (`0.0.0.0` listens on all interfaces) |
| `DATA_PATH` | `./data/ipam.db` | Path to SQLite database file |
| `NODE_ENV` | `production` | Environment mode (`development` or `production`) |
| `SSL_CERT_PATH` | `None` | Path to TLS/SSL certificate (`cert.pem` or `fullchain.pem`) |
| `SSL_KEY_PATH` | `None` | Path to TLS/SSL private key (`key.pem` or `privkey.pem`) |
| `HTTP_REDIRECT_PORT` | `None` | If set (or if `PORT=443`), runs an HTTP redirect server on this port (e.g., `80`) |

---

## 🔒 HTTPS / SSL Certificate Setup

Nano IPAM natively supports HTTPS (TLS/SSL). When `SSL_CERT_PATH` and `SSL_KEY_PATH` are configured, the server automatically starts in secure HTTPS mode.

### Option 1: Provide Your Own Certificate Files
If you have an existing certificate (e.g. from an internal CA, Active Directory CS, or a wildcard cert):
1. Copy your certificate file (`cert.pem` or `fullchain.pem`) and private key (`key.pem` or `privkey.pem`) into `/var/lib/nano-ipam/certs/` (or a `./certs/` folder in the project root).
2. Update `/etc/systemd/system/nano-ipam.service`:
   ```ini
   Environment=PORT=443
   Environment=SSL_CERT_PATH=/var/lib/nano-ipam/certs/cert.pem
   Environment=SSL_KEY_PATH=/var/lib/nano-ipam/certs/key.pem
   Environment=HTTP_REDIRECT_PORT=80
   ```
3. Reload and restart:
   ```bash
   systemctl daemon-reload
   systemctl restart nano-ipam
   ```

*(Nano IPAM also automatically searches `./certs/cert.pem` and `/var/lib/nano-ipam/certs/cert.pem` if the files are present).*

---

### Option 2: Generate a Self-Signed Certificate
If you are running in a private homelab and want immediate encryption:
```bash
# Run the included helper script inside the LXC container:
bash /opt/nano-ipam/deploy/generate-cert.sh /var/lib/nano-ipam/certs 365 ipam.local
```
This generates `cert.pem` and `key.pem` in `/var/lib/nano-ipam/certs/`. Nano IPAM will automatically pick them up and serve HTTPS!

---

### Option 3: Let's Encrypt / Certbot
If your container has a public domain name or DNS-01 challenge configured:
```bash
apt-get install -y certbot
certbot certonly --standalone -d ipam.yourdomain.com
```
Then configure the systemd service to point to `/etc/letsencrypt/live/ipam.yourdomain.com/fullchain.pem` and `privkey.pem`.

---

### Option 4: Reverse Proxy (Caddy or Nginx)
If you prefer terminating SSL at a reverse proxy, you can keep Nano IPAM on HTTP port 3000 and let the proxy handle certificates:

**Caddyfile** (Automatic HTTPS):
```caddy
ipam.local {
    reverse_proxy localhost:3000
    tls internal
}
```

---

---

## 🔌 REST API Reference

### Subnets
- `GET /api/subnets` — List all subnets with calculated metrics (utilization %, usable hosts, free IPs).
- `GET /api/subnets/:id` — Get single subnet details with all IP allocations.
- `POST /api/subnets` — Create a subnet:
  ```json
  {
    "cidr": "192.168.10.0/24",
    "name": "Servers VLAN",
    "vlanId": 10,
    "gateway": "192.168.10.1",
    "description": "DMZ Server Segment"
  }
  ```
- `DELETE /api/subnets/:id` — Delete subnet and its IP allocations.

### IP Allocations
- `GET /api/allocations?subnetId=1` — List allocations for a subnet.
- `GET /api/allocations/next-available?subnetId=1` — Get the next unused IP address in a subnet.
- `POST /api/allocations` — Allocate or reserve an IP:
  ```json
  {
    "subnetId": 1,
    "ipAddress": "192.168.10.25",
    "hostname": "proxmox-pve1",
    "macAddress": "bc:24:11:22:33:44",
    "status": "active",
    "description": "Primary Hypervisor"
  }
  ```
- `DELETE /api/allocations/:id` — Release an IP allocation.

### Search & Stats
- `GET /api/stats` — Overall statistics (total subnets, total allocated IPs, utilization %).
- `GET /api/search?q=<query>` — Search subnets and IP allocations by IP, CIDR, hostname, MAC, or description.

---

## 📄 License
MIT
