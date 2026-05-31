# Decisions

## Topic Index

- Architecture: `1`, `2`, `3`, `4`
- Data/storage: `2`, `3`, `4`, `5`, `14`
- Database provider strategy: `1`
- ClickHouse strategy: `4`, `8`
- Data model: `8`, `9`, `14`
- Product scope: `6`, `7`
- Data identity: `7`, `8`
- Source/provenance: `5`, `8`, `9`, `10`, `14`
- Query/search architecture: `11`, `12`, `13`

---

## 1) Neon is used as hosted Postgres for MVP

- **Decision**: Use Neon as the hosted PostgreSQL provider for MVP.
- **Supersedes**: The earlier documented plan to use Supabase as managed Postgres only. Supabase was never implemented in this repo.
- **Context**: Duanera needs a strong PostgreSQL database for relational app data, import/provenance metadata, and MVP trade records. The project does not currently need a full backend platform bundle. Supabase had only been documented as the intended database option and had not been implemented.
- **Options considered**: Neon, Supabase database-only, Supabase full platform, Convex, self-hosted Postgres, traditional managed Postgres.
- **Why chosen**: Neon provides hosted Postgres while keeping the architecture centered on plain PostgreSQL and Drizzle. Its branching model and usage-based compute fit a greenfield project with production, staging, and development environments, including the option to keep production compute active while allowing non-production branches to scale down.
- **Consequences / follow-ups**: Use standard PostgreSQL connection strings and Drizzle as the database interface. Do not couple app architecture to Neon-specific APIs unless a separate decision is logged. Auth, raw file storage, realtime, edge functions, and generated client APIs remain outside the database-provider boundary by default. Do not use Supabase unless a future decision explicitly reintroduces it.

## 2) Drizzle is the database layer

- **Decision**: Use Drizzle for schema, migrations, and typed database queries.
- **Context**: Duanera will use TypeScript and Postgres. The database schema should live clearly in the repo and remain understandable to humans and AI agents.
- **Options considered**: Raw SQL only, Prisma, Drizzle.
- **Why chosen**: Drizzle is lightweight, TypeScript-first, close to SQL, and suitable for custom filter/query needs.
- **Consequences / follow-ups**: Schema changes must be committed as migrations. Avoid dashboard-only schema edits.

## 3) Raw customs files live in object storage, not Postgres

- **Decision**: Store original source files in Cloudflare R2 or equivalent S3-compatible object storage.
- **Context**: Customs source files may be large and must be preserved unchanged. Databases should store metadata and parsed/normalized records, not original archives.
- **Options considered**: Store raw files in Postgres, Supabase Storage, local disk, R2/S3-compatible storage.
- **Why chosen**: Object storage is cheaper, more appropriate for files, and keeps the database focused on structured data.
- **Consequences / follow-ups**: Source metadata in Postgres must include storage path, file hash, status, and provenance fields.

## 4) ClickHouse-ready, but not MVP dependency

- **Decision**: Design the trade/customs data model and query layer so large fact tables can move to ClickHouse later, but do not add ClickHouse as an MVP dependency.
- **Context**: Customs data may become large, filter-heavy, and aggregation-heavy. ClickHouse is well-suited to analytical workloads, but adding it too early increases complexity.
- **Options considered**: Postgres only forever, ClickHouse from day one, Postgres MVP with ClickHouse-ready boundaries.
- **Why chosen**: Postgres-first keeps the MVP simpler. ClickHouse-readiness prevents a painful rewrite if analytics scale grows.
- **Consequences / follow-ups**: Trade facts must be separated from app data. UI must use service/query layers, not direct table access.

## 5) Preserve raw/provenance before normalization

- **Decision**: Ingestion must preserve source files and raw row/provenance data before creating normalized user-facing records.
- **Context**: Customs data can be messy and normalization can introduce errors. The product depends on trust.
- **Options considered**: Normalize directly into final tables, preserve raw rows only sometimes, preserve raw/provenance systematically.
- **Why chosen**: Traceability protects data quality and allows reprocessing when parsers improve.
- **Consequences / follow-ups**: Import batches, parser versions, source files, and raw row references are core schema concepts.

## 6) Chile-first and Spanish-first

- **Decision**: Duanera starts with Chile and Spanish-language product UX.
- **Context**: The initial product concept is to use Chile customs data first, then expand to Latin America and later broader coverage.
- **Options considered**: Global-first, Latin America-first, Chile-first.
- **Why chosen**: Chile-first keeps ingestion, data validation, terminology, and user discovery manageable.
- **Consequences / follow-ups**: Expansion docs should remain roadmap-level until the Chile MVP validates the model.

## 7) Importer/exporter company identity is an inference layer unless verified externally

- **Decision**: Treat Chile Aduana importer/exporter correlatives as anonymous source identifiers. Any `Posible importador` or `Posible exportador` company name must live in a separate evidence-backed inference layer with confidence score, review status, and provenance. Do not present inferred names as Aduana-verified identities.
- **Context**: Inspected public Aduana/datos.gob.cl import/export files expose `NUM_UNICO_IMPORTADOR`, `NRO_EXPORTADOR`, and `NRO_EXPORTADOR_SEC`, but not legal importer/exporter names or RUTs. Aduana transparency responses and Consejo decisions indicate that names/RUTs linked to trade transactions are excluded from open data or withheld under secrecy/reserve reasoning. Competitors appear to infer possible identities rather than obtain a clean official mapping.
- **Options considered**: Use carrier/document-emitter fields as identity, request or recover identity-linked Aduana files, omit company identity entirely, create a lawful evidence-backed possible-identity layer.
- **Why chosen**: Carrier/document-emitter fields are not commercial importer/exporter identity. Aduana identity-linked transaction data is unlikely to be lawfully available as open data now. Omitting company identity entirely would remove a core product value proposition. A separate possible-identity layer preserves usefulness while keeping source data, external evidence, and inference uncertainty explicit.
- **Consequences / follow-ups**: Build anonymous importer/exporter ID profiles first. Design identity candidates, evidence items, confidence bands, and manual review before any user-facing `Posible importador/exportador` feature. Keep this layer independent from core source ingestion and provenance. See `docs/research/CHILE_ADUANA_IDENTITY_INFERENCE_SYSTEM.md`.

## 8) MVP data model uses confirmed Aduana fields only

- **Decision**: The MVP trade model uses confirmed fields from inspected Chile Aduana DIN/DUS main files and official dictionary metadata. It may store anonymous importer/exporter correlative IDs (`NUM_UNICO_IMPORTADOR`, `NRO_EXPORTADOR`, `NRO_EXPORTADOR_SEC`), but importer/exporter legal identity is deferred. Source provenance and raw row tracing are required for normalized trade records where practical. `trade_records` must remain fact-style and ClickHouse-ready, while ClickHouse stays a future option rather than an MVP dependency.
- **Context**: `docs/research/MVP_DATA_MODEL_PROPOSAL.md` summarizes the approved directional model. The inspected files confirm row-level import/export item records, HS/tariff fields, product text, values, quantities, weights, country/port/customs/transport codes, and anonymous importer/exporter correlatives. They do not confirm importer/exporter legal names, importer/exporter RUTs, or a public mapping from correlatives to legal identities.
- **Options considered**: Model broad imagined customs fields, build a company-centric schema immediately, add ClickHouse from day one, or model only confirmed fields with provenance and deferred identity.
- **Why chosen**: Confirmed-field modeling avoids false identity claims and premature schema lock-in while preserving useful searchable/filterable trade records, raw traceability, and a clean path to future analytics storage.
- **Consequences / follow-ups**: MVP schema work should center on source files, import batches, source layouts, raw trade rows, code-table decoding, anonymous source participants, and ClickHouse-ready trade facts. Inspect official code tables, export companion files, and broader year coverage before extending the model. Do not add company identity tables or ClickHouse as active dependencies without a later decision.

## 9) First ingestion implementation is sample-first and dev-only

- **Decision**: Implement the first Aduana ingestion path as a dev-only sample pipeline: seed source/layout/code metadata, load capped raw rows from March 2026 import/export main files, and normalize only those sampled rows into `trade_records`.
- **Context**: The schema direction is approved, but full-file ingestion, production promotion, and broader source coverage still need validation. The project needs an end-to-end proof that provenance, raw row tracing, code-table decoding, anonymous correlatives, and normalized trade facts work together.
- **Options considered**: Load full months immediately, build production ingestion first, keep planning without inserting sample data, or create a capped dev-only pipeline.
- **Why chosen**: A capped dev-only pipeline proves the data path without risking production, runaway row volume, or premature normalization assumptions.
- **Consequences / follow-ups**: Data-mutating sample scripts require `DUANERA_DB_TARGET=dev`. Production remains untouched. The next step is to inspect sample quality and broaden coverage deliberately before loading complete files or promoting migrations.

## 10) Full-month Aduana loads are allowed only as dev validation for now

- **Decision**: After the capped sample QA passed, the March 2026 Aduana import/export main files may be loaded fully into the Neon `dev` branch for validation, but this remains dev-only and is not production ingestion.
- **Context**: The project needed to test whether the provenance, raw row, normalization, code-decoding, and search foundations behave on a realistic monthly volume. The first attempt hit Neon's 512 MB free storage limit; after upgrading Neon, the full March 2026 load completed in dev.
- **Options considered**: Stay at the 200-row sample, load the full month into dev, load production, or redesign raw-row storage before any larger load.
- **Why chosen**: Dev full-month validation exposes real parser, storage, and query-performance issues while keeping production untouched and preserving the current raw/provenance model.
- **Consequences / follow-ups**: Do not promote this data to production yet. The dev database is roughly 2 GB after one full month because raw row snapshots and normalized records both live in Postgres. Search/list queries are now slow enough to require query plans, indexes, and possibly a revised raw-row storage strategy before loading additional months.

## 11) Full-month chronological list queries use raw-row ordering in Postgres

- **Decision**: For simple full-month trade record lists, use `raw_trade_rows` as the ordered access path and keep the normalized `trade_records` join for returned fields. Add a narrow index on `raw_trade_rows(trade_flow, period_year, period_month, row_number, id)` to support this path.
- **Context**: After loading March 2026 into dev, `/api/trade-records` and `/trade-records` were slow because the generic list query joined every matching `trade_records` row to `raw_trade_rows` only to sort by source row number before returning 25 rows.
- **Options considered**: Keep the generic join/order query, denormalize `raw_row_number` into `trade_records`, add ClickHouse, or add a minimal Postgres index plus a scoped query fast path.
- **Why chosen**: The index and fast path preserve provenance ordering, avoid a data-model change, keep ClickHouse deferred, and are enough for the current full-month list workflow.
- **Consequences / follow-ups**: This optimization currently targets one flow and one exact month with no extra filters. More selective filters, aggregation-heavy queries, and larger multi-month ranges still need separate query-plan review before loading substantially more data or promoting production search.

## 12) Exact-month structured filters stay Postgres-first with targeted indexes

- **Decision**: Keep March 2026 non-aggregate filter/search in Postgres and add targeted dev-tested indexes for exact-month structured filters: origin country, destination country, customs office, transport mode, exporter secondary correlative, and product text trigram search. Exact-month HS/country/customs/transport list queries may use the raw-row ordered access path when compatible.
- **Context**: A query-performance QA pass found that product text counts were doing full table scans, and high-volume country/customs/transport counts lacked covering filter indexes. Filtered list queries also needed to reuse raw-row ordering instead of sorting large joined result sets.
- **Options considered**: Add ClickHouse, add broad denormalized read models, add many speculative indexes, or add only indexes proven by March 2026 `EXPLAIN ANALYZE`.
- **Why chosen**: Targeted indexes keep the MVP simple, preserve raw-row provenance ordering, and avoid adding a new analytics engine before Postgres has been reasonably tuned.
- **Consequences / follow-ups**: `pg_trgm` is now a dev-tested Postgres extension dependency for product text search. Deep offset pagination still walks skipped rows and should be replaced later with cursor/keyset pagination before large-scale browsing. Product text list ordering remains heavier than structured filters because results must be ordered by source raw row.

## 13) Trade record browsing uses raw-row cursor pagination where supported

- **Decision**: Use cursor/keyset pagination for raw-row ordered exact-month trade record browsing. The cursor is an opaque `after` URL value encoding the last returned raw row number and raw row id. Existing `offset` URLs remain accepted for compatibility, but cursor links are preferred for forward browsing.
- **Context**: Deep offset pagination over the full March 2026 dev import file still had to walk skipped rows. An `offset 100000` plan took roughly 2.6 seconds, while the equivalent cursor predicate after raw row 100000 took roughly 8 ms.
- **Options considered**: Keep offset pagination, add cursor pagination only to the API, add cursor pagination through the service/API/page, or introduce a separate read model.
- **Why chosen**: Cursor pagination uses the existing raw-row provenance order and existing indexes, requires no new tables, avoids ClickHouse, and preserves current URL filters.
- **Consequences / follow-ups**: Cursor pagination works for default exact-month import/export lists and compatible HS/country/customs/transport filters. Product text and participant filters still use the generic path for now. Backward navigation is limited in the stateless demo UI because the page does not store a cursor history stack.

## 14) Full raw row payloads should not be stored in Postgres for every successful row long term

- **Decision**: Preserve official source files outside Postgres forever, keep raw row trace metadata in Postgres, and avoid keeping full raw row payloads in Postgres for every successfully parsed high-volume row long term. Full raw payloads may remain in Postgres for dev samples, parser debugging, parser errors, parser warnings, sampled QA rows, or explicitly retained audit examples. Successful high-volume row payloads should be reconstructed from preserved source files or moved to object storage with Postgres storing only a pointer and hash.
- **Context**: The March 2026 dev load measured roughly 2.14 GiB total database size. `raw_trade_rows` accounted for roughly 1.60 GiB, mostly from `raw_text` and `raw_values`; `trade_records` accounted for roughly 520 MiB. A simple linear estimate of the current design is about 25 GiB for 12 months and 75 GiB for 36 months before additional files, branches, or production overhead.
- **Options considered**: Keep all full row payloads in Postgres indefinitely, drop raw row payloads entirely after normalization, move all raw row payloads immediately to object storage, or keep Postgres row metadata while retaining full payloads selectively.
- **Why chosen**: Selective payload retention preserves auditability and parser debugging while keeping Neon focused on structured metadata and normalized records. It also respects the existing rule that raw source files live outside Postgres and keeps the model portable for future ClickHouse migration.
- **Consequences / follow-ups**: Do not delete existing dev payloads without an explicit pruning run. Future ingestion scripts should make payload retention mode explicit. The schema now supports retention metadata and nullable payload columns. Object-storage pointer usage and structured parse issue records remain deferred until needed.
