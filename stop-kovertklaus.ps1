# KovertKlaus Dev Server Shutdown Script
$projectDir = "C:\Users\Joshua\projects\kovertklaus"
Set-Location $projectDir

# Find processes listening on port 3000
$connections = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue

if ($connections) {
    $pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($procId in $pids) {
        try {
            Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
        } catch {
            # Process already stopped
        }
    }
    Write-Host ""
    Write-Host "🛑 KovertKlaus server running on port 3000 has been SHUT DOWN!" -ForegroundColor Red
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "ℹ️ No active KovertKlaus process found running on port 3000." -ForegroundColor Yellow
    Write-Host ""
}
