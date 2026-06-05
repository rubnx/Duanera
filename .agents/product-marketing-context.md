# Product Marketing Context

*Last updated: 2026-06-04*

## Product Overview
**One-liner:** Duanera is a Chile-first customs and import/export intelligence platform for searching, filtering, verifying, and exporting trade activity.

**What it does:** Duanera turns messy customs and trade source files into structured, searchable, filterable business intelligence. The MVP focuses on Chile Aduana import/export records with source provenance, normalized fields, anonymous Aduana participant IDs, record detail, summaries, exports, and data-quality visibility. It is designed to help users answer commercial questions while preserving trust boundaries around source data and inferred identity.

**Product category:** Customs data platform; import/export intelligence; trade intelligence; comercio exterior analytics; Aduana data search.

**Product type:** B2B SaaS data product / trade intelligence web app.

**Business model:** Not finalized. Current hypothesis is subscription access with future plan limits around exports, saved searches, alerts, company profiles, and team/enterprise access.

## Target Audience
**Target companies:** Chile-focused or Latin America-focused businesses involved in importing, exporting, sourcing, logistics, customs, market research, consulting, or B2B commercial intelligence. Likely buyers include SMEs, mid-market companies, consultancies, freight/customs operators, and commercial teams researching buyers, suppliers, competitors, and routes.

**Decision-makers:** Commercial leaders, export/import managers, sourcing/procurement leaders, market intelligence teams, logistics/customs managers, consultants, and founders/operators in trade-heavy businesses.

**Primary use case:** Find and verify trade activity by product, HS code, country, port, Aduana office, anonymous participant ID, value, quantity, and period.

**Jobs to be done:**
- Identify who is active in a product category or HS code.
- Understand countries, ports, routes, quantities, and values for a market.
- Verify visible records back to source files, batches, and raw rows.
- Export bounded filtered results with applied-filter and traceability context.

**Use cases:**
- Research importers/exporters active in a product family.
- Evaluate sourcing opportunities by country, route, port, value, and quantity.
- Track competitor or market activity over loaded monthly periods.
- Build lead lists or account research from anonymous Aduana participant profiles, without claiming legal identity.
- Validate data quality, code-table coverage, and source provenance before relying on a record.

## Personas
| Persona | Cares about | Challenge | Value we promise |
|---------|-------------|-----------|------------------|
| Commercial researcher / analyst | Fast discovery, filters, exports, confidence in data | Raw Aduana files are hard to search and interpret | Structured search, summaries, and spreadsheet-ready exports with provenance |
| Import/export manager | Product, country, port, value, quantity, and route visibility | Needs practical answers without manually processing raw customs files | Spanish-first Explorer with relevant trade fields and source traceability |
| Sourcing / sales team | Finding buyers, suppliers, competitors, and market activity | Existing sources are fragmented or too technical | Product/HS/country/participant views that support account and market research |
| Logistics/customs professional | Aduana, port, transport, cargo, source detail | Operational fields are coded, messy, or spread across files | Decoded normalized fields where supported and cautious raw/source context where not |
| Consultant / advisor | Credible analysis and client-ready evidence | Needs defensible data and clear caveats | Traceable records, bounded exports, and explicit uncertainty around identity |
| Technical/data stakeholder | Data model integrity, provenance, scalability | Needs confidence the system is not a fragile dashboard over raw files | Source preservation, normalized facts, QA views, and ClickHouse-ready architecture |

## Problems & Pain Points
**Core problem:** Trade data is commercially valuable but hard to use because source files are raw, messy, coded, fragmented, and difficult to verify.

**Why alternatives fall short:**
- Raw government files require manual extraction, decoding, filtering, and QA.
- Generic spreadsheets are slow, brittle, and lack reliable provenance.
- BI dashboards can summarize too quickly without showing source support.
- Competitor-style identity fields may be inferred or unavailable, creating trust risk if presented as verified.
- Broad exports or dashboards can hide data-quality and source limitations.

**What it costs them:** Time spent gathering files, cleaning data, decoding fields, checking source credibility, and building repeatable analysis. Missed commercial opportunities when users cannot quickly find relevant companies, products, countries, ports, or routes.

**Emotional tension:** Users need useful commercial intelligence but also need to trust it. The risk is making business decisions from incomplete, untraceable, or overclaimed customs data.

## Competitive Landscape
**Direct:** DataSur / D-Comex-style trade intelligence tools. They offer mature trade search, summaries, exports, and source catalog patterns, but Duanera should differentiate through transparent provenance, cautious identity claims, and a modern focused UX.

**Secondary:** Raw Aduana/datos.gob.cl files plus Excel/Power BI. These are flexible and low cost but require manual processing, field decoding, source tracking, and data-quality review.

**Indirect:** Consultants, customs brokers, logistics providers, or internal analysts who manually prepare market reports. They can provide interpretation but are slower, harder to repeat, and may not expose record-level traceability.

## Differentiation
**Key differentiators:**
- Source-first trust model with file, batch, raw-row, parser, and payload-retention provenance.
- Spanish-first Chile Aduana Explorer designed around business search and verification.
- Explicit separation between anonymous Aduana correlatives and any possible legal company identity.
- Bounded exports with summary and applied-filter context instead of unguarded bulk download.
- Internal data-quality/load-readiness views that make source/code-table issues visible.
- Postgres-first MVP with ClickHouse-ready query boundaries for future scale.

**How we do it differently:** Duanera treats trade records as traceable facts, not just dashboard rows. It preserves raw/source context outside Postgres, normalizes confirmed fields, decodes official code tables where supported, and labels uncertainty clearly.

**Why that's better:** Users can search and act faster without losing the ability to verify where a record came from or whether a field is inferred, decoded, raw, unsupported, or anonymous.

**Why customers choose us:** They want practical trade intelligence with enough rigor to trust the output, especially in Chile where legal importer/exporter identity is not cleanly available in public Aduana main files.

## Objections
| Objection | Response |
|-----------|----------|
| "Does this show real company names and RUTs?" | Current Aduana main files expose anonymous correlatives, not verified legal identities. Duanera labels these honestly and keeps possible identity as a separate evidence-backed future layer. |
| "Why not just use the official files?" | Official files are valuable but not productized. Duanera adds structured search, decoded labels, summaries, exports, and source traceability. |
| "Can I export everything?" | MVP exports are intentionally bounded and filtered to protect performance, provenance, and future access policy. Larger async exports are future work. |
| "Is this production-ready?" | Current repo status is MVP/data discovery. The product foundation is serious, but auth, billing, production ingestion, and access policy are still future decisions. |

**Anti-persona:** Users who need unbounded raw data dumps, guaranteed verified legal company identities from public Aduana data, real-time alerts, global coverage today, or black-box AI conclusions without source traceability.

## Switching Dynamics
**Push:** Manual processing of raw Aduana files is slow, repetitive, hard to verify, and difficult to turn into commercial action.

**Pull:** A Spanish-first Explorer with filters, summaries, exports, participant/HS/source views, and clear provenance makes trade research faster and more credible.

**Habit:** Users may already rely on spreadsheets, DataSur-style tools, brokers, consultants, or internal analysts.

**Anxiety:** Users may worry about data licensing, missing company identity, incomplete fields, performance on large ranges, export limits, and whether results are trustworthy.

## Customer Language
**How they describe the problem:**
- "Necesito saber quién importa este producto."
- "Quiero ver qué países abastecen esta partida."
- "Necesito exportar los registros con filtros aplicados."
- "¿De dónde salió este dato?"
- "Los archivos de Aduana son difíciles de usar."

**How they describe us:**
- "Un buscador de registros Aduana."
- "Una plataforma de inteligencia de comercio exterior."
- "Un explorador de importaciones y exportaciones con trazabilidad."

**Words to use:** comercio exterior, Aduana, importaciones, exportaciones, registros, trazabilidad, fuente, lote, fila original, partida arancelaria, país origen/destino, puerto embarque/desembarque, ID Aduana, filtros, búsqueda, exportación XLSX, resumen, calidad de datos.

**Words to avoid:** verified company identity, RUT verified by Aduana, legal importer name, legal exporter name, real-time, AI truth, unlimited export, production-ready, global coverage, definitive market conclusion.

**Glossary:**
| Term | Meaning |
|------|---------|
| Aduana correlative / ID Aduana | Anonymous importer/exporter identifier present in Chile Aduana records; not a legal name or RUT. |
| Partida arancelaria / HS code | Product classification code used to group trade records. |
| CIF / FOB | Trade value bases used differently by import/export flow. |
| Source file | Preserved official raw file or working extract from a source such as datos.gob.cl. |
| Import batch | Processing batch tied to source ingestion and normalization. |
| Raw row | Original parsed row reference used for provenance and reconstruction. |
| Payload pruning | Policy that removes successful raw payloads from Postgres while retaining trace metadata and reconstructability. |
| Bounded export | Export allowed only when filters, period, result count, and row cap make it safe. |

## Brand Voice
**Tone:** Professional, direct, credible, cautious.

**Style:** Spanish-first, practical, clear, data-literate, transparent about caveats.

**Personality:** Trustworthy, rigorous, useful, pragmatic, commercially focused.

## Proof Points
**Metrics:**
- Dev database currently covers product-facing Chile Aduana records from `2025-07` through `2026-04`.
- Latest recorded dev state includes millions of normalized `trade_records` with source provenance and pruned successful payloads.
- Recent validation for `2025-07` found 0 orphaned trade records, 0 duplicate raw links, 0 parsed raw rows missing normalized records, and 0 source/import-batch mismatches.
- R2 source/archive checks verify official raw, working, and source-manifest objects for product/source classes.

**Customers:** No public customer logos or customer names are established in the repo.

**Testimonials:**
> No customer testimonials captured yet.

**Value themes:**
| Theme | Proof |
|-------|-------|
| Trust and traceability | Source file, batch, raw row, parser, payload retention, and reconstruction status are tracked. |
| Commercial search | Explorer filters by period, operation, HS/product, country, port, Aduana, transport, cargo type, values, quantities, and participant IDs where supported. |
| Practical exports | CSV/XLSX exports are bounded and include records, summary, and applied-filter/traceability context. |
| Honest identity handling | Anonymous Aduana IDs are not presented as legal company identities. |
| Data foundation | Neon/Postgres + Drizzle schema, code tables, R2 archive, QA checks, and ClickHouse-ready boundaries. |

## Goals
**Business goal:** Build a credible Chile-first trade intelligence MVP that can validate user demand before adding auth, billing, broader coverage, persistent saved searches, and enterprise workflows.

**Conversion action:** For now, get target users to explore records, validate usefulness, save/share filtered views, and request access or provide feedback. Future public conversion action is likely trial/demo/signup.

**Current metrics:** No sales, signup, activation, retention, or revenue metrics are established in the repo. Product/data progress metrics include loaded months, normalized record counts, validation counts, export readiness, and browser-smoke outcomes.
