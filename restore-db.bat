@echo off
title KovertKlaus Database Restorer
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "restore-db.ps1"
