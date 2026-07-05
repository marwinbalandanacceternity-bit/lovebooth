@echo off
title LoveBooth Online
cd /d "%~dp0"
set LOVEBOOTH_PORT=8471
echo ============================================================
echo   LoveBooth - Online Mode
echo   Building the latest version...
echo ============================================================
call npm run build
echo.
start "LoveBoothServer" /min cmd /c "set LOVEBOOTH_PORT=8471&& node server\index.js --prod"
timeout /t 3 /nobreak >nul
echo ============================================================
echo   Starting your public link...
echo.
echo   Look below for a line like:
echo      https://something-random.trycloudflare.com
echo.
echo   1. Open that link on YOUR device (PC or phone)
echo   2. Create a room and send the SAME link + room code
echo      (or the copied invite link) to your partner
echo   3. Works phone-to-phone, phone-to-PC, PC-to-PC
echo.
echo   Keep this window open. Close it to go offline.
echo ============================================================
cloudflared tunnel --url http://localhost:8471
taskkill /FI "WINDOWTITLE eq LoveBoothServer*" /T /F >nul 2>&1
echo.
echo LoveBooth is offline. Press any key to close.
pause >nul
