# Quality Standards - nexus-kitchen

**Last Updated**: 2026-06-07
**Auto-Generated**: Yes (extracted from spec corpus by `/ss:init`)

<!--
  Sections wrapped in the `ss:user-additions` ... `ss:end` HTML comment markers
  (see below) are preserved verbatim when /ss:init is re-run. Edit freely inside
  those blocks. The rest of the file is regenerated from project detection +
  your accepted reconciliation prompts on each /ss:init.
-->

---

## Quality Gates

These thresholds are enforced by `/ss:ship` before allowing merge to parent branch.

```yaml
# Overall Quality
min_quality_score: 80 # 0-100 scale (default: 80)
min_test_coverage: 80 # Percentage (default: 80)
enforce_gates: true # true/false (default: true)
```

> Note: the spec corpus mandates tracking coverage "above a minimum threshold"
> (REQ-MT-008) but names no specific percentage. `80` is the SpecSwarm "Standard"
> tier default chosen at `/ss:init`; adjust for this project's needs.

---

## Performance Budgets

Bundle-size limits below are SpecSwarm defaults. The project's **decided** runtime
budgets (from REQ-PR-_ / INV-PERF-_) are:

- **Startup to interactive:** < 3 s on baseline mobile hardware (REQ-PR-001 / INV-PERF-001)
- **Screen transitions:** < 300 ms under normal conditions (REQ-PR-002 / INV-PERF-002)
- **Cached recipe/keyword search:** < 500 ms against cached local data (REQ-PR-003 / INV-PERF-003)
- **Background refresh:** must never block the UI (REQ-PR-004 / INV-PERF-004)
- **Recipe capacity:** local read cache handles 10,000+ items efficiently (REQ-PR-005 / INV-PERF-005)

```yaml
# Bundle Size Limits
enforce_budgets: true # true/false
max_bundle_size: 500 # KB per bundle (default: 500)
max_initial_load: 1000 # KB initial load (default: 1000)
max_chunk_size: 200 # KB per code-split chunk (default: 200)
```

---

## Code Quality Metrics

```yaml
# Complexity Thresholds
complexity_threshold: 10 # Cyclomatic complexity (default: 10)
max_file_lines: 300 # Lines per file (default: 300)
max_function_lines: 50 # Lines per function (default: 50)
max_function_params: 5 # Parameters per function (default: 5)
```

---

## Testing Requirements

```yaml
# Test Coverage
require_tests: true # true/false (default: true)
test_types:
  - unit # Required
  - integration # Recommended
  - e2e # For critical flows

# Test Quality
min_assertions_per_test: 1
max_test_duration: 5000 # milliseconds per test
require_test_descriptions: true
```

> `expect.requireAssertions` is enabled in the vitest config — every test must make
> at least one assertion (vacuously-passing tests fail). Two-project setup: client
> tests run in chromium over `*.svelte.{test,spec}.{js,ts}`; server tests run in node.

---

## Code Review Standards

```yaml
# Review Requirements
require_code_review: true # true/false (default: true)
min_reviewers: 1 # Number of required reviewers (default: 1)
require_tests_for_features: true
require_tests_for_bugfixes: true
```

---

## CI/CD Requirements

```yaml
# Build & Deploy
block_merge_on_failure: true # true/false (default: true)
require_passing_tests: true
require_lint_pass: true
require_type_check_pass: true # For TypeScript projects
```

---

## Security Standards

```yaml
# Security Requirements
require_security_scan: false # Run /ss:analyze-quality before merge
block_on_critical_vulns: true
block_on_high_vulns: false
max_dependency_age: 365 # days (warn if dependency >1 year old)
```

Project security gates (from invariants):

- Every table holding user data must have **RLS enabled with explicit default-deny policies** before exposure (INV-DB-011 / INV-SEC-006).
- The **service-role key never reaches the client** — only the public anon key ships to the browser; security rests on RLS + Auth (INV-SEC-011 / INV-API-002).
- Edge Functions use **PostgREST / parameterized queries** — no string-built SQL (INV-SEC-009).
- **Logs must never contain** passwords, tokens, emails, or PII-laden request bodies (INV-SEC-008).

---

## Documentation Standards

```yaml
# Documentation Requirements
require_readme_updates: false # For new features
require_api_docs: false # For public APIs
require_changelog_entry: true # For all features/fixes
```

---

## Custom Quality Checks

### Accessibility (calm, ADHD-friendly UX)

- Touch targets ≥ **44pt** (`--tap-min: 44px`); kitchen display mode uses extra-large 66–96pt targets (REQ-AC-002 / INV-A11Y-001)
- **Primary flows accessible via screen readers** (REQ-AC-004 / INV-A11Y-003)
- Support system high-contrast settings; **color is never the sole indicator** of state or meaning (REQ-AC-001 / INV-A11Y-002) — no numeric WCAG ratio is stated in the corpus
- Interactive controls show a **visible focus ring** (`--focus-ring` token; `.nk-btn` focus-visible ring)
- Respect reduced-motion preferences

### Performance Monitoring

- Track startup-to-interactive, screen-transition, and cached-search budgets above
- Background data fetch must never block the UI thread

### Error Handling Pattern

- Plain-language, user-friendly errors (no stack traces); never lose user input
- Retry-with-backoff on transient / 5xx; optimistic updates roll back on server rejection and re-fetch authoritative state
- Graceful degradation when network / AI / third-party deps are unavailable
- Reaction (trigger / Edge Function) failures logged with context; the owning write fails atomically or the reaction is idempotent-retryable (invariants Appendix B)

### Audit / Data Integrity

- `meal_logs` and `portion_events` are **append-only** ledgers — never overwritten by last-write-wins (INV-CC-004 / INV-CC-006); remaining portions derived from the ledger
- Data anomalies logged with context and alerted while preserving original data

### Build-time Guardrails

- TypeScript `strict` + `allowJs` + `checkJs`
- ESLint flat config: `js.recommended` + `typescript-eslint` recommended + `eslint-plugin-svelte` recommended + prettier compatibility
- Svelte 5 runes forced project-wide
- Schema changes are versioned Supabase CLI migrations (expand-migrate-contract); types generated via `supabase gen types`
- Design-tokens-first styling (use `var(--token)` / `.nk-*` before raw values)

<!-- ss:user-additions -->
<!-- Add project-specific quality checks below. Content here is preserved on /ss:init re-run. -->
<!-- ss:end -->

---

## Exemptions

Projects can request exemptions for specific standards. Document exemptions here:

_No exemptions currently granted. Request exemptions via team discussion._

<!-- ss:user-additions -->
<!-- Document accepted exemptions below. Content here is preserved on /ss:init re-run. -->
<!-- ss:end -->

---

## Notes

- Quality level: **Standard** (80/80), chosen at `/ss:init`.
- Created by `/ss:init`; enforced by `/ss:ship` before merge.
- Pre-merge gates: `bun run check`, `bun run lint`, `bun run test` must pass.
- Invariant test checklist (invariants Appendix A): unit tests per domain INV-\*; RLS tests (cross-household denial, default-deny per table, ADMIN/MEMBER/VIEWER roles); FK/check/unique constraint tests; portion-ledger non-negativity; reaction idempotency.
- Review and adjust these standards for your team's needs.

<!-- ss:user-additions -->
<!-- Add project-specific notes below. Content here is preserved on /ss:init re-run. -->
<!-- ss:end -->

---

**Quality Enforcement**: These standards are enforced by SpecSwarm commands:

- `/ss:ship` - Blocks merge if quality gates fail
- `/ss:analyze-quality` - Reports quality score against these standards
- `/ss:build` - Can enforce quality gates with `--quality-gate` flag
