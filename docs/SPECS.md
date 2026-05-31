# Product Specification

## Product

Duanera is a web app that organizes customs/import-export data into a searchable, filterable, digestible business intelligence product.

The first market is Chile.

The product should help importers, exporters, analysts, and business users answer questions such as:

- Who imports a given product into Chile?
- Which countries supply a product category?
- Which companies are active in a specific HS code?
- How have import/export volumes changed over time?
- Which ports, countries, and companies dominate a route or product group?
- What source record supports a visible data point?

---

## Current certainty level

### Confirmed

- Chile-first.
- Spanish-first.
- Data credibility and traceability matter more than flashy dashboards.
- MVP should focus on searchable/filterable structured trade data.
- Raw source preservation and provenance are core product requirements.
- Neon-hosted PostgreSQL is the MVP database provider.
- Database-provider platform features are not part of the default backend architecture.
- ClickHouse is future-ready, not MVP-required.

### Strong assumptions

- Users care about filters, tables, company/product discovery, and exportable insights.
- Users will need both record-level detail and summarized views.
- Company names and product descriptions may be messy and require normalization.

### Unknown until data review

- Available fields.
- Data granularity.
- Data update frequency.
- Data licensing constraints.
- Whether source data is public, paid, scraped, manually uploaded, or mixed.
- Which user segment has strongest willingness to pay.

---

## Target users

Initial likely users:

- importers
- exporters
- commercial teams
- sourcing teams
- logistics and customs professionals
- trade analysts
- consultants
- companies researching competitors, suppliers, or buyers

These personas are provisional until user discovery.

---

## MVP scope

### Included

- Account/auth system
- Chile-first data import flow
- Source file registry
- Import batch tracking
- Raw source preservation
- Raw row capture where possible
- Normalized searchable trade records
- Basic company/entity normalization
- Data table with filters
- Record detail view with source/provenance information
- Saved searches
- Basic summaries by company, HS code, country, port, and period
- Admin import/status screens

### Excluded from MVP unless decided later

- Global country coverage
- ClickHouse as active dependency
- AI-generated conclusions as source of truth
- Full fuzzy entity resolution system
- Public API
- Automated paid data acquisition
- Advanced enterprise permissions
- Real-time notifications
- Large export automation
- Full BI dashboard suite

---

## Core user stories

### Search trade data

As a user, I want to filter customs/trade records by country, date, HS code, company, product description, value, quantity, and port so I can identify relevant import/export activity.

### Understand a company

As a user, I want to view a company profile showing related imports/exports, products, countries, and activity over time so I can evaluate that company as a buyer, supplier, competitor, or prospect.

### Explore a product or HS code

As a user, I want to search by product or HS code and see related companies, countries, values, quantities, and trends.

### Verify a record

As a user, I want to see where a record came from so I can trust the information.

### Save useful filters

As a user, I want to save searches and filters so I can return to useful views quickly.

---

## Data credibility requirements

Every user-facing record should expose or preserve internally:

- source file
- import batch
- raw row identifier
- parser version
- normalization status
- confidence or validation status where useful
- last processed timestamp

Do not present normalized or inferred values as certain when they are not.

---

## Language

The signed-in product should start Spanish-first.

English may be added later if needed for international users.

---

## Monetization hypothesis

Monetization is not final.

Likely future models:

- subscription access
- usage limits by plan
- export limits by plan
- saved search/alert limits
- company profile access limits
- enterprise/team access

Billing and access control should be designed later, after MVP scope and data licensing are clearer.

---

## Product principles

- Trust before polish.
- Source traceability before summaries.
- Structured filters before AI interpretation.
- Clear tables before complex dashboards.
- Chile-first before international expansion.
- Build for ClickHouse later, but do not add unnecessary complexity before it is needed.
