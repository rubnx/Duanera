# Chile Aduana Identity Inference Pilot

Date: 2026-05-27

## Purpose

This pilot tests whether Duanera can infer a `posible_importador` or `posible_exportador` from the public Chile Aduana files even though the inspected files do not expose importer/exporter legal names or RUTs.

This is research only. No ingestion pipeline, schema, or product feature was implemented.

## Source Files Used

Local Aduana files inspected:

- `data/sources/chile-aduana/datos-gob-cl/exports/working/cl_aduana_exports_2026_01.txt`
- `data/sources/chile-aduana/datos-gob-cl/exports/working/cl_aduana_exports_2026_02.txt`
- `data/sources/chile-aduana/datos-gob-cl/exports/working/cl_aduana_exports_2026_03.txt`
- `data/sources/chile-aduana/datos-gob-cl/exports/working/cl_aduana_exports_2026_01_bultos.txt`
- `data/sources/chile-aduana/datos-gob-cl/exports/working/cl_aduana_exports_2026_02_bultos.txt`
- `data/sources/chile-aduana/datos-gob-cl/exports/working/cl_aduana_exports_2026_03_bultos.txt`
- `data/sources/chile-aduana/datos-gob-cl/imports/working/cl_aduana_imports_2026_01.txt`
- `data/sources/chile-aduana/datos-gob-cl/imports/working/cl_aduana_imports_2026_02.txt`
- `data/sources/chile-aduana/datos-gob-cl/imports/working/cl_aduana_imports_2026_03.txt`
- `data/sources/chile-aduana/datos-gob-cl/references/working/cl_aduana_data_dictionary_v2_0_import_copy.xlsx`

External public sources checked for candidate validation:

- CMPC Celulosa / CMPC Pulp: <https://www.cmpc.com/nosotros/negocios/celulosa/> and <https://www.cmpcpulp.com/en/about-us/>
- Codelco: <https://codelco.com/> and <https://www.codelcoeduca.cl/codelcoeduca/site/edic/base/port/como_se_vende.html>
- Vina Concha y Toro: <https://vinacyt.com/en/our-company/about-us/>
- Vina Cono Sur / Concha y Toro group references: <https://vinacyt.com/en/our-company/about-us/> and <https://www.conosur.com/>
- AquaChile: <https://es.aquachile.com/>
- Greenvic: <https://www.greenvic.cl/en/about-us/> and <https://www.greenvic.cl/en/products/>
- Emiliana: <https://www.emiliana.cl/en/>
- Cobre Cerrillos / Prysmian: <https://chile.prysmian.com/en> and <https://www.expomin.cl/en/cocesa-prysmian-group-chilean-company-cobre-cerrillos-present-at-expomin-2021/>
- Minera Antucoya: <https://web.antucoya.cl/> and <https://web.antucoya.cl/nosotros/que-hacemos>
- Orizon: <https://orizon.cl/> and <https://orizon.cl/en/us/>
- Finning Chile: <https://www.finning.com/es_CL/contact/branch-locator/sucursal-santiago.html>
- Puratos Chile: <https://www.puratos.cl/es>

## Method

For each anonymous Aduana correlative ID, aggregate evidence across January-March 2026:

- record count and declaration count
- product descriptions
- HS codes
- ports and countries
- comuna codes
- bulto marks from export bultos files
- carrier and document-emitter names, kept as weak/non-identity evidence

Candidate identity is assigned only when several independent signals point in the same direction. The pilot uses provisional confidence scores:

- `0.90-0.99`: very strong candidate; direct company/brand text appears repeatedly in Aduana product or bulto fields and matches the trade pattern.
- `0.80-0.89`: strong candidate; direct marks exist, but there is some ambiguity around legal entity, parent/subsidiary, or brand ownership.
- `0.65-0.79`: plausible candidate; evidence is coherent but not enough for high-confidence publication.
- `<0.65`: weak candidate; should not be user-facing except as an internal research lead.

These scores are not calibrated accuracy. They are reviewer confidence for this pilot only. A real "80% assurance" claim would require a manually reviewed validation set and measured precision.

## Exporter Pilot Results

Export inference is feasible for some IDs because the export bultos files contain `IDENTIFICACIONBULTO`, and those fields often include commercial marks or company names.

| Flow | Anonymous ID | Possible identity | Confidence | Key Aduana evidence | External support | Notes |
| --- | --- | --- | ---: | --- | --- | --- |
| Export | `9574` | CMPC Pulp SpA / CMPC Celulosa | 0.93 | Product text repeatedly includes `CMPC PULP SPA` and kraft pulp/cellulose; HS codes are pulp/paper; ports and destinations match large-scale pulp exports. | CMPC official sources describe its cellulose/pulp business and export-oriented production. | Strong product-text match. Bulto marks such as `PACIFICO` may be product/logistics marks and are not treated as the identity basis. |
| Export | `7761` | CMPC Pulp SpA / CMPC Celulosa | 0.91 | Product text repeatedly includes `CMPC PULP SPA`; trade pattern is large-scale pulp exports. | Same CMPC sources as above. | Likely same group as `9574`, but do not merge anonymous IDs without direct validation. |
| Export | `3730` | Codelco / Corporacion Nacional del Cobre de Chile | 0.95 | Bulto marks include `CODELCO CHILE`; product text includes copper cathodes and Codelco molybdenum concentrate; very high FOB copper/moly activity. | Codelco official sources describe the company and copper sales; Codelco Educa explains copper cathode sales. | Strong match, but the exact legal exporter entity/RUT is still not available from the public Aduana file. |
| Export | `7640` | Codelco / Corporacion Nacional del Cobre de Chile | 0.93 | Bulto marks include `CODELCO` and `CODELCO CHILE`; product text includes copper cathodes and Codelco molybdenum concentrate. | Same Codelco sources as above. | Multiple anonymous IDs may map to the same group or to separate legal/export arrangements. Do not merge automatically. |
| Export | `10111` | Vina Concha y Toro S.A. | 0.92 | Bulto marks include `VINA CONCHA Y TORO`; product text includes Vina Concha y Toro wine and wine HS codes. | Vina Concha y Toro official site describes it as a leading wine exporter with presence in more than 130 countries. | Very strong brand/company evidence, but RUT remains unverified. |
| Export | `3770` | Vina Concha y Toro S.A. | 0.90 | Bulto marks include `VINA CONCHA Y TORO`; product text repeatedly references Vina Concha y Toro wines. | Same Vina Concha y Toro source. | Likely same group as `10111`, but ID-level legal mapping is not confirmed. |
| Export | `6102` | Vina Cono Sur S.A. / Concha y Toro group | 0.86 | Bulto marks include `VINA CONO SUR`; product text references Vina Cono Sur wines. | Concha y Toro official history references creation of Vina Cono Sur; Cono Sur public site confirms the brand/company presence. | Legal entity could be Cono Sur or a group export entity; publish as "possible". |
| Export | `10380` | AquaChile S.A. / Empresas AquaChile group | 0.91 | Bulto marks include `AQUACHILE`, `AQUACHILE SA`, and variants; product text is salmon fillets/whole salmon. | AquaChile official site describes the company and its salmon products. | Strong match from marks and product category. |
| Export | `4164` | AquaChile S.A. / Empresas AquaChile group | 0.89 | Bulto marks include `AQUACHILE` and variants; product text is salmon. | Same AquaChile source. | Slightly lower because several AquaChile-like IDs appear; exact legal entity is unverified. |
| Export | `16688` | Vinedos Emiliana S.A. / Emiliana Organic Vineyards | 0.86 | Bulto marks include `EMILIANA`; product text includes organic wine labels such as Natura and Coyam. | Emiliana official site and B Corp profile describe Emiliana as an organic winery in Chile. | Strong brand/company evidence; legal name/RUT still unverified. |
| Export | `15635` | Greenvic / related Greenvic export entity | 0.84 | Bulto marks include `GREENVIC`, `VICONTO`, and fruit marks; products are cherries, nectarines, blueberries, peaches. | Greenvic public site describes itself as a Chilean fruit exporter with diversified fruit products. | `VICONTO` and other marks may reflect brands, packers, or related entities, so confidence stays below very high. |
| Export | `8110` | Cobre Cerrillos S.A. / Prysmian Chile | 0.86 | Product text repeatedly includes `COBRE CERRILLOS S.A.` and copper rod/cable; bulto marks include `PRYSMIAN`. | Prysmian Chile and Expomin sources describe Cobre Cerrillos as part of Prysmian Group in Chile. | Strong evidence, but candidate should preserve both legal/manufacturer and group names until RUT is verified. |
| Export | `6050` | Minera Antucoya | 0.82 | Bulto marks include `MINERA ANTUCOYA`; products are copper cathodes. | Minera Antucoya official site describes the operation as part of Antofagasta Minerals; public sources describe copper cathode production. | Strong but smaller sample. |
| Export | `11788` | Orizon Seafood / Orizon S.A. | 0.78 | Some bulto marks include `ORIZON`; products are jurel/fish products; ports and product pattern fit seafood exports. | Orizon official site says it brings seafood to Chile and the world; Orizon/Nutrisco sources describe jurel and seafood export activity. | Plausible but not as strong because bulto marks include mixed customer/brand/order text. |
| Export | `1902` | Finning Chile or related Caterpillar distribution/service entity | 0.62 | Product text and bulto marks reference Caterpillar parts; bulto marks also include Finning Argentina. | Finning Chile official page describes Finning as part of Finning International and the largest Caterpillar distributor. | Weak-to-plausible only. This could be a customer, dealer, repair/logistics flow, or re-export pattern. Do not publish yet. |

## Importer Pilot Results

Import inference is much weaker from the inspected files. Imports do not have a separate bulto companion file, and `ID_BULTOS` is mostly empty in the inspected high-value samples. Product brand fields are useful clues, but brand owner is not necessarily importer.

| Flow | Anonymous ID | Possible identity | Confidence | Key Aduana evidence | External support | Notes |
| --- | --- | --- | ---: | --- | --- | --- |
| Import | `5874` | Samsung Electronics Chile or related Samsung importer | 0.56 | Products are heavily Samsung phones/TVs/electronics; emitters include Samsung SDS Global and logistics firms. | Public Samsung presence exists, but this pilot did not verify a legal importer/RUT source. | Brand and logistics evidence are not enough. Could be distributor, subsidiary, or logistics arrangement. |
| Import | `9186` | Samsung Electronics Chile or related Samsung importer | 0.55 | Similar Samsung product pattern and Samsung SDS evidence. | Same as above. | Separate anonymous IDs may represent different legal entities, regimes, or import arrangements. |
| Import | `134` | Apple Chile or related Apple importer/distributor | 0.55 | Products are heavily Apple devices and accessories; emitters are logistics firms. | Public Apple product presence is obvious, but this pilot did not verify the Chile legal importer. | Brand evidence alone is insufficient. |
| Import | `13589` | Apple Chile or related Apple importer/distributor | 0.55 | Similar Apple product pattern. | Same as above. | Do not publish without additional source. |
| Import | `9621` | Finning Chile or Caterpillar-related importer | 0.64 | Products are overwhelmingly Caterpillar parts/equipment; comuna pattern and scale are consistent with a major distributor; emitters include Alexim/Maersk/logistics parties. | Finning Chile official source confirms Caterpillar distributor role. | Better than brand-only but still not high confidence. Requires external RUT/company validation. |
| Import | `1902` | Finning Chile or Caterpillar-related importer | 0.63 | Similar Caterpillar-heavy product pattern. | Same Finning source. | Numeric overlap with export ID `1902` should not be treated as the same entity without proof; import and export ID namespaces may differ. |

## What This Proves

- Exporter inference is feasible for a subset of public Aduana records when bulto marks or product text expose a company/brand directly tied to a known exporter.
- Importer inference is possible as a lead-generation workflow, but the evidence is generally weaker from the inspected files.
- The same possible company may appear under multiple anonymous IDs. That may reflect separate legal entities, branches, customs arrangements, source anonymization behavior, or false positives. Do not automatically merge IDs.
- Carrier and document-emitter fields help describe logistics patterns, but they should not be treated as importer/exporter identity.

## Recommended Product Treatment

User-facing fields should be explicit:

- `Posible exportador`
- `Posible importador`
- `Confianza`
- `Fuente de inferencia`
- `No verificado por Aduana`

Recommended confidence labels:

- `Alta`: publishable with caveat, score >= 0.85, multiple direct signals.
- `Media`: searchable internally or visible with stronger caveat, score 0.70-0.84.
- `Baja`: internal research lead only, score < 0.70.

Recommended evidence payload:

```txt
anonymous_id
flow
candidate_name
candidate_rut
confidence_score
confidence_label
evidence_summary
evidence_fields
external_sources
review_status
reviewer
reviewed_at
do_not_publish_reason
```

## Next Validation Step

Build a validation set before making any public precision claim:

1. Select 100 high-evidence exporter IDs and 100 importer IDs across several months.
2. Have a reviewer assign candidate identities and evidence labels.
3. Have a second reviewer audit a subset blindly.
4. Record false positives, uncertain matches, and duplicate-ID cases.
5. Only after that, calibrate the score and decide whether a claim like "80% assurance" is defensible.

Until then, Duanera should describe these as "possible" identities, not verified importer/exporter names.
