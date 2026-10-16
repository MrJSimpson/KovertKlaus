# Restore the KovertKlaus PostgreSQL container database from backups/.
# This REPLACES everything in the container database. To try the app with sample data instead,
# use `npm run demo:load` (docs/DEMO_DATABASE.md).
#
# Reads backups/kovertklaus-backup.dump (written by export-db). An older plain-SQL backup
# (backups/kovertklaus-backup.sql) is still accepted. Either file is copied into the container with
# `docker cp`, never piped through PowerShell, so emoji and accented text are kept byte for byte.
Set-Location -Path $PSScriptRoot

$dumpPath = "$PSScriptRoot\backups\kovertklaus-backup.dump"
$legacySqlPath = "$PSScriptRoot\backups\kovertklaus-backup.sql"

if (Test-Path $dumpPath) {
    $sourcePath = $dumpPath
    $isArchive = $true
} elseif (Test-Path $legacySqlPath) {
    $sourcePath = $legacySqlPath
    $isArchive = $false
} else {
    Write-Host ""
    Write-Host "[-] No backup found in backups/. Run export-db.bat first." -ForegroundColor Red
    Write-Host ""
    exit 1
}

$fileName = Split-Path -Leaf $sourcePath
$containerPath = "/tmp/$fileName"

Write-Host ""
Write-Host "[*] Restoring the KovertKlaus database from backups/$fileName..." -ForegroundColor Cyan

& docker cp $sourcePath "kovertklaus-db:$containerPath"
if ($LASTEXITCODE -ne 0) {
    Write-Host "[-] Could not copy the backup into the container. Ensure Docker container kovertklaus-db is running." -ForegroundColor Red
    Write-Host ""
    exit 1
}

& docker exec kovertklaus-db psql -U kovert -d kovertklaus -v ON_ERROR_STOP=1 -c "DROP SCHEMA IF EXISTS app CASCADE; DROP SCHEMA IF EXISTS admin CASCADE; DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
if ($isArchive) {
    & docker exec kovertklaus-db pg_restore -U kovert -d kovertklaus --exit-on-error $containerPath
} else {
    & docker exec kovertklaus-db psql -U kovert -d kovertklaus -v ON_ERROR_STOP=1 -f $containerPath
}
$restored = $LASTEXITCODE
& docker exec kovertklaus-db rm -f $containerPath | Out-Null

if ($restored -eq 0) {
    Write-Host "[+] Database restored from backups/$fileName." -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host "[-] Database restore failed. See the errors above." -ForegroundColor Red
    Write-Host ""
    exit 1
}
