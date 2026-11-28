#!/usr/bin/env node
// validate-manifest.mjs — Validates telegraph/miner.yaml structure and prints its SHA-256 hash.
// Usage: node scripts/validate-manifest.mjs [path/to/miner.yaml]
//
// Exit codes:
//   0 = all checks pass
//   1 = validation errors found

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from './yaml-lite.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PATH = resolve(__dirname, '..', 'telegraph', 'miner.yaml');

const filePath = process.argv[2] ? resolve(process.argv[2]) : DEFAULT_PATH;

// ── Helpers ──────────────────────────────────────────────────────────────────

const RED   = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN  = '\x1b[36m';
const RESET = '\x1b[0m';

let errors = 0;
let warnings = 0;

function fail(msg) { console.error(`  ${RED}✗${RESET} ${msg}`); errors++; }
function warn(msg) { console.error(`  ${YELLOW}⚠${RESET} ${msg}`); warnings++; }
function pass(msg) { console.log(`  ${GREEN}✓${RESET} ${msg}`); }
function info(msg) { console.log(`  ${CYAN}ℹ${RESET} ${msg}`); }

// ── Read & Hash ──────────────────────────────────────────────────────────────

let raw;
try {
  raw = readFileSync(filePath);
} catch (e) {
  console.error(`${RED}Cannot read ${filePath}: ${e.message}${RESET}`);
  process.exit(1);
}

const sha256 = createHash('sha256').update(raw).digest('hex');

console.log();
console.log(`${CYAN}PREFLIGHT Manifest Validator${RESET}`);
console.log(`${'─'.repeat(50)}`);
info(`File: ${filePath}`);
info(`Size: ${raw.length} bytes`);
info(`SHA-256: ${sha256}`);
console.log();

// ── Parse YAML ───────────────────────────────────────────────────────────────

let manifest;
try {
  manifest = parseYaml(raw.toString('utf8'));
  pass('YAML parsed successfully');
} catch (e) {
  fail(`YAML parse error: ${e.message}`);
  process.exit(1);
}

// ── Top-Level Required Fields ────────────────────────────────────────────────

console.log();
console.log(`${CYAN}Top-Level Fields${RESET}`);

const REQUIRED_TOP = ['version', 'kind', 'id', 'slug', 'protocol', 'name', 'description', 'base_url', 'endpoints'];

for (const field of REQUIRED_TOP) {
  if (manifest[field] === undefined || manifest[field] === null || manifest[field] === '') {
    fail(`Missing required top-level field: "${field}"`);
  } else {
    pass(`"${field}" present`);
  }
}

if (manifest.kind !== 'miner') {
  warn(`"kind" is "${manifest.kind}" (expected "miner")`);
}

if (manifest.base_url && !manifest.base_url.startsWith('https://')) {
  warn(`"base_url" does not use HTTPS: ${manifest.base_url}`);
}

// ── Endpoints Validation ─────────────────────────────────────────────────────

console.log();
console.log(`${CYAN}Endpoints${RESET}`);

const endpoints = manifest.endpoints;
if (!Array.isArray(endpoints)) {
  fail('"endpoints" is not an array');
  process.exit(1);
}

pass(`${endpoints.length} endpoint(s) declared`);

const ENDPOINT_REQUIRED = ['path', 'method', 'description', 'intents'];
const VALID_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
const seenPaths = new Map();    // path → index (for duplicate detection)
const seenIntents = new Map();  // intent → [endpoint paths]

for (let i = 0; i < endpoints.length; i++) {
  const ep = endpoints[i];
  const label = ep.path || `endpoints[${i}]`;

  // Required fields
  for (const field of ENDPOINT_REQUIRED) {
    if (ep[field] === undefined || ep[field] === null || ep[field] === '') {
      fail(`Endpoint "${label}": missing required field "${field}"`);
    }
  }

  // Method check
  if (ep.method && !VALID_METHODS.has(ep.method.toUpperCase())) {
    warn(`Endpoint "${label}": unusual HTTP method "${ep.method}"`);
  }

  // Duplicate path detection
  if (ep.path) {
    if (seenPaths.has(ep.path)) {
      fail(`Duplicate endpoint path "${ep.path}" (first at index ${seenPaths.get(ep.path)}, again at ${i})`);
    } else {
      seenPaths.set(ep.path, i);
    }
  }

  // external_path consistency
  if (ep.external_path === undefined) {
    warn(`Endpoint "${label}": no "external_path" (the node may not route correctly)`);
  }

  // Intents
  if (Array.isArray(ep.intents)) {
    for (const intent of ep.intents) {
      if (typeof intent !== 'string' || intent.length === 0) {
        fail(`Endpoint "${label}": intent must be a non-empty string, got ${JSON.stringify(intent)}`);
      } else {
        if (!seenIntents.has(intent)) seenIntents.set(intent, []);
        seenIntents.get(intent).push(ep.path);
      }
    }
  } else if (ep.intents !== undefined) {
    fail(`Endpoint "${label}": "intents" must be an array`);
  }

  // Params structure
  if (ep.params) {
    if (ep.params.query) {
      const q = ep.params.query;
      if (q.required && !Array.isArray(q.required)) {
        fail(`Endpoint "${label}": params.query.required must be an array`);
      }
      if (q.optional && !Array.isArray(q.optional)) {
        fail(`Endpoint "${label}": params.query.optional must be an array`);
      }

      // Every param needs a name
      for (const param of [...(q.required || []), ...(q.optional || [])]) {
        if (!param.name) {
          fail(`Endpoint "${label}": a parameter is missing "name"`);
        }
        if (!param.type) {
          warn(`Endpoint "${label}": parameter "${param.name || '?'}" has no "type"`);
        }
      }
    }
  }
}

// ── Intent Coverage Summary ──────────────────────────────────────────────────

console.log();
console.log(`${CYAN}Intent Summary${RESET}`);
pass(`${seenIntents.size} unique intent(s) across ${endpoints.length} endpoint(s)`);

// Check for intents served by multiple endpoints (not necessarily an error)
for (const [intent, paths] of seenIntents) {
  if (paths.length > 1) {
    info(`Intent "${intent}" is served by ${paths.length} endpoints: ${paths.join(', ')}`);
  }
}

// ── Operational Fields ───────────────────────────────────────────────────────

console.log();
console.log(`${CYAN}Operational Config${RESET}`);

if (manifest.rate_limit_per_sec !== undefined) {
  pass(`rate_limit_per_sec: ${manifest.rate_limit_per_sec}`);
  if (manifest.rate_limit_per_sec > 100) {
    warn('rate_limit_per_sec > 100 — ensure your backend can sustain this under load');
  }
} else {
  warn('No "rate_limit_per_sec" set (the node will use its default backstop)');
}

if (manifest.cache_ttl_sec !== undefined) {
  pass(`cache_ttl_sec: ${manifest.cache_ttl_sec}`);
} else {
  info('No "cache_ttl_sec" set (default caching behaviour will apply)');
}

if (manifest.circuit_threshold !== undefined) {
  pass(`circuit_threshold: ${manifest.circuit_threshold}`);
} else {
  warn('No "circuit_threshold" — the node will use its default breaker');
}

if (manifest.circuit_cooldown_seconds !== undefined) {
  pass(`circuit_cooldown_seconds: ${manifest.circuit_cooldown_seconds}`);
}

// ── Summary ──────────────────────────────────────────────────────────────────

console.log();
console.log('─'.repeat(50));
if (errors === 0) {
  console.log(`${GREEN}All checks passed.${RESET} (${warnings} warning${warnings !== 1 ? 's' : ''})`);
} else {
  console.log(`${RED}${errors} error(s)${RESET}, ${warnings} warning(s).`);
}
console.log();

process.exit(errors > 0 ? 1 : 0);
