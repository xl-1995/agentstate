# Agent frameworks built the wrong layer

*The missing piece isn't another control layer. It's a state layer.*

---

There's a question you can ask that makes the whole AI-agent stack go quiet:

> Would you let the AI issue refunds by itself?

People who are otherwise bullish on autonomous agents hesitate here, and the hesitation is correct. Not because the model can't *figure out* that a refund is warranted — it usually can — but because nothing in the stack stops it from issuing that refund **twice**. It reads the conversation, decides "looks like we still owe this customer," calls the refund API, and a follow-up message later, reads the thread again and does it again. The money is gone. There's no record of why. The system never even knew it double-paid.

This isn't a model-quality problem. A smarter model still has no authoritative answer to "has this refund already happened?" — because that answer doesn't live anywhere it can trust.

## Memory is not state

Today's agents have **memory**: a growing pile of notes, re-read every turn, summarized when they get long, occasionally read out of order. Memory is a wonderful tool for one job — remembering *what was said*. It is the wrong tool for a different job that we keep asking it to do: knowing *what is true*.

These are different substrates:

- **Memory** answers *"what did the customer tell us?"* You append to it, recall from it, summarize it. Fuzziness is tolerable.
- **State** answers *"has this refund been issued? is this ticket closed? what did we promise, and did we keep it?"* Here there must be exactly one authoritative value, and it must change only in controlled ways.

An agent that runs its world-changing decisions off memory will, given enough turns, read a stale note and act on it. That's not a bug you can prompt your way out of. It's a category error: using the *what-was-said* substrate to answer *what-is-true* questions.

## The ecosystem optimized the crowded layer

Look at where the energy has gone. LangGraph, Dify, OpenClaw, a hundred orchestration frameworks — they're all building the **control layer**: who gets called, how work is routed, how the *conversation's* state machine advances. It's genuinely useful work, and it is also deeply crowded.

Underneath it sits a quieter question that almost nobody owns:

> What is true in the world right now, and which changes to it is this agent allowed to make?

Here's a tell that the gap is real and not imagined. The serious agent products *do* reach for typed, stateful, constrained objects — but only for themselves. They'll build a proper state machine to manage their own reminders, their own billing, their own internal commitments. The capability is clearly within reach; they use it the moment they need it. They just never point it at **your** world — your refunds, your tickets, your shipments. The governance is all turned inward. Outward, toward the business the agent actually touches, there's nothing.

## What the missing layer looks like

It's four primitives, and the striking thing is how little changes from one industry to the next:

- **Object** — a typed, persistent record of the situation right now. An `Order`, a `Ticket`. Identified, durable, with one authoritative current value.
- **Action** — a first-class, *governed* operation, and the only way state ever changes. It carries a precondition (bound to object state), a permission (bound to role and limits), a risk guard (bound to derived facts), an effect, and an event.
- **Event** — an append-only ledger entry: who acted, on what state, why it was allowed, and the result.
- **Projection** — current state is a fold over the ledger. You can throw the projection away and rebuild it from events alone.

The model never reaches the effect. It can *propose* an action — `request_action("issue_refund", …)` — and a deterministic engine decides whether it happens. **The model proposes; the system adjudicates.**

Notice what this does to the double-refund. You don't *detect* the second refund and reject it. You bind the action to state — `amount ≤ order.amount − order.refunded_amount` — and once the order is fully refunded, the remaining amount is zero, and a second refund is no longer *caught*; it's **structurally impossible**. The same shape handles "ship once," "close once," "don't exceed the credit limit."

And notice what it does to the audit. When someone asks "why was this order refunded $800?", the answer is a row in a ledger — *by anna, approved by sara, reason: late delivery* — not an archaeology dig through a chat transcript. Auditability stops being a feature you bolt on. It's the storage model.

## A useful discipline: derive the ontology from the decisions

There's a failure mode lurking here, and it's worth naming because it kills projects like this. You do **not** start by drawing a beautiful domain model and then going to look for what it's good for. That's how you end up asking developers to rewrite their entire domain for a payoff they can't see.

You start from the other end: *which actions must be performed safely?* Then you work backwards — what objects must exist, in which states, for those actions to be allowed? Build exactly the schema the decisions demand, and not one field more. The ontology is the residue of the governance you need, not a monument you erect first.

## Grammar is horizontal; vocabulary is yours

Lay the customer-support model next to a CRM model, a logistics model, an approvals model, and the same *grammar* keeps appearing: state transitions need preconditions; changes are idempotent via state; authority is tiered by role; over-limit escalates to approval; missing fields block completion; deadlines become tracked obligations. "Refund limit by role" and "discount limit by role" and "release-on-payment" are the same sentence in different words.

That grammar is horizontal, and it's worth standardizing — the way "a payment" became a reusable primitive, the way "durable execution" did. The *vocabulary* — which objects, which thresholds, which connectors — is per-domain, and that's where the real know-how accumulates.

## What this is, and what it isn't

So here's the honest framing, including the part it's tempting to skip.

This is **not** another agent framework, and it's not trying to win the control layer. It sits underneath whatever orchestrator you already use. Think of it as the brake and the logbook: the model does the thinking; the state layer governs the few moves that actually change the world, and records every one.

And it does **not** try to be the whole agent. Most of a great customer-support experience is understanding intent, empathy, writing the reply — that's the model's job. The state layer is the seatbelt strapped over the handful of moves that lose money or break trust. Don't sell the seatbelt as the car.

There's also a fair challenge worth answering out loud: *AI writes code fast — can't anyone clone this?* The runtime, yes. Which is exactly why the defensible moves are getting the abstraction right, occupying the category, and accumulating vocabulary and battle-tested connectors — not guarding source. Cheap code is the argument *for* being open, fast, and first, not against it.

## It's open. Here's the repo.

The earlier draft of this argument ended with "so I'm going to build an agent framework" — which contradicted its own thesis. Here's the corrected ending:

It's **not** another agent framework. It's the state gate every agent should pass through before it touches anything real. It's open-source, Apache-2.0, and one command runs the whole thing:

```bash
git clone https://github.com/xl-1995/agentstate && cd agentstate
npm install && npm run demo
```

You'll watch a plain agent pay out $300 on a $150 order, and then watch the same agent — through the state layer — get told *no* the second time, with the receipt to prove it.

→ **[github.com/xl-1995/agentstate](https://github.com/xl-1995/agentstate)**
