# Paid app runs, 2026-11-22 (Ethereum Sepolia testnet)

## Listing Desk (#189 Exchange): Aave (AAVE)

A listing review of AAVE on Ethereum (contract `0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9`) with two treasury addresses: the Aave Ecosystem Reserve (`0x25F2226B597E8F9514B3F68F00f494cF4f286491`) and the Aave Collector (`0x464C71f6c2F760DdA6093dCB91C24c39e5d6e18c`). The token symbol and both contracts were checked on-chain before the run. Paid from the Telegraph escrow deposit with test USDC; every paid ask carries its receipt (`receipt_hash`, `rail: "escrow"`). Input: `input-listing-desk-aave.json`.

| Run record | Paid asks | Cost | Median latency | Decision |
|---|---|---|---|---|
| `2026-11-22T17-15-10-823Z-aave.json` | 14 | $0.14 | 15.3 s | REVIEW |

What the run found:

- **Total supply:** 15,999,999.687 AAVE on-chain (ChainSight, miner 302).
- **Holders:** 197,254 (LiveCert, miner 4433).
- **Sanctions:** no match for the issuer "Aave DAO" or either treasury address (Sanctions Name Evidence, miner 710637).
- **Liquidity:** $5,244,276 in the deepest AAVE/WETH pool. This matches GeckoTerminal's figure for the 0.3% Uniswap v3 pool on the real AAVE contract, which also had $1.23M of 24-hour volume. This is the check that reported a lookalike token's $148.8M pool for LDO on 2026-11-21. Since that fix, it reads the most-traded contract for each symbol.
- **Treasury holdings:** the Ecosystem Reserve holds 558,601.12 AAVE. The Collector holds none of its own token, though it held 292.35 ETH. That makes it a live treasury that keeps other assets, which only the holdings check added on 2026-11-21 can show.
- **Social and website:** @aave was assessed as likely human, and aave.com had no threat reported.

It goes to REVIEW for one reason: the contract audit. The only answer came from a miner ("openai") that does not declare `SMART_CONTRACT_AUDIT_GENERAL`, so the desk did not use it and did not pay for it. No declared Provider answers that intent (bounties #224). The same thing happened in the 2026-11-21 LDO runs. Until it changes, the desk cannot clear a listing on its own.

**Related party:** liquidity, treasury holdings, social and website were answered by PREFLIGHT Infrastructure Signals, miner 20260828, which is our own miner. The run record names the Provider of every finding.

Escrow account after this run, from the public ledger (`https://devnode.telegraphprotocol.com/v1/ledger/account/0x9B3c9555c28CA6cc1D07085d5fE81D9d229f0975`): deposited 5,000,000, charged 1,460,000, with 200,000 unbilled, available 3,340,000.

## Allocation Agent (#200 Mining & Power), scheduled run

The morning run did not happen (the machine that schedules it was asleep), so there is one pair today.

| Run record | Hub | Call | Why |
|---|---|---|---|
| `2026-11-22T17-00-30-621Z-th_np15_gen-apnd.json` | NP15 | LEASE | leasing nets $43.80/MWh against $5.44/MWh for hashing at $41.20/MWh power |
| `2026-11-22T17-00-38-889Z-th_sp15_gen-apnd.json` | SP15 | HASH | hashing nets $14.86/MWh: $69.96 revenue against $47.10 power and $8.00 other cost |
