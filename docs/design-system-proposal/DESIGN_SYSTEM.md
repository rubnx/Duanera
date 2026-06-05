# Duanera Design System
## Comercio Exterior de Chile — v3.0

> **Agent instructions:** Read this document in full before writing any UI code. Section 16 contains a ready-to-paste system prompt block. Every rule here maps directly to tokens in `tokens/tokens.css`.

---

## Contents

1. [Token Architecture](#1-token-architecture)
2. [Color](#2-color)
3. [Typography](#3-typography)
4. [Spacing](#4-spacing)
5. [Radius](#5-radius)
6. [Elevation & Borders](#6-elevation--borders)
7. [Motion](#7-motion)
8. [Badges & Chips](#8-badges--chips)
9. [Buttons](#9-buttons)
10. [Inputs](#10-inputs)
11. [Metric Cards](#11-metric-cards)
12. [Navigation Sidebar](#12-navigation-sidebar)
13. [Data Table](#13-data-table)
14. [Detail Panel](#14-detail-panel)
15. [Icons](#15-icons)
16. [Accessibility](#16-accessibility)
17. [Hard Rules — Never Do](#17-hard-rules--never-do)
18. [Agent System Prompt](#18-agent-system-prompt)

---

## 1. Token Architecture

Two layers live in `tokens/tokens.css`. Import it once at the project root.

```css
@import './tokens/tokens.css';
```

### Layer 1 — Primitives
Raw named values. **Never reference these in component code.**

```
--primitive-blue-600    → #1A4FE3
--primitive-gray-50     → #F5F4F0
--primitive-space-4     → 16px
```

### Layer 2 — Semantic tokens
Intent-mapped aliases. **Always use these in components.**

```
--color-action-primary  → maps to --primitive-blue-600
--color-bg-page         → maps to --primitive-gray-50
--space-4               → maps to --primitive-space-4
```

### Why two layers?

When the brand changes, you update one primitive. Every semantic token that maps to it updates automatically across the entire product without touching component files.

---

## 2. Color

### Surface tokens

| Token | Value | Usage |
|---|---|---|
| `--color-bg-page` | `#F5F4F0` | Page canvas |
| `--color-bg-surface` | `#FFFFFF` | Cards, panels, inputs, **nav sidebar** |
| `--color-bg-subtle` | `#EEEDE9` | Secondary fills, icon circles |
| `--color-bg-accent` | `#EBF0FD` | Active rows, chip fills, active nav items |
| `--color-bg-success` | `#E5F5EF` | Verified badges |
| `--color-bg-warning` | `#FEF2E0` | Review alerts |
| `--color-bg-danger` | `#FDECEA` | Error states |

### Text tokens

| Token | Value | Usage |
|---|---|---|
| `--color-text-primary` | `#0F0E0C` | Headings, body copy |
| `--color-text-secondary` | `#5C5A56` | Supporting text, nav item labels |
| `--color-text-muted` | `#9B9894` | Placeholders, field labels, captions |
| `--color-text-accent` | `#1A4FE3` | Links, active indicators |
| `--color-text-accent-on-bg` | `#0C3BB5` | Text sitting on `--color-bg-accent` |
| `--color-text-success` | `#065C3D` | Text on success-bg |
| `--color-text-warning` | `#7A3E00` | Text on warning-bg |
| `--color-text-danger` | `#8F1D12` | Text on danger-bg |
| `--color-text-on-accent` | `#FFFFFF` | Text on solid accent fill (buttons) |

### Border tokens

| Token | Usage |
|---|---|
| `--color-border-default` | Row separators, light dividers |
| `--color-border-strong` | Card edges, input outlines |
| `--color-border-accent` | Selected row left accent, active tab underline |
| `--color-border-focus` | Focus rings (always 2px) |
| `--color-border-success/warning/danger/neutral` | Semantic badge borders |

### Pairing rules

- Always pair `--color-bg-accent` with `--color-text-accent-on-bg`
- Always pair `--color-bg-success` with `--color-text-success` (same for warning, danger)
- Never place `--color-text-primary` on a colored background — use the `-on-bg` variant
- Color is **never the sole** status indicator — pair with text or icon always

---

## 3. Typography

### Typefaces

| Token | Value | Usage |
|---|---|---|
| `--font-sans` | `'DM Sans', system-ui, sans-serif` | All UI copy, labels, body |
| `--font-mono` | `'DM Mono', 'Courier New', monospace` | Data values, IDs, labels |

Load fonts:
```html
<link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500&display=swap" rel="stylesheet">
```

### Type scale

| Role | Token | Value | Weight | Usage |
|---|---|---|---|---|
| Display | `--text-display` | 22px | 500 | Page titles, section headers |
| Heading | `--text-heading` | 17px | 500 | Panel/card headers |
| Subheading | `--text-subheading` | 14px | 500 | Field groups, subsections |
| Body | `--text-body` | 13px | 400 | Default body copy |
| Small | `--text-small` | 11px | 400 | Supporting text, captions |
| Mono value | `--text-mono-value` | 12px | 400 | IDs, HS codes, dates, file names |
| Mono label | `--text-mono-label` | 10px | 500 | Uppercase field labels |
| Mono large | `--text-mono-large` | 19px | 500 | Prominent numeric values (CIF) |

### Weight
Only `400` (regular) and `500` (medium). **Never 600 or 700** — they look heavy in this system.

### When to use DM Mono
✅ Record IDs (`IMP-2024-05-28-001245`)  
✅ HS codes (`8471.30.00.00`)  
✅ Dates (`28-05-2024`)  
✅ Numeric data values (`1.245.980`)  
✅ File names (`DUS_SA_20240528.csv`)  
✅ 10px uppercase field labels  
✅ Pagination numbers  
❌ Never for descriptions, explanations, or running prose  

### Uppercase
Only for 10px mono field labels: `text-transform: uppercase; letter-spacing: var(--letter-spacing-label)`. Never uppercase headings or body copy.

---

## 4. Spacing

All spacing uses a base-4 scale. Use `--space-*` tokens. Never use arbitrary values.

| Token | Value | Common usage |
|---|---|---|
| `--space-1` | 4px | Icon gaps, tight inline spacing |
| `--space-2` | 8px | Badge/chip padding, card grid gap |
| `--space-3` | 12px | Button padding x, table row gaps |
| `--space-4` | 16px | Card inner padding, section gaps |
| `--space-5` | 20px | Panel inner padding |
| `--space-6` | 24px | Between component groups |
| `--space-8` | 32px | Section vertical rhythm |
| `--space-12` | 48px | Between major page sections |
| `--space-16` | 64px | Page top padding |

---

## 5. Radius

| Token | Value | Usage |
|---|---|---|
| `--radius-sm` | 4px | Nav items active bg, small tags, tight buttons |
| `--radius-md` | 8px | Inputs, buttons, stat cards, alert strips |
| `--radius-lg` | 12px | Cards, panels, table shells |
| `--radius-pill` | 999px | Badges, filter chips |

**Rule:** Never apply `border-radius` to single-sided border elements. `border-left` accents → `border-radius: 0`.

---

## 6. Elevation & Borders

### Three levels only. Never invent new shadow values.

| Level | CSS | Usage |
|---|---|---|
| 0 — Flat | `border: 0.5px solid var(--color-border-strong)` | Inputs, flat cards, table rows |
| 1 — sm | `box-shadow: var(--shadow-sm)` | Table shells, toolbars |
| 2 — md | `box-shadow: var(--shadow-md)` | Detail panels, modals, dropdowns |

All borders in this system are `0.5px`. Never `1px` or `2px` except the selected-row accent (`--table-selected-border`) and the active tab underline (`--panel-tab-border`).

---

## 7. Motion

| Token | Value | Usage |
|---|---|---|
| `--duration-fast` | 80ms | Button hover, checkbox toggle |
| `--duration-base` | 150ms | Default transitions, dropdown open |
| `--duration-slow` | 250ms | Panel slide-in, modal appear |
| `--ease-default` | `cubic-bezier(0.16, 1, 0.3, 1)` | Most transitions |
| `--ease-out` | `cubic-bezier(0, 0, 0.2, 1)` | Elements entering the screen |
| `--ease-in` | `cubic-bezier(0.4, 0, 1, 1)` | Elements leaving the screen |

Button hover uses **opacity only**, never a color change:
```css
.btn:hover { opacity: var(--btn-hover-opacity); } /* 0.82 */
```

---

## 8. Badges & Chips

### Badge HTML

```html
<!-- Success — verified state -->
<span class="badge badge-success">
  <span class="badge-dot"></span>
  Fuente verificada
</span>

<!-- Info — regime, type -->
<span class="badge badge-info">Definitiva</span>

<!-- Warning — needs review -->
<span class="badge badge-warning">
  <i class="ti ti-alert-triangle" aria-hidden="true"></i>
  Requiere revisión
</span>

<!-- Danger — error state -->
<span class="badge badge-danger">Error</span>

<!-- Neutral — classification -->
<span class="badge badge-neutral">Importación</span>
```

### Badge CSS

```css
.badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-family: var(--font-sans);
  font-size: var(--badge-font-size);
  font-weight: var(--badge-font-weight);
  padding: var(--badge-padding-y) var(--badge-padding-x);
  border-radius: var(--badge-radius);
  line-height: var(--line-height-tight);
}

.badge-success { background: var(--color-bg-success); color: var(--color-text-success); border: 0.5px solid var(--color-border-success); }
.badge-info    { background: var(--color-bg-accent);  color: var(--color-text-accent-on-bg); border: 0.5px solid rgba(26,79,227,0.18); }
.badge-warning { background: var(--color-bg-warning); color: var(--color-text-warning); border: 0.5px solid var(--color-border-warning); }
.badge-danger  { background: var(--color-bg-danger);  color: var(--color-text-danger);  border: 0.5px solid var(--color-border-danger); }
.badge-neutral { background: var(--color-bg-neutral); color: var(--color-text-secondary); border: 0.5px solid var(--color-border-neutral); }

.badge-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: currentColor;
  flex-shrink: 0;
}
```

### Filter chip HTML

```html
<span class="chip chip-active">
  <i class="ti ti-filter" aria-hidden="true"></i>
  Importaciones
  <button class="chip-dismiss" aria-label="Remove filter">×</button>
</span>

<span class="chip">
  <i class="ti ti-calendar" aria-hidden="true"></i>
  Últimos 24 meses
</span>
```

### Filter chip CSS

```css
.chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-family: var(--font-sans);
  font-size: var(--chip-font-size);
  font-weight: var(--font-weight-medium);
  height: var(--chip-height);
  padding: 0 var(--chip-padding-x);
  border-radius: var(--chip-radius);
  background: var(--color-bg-surface);
  border: 0.5px solid var(--color-border-strong);
  color: var(--color-text-secondary);
  cursor: pointer;
}

.chip.chip-active {
  background: var(--color-bg-accent);
  border-color: rgba(26, 79, 227, 0.25);
  color: var(--color-text-accent-on-bg);
}

.chip-dismiss {
  font-size: 9px;
  opacity: 0.5;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  line-height: 1;
}
```

---

## 9. Buttons

### HTML

```html
<!-- Variants -->
<button class="btn btn-primary">
  <i class="ti ti-file-search" aria-hidden="true"></i>
  Ver registro
</button>
<button class="btn btn-secondary">
  <i class="ti ti-download" aria-hidden="true"></i>
  Exportar
</button>
<button class="btn btn-ghost">Vista pública</button>
<button class="btn btn-success">
  <i class="ti ti-check" aria-hidden="true"></i>
  Verificado
</button>
<button class="btn btn-warning">
  <i class="ti ti-alert-triangle" aria-hidden="true"></i>
  Revisar
</button>

<!-- Sizes -->
<button class="btn btn-primary btn-sm">Pequeño</button>
<button class="btn btn-primary">Normal</button>
<button class="btn btn-primary btn-lg">Grande</button>

<!-- Icon-only: must have aria-label -->
<button class="btn btn-secondary btn-icon" aria-label="Exportar datos">
  <i class="ti ti-download" aria-hidden="true"></i>
</button>
```

### CSS

```css
.btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-family: var(--font-sans);
  font-size: var(--btn-font-size-default);
  font-weight: var(--font-weight-medium);
  height: var(--btn-height-default);
  padding: 0 var(--btn-padding-x-default);
  border-radius: var(--btn-radius);
  border: 0.5px solid transparent;
  cursor: pointer;
  transition: var(--btn-transition);
  text-decoration: none;
  white-space: nowrap;
}

.btn:hover { opacity: var(--btn-hover-opacity); }

/* Variants */
.btn-primary   { background: var(--color-action-primary); color: var(--color-text-on-accent); border-color: var(--color-action-primary); }
.btn-secondary { background: var(--color-bg-surface); color: var(--color-text-primary); border-color: var(--color-border-strong); }
.btn-ghost     { background: transparent; color: var(--color-text-secondary); }
.btn-success   { background: var(--color-bg-success); color: var(--color-text-success); border-color: var(--color-border-success); }
.btn-warning   { background: var(--color-bg-warning); color: var(--color-text-warning); border-color: var(--color-border-warning); }

/* Sizes */
.btn-sm   { height: var(--btn-height-sm);  font-size: var(--btn-font-size-sm);  padding: 0 var(--btn-padding-x-sm);  border-radius: var(--radius-sm); }
.btn-lg   { height: var(--btn-height-lg);  font-size: var(--btn-font-size-lg);  padding: 0 var(--btn-padding-x-lg); }
.btn-icon { width: var(--btn-height-default); padding: 0; justify-content: center; }
.btn-sm.btn-icon { width: var(--btn-height-sm); }
.btn-lg.btn-icon { width: var(--btn-height-lg); }
```

### Rules
- One `.btn-primary` per view maximum
- Hover = `opacity: 0.82` only — never change background color
- Always include a leading Tabler outline icon when a clear visual metaphor exists
- Icon-only buttons must have `aria-label` on the button element
- Never use a `<div>` or `<a>` for an action that submits or modifies data — use `<button>`

---

## 10. Inputs

### HTML

```html
<!-- Text input -->
<div class="field">
  <label class="field-label" for="importer">Importador</label>
  <input class="inp" id="importer" type="text" placeholder="Nombre o RUT…">
</div>

<!-- Search -->
<div class="field">
  <label class="field-label" for="search">Búsqueda</label>
  <div class="inp-wrap">
    <i class="ti ti-search inp-icon" aria-hidden="true"></i>
    <input class="inp inp-search" id="search" type="text" placeholder="Importador, producto, HS…">
  </div>
</div>

<!-- Select -->
<div class="field">
  <label class="field-label" for="period">Período</label>
  <select class="sel" id="period">
    <option>Últimos 24 meses</option>
    <option>Últimos 12 meses</option>
  </select>
</div>

<!-- Error state -->
<div class="field field-error">
  <label class="field-label" for="rut">RUT Importador</label>
  <input class="inp" id="rut" type="text" value="76.543.210-X" aria-invalid="true" aria-describedby="rut-error">
  <span class="field-error-msg" id="rut-error" role="alert">
    RUT inválido — verifica el dígito verificador
  </span>
</div>
```

### CSS

```css
.field { display: flex; flex-direction: column; gap: 4px; }

.field-label {
  font-family: var(--font-mono);
  font-size: var(--text-mono-label);
  font-weight: var(--font-weight-medium);
  text-transform: uppercase;
  letter-spacing: var(--letter-spacing-label);
  color: var(--color-text-muted);
}

.inp {
  height: var(--input-height);
  border-radius: var(--input-radius);
  border: var(--input-border);
  background: var(--color-bg-surface);
  font-family: var(--font-sans);
  font-size: var(--input-font-size);
  color: var(--color-text-primary);
  padding: 0 var(--input-padding-x);
  width: 100%;
  transition: border-color var(--duration-fast) var(--ease-default);
}

.inp:focus { outline: var(--input-focus-ring); outline-offset: 0; }
.inp::placeholder { color: var(--color-text-muted); }

/* Error */
.field-error .inp { border-color: rgba(192, 41, 26, 0.40); }
.field-error-msg { font-size: var(--text-small); color: var(--color-text-danger); margin-top: 3px; }

/* Search */
.inp-wrap { position: relative; }
.inp-icon { position: absolute; left: 9px; top: 50%; transform: translateY(-50%); color: var(--color-text-muted); font-size: 14px; pointer-events: none; }
.inp-search { padding-left: 30px; }

/* Select */
.sel {
  height: var(--input-height);
  border-radius: var(--input-radius);
  border: var(--input-border);
  background: var(--color-bg-surface);
  font-family: var(--font-sans);
  font-size: var(--input-font-size);
  color: var(--color-text-primary);
  padding: 0 28px 0 var(--input-padding-x);
  width: 100%;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='%239B9894' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 9px center;
}
```

---

## 11. Metric Cards

### HTML

```html
<div class="stat-grid">
  <div class="stat">
    <div class="stat-label">Total registros</div>
    <div class="stat-value">12,540</div>
    <div class="stat-sub stat-up">
      <i class="ti ti-trending-up" aria-hidden="true"></i> +8.2% vs anterior
    </div>
  </div>
  <div class="stat">
    <div class="stat-label">Valor CIF total</div>
    <div class="stat-value">$284M</div>
    <div class="stat-sub stat-up">
      <i class="ti ti-trending-up" aria-hidden="true"></i> +12.4%
    </div>
  </div>
  <div class="stat">
    <div class="stat-label">Importadores</div>
    <div class="stat-value">3,812</div>
    <div class="stat-sub stat-neutral">activos 24m</div>
  </div>
  <div class="stat">
    <div class="stat-label">Orígenes</div>
    <div class="stat-value">47</div>
    <div class="stat-sub stat-down">
      <i class="ti ti-trending-down" aria-hidden="true"></i> −2 países
    </div>
  </div>
</div>
```

### CSS

```css
.stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-2); }

.stat {
  background: var(--color-bg-surface);
  border: 0.5px solid var(--color-border-strong);
  border-radius: var(--radius-md);
  padding: 13px 14px;
}

.stat-label {
  font-family: var(--font-mono);
  font-size: var(--text-mono-label);
  font-weight: var(--font-weight-medium);
  text-transform: uppercase;
  letter-spacing: var(--letter-spacing-caps);
  color: var(--color-text-muted);
  margin-bottom: var(--space-1);
}

.stat-value {
  font-size: var(--stat-value-size);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
  letter-spacing: var(--stat-value-tracking);
  line-height: 1;
}

.stat-sub {
  font-family: var(--font-mono);
  font-size: var(--stat-sub-size);
  margin-top: var(--space-1);
  display: flex;
  align-items: center;
  gap: 3px;
}

.stat-up      { color: var(--color-action-success); }
.stat-down    { color: var(--color-action-danger); }
.stat-neutral { color: var(--color-text-muted); }
```

---

## 12. Navigation Sidebar

> **Critical:** The nav sidebar is **always light** (`--color-bg-surface` white). Never dark.

### HTML

```html
<nav class="nav-sidebar" aria-label="Main navigation">
  <div class="nav-logo">
    <div class="nav-flag" aria-hidden="true">
      <div style="background: var(--color-brand-red)"></div>
      <div style="background: #fff"></div>
      <div style="background: var(--color-brand-blue)"></div>
    </div>
    <span class="nav-logo-name">Duanera</span>
  </div>

  <ul class="nav-items" role="list">
    <li>
      <a class="nav-item active" href="/explorer" aria-current="page">
        <i class="ti ti-search" aria-hidden="true"></i>
        Explorador
      </a>
    </li>
    <li>
      <a class="nav-item" href="/companies">
        <i class="ti ti-building" aria-hidden="true"></i>
        Empresas
      </a>
    </li>
    <li><a class="nav-item" href="/hs"><i class="ti ti-tag" aria-hidden="true"></i>Productos HS</a></li>
    <li><a class="nav-item" href="/countries"><i class="ti ti-world" aria-hidden="true"></i>Países</a></li>
    <li><a class="nav-item" href="/routes"><i class="ti ti-route" aria-hidden="true"></i>Rutas y puertos</a></li>
    <li><a class="nav-item" href="/sources"><i class="ti ti-database" aria-hidden="true"></i>Fuentes</a></li>
    <li><a class="nav-item" href="/reports"><i class="ti ti-chart-bar" aria-hidden="true"></i>Reportes</a></li>
    <li><a class="nav-item" href="/downloads"><i class="ti ti-download" aria-hidden="true"></i>Descargas</a></li>
    <li><a class="nav-item" href="/alerts"><i class="ti ti-bell" aria-hidden="true"></i>Alertas</a></li>
    <li><a class="nav-item" href="/api"><i class="ti ti-code" aria-hidden="true"></i>API</a></li>
  </ul>
</nav>
```

### CSS

```css
.nav-sidebar {
  width: var(--nav-width);          /* 160px */
  flex-shrink: 0;
  background: var(--color-bg-surface);
  border-right: 0.5px solid var(--color-border-strong);
  display: flex;
  flex-direction: column;
  height: 100vh;
  position: sticky;
  top: 0;
}

.nav-logo {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 12px 14px;
  border-bottom: 0.5px solid var(--color-border-strong);
}

.nav-flag {
  display: flex;
  flex-direction: column;
  width: 22px;
  height: 15px;
  border-radius: 3px;
  overflow: hidden;
  flex-shrink: 0;
}
.nav-flag div { flex: 1; }

.nav-logo-name {
  font-family: var(--font-sans);
  font-size: var(--nav-logo-font-size);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
  letter-spacing: var(--letter-spacing-tight);
}

.nav-items { padding: 6px; list-style: none; display: flex; flex-direction: column; gap: 1px; }

.nav-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  height: var(--nav-item-height);
  padding: 0 var(--space-2);
  border-radius: var(--nav-item-radius);
  font-family: var(--font-sans);
  font-size: var(--nav-item-font-size);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
  text-decoration: none;
  transition: background var(--duration-fast) var(--ease-default),
              color var(--duration-fast) var(--ease-default);
}

.nav-item.active,
.nav-item[aria-current="page"] {
  background: var(--color-bg-accent);
  color: var(--color-text-accent-on-bg);
}

.nav-item:hover:not(.active):not([aria-current="page"]) {
  background: var(--color-bg-page);
  color: var(--color-text-primary);
}

.nav-item i { font-size: var(--nav-icon-size); flex-shrink: 0; }
```

### States

| State | Background | Text |
|---|---|---|
| Resting | transparent | `--color-text-secondary` |
| Active | `--color-bg-accent` | `--color-text-accent-on-bg` |
| Hover | `--color-bg-page` | `--color-text-primary` |

Active uses background fill only — no left border, no dot, no underline.

---

## 13. Data Table

### HTML

```html
<div class="tbl-shell">
  <!-- Toolbar -->
  <div class="tbl-toolbar">
    <div class="tbl-toolbar-left">
      <span class="tbl-title">Registros</span>
      <span class="tbl-count">12.540 resultados</span>
    </div>
    <div class="tbl-toolbar-right">
      <button class="btn btn-secondary btn-sm">
        <i class="ti ti-columns" aria-hidden="true"></i>Columnas
      </button>
      <button class="btn btn-secondary btn-sm">
        <i class="ti ti-download" aria-hidden="true"></i>Exportar
      </button>
    </div>
  </div>

  <!-- Table -->
  <table class="tbl" aria-label="Registros de importación">
    <thead>
      <tr>
        <th scope="col" style="width: 32px">
          <div class="cb" role="checkbox" aria-label="Select all" aria-checked="false"></div>
        </th>
        <th scope="col">Fecha</th>
        <th scope="col">Importador</th>
        <th scope="col">Producto (HS)</th>
        <th scope="col">Origen</th>
        <th scope="col">Puerto</th>
        <th scope="col" style="text-align: right">CIF (USD)</th>
      </tr>
    </thead>
    <tbody>
      <tr class="selected">
        <td><div class="cb cb-checked" role="checkbox" aria-checked="true">✓</div></td>
        <td><span class="mono">28-05-2024</span></td>
        <td class="tbl-name">Comercializadora Andina SpA</td>
        <td class="tbl-secondary">8471.30 – Máquinas proc. datos</td>
        <td class="tbl-secondary">China</td>
        <td class="tbl-secondary">San Antonio</td>
        <td style="text-align: right"><span class="mono">1.245.980</span></td>
      </tr>
    </tbody>
  </table>

  <!-- Footer -->
  <div class="tbl-footer">
    <span class="tbl-result-count">1–50 de 12.540</span>
    <nav class="pagination" aria-label="Pagination">
      <button class="pg pg-nav" aria-label="Previous page">
        <i class="ti ti-chevron-left" aria-hidden="true"></i>
      </button>
      <button class="pg pg-active" aria-current="page">1</button>
      <button class="pg">2</button>
      <button class="pg">3</button>
      <span class="pg-ellipsis" aria-hidden="true">…</span>
      <button class="pg">251</button>
      <button class="pg pg-nav" aria-label="Next page">
        <i class="ti ti-chevron-right" aria-hidden="true"></i>
      </button>
    </nav>
    <select class="sel" aria-label="Rows per page" style="width: 96px;">
      <option>50 / página</option>
      <option>100 / página</option>
    </select>
  </div>
</div>
```

### CSS

```css
.tbl-shell {
  background: var(--color-bg-surface);
  border: 0.5px solid var(--color-border-strong);
  border-radius: var(--table-radius);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}

.tbl-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 9px var(--table-cell-padding-x);
  border-bottom: 0.5px solid var(--color-border-default);
}

.tbl-title  { font-size: var(--text-body); font-weight: var(--font-weight-medium); }
.tbl-count  { font-family: var(--font-mono); font-size: var(--text-small); color: var(--color-text-muted); margin-left: var(--space-1); }
.tbl-toolbar-right { display: flex; gap: var(--space-1); }

.tbl { width: 100%; border-collapse: collapse; table-layout: fixed; }

.tbl thead th {
  font-family: var(--font-mono);
  font-size: var(--table-header-font-size);
  font-weight: var(--font-weight-medium);
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: var(--color-text-muted);
  text-align: left;
  padding: 7px var(--table-cell-padding-x);
  border-bottom: 0.5px solid var(--color-border-strong);
}

.tbl tbody td {
  padding: var(--table-cell-padding-y) var(--table-cell-padding-x);
  border-bottom: 0.5px solid var(--color-border-default);
  font-size: var(--table-font-size);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tbl tbody tr:hover td          { background: var(--table-hover-bg); }
.tbl tbody tr.selected td       { background: var(--table-selected-bg); }
.tbl tbody tr.selected td:first-child { border-left: var(--table-selected-border); }

.tbl-name      { font-weight: var(--font-weight-medium); }
.tbl-secondary { font-size: var(--text-small); color: var(--color-text-secondary); }
.mono          { font-family: var(--font-mono); font-size: var(--text-small); }

/* Checkbox */
.cb {
  width: var(--checkbox-size);
  height: var(--checkbox-size);
  border-radius: var(--checkbox-radius);
  border: 0.5px solid var(--color-border-strong);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.cb.cb-checked { background: var(--color-action-primary); border-color: var(--color-action-primary); color: white; font-size: 8px; }

/* Footer */
.tbl-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 7px var(--table-cell-padding-x);
  border-top: 0.5px solid var(--color-border-default);
}
.tbl-result-count { font-size: var(--text-small); color: var(--color-text-muted); }

/* Pagination */
.pagination { display: flex; gap: 3px; }
.pg {
  min-width: var(--pg-size); height: var(--pg-size);
  display: flex; align-items: center; justify-content: center;
  font-family: var(--font-mono); font-size: var(--pg-font-size);
  border-radius: var(--pg-radius);
  border: 0.5px solid var(--color-border-default);
  background: var(--color-bg-surface);
  cursor: pointer;
}
.pg.pg-active { background: var(--color-action-primary); border-color: var(--color-action-primary); color: white; }
.pg.pg-nav    { border-color: transparent; background: transparent; color: var(--color-text-muted); }
.pg-ellipsis  { min-width: var(--pg-size); height: var(--pg-size); display: flex; align-items: center; justify-content: center; font-size: var(--pg-font-size); color: var(--color-text-muted); }
```

---

## 14. Detail Panel

### HTML

```html
<aside class="panel" aria-label="Detalle del registro">
  <!-- Header -->
  <div class="panel-header">
    <span class="panel-id">
      <i class="ti ti-file-invoice" aria-hidden="true"></i>
      IMP-2024-05-28-001245
      <button class="panel-copy" aria-label="Copiar ID">
        <i class="ti ti-copy" aria-hidden="true"></i>
      </button>
    </span>
    <span class="badge badge-success">
      <span class="badge-dot"></span>
      Fuente verificada
    </span>
  </div>

  <!-- Tabs -->
  <div class="panel-tabs" role="tablist">
    <button class="panel-tab active" role="tab" aria-selected="true" aria-controls="tab-resumen">Resumen</button>
    <button class="panel-tab" role="tab" aria-selected="false" aria-controls="tab-mercancia">Mercancía</button>
    <button class="panel-tab" role="tab" aria-selected="false">Valores</button>
    <button class="panel-tab" role="tab" aria-selected="false">Transporte</button>
    <button class="panel-tab" role="tab" aria-selected="false">Documentos</button>
    <button class="panel-tab" role="tab" aria-selected="false">Historial</button>
  </div>

  <!-- Field grid -->
  <div class="panel-grid" id="tab-resumen" role="tabpanel">
    <div class="panel-field">
      <div class="pf-label">Fecha de operación</div>
      <div class="pf-value"><span class="mono">28-05-2024</span></div>
    </div>
    <div class="panel-field">
      <div class="pf-label">Régimen</div>
      <div class="pf-value"><span class="badge badge-info">Definitiva</span></div>
    </div>
    <div class="panel-field">
      <div class="pf-label">Importador</div>
      <div class="pf-value">Comercializadora Andina SpA</div>
      <div class="pf-sub mono">RUT: 76.543.210-9</div>
    </div>
    <div class="panel-field">
      <div class="pf-label">Tipo de operación</div>
      <div class="pf-value">Importación</div>
    </div>
    <div class="panel-field">
      <div class="pf-label">Producto HS</div>
      <div class="pf-value mono">8471.30.00.00</div>
      <div class="pf-sub">Máquinas automáticas proc. datos</div>
    </div>
    <div class="panel-field">
      <div class="pf-label">Valor CIF (USD)</div>
      <div class="pf-value pf-value-large">1.245.980</div>
    </div>
    <div class="panel-field">
      <div class="pf-label">Puerto de ingreso</div>
      <div class="pf-value">San Antonio</div>
    </div>
    <div class="panel-field">
      <div class="pf-label">Cantidad</div>
      <div class="pf-value">1 unidad</div>
    </div>
  </div>

  <!-- Provenance -->
  <div class="prov-section">
    <div class="prov-heading">Fuente y trazabilidad</div>
    <div class="prov-card">
      <div class="prov-row">
        <div class="prov-icon prov-icon-accent"><i class="ti ti-package" aria-hidden="true"></i></div>
        <span class="prov-key">Lote</span>
        <span class="prov-value">IMP-2024-05-28-001245</span>
      </div>
      <div class="prov-row">
        <div class="prov-icon prov-icon-neutral"><i class="ti ti-file-text" aria-hidden="true"></i></div>
        <span class="prov-key">Archivo</span>
        <span class="prov-value">DUS_SA_20240528_001245.csv</span>
      </div>
      <div class="prov-row">
        <div class="prov-icon prov-icon-success"><i class="ti ti-table-row" aria-hidden="true"></i></div>
        <span class="prov-key">Fila original</span>
        <span class="prov-value">3.482</span>
      </div>
      <div class="prov-row">
        <div class="prov-icon prov-icon-neutral"><i class="ti ti-building-bank" aria-hidden="true"></i></div>
        <span class="prov-key">Fuente oficial</span>
        <span class="prov-value" style="font-family: var(--font-sans); font-size: 11px;">Servicio Nacional de Aduanas</span>
      </div>
    </div>
  </div>

  <!-- Alert -->
  <div class="alert-strip" role="alert">
    <i class="ti ti-alert-triangle" aria-hidden="true"></i>
    Requiere revisión — Peso bruto no informado en documento fuente.
  </div>

  <!-- Actions -->
  <div class="panel-actions">
    <button class="btn btn-secondary" style="flex: 1; justify-content: center;">
      <i class="ti ti-external-link" aria-hidden="true"></i>Ver origen
    </button>
    <button class="btn btn-primary" style="flex: 1; justify-content: center;">
      <i class="ti ti-file-search" aria-hidden="true"></i>Ver registro completo
    </button>
  </div>
</aside>
```

### CSS

```css
.panel {
  width: var(--panel-width);         /* 420px */
  background: var(--color-bg-surface);
  border: 0.5px solid var(--color-border-strong);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-md);
  display: flex;
  flex-direction: column;
}

/* Header */
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 13px var(--panel-padding-x);
  border-bottom: 0.5px solid var(--color-border-default);
}
.panel-id {
  font-family: var(--font-mono);
  font-size: var(--text-mono-value);
  color: var(--color-text-primary);
  display: flex;
  align-items: center;
  gap: var(--space-1);
}
.panel-id i { font-size: 14px; color: var(--color-text-muted); }
.panel-copy { background: none; border: none; cursor: pointer; color: var(--color-text-muted); padding: 0; }

/* Tabs */
.panel-tabs {
  display: flex;
  padding: 0 var(--panel-padding-x);
  border-bottom: 0.5px solid var(--color-border-default);
  overflow-x: auto;
}
.panel-tab {
  font-family: var(--font-sans);
  font-size: var(--panel-tab-font-size);
  font-weight: var(--font-weight-medium);
  padding: 8px 10px;
  color: var(--color-text-muted);
  border: none;
  border-bottom: 2px solid transparent;
  background: none;
  cursor: pointer;
  white-space: nowrap;
  margin-bottom: -1px;
  transition: color var(--duration-fast) var(--ease-default);
}
.panel-tab.active,
.panel-tab[aria-selected="true"] {
  color: var(--color-text-accent);
  border-bottom-color: var(--color-border-accent);
}

/* Field grid */
.panel-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--panel-grid-gap);
  padding: 14px var(--panel-padding-x);
}
.pf-label {
  font-family: var(--font-mono);
  font-size: var(--text-mono-label);
  text-transform: uppercase;
  letter-spacing: var(--letter-spacing-label);
  color: var(--color-text-muted);
  margin-bottom: 3px;
}
.pf-value { font-size: var(--text-body); font-weight: var(--font-weight-medium); color: var(--color-text-primary); line-height: var(--line-height-tight); }
.pf-value-large { font-family: var(--font-mono); font-size: var(--panel-cif-size); font-weight: var(--font-weight-medium); letter-spacing: -0.01em; }
.pf-sub { font-size: var(--text-small); color: var(--color-text-muted); margin-top: 2px; }

/* Provenance */
.prov-section { padding: 0 var(--panel-padding-x) 14px; }
.prov-heading {
  font-family: var(--font-mono);
  font-size: var(--text-mono-label);
  text-transform: uppercase;
  letter-spacing: var(--letter-spacing-label);
  color: var(--color-text-muted);
  margin-bottom: var(--space-2);
  padding-top: var(--space-2);
  border-top: 0.5px solid var(--color-border-default);
}
.prov-card { background: var(--color-bg-page); border-radius: var(--radius-md); border: 0.5px solid var(--color-border-strong); padding: 10px 12px; display: flex; flex-direction: column; gap: 6px; }
.prov-row { display: flex; align-items: center; gap: var(--space-2); font-size: var(--prov-font-size); color: var(--color-text-secondary); }
.prov-icon { width: var(--prov-icon-size); height: var(--prov-icon-size); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; flex-shrink: 0; }
.prov-icon-accent  { background: var(--color-bg-accent);  color: var(--color-text-accent-on-bg); }
.prov-icon-success { background: var(--color-bg-success); color: var(--color-text-success); }
.prov-icon-neutral { background: var(--color-bg-subtle);  color: var(--color-text-secondary); }
.prov-key   { color: var(--color-text-muted); min-width: var(--prov-key-width); font-size: var(--text-small); }
.prov-value { font-family: var(--font-mono); font-size: var(--text-mono-label); color: var(--color-text-secondary); }

/* Alert strip */
.alert-strip {
  margin: 0 var(--panel-padding-x) 12px;
  padding: var(--alert-strip-padding);
  background: var(--color-bg-warning);
  border-radius: var(--alert-strip-radius);
  border: 0.5px solid var(--color-border-warning);
  display: flex;
  align-items: flex-start;
  gap: 7px;
  font-size: var(--text-small);
  color: var(--color-text-warning);
}
.alert-strip i { font-size: 13px; flex-shrink: 0; margin-top: 1px; }

/* Actions */
.panel-actions {
  display: flex;
  gap: var(--space-2);
  padding: 0 var(--panel-padding-x) 14px;
}
```

---

## 15. Icons

**Tabler outline only.** Never use filled variants (`-filled` suffix). Never swap icons between contexts.

### Sizing

| Context | Size |
|---|---|
| Badges, chips | 10px |
| Button labels | 12px |
| Panel header ID row | 14px |
| Nav items | `var(--nav-icon-size)` = 14px |
| Icon-only buttons | 14px |
| Alert strip | 13px |
| Decorative maximum | 18px |

### Map

| Icon | Token | Used for |
|---|---|---|
| `ti-search` | nav | Explorador, search bar inset |
| `ti-building` | nav | Empresas |
| `ti-tag` | nav | Productos HS |
| `ti-world` | nav | Países |
| `ti-route` | nav | Rutas y puertos |
| `ti-database` | nav | Fuentes |
| `ti-chart-bar` | nav | Reportes |
| `ti-download` | nav + toolbar | Descargas, export |
| `ti-bell` | nav | Alertas |
| `ti-code` | nav | API |
| `ti-filter` | filter | Chip prefix |
| `ti-calendar` | filter | Date chip prefix |
| `ti-columns` | table toolbar | Show/hide columns |
| `ti-file-invoice` | panel | Record ID row |
| `ti-copy` | panel | Copy ID |
| `ti-external-link` | panel | Ver origen button |
| `ti-file-search` | panel | Ver registro button |
| `ti-check` | btn-success | Confirm, verify |
| `ti-alert-triangle` | badge-warning, alert-strip | Caution, review |
| `ti-package` | provenance | Lote (batch) |
| `ti-file-text` | provenance | Archivo (file) |
| `ti-table-row` | provenance | Fila original |
| `ti-building-bank` | provenance | Fuente oficial |
| `ti-trending-up` | stat-sub | Positive trend |
| `ti-trending-down` | stat-sub | Negative trend |

---

## 16. Accessibility

- [ ] Minimum touch target 32×32px (prefer 44×44px). Use `min-width`/`min-height` on small elements.
- [ ] Color is never the sole status indicator — text or icon always accompanies
- [ ] Focus ring: `outline: var(--input-focus-ring)` on all focusable elements — already handled by `:focus-visible` in `tokens.css`
- [ ] Contrast: `--color-text-primary` on white = 19.5:1 (AAA). Accent blue on white = 7.1:1 (AAA)
- [ ] All form `<input>` and `<select>` elements must have a corresponding `<label>`
- [ ] Icon-only buttons: `aria-label` on `<button>`, `aria-hidden="true"` on `<i>`
- [ ] Decorative icons: `aria-hidden="true"` always
- [ ] Tables: `<th scope="col">` for column headers
- [ ] Panel tabs: `role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls` linking to `role="tabpanel"`
- [ ] Alert strip: `role="alert"` for live errors/warnings
- [ ] Nav active item: `aria-current="page"`
- [ ] Never rely on placeholder text as a label

---

## 17. Hard Rules — Never Do

These are non-negotiable. Violating any of them produces off-system UI.

1. **Never use a dark nav sidebar** — always `var(--color-bg-surface)` white
2. **Never use font-weight 600 or 700** — 400 and 500 only
3. **Never use DM Mono for prose or descriptions** — only for data values and labels
4. **Never hardcode hex or rgba values in component CSS** — always use `--color-*` or `--primitive-*` tokens
5. **Never reference primitive tokens in components** — always use semantic tokens
6. **Never invent new shadow values** — only `var(--shadow-sm)` and `var(--shadow-md)`
7. **Never use gradients, blurs, or glow effects**
8. **Never change button background color on hover** — `opacity: 0.82` only
9. **Never use filled Tabler icons** — outline only
10. **Never uppercase headings or body copy** — only 10px mono field labels
11. **Never use arbitrary spacing** — all spacing must be multiples of 4px via `--space-*` tokens
12. **Never apply border-radius to single-sided borders** — `border-left` accents → `border-radius: 0`
13. **Never use color alone for status** — always pair with text or icon
14. **Never use a `<div>` for interactive controls** — use `<button>` or `<a>` appropriately
15. **Never omit `aria-hidden="true"` on decorative icons**

---

## 18. Agent System Prompt

Copy this block into your agent's system prompt. It is the minimum viable context for generating on-system UI.

---

```
## Duanera Design System — v3.0

You are building UI for the Duanera comercio exterior platform. Read all rules below before writing any code. Non-compliance will require a full rewrite.

### Token file
Import: `@import './tokens/tokens.css';`
ALWAYS use semantic tokens (--color-*, --font-*, --space-*, --radius-*, --shadow-*).
NEVER hardcode hex values. NEVER use primitive tokens (--primitive-*) in component code.

### Surfaces
- Page background:   var(--color-bg-page)       #F5F4F0
- Cards/panels/nav:  var(--color-bg-surface)     #FFFFFF
- Subtle fills:      var(--color-bg-subtle)       #EEEDE9
- Active/accent bg:  var(--color-bg-accent)       #EBF0FD

### Text
- Primary:           var(--color-text-primary)    #0F0E0C
- Secondary:         var(--color-text-secondary)  #5C5A56
- Muted/labels:      var(--color-text-muted)      #9B9894
- On accent bg:      var(--color-text-accent-on-bg) #0C3BB5
- On solid accent:   var(--color-text-on-accent)  #FFFFFF

### Borders
All borders are 0.5px. Use:
- Default dividers:  0.5px solid var(--color-border-default)
- Card/input edges:  0.5px solid var(--color-border-strong)
- Selected row:      border-left: var(--table-selected-border) [2px solid accent — exception]
- Active tab:        border-bottom: var(--panel-tab-border)    [2px solid accent — exception]
- Focus ring:        outline: var(--input-focus-ring)          [2px solid accent]

### Typography
- UI copy:    font-family: var(--font-sans)  [DM Sans]
- Data/code:  font-family: var(--font-mono)  [DM Mono]
- Weights: 400 (regular) and 500 (medium) ONLY. NEVER 600 or 700.
- Mono ONLY for: IDs, HS codes, dates, numeric values, file names, 10px uppercase labels.
- Uppercase ONLY for: 10px mono field labels. Never headings.

### Components
BADGE: pill (--radius-pill), 11px DM Sans 500, always semantic variant.
  .badge-success / .badge-info / .badge-warning / .badge-danger / .badge-neutral
  Always pair color fill with matching -text token.

BUTTON: height 30px (--btn-height-default), 12px DM Sans 500, --radius-md.
  .btn-primary / .btn-secondary / .btn-ghost / .btn-success / .btn-warning
  Hover = opacity 0.82. NEVER change background on hover.
  icon-only buttons MUST have aria-label.

INPUT: height 32px (--input-height), 0.5px border --color-border-strong, --radius-md.
  Label: 10px DM Mono uppercase above, 4px gap. Focus = 2px solid accent.

NAV: ALWAYS LIGHT. background: var(--color-bg-surface). Width: var(--nav-width) = 160px.
  Active: bg --color-bg-accent, text --color-text-accent-on-bg.
  Hover:  bg --color-bg-page, text --color-text-primary.
  Icons:  Tabler OUTLINE at 14px. NEVER filled variants.

TABLE: --radius-lg shell, --shadow-sm. Headers: 10px DM Mono uppercase.
  Selected row: var(--table-selected-bg) bg + var(--table-selected-border) on td:first-child.
  Numeric/date cells: <span class="mono"> (DM Mono 11px).
  Always use table-layout: fixed with explicit column widths.

PANEL: width var(--panel-width) = 420px, --shadow-md, --radius-lg.
  Tabs: 11px DM Sans, active = --color-text-accent + 2px bottom --color-border-accent.
  Field grid: 2 cols, gap var(--panel-grid-gap) = 14px.
  CIF/large numeric: class .pf-value-large → 19px DM Mono 500.
  Alert strip: always amber (--color-bg-warning / --color-text-warning).
  Actions: 2 flex-1 buttons, secondary left, primary right.

### Elevation
Flat:      border only, no shadow
--shadow-sm: tables, toolbars
--shadow-md: panels, modals, dropdowns
NEVER invent new shadow values.

### Spacing
Base-4 scale via --space-1 (4px) to --space-16 (64px). NEVER arbitrary values.
Card padding: 13–16px. Section gaps: 24–32px.

### Icons
Tabler OUTLINE (ti-*) only. Sizes: badges/chips 10px, buttons 12px, nav/panel 14px.
Decorative icons: aria-hidden="true".
Icon-only buttons: aria-label on <button>.

### Absolute hard rules
1. Nav sidebar is ALWAYS light (white). NEVER dark.
2. Font weights 400 and 500 ONLY.
3. DM Mono for data only. NEVER for prose.
4. NEVER hardcode colors — use tokens.
5. NEVER use filled Tabler icons.
6. NEVER change button bg on hover — opacity only.
7. NEVER use gradients, blur, or glow.
8. NEVER uppercase headings — only 10px mono labels.
9. NEVER arbitrary spacing — multiples of 4 via --space-* only.
10. Color is NEVER the sole status indicator.
```
