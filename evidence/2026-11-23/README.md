# Paid app runs, 2026-11-23 (Ethereum Sepolia testnet)

Every paid ask was paid from the Telegraph escrow deposit with test USDC, and carries its receipt (`receipt_hash`, `rail: "escrow"`). The run records name the Provider of every finding.

## Allocation Agent (#200 Mining & Power): a stale power price, caught

The allocator buys hashprice, the BTC price and the power price for its site's grid node, then decides whether to hash, lease or curtail. Since 22 Nov, the power price for NP15 (`TH_NP15_GEN-APND`) has come from Praman Desk, miner 6164. That miner answered **$41.20/MWh for every hour it was asked**. CAISO's own real-time prices for those hours (OASIS `PRC_INTVL_LMP`, first 5-minute interval) were different:

| Hour (UTC) | Miner 6164 | CAISO published |
|---|---|---|
| 2026-11-22 17:00 | $41.20 | $73.29 |
| 2026-11-23 07:00 | $41.20 | $58.43 |
| 2026-11-23 15:00 | $41.20 | $87.74 |
| 2026-11-23 17:00 | $41.20 | $54.63 |

The answer was well-formed: the right node, market `RTM`, in USD. So the allocator accepted it, and the three earlier NP15 runs (one on 22 Nov, two on 23 Nov below) made a LEASE call on it, reporting that leasing nets $43.80/MWh. Re-running the same decision with the same hashprice and BTC inputs, but with CAISO's prices:

| Hour (UTC) | Call on $41.20 | Call on CAISO's price |
|---|---|---|
| 2026-11-22 17:00 | LEASE, nets $43.80/MWh | LEASE, nets $11.71/MWh |
| 2026-11-23 07:00 | LEASE, nets $43.80/MWh | LEASE, nets $26.57/MWh |
| 2026-11-23 15:00 | LEASE, nets $43.80/MWh | **CURTAIL**: $87.74 is above the $48.48 breakeven |

So the stale figure overstated the margin every time, and on 23 Nov 15:00 it produced the wrong call.

**The fix:** before the allocator uses a paid power price, it now reads the operator's own published price for that node and hour, free. If the paid figure is more than 20% (or $5) outside that price, the allocator does not use it and holds.

| Run record | Hub | Paid asks | Cost | Call | Why |
|---|---|---|---|---|---|
| `2026-11-23T07-10-57-160Z-th_np15_gen-apnd.json` | NP15 | 3 | $0.04 | LEASE | made on the stale $41.20 (before the fix) |
| `2026-11-23T07-11-10-916Z-th_sp15_gen-apnd.json` | SP15 | 3 | $0.04 | HASH | hashing nets $15.28/MWh |
| `2026-11-23T15-41-26-765Z-th_np15_gen-apnd.json` | NP15 | 3 | $0.03 | LEASE | made on the stale $41.20 (before the fix) |
| `2026-11-23T15-41-35-787Z-th_sp15_gen-apnd.json` | SP15 | 3 | $0.03 | HASH | hashing nets $17.15/MWh |
| `2026-11-23T17-10-44-613Z-th_np15_gen-apnd.json` | NP15 | 3 | $0.03 | **HOLD** | the paid $41.20 is far from CAISO's $54.63 for the hour |

The SP15 power prices came from a different Provider and were not re-checked here.

## Counterparty Check (#192 Legal): Hangzhou Hikvision Digital Technology

Input: `input-counterparty-hikvision.json`. Hikvision is a real Chinese supplier. It is named in US national-security actions (the DoD list of Chinese military companies, the FCC covered list), but it is not on the OFAC SDN list. A screen of SDN alone is therefore not clean for it.

| Run record | Paid asks | Cost | Decision |
|---|---|---|---|
| `2026-11-23T17-00-45-610Z-hangzhou-hikvision-digital-technology.json` | 8 | $0.08 | REVIEW |
| `2026-11-23T17-03-14-335Z-hangzhou-hikvision-digital-technology.json` | 8 | $0.08 | REVIEW |

In the first run, the sanctions answer (TxLens, miner 9002) was "no match" on `OFAC SDN list (treasury.gov)` only, and the check passed it as clean. The regulatory-filings check counted five Federal Register filings as mentions, although three were national-security designations or restrictions ("Notice of Availability of Designation of Chinese Military Companies" and two FCC rules on national-security threats to the communications supply chain). The run went to REVIEW only because adverse media returned nothing.

Two fixes followed (commit f62d043):

- A "no match" from one list is now unchecked, not clean.
- A filing that designates companies on national-security grounds is flagged by its title.

In the second run, the same Provider answered `matched: false, lists: null`, naming no list at all, and that also passed as clean. A third fix followed (commit d0d2e01): a "no match" that names no list is not a clean screen. Re-judged with all three fixes, the second run holds for REVIEW on the filings, with the sanctions screen unchecked.

**Related party:** the registry record and the regulatory filings were answered by PREFLIGHT Infrastructure Signals, miner 20260828, which is our own miner.

Escrow account after these runs, from the public ledger (`https://devnode.telegraphprotocol.com/v1/ledger/account/0x9B3c9555c28CA6cc1D07085d5fE81D9d229f0975`): deposited 5,000,000, charged 1,990,000, with 0 unbilled, available 3,010,000.
