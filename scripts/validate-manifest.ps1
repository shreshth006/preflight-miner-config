# validate-manifest.ps1 — Validates telegraph/miner.yaml structure and prints its SHA-256 hash.
# Usage: powershell -File scripts/validate-manifest.ps1 [path\to\miner.yaml]
#
# Exit codes:
#   0 = all checks pass
#   1 = validation errors found
#
# Requirements: PowerShell 5.1+ (ships with Windows 10/11)

param(
    [string]$ManifestPath
)

if (-not $ManifestPath) {
    $ManifestPath = Join-Path $PSScriptRoot '..\telegraph\miner.yaml'
}

$ManifestPath = Resolve-Path $ManifestPath -ErrorAction Stop

# ── Helpers ──────────────────────────────────────────────────────────────────

$script:errors = 0
$script:warnings = 0

function Fail($msg)  { Write-Host "  X $msg" -ForegroundColor Red;    $script:errors++ }
function Warn($msg)  { Write-Host "  ! $msg" -ForegroundColor Yellow; $script:warnings++ }
function Pass($msg)  { Write-Host "  + $msg" -ForegroundColor Green }
function Info($msg)  { Write-Host "  i $msg" -ForegroundColor Cyan }

# ── Read & Hash ──────────────────────────────────────────────────────────────

$rawBytes = [System.IO.File]::ReadAllBytes($ManifestPath)
$sha256   = (Get-FileHash -Path $ManifestPath -Algorithm SHA256).Hash.ToLower()
$rawText  = [System.IO.File]::ReadAllText($ManifestPath)
$lines    = $rawText -split "`r?`n"

Write-Host ""
Write-Host "PREFLIGHT Manifest Validator" -ForegroundColor Cyan
Write-Host ("-" * 55)
Info "File: $ManifestPath"
Info "Size: $($rawBytes.Length) bytes"
Info "SHA-256: $sha256"
Write-Host ""

# ── Minimal YAML line parser (covers miner.yaml subset) ─────────────────────
# We parse just the top-level keys and the endpoints array structure.

$topLevel = @{}
$endpoints = @()
$currentEndpoint = $null
$inEndpoints = $false
$inIntents = $false
$inParams = $false

foreach ($line in $lines) {
    # Skip blanks and comments
    if ($line -match '^\s*(#|$)') { continue }

    $indent = ($line -replace '^(\s*).*', '$1').Length

    # Top-level key: value (indent 0)
    if ($indent -eq 0 -and $line -match '^(\w[\w.-]*):\s*(.*)') {
        $key = $Matches[1]
        $val = $Matches[2] -replace '\s*#.*$', ''

        if ($key -eq 'endpoints') {
            $inEndpoints = $true
            continue
        }

        $inEndpoints = $false
        $topLevel[$key] = $val.Trim().Trim("'`"")
        continue
    }

    # Inside endpoints array
    if ($inEndpoints) {
        # New endpoint item
        if ($line -match '^\s{2}-\s+path:\s*(.+)') {
            if ($currentEndpoint) { $endpoints += ,$currentEndpoint }
            $currentEndpoint = @{
                path = $Matches[1].Trim()
                intents = @()
                hasMethod = $false
                hasDescription = $false
                hasExternalPath = $false
                hasParams = $false
                paramNames = @()
            }
            $inIntents = $false
            $inParams = $false
            continue
        }

        if ($currentEndpoint) {
            if ($line -match '^\s+external_path:\s*(.+)') {
                $currentEndpoint.hasExternalPath = $true
            }
            elseif ($line -match '^\s+method:\s*(\w+)') {
                $currentEndpoint.hasMethod = $true
                $currentEndpoint['method'] = $Matches[1].Trim()
            }
            elseif ($line -match '^\s+description:\s*') {
                $currentEndpoint.hasDescription = $true
            }
            elseif ($line -match '^\s+intents:\s*$') {
                $inIntents = $true; $inParams = $false
                continue
            }
            elseif ($line -match '^\s+params:\s*$') {
                $inParams = $true; $inIntents = $false
                $currentEndpoint.hasParams = $true
                continue
            }

            if ($inIntents -and $line -match '^\s+-\s+(\S+)') {
                $currentEndpoint.intents += $Matches[1].Trim()
            }
            if ($inParams -and $line -match '^\s+-\s*name:\s*(\S+)') {
                $currentEndpoint.paramNames += $Matches[1].Trim()
            }
        }
    }
}
# Flush last endpoint
if ($currentEndpoint) { $endpoints += ,$currentEndpoint }

# ── Top-Level Required Fields ────────────────────────────────────────────────

Write-Host "Top-Level Fields" -ForegroundColor Cyan

$requiredTop = @('version', 'kind', 'id', 'slug', 'protocol', 'name', 'description', 'base_url')

foreach ($field in $requiredTop) {
    if (-not $topLevel.ContainsKey($field) -or [string]::IsNullOrWhiteSpace($topLevel[$field])) {
        # description and name use block scalars — check raw text
        if ($rawText -match "(?m)^${field}:\s") {
            Pass "`"$field`" present"
        } else {
            Fail "Missing required top-level field: `"$field`""
        }
    } else {
        Pass "`"$field`" present"
    }
}

if ($topLevel['kind'] -and $topLevel['kind'] -ne 'miner') {
    Warn "`"kind`" is `"$($topLevel['kind'])`" (expected `"miner`")"
}

if ($topLevel['base_url'] -and -not $topLevel['base_url'].StartsWith('https://')) {
    Warn "`"base_url`" does not use HTTPS: $($topLevel['base_url'])"
}

# ── Endpoints Validation ─────────────────────────────────────────────────────

Write-Host ""
Write-Host "Endpoints" -ForegroundColor Cyan

if ($endpoints.Count -eq 0) {
    Fail "No endpoints found in manifest"
} else {
    Pass "$($endpoints.Count) endpoint(s) declared"
}

$seenPaths = @{}
$allIntents = @{}
$validMethods = @('GET', 'POST', 'PUT', 'PATCH', 'DELETE')

for ($i = 0; $i -lt $endpoints.Count; $i++) {
    $ep = $endpoints[$i]
    $label = $ep.path

    # Required fields
    if (-not $ep.path) { Fail "Endpoint [$i]: missing `"path`"" }
    if (-not $ep.hasMethod) { Fail "Endpoint `"$label`": missing `"method`"" }
    if (-not $ep.hasDescription) { Fail "Endpoint `"$label`": missing `"description`"" }
    if ($ep.intents.Count -eq 0) { Fail "Endpoint `"$label`": missing `"intents`"" }

    # Method check
    if ($ep['method'] -and $ep['method'].ToUpper() -notin $validMethods) {
        Warn "Endpoint `"$label`": unusual HTTP method `"$($ep['method'])`""
    }

    # Duplicate path
    if ($seenPaths.ContainsKey($ep.path)) {
        Fail "Duplicate endpoint path `"$($ep.path)`" (first at index $($seenPaths[$ep.path]), again at $i)"
    } else {
        $seenPaths[$ep.path] = $i
    }

    # external_path
    if (-not $ep.hasExternalPath) {
        Warn "Endpoint `"$label`": no `"external_path`" (the node may not route correctly)"
    }

    # Collect intents
    foreach ($intent in $ep.intents) {
        if (-not $allIntents.ContainsKey($intent)) { $allIntents[$intent] = @() }
        $allIntents[$intent] += $ep.path
    }
}

# ── Intent Summary ───────────────────────────────────────────────────────────

Write-Host ""
Write-Host "Intent Summary" -ForegroundColor Cyan
Pass "$($allIntents.Count) unique intent(s) across $($endpoints.Count) endpoint(s)"

foreach ($intent in $allIntents.Keys) {
    $paths = $allIntents[$intent]
    if ($paths.Count -gt 1) {
        Info "Intent `"$intent`" is served by $($paths.Count) endpoints: $($paths -join ', ')"
    }
}

# ── Operational Config ───────────────────────────────────────────────────────

Write-Host ""
Write-Host "Operational Config" -ForegroundColor Cyan

if ($topLevel.ContainsKey('rate_limit_per_sec')) {
    Pass "rate_limit_per_sec: $($topLevel['rate_limit_per_sec'])"
    if ([int]$topLevel['rate_limit_per_sec'] -gt 100) {
        Warn "rate_limit_per_sec > 100 — ensure your backend can sustain this"
    }
} else {
    Warn "No `"rate_limit_per_sec`" set"
}

if ($topLevel.ContainsKey('cache_ttl_sec')) {
    Pass "cache_ttl_sec: $($topLevel['cache_ttl_sec'])"
} else {
    Info "No `"cache_ttl_sec`" set (default caching will apply)"
}

if ($topLevel.ContainsKey('circuit_threshold')) {
    Pass "circuit_threshold: $($topLevel['circuit_threshold'])"
} else {
    Warn "No `"circuit_threshold`" — the node will use its default breaker"
}

if ($topLevel.ContainsKey('circuit_cooldown_seconds')) {
    Pass "circuit_cooldown_seconds: $($topLevel['circuit_cooldown_seconds'])"
}

# ── Summary ──────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host ("-" * 55)
if ($script:errors -eq 0) {
    Write-Host "All checks passed. ($($script:warnings) warning(s))" -ForegroundColor Green
} else {
    Write-Host "$($script:errors) error(s), $($script:warnings) warning(s)." -ForegroundColor Red
}
Write-Host ""

exit $(if ($script:errors -gt 0) { 1 } else { 0 })
