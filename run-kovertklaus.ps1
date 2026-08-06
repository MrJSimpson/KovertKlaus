# KovertKlaus Background & One-Click Dev Server Launcher
$projectDir = "C:\Users\Joshua\projects\kovertklaus"
Set-Location $projectDir

# Check if port 3000 is already listening
$port3000 = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue

if ($port3000) {
    Write-Host ""
    Write-Host "🟢 KovertKlaus is ALREADY running!" -ForegroundColor Green
    Write-Host "👉 Local URL: http://localhost:3000" -ForegroundColor Yellow
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "🚀 Launching KovertKlaus Development Server..." -ForegroundColor Cyan
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$projectDir'; Write-Host '🎁 KovertKlaus Dev Server Active' -ForegroundColor Green; npm run dev" -WindowStyle Normal
    Write-Host "✅ Server initialized in a dedicated terminal!" -ForegroundColor Green
    Write-Host "👉 Local URL: http://localhost:3000" -ForegroundColor Yellow
    Write-Host ""
}
