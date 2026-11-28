#!/usr/bin/env pwsh
# test-comparator.ps1 - Tests the PREFLIGHT comparator scoring via the live API endpoint.
#
# Runs a comprehensive suite of test vectors against the comparator endpoint and
# verifies that the returned scores match the expected deterministic results.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File comparator/test-comparator.ps1
#   powershell -File comparator/test-comparator.ps1 -BaseUrl https://custom.app
#
# Exit codes:
#   0 = all test vectors pass
#   1 = one or more test vectors failed

param(
    [string]$BaseUrl = "https://preflight-ssl-verification.vercel.app"
)

$script:passedCount = 0
$script:failedCount = 0

# ---- Scoring Reference (from README) ----
#
# Code 0 (Exact), Code 3 (PassFail), any other:
#   score = 10000 if miner == truth, else 0
#
# Code 1 (AbsTol):
#   error = |miner - truth|
#   score = 10000 * (2*tol - error) / (2*tol), integer division
#   score = 0 once error >= 2*tol
#   tolerance <= 0 allows only exact match
#
# Code 2 (RelTol):
#   error = |miner - truth| * 10000 / |truth| (128-bit)
#   score = 10000 * (2*tol - error) / (2*tol), integer division
#   score = 0 once error >= 2*tol
#   tolerance <= 0 allows only exact match

# ---- Test Vectors ----
# Each: truth, miner, spec_code, spec_tolerance, expected_score, description

$testVectors = @(
    # === Code 0: Exact Match ===
    @{ truth = 100; miner = 100; code = 0; tol = 0;  expected = 10000; desc = "Exact: match" },
    @{ truth = 100; miner = 101; code = 0; tol = 0;  expected = 0;     desc = "Exact: mismatch" },
    @{ truth = 0;   miner = 0;   code = 0; tol = 0;  expected = 10000; desc = "Exact: both zero" },
    @{ truth = -50; miner = -50; code = 0; tol = 0;  expected = 10000; desc = "Exact: negative match" },
    @{ truth = -50; miner = 50;  code = 0; tol = 0;  expected = 0;     desc = "Exact: sign mismatch" },

    # === Code 3: PassFail (same as Exact) ===
    @{ truth = 42;  miner = 42;  code = 3; tol = 0;  expected = 10000; desc = "PassFail: match" },
    @{ truth = 42;  miner = 43;  code = 3; tol = 0;  expected = 0;     desc = "PassFail: mismatch" },

    # === Code 1: Absolute Tolerance ===
    @{ truth = 100; miner = 100; code = 1; tol = 10; expected = 10000; desc = "AbsTol: exact match (tol=10)" },
    @{ truth = 100; miner = 95;  code = 1; tol = 10; expected = 7500;  desc = "AbsTol: error=5, tol=10 -> 7500" },
    @{ truth = 100; miner = 110; code = 1; tol = 10; expected = 5000;  desc = "AbsTol: error=10, tol=10 -> 5000" },
    @{ truth = 100; miner = 80;  code = 1; tol = 10; expected = 0;     desc = "AbsTol: error=20 >= 2*tol=20 -> 0" },
    @{ truth = 100; miner = 119; code = 1; tol = 10; expected = 500;   desc = "AbsTol: error=19, tol=10 -> 500" },
    @{ truth = 100; miner = 120; code = 1; tol = 10; expected = 0;     desc = "AbsTol: error=20 >= 2*tol -> 0" },
    @{ truth = 100; miner = 100; code = 1; tol = 0;  expected = 10000; desc = "AbsTol: exact with tol=0" },
    @{ truth = 100; miner = 101; code = 1; tol = 0;  expected = 0;     desc = "AbsTol: off-by-1 with tol=0 -> 0" },

    # === Code 2: Relative Tolerance ===
    @{ truth = 100; miner = 100; code = 2; tol = 500; expected = 10000; desc = "RelTol: exact match" },
    @{ truth = 100; miner = 95;  code = 2; tol = 500; expected = 5000;  desc = "RelTol: 5% error, tol=500 (5%) -> 5000" },
    @{ truth = 100; miner = 100; code = 2; tol = 0;   expected = 10000; desc = "RelTol: exact with tol=0" },
    @{ truth = 100; miner = 101; code = 2; tol = 0;   expected = 0;     desc = "RelTol: off-by-1 with tol=0 -> 0" },
    @{ truth = 1000; miner = 990; code = 2; tol = 500; expected = 9000;  desc = "RelTol: 1% error, tol=5% -> 9000" },

    # === Unknown code (falls through to Exact) ===
    @{ truth = 77; miner = 77; code = 99; tol = 0; expected = 10000; desc = "Unknown code 99: exact match" },
    @{ truth = 77; miner = 78; code = 99; tol = 0; expected = 0;     desc = "Unknown code 99: mismatch -> 0" }
)

# ---- Run ----

Write-Host ""
Write-Host "PREFLIGHT Comparator Test Suite" -ForegroundColor Cyan
Write-Host ("-" * 60)
Write-Host "  i Endpoint: $BaseUrl/comparator" -ForegroundColor Cyan
Write-Host "  i Test vectors: $($testVectors.Count)" -ForegroundColor Cyan
Write-Host ""

# Build batch request
$batch = @()
foreach ($tv in $testVectors) {
    $batch += @{
        ground_truth_value = $tv.truth
        miner_value = $tv.miner
        spec = @($tv.code, $tv.tol)
    }
}

$body = @{ batch = $batch } | ConvertTo-Json -Depth 4

try {
    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    $response = Invoke-WebRequest -Uri "$BaseUrl/comparator" `
        -Method POST `
        -ContentType "application/json" `
        -Body $body `
        -TimeoutSec 30 `
        -UseBasicParsing `
        -ErrorAction Stop
    $stopwatch.Stop()
    $elapsed = $stopwatch.ElapsedMilliseconds

    Write-Host "  i API responded in $($elapsed)ms" -ForegroundColor Cyan
    Write-Host ""

    $results = $response.Content | ConvertFrom-Json

    # The API may return an array of scores or an object with a results/scores field
    $scores = $null
    if ($results -is [array]) {
        $scores = $results
    } elseif ($results.results) {
        $scores = $results.results
    } elseif ($results.scores) {
        $scores = $results.scores
    } elseif ($results.batch) {
        $scores = $results.batch
    } else {
        Write-Host "  X Unexpected response structure: $($response.Content)" -ForegroundColor Red
        exit 1
    }

    if ($scores.Count -ne $testVectors.Count) {
        Write-Host "  X Expected $($testVectors.Count) scores, got $($scores.Count)" -ForegroundColor Red
        exit 1
    }

    for ($i = 0; $i -lt $testVectors.Count; $i++) {
        $tv = $testVectors[$i]
        $actual = $null

        # Score might be a plain number or an object with a score field
        if ($scores[$i] -is [int] -or $scores[$i] -is [long] -or $scores[$i] -is [double]) {
            $actual = [long]$scores[$i]
        } elseif ($scores[$i].score -ne $null) {
            $actual = [long]$scores[$i].score
        } else {
            $actual = [long]$scores[$i]
        }

        if ($actual -eq $tv.expected) {
            Write-Host "  + $($tv.desc): $actual" -ForegroundColor Green
            $script:passedCount++
        } else {
            Write-Host "  X $($tv.desc): expected $($tv.expected), got $actual" -ForegroundColor Red
            $script:failedCount++
        }
    }
}
catch {
    Write-Host "  X API call failed: $($_.Exception.Message)" -ForegroundColor Red
    $script:failedCount = $testVectors.Count
}

# ---- Per-Family WASM Endpoints ----

Write-Host ""
Write-Host "Per-Family Comparator Endpoints" -ForegroundColor Cyan

$families = @("API_HEALTH_CHECK", "SERVER_UPTIME_MONITOR", "TOKEN_TOTAL_SUPPLY_VERIFY")
$simpleBody = @{ batch = @( @{ ground_truth_value = 100; miner_value = 100; spec = @(0, 0) } ) } | ConvertTo-Json -Depth 4

foreach ($family in $families) {
    try {
        $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
        $response = Invoke-WebRequest -Uri "$BaseUrl/comparator/$family" `
            -Method POST `
            -ContentType "application/json" `
            -Body $simpleBody `
            -TimeoutSec 10 `
            -UseBasicParsing `
            -ErrorAction Stop
        $stopwatch.Stop()
        $elapsed = $stopwatch.ElapsedMilliseconds
        Write-Host "  + /comparator/$family - $($response.StatusCode) ($($elapsed)ms)" -ForegroundColor Green
        $script:passedCount++
    }
    catch {
        Write-Host "  X /comparator/$family - FAILED ($($_.Exception.Message))" -ForegroundColor Red
        $script:failedCount++
    }
}

# ---- Summary ----

Write-Host ""
Write-Host ("-" * 60)

$total = $script:passedCount + $script:failedCount
if ($script:failedCount -eq 0) {
    Write-Host "All $total test(s) passed." -ForegroundColor Green
} else {
    Write-Host "$($script:failedCount)/$total test(s) failed." -ForegroundColor Red
}
Write-Host "  Passed: $($script:passedCount)  Failed: $($script:failedCount)"
Write-Host ""

if ($script:failedCount -gt 0) { exit 1 } else { exit 0 }
