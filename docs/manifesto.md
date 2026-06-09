# Memory is not State

A note on what AgentState is for.

## The confusion

The agent ecosystem has spent its energy on the **control layer** — who gets called, how work is routed, how tools are wired. That layer is crowded. Underneath it sits a quieter question that almost nobody owns:

> What is true in the world right now, and which changes to it is this agent allowed to make?

Today the usual answer is "memory": a growing pile of notes the model re-reads every turn. Memory is the right tool for *what was said*. It is the wrong tool for *what is true*, because it has no single authoritative value, can be read out of order, and is summarized lossily. An agent running on memory alone will, sooner or later, read a stale note and refund an order that was already refunded.

**Memory answers "what did they tell us?". State answers "has it happened?".** They are different substrates and should not be the same pile of notes.

## Four claims

1. **State deserves its own layer.** The handful of operations that change the world — issue a refund, close a ticket, ship an order — should be pulled out of free-text reasoning into typed, persistent objects with one authoritative current value.

2. **The action is a first-class citizen.** Not a tool call the model makes directly, but a governed operation with a precondition (bound to object state), a permission (bound to role and limits), a risk guard (bound to derived facts), an effect, and an event. The governance lives *on the action*, not scattered through if-else inside each tool.

3. **The model proposes; a deterministic system adjudicates.** The LLM may *request* an action. Whether it happens is decided by code that checks the rules and is the same every time. The model never writes to the world directly.

4. **Ontology is derived from decisions, not drawn first.** You don't start by modeling a beautiful domain and then hunt for what it's good for. You start from the actions you need to perform safely, and work backwards to: which objects must exist, in which states, for those actions to be allowed. Build the schema the decisions demand — nothing more.

## Why governance belongs here

Regulations and business rules are, at bottom, constraints on *which action is permitted given the current state*: a refund limit by role, a dosage cap by lab value, a release gated on payment. That is exactly an action-permission model. Putting it in the state layer — as preconditions and limits on typed actions — is more honest and more auditable than hiding it in a prompt or a tool's branches.

## What this is *not*

It is not another agent framework, and it is not trying to own the control layer. It sits **underneath** whatever orchestrator you use. Think of it as the brake and the logbook: the model does the thinking; the state layer governs the few moves that actually change the world, and records every one of them so that "why did this happen?" is answered by the ledger, not by re-reading a chat.

## Grammar vs vocabulary

Lay the customer-support model next to a CRM or logistics model and the same shape appears: state transitions need preconditions, changes are idempotent via state, authority is tiered by role, over-limit escalates to approval, missing fields block completion, deadlines become tracked obligations. That **grammar** is horizontal and worth standardizing. The **vocabulary** — which objects, which thresholds, which connectors — is per-domain. AgentState aims to be the thin, open grammar; the vocabulary is yours to fill in.
