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
