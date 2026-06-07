# ADR-0002: Online-first with local caching

- **Status:** Accepted
- **Date:** 2026-06-04
- **Deciders:** Robert (solo developer)
- **Related:** ADR-0001 (technology stack)

## Context

The clients need to feel fast and responsive, but for a meal-planning and grocery app the value of *full* offline operation is modest. Supabase has no first-class offline sync; true offline-first would require adding PowerSync/ElectricSQL or building a custom local database + sync engine, which is the single largest source of architectural complexity for a solo project.

## Decision

Adopt an **online-first** model:

- Normal operation requires connectivity; **Supabase Postgres is always authoritative**.
- Clients keep a **local read cache** (recent recipes, current meal plan, active shopping list) for responsiveness.
- **Optimistic UI** is applied to high-frequency actions (meal logging, checking off items) and reconciled against the server, rolling back on rejection.
- **Supabase Realtime** propagates shared-household changes (best-effort; clients can re-fetch).
- Concurrent edits resolve **last-write-wins** at row/field granularity; **append-only records** (meal logs, energy logs, prepped-portion events) are never overwritten.
- There is **no offline write queue and no conflict-resolution engine**.

## Alternatives Considered

- **Offline-first via PowerSync or ElectricSQL.** Genuine offline with a Supabase path, but adds a dependency, sync complexity, and potential cost. *Rejected* for hobby scope.
- **Custom local-store + sync engine.** Maximum control, but a large build that reintroduces conflict resolution. *Rejected* now; noted as a future option.

## Consequences

### Positive
- Avoids an entire subsystem (local DB, change tracking, conflict resolution, sync scheduling), keeping code and invariants simple.
- Realtime household updates come essentially for free.

### Accepted trade-offs
- The app needs connectivity for normal use; brief gaps are tolerated via the read cache, but **full offline use is not supported**.
- A connectivity dead zone degrades to **read-only/cached** behavior.

### Reversibility
- If true offline later becomes a requirement, this is **reversible** by adding a sync layer (e.g., PowerSync's Supabase integration), without changing the domain model.
