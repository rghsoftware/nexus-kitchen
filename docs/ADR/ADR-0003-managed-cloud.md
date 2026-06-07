# ADR-0003: Managed Supabase backend; self-hosted static frontend

- **Status:** Accepted
- **Date:** 2026-06-04
- **Deciders:** Robert (solo developer)
- **Related:** ADR-0001 (technology stack)

## Context

Meal and grocery data is not sensitive enough to justify the operational burden of self-hosting or the constraints self-hosting imposes on the rest of the stack. For a solo hobby project, minimizing infrastructure work is a direct contributor to actually shipping.

## Decision

Run on **managed cloud**:

- **Supabase** (managed) for the backend; the **static web client is served by Caddy** on self-hosted infrastructure.
- **Cloud AI by default** (Anthropic / OpenAI / Gemini via Edge Functions); local AI is optional and out of scope for MVP.
- **Retain user-control guarantees:** full **data export** (JSON/CSV) and **account/data deletion**.
- **Retain open-source / copyleft licensing** — this is independent of hosting and is deliberately kept.

## Alternatives Considered

- **Self-host Supabase** (it is open source and Dockerable). Preserves data ownership and avoids platform lock-in, but reintroduces the operations burden being avoided. *Rejected* for now; noted as an **escape hatch**.
- **Custom self-hosted backend.** Maximum control, maximum effort. *Rejected.*

## Consequences

### Positive
- Near-zero **backend** operations (managed Supabase); the frontend is a static bundle Caddy serves with automatic HTTPS — trivial static hosting.
- Managed Auth, Realtime, and Storage out of the box.

### Accepted trade-offs
- **User data resides in a managed cloud** — accepted for this data class.
- **Vendor coupling** to Supabase (mitigated: PostgreSQL is portable; Supabase is self-hostable open source if needed).
- **Cost scales** if free-tier limits are exceeded (modest at hobby scale).

### Notes
- Open-source / copyleft licensing is **retained**, decoupled from the hosting decision.
- This decision commits to PostgreSQL and Supabase Auth, removing the earlier need for pluggable database/auth abstractions.
