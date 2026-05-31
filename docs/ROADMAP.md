# Roadmap

## Current status

Greenfield MVP / data discovery.

This roadmap is provisional. It should change after the first real Chile dataset is inspected.

---

## Phase 0: Foundation

- Confirm first data source.
- Inspect actual file structure.
- Document fields, formats, licensing, and limitations.
- Set up Next.js, Neon-hosted PostgreSQL, Drizzle, and object storage.
- Create source file/import batch/provenance schema.
- Build first parser.

---

## Phase 1: Chile MVP

- Import first Chile dataset.
- Preserve raw files.
- Store raw rows where practical.
- Normalize first trade records.
- Build basic search/filter table.
- Build record detail with provenance.
- Add saved searches.
- Add admin import status screens.
- Add basic company and HS code views if data supports them.

---

## Phase 2: Data quality and user validation

- Improve company normalization.
- Add validation warnings.
- Add missing/uncertain data indicators.
- Test with real users.
- Identify most valuable filters.
- Identify export/report needs.
- Decide paid access model.

---

## Phase 3: Early production

- Add auth and paid access.
- Add subscriptions or plans.
- Add export limits.
- Add saved search limits.
- Improve performance and indexes.
- Add summary tables/materialized views.
- Add monitoring for slow queries and imports.

---

## Phase 4: Analytics scale

Trigger this phase only when needed.

- Add ClickHouse if Postgres becomes a bottleneck.
- Move heavy trade fact tables or aggregates to ClickHouse.
- Keep Postgres for app data and curated entities.
- Keep query services stable so UI does not need major rewrite.

---

## Phase 5: Expansion

- Add more Chile datasets or historical periods.
- Add additional Latin American countries.
- Add global/macro trade sources if useful.
- Add richer company intelligence.
- Add alerts.
- Add team/enterprise workflows.
- Add API access if commercially justified.
