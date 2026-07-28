[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$BackupDirectory,

    [Parameter(Mandatory)]
    [ValidatePattern("^[a-z0-9][a-z0-9_-]+$")]
    [string]$TargetProjectName,

    [switch]$ReplaceExisting
)

$ErrorActionPreference = "Stop"

$dockerCommand = Get-Command docker -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source
if (-not $dockerCommand) {
    $dockerCommand = Join-Path $env:LOCALAPPDATA "Programs\DockerDesktop\resources\bin\docker.exe"
}
if (-not (Test-Path -LiteralPath $dockerCommand -PathType Leaf)) {
    throw "docker.exe was not found in PATH or Docker Desktop default location"
}
Set-Alias -Name docker -Value $dockerCommand -Scope Script

$backupPath = [System.IO.Path]::GetFullPath($BackupDirectory)
if (-not (Test-Path -LiteralPath $backupPath -PathType Container)) {
    throw "Backup directory does not exist: $backupPath"
}

$manifestPath = Join-Path $backupPath "manifest.json"
if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
    throw "Backup manifest does not exist: $manifestPath"
}

$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
$image = "gas-monitoring-node-red:0.1.0"
$archives = @("node-red-data", "influxdb-data", "influxdb-config", "auth-data")

foreach ($name in $archives) {
    $archivePath = Join-Path $backupPath "$name.tar.gz"
    if (-not (Test-Path -LiteralPath $archivePath -PathType Leaf)) {
        throw "Backup archive does not exist: $archivePath"
    }

    $expected = $manifest.archives |
        Where-Object { $_.name -eq "$name.tar.gz" } |
        Select-Object -ExpandProperty sha256
    $actual = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash
    if (-not $expected -or $actual -ne $expected) {
        throw "Checksum mismatch: $archivePath"
    }
}

foreach ($name in $archives) {
    $volume = "$TargetProjectName`_$name"
    docker volume inspect $volume *> $null
    $exists = $LASTEXITCODE -eq 0

    if ($exists -and -not $ReplaceExisting) {
        throw "Target volume already exists: $volume. Choose another project name or use -ReplaceExisting."
    }

    if ($exists) {
        docker volume rm $volume | Out-Null
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to remove target volume: $volume"
        }
    }

    docker volume create $volume | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to create target volume: $volume"
    }

    $archive = "$name.tar.gz"
    docker run --rm `
        --user "0:0" `
        --volume "${volume}:/target" `
        --volume "${backupPath}:/backup:ro" `
        --entrypoint sh `
        $image `
        -c "tar xzf /backup/$archive -C /target"

    if ($LASTEXITCODE -ne 0) {
        throw "Failed to restore archive: $archive"
    }
}

Write-Host "Restore completed into volumes with prefix: $TargetProjectName"
