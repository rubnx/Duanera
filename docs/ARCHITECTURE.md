# Architecture

## Goal

Duanera is a customs/import-export intelligence platform.

The first version focuses on Chile. The product should ingest raw customs/trade source files, preserve them, parse them, normalize records, and expose the data through a clear web interface with strong filters, search, source traceability, and eventually analytics.

---

## Current certainty level

### Confirmed

- Neon-hosted PostgreSQL is the MVP database provider.
- Neon is used as hosted Postgres only.
- Drizzle is the database layer.
- Raw files live outside the database in R2/S3-compatible object storage.
- Postgres is the MVP operational database.
- The architecture must be ClickHouse-ready.
- ClickHouse is deferred until justified.
- App logic lives in Next.js server-side code and service modules.

### Unknown

- Exact Chile source data format.
- Exact data granularity.
- Exact fields available.
- Whether Postgres alone is enough for MVP trade records.
- Which filters, dashboards, and reports users value most.

---

## Stack

- Frontend: Next.js App Router + TypeScript
- UI: Tailwind + shadcn/ui
- Database: Neon-hosted PostgreSQL
- DB access: Drizzle
- Raw file storage: Cloudflare R2
- Hosting: Vercel
- Auth: Auth.js or Clerk, to be decided
- Payments: Stripe, later
- Background jobs: start simple, later Inngest / Trigger.dev / worker if needed
- Analytics store: ClickHouse later if needed

---

## Database provider boundary

Neon is only the hosted PostgreSQL provider.

Supabase is not part of the planned stack. Do not use Supabase unless a future entry in `docs/DECISIONS.md` explicitly reintroduces it.

Do not use by default:

- database-provider auth
- database-provider file storage
- database-provider realtime features
- database-provider edge functions
- generated database client APIs from frontend code
- provider-specific app security patterns as the main architecture

Any expansion of the database provider beyond hosted PostgreSQL requires an entry in `docs/DECISIONS.md`.

---

## High-level system

```txt
Browser
  -> Next.js UI
  -> Next.js server actions / route handlers / services
  -> Drizzle
  -> Neon Postgres

Raw source files
  -> Cloudflare R2 private object storage
  -> import metadata in Postgres

Future heavy analytics
  -> ClickHouse fact tables / aggregates
  -> same application query services
```

---

## Data flow

```txt
1. Source file is acquired or uploaded.
2. Original file is stored unchanged in object storage.
3. Source file metadata is created in Postgres.
4. Import batch is created.
5. Parser reads the file and stores raw row snapshots.
6. Normalization creates structured trade records and entity references.
7. Validation records errors, warnings, and confidence.
8. User-facing services expose search, filtering, summaries, and record detail.
9. Each user-facing record preserves provenance to source file and raw row.
```

---

## Data layers

### Cloudflare R2 object storage

Owns:

- original CSV/XLSX/ZIP files
- downloaded archives
- generated exports
- future source snapshots

Never mutate original source files.
Keep source archive buckets private unless a later access-control decision explicitly changes that.

### Postgres operational layer

Owns:

- users/accounts
- organizations
- permissions
- plans/subscriptions
- saved searches
- alerts
- import jobs
- source files metadata
- import errors
- curated entities
- MVP trade fact tables if manageable

### Future ClickHouse analytical layer

Eventually owns, if needed:

- large customs/trade fact tables
- high-volume shipment records
- dashboard aggregates
- monthly summaries
- company/product/country/route analytics

ClickHouse is not enabled until data volume or query performance justifies it.

---

## Query architecture

UI components must not directly query database tables.

Use application services:

```txt
tradeSearchService
tradeAnalyticsService
companyIntelligenceService
importJobService
sourceFileService
savedSearchService
```

Today these services may query Postgres.

Later, trade search and analytics services may query ClickHouse while the UI remains unchanged.

---

## ClickHouse-readiness requirements

- Keep trade/customs facts separate from app data.
- Model trade records as fact-style rows.
- Use stable references for countries, HS codes, companies, ports, and source files.
- Keep query logic behind service modules.
- Do not assume Postgres is the permanent store for heavy analytical tables.
- Keep raw files and provenance independent of the analytics engine.

---

## Security principles

- Server-side data access only for core data.
- No direct client access to core trade tables.
- Auth and permissions must be enforced in app/server logic.
- Exports must be rate-limited and permission-aware.
- Raw source file access must be controlled.
- Source licensing and usage rights must be documented before publishing or reselling data.

---

## Performance principles

- Start with correct schema, indexes, and pagination.
- Avoid unbounded queries.
- Avoid exporting massive datasets synchronously.
- Add summary tables/materialized views before adding a new engine unless data volume already justifies it.
- Add ClickHouse only when there is evidence: slow aggregations, large fact volume, dashboard latency, or cost pressure.
