@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js was not found.
  echo Please install Node.js and run this file again.
  echo.
  pause
  exit /b 1
)

echo Starting local server...
echo Please keep the new black window open.
start "Celeb Quiz Local Server" cmd /k "cd /d %~dp0 && node server.js"

timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:8787/password-admin.html"

echo.
echo If the browser did not open automatically, open this URL manually:
echo http://127.0.0.1:8787/password-admin.html
echo.
echo To stop the server, close the black window named:
echo Celeb Quiz Local Server
echo.
pause
