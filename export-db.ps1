# Export KovertKlaus PostgreSQL Test Database
Set-Location -Path $PSScriptRoot

Write-Host ""
Write-Host "[*] Exporting KovertKlaus PostgreSQL Test Database..." -ForegroundColor Cyan

& docker exec kovertklaus-db pg_dump -U kovert kovertklaus | Out-File -FilePath "$PSScriptRoot\prisma\kovertklaus_test_db.sql" -Encoding ascii

if ($LASTEXITCODE -eq 0) {
    Write-Host "[+] Test database successfully exported to prisma/kovertklaus_test_db.sql!" -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host "[-] Database export failed. Ensure Docker container kovertklaus-db is running." -ForegroundColor Red
    Write-Host ""
}
