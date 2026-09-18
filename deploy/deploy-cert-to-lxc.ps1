param (
    [string]$LxcIp = "192.168.10.100",
    [string]$CertPath = "",
    [string]$KeyPath = ""
)

# Resolve certificate paths with fallbacks
if (-not $CertPath -or -not (Test-Path $CertPath)) {
    $candidates = @(
        "C:\Users\ben\.gemini\antigravity\scratch\nano-ipam\certs\cert.pem",
        "$PSScriptRoot\..\certs\cert.pem",
        "C:\Users\ben\Downloads\esselman.home_crt.pem"
    )
    foreach ($c in $candidates) {
        if (Test-Path $c) {
            $CertPath = (Resolve-Path $c).Path
            break
        }
    }
}

if (-not $KeyPath -or -not (Test-Path $KeyPath)) {
    $candidates = @(
        "C:\Users\ben\.gemini\antigravity\scratch\nano-ipam\certs\key.pem",
        "$PSScriptRoot\..\certs\key.pem",
        "C:\Users\ben\Downloads\esselman.home_prv.pem"
    )
    foreach ($c in $candidates) {
        if (Test-Path $c) {
            $KeyPath = (Resolve-Path $c).Path
            break
        }
    }
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "      Deploying Updates & SSL to Nano IPAM LXC            " -ForegroundColor Cyan
Write-Host "      Target: root@$LxcIp                                 " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

Write-Host "`n[1/5] Ensuring remote cert directory /var/lib/nano-ipam/certs exists..." -ForegroundColor Yellow
ssh root@$LxcIp "mkdir -p /var/lib/nano-ipam/certs"

if ($CertPath -and (Test-Path $CertPath)) {
    Write-Host "[2/5] Copying certificate from $CertPath..." -ForegroundColor Yellow
    scp $CertPath "root@${LxcIp}:/var/lib/nano-ipam/certs/cert.pem"
} else {
    Write-Host "[2/5] No local cert.pem found, preserving existing container certificate..." -ForegroundColor Gray
}

if ($KeyPath -and (Test-Path $KeyPath)) {
    Write-Host "[3/5] Copying private key from $KeyPath..." -ForegroundColor Yellow
    scp $KeyPath "root@${LxcIp}:/var/lib/nano-ipam/certs/key.pem"
} else {
    Write-Host "[3/5] No local key.pem found, preserving existing container key..." -ForegroundColor Gray
}

Write-Host "[4/5] Pulling latest code and building Nano IPAM on LXC..." -ForegroundColor Yellow
ssh root@$LxcIp "cd /opt/nano-ipam && git pull && npm run build && cp deploy/nano-ipam.service /etc/systemd/system/nano-ipam.service"

Write-Host "[5/5] Setting secure permissions and restarting service..." -ForegroundColor Yellow
ssh root@$LxcIp "chmod 644 /var/lib/nano-ipam/certs/cert.pem 2>/dev/null || true; chmod 600 /var/lib/nano-ipam/certs/key.pem 2>/dev/null || true; systemctl daemon-reload; systemctl restart nano-ipam"

Write-Host "`n[SUCCESS] Nano IPAM updated and restarted!" -ForegroundColor Green
Write-Host "You can now access your dashboard at:" -ForegroundColor White
Write-Host "  👉 https://$LxcIp" -ForegroundColor Green
Write-Host "  👉 http://$LxcIp (auto-redirects to HTTPS)`n" -ForegroundColor Green