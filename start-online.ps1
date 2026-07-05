# LoveBooth Online launcher: builds the app, serves it, opens a Cloudflare
# quick tunnel, then opens the public link + a QR code and copies the link.
param([switch]$Test)

$ErrorActionPreference = 'Continue'
Set-Location $PSScriptRoot
$port = 8471
$cloudflared = 'C:\Program Files (x86)\cloudflared\cloudflared.exe'

Write-Host ''
Write-Host '  LoveBooth - Online Mode' -ForegroundColor Magenta
Write-Host '  Building the latest version...' -ForegroundColor DarkGray
& npm run build 2>&1 | Out-Null

# Free the port if a previous run left a server behind
$existing = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
if ($existing) { try { Stop-Process -Id $existing.OwningProcess -Force -ErrorAction Stop } catch {} }

$env:LOVEBOOTH_PORT = "$port"
$server = Start-Process node -ArgumentList 'server/index.js', '--prod' -WindowStyle Hidden -PassThru

$log = Join-Path $env:TEMP 'lovebooth-tunnel.log'
Remove-Item $log -Force -ErrorAction SilentlyContinue
$cf = Start-Process $cloudflared -ArgumentList 'tunnel', '--url', "http://localhost:$port" -WindowStyle Hidden -RedirectStandardError $log -PassThru

Write-Host '  Creating your public link (takes ~20 seconds)...' -ForegroundColor DarkGray
$url = $null
for ($i = 0; $i -lt 60 -and -not $url; $i++) {
    Start-Sleep 1
    $url = Select-String -Path $log -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' -AllMatches -ErrorAction SilentlyContinue |
        ForEach-Object { $_.Matches.Value } | Select-Object -First 1
}

if (-not $url) {
    Write-Host '  Could not create the tunnel. Check your internet connection and try again.' -ForegroundColor Red
} else {
    # Wait until the link actually resolves (tunnel DNS takes a moment)
    $live = $false
    for ($i = 0; $i -lt 45 -and -not $live; $i++) {
        try {
            $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 5
            if ($r.StatusCode -eq 200) { $live = $true }
        } catch { Start-Sleep 2 }
    }

    try { Set-Clipboard -Value $url } catch {}
    Write-Host ''
    Write-Host '  ============================================================' -ForegroundColor Magenta
    Write-Host "   Your LoveBooth link (already copied to clipboard):" -ForegroundColor White
    Write-Host "   $url" -ForegroundColor Cyan
    Write-Host ''
    Write-Host '   1. The app + a QR code are opening in your browser' -ForegroundColor White
    Write-Host '   2. Scan the QR with your phone to open it there' -ForegroundColor White
    Write-Host '   3. Create a room, send the invite link to your partner' -ForegroundColor White
    Write-Host '      (works phone-to-phone, phone-to-PC, PC-to-PC)' -ForegroundColor White
    Write-Host ''
    Write-Host '   Keep this window open. Close it to go offline.' -ForegroundColor Yellow
    Write-Host '  ============================================================' -ForegroundColor Magenta
    Write-Host ''

    if (-not $Test) {
        Start-Process $url
        Start-Process "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=$([uri]::EscapeDataString($url))"
    } else {
        Write-Host "  [test mode] live=$live - skipping browser open" -ForegroundColor DarkGray
    }
}

if (-not $Test) { Read-Host '  Press Enter to go offline and close' | Out-Null }

foreach ($p in @($cf, $server)) {
    if ($p) { try { Stop-Process -Id $p.Id -Force -ErrorAction Stop } catch {} }
}
Write-Host '  LoveBooth is offline.' -ForegroundColor DarkGray
