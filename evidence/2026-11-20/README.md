# Paid app run, 2026-11-20 (Ethereum Sepolia testnet)

One Counterparty Check run (missions #192 Legal and #191 Institutional Markets) on a large regulated bank, the opposite case to yesterday's Garantex run: the app should not stop a clean counterparty, and should still send it to a person where the evidence is not clean. Paid from the same Telegraph escrow deposit with test USDC; every paid ask carries its receipt (`receipt_hash`, `rail: "escrow"`).

| Input | Run record | Paid asks | Cost | Median latency | Decision |
|---|---|---|---|---|---|
| `input-counterparty-deutsche-bank.json` | `2026-11-20T17-56-39-411Z-deutsche-bank.json` | 7 | $0.07 | 12.1 s | REVIEW |

What the run found:

- **Registry:** the closest GLEIF record is "DEUTSCHE BANK AKTIENGESELLSCHAFT", LEI `7LTWFZYICNSX8D621K86`, DE. The legal name differs from the name asked ("AG" is the abbreviation), so the app asks a person to confirm it is the intended entity instead of passing it.
- **Sanctions:** no match for the bank or its CEO, Christian Sewing, on OFAC SDN, OFAC Consolidated, the UK Sanctions List or Canada's autonomous sanctions.
- **Regulatory filings:** 4 filings mentioning Deutsche Bank in the last 12 months.
- **Adverse media:** a search answer links the bank to a past $7.2 billion settlement, flagged for a person to read rather than scored.
- **Claim:** "headquartered in Frankfurt am Main" came back true.
- **Market value:** about $60.4 billion (DB).

Compared with 2026-11-19, the sanctions screen was answered by a different Provider (Sanctions Name Evidence, miner 710637, instead of TxLens), and so was the claim check (LiveCert).

**Related party:** three of the seven checks (registry, filings, market figure) were answered by PREFLIGHT Infrastructure Signals, miner 20260828, which is our own miner. The run record names the Provider of every finding so this is visible.

Escrow account after this run, from the public ledger (`https://devnode.telegraphprotocol.com/v1/ledger/account/0x9B3c9555c28CA6cc1D07085d5fE81D9d229f0975`): deposited 5,000,000 (5 test USDC), charged 390,000, available 4,480,000, with 130,000 unbilled until the next ledger block.

The payment scheme and record format are described in `../2026-11-19/README.md`.

## Allocation Agent (#200 Mining & Power), scheduled runs

The agent makes its hash-or-lease call twice a day for two CAISO hubs, each from 3 escrow-paid asks ($0.03, receipts in each record).

| Run record | Hub | Call | Why |
|---|---|---|---|
| `2026-11-20T11-05-25-475Z-th_np15_gen-apnd.json` | NP15 | LEASE | leasing nets $27.77/MWh against −$9.71/MWh for hashing at $57.23/MWh power |
| `2026-11-20T11-05-33-690Z-th_sp15_gen-apnd.json` | SP15 | HASH | hashing nets $30.09/MWh: $71.07 revenue against $32.98 power and $8.00 other cost |
| `2026-11-20T15-22-04-565Z-th_np15_gen-apnd.json` | NP15 | LEASE | leasing nets $6.37/MWh against −$32.60/MWh for hashing at $78.63/MWh power |
| `2026-11-20T15-22-12-371Z-th_sp15_gen-apnd.json` | SP15 | HASH | hashing nets $47.59/MWh: $69.20 revenue against $13.62 power and $8.00 other cost |

The same day, two hubs got opposite calls, and NP15's lease margin narrowed from $27.77 to $6.37/MWh as its afternoon power price rose. The call follows the live price instead of a fixed rule.
