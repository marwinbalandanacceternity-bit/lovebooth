@echo off
title LoveBooth
cd /d "%~dp0"
echo ============================================
echo   Starting LoveBooth...
echo   Your browser will open automatically.
echo   Keep this window open while you use the app.
echo   Close this window to stop the app.
echo ============================================
echo.
start "" cmd /c "timeout /t 5 /nobreak >nul & start http://localhost:5173"
call npm run dev
echo.
echo App stopped. Press any key to close this window.
pause >nul
