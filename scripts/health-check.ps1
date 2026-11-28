#!/usr/bin/env pwsh
# health-check.ps1 - Diagnostic endpoint health checker for the PREFLIGHT miner.
#
# Pings a representative sample of live endpoints on the PREFLIGHT backend with
# safe, deterministic test payloads and reports response status, latency, and
# basic response structure.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts/health-check.ps1
#   powershell -File scripts/health-check.ps1 -BaseUrl https://your-custom-url.app
#   powershell -File scripts/health-check.ps1 -All              # test every endpoint
#   powershell -File scripts/health-check.ps1 -Timeout 15       # 15s per request
#
# Exit codes:
#   0 = all probed endpoints responded (2xx)
#   1 = one or more endpoints failed

param(
    [string]$BaseUrl = "https://preflight-ssl-verification.vercel.app",
    [switch]$All,
    [int]$Timeout = 10
)

$script:passedCount = 0
$script:failedCount = 0

function Test-Endpoint {
    param(
        [string]$Path,
        [string]$Query,
        [string]$Label
    )

    $url = "$BaseUrl$Path" + "?query=" + [uri]::EscapeDataString($Query)
    $displayLabel = if ($Label) { $Label } else { $Path }

    try {
        $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
        $response = Invoke-WebRequest -Uri $url -Method GET -TimeoutSec $Timeout -UseBasicParsing -ErrorAction Stop
        $stopwatch.Stop()
        $elapsed = $stopwatch.ElapsedMilliseconds

        $status = $response.StatusCode
        $bodyLen = $response.Content.Length

        $fieldStatus = ""
        try {
            $json = $response.Content | ConvertFrom-Json
            if ($json.field_status) { $fieldStatus = " [field_status: $($json.field_status)]" }
            elseif ($json.status)   { $fieldStatus = " [status: $($json.status)]" }
        } catch {}

        if ($status -ge 200 -and $status -lt 300) {
            $msg = "  + $displayLabel - $status ($($elapsed)ms, $($bodyLen) bytes$fieldStatus)"
            Write-Host $msg -ForegroundColor Green
            $script:passedCount++
        } else {
            $msg = "  ! $displayLabel - $status ($($elapsed)ms)"
            Write-Host $msg -ForegroundColor Yellow
            $script:failedCount++
        }
    }
    catch {
        $errMsg = $_.Exception.Message
        if ($_.Exception.Response) {
            $status = [int]$_.Exception.Response.StatusCode
            Write-Host "  X $displayLabel - HTTP $status ($errMsg)" -ForegroundColor Red
        } else {
            Write-Host "  X $displayLabel - FAILED ($errMsg)" -ForegroundColor Red
        }
        $script:failedCount++
    }
}

# ---- Core Endpoint Tests (safe, deterministic payloads) ----

$coreTests = @(
    @{ Path = "/ssl-check";       Query = "Is the TLS certificate of github.com valid?";          Label = "/ssl-check (github.com)" },
    @{ Path = "/dns";             Query = "What are the DNS records for google.com?";              Label = "/dns (google.com)" },
    @{ Path = "/gas-price";       Query = "What is the gas price on Ethereum right now?";          Label = "/gas-price (Ethereum)" },
    @{ Path = "/crypto-price";    Query = "What is the current price of ETH in US dollars?";       Label = "/crypto-price (ETH)" },
    @{ Path = "/wallet-balance";  Query = "What is the balance of 0x00000000219ab540356cBB839Cbe05303d7705Fa on Ethereum?"; Label = "/wallet-balance (ETH deposit)" },
    @{ Path = "/token-supply";    Query = "What is the total supply of USDC on Ethereum?";         Label = "/token-supply (USDC)" },
    @{ Path = "/uptime";          Query = "Is https://ethereum.org reachable right now?";          Label = "/uptime (ethereum.org)" },
    @{ Path = "/api-health";      Query = "Is the API at https://api.coingecko.com healthy?";      Label = "/api-health (coingecko)" },
    @{ Path = "/fx-rate";         Query = "What is the EUR to USD exchange rate?";                 Label = "/fx-rate (EUR/USD)" },
    @{ Path = "/tvl";             Query = "What is the TVL of Aave?";                             Label = "/tvl (Aave)" }
)

$extendedTests = @(
    @{ Path = "/url-scan";        Query = "Is https://example.com safe to visit?";                 Label = "/url-scan (example.com)" },
    @{ Path = "/ip-geolocation";  Query = "Where is IP address 8.8.8.8 located?";                 Label = "/ip-geolocation (8.8.8.8)" },
    @{ Path = "/cve";             Query = "What is CVE-2021-44228?";                               Label = "/cve (Log4Shell)" },
    @{ Path = "/weather";         Query = "What is the weather in New York?";                      Label = "/weather (NYC)" },
    @{ Path = "/market-cap";      Query = "What is the market cap of Bitcoin?";                    Label = "/market-cap (BTC)" },
    @{ Path = "/news-headlines";  Query = "What are the latest crypto news?";                      Label = "/news-headlines" },
    @{ Path = "/fact-check";      Query = "Is water H2O?";                                         Label = "/fact-check" },
    @{ Path = "/translate";       Query = "Translate hello to Spanish";                            Label = "/translate" },
    @{ Path = "/similarity";      Query = "How similar are cat and dog?";                          Label = "/similarity" }
)

# ---- Run ----

Write-Host ""
Write-Host "PREFLIGHT Endpoint Health Check" -ForegroundColor Cyan
Write-Host ("-" * 55)
Write-Host "  i Base URL: $BaseUrl" -ForegroundColor Cyan
Write-Host "  i Timeout: $($Timeout)s per request" -ForegroundColor Cyan
Write-Host ""

Write-Host "Core Endpoints" -ForegroundColor Cyan

foreach ($test in $coreTests) {
    Test-Endpoint -Path $test.Path -Query $test.Query -Label $test.Label
}

if ($All) {
    Write-Host ""
    Write-Host "Extended Endpoints" -ForegroundColor Cyan

    foreach ($test in $extendedTests) {
        Test-Endpoint -Path $test.Path -Query $test.Query -Label $test.Label
    }
}

# ---- Comparator endpoint ----

Write-Host ""
Write-Host "Comparator Endpoint" -ForegroundColor Cyan

try {
    $compBody = @{
        batch = @(
            @{ ground_truth_value = 100; miner_value = 100; spec = @(0, 0) }
            @{ ground_truth_value = 100; miner_value = 95;  spec = @(1, 10) }
        )
    } | ConvertTo-Json -Depth 3

    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    $response = Invoke-WebRequest -Uri "$BaseUrl/comparator" `
        -Method POST `
        -ContentType "application/json" `
        -Body $compBody `
        -TimeoutSec $Timeout `
        -UseBasicParsing `
        -ErrorAction Stop
    $stopwatch.Stop()

    $status = $response.StatusCode
    $elapsed = $stopwatch.ElapsedMilliseconds
    $bodyLen = $response.Content.Length
    Write-Host "  + /comparator - $status ($($elapsed)ms, $($bodyLen) bytes)" -ForegroundColor Green
    $script:passedCount++
}
catch {
    Write-Host "  X /comparator - FAILED ($($_.Exception.Message))" -ForegroundColor Red
    $script:failedCount++
}

# ---- Summary ----

Write-Host ""
Write-Host ("-" * 55)

$total = $script:passedCount + $script:failedCount
if ($script:failedCount -eq 0) {
    Write-Host "All $total endpoint(s) healthy." -ForegroundColor Green
} else {
    Write-Host "$($script:failedCount)/$total endpoint(s) failed." -ForegroundColor Red
}
Write-Host "  Passed: $($script:passedCount)  Failed: $($script:failedCount)"
Write-Host ""

if ($script:failedCount -gt 0) { exit 1 } else { exit 0 }
