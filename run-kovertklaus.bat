@echo off
title KovertKlaus Dev Server Launcher
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File "%~dp0run-kovertklaus.ps1"
