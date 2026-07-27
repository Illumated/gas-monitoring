[CmdletBinding()]
param(
    [ValidateSet("status", "normal", "zero", "warning", "alarm", "nodata")]
    [string]$Scenario = "status"
)

$ErrorActionPreference = "Stop"
$baseUrl = "http://127.0.0.1:18080"

if ($Scenario -eq "status") {
    $result = Invoke-RestMethod "$baseUrl/health"
} else {
    $result = Invoke-RestMethod -Method Post "$baseUrl/scenario/$Scenario"
    Start-Sleep -Seconds 3
    $result = Invoke-RestMethod "$baseUrl/health"
}

$names = @{
    "5380" = "O2"
    "9476" = "AIR"
    "13572" = "N2O"
}

$rows = foreach ($property in $result.registers.PSObject.Properties) {
    $raw = [int]$property.Value
    [pscustomobject]@{
        Gas = $names[$property.Name]
        Register = [int]$property.Name
        Raw = $raw
        PressureBar = if ($raw -eq 32767) { "NO DATA" } else { "{0:N1}" -f ($raw / 10) }
    }
}

Write-Host "Scenario: $($result.scenario)"
$rows | Format-Table -AutoSize
Write-Host "Dashboard: http://127.0.0.1:1880/dashboard/monitoring"
