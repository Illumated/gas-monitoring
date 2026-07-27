[CmdletBinding()]
param(
    [ValidateRange(1, 1440)]
    [int]$EnduranceMinutes = 1,
    [string]$EvidenceDirectory = "commissioning-evidence",
    [string]$DockerPath
)

$ErrorActionPreference = "Stop"
$repository = Split-Path -Parent $PSScriptRoot
$compose = @(
    "compose", "--profile", "fat", "--env-file", (Join-Path $repository ".env"),
    "-f", (Join-Path $repository "docker\compose.yaml"),
    "-f", (Join-Path $repository "docker\compose.fat.yaml")
)
if (-not $DockerPath) {
    $candidate = Join-Path $env:LOCALAPPDATA "Programs\DockerDesktop\resources\bin\docker.exe"
    $DockerPath = if (Test-Path -LiteralPath $candidate) { $candidate } else { (Get-Command docker).Source }
}

$results = [System.Collections.Generic.List[object]]::new()
function Add-Result([string]$Name, [bool]$Passed, [string]$Details) {
    $script:results.Add([ordered]@{ name = $Name; passed = $Passed; details = $Details })
    if (-not $Passed) { throw "$Name failed: $Details" }
}
function Invoke-Docker([string[]]$Arguments) {
    $output = & $DockerPath @Arguments 2>&1
    if ($LASTEXITCODE -ne 0) { throw ($output -join [Environment]::NewLine) }
    return $output
}
function Wait-Healthy([string]$Container, [int]$TimeoutSeconds = 90) {
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    do {
        $status = (& $DockerPath inspect --format "{{.State.Health.Status}}" $Container 2>$null)
        if ($LASTEXITCODE -eq 0 -and $status -eq "healthy") { return }
        Start-Sleep -Seconds 2
    } while ((Get-Date) -lt $deadline)
    throw "$Container did not become healthy"
}
function Set-Scenario([string]$Name) {
    Invoke-RestMethod -Method Post "http://127.0.0.1:18080/scenario/$Name" | Out-Null
    Start-Sleep -Seconds 4
}
function Get-MaxMessages {
    return @((Invoke-RestMethod "http://127.0.0.1:18081/messages").messages)
}

$stamp = (Get-Date).ToUniversalTime().ToString("yyyyMMddTHHmmssZ")
$evidencePath = Join-Path (Join-Path $repository $EvidenceDirectory) "software-fat-$stamp.json"
$started = (Get-Date).ToUniversalTime()
$failureMessage = $null

try {
    Wait-Healthy "gas-monitoring-node-red-1"
    Wait-Healthy "gas-monitoring-influxdb-1"
    Wait-Healthy "gas-monitoring-modbus-simulator-1"
    Wait-Healthy "gas-monitoring-max-mock-1"
    Add-Result "initial-health" $true "all FAT services healthy"

    Invoke-RestMethod -Method Delete "http://127.0.0.1:18081/messages" | Out-Null
    Set-Scenario "normal"
    Invoke-RestMethod -Method Post "http://127.0.0.1:18081/fail/2" | Out-Null
    Set-Scenario "alarm"
    Start-Sleep -Seconds 12
    $delivered = Get-MaxMessages
    Add-Result "max-retry" ($delivered.Count -eq 3) "accepted messages=$($delivered.Count) after two planned HTTP 500 responses"

    Set-Scenario "normal"
    Invoke-RestMethod -Method Delete "http://127.0.0.1:18081/messages" | Out-Null
    Invoke-Docker @($compose + @("pause", "modbus-simulator")) | Out-Null
    Start-Sleep -Seconds 7
    Invoke-Docker @($compose + @("unpause", "modbus-simulator")) | Out-Null
    Start-Sleep -Seconds 8
    $reconnectMessages = Get-MaxMessages
    $nodata = @($reconnectMessages | Where-Object { $_.payload.text -match "→ НЕТ ДАННЫХ" }).Count
    $recoveries = @($reconnectMessages | Where-Object { $_.payload.text -match "НЕТ ДАННЫХ → НОРМА" }).Count
    Add-Result "modbus-reconnect" ($nodata -ge 3 -and $recoveries -eq 3) "nodata messages=$nodata, recoveries=$recoveries"

    Invoke-Docker @($compose + @("stop", "influxdb")) | Out-Null
    Set-Scenario "warning"
    Start-Sleep -Seconds 3
    Invoke-Docker @($compose + @("start", "influxdb")) | Out-Null
    Wait-Healthy "gas-monitoring-influxdb-1"
    Set-Scenario "normal"
    Start-Sleep -Seconds 5
    Add-Result "influx-recovery" $true "InfluxDB stopped, restarted and became healthy"

    Invoke-RestMethod -Method Delete "http://127.0.0.1:18081/messages" | Out-Null
    Invoke-Docker @($compose + @("restart", "node-red")) | Out-Null
    Wait-Healthy "gas-monitoring-node-red-1"
    Start-Sleep -Seconds 8
    $startupMessages = Get-MaxMessages
    Add-Result "restart-anti-spam" ($startupMessages.Count -eq 0) "messages after healthy restart=$($startupMessages.Count)"

    $deadline = (Get-Date).AddMinutes($EnduranceMinutes)
    $checks = 0
    do {
        $simulator = Invoke-RestMethod "http://127.0.0.1:18080/health"
        $max = Invoke-RestMethod "http://127.0.0.1:18081/health"
        if ($simulator.status -ne "pass" -or $max.status -ne "pass") { throw "FAT service health failed during endurance" }
        $checks += 1
        Start-Sleep -Seconds 5
    } while ((Get-Date) -lt $deadline)
    Add-Result "endurance" $true "$checks health cycles over $EnduranceMinutes minute(s)"
} catch {
    $failureMessage = $_.Exception.Message
    throw
} finally {
    try { Invoke-Docker @($compose + @("unpause", "modbus-simulator")) | Out-Null } catch {}
    try { Invoke-Docker @($compose + @("start", "influxdb")) | Out-Null } catch {}
    try { Set-Scenario "normal" } catch {}
    $completed = (Get-Date).ToUniversalTime()
    $evidence = [ordered]@{
        schemaVersion = 1
        startedUtc = $started.ToString("o")
        completedUtc = $completed.ToString("o")
        durationSeconds = [math]::Round(($completed - $started).TotalSeconds, 1)
        result = if (-not $failureMessage -and $results.Count -gt 0 -and @($results | Where-Object { -not $_.passed }).Count -eq 0) { "PASS" } else { "FAIL" }
        failure = $failureMessage
        results = $results
    }
    New-Item -ItemType Directory -Path (Split-Path -Parent $evidencePath) -Force | Out-Null
    $evidence | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $evidencePath -Encoding utf8NoBOM
    Write-Host "Evidence: $evidencePath"
}
