#!/usr/bin/env node
// health-check.mjs — Diagnostic endpoint health checker for the PREFLIGHT miner.
//
// Pings a representative sample of live endpoints with safe, deterministic
// test payloads and reports response status, latency, and structure.
//
// Usage:
//   node scripts/health-check.mjs               # core endpoints only
//   node scripts/health-check.mjs --all          # all endpoints
//   node scripts/health-check.mjs --base-url https://custom.app
//   node scripts/health-check.mjs --timeout 15000
//
// Requires: Node >= 18 (uses native fetch)
// Exit codes: 0 = all healthy, 1 = failures detected

const BASE_URL = getArg('--base-url') || 'https://preflight-ssl-verification.vercel.app';
const TIMEOUT  = Number(getArg('--timeout') || 10000);
const RUN_ALL  = process.argv.includes('--all');

const RED   = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN  = '\x1b[36m';
const RESET = '\x1b[0m';

let passed = 0, failed = 0;

// ── Test definitions ────────────────────────────────────────────────────────

const coreTests = [
  { path: '/ssl-check',      query: 'Is the TLS certificate of github.com valid?',                                label: '/ssl-check (github.com)' },
  { path: '/dns',            query: 'What are the DNS records for google.com?',                                    label: '/dns (google.com)' },
  { path: '/gas-price',      query: 'What is the gas price on Ethereum right now?',                                label: '/gas-price (Ethereum)' },
  { path: '/crypto-price',   query: 'What is the current price of ETH in US dollars?',                             label: '/crypto-price (ETH)' },
  { path: '/wallet-balance', query: 'What is the balance of 0x00000000219ab540356cBB839Cbe05303d7705Fa on Ethereum?', label: '/wallet-balance (ETH deposit)' },
  { path: '/token-supply',   query: 'What is the total supply of USDC on Ethereum?',                               label: '/token-supply (USDC)' },
  { path: '/uptime',         query: 'Is https://ethereum.org reachable right now?',                                label: '/uptime (ethereum.org)' },
  { path: '/api-health',     query: 'Is the API at https://api.coingecko.com healthy?',                            label: '/api-health (coingecko)' },
  { path: '/fx-rate',        query: 'What is the EUR to USD exchange rate?',                                       label: '/fx-rate (EUR/USD)' },
  { path: '/tvl',            query: 'What is the TVL of Aave?',                                                   label: '/tvl (Aave)' },
];

const extendedTests = [
  { path: '/url-scan',       query: 'Is https://example.com safe to visit?',                                      label: '/url-scan (example.com)' },
  { path: '/ip-geolocation', query: 'Where is IP address 8.8.8.8 located?',                                       label: '/ip-geolocation (8.8.8.8)' },
  { path: '/cve',            query: 'What is CVE-2021-44228?',                                                    label: '/cve (Log4Shell)' },
  { path: '/weather',        query: 'What is the weather in New York?',                                           label: '/weather (NYC)' },
  { path: '/market-cap',     query: 'What is the market cap of Bitcoin?',                                         label: '/market-cap (BTC)' },
  { path: '/news-headlines', query: 'What are the latest crypto news?',                                           label: '/news-headlines' },
  { path: '/fact-check',     query: 'Is water H2O?',                                                              label: '/fact-check' },
  { path: '/translate',      query: 'Translate hello to Spanish',                                                 label: '/translate' },
  { path: '/similarity',     query: 'How similar are cat and dog?',                                               label: '/similarity' },
];

const comparatorTest = {
  url: `${BASE_URL}/comparator`,
  method: 'POST',
  body: { batch: [
    { ground_truth_value: 100, miner_value: 100, spec: [0, 0] },
    { ground_truth_value: 100, miner_value: 95,  spec: [1, 10] },
  ]},
};

// ── Runner ──────────────────────────────────────────────────────────────────

async function probe(test) {
  const url = `${BASE_URL}${test.path}?query=${encodeURIComponent(test.query)}`;
  const t0 = Date.now();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT) });
    const ms = Date.now() - t0;
    const body = await res.text();
    let extra = '';
    try {
      const json = JSON.parse(body);
      if (json.field_status) extra = ` [field_status: ${json.field_status}]`;
      else if (json.status)  extra = ` [status: ${json.status}]`;
    } catch {}

    if (res.ok) {
      console.log(`  ${GREEN}✓${RESET} ${test.label} — ${res.status} (${ms}ms, ${body.length} bytes${extra})`);
      passed++;
    } else {
      console.log(`  ${YELLOW}⚠${RESET} ${test.label} — ${res.status} (${ms}ms)`);
      failed++;
    }
  } catch (e) {
    const ms = Date.now() - t0;
    console.log(`  ${RED}✗${RESET} ${test.label} — FAILED (${e.message}, ${ms}ms)`);
    failed++;
  }
}

async function probeComparator() {
  const t0 = Date.now();
  try {
    const res = await fetch(comparatorTest.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(comparatorTest.body),
      signal: AbortSignal.timeout(TIMEOUT),
    });
    const ms = Date.now() - t0;
    const body = await res.text();
    if (res.ok) {
      console.log(`  ${GREEN}✓${RESET} /comparator — ${res.status} (${ms}ms, ${body.length} bytes)`);
      passed++;
    } else {
      console.log(`  ${YELLOW}⚠${RESET} /comparator — ${res.status} (${ms}ms)`);
      failed++;
    }
  } catch (e) {
    console.log(`  ${RED}✗${RESET} /comparator — FAILED (${e.message})`);
    failed++;
  }
}

// ── Main ────────────────────────────────────────────────────────────────────

console.log();
console.log(`${CYAN}PREFLIGHT Endpoint Health Check${RESET}`);
console.log('─'.repeat(55));
console.log(`  ${CYAN}ℹ${RESET} Base URL: ${BASE_URL}`);
console.log(`  ${CYAN}ℹ${RESET} Timeout: ${TIMEOUT}ms per request`);
console.log();

console.log(`${CYAN}Core Endpoints${RESET}`);
for (const test of coreTests) await probe(test);

if (RUN_ALL) {
  console.log();
  console.log(`${CYAN}Extended Endpoints${RESET}`);
  for (const test of extendedTests) await probe(test);
}

console.log();
console.log(`${CYAN}Comparator Endpoint${RESET}`);
await probeComparator();

console.log();
console.log('─'.repeat(55));
const total = passed + failed;
if (failed === 0) {
  console.log(`${GREEN}All ${total} endpoint(s) healthy.${RESET}`);
} else {
  console.log(`${RED}${failed}/${total} endpoint(s) failed.${RESET}`);
}
console.log(`  Passed: ${passed}  Failed: ${failed}`);
console.log();

process.exit(failed > 0 ? 1 : 0);

// ── Util ────────────────────────────────────────────────────────────────────

function getArg(flag) {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 && idx + 1 < process.argv.length ? process.argv[idx + 1] : null;
}
