# API Integrator Test Script
# (api-integrator Skill)

$url = "https://feiertage-api.de/api/?jahr=2026&nur_land=NW"
Write-Host "Teste API-Endpunkt: $url ..." -ForegroundColor Cyan

try {
    $response = Invoke-RestMethod -Uri $url -Method Get -TimeoutSec 10
    Write-Host "[OK] HTTP 200 OK erhalten!" -ForegroundColor Green
    
    $props = $response | Get-Member -MemberType NoteProperty | Select-Object -ExpandProperty Name
    Write-Host "`nErkannte Feiertage für 2026 (NRW):" -ForegroundColor Yellow
    foreach ($p in $props) {
        $datum = $response.$p.datum
        $hinweis = $response.$p.hinweis
        Write-Host " - $p : $datum ($hinweis)" -ForegroundColor White
    }
} catch {
    Write-Host "[HINWEIS] Externer API-Call fehlgeschlagen: $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host "Fallback auf Offline-Berechnung (Gauß) bleibt aktiv." -ForegroundColor White
}
