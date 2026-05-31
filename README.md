# Duanera

Duanera is a customs, import/export, and trade intelligence web app.

The first version focuses on Chile. The long-term ambition is to organize customs and trade data across Latin America and eventually broader global markets.

The goal is not simply to display raw files. Duanera should turn messy customs/trade sources into a structured, searchable, filterable, digestible product for importers, exporters, analysts, and business users.

---

## Current status

Greenfield MVP / data discovery with a Neon + Drizzle data foundation.

The architecture is intentionally serious, but some product details remain provisional until broader Chile source coverage, code tables, and export companion files are inspected.

---

## Confirmed stack direction

- App: Next.js + TypeScript
- UI: Tailwind + shadcn/ui
- Database: Neon-hosted PostgreSQL
- Database layer: Drizzle
- Raw source file storage: Cloudflare R2 or S3-compatible object storage
- Hosting: Vercel
- Analytics backend: ClickHouse later if needed, not MVP dependency

---

## Important architecture rule

Duanera uses hosted PostgreSQL as database infrastructure, not as a bundled backend platform.

Neon Postgres is the selected provider. Supabase should not be used unless a future entry in `docs/DECISIONS.md` explicitly reintroduces it.

Duanera should not use database-provider platform features for auth, file storage, realtime, edge functions, or generated client APIs unless a specific decision is logged in `docs/DECISIONS.md`.

Raw customs source files must not be stored in Postgres.

---

## Documentation

Core docs:

- `AGENTS.md`
- `docs/ARCHITECTURE.md`
- `docs/SPECS.md`
- `docs/DATA_MODEL.md`
- `docs/DATA_INGESTION.md`
- `docs/FILTERING_AND_SEARCH.md`
- `docs/UI.md`
- `docs/DECISIONS.md`

Supporting docs:

- `docs/ROADMAP.md`
- `docs/RESEARCH.md`
- `docs/PUBLIC_PAGE_STYLE_GUIDE.md`
- `docs/SESSION_HANDOFF.md`

---

## Local setup

Install dependencies and create a local environment file:

```bash
npm install
cp .env.example .env.local
```

Set `DATABASE_URL` in `.env.local` to a Neon Postgres connection string.

`DIRECT_DATABASE_URL` is optional. If present, Drizzle migration tooling uses it; otherwise it falls back to `DATABASE_URL`.

Database scripts:

```bash
npm run dev
npm run build
npm run db:generate
npm run db:migrate
npm run db:studio
```

Dev-only Aduana sample scripts:

```bash
DUANERA_DB_TARGET=dev npm run db:seed:source-layouts
DUANERA_DB_TARGET=dev npm run db:seed:source-files
DUANERA_DB_TARGET=dev npm run db:seed:code-tables
DUANERA_DB_TARGET=dev npm run db:load:raw-sample
DUANERA_DB_TARGET=dev npm run db:normalize:trade-sample
npm run inspect:trade-records
```

The Aduana foundation currently supports provenance, raw rows, official code-table metadata, anonymous importer/exporter correlatives, a full March 2026 dev import/export load, and an internal search/detail UI. It does not implement production ingestion, legal company identity, or production data promotion.

Internal demo pages:

```txt
/trade-records
/trade-records/[id]
```

API route:

```txt
GET /api/trade-records
```

Example:

```txt
/api/trade-records?tradeFlow=import&periodFrom=2026-03&periodTo=2026-03&limit=5
```

---

## Environment variables

See `.env.example`.

At minimum, the app will likely need:

- `DATABASE_URL`: Neon/PostgreSQL connection string
- `DIRECT_DATABASE_URL`: optional direct Neon/PostgreSQL connection string for Drizzle migrations
- R2/S3 object storage credentials
- Auth provider credentials
- Stripe credentials later
- Optional ClickHouse credentials later
