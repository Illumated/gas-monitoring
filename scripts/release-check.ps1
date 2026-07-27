[CmdletBinding()]
param(
    [switch]$SkipDocker,
    [switch]$SkipDependencyAudit,
    [string]$EvidencePath
)

$ErrorActionPreference = "Stop"
$repositoryRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repositoryRoot
$dockerCommand = Get-Command docker -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source
if (-not $dockerCommand) {
    $dockerCommand = Join-Path $env:LOCALAPPDATA "Programs\DockerDesktop\resources\bin\docker.exe"
}
if (-not $SkipDocker -and -not (Test-Path -LiteralPath $dockerCommand -PathType Leaf)) {
    throw "docker.exe was not found in PATH or Docker Desktop default location"
}
if (Test-Path -LiteralPath $dockerCommand -PathType Leaf) {
    Set-Alias -Name docker -Value $dockerCommand -Scope Script
}

if (-not $EvidencePath) {
    $stamp = (Get-Date).ToUniversalTime().ToString("yyyyMMddTHHmmssZ")
    $EvidencePath = Join-Path $repositoryRoot "commissioning-evidence\release-check-$stamp.json"
}
$evidenceDirectory = Split-Path -Parent ([System.IO.Path]::GetFullPath($EvidencePath))
New-Item -ItemType Directory -Path $evidenceDirectory -Force | Out-Null

$results = [System.Collections.Generic.List[object]]::new()

function Invoke-ReleaseStep {
    param([string]$Name, [scriptblock]$Action)
    $started = Get-Date
    try {
        $global:LASTEXITCODE = 0
        & $Action
        if ($LASTEXITCODE -ne 0) {
            throw "Command exit code: $LASTEXITCODE"
        }
        $results.Add([ordered]@{
            name = $Name
            status = "PASS"
            duration_seconds = [math]::Round(((Get-Date) - $started).TotalSeconds, 2)
        })
    } catch {
        $results.Add([ordered]@{
            name = $Name
            status = "FAIL"
            duration_seconds = [math]::Round(((Get-Date) - $started).TotalSeconds, 2)
            error = $_.Exception.Message
        })
        throw
    }
}

try {
    Invoke-ReleaseStep "npm-tests" { npm test }
    Invoke-ReleaseStep "flow-audit" { npm run audit:flow }
    Invoke-ReleaseStep "secret-scan" { node scripts/secret-scan.mjs }
    Invoke-ReleaseStep "storage-capacity" { node scripts/storage-capacity.mjs }
    Invoke-ReleaseStep "git-diff-check" { git -c "safe.directory=$repositoryRoot" diff --check }

    if (-not $SkipDependencyAudit) {
        Invoke-ReleaseStep "dependency-audit-critical" { npm audit --omit=dev --audit-level=critical }
    }

    $previousAdminHash = $env:NODE_RED_ADMIN_PASSWORD_HASH
    $previousServiceCode = $env:SERVICE_ACCESS_CODE
    try {
        $env:NODE_RED_ADMIN_PASSWORD_HASH = '$2b$12$releasecheckonly000000000000000000000000000000000000000'
        $env:SERVICE_ACCESS_CODE = "release-check-only"
        Invoke-ReleaseStep "compose-base" { docker compose --env-file .env -f docker/compose.yaml config --quiet }
        Invoke-ReleaseStep "compose-fat" { docker compose --profile fat --env-file .env -f docker/compose.yaml -f docker/compose.fat.yaml config --quiet }
        Invoke-ReleaseStep "compose-production" { docker compose --env-file .env -f docker/compose.yaml -f docker/compose.production.yaml config --quiet }
    } finally {
        $env:NODE_RED_ADMIN_PASSWORD_HASH = $previousAdminHash
        $env:SERVICE_ACCESS_CODE = $previousServiceCode
    }

    if (-not $SkipDocker) {
        Invoke-ReleaseStep "image-present" { docker image inspect gas-monitoring-node-red:0.1.0 | Out-Null }
        Invoke-ReleaseStep "image-sbom-and-audit" {
            if ($SkipDependencyAudit) {
                & "$PSScriptRoot\audit-image.ps1" -OutputDirectory (Join-Path $evidenceDirectory "image-audit") -SkipNpmAudit
            } else {
                & "$PSScriptRoot\audit-image.ps1" -OutputDirectory (Join-Path $evidenceDirectory "image-audit")
            }
        }
        Invoke-ReleaseStep "debian-13-shell" {
            docker run --rm --volume "${repositoryRoot}:/repo:ro" debian:13-slim `
                bash -c "set -e; grep -q '^VERSION_ID=.13' /etc/os-release; bash -n /repo/deploy/debian/*.sh /repo/scripts/*.sh"
        }
    }
} finally {
    $failed = @($results | Where-Object status -eq "FAIL").Count
    [ordered]@{
        generated_utc = (Get-Date).ToUniversalTime().ToString("o")
        git_commit = git -c "safe.directory=$repositoryRoot" rev-parse HEAD
        result = if ($failed) { "FAIL" } else { "PASS" }
        endurance_24h = "NOT_RUN_BY_DECISION"
        steps = $results
    } | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $EvidencePath -Encoding utf8NoBOM
    Write-Host "Evidence: $EvidencePath"
}

Write-Host "Release readiness checks passed (24-hour endurance intentionally not run)."
