# Quickstart

## Run the demo

```bash
npm install
npm run demo      # naive agent vs. governed agent
npm test          # the guarantees: allowed / denied / needs-approval / replay
```

## Run as an MCP server

```bash
npm run mcp                      # in-memory, ephemeral
AGENTSTATE_DB=./support.sqlite npm run mcp   # persist to a file
```

Point an MCP client at the command (see the README for a Claude Desktop config). The client gets four tools: `get_object`, `list_available_actions`, `request_action`, `get_audit_trail`.

## Define your own action

Start from the action you need to perform safely, then work backwards to the objects it touches.

```ts
import { z } from "zod";
import { deny, requireApproval } from "agentstate";
import type { ActionDef } from "agentstate";

export const shipOrder: ActionDef = {
  name: "ship_order",
  description: "Mark an order shipped. Only paid orders can ship, once.",
  input: z.object({ order_id: z.string(), carrier: z.string() }),

  precondition(ctx) {
    const o = ctx.get("Order", ctx.input.order_id);
    if (!o) deny("order_not_found", `No order ${ctx.input.order_id}`);
    if (o.status !== "paid") deny("not_shippable", `Order is ${o.status}, not paid`);
  },

  permission(ctx) {
    if (ctx.actor.role === "agent") requireApproval("agents cannot ship", "senior");
  },

  effect(ctx) {
    const o = ctx.get("Order", ctx.input.order_id)!;
    return {
      writes: [{ ...o, status: "shipped", carrier: ctx.input.carrier }],
      event: { type: "OrderShipped", objectType: "Order", objectId: o.id, payload: { carrier: ctx.input.carrier } },
    };
  },
};
```

Register it and you're done:

```ts
import { Engine, SqliteStorage } from "agentstate";

const engine = new Engine(new SqliteStorage("./app.sqlite")).register(shipOrder);
engine.seed([{ type: "Order", id: "o-1", status: "paid", /* ... */ }]);

engine.requestAction("ship_order", { order_id: "o-1", carrier: "ups" }, "sara");
```

## The guard order

Every `request_action` runs, in order:

1. **input** — Zod-validated. Bad input → `denied: invalid_input`.
2. **precondition** — invariants on object state (status, windows, idempotency).
3. **permission** — authority by role × limit. Over-limit → `needs_approval`.
4. **riskGuard** — abuse checks on derived facts (e.g. 90-day totals).
5. **effect** — the state write + the event. Runs only if everything above passed.

A guard either returns (pass) or calls `deny(code, message)` / `requireApproval(message, role)`. Re-submit a `needs_approval` action with `{ approvedBy: "<agent-id>" }` where the approver outranks the actor.

## Storage

`SqliteStorage(":memory:")` for demos and tests, `SqliteStorage("./file.sqlite")` to persist. The `events` table is append-only and is the source of truth; the `objects` table is a projection that `storage.replay()` can rebuild from events alone. Implement the `Storage` interface to back it with Postgres or anything else.
