# Bitcoin Mining Research Lab
Static, backend-free web app (index.html, app.js, sha.js, bench-core.js, worker.js, fixture.js).

## Open on iPhone
- Any static host works (GitHub Pages, Netlify Drop, Cloudflare Pages): upload this folder, open the URL in Safari, tap **Run first experiment**. HTTPS also enables the WebCrypto independent verifier.
- Local: `python3 -m http.server 8787` in this folder, then open `http://<computer-ip>:8787/` on the same Wi-Fi.
- Add to Home Screen via Safari Share sheet for full-screen use.

## Regenerate Node fixture
`node run-experiment.js` (writes fixture.js; verifies vs node:crypto and genesis block hash).

## Notes
- Midstate: SHA-256 state after header bytes 0–63; per nonce compress bytes 64–79 + padding, then outer SHA-256 of the 32-byte digest.
- AsicBoost/version rolling savings happen inside ASIC silicon; the phone only demonstrates correctness.
- Solo odds ≈ hashrate / (difficulty × 2^32 / 600). Live data: mempool.space `/api/v1/blocks` (fallback blockstream.info `/api/blocks`).
- No BTC earnings are reported.
