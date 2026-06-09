import type { ZodTypeAny, z } from "zod";

/**
 * An Object is a persistent, typed record that lives in the state layer.
 * It captures "what is the situation right now" — NOT the conversation.
 * Identified by (type, id).
 */
export interface AgentObject {
  type: string;
  id: string;
  [field: string]: unknown;
}

/**
 * An Event is an append-only ledger entry. The current state of every object
 * is a *projection* of the events that touched it. Every event carries:
 * who acted, on what state, why it was allowed, and the resulting change.
 */
export interface Event {
  seq: number;
  ts: string; // ISO timestamp
  type: string; // e.g. "RefundIssued"
  actor: string; // Agent id that performed the action
  action: string; // the action name that produced this event
  reason?: string;
  approvalId?: string;
  objectType: string;
  objectId: string;
  payload: Record<string, unknown>;
  prevState: AgentObject | null;
  newState: AgentObject | null;
}

/** The outcome of a request_action call. The LLM never mutates state directly. */
export type Decision =
  | { status: "applied"; events: Event[] }
  | { status: "denied"; code: string; reason: string }
  | { status: "needs_approval"; reason: string; requiredRole?: string };

/** Context handed to every guard / effect of an Action. */
export interface ActionContext<I = unknown> {
  /** Validated action input. */
  input: I;
  /** The Agent object performing the action (resolved from actorId). */
  actor: AgentObject;
  /** Present only when the action is being re-submitted with an approval. */
  approval?: { approver: AgentObject };
  /** Read any object from the state layer. */
  get(type: string, id: string): AgentObject | null;
  /** List every object of a type (the current-state projection). */
  all(type: string): AgentObject[];
  /** Read the append-only ledger — derive facts (e.g. 90-day totals) from it. */
  events(filter?: { objectType?: string; objectId?: string; actor?: string; type?: string }): Event[];
}

/** What an Action's effect produces: object writes + the event to record. */
export interface Effect {
  /** Full new state of each object the action changes (upserted). */
  writes: AgentObject[];
  /** The event to append. prev/new state of the primary object is filled in by the engine. */
  event: {
    type: string;
    objectType: string;
    objectId: string;
    payload?: Record<string, unknown>;
    reason?: string;
  };
}

/**
 * An Action is a first-class citizen. It is the ONLY way the world changes.
 * Guards run in order: precondition -> permission -> riskGuard -> effect.
 * A guard either returns (pass) or throws via deny()/requireApproval().
 */
export interface ActionDef<S extends ZodTypeAny = ZodTypeAny> {
  name: string;
  description: string;
  input: S;
  /** Invariants bound to object state (e.g. "order is within refund window"). */
  precondition?(ctx: ActionContext<z.infer<S>>): void;
  /** Authority bound to role × limits (e.g. "agent can refund <= 200"). */
  permission?(ctx: ActionContext<z.infer<S>>): void;
  /** Abuse guards bound to derived properties (e.g. "90d refund total"). */
  riskGuard?(ctx: ActionContext<z.infer<S>>): void;
  /** The state change + the event to emit. Runs only if all guards pass. */
  effect(ctx: ActionContext<z.infer<S>>): Effect;
}
