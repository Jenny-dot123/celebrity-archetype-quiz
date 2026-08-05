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

for /f "usebackq delims=" %%I in (`powershell -NoProfile -Command "(Get-NetIPAddress -AddressFamily IPv4 ^| Where-Object { $_.IPAddress -like '192.168.*' -or $_.IPAddress -like '10.*' -or $_.IPAddress -like '172.16.*' -or $_.IPAddress -like '172.17.*' -or $_.IPAddress -like '172.18.*' -or $_.IPAddress -like '172.19.*' -or $_.IPAddress -like '172.2*' -or $_.IPAddress -like '172.30.*' -or $_.IPAddress -like '172.31.*' } ^| Select-Object -First 1 -ExpandProperty IPAddress)"`) do set LAN_IP=%%I

if "%LAN_IP%"=="" (
  echo.
  echo Could not detect a local IPv4 address.
  echo Please make sure this computer is connected to Wi-Fi or Ethernet.
  echo.
  pause
  exit /b 1
)

echo Starting local server...
echo Please keep the new black window open.
start "Celeb Quiz Local Server" cmd /k "cd /d %~dp0 && node server.js"

timeout /t 2 /nobreak >nul

set SHARE_LINK=http://%LAN_IP%:8787/index.html
set ADMIN_LINK=http://127.0.0.1:8787/password-admin.html

echo.
echo Share this test link to other people on the same Wi-Fi:
echo %SHARE_LINK%
echo.
echo Local admin page on this computer:
echo %ADMIN_LINK%
echo.

powershell -NoProfile -Command "Set-Clipboard -Value '%SHARE_LINK%'" >nul 2>nul

start "" "%ADMIN_LINK%"

echo The share link has been copied to your clipboard.
echo If the admin page did not open automatically, open:
echo %ADMIN_LINK%
echo.
echo To stop the server, close the black window named:
echo Celeb Quiz Local Server
echo.
pause
