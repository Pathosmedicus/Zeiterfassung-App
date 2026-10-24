# PowerShell Test Runner für Zeiterfassung Radiologie
# (unit-test-generator Skill)

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "   UNIT TEST RUNNER - ZEITERFASSUNG RADIOLOGIE" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

$script:passedCount = 0
$script:failedCount = 0

function Assert-Test([string]$testName, [scriptblock]$condition) {
    try {
        $result = & $condition
        if ($result -eq $true) {
            Write-Host " [PASS] $testName" -ForegroundColor Green
            $script:passedCount++
        } else {
            Write-Host " [FAIL] $testName - Bedingung ergab false" -ForegroundColor Red
            $script:failedCount++
        }
    } catch {
        Write-Host " [FAIL] $testName - Ausnahme: $($_.Exception.Message)" -ForegroundColor Red
        $script:failedCount++
    }
}

function Berechne-Netto([string]$s, [string]$e, [int]$p) {
    if (-not $s -or -not $e) { return 0 }
    $sParts = $s.Split(':')
    $eParts = $e.Split(':')
    $startMin = [int]$sParts[0] * 60 + [int]$sParts[1]
    $endMin = [int]$eParts[0] * 60 + [int]$eParts[1]
    if ($endMin -eq $startMin) { return 0 }
    if ($endMin -lt $startMin) { $endMin += 24 * 60 }
    $nettoMin = [Math]::Max(0, ($endMin - $startMin) - $p)
    return [Math]::Round(($nettoMin / 60.0), 2)
}

function Get-EasterSunday([int]$jahr) {
    $a = $jahr % 19
    $b = [Math]::Floor($jahr / 100)
    $c = $jahr % 100
    $d = [Math]::Floor($b / 4)
    $e = $b % 4
    $f = [Math]::Floor(($b + 8) / 25)
    $g = [Math]::Floor(($b - $f + 1) / 3)
    $h = (19 * $a + $b - $d - $g + 15) % 30
    $i = [Math]::Floor($c / 4)
    $k = $c % 4
    $l = (32 + 2 * $e + 2 * $i - $h - $k) % 7
    $m = [Math]::Floor(($a + 11 * $h + 22 * $l) / 451)
    $month = [Math]::Floor(($h + $l - 7 * $m + 114) / 31)
    $day = (($h + $l - 7 * $m + 114) % 31) + 1
    return (Get-Date -Year $jahr -Month $month -Day $day).ToString("yyyy-MM-dd")
}

# Testgruppe 1
Write-Host "`n--- Testgruppe 1: Arbeitszeitberechnung ---" -ForegroundColor Yellow
Assert-Test "Normaler Fruehdienst (07:30 - 16:00 mit 30m Pause) = 8.00h" {
    (Berechne-Netto "07:30" "16:00" 30) -eq 8.00
}

Assert-Test "Nachtdienst ueber Mitternacht (20:00 - 08:00 mit 60m Pause) = 11.00h" {
    (Berechne-Netto "20:00" "08:00" 60) -eq 11.00
}

Assert-Test "Grenzfall: Gleiche Zeit 08:00 bis 08:00 ergibt 0h (Bug behoben)" {
    (Berechne-Netto "08:00" "08:00" 30) -eq 0.00
}

Assert-Test "Pause groesser als Dienst (10:00 - 11:00 mit 120m Pause) ergibt 0h" {
    (Berechne-Netto "10:00" "11:00" 120) -eq 0.00
}

# Testgruppe 2
Write-Host "`n--- Testgruppe 2: Gesetzliche Feiertage ---" -ForegroundColor Yellow
Assert-Test "Ostersonntag 2026 ist 2026-04-05" {
    (Get-EasterSunday 2026) -eq "2026-04-05"
}

Assert-Test "Ostersonntag 2025 ist 2025-04-20" {
    (Get-EasterSunday 2025) -eq "2025-04-20"
}

Write-Host "`n==================================================" -ForegroundColor Cyan
if ($script:failedCount -eq 0) {
    Write-Host "   [SUCCESS] Alle $($script:passedCount) Tests erfolgreich bestanden!" -ForegroundColor Green
} else {
    Write-Host "   [FAILED] $($script:failedCount) Tests fehlgeschlagen!" -ForegroundColor Red
}
Write-Host "==================================================" -ForegroundColor Cyan
