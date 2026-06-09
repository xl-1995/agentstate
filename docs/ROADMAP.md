# Roadmap

AgentState grows in **fast loops, not one big bang**. Code is cheap now; what's expensive — whether the abstraction is right, whether real agents trust it, whether the demo lands — can only be earned by shipping a small thing and watching reality hit it. So each milestone is deliberately narrow, ships, and informs the next.

---

## ✅ v0 — the gate that runs (shipped)

A single command that shows a governed agent out-refusing a naive one.

- [x] Core runtime: Object · Action · Policy guards · append-only Event ledger · rebuildable projection
- [x] Engine with the `precondition → permission → riskGuard → effect` pipeline
- [x] SQLite storage (in-memory + file-backed), `replay()` rebuilds state from events alone
- [x] MCP server: `get_object` · `list_available_actions` · `request_action` · `get_audit_trail`
- [x] Customer-support example: `issue_refund`, `make_promise → expire → broken`, `close_ticket`
- [x] The naive-vs-governed comparison demo + a test suite covering applied / denied / needs-approval / replay

**v0 is intentionally missing** a Studio, a UI, auth, multi-tenancy, billing, and connectors. None of that is needed to prove the one thing v0 exists to prove.

---

## 🔜 v0.x — sharpen the core

Driven by the first places real agents stress it.

- [ ] **A second example domain** (CRM or approvals) to test that the *grammar* holds when the *vocabulary* changes
- [ ] **One real connector**, end-to-end (e.g. a help-desk or issue tracker) — prove the layer can sit over an external system of record, not just its own ledger
- [ ] **Postgres storage backend** implementing the `Storage` interface
- [ ] A published npm package so `npx agentstate` is a true one-liner
- [ ] An `asciinema` recording of the demo in the README

## 🌅 v1 — usable beyond the demo

- [ ] A small **policy expression** helper for common preconditions, without a heavyweight rule engine
- [ ] **Audit replay & time-travel**: reconstruct "what did state look like at event #N?"
- [ ] **Promise/SLA scheduler**: deadlines that fire reminders and auto-transition, as a first-class concern
- [ ] Pluggable **approval workflows** (who can approve what, escalation chains)
- [ ] Language bindings beyond TypeScript once there's pull (a Python client to `request_action`)

## 🔭 Beyond

- [ ] A visual **audit explorer** for the ledger
- [ ] **Domain template packs** — pre-built object/action sets for common verticals
- [ ] A managed/hosted option for teams that don't want to run storage themselves

---

## The open-core line

A deliberate split runs through everything above:

- **The grammar is horizontal, open, and free.** `Object + Action(precondition/permission/risk/effect) + Event + Projection` is the same across customer support, CRM, logistics, and approvals. That belongs in the open core, and we'd love for it to become a small standard — the way "a payment" or "durable execution" became reusable primitives.
- **The vocabulary is where the value sticks.** The specific objects, thresholds, role models, and connectors for a given domain are an accumulation of real know-how. Template packs and connectors are where depth — and any future commercial layer — lives.

So the rule is simple: **commercialization, if any, sits *on top of* the core, never *inside* it.** The runtime stays open and unencumbered (Apache-2.0, patent grant included) precisely because the goal is adoption and a shared mental model, not licensing leverage.

---

## How to influence this

The fastest way to bend the roadmap is to **bring a domain**. Open an issue describing the objects, actions, and rules of a world you actually run — that's the highest-signal input we can get, because it tells us exactly where the primitives bend. See [`CONTRIBUTING.md`](../CONTRIBUTING.md).
