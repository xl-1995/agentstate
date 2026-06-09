import assert from "node:assert/strict";
import { test } from "node:test";
import { buildApp } from "../examples/customer-support/app";

const days = (n: number) => new Date(Date.now() + n * 24 * 60 * 60 * 1000).toISOString();

test("an allowed action applies and is recorded in the ledger", () => {
  const { engine } = buildApp();
  const d = engine.requestAction("issue_refund", { order_id: "o-1001", amount: 150, reason: "defective" }, "anna");
  assert.equal(d.status, "applied");
  assert.equal(engine.getObject("Order", "o-1001")?.refunded_amount, 150);
  assert.equal(engine.getObject("Order", "o-1001")?.refund_status, "full");
  assert.equal(engine.auditTrail({ type: "RefundIssued" }).length, 1);
});

test("double refund is denied (idempotent via state)", () => {
  const { engine } = buildApp();
  engine.requestAction("issue_refund", { order_id: "o-1001", amount: 150, reason: "x" }, "anna");
  const second = engine.requestAction("issue_refund", { order_id: "o-1001", amount: 150, reason: "x" }, "anna");
  assert.equal(second.status, "denied");
  assert.equal(second.status === "denied" && second.code, "refund_exceeds_remaining");
  assert.equal(engine.getObject("Order", "o-1001")?.refunded_amount, 150);
});

test("over-limit refund needs approval, then applies when approved by a higher role", () => {
  const { engine } = buildApp();
  const first = engine.requestAction("issue_refund", { order_id: "o-1002", amount: 800, reason: "late" }, "anna");
  assert.equal(first.status, "needs_approval");
  const approved = engine.requestAction(
    "issue_refund",
    { order_id: "o-1002", amount: 800, reason: "late" },
    "anna",
    { approvedBy: "sara" },
  );
  assert.equal(approved.status, "applied");
});

test("invalid input is denied, not thrown", () => {
  const { engine } = buildApp();
  const d = engine.requestAction("issue_refund", { order_id: "o-1001", amount: -5, reason: "x" }, "anna");
  assert.equal(d.status, "denied");
  assert.equal(d.status === "denied" && d.code, "invalid_input");
});

test("a ticket cannot be closed while a promise is unkept, then can after it is fulfilled", () => {
  const { engine } = buildApp();
  engine.requestAction("make_promise", { ticket_id: "t-1", kind: "callback", due_at: days(1) }, "anna");
  const blocked = engine.requestAction("close_ticket", { ticket_id: "t-1", resolution: "done" }, "anna");
  assert.equal(blocked.status, "denied");
  assert.equal(blocked.status === "denied" && blocked.code, "open_promises");

  engine.requestAction("fulfill_promise", { promise_id: "t-1-p1" }, "anna");
  const ok = engine.requestAction("close_ticket", { ticket_id: "t-1", resolution: "done" }, "anna");
  assert.equal(ok.status, "applied");
});

test("closing a ticket requires a resolution", () => {
  const { engine } = buildApp();
  const d = engine.requestAction("close_ticket", { ticket_id: "t-1", resolution: "" }, "anna");
  assert.equal(d.status, "denied");
  assert.equal(d.status === "denied" && d.code, "invalid_input");
});

test("an overdue promise expires to broken and still blocks close", () => {
  const { engine } = buildApp();
  engine.requestAction("make_promise", { ticket_id: "t-2", kind: "callback", due_at: days(-1) }, "anna");
  const expired = engine.requestAction("expire_promise", { promise_id: "t-2-p1" }, "system");
  assert.equal(expired.status, "applied");
  assert.equal(engine.getObject("Promise", "t-2-p1")?.status, "broken");
  const blocked = engine.requestAction("close_ticket", { ticket_id: "t-2", resolution: "done" }, "anna");
  assert.equal(blocked.status, "denied");
});

test("state projection is rebuildable from the ledger alone", () => {
  const { engine, storage } = buildApp();
  engine.requestAction("issue_refund", { order_id: "o-1001", amount: 100, reason: "x" }, "anna");
  const before = JSON.stringify(engine.getObject("Order", "o-1001"));
  storage.replay();
  assert.equal(JSON.stringify(engine.getObject("Order", "o-1001")), before);
});
