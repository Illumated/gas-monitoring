[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [ValidateSet("start", "status", "normal", "zero", "warning", "alarm", "nodata", "stop")]
    [string]$Action = "start",
    [string]$DockerPath
)

$ErrorActionPreference = "Stop"
$repository = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $repository ".env"

if (-not (Test-Path -LiteralPath $envFile -PathType Leaf)) {
    throw "Create $envFile from .env.example before starting the simulator"
}

if (-not $DockerPath) {
    $candidate = Join-Path $env:LOCALAPPDATA "Programs\DockerDesktop\resources\bin\docker.exe"
    $DockerPath = if (Test-Path -LiteralPath $candidate -PathType Leaf) {
        $candidate
    } else {
        (Get-Command docker -ErrorAction Stop).Source
    }
}

$compose = @(
    "compose", "--profile", "fat", "--env-file", $envFile,
    "-f", (Join-Path $repository "docker\compose.yaml"),
    "-f", (Join-Path $repository "docker\compose.fat.yaml")
)

function Invoke-Docker([string[]]$Arguments) {
    & $DockerPath @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Docker command failed with exit code $LASTEXITCODE"
    }
}

function Wait-Healthy([string]$Container, [int]$TimeoutSeconds = 90) {
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    do {
        $status = & $DockerPath inspect --format "{{.State.Health.Status}}" $Container 2>$null
        if ($LASTEXITCODE -eq 0 -and $status -eq "healthy") {
            return
        }
        Start-Sleep -Seconds 2
    } while ((Get-Date) -lt $deadline)
    throw "$Container did not become healthy within $TimeoutSeconds seconds"
}

switch ($Action) {
    "start" {
        Invoke-Docker @($compose + @("up", "-d", "--build"))
        foreach ($container in @(
            "gas-monitoring-influxdb-1",
            "gas-monitoring-modbus-simulator-1",
            "gas-monitoring-max-mock-1",
            "gas-monitoring-node-red-1"
        )) {
            Wait-Healthy $container
        }
        & (Join-Path $PSScriptRoot "fat.ps1") -Scenario normal
        Write-Host "Simulation is ready."
    }
    "stop" {
        Invoke-Docker @($compose + @("down", "--remove-orphans"))
        Write-Host "Simulation stopped. Persistent volumes were preserved."
    }
    "status" {
        Invoke-Docker @($compose + @("ps"))
        & (Join-Path $PSScriptRoot "fat.ps1") -Scenario status
    }
    default {
        & (Join-Path $PSScriptRoot "fat.ps1") -Scenario $Action
    }
}
