# pf-dashboard

Public, read-only demo of a fictional Carter household finance dashboard.
Next.js (server-rendered); the synthetic data lives in `data/*.json` and is
regenerated deterministically by `scripts/gen-demo-data.mjs`. No real people,
accounts, employers, merchants, or financial documents are represented.

## Status

This repository is a frozen snapshot of the demo, published for reference.
It is unsupported: issues and contributions are not accepted, and the
synthetic dataset is fixed — it will not be updated with new data.

## Public demo behavior

The middleware is a pass-through and pages render without a login. Mutation,
question, investment, and assistant endpoints return a disabled `405` response.
The Ask page is static and no external AI, bank, or brokerage calls are made.

## Environment variables

| Variable | Purpose |
|---|---|
No environment variables are required to build or render the demo.

## Local checks

`vercel.json` skips the build when the only changes since the last deploy
are the runtime state files the site writes through GitHub
(`overrides.json`, `instructions.json`, `questions.json`,
`session_epoch.json` — read live, never bundled) or files outside `web/`.

## Development

```bash
npm ci          # Node 24 (.nvmrc); the check suites need >= 22.15
npm run dev     # local server; set the variables above in .env.local
npm run lint    # ESLint (next/core-web-vitals); CI runs it, deploys don't wait on it
npm test        # check suites in scripts/*-checks.mjs
npm run build
```
