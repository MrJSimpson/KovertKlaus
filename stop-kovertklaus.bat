@echo off
title KovertKlaus Server Shutdown
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File "%~dp0stop-kovertklaus.ps1"
