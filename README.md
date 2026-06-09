<div align="center">

# AgentState

### Agents have memory. They don't have state.

**An open, governed state layer that sits underneath any agent framework.**
The model *proposes*; a deterministic engine *adjudicates*; every change is an event.

[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%E2%89%A520-339933.svg?logo=node.js&logoColor=white)](package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6.svg?logo=typescript&logoColor=white)](tsconfig.json)
[![MCP](https://img.shields.io/badge/MCP-compatible-7C3AED.svg)](https://modelcontextprotocol.io)
[![Status](https://img.shields.io/badge/status-v0%20alpha-orange.svg)](docs/ROADMAP.md)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

[Quickstart](docs/quickstart.md) · [Manifesto](docs/manifesto.md) · [Architecture](docs/ARCHITECTURE.md) · [Roadmap](docs/ROADMAP.md) · [FAQ](docs/FAQ.md) · [中文](README.zh-CN.md)

▶ **[Watch the 36-second demo](https://github.com/xl-1995/agentstate/releases/download/v0.0.1/agentstate-promo.mp4)** &nbsp;·&nbsp; source: [`media/promo`](media/promo)

</div>

---

An agent remembers what you *said*. It doesn't know whether this refund has *already been issued*. So it reads the thread, decides "looks like we still owe a refund," and pays out twice.

The agent ecosystem has poured its energy into the **control layer** — who gets called, how work is routed, which tool fires. That layer is crowded. Underneath it sits a quieter, unowned question:

> **What is true in the world right now, and which changes to it is this agent allowed to make?**

AgentState is the answer as a thin, open layer. It pulls the handful of world-changing operations out of free-text reasoning into typed, governed **actions**, adjudicates each one against object state, role limits, and risk rules, and records every change in an append-only ledger. It is **not another agent framework** — it's the gate every agent should pass through before it touches anything real.

---

## The 30-second demo

A plain agent calls the refund API directly. It double-pays:

```text
💸 Order o-1001 paid out $300 on a $150 order.
   No record of why. No idea it double-paid. This is today's default.
```

The same agent, through AgentState:

```text
✅ APPLIED          anna refunds o-1001 $150            → RefundIssued
⛔ DENIED           anna refunds o-1001 $150 again      → refund_exceeds_remaining: already refunded 150
✋ NEEDS_APPROVAL   anna (agent, ≤$200) refunds $800    → exceeds agent limit 200
✅ APPLIED          …approved by Sara (supervisor)      → RefundIssued
⛔ DENIED           close ticket with an open promise   → 1 unkept promise(s): t-1-p1(pending)
```

Run it yourself — one install, one command:

```bash
git clone https://github.com/xl-1995/agentstate && cd agentstate
npm install
npm run demo      # naive agent vs. governed agent, side by side
npm test          # the guarantees: allowed / denied / needs-approval / replay
```

---

## Memory is not State

LLM "memory" is a stack of notes that get re-read every turn, can be read out of order, and have no single authoritative *now*. That's the right tool for *what was said*. It is the wrong substrate for *what is true*.

|                | **Memory** | **State** |
|----------------|------------|-----------|
| Answers        | "What did the customer tell us?" | "Has this refund been issued? Is this ticket closed?" |
| Shape          | Append-only notes, recalled & summarized | One authoritative value per object |
| Changed by     | The model, freely | Only governed actions, adjudicated |
| Failure mode   | Forgets, repeats, conflates | — (it can't refund twice) |
| Lives in       | The chat log | The state layer |

Most agent stacks blur the two and let the model write directly to the world. AgentState keeps the conversation in the chat log where it belongs, and gives the *world* a layer of its own.

---

## The model: four primitives

The **grammar** is identical across domains; only the **vocabulary** changes.

| Primitive | What it is |
|-----------|-----------|
| **Object** | A typed, persistent record of the situation right now (`Order`, `Ticket`). Identified by `(type, id)`. |
| **Action** | A first-class, governed operation — the *only* way state changes. Carries `precondition → permission → riskGuard → effect`. |
| **Event** | An append-only ledger entry: who acted, on what state, why it was allowed, and the result. |
| **Projection** | Current state is a fold over the ledger — `replay()` rebuilds it from events alone. |

```mermaid
flowchart TB
    subgraph CONTROL["🟠 Control layer — crowded, not our fight"]
        A["LangGraph · Dify · your own agent loop"]
    end

    subgraph AGENTSTATE["🟣 AgentState — the governed state layer"]
        direction TB
        MCP["MCP Server<br/>get_object · list_available_actions<br/>request_action · get_audit_trail"]
        ENG["Engine<br/><i>proposes → adjudicates</i>"]
        subgraph GUARDS["Action (first-class)"]
            direction LR
            P1["precondition<br/><i>object state</i>"] --> P2["permission<br/><i>role × limit</i>"] --> P3["riskGuard<br/><i>derived facts</i>"] --> EF["effect<br/><i>write + event</i>"]
        end
        LED[("Append-only<br/>Event ledger<br/>(source of truth)")]
        PROJ[("Current-state<br/>projection<br/>(rebuildable cache)")]
    end

    A -->|"request_action"| MCP --> ENG --> GUARDS
    ENG -->|"append"| LED
    LED -.->|"replay()"| PROJ
    ENG -->|"upsert"| PROJ
```

An action **declares** its guards instead of burying them in if-else:

```ts
export const issueRefund: ActionDef = {
  name: "issue_refund",
  input: z.object({ order_id: z.string(), amount: z.number().positive(), reason: z.string().min(1) }),

  precondition(ctx) {                       // invariants bound to object state
    const o = ctx.get("Order", ctx.input.order_id);
    if (!o) deny("order_not_found", "...");
    if (ctx.input.amount > o.amount - o.refunded_amount)
      deny("refund_exceeds_remaining", "...");      // a double refund is impossible
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

The LLM never reaches `effect`. It can only `request_action`; the engine runs the guards and decides. See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full request lifecycle.

---

## Use it from an MCP client (Claude Desktop, etc.)

AgentState ships as a [Model Context Protocol](https://modelcontextprotocol.io) server exposing exactly four tools:

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

---

## How it compares

| | Owns | AgentState's relationship |
|---|---|---|
| **LangGraph / Dify / OpenClaw** | Control: routing, orchestration | Sits **underneath** — they call `request_action` |
| **Palantir Foundry** | Enterprise object+action+audit | Same idea, but heavyweight, closed, expensive. AgentState is the thin, open, self-hosted version |
| **Temporal / durable execution** | Reliable *execution* of workflows | Complementary — AgentState governs *what is allowed to change*, not how a workflow runs |
| **Postgres + a few validators** | Storage + ad-hoc checks | What you build by hand, again, per project. AgentState makes the governance grammar a reusable primitive |

Full breakdown in [`docs/comparison.md`](docs/comparison.md).

---

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
└── docs/            manifesto · architecture · roadmap · faq · comparison · blog
```

## Documentation

| Doc | What it covers |
|-----|----------------|
| [Manifesto](docs/manifesto.md) | Why memory ≠ state, and the four claims behind the design |
| [Architecture](docs/ARCHITECTURE.md) | The request lifecycle, guard pipeline, ledger & projection, extension points |
| [Quickstart](docs/quickstart.md) | Run the demo, wire up MCP, define your own action |
| [Roadmap](docs/ROADMAP.md) | v0 → v1 → beyond, and the open-core philosophy |
| [FAQ](docs/FAQ.md) | "Isn't this just event sourcing?" and other sharp questions |
| [Comparison](docs/comparison.md) | vs agent frameworks, Palantir, Temporal, raw databases |
| [Blog: the wrong layer](docs/blog/agent-frameworks-built-the-wrong-layer.md) | The long-form argument |

## Status

`v0` — deliberately minimal: core runtime + MCP server + one worked example + the demo. No Studio, no UI, no multi-tenancy, no connectors yet. The point of v0 is a single command that runs and shows a governed agent out-refusing a naive one. The roadmap explains what's next and, just as importantly, what we're *not* rushing to build.

## Contributing

New example domains, storage backends, and tests around the guard pipeline are especially welcome. See [`CONTRIBUTING.md`](CONTRIBUTING.md).

## License

[Apache-2.0](LICENSE) — patent grant included, enterprise-safe. The grammar is meant to be a standard; build your vocabulary on top of it.
