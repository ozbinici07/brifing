@echo off
setlocal
cd /d "%~dp0"
py -3 "%~dp0scripts\baslat.py"
if errorlevel 1 pause
