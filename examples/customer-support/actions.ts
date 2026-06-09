import { z } from "zod";
import { deny, requireApproval } from "../../src/index";
import type { ActionContext, ActionDef } from "../../src/index";
import type { Order } from "./schema";

/** Refund authority by role. Bound to role × amount — not buried in tool if-else. */
const REFUND_LIMIT: Record<string, number> = {
  agent: 200,
  senior: 1000,
  supervisor: 5000,
  admin: Number.POSITIVE_INFINITY,
};
const ROLE_RANK: Record<string, number> = { agent: 1, senior: 2, supervisor: 3, admin: 4 };
const NEXT_ROLE: Record<string, string> = { agent: "senior", senior: "supervisor", supervisor: "admin" };

/** Cumulative refunds to one customer over 90 days beyond this need a supervisor. */
const RISK_REFUND_90D = 1000;
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

function approverOutranks(ctx: ActionContext): boolean {
  if (!ctx.approval) return false;
  return ROLE_RANK[String(ctx.approval.approver.role)] > ROLE_RANK[String(ctx.actor.role)];
}

/**
 * issue_refund — the marquee action. It refuses to:
 *   - refund an order outside its window or wrong status (precondition)
 *   - refund more than what remains, i.e. refund twice (idempotency via state)
 *   - let an agent exceed their role limit without approval (permission)
 *   - quietly pay out a customer who is draining refunds (risk guard)
 */
export const issueRefund: ActionDef = {
  name: "issue_refund",
  description: "Refund money against an order. Cannot exceed the remaining refundable amount (no double refunds).",
  input: z.object({
    order_id: z.string(),
    amount: z.number().positive(),
    reason: z.string().min(1),
  }),
  precondition(ctx) {
    const { order_id, amount } = ctx.input;
    const o = ctx.get("Order", order_id) as Order | null;
    if (!o) deny("order_not_found", `Order ${order_id} does not exist`);
    if (!["paid", "shipped", "delivered"].includes(o.status)) {
      deny("order_not_refundable", `Order ${order_id} status is ${o.status}, not refundable`);
    }
    if (Date.now() > new Date(o.refund_window_until).getTime()) {
      deny("refund_window_closed", `Refund window for ${order_id} closed at ${o.refund_window_until}`);
    }
    const remaining = o.amount - o.refunded_amount;
    if (amount > remaining) {
      deny(
        "refund_exceeds_remaining",
        `Refund ${amount} exceeds remaining ${remaining} on order ${order_id} (already refunded ${o.refunded_amount})`,
      );
    }
  },
  permission(ctx) {
    const limit = REFUND_LIMIT[String(ctx.actor.role)] ?? 0;
    if (ctx.input.amount > limit) {
      if (approverOutranks(ctx)) return;
      requireApproval(
        `Refund ${ctx.input.amount} exceeds ${ctx.actor.role} limit ${limit}`,
        NEXT_ROLE[String(ctx.actor.role)],
      );
    }
  },
  riskGuard(ctx) {
    const o = ctx.get("Order", ctx.input.order_id) as Order;
    const since = Date.now() - NINETY_DAYS_MS;
    const total90d = ctx
      .events({ type: "RefundIssued" })
      .filter((e) => e.payload.customer_id === o.customer_id && new Date(e.ts).getTime() >= since)
      .reduce((sum, e) => sum + Number(e.payload.amount ?? 0), 0);
    if (total90d + ctx.input.amount > RISK_REFUND_90D) {
      if (approverOutranks(ctx)) return;
      requireApproval(
        `Customer ${o.customer_id} 90-day refunds would reach ${total90d + ctx.input.amount} (> ${RISK_REFUND_90D})`,
        "supervisor",
      );
    }
  },
  effect(ctx) {
    const o = ctx.get("Order", ctx.input.order_id) as Order;
    const refunded = o.refunded_amount + ctx.input.amount;
    const updated: Order = {
      ...o,
      refunded_amount: refunded,
      refund_status: refunded >= o.amount ? "full" : "partial",
    };
    return {
      writes: [updated],
      event: {
        type: "RefundIssued",
        objectType: "Order",
        objectId: o.id,
        reason: ctx.input.reason,
        payload: {
          amount: ctx.input.amount,
          customer_id: o.customer_id,
          prev_refunded: o.refunded_amount,
          new_refunded: refunded,
        },
      },
    };
  },
};

/** make_promise — turn "we'll call you back by X" into a tracked obligation. */
export const makePromise: ActionDef = {
  name: "make_promise",
  description: "Record a commitment to the customer (callback/followup) with a deadline, as a trackable Promise.",
  input: z.object({
    ticket_id: z.string(),
    kind: z.enum(["callback", "followup"]),
    due_at: z.string().describe("ISO timestamp"),
    note: z.string().default(""),
  }),
  precondition(ctx) {
    const t = ctx.get("Ticket", ctx.input.ticket_id);
    if (!t) deny("ticket_not_found", `Ticket ${ctx.input.ticket_id} does not exist`);
    if (["closed", "resolved"].includes(String(t.status))) {
      deny("ticket_not_open", `Cannot make a promise on a ${t.status} ticket`);
    }
  },
  effect(ctx) {
    const existing = ctx.all("Promise").filter((p) => p.ticket_id === ctx.input.ticket_id).length;
    const id = `${ctx.input.ticket_id}-p${existing + 1}`;
    const p = {
      type: "Promise",
      id,
      ticket_id: ctx.input.ticket_id,
      kind: ctx.input.kind,
      due_at: ctx.input.due_at,
      status: "pending",
      note: ctx.input.note,
    };
    return {
      writes: [p],
      event: { type: "PromiseMade", objectType: "Promise", objectId: id, payload: { due_at: p.due_at, kind: p.kind } },
    };
  },
};

/** fulfill_promise — mark a commitment kept. */
export const fulfillPromise: ActionDef = {
  name: "fulfill_promise",
  description: "Mark a Promise as fulfilled.",
  input: z.object({ promise_id: z.string() }),
  precondition(ctx) {
    const p = ctx.get("Promise", ctx.input.promise_id);
    if (!p) deny("promise_not_found", `Promise ${ctx.input.promise_id} does not exist`);
    if (p.status !== "pending") deny("promise_not_pending", `Promise ${ctx.input.promise_id} is ${p.status}`);
  },
  effect(ctx) {
    const p = ctx.get("Promise", ctx.input.promise_id)!;
    const updated = { ...p, status: "fulfilled" };
    return {
      writes: [updated],
      event: { type: "PromiseFulfilled", objectType: "Promise", objectId: p.id, payload: {} },
    };
  },
};

/** expire_promise — the deterministic "deadline passed" transition. A pending
 *  promise past its due date becomes broken (and would fire a reminder). */
export const expirePromise: ActionDef = {
  name: "expire_promise",
  description: "Flip a pending Promise to broken once its deadline has passed.",
  input: z.object({ promise_id: z.string() }),
  precondition(ctx) {
    const p = ctx.get("Promise", ctx.input.promise_id);
    if (!p) deny("promise_not_found", `Promise ${ctx.input.promise_id} does not exist`);
    if (p.status !== "pending") deny("promise_not_pending", `Promise ${ctx.input.promise_id} is ${p.status}`);
    if (Date.now() < new Date(String(p.due_at)).getTime()) {
      deny("promise_not_due", `Promise ${ctx.input.promise_id} is not yet due (${p.due_at})`);
    }
  },
  effect(ctx) {
    const p = ctx.get("Promise", ctx.input.promise_id)!;
    const updated = { ...p, status: "broken" };
    return {
      writes: [updated],
      event: { type: "PromiseBroken", objectType: "Promise", objectId: p.id, payload: { due_at: p.due_at } },
    };
  },
};

/** close_ticket — cannot close with an unresolved promise or no resolution. */
export const closeTicket: ActionDef = {
  name: "close_ticket",
  description: "Close a ticket. Requires a resolution and forbids closing while any Promise is still unkept.",
  input: z.object({
    ticket_id: z.string(),
    resolution: z.string().min(1, "a resolution is required to close a ticket"),
  }),
  precondition(ctx) {
    const t = ctx.get("Ticket", ctx.input.ticket_id);
    if (!t) deny("ticket_not_found", `Ticket ${ctx.input.ticket_id} does not exist`);
    if (t.status === "closed") deny("ticket_already_closed", `Ticket ${ctx.input.ticket_id} is already closed`);
    const unkept = ctx
      .all("Promise")
      .filter((p) => p.ticket_id === ctx.input.ticket_id && p.status !== "fulfilled");
    if (unkept.length > 0) {
      deny(
        "open_promises",
        `Cannot close ${ctx.input.ticket_id}: ${unkept.length} unkept promise(s): ${unkept.map((p) => `${p.id}(${p.status})`).join(", ")}`,
      );
    }
  },
  effect(ctx) {
    const t = ctx.get("Ticket", ctx.input.ticket_id)!;
    const updated = { ...t, status: "closed", resolution: ctx.input.resolution };
    return {
      writes: [updated],
      event: {
        type: "TicketClosed",
        objectType: "Ticket",
        objectId: t.id,
        reason: ctx.input.resolution,
        payload: {},
      },
    };
  },
};

export const customerSupportActions: ActionDef[] = [
  issueRefund,
  makePromise,
  fulfillPromise,
  expirePromise,
  closeTicket,
];
