# FAQ

Honest answers, including to the uncomfortable questions.

---

### Isn't this just event sourcing / CQRS?

The storage shape is, yes — append-only events, current state as a projection. That part is a decades-old, well-understood pattern, and we don't claim to have invented it. The new part is **exposing it to an LLM through governed actions**: a `request_action` boundary where the model proposes and a deterministic engine adjudicates against object state, role limits, and risk rules — and where the *audit trail is the substrate*, not an afterthought. Event sourcing is the floor; the agent-facing governance is the building.

### Isn't this just memory with extra steps?

It's the opposite of memory, on purpose. Memory is for *what was said* — append, recall, summarize, tolerate fuzziness. State is for *what is true* — one authoritative value, changed only through adjudicated actions. The whole point is that an agent running on memory alone will eventually read a stale note and refund twice; state makes that structurally impossible. See [the manifesto](manifesto.md).

### Why not just Postgres and a few validator functions?

For one action in one app, that's often enough — and you should do exactly that. AgentState earns its place when you have *several* world-changing actions that all need the same governance grammar: idempotency-via-state, role-tiered limits, over-limit escalation, derived-fact risk checks, "can't complete with missing fields," deadline tracking, and a complete audit trail. Hand-rolling that grammar per action, per app, is the cost AgentState removes — and it makes the rules *declared and testable* instead of scattered through if-else.

### AI writes code so fast — can't anyone just clone this in a weekend?

The runtime code, yes. And that's precisely the point, not a counterargument. When code is cheap, nobody defends with code — you defend by getting the **abstraction** right, occupying the **category** in people's heads, and accumulating **vocabulary** (real per-domain object/action/rule sets) and **connectors** that take real-world contact to harden. Stripe didn't win because payment code is hard to write; it won by owning the abstraction of "a payment," the developer experience, and the ecosystem. Cheap code is the reason to be open, fast, and first — not a reason to stay home.

### Do I really need this for low-stakes work?

Maybe not. If a wrong action is *annoying* rather than *expensive*, "Postgres + a few checks" is a vitamin and AgentState may be overkill. The layer pays for itself where a handful of operations can lose money, break trust, or violate a rule — refunds, credits, shipments, status changes that downstream systems act on. Customer support is the sharpest *demo* of that ("would you let the AI issue refunds itself?"), even if it isn't the only place the pattern fits.

### Is it horizontal infrastructure or a vertical app?

Horizontal. AgentState is the *grammar* — the reusable primitive that lets you define objects, actions, and rules for **your** domain. It sits underneath whatever orchestrator you use (LangGraph, Dify, your own loop), the way Temporal sits under workflows. The per-domain *vocabulary* you build on top is yours; see the [comparison](comparison.md) and [roadmap](ROADMAP.md).

### Does the LLM ever change state directly?

No. That's the invariant. The model can `get_object`, `list_available_actions`, `request_action`, and `get_audit_trail`. Only `request_action` can change anything, and only by passing every guard of a registered action. The model never reaches `effect`.

### What happens on `needs_approval`?

The action is rejected *for now* with a `requiredRole`. Re-submit the identical request with `{ approvedBy: "<agent-id>" }`. The action's `permission`/`riskGuard` decides whether that approver is sufficient (typically: outranks the actor). The approval is recorded on the resulting event, so the audit trail shows who signed off.

### How does it stay consistent if two actions run at once?

Each `requestAction` runs inside a storage transaction: read state → run guards → write objects + append the event, atomically. A denied or needs-approval outcome leaves no partial write. The reference SQLite backend is synchronous and serializes naturally; a Postgres backend would use the same transactional boundary.

### Can I use it without MCP?

Yes. The engine is a plain library: `new Engine(storage).register(action)` and `engine.requestAction(...)`. MCP is one adapter over it; a REST or gRPC adapter would expose the same four operations.

### What's the license, really?

Apache-2.0 — including a patent grant, which makes it enterprise-safe and unlike copyleft licenses that scare legal teams. The runtime stays open and unencumbered on purpose: the goal is adoption and a shared mental model, not licensing leverage.

### Why "v0" and not "1.0"?

Because the abstraction hasn't been bent by enough real domains yet. v0 proves the core works and the demo lands. The honest version of "done" is several real worlds modeled on the same grammar without it cracking — and we're not there yet. Bring a domain ([CONTRIBUTING.md](../CONTRIBUTING.md)) and help get us there.
