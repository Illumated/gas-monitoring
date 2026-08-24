[CmdletBinding()]
param(
    [string]$OutputDirectory,
    [switch]$SkipNpmAudit
)

$ErrorActionPreference = "Stop"
$repositoryRoot = Split-Path -Parent $PSScriptRoot
if (-not $OutputDirectory) {
    $OutputDirectory = Join-Path $repositoryRoot "commissioning-evidence\image-audit"
}
$outputPath = [System.IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Path $outputPath -Force | Out-Null

function Write-Utf8NoBom {
    param([string]$Path, [object]$Value)
    $text = if ($Value -is [array]) { $Value -join "`n" } else { [string]$Value }
    $utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText([System.IO.Path]::GetFullPath($Path), "$text`n", $utf8WithoutBom)
}

$dockerCommand = Get-Command docker -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source
if (-not $dockerCommand) {
    $dockerCommand = Join-Path $env:LOCALAPPDATA "Programs\DockerDesktop\resources\bin\docker.exe"
}
if (-not (Test-Path -LiteralPath $dockerCommand -PathType Leaf)) {
    throw "docker.exe was not found in PATH or Docker Desktop default location"
}

$image = "gas-monitoring-node-red:0.1.0"
$inspect = & $dockerCommand image inspect $image | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) {
    throw "Image is not available: $image"
}

$sbomPath = Join-Path $outputPath "gas-monitoring-node-red.cdx.json"
$sbomRaw = & $dockerCommand run --rm --entrypoint npm $image sbom --sbom-format cyclonedx
$sbomExit = $LASTEXITCODE
Write-Utf8NoBom -Path $sbomPath -Value $sbomRaw
if ($sbomExit -ne 0) {
    throw "Local CycloneDX generation failed"
}

$apkPath = Join-Path $outputPath "gas-monitoring-node-red.apk.txt"
$apkRaw = & $dockerCommand run --rm --entrypoint awk $image `
    '/^P:/{package=substr($0,3)} /^V:/{print package "-" substr($0,3)}' `
    /lib/apk/db/installed | Sort-Object
$apkExit = $LASTEXITCODE
Write-Utf8NoBom -Path $apkPath -Value $apkRaw
if ($apkExit -ne 0) {
    throw "Alpine package inventory failed"
}

$vulnerabilities = $null
if (-not $SkipNpmAudit) {
    $auditPath = Join-Path $outputPath "gas-monitoring-node-red.npm-audit.json"
    $rawAudit = & $dockerCommand run --rm --entrypoint npm $image audit --omit=dev --json 2>$null
    $auditExit = $LASTEXITCODE
    Write-Utf8NoBom -Path $auditPath -Value $rawAudit
    $audit = ($rawAudit -join "`n") | ConvertFrom-Json
    $vulnerabilities = $audit.metadata.vulnerabilities
    if ($auditExit -ne 0 -and [int]$vulnerabilities.critical -eq 0) {
        Write-Warning "Image npm audit found non-critical vulnerabilities; see $auditPath"
    }
    if ([int]$vulnerabilities.critical -gt 0) {
        throw "Image contains $($vulnerabilities.critical) critical npm vulnerabilities"
    }
}

$sbom = Get-Content -LiteralPath $sbomPath -Raw | ConvertFrom-Json
$summary = [ordered]@{
    generated_utc = (Get-Date).ToUniversalTime().ToString("o")
    image = $image
    image_id = $inspect[0].Id
    repo_digests = @($inspect[0].RepoDigests)
    cyclonedx_components = @($sbom.components).Count
    alpine_packages = @(Get-Content -LiteralPath $apkPath).Count
    npm_vulnerabilities = $vulnerabilities
    result = "PASS_WITH_REVIEW"
}
$summaryJson = $summary | ConvertTo-Json -Depth 6
Write-Utf8NoBom -Path (Join-Path $outputPath "summary.json") -Value $summaryJson
$summaryJson
$global:LASTEXITCODE = 0
