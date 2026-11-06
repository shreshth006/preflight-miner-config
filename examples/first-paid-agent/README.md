# Your first paid agent on Telegraph, in 90 lines

An agent that pays per request for a power price, refuses a wrong answer, asks someone else, and holds
if nobody can answer. It runs on Ethereum Sepolia with test USDC, so it costs no real money.

*Disclosure: I wrote this during Telegraph's Season II hackathon, which has cash prizes, and I run a
competing miner on this Intent. It answers in the run below.*

## What happens on a paid request

1. You `POST /engine/v1/ask` with an Intent and its parameters.
2. The node answers `402 Payment Required` with a price.
3. Your client signs a USDC payment. You need no ETH for this; the node settles it on chain.
4. The node routes to a miner and returns the answer, with a receipt in the `x-telegraph-receipt`
   header and a `signal_hash` in the body.

`@x402/fetch` handles steps 2 and 3. `maxAmountPerPayment` caps what it will sign.

## Run it

You need Node 22 or later and a Sepolia wallet **used only for testing**.

1. Get a little Sepolia ETH from any faucet. It's only needed for the next step.
2. Mint test USDC. The contract `0xcc194e1a843B658526D0D5C431f670028582Ae17` has a public
   `mint(address,uint256)`, with 6 decimals, so `1000000` is one test dollar.
3. Put the key in a file, and run:

```bash
npm install
echo 0xYOUR_TEST_KEY > ~/.telegraph-test-key && chmod 600 ~/.telegraph-test-key
TELEGRAPH_KEY_FILE=~/.telegraph-test-key npm start
```

Pass another CAISO node to price it instead: `npm start -- TH_NP15_GEN-APND`.

## What a real run looks like

From 2026-11-06. Yours may differ, because routing changes.

```text
Routed answer: Grid Awattar De ($0.01, tx 0x1b726f56617fe54a11418e4b4d90484708b674a1c36830f26e1973fdee1286c9)
  no price in the answer
  signal 0xc0f2396a7af94130b07182c4abf6432c363500ad3a7382a925005eacd2358c9b
Second opinion from 20260828: PREFLIGHT Infrastructure Signals ($0.01, tx 0x3296370a5b5d79704163a83b4f588bc8e51cb2e1e26e7ba415535c2d153a8311)
  OK: $14.24312/MWh
  signal 0x6a474612b382ab491f88cd38576b74e1d474b68218c921fbbb47120526136784
DECISION: use $14.24312/MWh
```

Both transactions are on [Sepolia Etherscan](https://sepolia.etherscan.io), so you can check them. Miner
20260828 is mine. The agent tried it because its listing mentions CAISO, so don't treat this as evidence
that it's the best source.

## The part most people skip: a paid answer can still be wrong

The first answer above cost a cent and came from a highly ranked miner, yet it had no California price.
A successful response only means a miner answered. `field_status: ok` is about the shape of the fields, not
whether they answer your question.

So check what you asked for before trusting a number. `problemWith()` rejects an answer when:

- it has no price;
- it prices a different node;
- it quotes a currency other than USD.

Write these checks for your own Intent. They only catch the failures you thought of, so they make wrong
answers less likely without ruling them out.

## Second opinions and holding

`/engine/v1/ask/{minerId}` asks a chosen miner directly. The agent picks miners whose listing mentions
CAISO and tries up to two. A miner that can't serve the request refuses without charging you.

If nothing passes, the agent says `HOLD`. For a real decision, not acting is usually better than acting on
a number you couldn't verify.

## What it costs

A request cost $0.01 here, so a run costs $0.01 to $0.03 in test USDC. Prices are set per request and can
change. A paid request usually takes 12 to 40 seconds, and the agent gives up after 90.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `Set TELEGRAPH_KEY_FILE` | The variable isn't set for this command |
| A payment error before any answer | The wallet has no test USDC, or the price is above `MAX_PER_REQUEST` |
| `TimeoutError` | A slow miner. Run it again; a request that timed out may still have been charged, so check the wallet |
| `no_compatible_miner` | That miner doesn't serve this request. You aren't charged |
| `no price in the answer` every time | The market may have no price for that hour, or nobody serves it. `HOLD` is the right outcome |

## Before using real money

This has only been run on Sepolia. Moving to another network means changing `NODE`, `NETWORK` and `USDC`.
Keep the spending cap, use a dedicated wallet, and never pass a key on the command line.

## Next steps

Change the Intent and the checks to fit your own decision. To help the network, the
[bounty board](https://github.com/telegraphprotocol/bounties) lists evaluation pools that still need
contributors, such as `ROUTE_ETA_GENERAL`, which needs five and has one.
