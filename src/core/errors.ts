/**
 * Control-flow signals a guard can raise. They are caught by the engine and
 * turned into a Decision — they are not "errors" in the crash sense.
 */

export class ActionDenied extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "ActionDenied";
    this.code = code;
  }
}

export class ApprovalRequired extends Error {
  readonly requiredRole?: string;
  constructor(message: string, requiredRole?: string) {
    super(message);
    this.name = "ApprovalRequired";
    this.requiredRole = requiredRole;
  }
}

/** Deny the action outright. `code` is a stable machine-readable reason. */
export function deny(code: string, message: string): never {
  throw new ActionDenied(code, message);
}

/** Reject for now, but allow re-submission once an authorised approver signs off. */
export function requireApproval(message: string, requiredRole?: string): never {
  throw new ApprovalRequired(message, requiredRole);
}
