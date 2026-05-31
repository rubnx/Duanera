# Filtering and Search

## Purpose

Filtering and search are core to Duanera. This document defines the intended search/filter architecture while keeping dataset-specific behavior provisional.

---

## Current certainty level

### Confirmed

- The MVP needs structured filters.
- UI must access search through services or API routes, not direct database table queries.
- Postgres handles MVP search/filtering first.
- ClickHouse may later handle heavy fact queries and aggregations.
- Elasticsearch/OpenSearch/Typesense/Meilisearch are deferred until fuzzy search becomes a proven requirement.

### Unknown

- Exact source fields.
- Which filters users value most.
- Volume and performance requirements.
- Whether fuzzy company/product search is central from day one.

---

## Search architecture

Use a service layer:

```txt
UI
  -> search/filter API
  -> tradeSearchService
  -> Postgres now
  -> ClickHouse later if needed
```

The UI should not care whether results come from Postgres or ClickHouse.

---

## Initial structured filters

Provisional filter groups:

- trade flow: import/export
- date range
- period month
- HS code
- product description
- importer
- exporter
- origin country
- destination country
- partner country
- port
- customs office
- transport mode
- declared value range
- CIF value range
- FOB value range
- quantity range
- weight range
- source file
- import batch
- data confidence/status

Only implement filters supported by the first real dataset.

---

## Search modes

### Structured filtering

Primary MVP mode.

Examples:

- HS code starts with `2204`
- origin country is Spain
- destination country is Chile
- period is last 24 months
- importer contains a company name
- CIF value above threshold

### Keyword search

Useful for:

- company names
- product descriptions
- brands if available
- source text fields

Start with Postgres full-text or trigram search if needed.

### Fuzzy/entity search

Deferred until proven necessary.

Potential tools later:

- Postgres trigram
- Typesense
- Meilisearch
- Elasticsearch/OpenSearch

Do not add a separate search engine before structured filtering is working.

---

## Pagination and sorting

All record tables must be paginated.

Avoid unbounded queries.

Default sort options may include:

- newest first
- highest value
- largest quantity
- company name
- HS code
- source/import date

Large exports must not reuse unbounded UI queries without limits and permission checks.

---

## Aggregations

MVP aggregations may include:

- total value by month
- total quantity by month
- top importers
- top exporters
- top countries
- top HS codes
- top ports
- trend by product/HS code
- company activity over time

Start with Postgres only if performance is acceptable.

Move heavy aggregations to ClickHouse when needed.

---

## Saved searches

Saved searches should store:

- user/org id
- name
- filter JSON
- visible columns
- sort order
- created_at
- updated_at

The filter JSON should be engine-neutral. It should not assume Postgres SQL syntax.

---

## Query service contract

Search services should accept normalized filter objects.

Example:

```ts
type TradeSearchFilters = {
  tradeFlow?: "import" | "export";
  periodFrom?: string;
  periodTo?: string;
  hsCodePrefix?: string;
  importerId?: string;
  exporterId?: string;
  originCountryCode?: string;
  destinationCountryCode?: string;
  minValueUsd?: number;
  maxValueUsd?: number;
};
```

The service decides how to translate this into Postgres or ClickHouse queries.

---

## Performance rules

- Add indexes for common filters.
- Avoid `SELECT *` in large list views.
- Use read models or summary tables when needed.
- Add query logging for slow filters.
- Keep dashboard queries separate from record-detail queries.
- Do not compute expensive aggregations repeatedly if they can be cached or summarized.

---

## ClickHouse trigger conditions

Consider ClickHouse when:

- Postgres queries over trade facts are consistently slow.
- Aggregations become central to the product.
- Dataset reaches millions of records and dashboard use is frequent.
- Export/report workloads interfere with app performance.
- Postgres indexing/partitioning/materialized views are no longer enough.
