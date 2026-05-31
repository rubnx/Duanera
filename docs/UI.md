# UI

## Purpose

Duanera should feel serious, calm, analytical, and trustworthy.

It is not a playful consumer app. It is a data product for people making business decisions from customs/import-export information.

---

## Current certainty level

### Confirmed

- Spanish-first signed-in product.
- Data tables and filters are central.
- Provenance/source visibility is important.
- UI should support dense data without becoming messy.
- The product should feel more like a serious intelligence platform than a generic SaaS template.

### Unknown

- Exact filters.
- Exact columns.
- Main user workflow priority.
- Whether dashboard, search, or company profile is the first primary screen.

---

## UI principles

- Trust before decoration.
- Dense but readable.
- Filters should be powerful but controlled.
- Tables should be useful, not decorative.
- Source/provenance should be accessible.
- Do not hide uncertainty.
- Use restrained color and hierarchy.
- Avoid generic startup styling.
- Avoid fake insight cards before the data supports them.

---

## Visual direction

Duanera should feel:

- serious
- precise
- structured
- premium but not flashy
- data-heavy but not overwhelming
- modern administrative/intelligence platform

Good references conceptually:

- Linear-like clarity
- Bloomberg-like seriousness, but less dense
- modern B2B data dashboards
- customs/logistics documentation clarity

Avoid:

- playful gradients
- excessive cards
- vague AI dashboards
- generic SaaS hero sections
- decorative charts without analytical value

---

## Core signed-in screens

Provisional:

- Dashboard
- Search / Explore
- Trade Records
- Record Detail
- Companies
- Company Profile
- HS Code Explorer
- Sources / Import Batches
- Saved Searches
- Account / Billing later
- Admin / Imports

---

## Main interaction model

The main product should likely center on:

```txt
Filter panel + results table + detail drawer
```

Possible layout:

- left or top advanced filters
- central data table
- right-side detail drawer
- saved search controls
- export/report controls later
- source/provenance section in detail view

---

## Data table requirements

Tables should support:

- column visibility
- sorting
- pagination
- sticky header
- compact/dense mode later
- row detail drawer
- copyable values
- clear empty states
- loading states
- source/confidence indicators where useful

Do not implement dozens of columns at once if the first dataset does not support them.

---

## Filter UX

Filters should be grouped by meaning:

- time
- product/HS code
- companies
- geography
- logistics
- value/quantity
- source/status

Advanced filters should not overwhelm first-time users.

Use saved searches to reduce repeated work.

---

## Provenance UX

Every record detail view should eventually show:

- source file
- period
- import batch
- raw row id if available
- parser version
- normalization status
- confidence or warning flags

This does not need to dominate the UI, but it must be accessible.

---

## Language and terminology

Initial product language: Spanish.

Use clear business Spanish, not bureaucratic overcomplication.

Prefer:

- importaciones
- exportaciones
- partida arancelaria / código HS
- importador
- exportador
- país de origen
- país de destino
- valor CIF / FOB when applicable
- fuente
- lote de importación
- registro original

Dataset-specific terminology must be validated against the actual Chile source.

---

## Empty states

Empty states should help users adjust filters.

Bad:

```txt
No results found.
```

Better:

```txt
No encontramos registros con estos filtros. Prueba ampliar el rango de fechas, quitar el puerto o buscar por una partida HS más general.
```

---

## Uncertainty indicators

If normalized or inferred data is uncertain, the UI should say so.

Examples:

- company match needs review
- source field missing
- value unavailable
- unit not standardized
- record partially parsed

Do not make uncertain data look verified.

---

## Public pages

Public, marketing, legal, and informational page style lives in `docs/PUBLIC_PAGE_STYLE_GUIDE.md`.

Signed-in product UI lives here.
