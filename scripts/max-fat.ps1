[CmdletBinding()]
param(
    [ValidateRange(0, 5)]
    [int]$FailNext = 0,
    [switch]$Clear,
    [switch]$ShowMessages
)

$ErrorActionPreference = "Stop"
$baseUrl = "http://127.0.0.1:18081"

if ($Clear) {
    Invoke-RestMethod -Method Delete "$baseUrl/messages" | Out-Null
}
if ($FailNext -gt 0) {
    Invoke-RestMethod -Method Post "$baseUrl/fail/$FailNext" | Out-Null
}
if ($ShowMessages) {
    (Invoke-RestMethod "$baseUrl/messages").messages |
        Select-Object receivedUtc, chatId, @{Name = "Text"; Expression = { $_.payload.text }} |
        Format-Table -AutoSize -Wrap
} else {
    Invoke-RestMethod "$baseUrl/health"
}
