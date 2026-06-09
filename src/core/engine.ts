import type { ZodTypeAny } from "zod";
import { ActionDenied, ApprovalRequired } from "./errors";
import type { Storage } from "./storage";
import type {
  ActionContext,
  ActionDef,
  AgentObject,
  Decision,
  Event,
} from "./types";

export interface RequestOptions {
  /** Re-submit a previously needs_approval action, signed off by this Agent id. */
  approvedBy?: string;
}

/**
 * The Engine is the gate. The LLM proposes (request_action); the engine — a
 * deterministic system — adjudicates. Nothing changes the world except by
 * passing every guard of a registered Action.
 */
export class Engine {
  private readonly actions = new Map<string, ActionDef<ZodTypeAny>>();

  constructor(private readonly storage: Storage) {}

  register(action: ActionDef<ZodTypeAny>): this {
    if (this.actions.has(action.name)) {
      throw new Error(`Action already registered: ${action.name}`);
    }
    this.actions.set(action.name, action);
    return this;
  }

  registerAll(actions: ActionDef<ZodTypeAny>[]): this {
    for (const a of actions) this.register(a);
    return this;
  }

  list(): ActionDef<ZodTypeAny>[] {
    return [...this.actions.values()];
  }

  getObject(type: string, id: string): AgentObject | null {
    return this.storage.getObject(type, id);
  }

  /**
   * Insert baseline objects through a genesis event so that `replay()` can
   * reconstruct them — even seed data lives in the ledger, not beside it.
   */
  seed(objects: AgentObject[]): void {
    this.storage.transaction(() => {
      for (const obj of objects) {
        this.storage.upsertObject(obj);
        this.storage.appendEvent({
          ts: new Date().toISOString(),
          type: "ObjectSeeded",
          actor: "system",
          action: "seed",
          objectType: obj.type,
          objectId: obj.id,
          payload: {},
          prevState: null,
          newState: obj,
        });
      }
    });
  }

  auditTrail(filter?: Parameters<Storage["listEvents"]>[0]): Event[] {
    return this.storage.listEvents(filter);
  }

  /**
   * The single entry point through which an agent changes the world.
   * Returns applied / denied / needs_approval — never throws on a guard.
   */
  requestAction(
    name: string,
    rawInput: unknown,
    actorId: string,
    opts: RequestOptions = {},
  ): Decision {
    const def = this.actions.get(name);
    if (!def) {
      return { status: "denied", code: "unknown_action", reason: `No such action: ${name}` };
    }

    const parsed = def.input.safeParse(rawInput);
    if (!parsed.success) {
      return {
        status: "denied",
        code: "invalid_input",
        reason: parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; "),
      };
    }

    const actor = this.storage.getObject("Agent", actorId);
    if (!actor) {
      return { status: "denied", code: "unknown_actor", reason: `No such Agent: ${actorId}` };
    }

    let approval: ActionContext["approval"];
    if (opts.approvedBy) {
      const approver = this.storage.getObject("Agent", opts.approvedBy);
      if (!approver) {
        return { status: "denied", code: "unknown_approver", reason: `No such approver: ${opts.approvedBy}` };
      }
      approval = { approver };
    }

    const ctx: ActionContext = {
      input: parsed.data,
      actor,
      approval,
      get: (type, id) => this.storage.getObject(type, id),
      all: (type) => this.storage.allObjects(type),
      events: (filter) => this.storage.listEvents(filter),
    };

    try {
      return this.storage.transaction((): Decision => {
        def.precondition?.(ctx);
        def.permission?.(ctx);
        def.riskGuard?.(ctx);

        const effect = def.effect(ctx);
        const primary = effect.event;
        const prevState = this.storage.getObject(primary.objectType, primary.objectId);

        for (const obj of effect.writes) {
          this.storage.upsertObject(obj);
        }

        const newState = this.storage.getObject(primary.objectType, primary.objectId);
        const approvalId = approval ? `${approval.approver.id}@${primary.objectId}` : undefined;

        const event = this.storage.appendEvent({
          ts: new Date().toISOString(),
          type: primary.type,
          actor: actorId,
          action: name,
          reason: primary.reason,
          approvalId,
          objectType: primary.objectType,
          objectId: primary.objectId,
          payload: primary.payload ?? {},
          prevState,
          newState,
        });

        return { status: "applied", events: [event] };
      });
    } catch (err) {
      if (err instanceof ActionDenied) {
        return { status: "denied", code: err.code, reason: err.message };
      }
      if (err instanceof ApprovalRequired) {
        return { status: "needs_approval", reason: err.message, requiredRole: err.requiredRole };
      }
      throw err;
    }
  }
}
