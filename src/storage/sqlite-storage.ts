import Database from "better-sqlite3";
import type { EventFilter, Storage } from "../core/storage";
import type { AgentObject, Event } from "../core/types";

/**
 * SQLite-backed storage.
 *   - `events` is append-only: the source of truth.
 *   - `objects` is the current-state projection: a cache that `replay()` can
 *     rebuild from `events` alone, proving state is just a fold over the ledger.
 */
export class SqliteStorage implements Storage {
  private readonly db: Database.Database;

  constructor(filename = ":memory:") {
    this.db = new Database(filename);
    this.db.pragma("journal_mode = WAL");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS objects (
        type TEXT NOT NULL,
        id   TEXT NOT NULL,
        data TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (type, id)
      );
      CREATE TABLE IF NOT EXISTS events (
        seq         INTEGER PRIMARY KEY AUTOINCREMENT,
        ts          TEXT NOT NULL,
        type        TEXT NOT NULL,
        actor       TEXT NOT NULL,
        action      TEXT NOT NULL,
        reason      TEXT,
        approval_id TEXT,
        object_type TEXT NOT NULL,
        object_id   TEXT NOT NULL,
        payload     TEXT NOT NULL,
        prev_state  TEXT,
        new_state   TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_events_object ON events (object_type, object_id);
      CREATE INDEX IF NOT EXISTS idx_events_actor  ON events (actor);
    `);
  }

  getObject(type: string, id: string): AgentObject | null {
    const row = this.db
      .prepare("SELECT data FROM objects WHERE type = ? AND id = ?")
      .get(type, id) as { data: string } | undefined;
    return row ? (JSON.parse(row.data) as AgentObject) : null;
  }

  allObjects(type?: string): AgentObject[] {
    const rows = (
      type
        ? this.db.prepare("SELECT data FROM objects WHERE type = ? ORDER BY id").all(type)
        : this.db.prepare("SELECT data FROM objects ORDER BY type, id").all()
    ) as { data: string }[];
    return rows.map((r) => JSON.parse(r.data) as AgentObject);
  }

  upsertObject(obj: AgentObject): void {
    this.db
      .prepare(
        `INSERT INTO objects (type, id, data, updated_at) VALUES (?, ?, ?, ?)
         ON CONFLICT(type, id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
      )
      .run(obj.type, obj.id, JSON.stringify(obj), new Date().toISOString());
  }

  appendEvent(event: Omit<Event, "seq">): Event {
    const info = this.db
      .prepare(
        `INSERT INTO events
          (ts, type, actor, action, reason, approval_id, object_type, object_id, payload, prev_state, new_state)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        event.ts,
        event.type,
        event.actor,
        event.action,
        event.reason ?? null,
        event.approvalId ?? null,
        event.objectType,
        event.objectId,
        JSON.stringify(event.payload),
        event.prevState ? JSON.stringify(event.prevState) : null,
        event.newState ? JSON.stringify(event.newState) : null,
      );
    return { ...event, seq: Number(info.lastInsertRowid) };
  }

  listEvents(filter: EventFilter = {}): Event[] {
    const where: string[] = [];
    const params: unknown[] = [];
    if (filter.objectType) (where.push("object_type = ?"), params.push(filter.objectType));
    if (filter.objectId) (where.push("object_id = ?"), params.push(filter.objectId));
    if (filter.actor) (where.push("actor = ?"), params.push(filter.actor));
    if (filter.type) (where.push("type = ?"), params.push(filter.type));

    let sql = "SELECT * FROM events";
    if (where.length) sql += " WHERE " + where.join(" AND ");
    sql += " ORDER BY seq ASC";
    if (filter.limit) (sql += " LIMIT ?", params.push(filter.limit));

    const rows = this.db.prepare(sql).all(...params) as Record<string, unknown>[];
    return rows.map(rowToEvent);
  }

  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }

  reset(): void {
    this.db.exec("DELETE FROM events; DELETE FROM objects; DELETE FROM sqlite_sequence WHERE name='events';");
  }

  /** Rebuild the projection by folding every event's resulting snapshot in seq order. */
  replay(): void {
    const events = this.listEvents();
    this.db.exec("DELETE FROM objects;");
    for (const e of events) {
      if (e.newState) this.upsertObject(e.newState);
    }
  }

  close(): void {
    this.db.close();
  }
}

function rowToEvent(r: Record<string, unknown>): Event {
  return {
    seq: Number(r.seq),
    ts: String(r.ts),
    type: String(r.type),
    actor: String(r.actor),
    action: String(r.action),
    reason: (r.reason as string) ?? undefined,
    approvalId: (r.approval_id as string) ?? undefined,
    objectType: String(r.object_type),
    objectId: String(r.object_id),
    payload: JSON.parse(String(r.payload)),
    prevState: r.prev_state ? JSON.parse(String(r.prev_state)) : null,
    newState: r.new_state ? JSON.parse(String(r.new_state)) : null,
  };
}
