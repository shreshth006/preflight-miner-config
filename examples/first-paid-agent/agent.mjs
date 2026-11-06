// A small paid agent on Telegraph: buy a power price, check it, ask someone else if it fails, or hold.
// Runs on Ethereum Sepolia with test USDC. The key comes from a file, never from the command line.
import { readFileSync } from 'node:fs';
import { wrapFetchWithPaymentFromConfig } from '@x402/fetch';
import { ExactEvmScheme } from '@x402/evm';
import { privateKeyToAccount } from 'viem/accounts';

const NODE = 'https://devnode.telegraphprotocol.com';
const NETWORK = 'eip155:11155111'; // Ethereum Sepolia
const USDC = '0xcc194e1a843B658526D0D5C431f670028582Ae17'; // test USDC
const MAX_PER_REQUEST = '50000'; // $0.05, in millionths of a dollar
const SECOND_OPINIONS = 2;

const INTENT = 'GRID_POWER_PRICE_GENERAL';
const PRICE_NODE = process.argv[2] ?? 'TH_SP15_GEN-APND'; // a CAISO pricing node
const hour = `${new Date().toISOString().slice(0, 13)}:00:00Z`;
const request = { intent: INTENT, params: { node_or_zone: PRICE_NODE, interval_start: hour } };

const keyFile = process.env.TELEGRAPH_KEY_FILE;
if (!keyFile) throw new Error('Set TELEGRAPH_KEY_FILE to a file holding a Sepolia test key.');
const account = privateKeyToAccount(readFileSync(keyFile, 'utf8').trim());

// The wrapper handles the 402: it signs a USDC payment and retries. The cap applies before signing.
const pay = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [{ network: NETWORK, client: new ExactEvmScheme(account) }],
  spendControls: {
    allowedAssets: [{ network: NETWORK, asset: USDC, maxAmountPerPayment: MAX_PER_REQUEST }],
  },
});

async function ask(minerId) {
  const res = await pay(`${NODE}/engine/v1/ask${minerId ? `/${minerId}` : ''}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(90_000),
  });
  const body = await res.json().catch(() => ({}));
  const header = res.headers.get('x-telegraph-receipt');
  const receipt = header ? JSON.parse(Buffer.from(header, 'base64').toString('utf8')) : null;
  return { ok: res.ok, status: res.status, body, receipt };
}

// `field_status: ok` means the fields had the right shape. It says nothing about the right market.
function problemWith(answer) {
  if (!answer.ok) return `refused: ${answer.body.error ?? answer.body.message ?? answer.status}`;
  const r = answer.body.result ?? {};
  if (typeof r.lmp_usd_per_mwh !== 'number') return 'no price in the answer';
  if (r.node_or_zone && r.node_or_zone !== PRICE_NODE) return `priced ${r.node_or_zone} instead`;
  if (r.currency && !/^usd$/i.test(r.currency)) return `quoted in ${r.currency}, not USD`;
  return null;
}

function report(label, answer, problem) {
  const who = answer.body.miner_name ?? answer.body.miner_id ?? 'no miner';
  const paid = answer.receipt
    ? `$${Number(answer.receipt.amount_uusdc) / 1e6}, tx ${answer.receipt.tx_hash}`
    : 'not charged';
  console.log(`${label}: ${who} (${paid})\n  ${problem ?? `OK: $${answer.body.result.lmp_usd_per_mwh}/MWh`}`);
  if (answer.body.signal_hash) console.log(`  signal ${answer.body.signal_hash}`);
}

// Miners that say they cover this market, skipping any already tried.
async function candidates(triedId) {
  const url = `${NODE}/api/miners?intent=${INTENT}&status=active&limit=200`;
  const miners = await (await fetch(url, { signal: AbortSignal.timeout(15_000) })).json();
  const claims = (m) =>
    /caiso|oasis/i.test([m.slug, m.name, m.description, ...(m.endpoints ?? []).map((e) => e.description)].join(' '));
  return miners.filter((m) => claims(m) && String(m.id) !== String(triedId)).map((m) => m.id);
}

const first = await ask();
let problem = problemWith(first);
report('Routed answer', first, problem);
let good = problem ? null : first;

if (!good) {
  const others = await candidates(first.body.miner_id);
  for (const id of others.slice(0, SECOND_OPINIONS)) {
    const again = await ask(id);
    problem = problemWith(again);
    report(`Second opinion from ${id}`, again, problem);
    if (!problem) {
      good = again;
      break;
    }
  }
}

console.log(good ? `DECISION: use $${good.body.result.lmp_usd_per_mwh}/MWh` : 'DECISION: HOLD, no answer passed');
