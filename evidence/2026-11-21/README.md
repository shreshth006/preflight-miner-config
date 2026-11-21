# Paid app runs, 2026-11-21 (Ethereum Sepolia testnet)

Counterparty Check (missions #192 Legal and #191 Institutional Markets) run on the test cases the Legal mission lists: an unregistered company, a name close to a sanctioned one, and mismatched jurisdictions. Paid from the same Telegraph escrow deposit with test USDC; every paid ask carries its receipt (`receipt_hash`, `rail: "escrow"`). All four inputs are marked `"sample": true`: they are tests, not engagements.

| Test | Input | Run record | Paid asks | Cost | Median latency | Decision |
|---|---|---|---|---|---|---|
| Unregistered company | `input-counterparty-unregistered-halvorsen.json` | `2026-11-21T16-32-45-117Z-halvorsen-quantum-freight.json` | 14 | $0.14 | 5.8 s | REVIEW |
| Name close to a sanctioned entity | `input-counterparty-alfa-laval.json` | `2026-11-21T16-33-32-174Z-alfa-laval-ab.json` | 12 | $0.12 | 5.5 s | REVIEW |
| Mismatched jurisdiction | `input-counterparty-siemens-wrong-jurisdiction.json` | `2026-11-21T16-34-02-401Z-siemens.json` | 8 | $0.08 | 10.4 s | REVIEW |
| Same as row 2, after the fixes below | `input-counterparty-alfa-laval.json` | `2026-11-21T16-39-38-772Z-alfa-laval-ab.json` | 12 | $0.12 | 5.2 s | REVIEW |

What the runs found:

- **Unregistered company ("Halvorsen Quantum Freight Ltd", GB, invented for the test):** three registry Providers (VulnRank via GLEIF, DataWire, and our own miner) found no entity. The claim "registered at Companies House since 2015" got no verdict from three fact-check Providers. The sanctions screen found no match, which says nothing about a company that does not exist, so the pack goes to a person instead of passing. The extra asks are the paid second opinions the app buys when an answer cannot be used.
- **Name close to a sanctioned entity (Alfa Laval AB, SE):** the Swedish engineering company shares a word with Alfa-Bank, which is on the OFAC SDN list. The sanctions Provider (Sanctions Name Evidence, miner 710637) returned no match on OFAC SDN, OFAC Consolidated, the UK list or Canada's list, so the near-name did not cause a false stop. The registry record (556587-8054, SE, active) and the claim "headquartered in Lund" both checked out.
- **Mismatched jurisdiction (Siemens AG given as FR):** the registry Provider (Praman Desk, miner 6137) answered with SIEMENS SAS, the French subsidiary (LEI `5299001X70EYQ92D3V29`), and the app asked a person to confirm it was the intended company instead of accepting it. The claim "Siemens AG is registered in France" came back False.

## Failure cases found, and what changed

1. **A search answer that echoed the query was read as adverse media.** Crossref Works Web Search (miner 49007) answered every adverse-media ask with the query itself ("Alfa Laval AB lawsuit fraud investigation sanctions"). The query contains the risk words, so the app flagged all three companies for adverse media. An answer that only repeats the search terms now counts as no results, and that makes the app buy second opinions. In the rerun (row 4), Wikipedia source search and HN search both found nothing, so the finding is "no results to read", not a hit. No Provider answering `WEB_SEARCH_GENERAL` today returned news results for these companies; that is the open gap.
2. **A token's value was taken as a company's.** The market figure for the symbol ALFA came back as $218,897, a token sharing the symbol, not Alfa Laval's listing. The canonical answer names only the symbol, not the asset. A figure that names no asset and is under $50 million is no longer taken as the company's listing (row 4 shows it as unverified).
3. **A registry "not found" written in words was reported as "no legal name given".** It is now reported as no registered entity found. This change came after the runs above, so their records keep the old wording.

The packs above are REVIEW for the right reasons now: an unknown company, a figure that can't be tied to the company, a subsidiary in place of the parent, and no adverse-media results to read. None of them stops a clean company.

**Related party:** the registry, filings and market-figure checks were partly answered by PREFLIGHT Infrastructure Signals, miner 20260828, which is our own miner. The run records name the Provider of every finding, so this is visible.

Escrow account after these runs, from the public ledger (`https://devnode.telegraphprotocol.com/v1/ledger/account/0x9B3c9555c28CA6cc1D07085d5fE81D9d229f0975`): deposited 5,000,000 (5 test USDC), charged 640,000, with 460,000 unbilled until the next ledger block, available 3,900,000.

The payment scheme and record format are described in `../2026-11-19/README.md`.

## Listing Desk (#189 Exchange): Lido DAO (LDO)

A listing review of LDO on Ethereum (contract `0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32`, treasury the Lido Aragon Agent `0x3e40D73EB977Dc6a537aF587D48316feE66E9C8c`; both checked on-chain before the run). Input: `input-listing-desk-ldo.json`.

| Run record | Paid asks | Cost | Median latency | Decision |
|---|---|---|---|---|
| `2026-11-21T17-00-51-728Z-ldo.json` | 12 | $0.12 | 4.7 s | REVIEW |
| `2026-11-21T17-05-58-729Z-ldo.json` (after fixes 1 and 2) | 10 | $0.10 | 5.5 s | REVIEW |
| `2026-11-21T17-50-32-438Z-ldo.json` (after fix 3) | 14 | $0.14 | 6.9 s | REVIEW |

What the second run found: total supply 999,999,994.672 LDO on-chain, 65,146 holders, no sanctions match for the issuer or the treasury address, $936,373 in the deepest LDO/WETH pool, @LidoFinance assessed as likely human (ChainSight), and no threat reported for lido.fi (FakeWatch). It goes to REVIEW for one reason: the contract audit. The only answer came from a miner ("openai") that does not declare `SMART_CONTRACT_AUDIT_GENERAL`, and it described owner, pause and blacklist powers that LDO's MiniMe token does not have. The desk does not use answers from a miner that doesn't declare the intent, so no audit was used and none was paid for. No declared Provider answers that intent today (bounties #224).

Failures found in the first run, and what changed:

1. **A lookalike token's pool was reported as LDO's liquidity.** Our own miner (PREFLIGHT, miner 20260828) answered $148,773,260 for LDO/WETH. The pool it picked is built on a different contract that also calls itself LDO, with no trading in 24 hours; the real LDO's deepest pool held $936,373. A pair named by symbol is now read as the most-traded contract for each symbol, so copies are dropped. The desk accepted the figure, which is why this is listed as a failure.
2. **A social check with no verdict was passed.** TxLens answered @LidoFinance with `verdict: null` and `bot_score: null`, and the desk recorded it as "assessed". Such an answer now counts as unverified, which makes the desk ask another Provider: in the second run ChainSight answered `likely_human`.
3. **Treasury check read native ETH only.** The treasury held 9.303 ETH at the block read, while the same address holds about 128 million LDO. The desk now also buys each treasury's balance of the project's own token (`WALLET_BALANCE_CHECK_GENERAL` with the token contract), and refuses an answer given in another coin. In the third run (`2026-11-21T17-50-32-438Z-ldo.json`, 14 asks, $0.14) it read 128,086,165.18 LDO. That run went to REVIEW on the audit and on social authenticity: our miner, TradeWire and TxLens all answered "inconclusive" or nothing for @LidoFinance, where ChainSight had said `likely_human` in the second run. One Provider's answer on an account is not settled evidence.

**Related party:** total supply and pool liquidity were answered by our own miner.

Escrow after these runs: charged 640,000, unbilled 680,000, available 3,680,000 of the 5,000,000 deposited.

## Allocation Agent (#200 Mining & Power), scheduled runs

The agent makes its hash-or-lease call twice a day for two CAISO hubs, each from 3 escrow-paid asks ($0.03, receipts in each record).

| Run record | Hub | Call | Why |
|---|---|---|---|
| `2026-11-21T03-23-03-558Z-th_np15_gen-apnd.json` | NP15 | LEASE | leasing nets $20.16/MWh against −$24.99/MWh for hashing at $64.84/MWh power |
| `2026-11-21T03-23-16-509Z-th_sp15_gen-apnd.json` | SP15 | HASH | hashing nets $16.19/MWh: $61.57 revenue against $37.38 power and $8.00 other cost |
| `2026-11-21T15-24-31-268Z-th_np15_gen-apnd.json` | NP15 | LEASE | leasing nets $22.09/MWh against −$17.05/MWh for hashing at $62.91/MWh power |
| `2026-11-21T15-25-04-369Z-th_sp15_gen-apnd.json` | SP15 | HASH | hashing nets $37.38/MWh: $68.95 revenue against $23.57 power and $8.00 other cost |

SP15's hashing margin more than doubled between the two runs ($16.19 to $37.38/MWh) as its power price fell from $37.38 to $23.57/MWh, while NP15 stayed on lease.
