# Design System

## Purpose

`docs/DESIGN_SYSTEM.md` turns the signed-in product direction in `docs/DESIGN.md` and the current product UI reference screenshot into reusable implementation rules.

This document is for implementation of the signed-in product UI only. Public marketing, legal, informational, pricing, support, methodology, and SEO pages remain governed by `docs/PUBLIC_PAGE_STYLE_GUIDE.md`.

Do not use this file to introduce unrelated dashboard features, speculative analytics cards, or unsupported product screens. The system is focused on the current product shell:

- left navigation sidebar
- top search
- explorer title and filter row
- trade-record table
- pagination controls
- right-side record detail panel
- source traceability card
- data quality and review states

---

## Visual Model

The product should feel precise, calm, dense, and trustworthy.

The screenshot establishes these implementation traits:

- mostly white and near-white surfaces
- subtle blue active states
- compact controls with 8px to 12px radius
- dense table rows with strong alignment
- soft borders instead of heavy shadows
- right-side detail panel as an inspection drawer
- traceability shown as a green-tinted audit card
- warnings shown as amber-tinted but non-alarming panels
- color used for state and meaning, not decoration

---

## Token Philosophy

Use three token levels:

1. Foundation tokens: raw values such as color, spacing, radius, typography, and shadow.
2. Semantic tokens: role-based aliases such as surface, border, primary action, warning, and verified source.
3. Component tokens: component-specific aliases only when a component needs stricter behavior.

Prefer semantic tokens in components. Avoid hardcoding one-off hex values in product UI.

---

## Design Tokens

### Color Tokens

```css
:root {
  --ds-bg-app: #f8fafc;
  --ds-bg-shell: #ffffff;
  --ds-bg-surface: #ffffff;
  --ds-bg-muted: #f4f7fb;
  --ds-bg-subtle: #fbfdff;

  --ds-text-primary: #071735;
  --ds-text-secondary: #33476b;
  --ds-text-muted: #6b7a99;
  --ds-text-subtle: #8b98b3;
  --ds-text-inverse: #ffffff;

  --ds-border: #dce4f0;
  --ds-border-soft: #e8eef6;
  --ds-border-strong: #c8d4e5;

  --ds-primary: #0b5cff;
  --ds-primary-hover: #004ee6;
  --ds-primary-active: #0042c9;
  --ds-primary-soft: #eef4ff;
  --ds-primary-softer: #f5f8ff;

  --ds-success: #0f8a5f;
  --ds-success-soft: #e8f6ef;
  --ds-success-softer: #f2fbf7;
  --ds-success-border: #bfe6d3;

  --ds-warning: #b76b00;
  --ds-warning-soft: #fff7e8;
  --ds-warning-border: #f4d49b;

  --ds-danger: #c93636;
  --ds-danger-soft: #fff0f0;
  --ds-danger-border: #f0b8b8;

  --ds-purple: #6f2dbd;
  --ds-purple-soft: #f3edff;
  --ds-purple-border: #ddccff;

  --ds-focus-ring: #0b5cff;
}
```

### Color Roles

| Role | Token | Use |
| --- | --- | --- |
| App background | `--ds-bg-app` | Overall signed-in product background. |
| Shell background | `--ds-bg-shell` | Sidebar and fixed shell areas. |
| Surface | `--ds-bg-surface` | Tables, panels, controls, cards. |
| Muted surface | `--ds-bg-muted` | Subtle grouped backgrounds and inactive areas. |
| Primary text | `--ds-text-primary` | Headings, table values, important fields. |
| Secondary text | `--ds-text-secondary` | Navigation, labels, supporting copy. |
| Muted text | `--ds-text-muted` | Metadata, counts, helper text. |
| Border | `--ds-border` | Standard component boundaries. |
| Soft border | `--ds-border-soft` | Table dividers and low-emphasis separators. |
| Primary | `--ds-primary` | Active navigation, selected rows, links, primary actions. |
| Success | `--ds-success` | Verified source, valid state, successful import state. |
| Warning | `--ds-warning` | Missing fields, review needed, non-blocking data issues. |
| Danger | `--ds-danger` | Destructive actions and critical failures only. |
| Purple | `--ds-purple` | Rare advanced filter category, such as port constraints. |

### Typography Tokens

```css
:root {
  --ds-font-sans: Inter, Manrope, ui-sans-serif, system-ui, -apple-system,
    BlinkMacSystemFont, "Segoe UI", sans-serif;

  --ds-text-xs: 12px;
  --ds-text-sm: 13px;
  --ds-text-md: 14px;
  --ds-text-lg: 16px;
  --ds-text-xl: 22px;
  --ds-text-2xl: 28px;

  --ds-leading-tight: 1.2;
  --ds-leading-normal: 1.45;
  --ds-leading-relaxed: 1.6;

  --ds-font-regular: 400;
  --ds-font-medium: 500;
  --ds-font-semibold: 600;
  --ds-font-bold: 700;
}
```

### Typography Scale

| Name | Size | Weight | Line Height | Use |
| --- | ---: | ---: | ---: | --- |
| Page title | 22px | 700 | 1.2 | Explorer title and major panel titles. |
| Section title | 16px | 700 | 1.3 | Table section headers, card titles. |
| Body | 14px | 400-500 | 1.45 | Detail values and readable copy. |
| Dense body | 13px | 400-500 | 1.45 | Table cells, sidebar labels, controls. |
| Metadata | 12px | 400-600 | 1.45 | Field labels, counts, badges, table headers. |

Rules:

- Use `13px` or `14px` for dense product UI.
- Use `12px` for metadata, labels, counts, and table headers.
- Use tabular numbers for amounts, weights, counts, and dates.
- Do not scale type by viewport width.
- Keep letter spacing at `0` unless a component has a proven readability issue.

```css
.ds-numeric {
  font-variant-numeric: tabular-nums;
}
```

### Spacing Tokens

```css
:root {
  --ds-space-1: 4px;
  --ds-space-2: 8px;
  --ds-space-3: 12px;
  --ds-space-4: 16px;
  --ds-space-5: 20px;
  --ds-space-6: 24px;
  --ds-space-8: 32px;
  --ds-space-10: 40px;
}
```

Spacing rules:

- Use `4px` increments.
- Use `8px` to `12px` internal spacing for dense controls.
- Use `16px` to `24px` section spacing inside product surfaces.
- Use `32px` only for major page or panel separation.
- Avoid large vertical whitespace in data-heavy screens.

### Size Tokens

```css
:root {
  --ds-sidebar-width: 264px;
  --ds-detail-panel-width: 560px;
  --ds-topbar-height: 72px;
  --ds-control-height-sm: 32px;
  --ds-control-height-md: 36px;
  --ds-control-height-lg: 40px;
  --ds-search-height: 44px;
  --ds-table-header-height: 44px;
  --ds-table-row-height: 80px;
  --ds-icon-sm: 16px;
  --ds-icon-md: 18px;
  --ds-icon-lg: 20px;
}
```

### Radius Tokens

```css
:root {
  --ds-radius-xs: 4px;
  --ds-radius-sm: 6px;
  --ds-radius-md: 8px;
  --ds-radius-lg: 12px;
  --ds-radius-xl: 16px;
}
```

Radius rules:

- Use `8px` for buttons, chips, nav items, table controls, and most inputs.
- Use `10px` or `12px` for search, cards, and panels.
- Use `16px` only for large floating panels or primary containers.
- Avoid highly rounded pill styling except for small status badges.

### Shadow Tokens

```css
:root {
  --ds-shadow-soft: 0 4px 14px rgba(7, 23, 53, 0.06);
  --ds-shadow-panel: 0 12px 40px rgba(7, 23, 53, 0.10);
  --ds-shadow-focus: 0 0 0 3px rgba(11, 92, 255, 0.16);
}
```

Shadow rules:

- Prefer borders for normal product surfaces.
- Use `--ds-shadow-soft` for elevated controls only when needed.
- Use `--ds-shadow-panel` for the right detail panel and overlays.
- Do not stack multiple shadows inside the same component.

---

## Layout Rules

### App Shell

Desktop shell:

```text
sidebar 264px | main explorer minmax(720px, 1fr) | detail drawer 560px
```

Rules:

- Sidebar is fixed-width and full-height.
- Main explorer scrolls independently when needed.
- Detail panel is fixed to the right only when the viewport can preserve the table-first layout.
- Table remains the visual center of the page.
- Detail panel should not behave like a blocking modal on desktop.
- The implemented Explorer uses the three-column detail layout at wide desktop widths only. Below that threshold, the selected record detail moves below the main table area instead of squeezing or covering the table.

### Sidebar

Sidebar structure:

- brand row
- primary navigation group
- secondary tools group
- country/data context card
- footer links

Rules:

- Keep `16px` outer padding.
- Use `40px` nav-item height.
- Use `12px` item horizontal padding.
- Separate groups with a soft border or `24px` vertical gap.
- Active item uses soft blue background, blue icon, and semibold label.

### Main Explorer

Main explorer structure:

- top search bar
- title row
- filter row
- table toolbar
- records table
- pagination footer

Rules:

- Use a consistent left and right content inset, typically `24px`.
- Keep the top search aligned with the content grid.
- Keep filter chips on one row when space allows.
- Let the table occupy the largest vertical area.
- Do not add dashboard cards above the table unless a documented product decision introduces them.

### Detail Panel

Panel structure:

- panel header with close action
- record identifier row
- source status badge
- horizontal tabs
- details area
- optional vertical section rail
- source traceability card
- footer actions
- data quality warning panel

Rules:

- Use a white panel with subtle border and panel shadow.
- Use `24px` internal padding.
- Keep the close button in the top-right corner.
- Preserve row context in the table while the panel is open.
- On narrow laptop widths, preserve table width by placing the panel below the results area.
- A full-screen mobile drawer remains deferred until a mobile record-list layout is implemented.

---

## Component Inventory

### Shell Components

| Component | Purpose |
| --- | --- |
| `AppShell` | Owns sidebar, main content, and optional detail panel slots. |
| `AppShellMain` | Main content column inside the shell. |
| `AppShellContent` | Constrained content wrapper for the Explorer surface. |
| `Sidebar` | Persistent signed-in navigation. |
| `SidebarInner` | Sidebar layout container. |
| `SidebarBrand` | Product identity row. |
| `SidebarSection` | Grouped navigation area. |
| `SidebarItem` | Icon plus label navigation row. |
| `SidebarDataCard` | Small country/source context card shown in the sidebar. |
| `SidebarFooter` | Secondary footer links. |
| `GlobalSearch` | Global product search in the main top area. |

### Explorer Components

| Component | Purpose |
| --- | --- |
| `FilterBar` | Horizontal grouped filters. |
| `FilterBarGroup` | Semantic group of related filter controls. |
| `FilterBarActions` | Right-aligned filter actions. |
| `FilterChip` | One active or selectable constraint. |
| `DataTableShell` | Table container with toolbar, table, state, and pagination slots. |
| `DataTableToolbar` | Result count, column control, and export action area. |
| `DataTableTitle` | Table section title. |
| `DataTableCount` | Result count text. |
| `DataTableActions` | Table-level action group. |
| `DataTable` | Dense record table. |
| `DataTableHeader` | Sticky sortable header row. |
| `DataTableHead` | Header cell. |
| `DataTableBody` | Table body. |
| `DataTableRow` | Selectable record row. |
| `DataTableCell` | Body cell. |
| `DataTableState` | Shared loading, error, and empty state wrapper. |
| `DataTableEmpty` | Empty search/filter state. |
| `DataTableLoading` | Skeleton row state. |
| `DataTablePagination` | Page/cursor navigation and page-size control. |

### Detail Components

| Component | Purpose |
| --- | --- |
| `RecordDetailPanel` | Right-side inspection drawer. |
| `RecordDetailTabs` | Horizontal sections inside the panel. |
| `RecordDetailTab` | Individual detail tab. |
| `RecordDetailSection` | Grouped panel section. |
| `RecordDetailActions` | Detail action footer. |
| `VerifiedSourceBadge` | Source status near the record identifier. |
| `FieldGroup` | Two-column label/value detail layout. |
| `FieldGroupItem` | One label/value pair. |
| `FieldLabel` | Muted field label. |
| `FieldValue` | Copyable or linked field value. |
| `SourceTraceabilityCard` | Source, import batch, raw row, parser, and preview metadata. |
| `OriginalRowPreview` | Compact preview of original row values. |

### Primitive Components

| Component | Purpose |
| --- | --- |
| `Button` | Primary, secondary, ghost, and danger actions. |
| `IconButton` | Compact icon-only action with accessible label. |
| `StatusBadge` | Verified, review, error, and neutral status. |
| `FilterChipButton` | Interactive chip body. |
| `FilterChipRemoveButton` | Removable chip control. |

Deferred component decisions:

- Dedicated `CopyButton` and external-link helpers remain deferred until copy/source-opening behavior is wired.
- Column visibility and export controls can appear disabled, but should not become real controls until connected to product behavior.
- The mobile record-list replacement for the table remains deferred.

---

## Component Variants and States

### Button

Variants:

- `primary`: blue background, white text, main action.
- `secondary`: white background, border, supporting action.
- `ghost`: transparent background, low-emphasis panel or table action.
- `danger`: red styling for destructive actions only.

States:

- `default`
- `hover`
- `focus-visible`
- `active`
- `disabled`
- `loading`

Rules:

- Standard height is `40px`.
- Small height is `32px` or `36px`.
- Buttons must not resize when loading.
- Icon plus text buttons use `8px` gap.
- Icon-only buttons use square dimensions.

### Icon Button

Sizes:

- `sm`: 32px square, 16px icon.
- `md`: 36px square, 18px icon.
- `lg`: 40px square, 20px icon.

Rules:

- Always provide an accessible label.
- Use tooltips for non-obvious actions.
- Use visible focus states.
- Do not rely on icon shape alone for destructive or review states.

### Sidebar Item

States:

- `default`: transparent background, secondary text.
- `hover`: muted blue-gray background.
- `active`: primary-soft background, primary icon, semibold label.
- `disabled`: muted text, no hover effect.
- `badge`: optional count or status indicator aligned right.

### Search Input

Variants:

- `global`: 44px high, max-width constrained, shortcut hint on the right.
- `table`: 36px high, used only inside scoped table/filter tools.

States:

- empty
- filled
- focused
- loading
- no results
- error

Rules:

- Keep query visible after search.
- Provide one-click clear when filled.
- Preserve active filters.
- Shortcut hint uses `Cmd K` text, not a decorative-only icon.
- In the connected Explorer, the `q` search maps to available product/glosa text and HS-oriented fields. Do not imply legal company-name or RUT search until those fields exist in the data model.

### Status Badge

Variants:

- `verified`: green, for known traceable source.
- `review`: amber, for missing/inferred/incomplete data.
- `error`: red, for failed or invalid records.
- `neutral`: gray/blue-gray, for metadata or informational status.

Rules:

- Badges use small type, semibold label, compact padding.
- Icons may reinforce status but cannot be the only signal.
- Do not use green for inferred company identity unless the inference itself has been reviewed and labeled.

### Tabs

Variants:

- `panel-horizontal`: used in record detail panel.
- `section-rail`: optional vertical rail for long detail panels.

States:

- `default`
- `hover`
- `active`
- `focus-visible`

Rules:

- Active horizontal tab uses blue text and a 2px blue underline.
- Tabs should not change panel width.
- Use Spanish labels from `docs/DESIGN.md`.

---

## Table Rules

Tables are the primary product surface.

### Structure

Recommended base columns:

- selection checkbox
- date or period
- importer or possible importer when available
- product HS and product description
- origin country
- port
- CIF/FOB value when applicable
- net weight or quantity

Optional columns:

- exporter or possible exporter
- anonymous participant ID
- customs office
- transport mode
- source file
- raw row number
- data quality status

### Dimensions

```css
:root {
  --ds-table-header-height: 44px;
  --ds-table-row-height: 80px;
  --ds-table-cell-x: 14px;
  --ds-table-cell-y: 12px;
}
```

Rules:

- Header row height: `44px`.
- Body row target height: `72px` to `80px`.
- Cell horizontal padding: `12px` to `14px`.
- Header text: `12px`, semibold, secondary text.
- Cell text: `13px`, primary text.
- Use sticky headers for long tables.
- Use pagination or cursor pagination. Never use unbounded lists.

### Alignment

- Dates: left aligned, tabular numbers.
- Company names: left aligned, allow two-line wrap.
- Product HS: left aligned, keep HS code visible.
- Country: flag icon plus name where useful.
- Port: left aligned.
- Values and weights: right aligned, tabular numbers.
- Selection checkbox: centered.

### Row States

States:

- `default`: white background.
- `hover`: subtle blue-gray background.
- `selected`: primary-soft background with 3px left blue inset.
- `focused`: visible focus ring or inset outline.
- `disabled`: muted text and no row action.
- `loading`: skeleton cells preserving row height.

Selected row style:

```css
.data-table-row[data-selected="true"] {
  background: var(--ds-primary-softer);
  box-shadow: inset 3px 0 0 var(--ds-primary);
}
```

### Text Overflow

- Product descriptions may wrap to two or three lines.
- Preserve HS code visibility before product description.
- Use detail panel for full long values.
- Do not hide source or warning badges behind horizontal scrolling.

---

## Filter Rules

Filters must be powerful but controlled.

### Filter Groups

Use these groups when supported by the dataset:

- operation: import/export
- time: date range or period
- product: HS code and product text
- company or identity: verified company or possible identity
- anonymous source participant
- geography: origin, destination, partner country
- logistics: port, customs office, transport mode
- value and quantity
- source: file, import batch, parser state
- data quality: verified, review, error, missing field

### Filter Chip Types

Variants:

- `default`: white background, border.
- `active-primary`: blue tint for general active filters.
- `active-success`: green tint for HS/source/verified constraints.
- `active-purple`: purple tint for port or advanced constraints.
- `warning`: amber tint for review or missing-data constraints.

Rules:

- Height: `36px`.
- Radius: `8px`.
- Label text: `13px`, medium.
- Include a clear affordance for removable constraints.
- Keep filter labels explicit: `Partida HS: 8471.30`, not only `8471.30`.
- Do not show filters unsupported by the loaded dataset.

### Filter Bar Behavior

- Preserve active filters during search.
- Keep filters visible after results update.
- Allow clearing all filters.
- Use saved searches later to reduce repeated setup.
- On smaller screens, filter chips may horizontally scroll.
- Do not show filter controls for fields missing from the loaded dataset or current schema.

---

## Record Detail Panel Rules

The detail panel is for inspection and verification.

### Header

Include:

- title: `Detalle del registro`
- close button
- record ID
- copy action
- source status badge

Rules:

- Keep the title compact.
- Put close action in the top-right corner.
- Record ID should be copyable.
- Source badge appears near the record ID before tabs.

### Tabs

Recommended tabs:

- Resumen
- Mercancia
- Valores
- Transporte
- Documentos
- Historial

Rules:

- Use horizontal tabs under the header.
- Use the optional vertical rail only for long panels.
- Active tab has blue text and underline.

### Field Layout

Use a two-column field grid on desktop.

Rules:

- Label: `12px`, muted text.
- Value: `14px`, medium, primary text.
- Use `16px` to `24px` vertical gaps between field groups.
- Copy and external-link actions sit inline with values when useful.
- Do not present inferred values as verified source facts.

### Data Availability Dependencies

The implemented Explorer maps only fields currently exposed through the application data layer.

- Legal importer/exporter names and RUTs are not available in the current schema. Use anonymous source participant references, such as Aduana correlatives, and label unavailable identity fields plainly.
- HS labels, country labels, transport labels, customs-office names, and port names depend on code-table coverage. When a decoded label is missing, show the code with a clear `sin etiqueta` style fallback.
- Field-level parser warnings are not yet a stable user-facing contract. Review states may be derived from missing normalized/source fields until parser warnings are available.
- Source row previews depend on retained raw payloads. If the payload is not retained, the traceability card should still show source file, batch, and row references when available.
- Company/entity profile UX remains deferred until a verified lawful identity source exists.

### Panel Actions

Footer action examples:

- `Ver origen`
- `Ver registro completo`

Rules:

- Use secondary button for source/origin actions.
- Use primary button for full record action.
- Actions should remain visually available after the traceability card.

---

## Source Traceability Card Rules

The source traceability card is mandatory for record detail views when source metadata exists.

### Purpose

The card must answer:

- which import batch produced this record
- which source file produced this record
- which original row is referenced
- when the data was loaded
- which source organization provided the file
- whether the record was parsed, normalized, inferred, or requires review

### Visual Treatment

Use a green-tinted audit surface:

```css
.source-traceability-card {
  background: linear-gradient(180deg, var(--ds-success-softer), #eef8f4);
  border: 1px solid var(--ds-success-border);
  border-radius: var(--ds-radius-lg);
}
```

Rules:

- Use the green role because traceability is trust-positive.
- Do not use bright success styling that makes the card feel like a toast.
- Keep the card readable and audit-oriented.
- Use icons sparingly for source, file, row, date, and authority fields.

### Required Fields

Show when available:

- Lote de importacion
- Archivo fuente
- Fila original
- Periodo
- Fecha de carga
- Fuente
- Parser version
- Normalization status
- Checksum

Known limitation: these fields are conditional. Missing source metadata should be shown as unavailable or omitted with context; do not invent placeholder batch names, filenames, row numbers, checksums, parser versions, or source authorities.

### Original Row Preview

Rules:

- Preserve original values.
- Show only a compact subset by default.
- Keep row preview in a bordered white sub-surface.
- Provide `Ver mas columnas` when additional raw fields exist.
- Do not normalize values inside the original row preview.

---

## Data Quality Notice Rules

Use notices for source and normalization caveats.

### Review Notice

Use amber styling for non-blocking issues:

```text
Requiere revision
Peso bruto no informado en documento fuente.
```

Rules:

- Notice appears after main record/source actions or near affected fields.
- Use plain Spanish.
- Explain the concrete missing, inferred, or inconsistent field.
- Do not use alarming red styling for non-critical missing source fields.

### Error Notice

Use red only for critical issues:

- record could not load
- source unavailable
- parsing failed
- export failed
- permission blocked action

Rules:

- Include a retry or recovery action when possible.
- Separate user-actionable errors from data-quality warnings.

---

## Accessibility Requirements

Minimum requirements:

- All interactive controls have visible focus states.
- Icon-only buttons have accessible labels.
- Status is not communicated by color alone.
- Table headers use semantic table markup.
- Sortable headers expose sort state.
- Checkboxes have labels or row-selection names.
- Detail panel close action is keyboard accessible.
- Tabs use correct tab semantics or equivalent accessible patterns.
- Focus moves predictably when opening and closing the detail panel.
- `Esc` closes the detail panel or active popover.
- `Cmd+K` focuses global search when implemented.
- Text and badges meet contrast expectations against their backgrounds.

Keyboard expectations:

```text
Cmd+K     Focus global search
Esc       Close detail panel or clear active popover
Enter     Open selected or focused record
Up/Down   Move through table rows when table navigation is active
Tab       Move through controls in visual order
```

---

## Implementation Notes for CSS and Tailwind

### CSS Token File

Define tokens in one shared CSS file before creating component-level styles.

Suggested file:

```text
src/styles/tokens.css
```

Keep token names semantic and product-neutral. Prefer `--ds-primary` over one-off names such as `--blue-500`, and do not encode a mutable product name into token names.

### Tailwind CSS v4 Theme Tokens

Tailwind CSS v4 supports CSS-first configuration through `@theme`. Theme variables also become runtime CSS variables that can be referenced by utilities and arbitrary values.

Example mapping:

```css
@import "tailwindcss";

@theme inline {
  --font-sans: var(--ds-font-sans);

  --color-ds-app: var(--ds-bg-app);
  --color-ds-surface: var(--ds-bg-surface);
  --color-ds-muted: var(--ds-bg-muted);
  --color-ds-primary: var(--ds-primary);
  --color-ds-primary-soft: var(--ds-primary-soft);
  --color-ds-success: var(--ds-success);
  --color-ds-success-soft: var(--ds-success-soft);
  --color-ds-warning: var(--ds-warning);
  --color-ds-warning-soft: var(--ds-warning-soft);
  --color-ds-danger: var(--ds-danger);
  --color-ds-border: var(--ds-border);
  --color-ds-border-soft: var(--ds-border-soft);
  --color-ds-text-primary: var(--ds-text-primary);
  --color-ds-text-secondary: var(--ds-text-secondary);
  --color-ds-text-muted: var(--ds-text-muted);

  --radius-ds-sm: var(--ds-radius-sm);
  --radius-ds-md: var(--ds-radius-md);
  --radius-ds-lg: var(--ds-radius-lg);

  --shadow-ds-soft: var(--ds-shadow-soft);
  --shadow-ds-panel: var(--ds-shadow-panel);
}
```

Example usage:

```tsx
<div className="bg-ds-app text-ds-text-primary">
  <button className="rounded-ds-md bg-ds-primary text-white">
    Ver registro completo
  </button>
</div>
```

### CSS Variable Arbitrary Values

Use CSS variable arbitrary values for component-specific sizing that should stay token-driven.

```tsx
<aside className="w-(--ds-sidebar-width)" />
<section className="w-(--ds-detail-panel-width)" />
<button className="h-(--ds-control-height-lg)" />
```

### Tailwind v3 Compatibility Note

The implemented app uses Tailwind CSS v4 CSS-first theme variables in the global stylesheet. If a future package moves back to Tailwind v3, map the same CSS variables through `tailwind.config.ts` instead of changing token names.

### Component Styling Rules

- Build component variants from tokens, not raw colors.
- Keep table, filter, detail panel, and traceability card styles consistent before adding new variants.
- Use `data-state`, `data-active`, `data-selected`, and `aria-*` attributes for stateful styling.
- Prefer reusable variants over repeated utility strings once a pattern appears in multiple product components.
- Keep animation minimal: focus, hover, panel entry, and popover entry only.

### Implemented Foundation

The current foundation includes the Explorer shell, navigation, global search, filter bar, data-table shell, selected-record detail panel, traceability card, and primitive controls listed in the component inventory.

Do not use this implementation as permission to add dashboard cards, fake analytics, unsupported filters, or inferred company identity features.
