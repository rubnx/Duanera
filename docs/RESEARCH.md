# Research

## Purpose

Track research for data sources, competitors, user needs, licensing, terminology, and architecture.

Do not turn research notes into product claims unless verified.

---

## Research areas

### Data sources

Track:

- source name
- country
- data type
- format
- update frequency
- access method
- license/terms
- available fields
- limitations
- sample files
- notes

### Competitors

Initial reference:

- DataSur
- other customs/trade intelligence products
- official public trade portals
- global macro trade databases
- commercial shipment data providers

Track:

- positioning
- filters
- pricing if public
- data coverage claims
- UX patterns
- export/report features
- trust/methodology pages

### User discovery

Interview or research:

- importers
- exporters
- sourcing teams
- logistics/customs professionals
- consultants
- commercial prospecting users

Questions:

- What do they search for?
- What data do they trust?
- Which fields matter most?
- How do they use current tools?
- What is painful about DataSur or alternatives?
- Would they pay for search, exports, alerts, or company intelligence?

### Technical research

Track:

- Neon/Postgres limits, branching, connection behavior, and costs
- Drizzle patterns
- R2/S3 storage patterns
- ClickHouse migration patterns
- Postgres indexing/partitioning
- ETL tooling
- background job tools
- search engines if needed

---

## Research discipline

For every research item, capture:

- source URL or file
- date accessed
- summary
- confidence
- relevance
- open questions

When using public source URLs, verify that the page still exists and that the linked resources are current before relying on them. Government CMS URLs may change over time.

---

## Chile Aduana Official Sources

### Current research goal

Before designing the final data model, inspect one recent import dataset, one recent export dataset, and the official data dictionary.

The goal is to confirm:

- whether the data is row-level or aggregated
- whether company-level fields are included
- which columns are available
- which fields are coded
- whether HS code, product description, value, quantity, weight, country, port/customs office, and transport fields are present
- whether the public data is enough for a DataSur-like MVP

Do not implement ingestion yet. Do not create database tables yet. Do not assume field meanings without checking official metadata.

Research output should be written to:

`docs/research/CHILE_ADUANA_DATA_REVIEW.md`

The report should document:

- source URLs
- selected dataset years
- resource/download URLs
- file formats
- file sizes when available
- metadata/dictionary availability
- row-level vs aggregated status
- column names
- whether company-level fields are present
- whether the data appears useful for Duanera’s MVP

---

### Primary source: Servicio Nacional de Aduanas on datos.gob.cl

URL:  
https://datos.gob.cl/organization/servicio_nacional_de_aduanas

Use:  
Official Chile open-data portal listing Aduana import/export datasets by year.

Priority:  
Critical.

Status:  
To inspect first.

Notes:  
Use this page to find the available yearly import/export datasets, such as recent `Registro de Importación` and `Registro de Exportaciones` datasets.

Treat yearly dataset pages as source landing pages. The actual ingestion targets are the individual resource/download files inside each dataset page.

Do not guess dataset URLs by year. Start from the organization page or the CKAN API and use only dataset/resource URLs that actually exist.

For each selected dataset, record:

- dataset page URL
- resource/download URL
- year
- month or period
- file format
- file size
- metadata/dictionary availability
- row count after inspection
- column names
- whether company-level fields exist

---

### datos.gob.cl API

datos.gob.cl exposes a CKAN API.

Use the API for dataset and resource discovery, not as the primary way to query all customs records.

Important endpoints:

- Dataset search:  
  https://datos.gob.cl/api/3/action/package_search

- Dataset details:  
  https://datos.gob.cl/api/3/action/package_show

- Resource details:  
  https://datos.gob.cl/api/3/action/resource_show

- DataStore query, only when a resource is loaded into CKAN DataStore:  
  https://datos.gob.cl/api/3/action/datastore_search

Expected workflow:

1. Use the CKAN API to find Servicio Nacional de Aduanas datasets.
2. Identify import/export datasets by year.
3. Extract resource/download URLs.
4. Download the actual monthly files.
5. Store raw files unchanged in object storage.
6. Parse and ingest files into Duanera only after the data review is complete.

Do not assume that large Aduana import/export resources can be queried row-by-row through `datastore_search`. Many Aduana resources are downloadable files such as RAR, ZIP, XLSX, or TXT.

---

### Official data dictionary

URL:  
https://datos.gob.cl/dataset/diccionario-de-datos-para-datos-abiertos-aduana/resource/792ca993-e4e4-4b83-a965-7aafca93fe2f

Use:  
Official field dictionary for Aduana open-data files.

Priority:  
Critical.

Status:  
To inspect alongside the first import/export files.

Notes:  
Use this before interpreting dataset columns. If a field meaning is unclear, do not guess. Mark it as `unknown` until confirmed.

---

## Secondary source: Aduana.cl

Use Aduana.cl as the official Aduana reference source for comparison, validation, operation-code filtering, code tables, annexes, dashboards, methodology, and terminology.

Do not treat Aduana.cl as the primary dataset discovery source. For dataset discovery and resource URLs, prefer datos.gob.cl and the datos.gob.cl CKAN API.

---

### Operaciones de Ingreso

URL:  
https://www.aduana.cl/base-de-datos-operaciones-de-ingreso/aduana/2018-12-28/102736.html

Use:  
Official Aduana page for monthly inbound/import-related operation files.

Priority:  
High.

Status:  
Secondary source after datos.gob.cl.

Notes:  
Use this to compare against datos.gob.cl import files and to understand operation-code filtering. Do not treat this as the first ingestion source until it has been compared with the datos.gob.cl files.

---

### Operaciones de Salida

URL:  
https://www.aduana.cl/base-de-datos-operaciones-de-salida/aduana/2024-11-12/153724.html

Use:  
Official Aduana page for monthly outbound/export-related operation files.

Priority:  
High.

Status:  
Secondary source after datos.gob.cl.

Notes:  
Use this to compare against datos.gob.cl export files and to understand operation-code filtering. Do not treat this as the first ingestion source until it has been compared with the datos.gob.cl files.

---

### Annex 51 - Chile Aduana Code Tables

URL:  
https://www.aduana.cl/compendio-de-normas-anexo-51/aduana/2009-11-19/163937.html

Use:  
Official reference for interpreting coded fields present in Chile import/export datasets.

Priority:  
High.

Status:  
Use only when needed.

Notes:  
Do not read the full Compendio de Normas Aduaneras at this stage. Use Annex 51 and its downloadable code tables only when a dataset field appears as a code and needs official interpretation.

Annex 51 may be useful for fields such as:

- customs office codes
- country codes
- operation type codes
- units of measure
- transport mode codes
- currency codes
- ports, locations, or control points
- other coded values used in customs declarations

Other annexes should only be opened when a concrete dataset field requires them:

- Annex 22: import declaration / DIN fields
- Annex 35: export declaration / DUS fields
- Annex 18: item-level fields such as quantities, units, values, or tariff-code-related details

Practical rule: inspect the real dataset first, check the dictionary second, then use Annex 51 only for coded fields that need decoding.

---

### Aduana.cl API status

Aduana.cl does not appear to provide a clean public API for querying import/export customs records.

Use Aduana.cl as an official source for:

- downloadable CSV files
- dynamic statistics pages
- official dashboards
- code tables
- customs annexes
- methodology and reference documents

Do not treat Aduana.cl as an API source unless a stable, documented public endpoint is found.

For API-based dataset discovery, prefer the datos.gob.cl CKAN API.
