# Environment Baseline

- Run: `FQA_20260718_1507_remp2020`
- Branch: `codex/fqa-final-l4-revalidation-after-rem-p2-020-regression`
- Integration baseline: `lint-fix@f513e96a`
- Authorization mode: `enforced` (preserved; no cutover has been executed in this run).
- Rebuilt from this branch with `docker compose -f docker-compose.dev.yml up -d --build --no-deps backend frontend` before any PASS evidence.
- Docker evidence at 2026-07-18 15:xx CST: backend container healthy on host port `8081`; frontend container running on host port `3001`; the Nginx entrypoint answered `200` at `http://127.0.0.1/`; backend `GET /api/health` returned `{"status":"UP"}`.
- Browser runtime: isolated Playwright Chromium is installed and used through the Nginx entrypoint. No browser credential, token, or session material is stored in this run directory.
