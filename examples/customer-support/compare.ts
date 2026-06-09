/**
 * The headline demo: a plain agent that calls APIs directly vs. an agent that
 * goes through AgentState. Run with:  npm run demo
 *
 * The point in one line: the model proposes; the state layer adjudicates.
 */
import type { Decision } from "../../src/index";
import { buildApp } from "./app";

const days = (n: number) => new Date(Date.now() + n * 24 * 60 * 60 * 1000).toISOString();

const hr = (t: string) => console.log(`\n${"━".repeat(64)}\n${t}\n${"━".repeat(64)}`);
const show = (label: string, d: Decision) => {
  const tag =
    d.status === "applied" ? "✅ APPLIED" : d.status === "denied" ? `⛔ DENIED` : "✋ NEEDS_APPROVAL";
  const detail =
    d.status === "applied"
      ? d.events.map((e) => e.type).join(", ")
      : d.status === "denied"
        ? `${d.code}: ${d.reason}`
        : d.reason;
  console.log(`  ${tag.padEnd(18)} ${label}\n      → ${detail}`);
};

// ─────────────────────────────────────────────────────────────────────────────
// World A — a plain agent with NO state layer. It just calls the refund API.
// It reads the chat, thinks "looks like we haven't refunded yet", and refunds.
// Twice.
// ─────────────────────────────────────────────────────────────────────────────
hr("WORLD A · plain agent, no state layer  (it has memory, not state)");
{
  const order = { id: "o-1001", amount: 150, paid_out: 0 };
  const refundApi = (amount: number) => {
    order.paid_out += amount; // the API has no idea this is the second time
  };
  console.log("  Agent: customer is unhappy → refund $150");
  refundApi(150);
  console.log("  …customer messages again, agent re-reads the thread…");
  console.log("  Agent: looks like we still owe a refund → refund $150");
  refundApi(150);
  console.log(`\n  💸 Order ${order.id} paid out $${order.paid_out} on a $${order.amount} order.`);
  console.log("  No record of why. No idea it double-paid. This is today's default.");
}

// ─────────────────────────────────────────────────────────────────────────────
// World B — the same agent, but every state change goes through AgentState.
// ─────────────────────────────────────────────────────────────────────────────
hr("WORLD B · same agent, through AgentState  (the gate)");
const { engine, storage } = buildApp();

console.log("\n1) Double-refund is structurally impossible (idempotent via state):");
show("anna refunds o-1001 $150", engine.requestAction("issue_refund", { order_id: "o-1001", amount: 150, reason: "defective" }, "anna"));
show("anna refunds o-1001 $150 again", engine.requestAction("issue_refund", { order_id: "o-1001", amount: 150, reason: "defective" }, "anna"));

console.log("\n2) Authority is bound to role × amount — over-limit needs approval:");
show("anna (agent, ≤$200) refunds o-1002 $800", engine.requestAction("issue_refund", { order_id: "o-1002", amount: 800, reason: "late delivery" }, "anna"));
show("…re-submitted, approved by Sara (supervisor)", engine.requestAction("issue_refund", { order_id: "o-1002", amount: 800, reason: "late delivery" }, "anna", { approvedBy: "sara" }));

console.log("\n3) A ticket can't be closed while a promise is still open:");
show("anna promises a callback on t-1 (due tomorrow)", engine.requestAction("make_promise", { ticket_id: "t-1", kind: "callback", due_at: days(1), note: "call back re: refund" }, "anna"));
show("anna tries to close t-1", engine.requestAction("close_ticket", { ticket_id: "t-1", resolution: "refunded" }, "anna"));
show("anna fulfils the promise", engine.requestAction("fulfill_promise", { promise_id: "t-1-p1" }, "anna"));
show("anna closes t-1", engine.requestAction("close_ticket", { ticket_id: "t-1", resolution: "refunded + called back" }, "anna"));

console.log("\n4) A missed deadline becomes a tracked 'broken' promise — not a silent drop:");
show("anna promises a callback on t-2 (already overdue)", engine.requestAction("make_promise", { ticket_id: "t-2", kind: "callback", due_at: days(-1), note: "overdue callback" }, "anna"));
show("the deadline passes → system expires it", engine.requestAction("expire_promise", { promise_id: "t-2-p1" }, "system"));
show("anna tries to close t-2 over the broken promise", engine.requestAction("close_ticket", { ticket_id: "t-2", resolution: "done" }, "anna"));

// ─────────────────────────────────────────────────────────────────────────────
// The audit trail — every change carries who / on what state / why / result.
// ─────────────────────────────────────────────────────────────────────────────
hr("AUDIT · why was o-1002 refunded $800? The answer is in the ledger, not the chat.");
for (const e of engine.auditTrail({ objectType: "Order", objectId: "o-1002" })) {
  console.log(`  #${e.seq} ${e.ts}  ${e.type}  by ${e.actor}${e.approvalId ? ` (approved: ${e.approvalId})` : ""}`);
  console.log(`       reason: ${e.reason}  payload: ${JSON.stringify(e.payload)}`);
}

hr("PROJECTION · current state is a fold over the ledger — rebuildable from events alone.");
const before = JSON.stringify(engine.getObject("Order", "o-1001"));
console.log(`  Order o-1001 refunded_amount = ${engine.getObject("Order", "o-1001")?.refunded_amount}`);
console.log(`  Events in ledger: ${engine.auditTrail().length}`);
console.log("  Wiping the projection and replaying the entire ledger to rebuild it…");
storage.replay();
const after = JSON.stringify(engine.getObject("Order", "o-1001"));
console.log(`  State after replay matches before replay: ${before === after ? "✅ yes" : "❌ no"}`);

console.log("\nDone. The model proposed everything; the state layer decided what was allowed.\n");
