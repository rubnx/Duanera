# CLAUDE.md

This file mirrors the high-level operating rules in `AGENTS.md`.

Duanera is a greenfield customs/trade intelligence platform. The first target market is Chile. The product should turn raw customs/import-export data into a structured, searchable, filterable product for business users.

Read these first:

- `AGENTS.md`
- `docs/ARCHITECTURE.md`
- `docs/SPECS.md`
- `docs/DATA_MODEL.md`
- `docs/DATA_INGESTION.md`
- `docs/DESIGN.md`
- `docs/PUBLIC_PAGE_STYLE_GUIDE.md`
- `docs/DECISIONS.md`

## Confirmed technical direction

- Neon-hosted PostgreSQL is the MVP database provider.
- Drizzle is the database layer.
- Raw files live in R2 or S3-compatible object storage.
- The MVP starts with Postgres.
- The architecture must remain ClickHouse-ready.
- ClickHouse is not an active dependency until justified.
- App logic belongs in Next.js server-side code and application services.
- Client components must not directly query core data.

## Important uncertainty

The actual Chile customs dataset has not yet been inspected. Do not assume exact field availability. Mark dataset-specific logic as provisional until real source files are reviewed.

## Development behavior

- Build in coherent slices.
- Preserve raw data and provenance.
- Keep implementation portable.
- Document meaningful decisions.
- Avoid database-provider platform coupling unless explicitly decided.
