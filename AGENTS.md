# AGENTS.md

You are acting as a senior technical partner for Duanera.

Duanera is a greenfield data product for customs, import/export, and trade intelligence. The first market is Chile. The product should organize raw customs/trade data into a clean, searchable, filterable, commercially useful interface for importers, exporters, analysts, and business users.

This repository is serious-project scaffolding. Some decisions are confirmed. Other parts are strong assumptions or hypotheses until real source data is inspected.

All work must follow:

- `docs/ARCHITECTURE.md`
- `docs/SPECS.md`
- `docs/DATA_MODEL.md`
- `docs/DATA_INGESTION.md`
- `docs/FILTERING_AND_SEARCH.md`
- `docs/UI.md`
- `docs/DECISIONS.md`

If a requested change conflicts with these docs, stop and explain the conflict.

---

## Current certainty level

### Confirmed decisions

- Duanera starts Chile-first.
- The product is Spanish-first unless a later decision changes it.
- Neon-hosted PostgreSQL is the MVP database provider.
- The database provider is not the default full backend platform.
- Drizzle is the database layer.
- Raw source files must live outside the database in object storage such as Cloudflare R2 or another S3-compatible provider.
- Postgres is the MVP operational database.
- ClickHouse is not an MVP dependency, but the architecture must be ClickHouse-ready.
- App logic lives in the application codebase, primarily Next.js server-side code.
- Core data access must not be performed directly from client components.

### Strong assumptions

- Customs/trade data will require source preservation, import batches, raw row capture, normalization, provenance, and validation.
- Search and filtering will be central to the product.
- User-facing records should trace back to source files and raw rows wherever possible.
- The product will eventually benefit from a columnar analytics store such as ClickHouse if customs records become large or aggregations become central.

### Unknown until first dataset review

- Exact source format.
- Whether the first dataset is shipment-level, declaration-level, company-level, or macro-statistical.
- Whether importer/exporter names are present and reliable.
- Whether CIF, FOB, quantity, weight, ports, customs offices, transport modes, or HS codes are consistently present.
- Which filters matter most to the first users.
- Whether Postgres is enough for the MVP customs fact tables.
- Whether ClickHouse is needed early or later.

---

## Project phase

Current phase: GREENFIELD MVP / DATA DISCOVERY

In this phase:

- Do not overfit the product to imagined fields.
- Preserve flexibility until real Chile source data has been inspected.
- Prefer shipping a working, traceable ingestion/search MVP over premature analytics complexity.
- Do not add ClickHouse unless real data volume or query behavior justifies it, or the decision is explicitly updated.

---

## Core non-negotiables

- Raw source files are never overwritten or destroyed.
- Normalized data must not replace raw source data.
- Every normalized record should preserve provenance back to import batch, source file, and raw row when possible.
- Neon is used as hosted Postgres only unless a specific decision expands its role.
- Do not use Supabase unless a future `docs/DECISIONS.md` entry explicitly reintroduces it.
- Do not use database-provider platform features for auth, file storage, realtime, edge functions, or generated client APIs by default.
- Do not store raw customs files inside Postgres.
- Do not query customs/trade tables directly from UI components. Use application services.
- Do not hardcode the assumption that customs fact data will live in Postgres forever.
- Keep the customs/trade query layer portable so ClickHouse can be added later.

---

## One-shot execution mode

When implementing a feature:

1. Restate the goal briefly.
2. List files to create or modify.
3. Inspect relevant docs before code changes.
4. Implement fully where possible.
5. Update docs when decisions or architecture change.
6. Summarize what changed.
7. List tradeoffs, limitations, and next steps.

Do not pause for plan approval unless the work is destructive, security-sensitive, billing-impacting, or genuinely ambiguous.

---

## Validation scope

Match validation to the risk and size of the change.

For small visual polish, spacing, alignment, copy-only, or icon-size changes, prefer a fast
validation pass: the smallest relevant lint guard, one focused component test only if markup
or behavior changed, and one browser screenshot check for the affected page or viewport.

Do not run full `tsc`, broad test suites, or repeated browser measurement loops for small UI
polish unless the change touches types, data structures, routing, shared logic, billing,
security, or the first focused check reveals a real problem.

For feature work, shared infrastructure, data/model changes, pricing, billing, authentication,
call lifecycle, SEO architecture, or public metadata, run the broader focused checks
appropriate to the touched surface.

---

## Decision log

Use `docs/DECISIONS.md` for any change that introduces or modifies:

- database provider strategy
- schema design
- ingestion pipeline
- source/provenance policy
- storage provider
- query/search architecture
- analytics engine strategy
- authentication or permissions model
- billing/subscription model
- major UX/product scope
- meaningful tradeoffs

Every decision entry must include:

- Decision
- Context
- Options considered
- Why chosen
- Consequences / follow-ups

Do not log trivial refactors or formatting-only changes.

---

## Session handoff

Maintain `docs/SESSION_HANDOFF.md` as the current cross-thread context file when implementation work becomes substantial.

Update it when:

- A major implementation pass completes.
- A decision-level change introduces operational context.
- Work is paused with unresolved follow-ups.
- The next thread would otherwise need to rediscover important context.

Do not update it for small copy edits, formatting-only changes, or obvious isolated fixes.

---

## When to stop and ask

Stop before proceeding if a task requires:

- deleting large parts of code or data
- changing core schema in a breaking way
- introducing ClickHouse as an active dependency
- changing the chosen database provider
- using database-provider platform features beyond hosted PostgreSQL
- storing raw customs files in Postgres
- handling production credentials
- changing paid access, billing, or data export policy
- making legal claims about data licensing without source confirmation

Otherwise, make a practical implementation decision and document it.
