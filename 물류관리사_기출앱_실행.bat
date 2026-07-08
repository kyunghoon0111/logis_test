@echo off
chcp 65001 >nul
title 물류관리사 기출문제 앱
cd /d "%~dp0app"

rem --- Wi-Fi/이더넷 IPv4 주소 자동 검출 (PowerShell) ---
set "LANIP="
for /f "usebackq delims=" %%i in (`powershell -NoProfile -Command "(Get-NetIPAddress -AddressFamily IPv4 ^| Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } ^| Select-Object -First 1 -ExpandProperty IPAddress)"`) do set "LANIP=%%i"

echo ============================================
echo    물류관리사 기출문제 앱 서버 시작
echo ============================================
echo.
echo   이 PC:      http://localhost:8137/
if defined LANIP (
  echo   태블릿/폰:  http://%LANIP%:8137/
  echo               ^(같은 와이파이에서 접속 → 홈 화면에 추가^)
) else (
  echo   태블릿/폰:  IP 검출 실패 - 명령창에 ipconfig 입력해 IPv4 주소 확인
)
echo.
echo   (종료하려면 이 창을 닫으세요)
echo ============================================
echo.

start "" http://localhost:8137/
python -m http.server 8137
pause
