# Restore the KovertKlaus PostgreSQL container database from backups/kovertklaus-backup.sql.
# This REPLACES everything in the container database. To try the app with sample data instead,
# use `npm run demo:load` (docs/DEMO_DATABASE.md).
Set-Location -Path $PSScriptRoot

Write-Host ""
Write-Host "[*] Restoring the KovertKlaus database from backups/kovertklaus-backup.sql..." -ForegroundColor Cyan

$dumpPath = "$PSScriptRoot\backups\kovertklaus-backup.sql"

if (-not (Test-Path $dumpPath)) {
    Write-Host "[-] backups/kovertklaus-backup.sql not found. Run export-db.bat first." -ForegroundColor Red
    Write-Host ""
    exit 1
}

& docker exec -i kovertklaus-db psql -U kovert -d kovertklaus -c "DROP SCHEMA IF EXISTS app CASCADE; DROP SCHEMA IF EXISTS admin CASCADE; DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
Get-Content $dumpPath | & docker exec -i kovertklaus-db psql -U kovert -d kovertklaus

if ($LASTEXITCODE -eq 0) {
    Write-Host "[+] Database restored from backups/kovertklaus-backup.sql." -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host "[-] Database restore failed. Ensure Docker container kovertklaus-db is running." -ForegroundColor Red
    Write-Host ""
}
