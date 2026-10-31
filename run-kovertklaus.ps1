# KovertKlaus Background & One-Click Dev Server Launcher
$projectDir = "C:\Users\Joshua\projects\kovertklaus"
Set-Location $projectDir

# Check if port 2425 is already listening
$port2425 = Get-NetTCPConnection -LocalPort 2425 -ErrorAction SilentlyContinue

if ($port2425) {
    Write-Host ""
    Write-Host "🟢 KovertKlaus is ALREADY running!" -ForegroundColor Green
    Write-Host "👉 Local URL: http://localhost:2425" -ForegroundColor Yellow
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "🚀 Launching KovertKlaus Development Server..." -ForegroundColor Cyan
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$projectDir'; Write-Host '🎁 KovertKlaus Dev Server Active' -ForegroundColor Green; npm run dev" -WindowStyle Normal
    Write-Host "✅ Server initialized in a dedicated terminal!" -ForegroundColor Green
    Write-Host "👉 Local URL: http://localhost:2425" -ForegroundColor Yellow
    Write-Host ""
}
