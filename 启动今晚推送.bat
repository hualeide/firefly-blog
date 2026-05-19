@echo off
cd /d "%~dp0"
echo 窗口请保持打开，电脑勿休眠。日志见 push-log.txt
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0今晚自动推送.ps1"
pause
