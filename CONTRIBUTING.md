# Contributing

Thanks for taking a look. AgentState is at `v0` and the surface is intentionally small.

## Getting started

```bash
npm install
npm run demo
npm test
npm run typecheck
```

## What's welcome right now

- **New example domains** under `examples/` (CRM, logistics, approvals) that stress the *grammar* — they're the best way to find where the primitives bend.
- **Storage backends** implementing the `Storage` interface (`src/core/storage.ts`) — Postgres especially.
- **Bug fixes and tests** around the guard pipeline, idempotency, and replay.

## What to hold off on

Studio / UI, multi-tenancy, auth, billing, and a pile of connectors. Those are post-v0. The goal of v0 is a tight, correct core plus a demo that shows a governed agent out-refusing a naive one.

## Conventions

- TypeScript, ESM, run via `tsx` (no build step needed for development).
- Keep the core (`src/`) free of domain vocabulary — domains live in `examples/`.
- Every new action behavior should come with a test asserting the `applied` / `denied` / `needs_approval` outcome.

## Design north star

The model proposes; a deterministic engine adjudicates; every change is an event. If a change to the code blurs that line, it probably belongs in an example or a separate package, not the core.
