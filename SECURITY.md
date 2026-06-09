# Security Policy

## Scope

AgentState is a governance and audit layer — its entire reason for existing is to be a trustworthy boundary between an LLM and the operations that change your world. Security issues are therefore taken seriously, with particular attention to:

- **Guard bypass** — any way to make `request_action` apply an effect without all of an action's `precondition` / `permission` / `riskGuard` passing.
- **Ledger integrity** — any way to mutate or delete an already-appended event, or to make the projection diverge from the ledger such that `replay()` no longer reproduces live state.
- **Privilege escalation** — any way for an actor to perform or approve an action beyond their role's authority.
- **Transaction safety** — any way a denied or needs-approval outcome could leave a partial write behind.

## Supported versions

AgentState is at `v0` (alpha). Security fixes land on `main`; there is no LTS branch yet.

## Reporting a vulnerability

Please **do not** open a public issue for a security vulnerability. Instead, use GitHub's private vulnerability reporting:

> Repository → **Security** tab → **Report a vulnerability**

Include a description, reproduction steps, and the impact you believe it has. We aim to acknowledge reports promptly and will coordinate a fix and disclosure timeline with you.

## A note on threat model

AgentState governs *what an agent is allowed to change* and *records every change*. It is not, by itself, a sandbox for arbitrary code, an authentication system, or a secrets manager. Run it behind your own authn/authz boundary, and treat the `Storage` backend and the host process with the same care as any system of record.
