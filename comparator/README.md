# PREFLIGHT comparator module

`preflight-comparator.wasm` is a Telegraph V2 comparator module (wasm32-unknown-unknown,
no imports). It exports `imw_score_deterministic(truth: i64, miner: i64, spec_ptr: i32) -> i64`,
`imw_alloc(size: i32) -> i32` and `imw_free(ptr: i32, size: i32)`, and implements the
network's reference rule:

| Code | Rule |
|---|---|
| 0 Exact, 3 PassFail, any other | 10000 if miner == truth, else 0 |
| 1 AbsTol | error = \|miner − truth\| |
| 2 RelTol | error = \|miner − truth\| × 10000 / \|truth\| (128-bit) |

For AbsTol and RelTol the score is 10000 × (2·tol − error) / (2·tol), integer division,
0 once error ≥ 2·tol; a tolerance ≤ 0 allows only an exact match.

Runnable endpoint: `POST https://preflight-ssl-verification.vercel.app/comparator` with
`{"batch": [{"ground_truth_value", "miner_value", "spec": [code, tolerance]}]}`.
