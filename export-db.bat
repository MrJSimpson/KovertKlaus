@echo off
title KovertKlaus Database Exporter
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "export-db.ps1"
