@echo off
title KovertKlaus Server Shutdown
cd /d "C:\Users\Joshua\projects\kovertklaus"
powershell -ExecutionPolicy Bypass -File "C:\Users\Joshua\projects\kovertklaus\stop-kovertklaus.ps1"
