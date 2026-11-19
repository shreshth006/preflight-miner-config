# Paid app runs, 2026-11-19 (Ethereum Sepolia testnet)

Three applications that buy intelligence from the Telegraph network, each run on a realistic input and paid from Telegraph escrow with test USDC. Every paid ask in these files carries its Telegraph receipt (`receipt_hash`, `rail: "escrow"`), the Provider that answered, the price and the latency.

Payer: agent wallet `0x9B3c9555c28CA6cc1D07085d5fE81D9d229f0975`, escrow deposit of 5 test USDC in tx `0xe9094982e7eaa4d0fd5f997c5d1b28ee275edecfe31b4b10674e9291423b864e` on the Telegraph diamond `0x72a70e949362670Bf8bceAd24eFC5b8f950aa08b`. Its ledger account, including what has been charged, is public at `https://devnode.telegraphprotocol.com/v1/ledger/account/0x9B3c9555c28CA6cc1D07085d5fE81D9d229f0975`.

| App (mission) | Input | Run record | Paid asks | Cost | Median latency | Decision |
|---|---|---|---|---|---|---|
| Listing Desk (#189 Exchange) | `input-listing-desk-uni.json` | `2026-11-19T17-18-44-145Z-uni.json` | 8 | $0.08 | 8.1 s | REVIEW: the contract audit was routed to a miner that does not declare `SMART_CONTRACT_AUDIT_GENERAL`, so it was set aside rather than counted as a pass |
| Listing Desk, earlier run | same | `2026-11-19T17-12-59-086Z-uni.json` | 11 | $0.11 | | REVIEW: a Provider audited an empty address (the failure that led to sending the address as params) |
| Allocation Agent (#200 Mining & Power) | `input-allocator-np15-50mw-lease.json` | `2026-11-19T17-17-39-930Z-th_np15_gen-apnd.json` | 3 | $0.03 | 7.7 s | LEASE: leasing nets $25.68/MWh against −$13.79/MWh for hashing at $59.32/MWh |
| Counterparty Check (#192 Legal, #191 Institutional Markets) | `input-counterparty-garantex.json` | `2026-11-19T17-12-59-084Z-garantex-europe.json` | 10 | $0.10 | 7.1 s | STOP: "Garantex Europe OU" is a possible OFAC SDN match, which a person must confirm |

## Try the apps

- Listing Desk: https://preflight-ssl-verification.vercel.app/desk
- Allocation Agent: https://preflight-ssl-verification.vercel.app/allocator
- Counterparty Check: https://preflight-ssl-verification.vercel.app/diligence

Each page shows its decision, the evidence behind every finding, the Provider, price and receipt of each paid answer, and what stayed unverified.

## How payment works

Each ask goes to `POST https://devnode.telegraphprotocol.com/engine/v1/ask`. The node answers 402 with a payment challenge; the app signs the challenge's escrow message (EIP-191 personal_sign, the same scheme as Telegraph's own MCP server) and sends it as `X-PAYMENT`. The signature proves the request but cannot move funds; the node charges delivered asks from the escrow balance in its next ledger block, and a failed ask is never billed. Per-request x402 settlement is kept as a fallback.

## Reading a run record

Each finding has `check`, `intent`, `flag` (`ok`, `unverified`, …), `summary`, and `purchase` with `request`, `miner_name`, `cost_usd`, `signal_hash`, `duration_ms` and `receipt`. A finding is only counted when the answering Provider declares the intent and the answer actually addresses the check; anything else is shown as unverified and moves the decision to REVIEW or STOP, never to a pass.
