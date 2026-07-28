[CmdletBinding()]
param(
    [string]$OutputDirectory,
    [string]$ProjectName = "gas-monitoring",
    [switch]$IncludeSecrets
)

$ErrorActionPreference = "Stop"

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$dockerCommand = Get-Command docker -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source
if (-not $dockerCommand) {
    $dockerCommand = Join-Path $env:LOCALAPPDATA "Programs\DockerDesktop\resources\bin\docker.exe"
}
if (-not (Test-Path -LiteralPath $dockerCommand -PathType Leaf)) {
    throw "docker.exe was not found in PATH or Docker Desktop default location"
}
Set-Alias -Name docker -Value $dockerCommand -Scope Script

if (-not $OutputDirectory) {
    $timestamp = (Get-Date).ToUniversalTime().ToString("yyyyMMddTHHmmssZ")
    $OutputDirectory = Join-Path $repositoryRoot "backups\$timestamp"
}

$backupPath = [System.IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Path $backupPath -Force | Out-Null

$image = "gas-monitoring-node-red:0.1.0"
$volumeMap = [ordered]@{
    "node-red-data" = "$ProjectName`_node-red-data"
    "influxdb-data" = "$ProjectName`_influxdb-data"
    "influxdb-config" = "$ProjectName`_influxdb-config"
    "auth-data" = "$ProjectName`_auth-data"
}

foreach ($entry in $volumeMap.GetEnumerator()) {
    $volume = $entry.Value
    docker volume inspect $volume *> $null
    if ($LASTEXITCODE -ne 0) {
        throw "Docker volume does not exist: $volume"
    }

    $archive = "$($entry.Key).tar.gz"
    $tarCommand = if ($entry.Key -eq "node-red-data") {
        "cd /source && tar --exclude='./.npm' -czf /backup/$archive ."
    } else {
        "cd /source && tar czf /backup/$archive ."
    }

    docker run --rm `
        --volume "${volume}:/source:ro" `
        --volume "${backupPath}:/backup" `
        --entrypoint sh `
        $image `
        -c $tarCommand

    if ($LASTEXITCODE -ne 0) {
        throw "Failed to back up volume: $volume"
    }
}

$gitCommit = git -c "safe.directory=$repositoryRoot" -C $repositoryRoot rev-parse HEAD
$manifest = [ordered]@{
    created_utc = (Get-Date).ToUniversalTime().ToString("o")
    git_commit = $gitCommit
    project_name = $ProjectName
    archives = @()
}

foreach ($archive in Get-ChildItem -LiteralPath $backupPath -Filter "*.tar.gz") {
    $manifest.archives += [ordered]@{
        name = $archive.Name
        bytes = $archive.Length
        sha256 = (Get-FileHash -LiteralPath $archive.FullName -Algorithm SHA256).Hash
    }
}

if ($IncludeSecrets) {
    $envFile = Join-Path $repositoryRoot ".env"
    if (-not (Test-Path -LiteralPath $envFile)) {
        throw "Cannot include secrets because .env does not exist"
    }
    Copy-Item -LiteralPath $envFile -Destination (Join-Path $backupPath ".env")
    $manifest.secrets_included = $true
} else {
    $manifest.secrets_included = $false
}

$manifest | ConvertTo-Json -Depth 5 |
    Set-Content -LiteralPath (Join-Path $backupPath "manifest.json") -Encoding utf8NoBOM

Write-Host "Backup created: $backupPath"
