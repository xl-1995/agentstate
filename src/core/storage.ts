import type { AgentObject, Event } from "./types";

export interface EventFilter {
  objectType?: string;
  objectId?: string;
  actor?: string;
  type?: string;
  limit?: number;
}

/**
 * Storage holds two things and only two things:
 *   - the append-only event ledger (the source of truth)
 *   - the current-state projection (a cache rebuildable from the ledger)
 *
 * Conversation logs do NOT belong here.
 */
export interface Storage {
  getObject(type: string, id: string): AgentObject | null;
  allObjects(type?: string): AgentObject[];
  upsertObject(obj: AgentObject): void;

  /** Append an event to the ledger; storage assigns the monotonic seq. */
  appendEvent(event: Omit<Event, "seq">): Event;
  listEvents(filter?: EventFilter): Event[];

  /** Run a set of mutations atomically. */
  transaction<T>(fn: () => T): T;

  /** Wipe everything (used by examples / tests). */
  reset(): void;

  /** Rebuild the current-state projection purely from the event ledger. */
  replay(): void;

  close(): void;
}
