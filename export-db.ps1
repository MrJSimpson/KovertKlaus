# Back up the KovertKlaus PostgreSQL container database to backups/ (gitignored: it holds real data).
#
# Writes a pg_dump custom-format archive (backups/kovertklaus-backup.dump). The archive is copied out
# of the container with `docker cp`, never piped through PowerShell, so emoji and accented text are
# kept byte for byte. The previous backup is kept as backups/kovertklaus-backup.prev.dump.
Set-Location -Path $PSScriptRoot

$backupDir = "$PSScriptRoot\backups"
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
$backupPath = "$backupDir\kovertklaus-backup.dump"
$previousPath = "$backupDir\kovertklaus-backup.prev.dump"
$containerPath = "/tmp/kovertklaus-backup.dump"

Write-Host ""
Write-Host "[*] Backing up the KovertKlaus database..." -ForegroundColor Cyan

& docker exec kovertklaus-db pg_dump -U kovert -d kovertklaus -Fc -f $containerPath
if ($LASTEXITCODE -ne 0) {
    Write-Host "[-] Backup failed. Ensure Docker container kovertklaus-db is running." -ForegroundColor Red
    Write-Host ""
    exit 1
}

if (Test-Path $backupPath) {
    Move-Item -Force -Path $backupPath -Destination $previousPath
}

& docker cp "kovertklaus-db:$containerPath" $backupPath
$copied = $LASTEXITCODE
& docker exec kovertklaus-db rm -f $containerPath | Out-Null

if ($copied -eq 0) {
    Write-Host "[+] Backup written to backups/kovertklaus-backup.dump (never commit it)." -ForegroundColor Green
    if (Test-Path $previousPath) {
        Write-Host "    Previous backup kept as backups/kovertklaus-backup.prev.dump." -ForegroundColor Gray
    }
    Write-Host ""
} else {
    Write-Host "[-] Could not copy the backup out of the container." -ForegroundColor Red
    Write-Host ""
    exit 1
}
