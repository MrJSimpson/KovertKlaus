# Back up the KovertKlaus PostgreSQL container database to backups/ (gitignored: it holds real data).
Set-Location -Path $PSScriptRoot

$backupDir = "$PSScriptRoot\backups"
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
$backupPath = "$backupDir\kovertklaus-backup.sql"

Write-Host ""
Write-Host "[*] Backing up the KovertKlaus database..." -ForegroundColor Cyan

& docker exec kovertklaus-db pg_dump -U kovert kovertklaus | Out-File -FilePath $backupPath -Encoding ascii

if ($LASTEXITCODE -eq 0) {
    Write-Host "[+] Backup written to backups/kovertklaus-backup.sql (never commit it)." -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host "[-] Backup failed. Ensure Docker container kovertklaus-db is running." -ForegroundColor Red
    Write-Host ""
}
