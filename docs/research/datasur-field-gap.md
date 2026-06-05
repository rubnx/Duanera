# Datasur Field Gap

## Purpose

This note benchmarks the signed-in Explorer workflow against the local Datasur research in `docs/research/datasur-research`.

It is not a request to copy Datasur. It separates useful analyst workflows from fields that are unavailable, unnormalized, or require future identity enrichment.

## Datasur Workflow Observed

The researched Datasur flow is:

```text
Filtered search -> result summary and rankings -> previsualized full table -> export
```

Observed surfaces:

- search form with operation, period, HS/product, participant, country, port, customs, and transport criteria
- summary metrics for operation, period, records, CIF, FOB, companies, operation count, and origins
- ranked breakdowns such as tariff line, companies, country, and comparative views
- previsualized full CSV-style table with horizontal scroll, per-column inputs, and sorting controls
- export/download actions tied to the filtered result

One reviewed source-catalog screenshot shows Chile D-Comex/Aduanas Detalladas availability from `2021-01` through `2026-04`. The product should treat `2021-01` as the current product-facing Chile Aduana lower bound and prioritize backfilling that window through the latest available month before exposing older historical files in Explorer.

## Datasur Sample Export Columns

The local sample export contains 58 columns:

```text
DIA
MES
AÑO
ADUANA
NUMERO DE ACEPTACION
RUT PROBABLE IMPORTADOR
DIGITO VERIFICADOR PROBABLE IMPORTADOR
PROBABLE IMPORTADOR
PARTIDA ARANCELARIA
DESCRIPCIÓN ARANCELARIA
PRODUCTO
MARCA
VARIEDAD
DESCRIPCION
PAIS DE ORIGEN
PAÍS DE ADQUISICIÓN
VÍA DE TRANSPORTE
FORMA PAGO
PUERTO DE EMBARQUE
PUERTO DE DESEMBARQUE
COMPAÑIA DE TRANSPORTE
TIPO DE CARGA
TIPO DE BULTO
PESO BRUTO TOTAL
CLAUSULA
IMPUESTO
CANTIDAD
UNIDAD
US$ FOB
US$ FLETE
US$ SEGURO
US$ CIF
US$ CIF UNIT
TIPO DE OPERACIÓN
NUM DE ITEM
PAÍS COMPAÑIA DE TRANSPORTE
IMPUESTO US$
CANTIDAD DE BULTO
ZONA ECONÓMICA
CLAVE ECONÓMICA IMPORTADOR
ALMACEN
FECHA DE ALMACEN
NRO DE MANIFIESTO
FECHA DE MANIFIESTO
N° DOC. TRANSPORTE
FECHA DOC. TRANSPORTE
ITEMS TOTALES
FOB TOTAL
FLETE TOTAL
SEGURO TOTAL
CIF TOTAL
TOTAL IVA
US$ FOB UNIT
ACUERDO COMERCIAL
CANTIDAD UNIDADES FISICAS
UNIDAD DE MEDIDA FÍSICA
ESTADO DE MERCANCIA
EMISOR
```

## Supported Now From Normalized Data

These workflows can be supported from the current schema and service layer:

- operation and period filtering
- product text and HS filtering
- anonymous Aduana importer/exporter correlative filtering
- country, customs office, port, transport mode, and cargo type filtering
- item CIF/FOB, declaration FOB, freight, insurance, total CIF, unit price, quantity, and gross weight display
- numeric range filters for item value, declaration FOB, quantity, and gross weight
- result totals for records, values, quantities, weights, operations, and anonymous participants
- rankings for HS, country, customs office, port, transport mode, and anonymous participant correlatives
- source file, batch, raw row, parser, payload retention, and reconstructability traceability
- controlled CSV/XLSX export using normalized fields and source caveats

## Missing Or Not Yet Normalized

These Datasur-style fields are not currently first-class normalized fields:

- payment form
- package type
- clause/incoterm
- tax and tax USD
- VAT total
- package quantity
- economic zone
- importer economic key
- warehouse and warehouse date
- manifest number and manifest date
- transport document number and date
- total item count
- commercial agreement
- physical unit quantity and unit
- merchandise state
- transport company and transport company country
- emitter

Before adding schema fields for these, inspect preserved raw/source payloads and official dictionaries for coverage, type, labels, and source reliability.

## Company Identity Gap

Datasur shows probable importer RUT/name fields. Current Aduana data model intentionally does not store importer/exporter legal names, legal RUTs, or company foreign keys.

Current product copy must remain honest:

- show anonymous Aduana correlatives as correlatives, not companies
- do not label correlatives as RUTs or legal identities
- do not invent importer/exporter names
- future probable identities require a separate enrichment model with confidence, provenance, methodology, and legal review

## Recommended Explorer Direction

Explorer should keep the useful Datasur workflow but present it in a cleaner, more trustworthy product:

```text
Search/filter -> compact summary -> ranked breakdowns -> dense table views -> detail drawer/source proof -> controlled export
```

Recommended table views:

- Resumen comercial
- Mercancía
- Valores
- Logística
- Fuente

The table should support dense comparison. The drawer should remain a formatted inspection surface for one selected record, especially source traceability and field provenance.

## Phased Implementation

1. Use existing normalized fields to add Explorer summary metrics, ranked breakdowns, table views, and controlled export.
2. Expose existing numeric range filters and sorting in a compact advanced filter area.
3. Add a raw/source payload audit for the missing Datasur operational fields.
4. If source coverage is strong, propose additive schema and ingestion changes for those operational fields.
5. Treat probable company identity as a separate product and data-science/legal project.
