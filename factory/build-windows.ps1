[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$SourceIso,

    [Parameter(Mandatory)]
    [ValidatePattern('^[A-Fa-f0-9]{64}$')]
    [string]$SourceSha256,

    [Parameter(Mandatory)]
    [string]$FactoryConfig,

    [string]$OutputDirectory
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$repositoryParent = Split-Path -Parent $repositoryRoot
if (-not $OutputDirectory) {
    $OutputDirectory = Join-Path $repositoryParent "RINIR-factory-output"
}
$sourceIsoPath = (Resolve-Path -LiteralPath $SourceIso).Path
$factoryConfigPath = (Resolve-Path -LiteralPath $FactoryConfig).Path
$outputPath = [System.IO.Path]::GetFullPath($OutputDirectory)
$builderImage = "gas-monitoring-factory-builder:0.1.0"

if (-not (Test-Path -LiteralPath $sourceIsoPath -PathType Leaf)) {
    throw "Source Debian ISO not found: $sourceIsoPath"
}
if (-not (Test-Path -LiteralPath $factoryConfigPath -PathType Leaf)) {
    throw "Factory config not found: $factoryConfigPath"
}
$factoryConfigText = Get-Content -LiteralPath $factoryConfigPath -Raw
if ($factoryConfigText -match 'replace-with-') {
    throw "Factory config contains unchanged placeholder credentials"
}
foreach ($requiredSetting in @('ADMIN_ACCESS_CODE', 'NODE_RED_ADMIN_PASSWORD', 'REMOTE_INITIAL_PASSWORD')) {
    if ($factoryConfigText -notmatch "(?m)^$requiredSetting=.+$") {
        throw "Factory config is missing $requiredSetting"
    }
}
if ($outputPath.Equals($repositoryRoot, [System.StringComparison]::OrdinalIgnoreCase) -or
    $outputPath.StartsWith($repositoryRoot + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Output directory must be outside the repository"
}
if (Test-Path -LiteralPath $outputPath) {
    if (Get-ChildItem -LiteralPath $outputPath -Force | Select-Object -First 1) {
        throw "Output directory must be empty: $outputPath"
    }
} else {
    New-Item -ItemType Directory -Path $outputPath | Out-Null
}

$actualSourceSha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $sourceIsoPath).Hash
if ($actualSourceSha256 -ne $SourceSha256.ToUpperInvariant()) {
    throw "Source Debian ISO SHA-256 mismatch: expected $SourceSha256, got $actualSourceSha256"
}

$dockerPlatform = docker info --format '{{.OSType}}/{{.Architecture}}'
if ($LASTEXITCODE -ne 0) {
    throw "Docker Desktop is not available"
}
if ($dockerPlatform.Trim() -notin @("linux/x86_64", "linux/amd64")) {
    throw "Docker Desktop must use Linux amd64 containers; detected $dockerPlatform"
}

docker build `
    --platform linux/amd64 `
    --file (Join-Path $PSScriptRoot "Dockerfile.windows-builder") `
    --tag $builderImage `
    $repositoryRoot
if ($LASTEXITCODE -ne 0) {
    throw "Factory builder image failed"
}

$mounts = @(
    "type=bind,source=$repositoryRoot,target=/repo,readonly",
    "type=bind,source=$sourceIsoPath,target=/input/debian.iso,readonly",
    "type=bind,source=$factoryConfigPath,target=/input/factory.env,readonly",
    "type=bind,source=$outputPath,target=/output",
    "type=volume,source=rinir-factory-node-modules,target=/repo/node_modules",
    "type=volume,source=rinir-factory-npm-cache,target=/npm-cache",
    "type=bind,source=/var/run/docker.sock,target=/var/run/docker.sock"
)

$dockerArguments = @("run", "--rm", "--platform", "linux/amd64")
foreach ($mount in $mounts) {
    $dockerArguments += @("--mount", $mount)
}
$dockerArguments += @("--env", "SOURCE_SHA256=$($SourceSha256.ToLowerInvariant())", $builderImage)

& docker @dockerArguments
if ($LASTEXITCODE -ne 0) {
    throw "Factory ISO build failed"
}

$resultIso = Get-ChildItem -LiteralPath $outputPath -Filter "RINIR-*-amd64.iso" |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
if (-not $resultIso) {
    throw "Factory ISO was not created in $outputPath"
}

$resultChecksum = "$($resultIso.FullName).sha256"
$expectedResult = ((Get-Content -LiteralPath $resultChecksum -Raw) -split '\s+')[0].ToUpperInvariant()
$actualResult = (Get-FileHash -Algorithm SHA256 -LiteralPath $resultIso.FullName).Hash
if ($actualResult -ne $expectedResult) {
    throw "Factory ISO verification failed"
}
$buildInfo = Join-Path $outputPath "BUILD-INFO.txt"
if (-not (Test-Path -LiteralPath $buildInfo -PathType Leaf)) {
    throw "Factory build evidence was not created: $buildInfo"
}

Write-Host "Factory ISO created and verified: $($resultIso.FullName)"
Write-Host "SHA-256: $actualResult"
