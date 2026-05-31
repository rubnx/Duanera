# Chile Aduana Identity Inference System

Date: 2026-05-27

## Purpose

This document defines a lawful V1 approach for Duanera to produce `Posible importador` and `Posible exportador` fields when official public Aduana files expose anonymous importer/exporter correlatives but not legal company names or RUTs.

This is a research and product-design document only. It does not implement ingestion.

## Core Position

Duanera must not treat Aduana transport companies, document emitters, or anonymous importer/exporter correlatives as verified legal company identities.

The V1 identity system should instead:

- Use `NUM_UNICO_IMPORTADOR`, `NRO_EXPORTADOR`, and `NRO_EXPORTADOR_SEC` as anonymous Aduana entity anchors.
- Build a separate evidence layer from lawful public/non-Aduana sources and source-record text signals.
- Output possible identities only with confidence scores, evidence, and review status.
- Keep verified source fields and inferred fields separate in storage, services, and UI.

## Non-Negotiable Rules

1. Do not claim Aduana provides legal importer/exporter names or RUTs in the inspected public main files.
2. Do not infer identity from carrier or document-emitter fields alone.
3. Do not label an inferred company as the importer/exporter without a confidence qualifier.
4. Do not use private, leaked, or unlawfully obtained identity-linked customs files.
5. Preserve provenance for every inference signal.
6. Allow manual review and correction before any high-confidence identity is exposed broadly.

## V1 Output Model

The V1 user-facing concept is:

```txt
ID importador Aduana: 123456
Posible importador: ACME Chile SpA
Confianza: 78%
Estado: No verificado por Aduana
Evidencia: marca/producto/ruta/fuentes publicas
```

Equivalent export concept:

```txt
ID exportador Aduana: 98765
Posible exportador: Exportadora Ejemplo SpA
Confianza: 84%
Estado: No verificado por Aduana
Evidencia: marcas de bulto/producto/fuente publica
```

The legal name or RUT, if present, comes from external public identity evidence, not from the inspected Aduana trade files.

## Evidence Sources

### Source-record signals

These are signals inside Aduana public files or companion files. They are useful for inference but are not company identity by themselves.

- Anonymous importer/exporter correlative IDs.
- Product descriptions.
- Product brands and attributes.
- HS/tariff codes.
- Origin, acquisition, destination, and route patterns.
- Ports and customs offices.
- Bulto marks or labels, especially in export companion files.
- Repeated shipment patterns across time.
- Transport and document-party fields, only as weak context and never as direct importer/exporter identity.

### External public signals

These must be acquired and stored as separate evidence records with source URLs, retrieval dates, and licensing notes.

- Company websites and product catalogs.
- Public commercial directories where reuse is allowed.
- Public trademark or brand ownership records.
- Public procurement/vendor records.
- Public regulatory/permit records where applicable.
- Public corporate registry snippets where legally usable.
- News, annual reports, and public filings.
- Product packaging or label sources where legally usable.

### Excluded or restricted signals

- Non-public Aduana identity mappings.
- Leaked customs files.
- Private customer lists.
- Purchased datasets whose license does not allow product reuse.
- Personal data sources that cannot lawfully be used for commercial enrichment.

## Confidence Levels

V1 should use simple, explainable confidence bands before any machine-learning system is considered.

| Band | Score | Meaning | Product behavior |
| --- | ---: | --- | --- |
| Very high | 90-100 | Multiple independent strong signals point to one company. | Can be shown as `Posible` with evidence, still not as Aduana-verified. |
| High | 75-89 | One strong signal plus supporting trade-pattern evidence. | Can be shown as `Posible` after validation. |
| Medium | 55-74 | Plausible but incomplete evidence. | Internal review or low-prominence display only. |
| Low | 25-54 | Weak or ambiguous evidence. | Do not show as a company result by default. |
| None | 0-24 | No useful identity evidence. | Show anonymous Aduana ID only. |

## Signal Scoring

V1 scoring should be deterministic and auditable.

Strong positive signals:

- A bulto mark, brand, or product text contains a distinctive company/brand name that matches a public company source.
- The anonymous ID repeatedly exports/imports a product line that a public company source identifies as core business.
- Multiple months/years show consistent HS/product/country patterns matching one company.
- Public sources tie the company to the same product, brand, port/region, or export market.

Medium positive signals:

- Product text contains a common brand associated with a company but not exclusive to it.
- Geography and product line match a public company profile.
- The same possible company appears across multiple independent source-record signals.

Weak positive signals:

- Transport/document-party names overlap with the possible company.
- Generic product category matches the public company profile.
- The company is known in the industry but evidence is not tied to the specific anonymous ID.

Negative signals:

- Multiple unrelated companies plausibly match the same evidence.
- Evidence points to a carrier, freight forwarder, customs broker, or document issuer rather than the commercial importer/exporter.
- Product lines conflict with the proposed company.
- Time period does not match the public evidence.

## Manual Review Workflow

V1 should include a manual analyst workflow before public confidence claims.

1. Pick an anonymous Aduana ID with enough activity to evaluate.
2. Build a compact activity profile:
   - trade flow
   - active months/years
   - top HS codes
   - top product descriptions
   - top countries/routes
   - repeated brands or bulto marks
3. Generate candidate companies from source-record text and external public signals.
4. Attach evidence items to each candidate.
5. Assign deterministic confidence score and reason codes.
6. Mark review status:
   - `unreviewed`
   - `needs_more_evidence`
   - `reviewed_possible`
   - `rejected`
   - `verified_external_source`
7. Preserve reviewer notes and evidence provenance.

## Proposed Data Concepts

These are concepts for later schema design. They are not final table definitions.

### Anonymous trade parties

Represents Aduana correlative identities.

Fields:

- `id`
- `country_code`
- `source_system`
- `trade_flow`
- `source_identifier_type`
- `source_identifier_value`
- `first_seen_period`
- `last_seen_period`
- `activity_summary_status`

Examples:

- `source_identifier_type = NUM_UNICO_IMPORTADOR`
- `source_identifier_type = NRO_EXPORTADOR`
- `source_identifier_type = NRO_EXPORTADOR_SEC`

### Identity candidates

Represents possible legal/business identities for an anonymous trade party.

Fields:

- `id`
- `anonymous_trade_party_id`
- `candidate_company_id`
- `candidate_name`
- `candidate_tax_id`
- `confidence_score`
- `confidence_band`
- `review_status`
- `reason_codes`
- `created_at`
- `updated_at`

### Evidence items

Represents a specific source or signal supporting or weakening a candidate.

Fields:

- `id`
- `identity_candidate_id`
- `evidence_type`
- `source_name`
- `source_url`
- `source_file_id`
- `raw_row_id`
- `excerpt_or_value`
- `signal_strength`
- `supports_candidate`
- `retrieved_at`
- `license_notes`

## Service Boundaries

Identity inference should sit behind services. UI components must not query inference tables directly.

Suggested future services:

- `anonymousTradePartyService`
- `identityCandidateService`
- `identityEvidenceService`
- `identityReviewService`

Trade search should be able to filter by:

- anonymous Aduana importer/exporter ID
- reviewed possible importer/exporter
- confidence band
- evidence type

The query contract should keep anonymous source identifiers and inferred companies separate.

## UI Rules

Spanish-first labels:

- `ID importador Aduana`
- `ID exportador Aduana`
- `Posible importador`
- `Posible exportador`
- `Confianza`
- `Evidencia`
- `No verificado por Aduana`
- `Fuente publica externa`
- `Requiere revision`

UI must visually distinguish:

- source fields
- normalized fields
- inferred fields
- reviewed fields

Do not display `Posible importador/exportador` as if it were a source column from Aduana.

## Validation Set

Before public launch of possible identities, create a validation set.

Minimum V1 validation:

- 50 anonymous exporter IDs with strong bulto/product signals.
- 50 anonymous importer IDs with strongest available product/brand signals.
- Analyst-reviewed evidence for each.
- Track precision by confidence band.
- Do not publish an assurance percentage until measured against this set.

Target V1 reporting:

- precision for very-high confidence
- precision for high confidence
- share of anonymous IDs with no useful candidate
- top failure modes

## V1 Scope

Included:

- Anonymous ID profiles.
- Internal candidate-generation workflow.
- Manual evidence review.
- Confidence scoring.
- Clear UI/product language for possible identities.
- Provenance for each evidence item.

Excluded:

- Claiming Aduana-verified company identity.
- RUT/name lookup from Aduana correlatives.
- Automatic user-facing company claims without review.
- Machine-learning black-box scoring.
- Paid/private data ingestion until legal rights are clear.

## Future Expansion

The system is intentionally expandable.

Later improvements can add:

- More external public sources.
- Better brand/company alias dictionaries.
- Human-in-the-loop review queues.
- Confidence calibration from validation outcomes.
- Licensed enrichment sources if rights allow.
- ML-assisted candidate ranking after deterministic V1 baselines exist.
- Country-specific evidence adapters for future markets.

## Open Questions

- Which external public Chile company/RUT sources are legally reusable for commercial enrichment?
- Which export companion files produce the strongest identity signals?
- Are bulto marks consistently available and useful across years?
- Should inferred identities be shown to all users, only paid users, or only internal analysts until validation?
- What minimum precision is acceptable before a `Posible importador/exportador` field appears in the user-facing MVP?

## Recommendation

Proceed with identity inference as a separate V1 evidence layer, not as part of core Aduana ingestion.

The first implementation milestone should be an internal validation workflow for exporter IDs, because export bulto/product signals appear more promising than import signals. Importer inference should stay internal until it demonstrates acceptable precision.
