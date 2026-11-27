# Paid app run, 2026-11-27 (Ethereum Sepolia testnet)

The paid asks were paid from the Telegraph escrow deposit with test USDC. Each carries its receipt (`receipt_hash`, `rail: "escrow"`). The run record names the Provider of every finding.

**Outage:** our own Provider, PREFLIGHT Infrastructure Signals (miner 20260828), has been offline since 2026-11-26 11:20 UTC. Its host suspended the deployment for exceeding the free plan's usage limits. None of this run's findings came from it, and its absence shows in the registry check.

## Counterparty Check (#192 Legal): SZ DJI Technology Co., Ltd.

Input: `input-counterparty-dji.json`. DJI is a real Chinese supplier that is on OFAC's Non-SDN Chinese Military-Industrial Complex Companies (NS-CMIC) list. It is not on the SDN list.

| Run record | Paid asks | Cost | Decision |
|---|---|---|---|
| `2026-11-27T13-26-24-904Z-sz-dji-technology.json` | 14 | $0.14 | **STOP** |

What the run found:

- **Sanctions:** three Providers answered, and two of them said "no match":
  - TxLens (miner 9002) said "no match" but named no list.
  - ChainSight (miner 302) said "no match" on OFAC SDN only.

  The fixes of 23 Nov (commits f62d043 and d0d2e01) treat neither answer as a clean screen. Sanctions Name Evidence (miner 710637) gave a match score of 1 with the result left empty, which the check reads as a possible match. A person must confirm it, so the run stops. That is the right outcome for an NS-CMIC company, and the old rules would have passed it on either "no match".
- **Adverse media:** Telegraph Verity Intelligence (miner 5530) found the court ruling that upheld the DoD's designation of DJI as a Chinese military company. The check flags it for a person to read.
- **Regulatory filings:** 3 filings in the last 12 months (miner 88715), including a US International Trade Commission remedial order. None of them is a national-security designation by title.
- **Registry record:** no Provider returned DJI's legal entity. The answers tried were:
  - Brandfetch (miner 98010) returned an unrelated company, "GAM Technology Co Ltd.".
  - Praman Desk (miner 6164) returned `legal_name: null` with `active: false`.

  The check is left unverified.
- **Claim check** ("DJI is headquartered in Shenzhen"): one Provider (miner 83159274) rated it "Mostly True", but the check only accepted verdicts that begin with "True", so it ended with no verdict. Fixed in commit e72d011.

Escrow account after this run, from the public ledger (`https://devnode.telegraphprotocol.com/v1/ledger/account/0x9B3c9555c28CA6cc1D07085d5fE81D9d229f0975`): deposited 5,000,000, charged 2,330,000, with 140,000 unbilled, available 2,530,000.

## Listing Desk (#189 Exchange): Compound (COMP)

Input: `input-listing-desk-comp.json`. COMP on Ethereum (`0xc00e94Cb662C3520282E6f5717214004A7f26888`, symbol read on-chain), with two treasury addresses: the Compound Timelock (`0x6d903f6003cca6255D85CcA4D3B5E5146dC33925`) and the Comptroller (`0x3d9819210A31b4961b30EF54bE2aeD79B9c9Cd3B`). Before the run, `balanceOf` on a public RPC read 18.26 COMP for the Timelock and about 0 COMP for the Comptroller.

| Run record | Paid asks | Cost | Decision |
|---|---|---|---|
| `2026-11-27T13-29-43-427Z-comp.json` | 15 | $0.15 | REVIEW |
| `2026-11-27T13-31-52-703Z-comp.json` (after the fix) | 18 | $0.18 | REVIEW |

The first run passed two answers about the wrong subject:

- **Holders:** ChainSight (miner 302) returned 9,587,018 holders. The answer itself named the token as `0xA0b86991…` (USDC), not COMP.
- **Treasury holdings:** TxLens (miner 9002) returned 0 COMP for the Timelock. The answer named the token contract as its address, not the Timelock.

The fix is commit ab3b3bf: an answer about another address than the one asked is not used. The rerun discarded both answers and asked other Providers. They returned **224,622 holders** and **18.26 COMP** in the Timelock, which matches the on-chain reading.

Both runs go to REVIEW for the same reason as earlier reviews: the only contract-audit answer came from a miner that does not declare `SMART_CONTRACT_AUDIT_GENERAL` (#224).

## Allocation Agent (#200 Mining & Power)

| Run record | Paid asks | Cost | Call | Why |
|---|---|---|---|---|
| `2026-11-27T13-29-27-663Z-th_np15_gen-apnd.json` | 3 | $0.03 | HOLD | The power price paid from TxLens (miner 9002) was $42.95/MWh. CAISO published $35.18/MWh for the first interval of the hour and $32.84/MWh as the hour's average so far. The paid figure is more than 20% above both, so the 23 Nov check held the call. |

Escrow account after all of today's runs: deposited 5,000,000, charged 2,330,000, with 500,000 unbilled, available 2,170,000.

### SP15, 17:00 UTC

| Run record | Paid asks | Cost | Call | Why |
|---|---|---|---|---|
| `2026-11-27T17-03-32-644Z-th_sp15_gen-apnd.json` | 3 | $0.03 | HOLD | The power price paid from ChainSight (miner 302) was $45.20/MWh. For that hour, CAISO published $3.16/MWh real-time (first interval; $3.04/MWh average so far) and $0.93/MWh day-ahead. The paid figure matches neither market, so the allocator held. |

This is the first time the CAISO check has stopped the SP15 site. It is a different Provider from both NP15 cases, so three Providers have now been caught answering a power price far from the operator's own figure.
