#!/usr/bin/env bash
# ==============================================================================
# nano-ipam: Automated Proxmox LXC Container Installer
# Tested on Debian 12 (Bookworm) & Ubuntu 22.04 / 24.04 LXC
# ==============================================================================

set -euo pipefail

echo "========================================================"
echo "          nano-ipam Proxmox LXC Installer              "
echo "========================================================"

if [ "$EUID" -ne 0 ]; then
  echo "Error: Please run this installer as root inside your LXC container."
  exit 1
fi

INSTALL_DIR="/opt/nano-ipam"
DATA_DIR="/var/lib/nano-ipam"
REPO_URL="https://github.com/besselman/nano-ipam.git"

# 1. Update package lists and install prerequisites
echo "--> Updating packages and installing curl, git, ca-certificates..."
apt-get update -y
apt-get install -y curl git ca-certificates gnupg

# 2. Install Node.js (LTS v22+) if not present
if ! command -v node &> /dev/null || [ "$(node -v | cut -d'.' -f1 | tr -d 'v')" -lt 20 ]; then
  echo "--> Installing Node.js LTS via NodeSource..."
  mkdir -p /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
  NODE_MAJOR=22
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_$NODE_MAJOR.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list
  apt-get update -y
  apt-get install -y nodejs
fi

echo "--> Node.js version: $(node -v)"
echo "--> npm version: $(npm -v)"

# 3. Create persistent data directory
mkdir -p "$DATA_DIR"
chmod 750 "$DATA_DIR"

# 4. Clone or pull latest nano-ipam
if [ -d "$INSTALL_DIR/.git" ]; then
  echo "--> Updating existing nano-ipam installation in $INSTALL_DIR..."
  cd "$INSTALL_DIR"
  git pull
else
  echo "--> Cloning nano-ipam repository to $INSTALL_DIR..."
  git clone "$REPO_URL" "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi

# 5. Install dependencies and build project
echo "--> Installing dependencies and compiling TypeScript..."
npm install
npm run build

# 6. Install and enable systemd service
echo "--> Configuring systemd service..."
cp "$INSTALL_DIR/deploy/nano-ipam.service" /etc/systemd/system/nano-ipam.service
systemctl daemon-reload
systemctl enable nano-ipam.service
systemctl restart nano-ipam.service

# 7. Verify status and fetch IP address
sleep 2
if systemctl is-active --quiet nano-ipam.service; then
  HOST_IP=$(hostname -I | awk '{print $1}')
  echo ""
  echo "========================================================"
  echo "  SUCCESS! nano-ipam is installed and running!          "
  echo "========================================================"
  echo "  Web Interface:  http://${HOST_IP}:3000"
  echo "  Database file:  ${DATA_DIR}/ipam.db"
  echo "  Service logs:   journalctl -u nano-ipam -f"
  echo "========================================================"
else
  echo "Warning: Service failed to start. Check logs with: journalctl -u nano-ipam -e"
  exit 1
fi
