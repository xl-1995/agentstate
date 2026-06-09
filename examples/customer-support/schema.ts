import { z } from "zod";
import type { AgentObject } from "../../src/index";

/**
 * The customer-support vocabulary. Note what is here and what is NOT:
 * the conversation (every chat line) does NOT live in the state layer — it
 * stays in the chat log. Only "what is the situation right now" lives here:
 * is this ticket closed, has this refund been issued, what did we promise.
 */

export const OrderStatus = z.enum(["paid", "shipped", "delivered", "cancelled"]);
export const RefundStatus = z.enum(["none", "partial", "full"]);
export const TicketStatus = z.enum([
  "new",
  "open",
  "pending_customer",
  "escalated",
  "resolved",
  "closed",
  "reopened",
]);
export const Role = z.enum(["agent", "senior", "supervisor", "admin"]);
export const PromiseStatus = z.enum(["pending", "fulfilled", "broken"]);

export type Order = AgentObject & {
  type: "Order";
  customer_id: string;
  amount: number;
  status: z.infer<typeof OrderStatus>;
  refund_status: z.infer<typeof RefundStatus>;
  refunded_amount: number;
  refund_window_until: string; // ISO
};

export type Customer = AgentObject & {
  type: "Customer";
  name: string;
  tier: "normal" | "vip" | "enterprise";
  ltv: number;
};

export type Ticket = AgentObject & {
  type: "Ticket";
  customer_id: string;
  channel: string;
  status: z.infer<typeof TicketStatus>;
  priority: "low" | "normal" | "high" | "urgent";
  category: string;
  resolution: string | null;
};

export type Agent = AgentObject & {
  type: "Agent";
  role: z.infer<typeof Role>;
  name: string;
};

export type Promise = AgentObject & {
  type: "Promise";
  ticket_id: string;
  kind: "callback" | "followup";
  due_at: string; // ISO
  status: z.infer<typeof PromiseStatus>;
  note: string;
};
