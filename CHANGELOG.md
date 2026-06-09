# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/), and the project aims to follow
[Semantic Versioning](https://semver.org/) once it reaches `1.0`.

## [Unreleased]

## [0.0.1] — v0

The first public cut: a governed state layer that runs in one command and shows
a governed agent out-refusing a naive one.

### Added
- **Core runtime** — `Object`, first-class `Action` with a
  `precondition → permission → riskGuard → effect` pipeline, an append-only
  `Event` ledger, and a rebuildable current-state projection.
- **Engine** — `requestAction()` adjudicates every proposal inside a
  transaction and returns `applied` / `denied` / `needs_approval`; `seed()`
  inserts baseline objects through genesis events; `replay()` rebuilds state
  from the ledger alone.
- **SQLite storage** — append-only `events` table + `objects` projection,
  in-memory or file-backed, behind a swappable `Storage` interface.
- **MCP server** — four governed tools: `get_object`,
  `list_available_actions`, `request_action`, `get_audit_trail`.
- **Customer-support example** — `issue_refund` (idempotent, role-limited,
  risk-guarded), `make_promise` / `fulfill_promise` / `expire_promise`,
  and `close_ticket` (requires resolution, blocks on unkept promises).
- **Comparison demo** (`npm run demo`) and a **test suite** covering allowed /
  denied / needs-approval / overdue-promise / replay.
- **Documentation** — README (EN + 中文), manifesto, architecture, quickstart,
  roadmap, FAQ, comparison, and a long-form launch essay.

[Unreleased]: https://github.com/xl-1995/agentstate/compare/v0.0.1...HEAD
[0.0.1]: https://github.com/xl-1995/agentstate/releases/tag/v0.0.1
