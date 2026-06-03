# Design

## Purpose and Scope

`docs/DESIGN.md` is the primary source of truth for signed-in Duanera product UI, interaction patterns, visual design, terminology, and component behavior.

Duanera is a Chile-first trade intelligence platform for exploring import and export records with clear source traceability. The signed-in product should feel serious, calm, analytical, trustworthy, and fast. It is not a playful consumer app, a government portal, a generic SaaS dashboard, or a colorful analytics template.

This document governs:

- signed-in application shell
- explorer/search/filter workflows
- trade record tables
- record detail panels
- source/provenance and data-quality UI
- product navigation
- product typography, spacing, color, and component patterns
- Spanish-first product labels and microcopy

Public marketing, legal, informational, SEO, pricing, methodology, and support page styling is intentionally separate and lives in `docs/PUBLIC_PAGE_STYLE_GUIDE.md`.

---

## Current Certainty Level

### Confirmed

- The signed-in product is Spanish-first.
- Data tables, filtering, search, and record inspection are central.
- Provenance/source visibility is a core product requirement.
- The UI must support dense data without becoming messy.
- Data credibility and traceability matter more than flashy dashboards.
- The product should feel like a serious intelligence platform, not a generic SaaS template.

### Unknown Until More Dataset and User Review

- Exact filters.
- Exact columns.
- Main user workflow priority.
- Whether dashboard, search, company profile, or source inspection becomes the first primary screen.
- Which source fields are consistently available across periods and flows.
- Which summarized views users value enough to promote in the product.

---

## Product Design Principles

### 1. Source-First Trust

Every user-facing record should make provenance visible or easy to inspect.

Users should understand:

- where the data came from
- which source file produced the record
- when it was loaded
- whether the record is complete
- whether any field requires review
- whether any displayed value is normalized or inferred

Traceability is not secondary decoration. It is part of the core interface.

### 2. Dense but Calm

Duanera deals with large customs datasets, so the UI must support information density without feeling cluttered.

Use:

- compact spacing
- clear grouping
- restrained color
- strong alignment
- predictable table behavior
- stable controls that do not shift during interaction

Avoid:

- excessive cards
- playful gradients
- decorative charts without analytical value
- oversized empty states
- marketing-style composition inside the product

### 3. Explorer-First Workflow

The main signed-in workflow is exploration:

1. Search.
2. Filter.
3. Scan records.
4. Select a record.
5. Inspect details.
6. Verify the source.
7. Save, export, or continue exploring.

The interface should preserve context. Opening a record must not make users lose their current search, filters, table position, or selected row.

### 4. Professional Neutrality

The visual tone should be clean, institutional, modern, and precise. It should feel closer to a serious B2B data tool than to a colorful SaaS dashboard.

Use color for meaning, not decoration.

### 5. Uncertainty Must Stay Visible

Do not hide uncertainty or make uncertain data look verified.

If normalized or inferred data is incomplete, missing, unstandardized, or awaiting review, the UI should say so plainly.

Examples:

- company match needs review
- source field missing
- value unavailable
- unit not standardized
- record partially parsed
- possible importer/exporter identity inferred from non-Aduana evidence

---

## Product Scope and Navigation

### Provisional Signed-In Screens

These screens are provisional until real workflow evidence is stronger:

- Dashboard
- Search / Explore
- Trade Records
- Record Detail
- Companies
- Company Profile
- HS Code Explorer
- Countries
- Routes and Ports
- Sources / Import Batches
- Saved Searches
- Reports
- Downloads
- Alerts
- Account / Billing later
- Admin / Imports

Do not add fake insight cards, broad dashboards, or dozens of unsupported columns before the data supports them.

### Recommended Product Routes

```text
/explorer
/trade-records
/companies
/companies/[id]
/hs-products
/hs-products/[code]
/countries
/countries/[code]
/routes-and-ports
/sources
/sources/import-batches
/saved-searches
/reports
/downloads
/alerts
/account
/admin/imports
```

Public routes such as landing, pricing, about, legal, support, methodology, and SEO pages are governed by `docs/PUBLIC_PAGE_STYLE_GUIDE.md`.

### Navigation Labels

Use Spanish UI labels for the Chile-first product experience.

Recommended labels:

```text
Explorador
Registros
Empresas
Productos HS
Países
Rutas y puertos
Fuentes
Búsquedas guardadas
Reportes
Descargas
Alertas
Cuenta
Administración
```

Record wording:

```text
Registro
Detalle del registro
Fuente verificada
Fuente y trazabilidad
Requiere revisión
Ver origen
Ver registro completo
Registro original
Lote de importación
```

---

## Main Interaction Model

The core product layout should center on:

```text
Filter panel or filter bar + results table + detail drawer
```

The default explorer should include:

- persistent product navigation
- prominent search
- grouped structured filters
- central data table
- selected-row state
- right-side detail drawer
- source/provenance section in the detail view
- saved search controls
- column visibility controls
- export/report controls later

Advanced filters should be powerful but controlled. Saved searches should reduce repeated work.

---

## Layout

### Application Shell

The product uses a three-zone desktop layout:

```text
┌───────────────┬───────────────────────────────┬────────────────────────┐
│ Sidebar       │ Main explorer                 │ Record detail panel    │
│ Navigation    │ Search, filters, table        │ Selected record        │
└───────────────┴───────────────────────────────┴────────────────────────┘
```

### Left Sidebar

The sidebar provides persistent navigation.

Recommended width:

```css
--sidebar-width: 264px;
```

Sidebar sections:

- primary navigation
- saved and reporting tools
- product/help links
- small country/data context card

The active item uses a soft blue background, blue icon, and stronger label weight.

### Main Explorer

The main area contains:

- top search bar
- page title and short context
- filter bar or filter panel trigger
- records table
- pagination

The content should align to a consistent horizontal grid. The table should dominate the page.

### Detail Panel

The record detail panel appears on the right when a row is selected.

Recommended width:

```css
--detail-panel-width: 680px;
```

The detail panel should feel like a focused inspection drawer, not a modal. It can overlay part of the main content on smaller laptop widths, but it should keep a clear visual boundary and always be easy to close.

---

## Visual Foundation

### Color Tokens

```css
--color-bg-app: #f8fafc;
--color-bg-surface: #ffffff;
--color-bg-muted: #f4f7fb;

--color-text-primary: #071735;
--color-text-secondary: #33476b;
--color-text-muted: #6b7a99;
--color-text-subtle: #8b98b3;

--color-border: #dce4f0;
--color-border-soft: #e8eef6;

--color-primary: #0b5cff;
--color-primary-hover: #004ee6;
--color-primary-soft: #eef4ff;

--color-success: #0f8a5f;
--color-success-soft: #e8f6ef;
--color-success-border: #bfe6d3;

--color-warning: #b76b00;
--color-warning-soft: #fff7e8;
--color-warning-border: #f4d49b;

--color-danger: #c93636;
--color-danger-soft: #fff0f0;

--color-purple-soft: #f3edff;
--color-purple-text: #6f2dbd;
```

Color usage:

- Blue: active navigation, selected rows, primary actions, links, focus states.
- Green: verified source, traceability, valid records, successful imports.
- Amber: incomplete fields, data requiring review, non-blocking warnings.
- Purple: rare special filters, such as ports or advanced constraints.
- Red: destructive actions or critical data errors only.

### Typography

Use a clean sans-serif typeface with excellent table legibility.

Recommended stack:

```css
font-family:
  Inter,
  "Manrope",
  ui-sans-serif,
  system-ui,
  -apple-system,
  BlinkMacSystemFont,
  "Segoe UI",
  sans-serif;
```

Type scale:

```css
--font-size-xs: 12px;
--font-size-sm: 13px;
--font-size-md: 14px;
--font-size-lg: 16px;
--font-size-xl: 22px;
--font-size-2xl: 28px;

--line-height-tight: 1.2;
--line-height-normal: 1.45;
--line-height-relaxed: 1.6;
```

Rules:

- Use `13px` or `14px` for table data.
- Use `12px` for metadata labels and helper text.
- Keep headings compact.
- Avoid oversized dashboard headings.
- Numeric values should use tabular numbers.

```css
font-variant-numeric: tabular-nums;
```

### Spacing

Use a compact spacing scale.

```css
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-8: 32px;
```

Rules:

- Table rows should be compact but readable.
- Side navigation should have generous click targets.
- Detail panels can use slightly more vertical spacing than tables.
- Avoid large vertical gaps inside data-heavy screens.

### Radius and Shadows

```css
--radius-sm: 6px;
--radius-md: 8px;
--radius-lg: 12px;
--radius-xl: 16px;

--shadow-panel: 0 12px 40px rgba(7, 23, 53, 0.10);
--shadow-soft: 0 4px 14px rgba(7, 23, 53, 0.06);
```

Rules:

- Use shadows for floating panels and overlays.
- Use borders for normal cards, tables, filters, and nav groups.
- Do not stack heavy shadows.

---

## Core Components

### Sidebar Item

Each sidebar item contains:

- icon
- label
- optional badge

Default:

```css
.sidebar-item {
  height: 40px;
  padding: 0 12px;
  border-radius: 8px;
  color: var(--color-text-secondary);
}
```

Active:

```css
.sidebar-item[data-active="true"] {
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-weight: 600;
}
```

Hover:

```css
.sidebar-item:hover {
  background: #f2f6fd;
}
```

### Global Search

The global search is positioned at the top of the main area.

Placeholder:

```text
Buscar importador, exportador, producto o HS
```

Search should support, when available:

- importer names or possible importer names
- exporter/supplier names or possible exporter names
- anonymous source participant IDs
- HS codes
- product descriptions
- RUT only if a verified lawful source supports it
- record IDs

Search behavior:

- Keep query visible after search.
- Allow clearing with one click.
- Preserve active filters.
- Highlight matching fields in results when useful.
- Do not imply company identity is verified when it is only inferred.

Search styling:

```css
.search-input {
  height: 44px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-bg-surface);
}
```

Keyboard shortcut:

```text
Cmd+K
```

### Filters

Filters should be grouped by meaning:

- trade flow: import/export
- time and period
- product / HS code
- companies or possible identities
- anonymous source participant IDs
- geography
- logistics
- value / quantity / weight
- source / import batch
- data quality / status

Only implement filters supported by the first real dataset.

Filter types may include:

- operation type
- date range
- country
- HS code
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
- confidence or review status

Filter chips should be compact and readable.

```css
.filter-chip {
  height: 36px;
  padding: 0 12px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg-surface);
  color: var(--color-text-primary);
}
```

Active filters should indicate type.

Examples:

```text
Importaciones
Últimos 24 meses
Partida HS: 8471.30
Puerto: San Antonio
País de origen: China
Fuente: Aduana Chile
```

Use removable chips for specific constraints:

```text
Partida HS: 8471.30 x
Puerto: San Antonio x
```

### Data Tables

Tables are the core interface component. They should be useful, not decorative.

Tables should support:

- column visibility
- sorting
- pagination or cursor pagination
- sticky header
- compact/dense mode later
- selected row state
- row detail drawer
- copyable values
- clear empty states
- loading states
- source/confidence indicators where useful

Do not implement dozens of columns at once if the first dataset does not support them.

Recommended columns for import records:

- checkbox
- date or period
- importer or possible importer when available
- product HS
- origin
- port
- CIF value
- net weight

Optional columns:

- exporter
- anonymous participant ID
- quantity
- customs office
- transport method
- source file
- row number
- data quality status

Table styling:

```css
.data-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  background: var(--color-bg-surface);
}

.data-table th {
  height: 44px;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary);
  border-bottom: 1px solid var(--color-border);
}

.data-table td {
  min-height: 64px;
  padding: 12px 14px;
  font-size: 13px;
  color: var(--color-text-primary);
  border-bottom: 1px solid var(--color-border-soft);
}
```

Selected rows should be obvious but not loud.

```css
.data-table tr[data-selected="true"] {
  background: #f2f6ff;
  box-shadow: inset 3px 0 0 var(--color-primary);
}
```

Numeric values should be right-aligned.

```css
.data-table .numeric {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
```

Use consistent formatting:

```text
1.245.980
18.230 kg
1 unidad
```

Long product descriptions should wrap to two or three lines in the main table. Very long values should be fully visible in the detail panel.

### Detail Panel

The detail panel is used to inspect a selected record.

The header contains:

- title: `Detalle del registro`
- record ID
- copy button
- close button
- source status badge

Example:

```text
Detalle del registro
IMP-2024-05-28-001245
Fuente verificada
```

Recommended tabs:

- Resumen
- Mercancía
- Valores
- Transporte
- Documentos
- Historial

Tab style:

```css
.detail-tabs {
  border-bottom: 1px solid var(--color-border);
}

.detail-tab[data-active="true"] {
  color: var(--color-primary);
  border-bottom: 2px solid var(--color-primary);
}
```

Use a two-column definition layout for key fields.

Example fields:

- Fecha de operación
- Régimen
- Importador or Posible importador
- Tipo de operación
- Exportador or Posible exportador
- País de origen
- Producto HS
- Valor CIF
- Peso neto
- Puerto de ingreso
- Cantidad

Labels should be muted and small. Values should be stronger and easy to copy.

```css
.field-label {
  font-size: 12px;
  color: var(--color-text-muted);
}

.field-value {
  font-size: 14px;
  color: var(--color-text-primary);
  font-weight: 500;
}
```

A right-side vertical tab rail can be used for quick jumping inside the panel only when the panel contains enough vertical detail to justify it. Otherwise, keep only the horizontal tab bar.

### Source and Traceability Card

Every record detail view should include a source card.

Purpose:

- prove the record can be traced back to the original data
- expose loading metadata
- help users audit the row
- show whether any fields were derived, normalized, or missing

Card title:

```text
Fuente y trazabilidad
```

Recommended fields:

- Lote de importación
- Archivo fuente
- Fila original
- Periodo
- Fecha de carga
- Fuente
- Checksum, when available
- Parser version, when available
- Normalization status
- Confidence or warning flags, when useful

Example:

```text
Lote de importación
IMP-2024-05-28-001245

Archivo fuente
DUS_SA_20240528_001245.csv

Fila original
3.482

Fecha de carga
29-05-2024 02:14

Fuente
Servicio Nacional de Aduanas de Chile
```

The source card may include a compact original row preview.

Rules:

- show only a few columns by default
- allow `Ver más columnas`
- preserve original values
- do not over-normalize this preview

Styling:

```css
.source-card {
  background: linear-gradient(180deg, #f2fbf7, #eef8f4);
  border: 1px solid var(--color-success-border);
  border-radius: 12px;
}
```

### Data Quality States

Data quality should be visible without blocking the workflow.

Verified:

```text
Fuente verificada
```

Use when the record source is known and traceable.

Requires review:

```text
Requiere revisión
Peso bruto no informado en documento fuente.
```

Use when relevant fields are missing, inconsistent, inferred, or not provided by the source.

Error:

```text
Error de carga
El registro no pudo normalizarse correctamente.
```

Use only for invalid or failed records.

Styling:

```css
.status-success {
  background: var(--color-success-soft);
  color: var(--color-success);
  border: 1px solid var(--color-success-border);
}

.status-warning {
  background: var(--color-warning-soft);
  color: var(--color-warning);
  border: 1px solid var(--color-warning-border);
}
```

### Buttons

Primary buttons are for main actions.

Examples:

- Ver registro completo
- Exportar selección
- Crear alerta

```css
.button-primary {
  height: 40px;
  padding: 0 16px;
  border-radius: 8px;
  background: var(--color-primary);
  color: white;
  font-weight: 600;
}
```

Secondary buttons are for supporting actions.

Examples:

- Ver origen
- Columnas
- Exportar
- Ver más columnas

```css
.button-secondary {
  height: 40px;
  padding: 0 16px;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  background: var(--color-bg-surface);
  color: var(--color-text-primary);
}
```

Icon buttons are used for copy, external link, close, sort, and table actions. Icon buttons need clear hover, focus, tooltip, and accessible-label states.

### Icons

Use a consistent outline icon set.

Recommended style:

- 1.5px or 2px stroke
- rounded caps
- no filled decorative icons
- consistent 16px, 18px, or 20px sizing

Use country flags sparingly and only when they improve scanning.

---

## Empty, Loading, and Error States

### Empty State

Empty states should help users adjust filters.

Avoid:

```text
No results found.
```

Prefer:

```text
No encontramos registros con estos filtros.
Prueba ampliar el rango de fechas, quitar el puerto o buscar por una partida HS más general.
```

Actions:

- Limpiar filtros
- Ampliar fecha
- Volver a importaciones recientes

### Loading State

Use skeleton rows for tables. Do not use large spinners for the main explorer.

### Error State

Errors should separate:

- source unavailable
- search failed
- export failed
- record not found

Use plain language and show a retry action.

---

## Language and Terminology

Initial product language is Spanish.

Use clear business Spanish, not bureaucratic overcomplication.

Preferred terms:

- importaciones
- exportaciones
- partida arancelaria / código HS
- importador
- exportador
- posible importador
- posible exportador
- país de origen
- país de destino
- valor CIF / FOB when applicable
- fuente
- lote de importación
- registro original

Dataset-specific terminology must be validated against the actual Chile source.

Company names should use title case only when the source is reliable. Otherwise preserve source casing and normalize later.

---

## Data Formatting

### Dates

Use Chile-friendly date formatting:

```text
28-05-2024
29-05-2024 02:14
```

### Currency

Use clear currency labels.

```text
Valor CIF (USD)
1.245.980
```

Do not mix currencies without making the currency explicit.

### HS Codes

Use dotted HS format in display:

```text
8471.30.00.00
```

Allow search without dots:

```text
8471300000
```

### Countries

Show flag plus country name in detailed views. In compact table cells, flag plus name is acceptable when space allows.

---

## Responsive Behavior

### Desktop

Preferred layout:

- sidebar fixed
- explorer flexible
- detail panel fixed width

### Medium Screens

The detail panel may overlay the right side of the table.

Rules:

- keep the selected row visible when possible
- allow closing the panel
- avoid horizontal scrolling unless necessary for table columns

### Small Screens

Mobile is not the primary workflow, but the product should remain usable.

Recommended mobile behavior:

- sidebar collapses into menu
- search stays prominent
- filters become horizontal scroll chips
- table becomes a record list
- detail panel becomes full-screen drawer

---

## Accessibility

Minimum requirements:

- visible focus states
- keyboard navigation for search, filters, table rows, tabs, and drawer close
- sufficient contrast for text and badges
- icons must not be the only way to communicate meaning
- buttons require accessible labels
- tables should use proper semantic markup

Keyboard shortcuts:

```text
Cmd+K     Focus search
Esc       Close detail panel or clear active popover
Enter     Open selected record
Up/Down   Move through table rows when table is focused
```

---

## Component Checklist

Required reusable components:

- `AppShell`
- `Sidebar`
- `SidebarItem`
- `GlobalSearch`
- `FilterBar`
- `FilterChip`
- `DataTable`
- `DataTableRow`
- `Pagination`
- `RecordDetailPanel`
- `DetailTabs`
- `FieldGroup`
- `SourceTraceabilityCard`
- `OriginalRowPreview`
- `StatusBadge`
- `Button`
- `IconButton`
- `CountryBadge`
- `CopyButton`

---

## Implementation Notes

### CSS Tokens

Start with design tokens in a single file.

Suggested file:

```text
src/styles/tokens.css
```

Example:

```css
:root {
  --color-bg-app: #f8fafc;
  --color-bg-surface: #ffffff;
  --color-text-primary: #071735;
  --color-text-secondary: #33476b;
  --color-border: #dce4f0;
  --color-primary: #0b5cff;
  --radius-md: 8px;
  --radius-lg: 12px;
}
```

### Tailwind Mapping

If using Tailwind, map the tokens instead of hardcoding many one-off values.

Example:

```ts
theme: {
  extend: {
    colors: {
      surface: "var(--color-bg-surface)",
      app: "var(--color-bg-app)",
      primary: "var(--color-primary)",
      border: "var(--color-border)",
      text: {
        primary: "var(--color-text-primary)",
        secondary: "var(--color-text-secondary)",
        muted: "var(--color-text-muted)"
      }
    },
    borderRadius: {
      md: "var(--radius-md)",
      lg: "var(--radius-lg)"
    }
  }
}
```

---

## Anti-Patterns

Avoid:

- generic admin-dashboard cards everywhere
- colorful charts on the explorer screen without a clear task
- overusing gradients
- hiding source metadata behind secondary pages
- making the detail view feel like a modal interruption
- using vague statuses like `processed` without explaining source quality
- making filters visually heavier than the table
- forcing users to leave the explorer to verify one record
- fake insight cards before the data supports them
- public marketing-page styling inside signed-in product screens

---

## Product Quality Bar

A Duanera product screen is ready when:

- the user can understand the active dataset and filters immediately
- table scanning is fast
- selected records remain visually anchored
- source traceability is visible without extra navigation
- warnings are clear but not alarming
- uncertain or inferred data is labeled honestly
- actions are obvious
- spacing feels compact but not cramped
- the UI feels trustworthy before it feels decorative
