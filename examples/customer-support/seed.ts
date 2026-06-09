import type { AgentObject } from "../../src/index";

const days = (n: number) => new Date(Date.now() + n * 24 * 60 * 60 * 1000).toISOString();

/** A small, deterministic world for the demos. */
export function buildSeed(): AgentObject[] {
  return [
    // Agents (actors), one per role tier.
    { type: "Agent", id: "anna", name: "Anna", role: "agent" },
    { type: "Agent", id: "sam", name: "Sam", role: "senior" },
    { type: "Agent", id: "sara", name: "Sara", role: "supervisor" },
    { type: "Agent", id: "system", name: "System", role: "admin" },

    // Customers.
    { type: "Customer", id: "c-1", name: "Acme Co", tier: "normal", ltv: 1200 },
    { type: "Customer", id: "c-vip", name: "Globex", tier: "vip", ltv: 50000 },

    // Orders.
    {
      type: "Order",
      id: "o-1001",
      customer_id: "c-1",
      amount: 150,
      status: "delivered",
      refund_status: "none",
      refunded_amount: 0,
      refund_window_until: days(30),
    },
    {
      type: "Order",
      id: "o-1002",
      customer_id: "c-1",
      amount: 800,
      status: "delivered",
      refund_status: "none",
      refunded_amount: 0,
      refund_window_until: days(30),
    },

    // Tickets to demonstrate promises + close rules.
    {
      type: "Ticket",
      id: "t-1",
      customer_id: "c-1",
      channel: "email",
      status: "open",
      priority: "normal",
      category: "billing",
      resolution: null,
    },
    {
      type: "Ticket",
      id: "t-2",
      customer_id: "c-vip",
      channel: "chat",
      status: "open",
      priority: "high",
      category: "delivery",
      resolution: null,
    },
  ];
}
