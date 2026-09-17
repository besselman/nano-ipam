#!/usr/bin/env bash
# ==============================================================================
# Helper to generate a self-signed TLS/SSL certificate for Nano IPAM
# ==============================================================================
set -euo pipefail

CERT_DIR="${1:-/var/lib/nano-ipam/certs}"
DAYS="${2:-365}"
DOMAIN="${3:-nano-ipam.local}"

mkdir -p "$CERT_DIR"
echo "--> Generating self-signed TLS certificate in $CERT_DIR..."
openssl req -x509 -nodes -days "$DAYS" -newkey rsa:2048 \
  -keyout "$CERT_DIR/key.pem" \
  -out "$CERT_DIR/cert.pem" \
  -subj "/CN=$DOMAIN/O=Nano IPAM/C=US"

chmod 600 "$CERT_DIR/key.pem"
chmod 644 "$CERT_DIR/cert.pem"

echo "--> Certificate generated successfully:"
echo "    Certificate: $CERT_DIR/cert.pem"
echo "    Private Key: $CERT_DIR/key.pem"
