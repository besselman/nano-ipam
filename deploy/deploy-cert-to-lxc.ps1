param (
    [string]$LxcIp = "192.168.10.100",
    [string]$CertPath = "C:\Users\ben\Downloads\esselman.home_crt.pem",
    [string]$KeyPath = "C:\Users\ben\Downloads\esselman.home_prv.pem"
)

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "      Deploying SSL Certificates to Nano IPAM LXC         " -ForegroundColor Cyan
Write-Host "      Target: root@$LxcIp                                 " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

Write-Host "`n[1/4] Creating remote directory /var/lib/nano-ipam/certs..." -ForegroundColor Yellow
ssh root@$LxcIp "mkdir -p /var/lib/nano-ipam/certs"

Write-Host "[2/4] Copying certificate (cert.pem)..." -ForegroundColor Yellow
scp $CertPath "root@${LxcIp}:/var/lib/nano-ipam/certs/cert.pem"

Write-Host "[3/4] Copying private key (key.pem)..." -ForegroundColor Yellow
scp $KeyPath "root@${LxcIp}:/var/lib/nano-ipam/certs/key.pem"

Write-Host "[4/4] Setting secure permissions and restarting nano-ipam..." -ForegroundColor Yellow
ssh root@$LxcIp "chmod 644 /var/lib/nano-ipam/certs/cert.pem; chmod 600 /var/lib/nano-ipam/certs/key.pem; systemctl daemon-reload; systemctl restart nano-ipam"

Write-Host "`n[SUCCESS] Certificates deployed and Nano IPAM restarted with Option B!" -ForegroundColor Green
Write-Host "You can now access your dashboard at:" -ForegroundColor White
Write-Host "  👉 https://$LxcIp" -ForegroundColor Green
Write-Host "  👉 http://$LxcIp (auto-redirects to HTTPS)`n" -ForegroundColor Green
