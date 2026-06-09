# AgentState

**Agents have memory. They don't have state.**

An agent remembers what you *said*. It doesn't know whether this refund has *already been issued*. So it reads the thread, decides "looks like we still owe a refund," and pays out twice.

AgentState is a small, open, governed **state layer** that sits underneath any agent framework. The model *proposes* actions; a deterministic engine *adjudicates* them against object state, role limits, and risk rules — then records every change in an append-only ledger.

> It's not another agent framework. It's the gate every agent should pass through before it touches anything real.

---

## The 30-second demo

A plain agent calls the refund API directly. It double-pays:

```
💸 Order o-1001 paid out $300 on a $150 order.
   No record of why. No idea it double-paid. This is today's default.
```

The same agent, through AgentState:

```
✅ APPLIED          anna refunds o-1001 $150            → RefundIssued
⛔ DENIED           anna refunds o-1001 $150 again      → refund_exceeds_remaining: already refunded 150
✋ NEEDS_APPROVAL   anna (agent, ≤$200) refunds $800    → exceeds agent limit 200
✅ APPLIED          …approved by Sara (supervisor)      → RefundIssued
⛔ DENIED           close ticket with an open promise   → 1 unkept promise(s): t-1-p1(pending)
```

Run it yourself:

```bash
npm install
npm run demo
```

---

## Why a separate layer

LLM "memory" is a stack of notes that get re-read every turn, can be read out of order, and have no single authoritative *now*. That is fine for *what was said*. It is the wrong substrate for *what is true*:

- **Memory** answers "what did the customer tell us?" — append, recall, summarize.
- **State** answers "has this refund been issued? is this ticket closed? what did we promise?" — one authoritative value, changed only through governed actions.

Most agent stacks today blur the two and let the model write directly to the world. AgentState pulls the world-changing handful of operations out into typed, governed **actions**, and leaves the conversation in the chat log where it belongs.

## The model

Four primitives. The *grammar* is identical across domains; only the *vocabulary* changes.

| Primitive | What it is |
|-----------|-----------|
| **Object** | A typed, persistent record of the situation right now (`Order`, `Ticket`). Identified by `(type, id)`. |
| **Action** | A first-class, governed operation — the *only* way state changes. Carries `precondition → permission → riskGuard → effect`. |
| **Event** | An append-only ledger entry: who acted, on what state, why it was allowed, and the result. |
| **Projection** | Current state is a fold over the event ledger — `replay()` rebuilds it from events alone. |

```ts
import { Engine, SqliteStorage } from "agentstate";

const engine = new Engine(new SqliteStorage()).register(issueRefund);

const decision = engine.requestAction(
  "issue_refund",
  { order_id: "o-1001", amount: 150, reason: "defective" },
  "anna",
);
// → { status: "applied" | "denied" | "needs_approval", ... }
```

An action declares its guards instead of burying them in if-else:

```ts
export const issueRefund: ActionDef = {
  name: "issue_refund",
  input: z.object({ order_id: z.string(), amount: z.number().positive(), reason: z.string().min(1) }),

  precondition(ctx) {                       // invariants bound to object state
    const o = ctx.get("Order", ctx.input.order_id);
    if (!o) deny("order_not_found", "...");
    if (ctx.input.amount > o.amount - o.refunded_amount)
      deny("refund_exceeds_remaining", "...");   // double refund is impossible
  },
  permission(ctx) {                         // authority bound to role × amount
    if (ctx.input.amount > REFUND_LIMIT[ctx.actor.role]) requireApproval("...", "senior");
  },
  riskGuard(ctx) {                          // abuse bound to derived facts (90-day total)
    /* sum prior RefundIssued events for this customer → require approval over threshold */
  },
  effect(ctx) {                             // the state change + the event to record
    return { writes: [updatedOrder], event: { type: "RefundIssued", /* ... */ } };
  },
};
```

The LLM never reaches `effect`. It can only `request_action`; the engine runs the guards and decides.

## Use it from an MCP client (Claude Desktop, etc.)

AgentState ships as an [MCP](https://modelcontextprotocol.io) server exposing exactly four tools:

`get_object` · `list_available_actions` · `request_action` · `get_audit_trail`

```bash
npm run mcp        # serves the customer-support example over stdio
```

```jsonc
// claude_desktop_config.json
{
  "mcpServers": {
    "agentstate": {
      "command": "npx",
      "args": ["tsx", "examples/customer-support/mcp.ts"],
      "cwd": "/absolute/path/to/agentstate"
    }
  }
}
```

Now ask Claude to refund the same order twice — it physically cannot, and `get_audit_trail` shows you exactly why.

## What's in here

```
agentstate/
├── src/
│   ├── core/        Object · Action · Policy guards · Event · Engine
│   ├── storage/     SQLite append-only ledger + rebuildable projection
│   └── mcp/         the four governed MCP tools
├── examples/
│   └── customer-support/   schema · actions · seed · the comparison demo
├── test/            allowed / denied / needs-approval / replay
└── docs/            manifesto.md · quickstart.md
```

## Status

`v0` — deliberately minimal: core runtime + MCP server + one worked example + the demo. No Studio, no UI, no multi-tenant, no connectors yet. The point of v0 is a single command that runs and shows a governed agent out-refusing a naive one. See [`docs/manifesto.md`](docs/manifesto.md) for the thinking and [`docs/quickstart.md`](docs/quickstart.md) to build your own actions.

## License

[Apache-2.0](LICENSE).
