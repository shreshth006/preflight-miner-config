# PREFLIGHT Miner — Operations Runbook

This document is the single source of truth for operating, updating, and monitoring the PREFLIGHT miner (`id: 20260828`, `slug: a1-preflight`) on the Telegraph Protocol network.

---

## Table of Contents

1. [Repository Layout](#repository-layout)
2. [Day-to-Day Operations](#day-to-day-operations)
3. [Updating the Miner Manifest](#updating-the-miner-manifest)
4. [On-Chain Registration Update](#on-chain-registration-update)
5. [Upstream RPC & Provider Fallbacks](#upstream-rpc--provider-fallbacks)
6. [Health Monitoring & Alerts](#health-monitoring--alerts)
7. [Circuit Breaker Behaviour](#circuit-breaker-behaviour)
8. [Incident Response](#incident-response)
9. [Security Checklist](#security-checklist)

---

## Repository Layout

```
preflight-miner-config/
├── telegraph/
│   └── miner.yaml            ← The manifest (commit-pinned, hash-verified)
├── comparator/
│   ├── preflight-comparator.wasm                         ← Base scoring module
│   ├── preflight-comparator-API_HEALTH_CHECK.wasm        ← Family build
│   ├── preflight-comparator-SERVER_UPTIME_MONITOR.wasm   ← Family build
│   ├── preflight-comparator-TOKEN_TOTAL_SUPPLY_VERIFY.wasm
│   ├── test-comparator.ps1   ← Scoring test suite
│   └── README.md
├── scripts/
│   ├── validate-manifest.ps1 ← Validates miner.yaml structure + SHA-256
│   ├── validate-manifest.mjs ← Node.js version for CI
│   ├── health-check.ps1      ← Live endpoint health checker
│   └── health-check.mjs      ← Node.js version for CI
├── examples/
│   └── first-paid-agent/     ← Example buyer agent (Sepolia test USDC)
├── docs/
│   └── OPERATIONS.md         ← This file
├── .github/
│   └── workflows/
│       └── ci.yml            ← GitHub Actions CI pipeline
└── README.md
```

---

## Day-to-Day Operations

### Validate the manifest locally (PowerShell)

```powershell
powershell -ExecutionPolicy Bypass -File scripts/validate-manifest.ps1
```

### Run the endpoint health check

```powershell
# Core endpoints only (11 probes, ~8 seconds)
powershell -ExecutionPolicy Bypass -File scripts/health-check.ps1

# All endpoints
powershell -ExecutionPolicy Bypass -File scripts/health-check.ps1 -All

# Against a staging deployment
powershell -ExecutionPolicy Bypass -File scripts/health-check.ps1 -BaseUrl https://your-staging.vercel.app
```

### Run comparator scoring tests

```powershell
powershell -ExecutionPolicy Bypass -File comparator/test-comparator.ps1
```

### Compute the manifest SHA-256 (Windows)

```powershell
(Get-FileHash telegraph\miner.yaml -Algorithm SHA256).Hash.ToLower()
```

### Compute the manifest SHA-256 (Linux / macOS / CI)

```bash
sha256sum telegraph/miner.yaml
```

---

## Updating the Miner Manifest

> [!IMPORTANT]
> Every change to `telegraph/miner.yaml` **requires a matching on-chain registration update**. If the hash on-chain does not match the file at the commit the node fetches, your miner is treated as tampered and will be excluded from routing.

### Step-by-step

1. **Edit** `telegraph/miner.yaml` with your changes (new endpoint, updated description, rate limit change, etc.).

2. **Validate** the manifest passes all checks:
   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts/validate-manifest.ps1
   ```
   Fix any errors reported before proceeding.

3. **Run the health check** to ensure the backend still responds correctly:
   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts/health-check.ps1
   ```

4. **Commit and push** to a feature branch:
   ```bash
   git checkout -b update/manifest-<brief-description>
   git add telegraph/miner.yaml
   git commit -m "manifest: <what changed and why>"
   git push -u origin update/manifest-<brief-description>
   ```

5. **Open a Pull Request** on GitHub. The CI pipeline (`ci.yml`) will:
   - Run the manifest validator.
   - Compute and display the new SHA-256 in the job summary.
   - Show a diff of old vs new hash as a PR warning to remind you to update on-chain.

6. **After the PR is merged**, note the **merge commit SHA** from GitHub.

7. **Proceed to the [On-Chain Registration Update](#on-chain-registration-update) section below.**

---

## On-Chain Registration Update

After merging a manifest change, you must submit a transaction to the Telegraph Protocol registry contract to update the pinned commit URL and SHA-256 hash. Without this step the node will keep fetching the old manifest.

### What you need

| Item | Value |
|---|---|
| **Registry contract** | Obtain from [Telegraph Protocol documentation](https://docs.telegraphprotocol.com) |
| **Your miner ID** | `20260828` |
| **New manifest URL** | `https://raw.githubusercontent.com/Manan0708/preflight-miner-config/<MERGE_COMMIT>/telegraph/miner.yaml` |
| **New SHA-256 hash** | Output of `validate-manifest.ps1` or `sha256sum` |
| **Signing key** | Your miner operator wallet private key |
| **Network** | Wherever your miner registration lives (Sepolia for testnet, mainnet for production) |

### Steps

1. **Get the merge commit hash** from the GitHub PR you just merged:
   ```bash
   git log --oneline -1 origin/main
   ```

2. **Construct the raw manifest URL:**
   ```
   https://raw.githubusercontent.com/Manan0708/preflight-miner-config/<COMMIT>/telegraph/miner.yaml
   ```
   Verify it loads correctly in your browser or with curl before submitting on-chain.

3. **Compute the final SHA-256** of the file at that URL:
   ```powershell
   # Windows
   (Get-FileHash telegraph\miner.yaml -Algorithm SHA256).Hash.ToLower()

   # Linux/macOS
   sha256sum telegraph/miner.yaml | awk '{print $1}'
   ```

4. **Submit the registration update transaction** via the Telegraph Protocol CLI or directly via your wallet. The call updates:
   - The pinned GitHub raw URL (pointing to the merge commit).
   - The SHA-256 hash stored on-chain.

5. **Wait for confirmation** (typically 1 block on the target network).

6. **Verify** the node is picking up the new manifest by checking miner status on the Telegraph network dashboard or by watching for successful routing in your miner logs.

> [!WARNING]
> **Never submit the hash of a file you haven't verified.** Always run `validate-manifest.ps1` immediately before computing the final hash to ensure the file on disk is exactly the bytes you intend to register.

> [!CAUTION]
> **Never reuse a commit URL.** Because raw.githubusercontent.com URLs are immutable per commit, always point to the exact merge commit. Do not use branch-name URLs (e.g. `/main/telegraph/miner.yaml`) — these are mutable and the node will reject them.

---

## Upstream RPC & Provider Fallbacks

The PREFLIGHT backend queries multiple upstream providers. If a provider is down or rate-limiting, the backend should fall back automatically. This section documents the dependency chain so you can diagnose failures quickly.

| Signal Family | Primary Provider | Fallback | Notes |
|---|---|---|---|
| EVM Gas / Balance / TX | Public JSON-RPC (chain default) | Alchemy / Infura (if configured) | 16 chains supported |
| Crypto Prices / TVL | DefiLlama | — | Public, no key required |
| FX Rates | Open exchange rates feed | — | Public API |
| DNS lookups | Cloudflare DoH (`1.1.1.1`) | Google DoH (`8.8.8.8`) | Dual-resolver |
| TLS verification | Direct socket handshake | — | No third party |
| Threat feeds | Public threat intelligence APIs | — | Cited in answer |

### If upstream RPC is timing out

1. Check the chain's public RPC status page.
2. Run the health check to isolate which endpoint is failing:
   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts/health-check.ps1 -All
   ```
3. If a specific chain's RPC is degraded, consider temporarily:
   - Lowering `rate_limit_per_sec` in `miner.yaml` to reduce pressure.
   - Increasing `circuit_cooldown_seconds` to let the breaker recover.
4. If the backend has configurable RPC URL overrides, add an API-keyed provider (e.g. Alchemy, QuickNode) in the backend environment variables — this is separate from this config repo.

---

## Health Monitoring & Alerts

### Manual spot check

```powershell
# Quick 11-endpoint pulse check
powershell -ExecutionPolicy Bypass -File scripts/health-check.ps1
```

### Recommended automated monitoring

Set up a cron job or uptime monitor (e.g. UptimeRobot, Grafana, or a GitHub Actions scheduled workflow) to call:

```bash
# Simple curl-based health probe for external monitoring
curl -s -o /dev/null -w "%{http_code}" \
  "https://preflight-ssl-verification.vercel.app/ssl-check?query=Is+github.com+TLS+valid"
```

A response of `200` means the miner is live. Anything else should trigger an alert.

### Vercel serverless cold-start latency

Vercel serverless functions may exhibit cold starts of 1–3 seconds after a period of inactivity. This is normal. If you observe consistent latency above 10 seconds:

1. Check Vercel function logs in the Vercel dashboard.
2. Consider upgrading to Vercel Pro (provisioned concurrency) or migrating to a container runtime (Fly.io, Railway, AWS Lambda with provisioned concurrency).

---

## Circuit Breaker Behaviour

The manifest declares:

```yaml
circuit_threshold: 8        # errors before the breaker opens
circuit_cooldown_seconds: 15 # seconds before it retries
```

This means: if the Telegraph node sees 8 consecutive errors from this miner, it opens the circuit and stops routing to it for 15 seconds, then tests again. This prevents a degraded miner from accumulating bad scores.

**To tune:**
- Lower `circuit_threshold` if you want faster isolation (at risk of tripping on transient upstream blips).
- Raise `circuit_cooldown_seconds` if your backend takes longer to recover.
- After changing these values, follow the full [manifest update flow](#updating-the-miner-manifest) since any change requires an on-chain hash update.

---

## Incident Response

### Miner not appearing in Telegraph routing

1. Check the on-chain registration — confirm the commit URL and SHA-256 are current.
2. Confirm the GitHub raw URL resolves and returns the manifest:
   ```
   https://raw.githubusercontent.com/Manan0708/preflight-miner-config/<COMMIT>/telegraph/miner.yaml
   ```
3. Run the health check to ensure the backend is live.
4. Check circuit breaker state via the Telegraph network dashboard.

### Answers being scored 0 unexpectedly

1. Run the comparator test suite to verify scoring is working:
   ```powershell
   powershell -ExecutionPolicy Bypass -File comparator/test-comparator.ps1
   ```
2. Review the intent mapping in `miner.yaml` — confirm the endpoint path and parameters match what the node sends.
3. Check that the backend is returning the exact field names and types that the intent spec requires.

### High error rate on a specific endpoint

1. Identify the failing endpoint from health check output.
2. Check upstream provider status for that signal family (see [Upstream RPC](#upstream-rpc--provider-fallbacks)).
3. Test the endpoint directly:
   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts/health-check.ps1 -All
   ```
4. If the endpoint is persistently broken, temporarily remove it from `miner.yaml` and re-register on-chain to avoid score penalties.

---

## Security Checklist

- [ ] **Private key never committed** — the operator wallet key is never stored in this repository.
- [ ] **Raw manifest URL always pinned to a commit** — never to a mutable branch name.
- [ ] **SHA-256 verified before every on-chain submission** — run `validate-manifest.ps1` immediately before computing the final hash.
- [ ] **Backend URL uses HTTPS** — `base_url` must start with `https://`.
- [ ] **Rate limit is realistic** — `rate_limit_per_sec: 25` should not exceed what the backend can sustain without error.
- [ ] **Dependencies audited** — periodically audit `examples/first-paid-agent/package.json` for CVEs in `@x402/evm`, `@x402/fetch`, and `viem`.
- [ ] **Vercel environment variables reviewed** — API keys and RPC provider secrets in the Vercel dashboard are access-controlled and rotated periodically.
