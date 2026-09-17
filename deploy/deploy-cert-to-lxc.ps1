param (
    [string]$LxcIp = "192.168.10.100",
    [string]$CertPath = "C:\Users\ben\Downloads\esselman.home_crt.pem",
    [string]$KeyPath = "C:\Users\ben\Downloads\esselman.home_prv.pem"
)

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "      Deploying SSL Certificates to Nano IPAM LXC         " -ForegroundColor Cyan
Write-Host "      Target: root@$LxcIp                                 " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

Write-Host "`n[1/5] Creating remote directory /var/lib/nano-ipam/certs..." -ForegroundColor Yellow
ssh root@$LxcIp "mkdir -p /var/lib/nano-ipam/certs"

Write-Host "[2/5] Copying certificate (cert.pem)..." -ForegroundColor Yellow
scp $CertPath "root@${LxcIp}:/var/lib/nano-ipam/certs/cert.pem"

Write-Host "[3/5] Copying private key (key.pem)..." -ForegroundColor Yellow
scp $KeyPath "root@${LxcIp}:/var/lib/nano-ipam/certs/key.pem"

Write-Host "[4/5] Pulling latest code and building Nano IPAM on LXC..." -ForegroundColor Yellow
ssh root@$LxcIp "cd /opt/nano-ipam && git pull && npm run build && cp deploy/nano-ipam.service /etc/systemd/system/nano-ipam.service"

Write-Host "[5/5] Setting secure permissions and restarting service..." -ForegroundColor Yellow
ssh root@$LxcIp "chmod 644 /var/lib/nano-ipam/certs/cert.pem; chmod 600 /var/lib/nano-ipam/certs/key.pem; systemctl daemon-reload; systemctl restart nano-ipam"

Write-Host "`n[SUCCESS] Nano IPAM updated with HTTPS enabled!" -ForegroundColor Green
Write-Host "You can now access your dashboard at:" -ForegroundColor White
Write-Host "  👉 https://$LxcIp" -ForegroundColor Green
Write-Host "  👉 http://$LxcIp (auto-redirects to HTTPS)`n" -ForegroundColor Green
