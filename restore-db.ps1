# Restore KovertKlaus PostgreSQL Test Database
Set-Location -Path $PSScriptRoot

Write-Host ""
Write-Host "[*] Restoring KovertKlaus PostgreSQL Test Database from SQL Dump..." -ForegroundColor Cyan

$dumpPath = "$PSScriptRoot\prisma\kovertklaus_test_db.sql"

if (-not (Test-Path $dumpPath)) {
    Write-Host "[-] Dump file prisma/kovertklaus_test_db.sql not found!" -ForegroundColor Red
    Write-Host ""
    exit 1
}

& docker exec -i kovertklaus-db psql -U kovert -d kovertklaus -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
Get-Content $dumpPath | & docker exec -i kovertklaus-db psql -U kovert -d kovertklaus

if ($LASTEXITCODE -eq 0) {
    Write-Host "[+] Test database successfully restored from prisma/kovertklaus_test_db.sql!" -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host "[-] Database restore failed. Ensure Docker container kovertklaus-db is running." -ForegroundColor Red
    Write-Host ""
}
