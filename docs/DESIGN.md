# Design

## Purpose and Scope

`docs/DESIGN.md` is the primary source of truth for signed-in product UI, interaction patterns, visual design, terminology, and component behavior.

The product is a Chile-first trade intelligence platform for exploring import and export records with clear source traceability. The signed-in product should feel serious, calm, analytical, trustworthy, and fast. It is not a playful consumer app, a government portal, a generic SaaS dashboard, or a colorful analytics template.

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

The product deals with large customs datasets, so the UI must support information density without feeling cluttered.

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
/logistics-parties/[id]
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
- contextual overlay detail drawer after row selection
- source/provenance section in the detail view
- saved search controls
- column visibility controls
- export/report controls later

Advanced filters should be powerful but controlled. Saved searches should reduce repeated work.

---

## Layout

### Application Shell

The product uses a persistent shell with an Explorer-first working surface. The detail drawer is contextual and overlays the Explorer only after row selection.

Default state:

```text
┌───────────────┬───────────────────────────────────────────────┐
│ Sidebar       │ Main explorer                                 │
│ Navigation    │ Search, filters, table                        │
└───────────────┴───────────────────────────────────────────────┘
```

Selected row state:

```text
┌───────────────┬───────────────────────────────────────────────┐
│ Sidebar       │ Main explorer                                 │
│ Navigation    │ Search, filters, table                        │
│               │                         ┌───────────────────┐ │
│               │                         │ Overlay drawer    │ │
│               │                         │ Selected record   │ │
│               │                         └───────────────────┘ │
└───────────────┴───────────────────────────────────────────────┘
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

### Detail Drawer

The record detail view is a contextual drawer that appears only after the user selects a table row.

By default, the Explorer shows only:

```txt
Sidebar + main explorer table
```

No detail drawer should be visible before a row is selected. The UI must not reserve permanent empty space for an unselected detail panel.

When the user clicks a table row, the Explorer shows:

```txt
Sidebar + main explorer table + selected record detail drawer
```

The drawer must show the selected row's real record information only.

Recommended drawer width on wide desktop screens:

```css
--detail-panel-width: 560px;
```

The detail drawer should feel like a focused inspection surface, not a modal and not a permanent third column. It must keep a clear visual boundary and always be easy to close.

#### Behavior

- The drawer appears only after a row is selected.
- The selected table row remains visually highlighted while the drawer is open.
- The drawer content must come from the selected record's real data.
- The drawer must include a clear close button.
- Table rows must expose that they open the detail drawer, support full-row click, and support keyboard opening.
- `Enter` and `Space` open the selected row's detail drawer.
- `Escape` closes the drawer when it is open.
- Closing the drawer should restore focus to the row that opened it when possible.
- Closing the drawer hides it and returns the Explorer table to the full available content width.
- Opening or closing the drawer must preserve the current search query, filters, pagination, and table position.
- Raw IDs, source IDs, declaration IDs, and correlativos may appear as secondary metadata, but they should not be the main drawer title.
- Parser names, payload metadata, hashes, declaration IDs, source IDs, and raw technical identifiers belong in source/provenance areas, not in the primary record identity.
- The drawer must not show placeholder record details.

#### Responsive behavior

On desktop, the selected-record detail appears as an overlay drawer from the right side of the Explorer area.

The drawer must not permanently resize or squeeze the table. The table remains the primary working surface and keeps its full layout width behind the drawer.

Recommended drawer width:

```css
--detail-panel-width: 560px;
```

The drawer may cover the right side of the table while open. This is preferable to compressing the table into an unreadable layout. The selected row remains highlighted behind the drawer.

On narrower laptop and tablet widths, the drawer may use a larger overlay width or become a full-screen drawer. It should not appear below the table unless there is a specific usability reason.

In all responsive layouts, the core rule is the same:

```txt
No selected row = no drawer
Selected row = overlay drawer with that row's details
```

#### Anti-patterns

Avoid:

- showing an empty right panel on initial page load
- reserving permanent empty space for the drawer before selection
- showing generic placeholder content in the drawer
- making the drawer look like a fixed third column
- navigating away from the Explorer just to inspect one record
- losing active filters, pagination, or table position when opening a record

### Implemented Explorer Layout

The current `/explorer` route implements the Explorer-first workflow with:

- persistent signed-in shell and sidebar
- top global search
- title/context area
- compact filter bar and active chips
- compact result summary metrics
- dense table-first results surface
- table views for commercial, merchandise, value, logistics, and source workflows
- secondary single-category ranking module for common analyst pivots
- selected-row state
- contextual selected-record detail drawer
- source traceability card
- loading, empty, failed-fetch, and stale-selection states
- keyboard-accessible row opening and `Escape` close
- focus restoration to the selected row after close

The product-facing Explorer default should use the latest non-test Aduana dataset period available to users. Internal, smoke, fixture, future-dated, or `source_category = 'test'` data may remain in the database for QA, but it must be excluded from product-facing default period discovery and default Explorer results.

For Chile Aduana, the product-facing Explorer coverage target starts at `2021-01` and runs through the latest available product-facing month. Older official or historical files may remain useful for research, parser validation, and internal evidence, but should not appear in product-facing Explorer defaults unless a later decision expands the supported coverage window.

The Explorer uses the existing application data-access layer. UI components must continue to consume service/API-shaped data and must not query customs/trade tables directly from client components.

### Implemented Field Mapping

Use real fields only.

- Explorer result summary shows compact metrics for:
  - Registros
  - `US$ CIF` or `US$ FOB` by flow
  - `US$ FOB total`
  - Operaciones / declaraciones únicas
  - Participantes as `Importador` or `Exportador` with `ID Aduana`
  - Cantidad
  - Peso bruto
  - Peso bruto total
- Explorer ranked breakdowns are secondary to the records table. The default page should not show all ranking categories at once. Use one compact ranking module with segmented categories:
  - Partidas arancelarias
  - Países origen or destino by flow
  - Participantes / IDs Aduana
  - Puertos de embarque or desembarque by flow
  - Vía de transporte
- Default ranking category is `Partidas arancelarias`. Ranking rows should filter the current table results when clicked.
- Default Explorer table view is `Resumen comercial`, with columns:
  - Fecha
  - Operación
  - Partida arancelaria
  - Producto
  - Importador or Exportador
  - País
  - Aduana
  - Puerto
  - `US$ CIF` or `US$ FOB`
  - Cantidad
  - Peso bruto
  - Fuente
- Additional table views are `Valores`, `Logística`, `Producto / arancel`, and `Fuente`. These views should use horizontal scroll when needed instead of hiding useful trade fields.
- Table columns map to acceptance date or period, trade flow, product description, partida arancelaria, importer/exporter ID Aduana when legal names are unavailable, countries, customs, ports, transport context, cargo type, CIF/FOB value by flow, FOB total, freight, insurance, CIF total, unit price, quantity, gross weights, source status, source file, import batch, parser, payload state, declaration source ID, item number, and raw row number.
- Search currently maps to available product/glosa text and partida-oriented fields. It should not promise legal company-name or RUT search until those fields exist.
- Filters map to supported query parameters such as flow, period range, product text, partida prefix, anonymous participant ID, origin/destination country, customs office, vía de transporte, port, numeric value/quantity/weight ranges, sorting, and limit.
- Record detail is grouped into:
  - Resumen
  - Participantes
  - Producto
  - Valores
  - Logística
  - Fuente y trazabilidad
- Record detail maps period/date, flow, market, relevant port, value, quality state, anonymous participant ID, legal-identity availability, partida raw/normalized values, product text and attributes, quantity, declaration values, weights, countries, customs, ports, transport, cargo type, source file, import batch, raw row, parser, declaration source ID, item number, raw payload retention/storage, payload hash, and original-row preview when available.
- Source traceability maps source file, raw row, declaration source ID, item number, import batch, parser, raw payload retention/storage, payload hash, and original-row preview when available.
- Data-quality states are derived from available normalized/source fields until a field-level parser warning contract exists.

Fields dependent on future data availability:

- legal importer/exporter names
- RUTs or verified entity identifiers
- verified company/entity profiles
- field-level parser warnings
- full raw-row previews when raw payloads are not retained
- decoded labels when code-table coverage is incomplete

---

## Visual Foundation

### Color Tokens

Canonical implementation tokens live in `src/styles/tokens.css` and use the product-neutral `--ds-*` prefix. The roles below describe the intended visual semantics; use `docs/DESIGN_SYSTEM.md` for the complete token list and Tailwind mapping.

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
  'Manrope',
  ui-sans-serif,
  system-ui,
  -apple-system,
  BlinkMacSystemFont,
  'Segoe UI',
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

--shadow-panel: 0 12px 40px rgba(7, 23, 53, 0.1);
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
.sidebar-item[data-active='true'] {
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
Buscar importador, exportador, producto o partida
```

Search should support, when available:

- importer names or possible importer names
- exporter/supplier names or possible exporter names
- anonymous source participant IDs
- partidas arancelarias / HS codes
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
- product / partida arancelaria
- companies or possible identities
- anonymous source participant IDs
- geography
- logistics
- value / quantity / weight
- source / import batch
- data quality / status

Only implement filters supported by the first real dataset.

Logistics-party filters use the label `Entidad logística` for mixed roles,
`Emisor documento transporte` for transport-document issuer appearances, and
`Compañía de transporte` for carrier appearances. These filters are separate
from importer/exporter identity filters and should keep uncertainty visible.

Filter types may include:

- operation type
- date range
- country
- partida arancelaria
- port
- customs office
- vía de transporte
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
Partida arancelaria: 8471.30
Puerto: San Antonio
País de origen: China
Fuente: Aduana Chile
```

Use removable chips for specific constraints:

```text
Partida arancelaria: 8471.30 x
Puerto: San Antonio x
```

### Data Tables

Tables are the core interface component. They should be useful, not decorative.

Tables should support:

- focused table views before broad column visibility
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

Do not invent dozens of unsupported columns. When the dataset supports many useful trade fields, prefer named table views and horizontal scroll over a single overloaded table.

Recommended default columns for Explorer import records:

- date or period
- operation
- partida arancelaria
- product
- importer ID Aduana
- origin country
- customs office
- relevant port
- `US$ CIF`
- quantity
- gross weight
- source

Optional columns:

- declaration/source IDs
- `US$ FOB total`
- freight
- insurance
- CIF total
- unit price
- acquisition/consignment/destination countries
- embark/disembark ports
- vía de transporte
- cargo type
- source file
- row number
- parser and payload state
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
.data-table tr[data-selected='true'] {
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

### Detail Drawer

The detail drawer is a contextual inspection surface for the currently selected table row. It is not visible before selection and must not reserve empty space on initial Explorer load.

The drawer opens when the user selects a row in the records table. Row selection must preserve the current search query, structured filters, pagination, and table position. The selected row remains highlighted while the drawer is open. Rows should support full-row click plus keyboard opening with `Enter` and `Space`.

The drawer closes through a clear close action or `Escape`. Closing removes only the selected-record state, hides the drawer, returns the table to the full available content width, and should restore focus to the row that opened the drawer when possible.

Header content:

- clean, human-readable record title
- source status badge
- secondary business metadata such as flow, partida arancelaria, date, market, and CIF/FOB value
- close action

Raw IDs, parser names, payload metadata, source IDs, declaration IDs, and correlativos should not be the strongest title or header identity. Put these fields in secondary sections or source/provenance areas.

Implemented drawer groups:

- Resumen
- Participantes
- Producto
- Valores
- Logística
- Fuente y trazabilidad

The drawer must show only real selected-record data. Do not render placeholder record details, fake source previews, or generic empty drawer content.

Use a two-column definition layout for key fields when space allows.

Example fields:

- Fecha de operación or fecha disponible
- Régimen
- Importador/exportador with `ID Aduana` when legal identity is unavailable
- Partida arancelaria
- Producto
- Referencia fuente, when available
- Cantidad, when available
- `US$ CIF` or `US$ FOB` by flow
- `US$ FOB total`, `US$ CIF total`, flete, seguro, or precio unitario when available
- Peso bruto or peso bruto total, when available
- País principal
- País origen, adquisición, consignación, or destino when available
- Aduana, puerto, vía de transporte, and tipo de carga when available
- Source file, declaration source ID, item number, import batch, raw row, parser, payload state, and payload hash when available

Labels should be muted and small. Values should be stronger and easy to scan or copy.

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

A right-side vertical tab rail can be used for quick jumping inside the drawer only when the drawer contains enough vertical detail to justify it. Otherwise, keep only the horizontal tab bar.

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

- Archivo fuente
- Fila original
- Declaración fuente, when available
- Ítem declaración, when available
- Lote de importación
- Periodo
- Fecha de carga
- Fuente
- Parser version, when available
- Payload retention/storage state
- Payload hash or checksum, when available
- Normalization or traceability status
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

Use clear currency labels. Follow trade-intelligence naming conventions where the currency and value basis live in the label, not repeated after every number.

```text
US$ CIF
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

## Display Labels vs Raw Source Values

The product should not expose raw source labels as the primary user-facing value when those labels are cryptic, uppercase, overly long, code-heavy, or written in source-system language.

The UI must distinguish between:

- user-facing display labels
- raw source values
- normalized codes
- provenance/source values

### Main rule

Use clean, business-readable labels in the main UI.

Keep raw source values available in secondary metadata, detail sections, tooltips, or `Fuente y trazabilidad`.

The main table and drawer summary should prioritize readability. The source/provenance areas should preserve auditability.

### Product vocabulary

Use business-readable trade vocabulary in the primary UI. Datasur-style exports and Chile trade workflows are useful references for naming, but the product should stay cleaner and more explainable.

Preferred primary labels:

```txt
Partida arancelaria
Producto
Importador
Exportador
ID Aduana
N° aceptación
País de origen
País de adquisición
País de destino
Puerto de embarque
Puerto de desembarque
Vía de transporte
Tipo de carga
Cantidad
Peso bruto
Peso bruto total
US$ CIF
US$ FOB
US$ Flete
US$ Seguro
US$ unitario
```

Avoid raw/internal labels in the main UI:

```txt
Valor item
Peso item
Correlativo Aduana
Partida HS
DOLAR after every amount
Opaque unit codes such as KN or U
```

Rules:

- Use `Partida arancelaria` in primary labels. `HS` can appear as secondary shorthand where space is tight or the code context is obvious.
- Use `Importador` or `Exportador` as the business concept, with `ID Aduana` as the qualifier when legal names/RUTs are unavailable.
- Do not label anonymous source IDs as companies, RUTs, or legal identities.
- Put currency in the label (`US$ CIF`), and keep the numeric value clean (`22.231,55`).
- Expand known units into readable labels, for example `kg netos` and `unidades`.
- Preserve raw codes, raw labels, source units, and original wording in `Fuente y trazabilidad` or export provenance fields.

### Examples

Transport mode:

```txt
Raw source value:
1 · MARÍTIMA, FLUVIAL Y LACUSTRE

Primary display:
Marítimo

Secondary/source display:
Código 1 · MARÍTIMA, FLUVIAL Y LACUSTRE
```

Country:

```txt
Raw source value:
336 · CHINA

Primary display:
🇨🇳 China

Secondary/source display:
Código 336 · CHINA
```

Customs office:

```txt
Raw source value:
34 · Valparaíso

Primary display:
Valparaíso

Secondary/source display:
Aduana 34 · Valparaíso
```

Port:

```txt
Raw source value:
905 · VALPARAÍSO

Primary display:
Valparaíso

Secondary/source display:
Puerto 905 · VALPARAÍSO
```

### Trade Participant Display and Normalization

Trade participant names from source datasets are often raw, inconsistent, truncated, or overly technical. The UI should avoid showing only the raw source value when a clearer interpretation is available.

Participant names should support three levels:

1. **Raw source value**
   The exact original value from the dataset. This must always be preserved and available for traceability.

2. **Normalized legal/local entity**
   A cleaned display name for the specific company entity when it can be inferred with reasonable confidence.

3. **Normalized parent/group**
   A broader company group used for grouping, search, and filtering.

Do not collapse clearly different legal/local entities into one company record. Local branches, country-specific entities, and different legal forms should stay distinct at legal-entity level, while still being grouped under the same parent/company group when appropriate.

Example:

- `A. HARTRODT CHILE S.A.` should display as `A. Hartrodt Chile S.A.`
- `A. HARTRODT DEUTSCHLAND (GMBH)` should display as `A. Hartrodt Deutschland GmbH`
- `A. HARTRODT SHANGHAI LOGISTICS` should display as `A. Hartrodt Shanghai Logistics`
- `A.HARTRODT AG` should display as `A. Hartrodt AG`
- `A.HARTRODT` should be treated as an ambiguous group-level match, not as a confirmed legal entity

Recommended display pattern for a clear entity:

```txt
A. Hartrodt Chile S.A. 🇨🇱
a. hartrodt Group
Raw: A. HARTRODT CHILE S.A.
```

Recommended display pattern for an ambiguous short-form value:

```txt
a. hartrodt
Group match · Legal entity unclear
Raw: A.HARTRODT
```

When confidence is low, the UI should make that uncertainty visible instead of pretending the match is exact.

### Logistics Party Profiles

Logistics-party profiles are source-field profiles for transport and document
parties, not company-identity profiles. Use the route `/logistics-parties/[id]`
and the Spanish heading `Entidad logística`.

Profile copy must say that the entity appears in transport/document fields and
is not a verified legal importer/exporter identity. Role badges should use:

- `Emisor documento transporte`
- `Compañía de transporte`

Mixed-flow value summaries must keep `US$ CIF importaciones` separate from
`US$ FOB exportaciones`; do not combine them into a single total.

### Country display

Country values should show the country flag next to the readable country name when space allows.

Preferred display:

```txt
🇨🇳 China
🇯🇵 Japón
🇩🇪 Alemania
🇨🇱 Chile
```

Rules:

- Use flag + country name in tables when it improves scanning.
- Use flag + country name in the detail drawer for country fields.
- Do not show numeric country codes as the primary value.
- Preserve country codes in source/provenance or secondary metadata where useful.
- If the country is unknown or unmapped, show a clear fallback such as `País no identificado` and preserve the raw source value in the source section.

### UI guidance

- Tables should use short, readable display labels.
- Detail drawer summaries should use readable labels first.
- Source/provenance sections should preserve raw source values.
- Tooltips or secondary text may show the original source value when useful.
- Do not remove raw values entirely if they are needed for auditability.
- Do not make users interpret source-system codes in normal product flows.

---

## Responsive Behavior

### Desktop

Preferred layout:

- sidebar fixed
- Explorer table keeps the full available layout width
- selected record opens in an overlay drawer from the right

### Medium Screens

Prefer overlay or full-screen drawer behavior instead of squeezing the table or moving the detail below the table.

Rules:

- keep the selected row visible when possible
- allow closing the drawer
- avoid horizontal scrolling unless necessary for table columns

### Small Screens

Mobile is not the primary workflow, but the product should remain usable.

Recommended mobile behavior:

- sidebar collapses into menu
- search stays prominent
- filters become horizontal scroll chips
- table becomes a record list
- detail drawer may become full-screen

Mobile record-list and full-screen drawer behavior remain deferred design work. Do not treat the desktop table as a finished mobile interaction.

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
- `AppShellMain`
- `AppShellContent`
- `Sidebar`
- `SidebarInner`
- `SidebarBrand`
- `SidebarSection`
- `SidebarItem`
- `SidebarDataCard`
- `SidebarFooter`
- `GlobalSearch`
- `FilterBar`
- `FilterBarGroup`
- `FilterBarActions`
- `FilterChip`
- `FilterChipButton`
- `FilterChipRemoveButton`
- `DataTableShell`
- `DataTableToolbar`
- `DataTableTitle`
- `DataTableCount`
- `DataTableActions`
- `DataTable`
- `DataTableHeader`
- `DataTableHead`
- `DataTableBody`
- `DataTableRow`
- `DataTableCell`
- `DataTableState`
- `DataTableEmpty`
- `DataTableLoading`
- `DataTablePagination`
- `RecordDetailPanel`
- `RecordDetailTabs`
- `RecordDetailTab`
- `RecordDetailSection`
- `RecordDetailActions`
- `VerifiedSourceBadge`
- `FieldGroup`
- `FieldGroupItem`
- `FieldLabel`
- `FieldValue`
- `SourceTraceabilityCard`
- `OriginalRowPreview`
- `StatusBadge`
- `Button`
- `IconButton`

Deferred component work:

- dedicated copy/external-link helper components
- mobile record-list replacement for the data table
- real column visibility and export controls
- additional record detail tabs beyond the implemented summary shell

---

## Implementation Notes

### CSS Tokens

Design tokens live in a single shared CSS file:

```text
src/styles/tokens.css
```

Example:

```css
:root {
  --ds-bg-app: #f8fafc;
  --ds-bg-surface: #ffffff;
  --ds-text-primary: #071735;
  --ds-text-secondary: #33476b;
  --ds-border: #dce4f0;
  --ds-primary: #0b5cff;
  --ds-radius-md: 8px;
  --ds-radius-lg: 12px;
}
```

Use product-neutral token names. Do not encode a mutable product name into CSS variables, Tailwind aliases, or reusable component APIs.

### Tailwind Mapping

The app uses Tailwind CSS v4 CSS-first theme mapping in the global stylesheet. Map Tailwind utilities to `--ds-*` variables instead of hardcoding one-off values.

Example:

```css
@theme inline {
  --color-ds-app: var(--ds-bg-app);
  --color-ds-surface: var(--ds-bg-surface);
  --color-ds-primary: var(--ds-primary);
  --color-ds-border: var(--ds-border);
  --color-ds-text-primary: var(--ds-text-primary);
  --radius-ds-md: var(--ds-radius-md);
  --radius-ds-lg: var(--ds-radius-lg);
}
```

Components should consume these utilities and arbitrary token values, for example `bg-ds-surface`, `text-ds-text-primary`, `border-ds-border`, `rounded-ds-md`, `shadow-ds-panel`, and `h-(--ds-control-height-md)`.

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

A signed-in product screen is ready when:

- the user can understand the active dataset and filters immediately
- table scanning is fast
- selected records remain visually anchored
- source traceability is visible without extra navigation
- warnings are clear but not alarming
- uncertain or inferred data is labeled honestly
- actions are obvious
- spacing feels compact but not cramped
- the UI feels trustworthy before it feels decorative
