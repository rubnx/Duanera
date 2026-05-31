# Chile Aduana Data Review

Date accessed: 2026-05-27

## Feasibility Summary

### 1. Is the public Chile Aduana data suitable for a DataSur-like MVP?

Partially. The inspected public Aduana files are suitable for a source-traceable trade-record MVP with search and filters by period, flow, HS/tariff code, product description, value, quantity, country, port/customs office, transport fields, and importer/exporter correlative identifiers.

They are not yet confirmed suitable for a full DataSur-like company-intelligence MVP because the inspected import/export main files do not expose importer/exporter legal names or importer/exporter RUTs as public company fields. The public files contain importer/exporter correlative identifiers, plus separate transport-company and document-emitter names/RUTs, but those are not equivalent to importer/exporter identity.

### 2. What fields are confirmed?

Confirmed in the selected March 2026 files:

- Row-level item records, not aggregate-only data.
- Import rows: 439,353 rows, 178 fields, semicolon-delimited TXT, no header row.
- Export rows: 109,187 rows, 84 fields, semicolon-delimited TXT, no header row.
- HS/tariff fields: `ARANC-NAC` for imports, `CODIGOARANCEL` for exports.
- Product description fields: `DNOMBRE` and attributes for imports; `NOMBRE` and `ATRIBUTO1` through `ATRIBUTO6` for exports.
- Values: FOB/freight/insurance/CIF-style fields in both flows, plus item-level `CIF-ITEM` for imports and `FOBUS` for exports.
- Quantity and unit fields: `CANT-MERC`/`MEDIDA` for imports; `CANTIDADMERCANCIA`/`UNIDADMEDIDA` for exports.
- Weight fields: `TOT_PESO` for imports; `PESOBRUTOTOTAL` and `PESOBRUTOITEM` for exports.
- Country fields: coded country fields in both flows; export also includes destination country glosa.
- Port/customs fields: coded customs/port fields in both flows; export also includes embark/disembark port glosas.
- Transport fields: transport mode/type and transport-party fields in both flows.
- Importer/exporter correlative identifiers: `NUM_UNICO_IMPORTADOR`, `NRO_EXPORTADOR`, and `NRO_EXPORTADOR_SEC`.

### 3. What fields are missing or unclear?

- Importer/exporter legal names were not found in the inspected main files.
- Importer/exporter RUTs were not found as public importer/exporter fields in the inspected main files.
- No official public lookup table was found in the inspected datos.gob.cl or aduana.cl sources that maps importer/exporter correlative identifiers to legal names or RUTs.
- Import country/port/customs fields are mostly coded without glosa labels in the selected main file.
- Import item-level gross weight was not identified in the selected DIN title row; only total weight was confirmed.
- The exact interpretation of many coded fields depends on official code tables, Annex 51, or other Aduana references.
- Encoding is not clean UTF-8 across the selected TXT files, so parser encoding behavior remains an implementation risk.

### 4. What are the biggest risks?

- Company-intelligence risk: without public importer/exporter names or RUTs, a DataSur-like product centered on named companies may not be feasible from these public files alone.
- Code-table risk: many useful fields are coded and need official decoding before user-facing labels and filters can be trusted.
- Parser risk: large semicolon-delimited TXT files have no header row, decimal commas, and non-UTF-8 bytes.
- Modeling risk: export has companion bultos and transport-document files that were not inspected in this pass and may need separate relationships.
- Coverage risk: only one recent import main file, one recent export main file, and the dictionary were manually inspected; older years and complete 2025 files may differ.
- Licensing/product risk: source licensing and commercial redistribution still need review before public resale claims.

### 5. What should we inspect next?

Inspect next, before data-model design:

- Official code tables / Annex 51 for countries, customs offices, ports, transport modes, currencies, units, operation types, package types, and observation codes.
- Whether a non-public, request-only, paid, or separately licensed source maps `NUM_UNICO_IMPORTADOR`, `NRO_EXPORTADOR`, or `NRO_EXPORTADOR_SEC` to legal names or RUTs.
- A complete recent year, preferably 2025, to confirm stable monthly structure and realistic annual row volume.
- Export bultos and transport-document files to understand their relationship to main DUS rows.
- Later 2026 months as they appear, to verify whether structure remains stable.

### 6. Should the first MVP focus on imports, exports, or both?

Recommendation: start imports-first for the first MVP, while keeping the schema/query layer flow-aware so exports can be added without redesign.

Reasoning:

- Import data volume is larger in the inspected month and likely more directly useful for Chile-market prospecting by product, origin country, port, value, and quantity.
- Import files appear as one main monthly data resource per month, while exports add companion bultos and transport-document resources that introduce extra modeling work.
- Both flows lack confirmed named importer/exporter identity in the inspected main files, so adding exports immediately does not solve the main company-intelligence uncertainty.

Uncertainty: if the next inspection finds an official company-identifier mapping, or if early users care more about exporters than importers, the MVP scope should be revisited.

## Scope

The initial discovery pass used the datos.gob.cl CKAN API directly through:

- Script: `scripts/research/datos_gob_cl_aduana_discovery.py`
- Endpoint: `https://datos.gob.cl/api/3/action/package_search`
- Query: `fq=owner_org:AE007`

No datos.gob.cl MCP tool was used. No ingestion, database tables, row normalization, or final data model work was done.

The script is discovery-only: it reads CKAN package/resource metadata returned by `package_search`.

The later manual inspection pass selected and inspected only one recent import resource, one recent export resource, and the official data dictionary. Those findings are documented in section 9.

## 1. Import Datasets Available

The CKAN query returned 25 import datasets for Servicio Nacional de Aduanas.

| Year | Dataset | Resources | Formats | Resource roles |
| ---: | --- | ---: | --- | --- |
| 2003 | [Registro de Importaciones 2003](https://datos.gob.cl/dataset/registro-de-importaciones-2003) | 13 | rar:12, xlsx:1 | main_data:12, metadata:1 |
| 2004 | [Registro de Importaciones 2004](https://datos.gob.cl/dataset/registro-de-importaciones-2004) | 13 | rar:12, xlsx:1 | main_data:12, metadata:1 |
| 2005 | [Registro de Importaciones 2005](https://datos.gob.cl/dataset/registro-de-importaciones-2005) | 13 | rar:12, xlsx:1 | main_data:12, metadata:1 |
| 2006 | [Registro de Importaciones 2006](https://datos.gob.cl/dataset/registro-de-importaciones-2006) | 13 | rar:12, xlsx:1 | main_data:12, metadata:1 |
| 2007 | [Registro de Importaciones 2007](https://datos.gob.cl/dataset/registro-de-importaciones-2007) | 13 | rar:12, xlsx:1 | main_data:12, metadata:1 |
| 2007 | [Registros de Importacion 2007](https://datos.gob.cl/dataset/registros-de-importacion-2007) | 47 | rar:47 | main_data:47 |
| 2008 | [Registros de Importacion 2008](https://datos.gob.cl/dataset/registros-de-importacion-2008) | 48 | rar:48 | main_data:48 |
| 2009 | [Registros de Importacion 2009](https://datos.gob.cl/dataset/registros-de-importacion-2009) | 44 | rar:44 | main_data:44 |
| 2010 | [Registros de Importacion 2010](https://datos.gob.cl/dataset/registros-de-importacion-2010) | 54 | rar:54 | main_data:54 |
| 2011 | [Registros de Importacion 2011](https://datos.gob.cl/dataset/registros-de-importacion-2011) | 57 | rar:57 | main_data:57 |
| 2012 | [Registros de Importacion 2012](https://datos.gob.cl/dataset/registros-de-importacion-2012) | 58 | rar:58 | main_data:58 |
| 2013 | [Registros de Importacion 2013](https://datos.gob.cl/dataset/registros-de-importacion-2013) | 60 | rar:60 | main_data:60 |
| 2014 | [Registros de Importacion 2014](https://datos.gob.cl/dataset/registros-de-importacion-2014) | 59 | rar:59 | main_data:59 |
| 2015 | [Registros de Importacion 2015](https://datos.gob.cl/dataset/registros-de-importacion-2015) | 59 | rar:59 | main_data:59 |
| 2016 | [Registros de Importacion 2016](https://datos.gob.cl/dataset/registros-de-importacion-2016) | 62 | rar:62 | main_data:62 |
| 2017 | [Registros de Importacion 2017](https://datos.gob.cl/dataset/registros-de-importacion-2017) | 69 | docx:1, rar:68 | main_data:69 |
| 2018 | [Registros de Importacion 2018](https://datos.gob.cl/dataset/registros-de-importacion-2018) | 68 | rar:67, xlsx:1 | main_data:67, metadata:1 |
| 2019 | [Registro de Importacion 2019](https://datos.gob.cl/dataset/registros-de-importacion-2019) | 62 | rar:61, xlsx:1 | main_data:56, metadata:6 |
| 2020 | [Registro de Importacion 2020](https://datos.gob.cl/dataset/registro-de-importacion-2020) | 57 | rar:56, xlsx:1 | main_data:56, metadata:1 |
| 2021 | [Registro de Importacion 2021](https://datos.gob.cl/dataset/registro-de-importacion-2021) | 72 | rar:70, unknown:1, xlsx:1 | main_data:71, metadata:1 |
| 2022 | [Registro de Importacion 2022](https://datos.gob.cl/dataset/registro-de-importacion-2022) | 66 | rar:65, xlsx:1 | main_data:65, metadata:1 |
| 2023 | [Registro de Importacion 2023](https://datos.gob.cl/dataset/registro-de-importacion-2023) | 64 | rar:62, unknown:1, xlsx:1 | main_data:63, metadata:1 |
| 2024 | [Registro de Importacion 2024](https://datos.gob.cl/dataset/registro-de-importacion-2024) | 43 | rar:41, txt:1, xlsx:1 | main_data:42, metadata:1 |
| 2025 | [Registro de Importaciones 2025](https://datos.gob.cl/dataset/registro-de-importacion-2025) | 13 | rar:12, xlsx:1 | main_data:12, metadata:1 |
| 2026 | [Registro de Importaciones 2026](https://datos.gob.cl/dataset/registro-de-importacion-2026) | 4 | rar:2, xlsx:1, zip:1 | main_data:3, metadata:1 |

## 2. Export Datasets Available

The CKAN query returned 23 export datasets for Servicio Nacional de Aduanas.

| Year | Dataset | Resources | Formats | Resource roles |
| ---: | --- | ---: | --- | --- |
| 2003 | [Registro de Exportaciones 2003](https://datos.gob.cl/dataset/registro-de-exportaciones-2003) | 37 | rar:36, xlsx:1 | bultos:12, main_data:12, metadata:1, transport_docs:12 |
| 2004 | [Registro de Exportaciones 2004](https://datos.gob.cl/dataset/registro-de-exportaciones-2004) | 37 | rar:36, xlsx:1 | bultos:12, main_data:12, metadata:1, transport_docs:12 |
| 2005 | [Registro de Exportaciones 2005](https://datos.gob.cl/dataset/registro-de-exportaciones-2005) | 37 | rar:36, xlsx:1 | bultos:12, main_data:12, metadata:1, transport_docs:12 |
| 2006 | [Registro de Exportaciones 2006](https://datos.gob.cl/dataset/registro-de-exportaciones-2006) | 37 | rar:36, xlsx:1 | bultos:12, main_data:12, metadata:1, transport_docs:12 |
| 2007 | [Registro de Exportaciones 2007](https://datos.gob.cl/dataset/registro-de-exportaciones-2007) | 37 | rar:36, xlsx:1 | bultos:12, main_data:12, metadata:1, transport_docs:12 |
| 2009 | [Registros de exportacion 2009](https://datos.gob.cl/dataset/registros-de-exportacion-2009) | 36 | rar:36 | bultos:12, main_data:12, transport_docs:12 |
| 2010 | [Registros de exportacion 2010](https://datos.gob.cl/dataset/registros-de-exportacion-2010) | 36 | rar:36 | bultos:12, main_data:12, transport_docs:12 |
| 2011 | [Registros de Exportacion 2011](https://datos.gob.cl/dataset/registros-de-exportacion-2011) | 36 | rar:36 | bultos:12, main_data:12, transport_docs:12 |
| 2012 | [Registros de Exportacion 2012](https://datos.gob.cl/dataset/registros-de-exportacion-2012) | 36 | rar:36 | bultos:11, main_data:12, metadata:1, transport_docs:12 |
| 2013 | [Registros de exportacion 2013](https://datos.gob.cl/dataset/registros-de-exportacion-2013) | 36 | rar:36 | bultos:12, main_data:12, transport_docs:12 |
| 2014 | [Registros de Exportacion 2014](https://datos.gob.cl/dataset/registros-de-exportacion-2014) | 36 | rar:36 | bultos:12, main_data:12, transport_docs:12 |
| 2015 | [Registros de Exportacion 2015](https://datos.gob.cl/dataset/registros-de-exportacion-2015) | 36 | rar:36 | bultos:12, main_data:12, transport_docs:12 |
| 2016 | [Registros de Exportacion 2016](https://datos.gob.cl/dataset/registros-de-exportacion-2016) | 36 | rar:36 | bultos:12, main_data:12, transport_docs:12 |
| 2017 | [Registros de Exportacion 2017](https://datos.gob.cl/dataset/registros-de-exportacion-2017) | 36 | rar:36 | bultos:12, main_data:12, transport_docs:12 |
| 2018 | [Registros de Exportacion 2018](https://datos.gob.cl/dataset/registro-de-exportacion-2018) | 37 | rar:36, xlsx:1 | bultos:11, main_data:13, metadata:1, transport_docs:12 |
| 2019 | [Registro de Exportacion 2019](https://datos.gob.cl/dataset/registro-de-exportacion-2019) | 38 | rar:37, xlsx:1 | bultos:13, main_data:12, metadata:1, transport_docs:12 |
| 2020 | [Registro de Exportacion 2020](https://datos.gob.cl/dataset/registro-de-exportacion-2020) | 37 | rar:36, xlsx:1 | bultos:12, main_data:12, metadata:1, transport_docs:12 |
| 2021 | [Registro de Exportacion 2021](https://datos.gob.cl/dataset/registro-de-exportacion-2021) | 37 | rar:36, xlsx:1 | bultos:12, main_data:12, metadata:1, transport_docs:12 |
| 2022 | [Registro de Exportacion 2022](https://datos.gob.cl/dataset/registro-de-exportacion-2022) | 37 | rar:36, xlsx:1 | bultos:12, main_data:12, metadata:1, transport_docs:12 |
| 2023 | [Registro de Exportacion 2023](https://datos.gob.cl/dataset/registro-de-exportacion-2023) | 37 | rar:36, xlsx:1 | bultos:12, main_data:12, metadata:1, transport_docs:12 |
| 2024 | [Registro de Exportaciones 2024](https://datos.gob.cl/dataset/registro-de-exportaciones-2024) | 37 | rar:36, xlsx:1 | bultos:12, main_data:12, metadata:1, transport_docs:12 |
| 2025 | [Registro de Exportaciones 2025](https://datos.gob.cl/dataset/registro-de-exportaciones-2025) | 37 | rar:36, xlsx:1 | bultos:12, main_data:12, metadata:1, transport_docs:12 |
| 2026 | [Registro de Exportaciones 2026](https://datos.gob.cl/dataset/registro-de-exportacion-2026) | 10 | rar:6, xlsx:1, zip:3 | bultos:3, main_data:3, metadata:1, transport_docs:3 |

## 3. Years Covered

| Flow | Years covered by CKAN search | Notes |
| --- | --- | --- |
| Imports | 2003-2026 | 2007 appears twice as two separate import dataset packages. |
| Exports | 2003-2007, 2009-2026 | No 2008 export dataset was returned by `fq=owner_org:AE007` on 2026-05-27. |

The latest year in both flows is 2026, but 2026 is partial in CKAN as of this review: January through March only.

## 4. Recent Import Year Resources

Recent year inspected through CKAN discovery: **Registro de Importaciones 2026**.

Dataset page: https://datos.gob.cl/dataset/registro-de-importacion-2026

| Resource | Role | Format | Size bytes | Datastore | Download URL |
| --- | --- | --- | ---: | --- | --- |
| Metadata Importaciones | metadata | xlsx | 25,773 | yes | https://datos.gob.cl/dataset/984f4871-8a8e-436d-a77e-0bebe9d8af68/resource/aac5eeb8-448e-441d-a243-d32c22bb3f76/download/descripcion-y-estructura-de-datos-.xlsx |
| Importaciones - enero 2026 | main data | rar | 24,853,136 | no | https://datos.gob.cl/dataset/984f4871-8a8e-436d-a77e-0bebe9d8af68/resource/3116608e-6f1f-446e-b04d-1426f5c2889a/download/importaciones-enero-2026.rar |
| Importaciones - febrero 2026 | main data | zip | 32,076,335 | no | https://datos.gob.cl/dataset/984f4871-8a8e-436d-a77e-0bebe9d8af68/resource/45c403bf-1412-41cd-bc90-f414efa9b007/download/importaciones-febrero-2026.zip |
| Importaciones - marzo 2026 | main data | rar | 27,618,601 | no | https://datos.gob.cl/dataset/984f4871-8a8e-436d-a77e-0bebe9d8af68/resource/f441ebf7-f1e2-4fdb-9f87-f8ea0ae83132/download/importaciones-marzo-2026.rar |

## 5. Recent Export Year Resources

Recent year inspected through CKAN discovery: **Registro de Exportaciones 2026**.

Dataset page: https://datos.gob.cl/dataset/registro-de-exportacion-2026

| Resource | Role | Format | Size bytes | Datastore | Download URL |
| --- | --- | --- | ---: | --- | --- |
| Metadata Exportaciones | metadata | xlsx | 25,773 | yes | https://datos.gob.cl/dataset/f6a643e7-a2e4-48e4-866e-732c7ceb51f3/resource/e0a25239-af2f-49be-afc3-44be524d6e4e/download/descripcion-y-estructura-de-datos-.xlsx |
| Exportaciones enero 2026 | main data | rar | 5,975,773 | no | https://datos.gob.cl/dataset/f6a643e7-a2e4-48e4-866e-732c7ceb51f3/resource/e8075003-9f64-4e3a-aa7e-f689a7e056eb/download/exportaciones-enero-2026.rar |
| Exportaciones enero 2026 - Bultos | bultos | rar | 409,260 | no | https://datos.gob.cl/dataset/f6a643e7-a2e4-48e4-866e-732c7ceb51f3/resource/6dd1316e-fe99-4a62-80c2-d838dcb3695a/download/exportaciones-enero-2026-bultos.rar |
| Exportaciones enero 2026 - Documentos de Transporte | transport docs | rar | 818,128 | no | https://datos.gob.cl/dataset/f6a643e7-a2e4-48e4-866e-732c7ceb51f3/resource/f15ca5c2-ee96-4d47-be9b-61ca677ab4d7/download/exportaciones-enero-2026-documentos-de-transporte.rar |
| Exportaciones febrero 2026 | main data | zip | 8,312,440 | no | https://datos.gob.cl/dataset/f6a643e7-a2e4-48e4-866e-732c7ceb51f3/resource/4940087f-68b5-4bac-ae33-4ea5952119c4/download/exportaciones-febrero-2026.zip |
| Exportaciones febrero 2026 - Bultos | bultos | zip | 377,337 | no | https://datos.gob.cl/dataset/f6a643e7-a2e4-48e4-866e-732c7ceb51f3/resource/3c2b6dfc-6da2-4f1e-977b-422d2b3c0387/download/exportaciones-febrero-2026-bultos.zip |
| Exportaciones febrero 2026 - Documentos de Transporte | transport docs | zip | 838,421 | no | https://datos.gob.cl/dataset/f6a643e7-a2e4-48e4-866e-732c7ceb51f3/resource/796663f5-52ff-4ce5-b321-edc9f4666dcd/download/exportaciones-febrero-2026-documentos-de-transporte.zip |
| Exportaciones marzo 2026 | main data | rar | 5,400,523 | no | https://datos.gob.cl/dataset/f6a643e7-a2e4-48e4-866e-732c7ceb51f3/resource/5183295b-2119-4117-91b0-77529ad30486/download/exportaciones-marzo-2026.rar |
| Exportaciones marzo 2026 - Bultos | bultos | rar | 368,235 | no | https://datos.gob.cl/dataset/f6a643e7-a2e4-48e4-866e-732c7ceb51f3/resource/fb1bcb9f-720b-4852-9493-5f0a90c989a7/download/exportaciones-marzo-2026-bultos.rar |
| Exportaciones marzo 2026 - Documentos de Transporte | transport docs | rar | 707,237 | no | https://datos.gob.cl/dataset/f6a643e7-a2e4-48e4-866e-732c7ceb51f3/resource/9f048727-79de-4574-a171-cb2dea97fe21/download/exportaciones-marzo-2026-documentos-de-transporte.rar |

## 6. Formats Used

Formats returned by CKAN across the Aduana packages include:

- `rar`: the dominant format for monthly import/export source data.
- `zip`: used in some recent 2026 monthly resources.
- `xlsx`: used for metadata workbooks and the official data dictionary.
- `txt`: appears in at least one import package resource for 2024.
- `docx`: appears in at least one import package resource for 2017.
- `unknown`: appears in the CKAN `format` field for one resource in 2021 imports and one resource in 2023 imports.

No CSV resources were identified in the datos.gob.cl CKAN package search results for these Servicio Nacional de Aduanas import/export datasets. CSV files seen elsewhere in local research are from aduana.cl operational pages, not from these datos.gob.cl dataset resources.

## 7. Official Data Dictionary Availability

Yes. CKAN returns the official Aduana data dictionary dataset:

- Dataset: https://datos.gob.cl/dataset/diccionario-de-datos-para-datos-abiertos-aduana
- Resource: `Diccionario de Datos para Datos abiertos Aduana`
- Format: xlsx
- Resource role in script output: `data_dictionary`
- Download URL: https://datos.gob.cl/dataset/8e686c07-1e86-476e-87eb-d7dd243340a6/resource/792ca993-e4e4-4b83-a965-7aafca93fe2f/download/campos-de-dus-y-din-para-archivos-de-datos-abiertos-v2.0.xlsx

Recent yearly import/export packages also include metadata workbooks named `Metadata Importaciones` or `Metadata Exportaciones`.

## 8. Row-Level Or Aggregated?

The import/export resources are likely **row-level item records**, not aggregated statistics.

Evidence from CKAN package notes and resource descriptions:

- Import datasets describe records of items corresponding to DIN import declarations.
- Export datasets describe records of items corresponding to DUS export declarations.
- Export resources are separated into main item files, bultos files, and transport-document files.

This is still a discovery-stage conclusion. Row-level status should be confirmed by manually inspecting the selected raw files and their metadata before designing the data model.

The separate package `Registros de Comercio Exterior (datos agregados)` appears to be aggregated statistics, but CKAN returned zero resources for it in this query.

## 9. Selected Working File Inspection

Selected files inspected on 2026-05-27:

- Import working file: `data/sources/chile-aduana/datos-gob-cl/imports/working/cl_aduana_imports_2026_03.txt`
- Export working file: `data/sources/chile-aduana/datos-gob-cl/exports/working/cl_aduana_exports_2026_03.txt`
- Official dictionary workbook: `data/sources/chile-aduana/datos-gob-cl/references/working/cl_aduana_data_dictionary_v2_0_import_copy.xlsx`

No ingestion, database tables, normalized row parsing, or data model changes were implemented.

### File Format And Row Count

Both selected monthly data files are extracted text files from official compressed resources.

| Flow | Selected resource | Working format | Delimiter | Header row | Data rows | Fields per row | Dictionary title row |
| --- | --- | --- | --- | --- | ---: | ---: | --- |
| Import | Importaciones - marzo 2026 | `.txt` | semicolon | no | 439,353 | 178 | `titulos` sheet, `DIN` row |
| Export | Exportaciones marzo 2026 | `.txt` | semicolon | no | 109,187 | 84 | `titulos` sheet, `DUS` row |

Encoding note: the files are not valid UTF-8 across the full file. Latin-1-compatible decoding was sufficient for structure inspection. A future parser should detect and preserve source encoding explicitly.

### Row-Level Or Aggregated

Manual inspection confirms that the selected import and export main files are row-level item records, not aggregated statistics.

Evidence:

- Both files have declaration identifiers plus item numbers.
- Import rows include `NUMENCRIPTADO`, `NUMITEM`, item product fields, item quantity, item HS/tariff fields, and item CIF value.
- Export rows include `NUMEROIDENT`, `NUMEROITEM`, item product fields, item quantity, item HS/tariff field, item FOB value, and item gross weight.
- Values, quantities, ports, countries, and transport fields are present at record/detail level rather than only as monthly totals.

### Import Column Names

The selected import file has 178 semicolon-delimited fields. The file itself has no header row; column names come from the official dictionary workbook `titulos` sheet, `DIN` row.

```txt
NUMENCRIPTADO, TIPO_DOCTO, ADU, FORM, FECVENCI, CODCOMUN, NUM_UNICO_IMPORTADOR, CODPAISCON, DESDIRALM, CODCOMRS, ADUCTROL, NUMPLAZO, INDPARCIAL, NUMHOJINS, TOTINSUM, CODALMA, NUM_RS, FEC_RS, ADUA_RS, NUMHOJANE, NUM_SEC, PA_ORIG, PA_ADQ, VIA_TRAN, TRANSB, PTO_EMB, PTO_DESEM, TPO_CARGA, ALMACEN, FEC_ALMAC, FECRETIRO, NU_REGR, ANO_REG, CODVISBUEN, NUMREGLA, NUMANORES, CODULTVB, PAGO_GRAV, FECTRA, FECACEP, GNOM_CIA_T, CODPAISCIA, NUMRUTCIA, DIGVERCIA, NUM_MANIF, NUM_MANIF1, NUM_MANIF2, FEC_MANIF, NUM_CONOC, FEC_CONOC, NOMEMISOR, NUMRUTEMI, DIGVEREMI, GREG_IMP, REG_IMP, BCO_COM, CODORDIV, FORM_PAGO, NUMDIAS, VALEXFAB, MONEDA, MONGASFOB, CL_COMPRA, TOT_ITEMS, FOB, TOT_HOJAS, COD_FLE, FLETE, TOT_BULTOS, COD_SEG, SEGURO, TOT_PESO, CIF, NUM_AUT, FEC_AUT, GBCOCEN, ID_BULTOS, TPO_BUL1, CANT_BUL1, TPO_BUL2, CANT_BUL2, TPO_BUL3, CANT_BUL3, TPO_BUL4, CANT_BUL4, TPO_BUL5, CANT_BUL5, TPO_BUL6, CANT_BUL6, TPO_BUL7, CANT_BUL7, TPO_BUL8, CANT_BUL8, CTA_OTRO, MON_OTRO, CTA_OTR1, MON_OTR1, CTA_OTR2, MON_OTR2, CTA_OTR3, MON_OTR3, CTA_OTR4, MON_OTR4, CTA_OTR5, MON_OTR5, CTA_OTR6, MON_OTR6, CTA_OTR7, MON_OTR7, MON_178, MON_191, FEC_501, VAL_601, FEC_502, VAL_602, FEC_503, VAL_603, FEC_504, VAL_604, FEC_505, VAL_605, FEC_506, VAL_606, FEC_507, VAL_607, TASA, NCUOTAS, ADU_DI, NUM_DI, FEC_DI, MON_699, MON_199, NUMITEM, DNOMBRE, DMARCA, DVARIEDAD, DOTRO1, DOTRO2, ATR-5, ATR-6, SAJU-ITEM, AJU-ITEM, CANT-MERC, MERMAS, MEDIDA, PRE-UNIT, ARANC-ALA, NUMCOR, NUMACU, CODOBS1, DESOBS1, CODOBS2, DESOBS2, CODOBS3, DESOBS3, CODOBS4, DESOBS4, ARANC-NAC, CIF-ITEM, ADVAL-ALA, ADVAL, VALAD, OTRO1, CTA1, SIGVAL1, VAL1, OTRO2, CTA2, SIGVAL2, VAL2, OTRO3, CTA3, SIGVAL3, VAL3, OTRO4, CTA4, SIGVAL4, VAL4
```

### Export Column Names

The selected export file has 84 semicolon-delimited fields. The file itself has no header row; column names come from the official dictionary workbook `titulos` sheet, `DUS` row.

```txt
FECHAACEPT, NUMEROIDENT, ADUANA, TIPOOPERACION, CODIGORUTEXPORTADORPPAL, NRO_EXPORTADOR, PORCENTAJEEXPPPAL, COMUNAEXPORTADORPPAL, CODIGORUTEXPSEC, NRO_EXPORTADOR_SEC, PORCENTAJEEXPSECUNDARIO, COMUNAEXPSECUNDARIO, PUERTOEMB, GLOSAPUERTOEMB, REGIONORIGEN, TIPOCARGA, VIATRANSPORTE, PUERTODESEMB, GLOSAPUERTODESEMB, PAISDESTINO, GLOSAPAISDESTINO, NOMBRECIATRANSP, PAISCIATRANSP, RUTCIATRANSP, DVRUTCIATRANSP, NOMBREEMISORDOCTRANSP, RUTEMISOR, DVRUTEMISOR, CODIGOTIPOAUTORIZA, NUMEROINFORMEEXPO, DVNUMEROINFORMEEXP, FECHAINFORMEEXP, MONEDA, MODALIDADVENTA, CLAUSULAVENTA, FORMAPAGO, VALORCLAUSULAVENTA, COMISIONESEXTERIOR, OTROSGASTOS, VALORLIQUIDORETORNO, NUMEROREGSUSP, ADUANAREGSUSP, PLAZOVIGENCIAREGSUSP, TOTALITEM, TOTALBULTOS, PESOBRUTOTOTAL, TOTALVALORFOB, VALORFLETE, CODIGOFLETE, VALORSEGURO, CODIGOSEG, VALORCIF, NUMEROPARCIALIDAD, TOTALPARCIALES, PARCIAL, OBSERVACION, NUMERODOCTOCANCELA, FECHADOCTOCANCELA, TIPODOCTOCANCELA, PESOBRUTOCANCELA, TOTALBULTOSCANCELA, NUMEROITEM, NOMBRE, ATRIBUTO1, ATRIBUTO2, ATRIBUTO3, ATRIBUTO4, ATRIBUTO5, ATRIBUTO6, CODIGOARANCEL, UNIDADMEDIDA, CANTIDADMERCANCIA, FOBUNITARIO, FOBUS, CODIGOOBSERVACION1, VALOROBSERVACION1, GLOSAOBSERVACION1, CODIGOOBSERVACION2, VALOROBSERVACION2, GLOSAOBSERVACION2, CODIGOOBSERVACION3, VALOROBSERVACION3, GLOSAOBSERVACION3, PESOBRUTOITEM
```

### Field Availability Summary

| Field group | Import file | Export file | Notes |
| --- | --- | --- | --- |
| Company-level importer/exporter fields | Yes, but primary importer is represented as `NUM_UNICO_IMPORTADOR`, described by the dictionary as a unique correlative importer number. | Yes, but exporter fields are `NRO_EXPORTADOR` and `NRO_EXPORTADOR_SEC`, described as unique correlative exporter numbers. | The selected public files do not expose importer/exporter legal names in the main company fields. Carrier/emitter names and RUTs are present separately. |
| Carrier / document issuer fields | `GNOM_CIA_T`, `NUMRUTCIA`, `DIGVERCIA`, `NOMEMISOR`, `NUMRUTEMI`, `DIGVEREMI`. | `NOMBRECIATRANSP`, `RUTCIATRANSP`, `DVRUTCIATRANSP`, `NOMBREEMISORDOCTRANSP`, `RUTEMISOR`, `DVRUTEMISOR`. | These are transport/document-party fields, not necessarily importer/exporter identity fields. |
| HS / tariff code | `ARANC-NAC`; also `ARANC-ALA`, `NUMCOR`, `NUMACU`. | `CODIGOARANCEL`. | HS/tariff fields exist in both selected files. |
| Product description | `DNOMBRE`, `DMARCA`, `DVARIEDAD`, `DOTRO1`, `DOTRO2`, `ATR-5`, `ATR-6`. | `NOMBRE`, `ATRIBUTO1` through `ATRIBUTO6`. | Product description exists in both files. |
| Value fields | `FOB`, `FLETE`, `SEGURO`, `CIF`, `CIF-ITEM`, `PRE-UNIT`, plus tax/account value fields. | `FOBUS`, `FOBUNITARIO`, `TOTALVALORFOB`, `VALORFLETE`, `VALORSEGURO`, `VALORCIF`, `VALORCLAUSULAVENTA`, `VALORLIQUIDORETORNO`. | Values exist in both files. Numeric values use decimal comma in sampled rows. |
| Quantity and unit | `CANT-MERC`, `MEDIDA`. | `CANTIDADMERCANCIA`, `UNIDADMEDIDA`. | Quantity and unit fields exist in both files. |
| Weight | `TOT_PESO`. | `PESOBRUTOTOTAL`, `PESOBRUTOITEM`. | Export has total and item gross weight. Import selected main file has total weight; no item-level gross weight field was identified in the selected DIN title row. |
| Country | `CODPAISCON`, `PA_ORIG`, `PA_ADQ`, `CODPAISCIA`. | `PAISDESTINO`, `GLOSAPAISDESTINO`, `PAISCIATRANSP`. | Export includes destination country code and glosa. Import country fields are coded without glosa fields in the selected main file. |
| Port / customs office | `ADU`, `ADUCTROL`, `ADUA_RS`, `ADU_DI`, `PTO_EMB`, `PTO_DESEM`. | `ADUANA`, `ADUANAREGSUSP`, `PUERTOEMB`, `GLOSAPUERTOEMB`, `PUERTODESEMB`, `GLOSAPUERTODESEMB`. | Export includes port glosas for embark/disembark. Import ports and customs offices need code tables for labels. |
| Transport | `VIA_TRAN`, `TRANSB`, `TPO_CARGA`, `GNOM_CIA_T`, manifest/document fields. | `VIATRANSPORTE`, `TIPOCARGA`, `NOMBRECIATRANSP`, document-emitter fields. | Transport mode/type fields are coded and need official decoding. |

### Importer/exporter identity availability

Finding as of 2026-05-27: the inspected public Aduana files support anonymous importer/exporter analysis by correlative identifier, but they do not currently support verified legal-company intelligence by importer/exporter name or RUT.

Official sources checked:

- datos.gob.cl Aduana package metadata through CKAN `package_search` for Servicio Nacional de Aduanas (`owner_org:AE007`), including import/export yearly packages, the data dictionary package, and the aggregated foreign-trade package.
- datos.gob.cl official data dictionary: <https://datos.gob.cl/dataset/diccionario-de-datos-para-datos-abiertos-aduana>.
- datos.gob.cl 2026 import/export package metadata and resource lists: <https://datos.gob.cl/dataset/registro-de-importacion-2026> and <https://datos.gob.cl/dataset/registro-de-exportacion-2026>.
- datos.gob.cl aggregated foreign-trade package: <https://datos.gob.cl/dataset/registros-de-comercio-exterior-datos-agregados>.
- Aduana.cl official import/export operational pages already archived locally:
  - <https://www.aduana.cl/base-de-datos-operaciones-de-ingreso/aduana/2018-12-28/102736.html>
  - <https://www.aduana.cl/productos-estadisticos-exportaciones/aduana/2024-05-28/113521.html>
- Aduana.cl transparency response records and linked responses:
  - <https://www.aduana.cl/transparencia/2017/febrero/registro_respuestas_solicitudes.html>
  - <https://www.aduana.cl/transparencia/2017/febrero/AE007T0002141.pdf>
  - <https://www.aduana.cl/transparencia/2017/octubre/AE007T0002876.pdf>
- Aduana.cl pre-open-data notices and older transparency response registers:
  - <https://www.aduana.cl/nuevo-acceso-a-la-informacion-publica-de-aduanas/aduana/2016-04-28/164433.html>
  - <https://www.aduana.cl/aduanas-publica-informacion-de-importaciones-y-exportaciones-en-su-web/aduana/2016-09-30/162849.html>
  - <http://www.aduana.cl/transparencia/2012/septiembre/reg_respuestas_sept2012.html>
  - <https://www.aduana.cl/transparencia/2013/julio/registro_respuestas_solicitudes.html>
- Consejo para la Transparencia decisions involving Aduana importer/exporter name/RUT requests:
  - <https://extranet.consejotransparencia.cl/Web_SCW/Archivos/C1002-17/DecisionWeb_C1002-17.pdf>
  - <https://extranet.consejotransparencia.cl/Web_SCW/Archivos/C3165-17/DecisionWeb_C3165-17.pdf>
- Aduana.cl code-table workbook `tablas_de_codigos.xlsx`, downloaded from the official import operational page.
- Aduana.cl code-table/standards references identified by official source text, especially Anexo 51 and the current customs tariff references:
  - <http://www.aduana.cl/aduana/site/artic/20080218/pags/20080218165942.html>
  - <http://www.aduana.cl/arancel-aduanero-vigente/aduana/2016-12-30/090118.html>
- Internet Archive / Wayback Machine captures of Aduana.cl statistics pages and linked workbook resources from pre-2017 public pages:
  - <https://web.archive.org/web/20161214192404/http://www.aduana.cl/aduana/site/edic/base/port/estadisticas.html>
  - <https://web.archive.org/web/20160616185222/http://www.aduana.cl/importaciones/aduana/2007-04-16/165920.html>
  - <https://web.archive.org/web/20160828225433/http://www.aduana.cl/exportaciones/aduana/2007-04-16/165951.html>
  - <https://web.archive.org/web/20150406063358/http://www.aduana.cl/aduana/site/artic/20070416/asocfile/20070416165920/import_productos_ene_15.xlsx>
- Internet Archive / Wayback Machine captures of datos.gob.cl Aduana CKAN dataset pages:
  - <https://web.archive.org/web/20160404092835/http://datos.gob.cl/dataset/registros-de-importacion-2015>
  - <https://web.archive.org/web/20160910073954/http://datos.gob.cl/dataset/registros-de-exportacion-2015>
  - <https://web.archive.org/web/20160404103014/http://datos.gob.cl/dataset/registros-de-exportacion-2016>
  - <https://web.archive.org/web/20161011170242/http://datos.gob.cl/dataset/diccionario-de-datos-para-datos-abiertos-aduana>

Answers:

1. Legal importer/exporter names are not available in the inspected public main files. Imports expose `NUM_UNICO_IMPORTADOR`; exports expose `NRO_EXPORTADOR` and `NRO_EXPORTADOR_SEC`. The official dictionary describes those as unique correlative numbers, not names.
2. Importer/exporter RUTs are not available as public importer/exporter identity fields in the inspected main files. Export fields such as `CODIGORUTEXPORTADORPPAL` and `CODIGORUTEXPSEC` are described as `Tipo de Rut`, while the actual exporter fields are still correlative numbers. The public import file has no importer RUT field in the selected DIN title row.
3. The correlative IDs appear stable enough for anonymous grouping within the selected 2026 monthly files, but year-to-year stability is not fully proven. In the local January-March 2026 samples, `NUM_UNICO_IMPORTADOR` values repeat heavily across months: 14,548 importer IDs are present in all three selected import months. `NRO_EXPORTADOR` also repeats across months: 979 primary exporter IDs are present in all three selected export months. This supports same-year anonymous entity grouping. It does not prove that the same correlative maps to the same legal entity across all years.
4. No official public lookup table was found that maps `NUM_UNICO_IMPORTADOR`, `NRO_EXPORTADOR`, or `NRO_EXPORTADOR_SEC` to legal company names or RUTs. datos.gob.cl exposes yearly import/export packages, metadata workbooks, the data dictionary, and aggregated commerce data; Aduana.cl exposes operational import/export CSVs and code tables for customs/geography/transport/value dimensions. None of the inspected official resources is a company-identity lookup for these correlatives.
5. Carrier and document-emitter fields must not be used as importer/exporter identity fields. Import fields such as `GNOM_CIA_T`, `NUMRUTCIA`, `NOMEMISOR`, and `NUMRUTEMI` identify transport companies or transport-document emitters. Export fields such as `NOMBRECIATRANSP`, `RUTCIATRANSP`, `NOMBREEMISORDOCTRANSP`, and `RUTEMISOR` serve the same transport/document role. These parties can be freight carriers, shipping lines, freight forwarders, agents, or document issuers, and may be unrelated to the commercial importer/exporter.
6. If only anonymous importer/exporter IDs are available, useful MVP features still include record search, HS/product exploration, country/port/transport filters, value/quantity/weight filters, trends by anonymous importer/exporter ID, top anonymous importers/exporters by HS code or route, repeat-activity detection, and source-traceable record detail. Product copy should label these as "importador anonimo" or "ID de importador/exportador" rather than company names.
7. Features that require company names or RUTs include named company profiles, company search by legal name, prospect lists, competitor/supplier/customer identification, RUT-based enrichment, CRM/export workflows based on business identities, confidence-scored company normalization, and any claim that a named company imported/exported a product.

Product implication: until a lawful and official identity mapping is found, Duanera should treat importer/exporter IDs as anonymized source identifiers. Named company intelligence should remain out of MVP scope or be clearly marked as requiring a separate verified source.

### Aduana.cl transparency and operational-source check

Additional Aduana.cl evidence strengthens the identity conclusion:

- Aduana.cl transparency response `AE007T0002141` directly answered a request for a CSV/Excel list mapping exporter number to RUT and company name for the 2016 export open-data records. Aduana responded that the open-data system provides expanded foreign-trade data, but those data do not include the names or RUTs of the natural or legal persons carrying out commercial transactions.
- Aduana.cl transparency response `AE007T0002876` repeats the same position for open-data DIN/DUS coverage: the data are from Aduana systems, but names and RUTs of transacting natural/legal persons are not included.
- Consejo para la Transparencia decision `C1002-17` records a requester saying Aduana had previously sent Excel files including importer RUTs and addresses before the open-data change. The decision nevertheless rejected the appeal for importer RUT/address disclosure, treating the requested identity-linked trade data as protected by secrecy/reserve grounds.
- Consejo decision `C3165-17` similarly records Aduana's position that it does not maintain public importer/exporter databases to be associated with statistical records, and that names/RUTs linked to import/export activity are not public statistical data. The appeal for names/RUTs was rejected under secrecy/reserve reasoning.
- The official Aduana.cl "Base de Datos Operaciones de Ingreso" page exposes annual operational import files back to 2002. A downloaded 2002 sample (`ingresos_2002.zip`) contains an 18-column aggregate/statistical CSV with no importer/exporter identity fields, no correlative importer ID, and no legal name/RUT fields.
- The archived Aduana.cl export operational CSVs inspected locally likewise contain statistical dimensions and measures only: period, customs, operation type, region/route/country/cargo, tariff item, FOB, weight, quantity, and unit. They do not contain exporter names, exporter RUTs, or anonymous exporter correlatives.

Interpretation: Aduana.cl is useful for aggregate/operational statistics and code-table context, but the inspected public Aduana.cl sources are not an official lookup path from anonymous DIN/DUS correlatives to legal company identity. The transparency and appeal documents also indicate that names/RUTs linked to trade activity are intentionally excluded or withheld, even when requested.

### Pre-open-data transparency archive check

The Desktop note `datos.gob.cl seems like a mostly new transparency.md` correctly points to a separate historical question: before datos.gob.cl became the standardized open-data catalog, was similar or richer Aduana trade data distributed through another route?

Verified Aduana.cl evidence says yes, but with an important caveat: the route was transparency-request delivery, not necessarily durable public download.

Local evidence is stored under `data/research/aduana-transparency-archives/`.

Findings:

- Aduana's April 2016 notice says the service had joined the government public-data system at the end of March 2016 and would run a transition in which the existing transparency-request channel and the new Datos Abiertos model operated together. It says imports from 2007 onward and exports from 2009 onward would be progressively released through Datos Abiertos, while earlier years would remain through the transparency portal.
- Aduana's September 2016 notice says monthly import/export transaction information would be published permanently, while excluding personal, reserved, and directly identifying data under transparency-law safeguards.
- The September 2012 transparency response register contains many requests for complete monthly import/export databases. Representative entries include `AE007W-0003500` for complete July 2012 import/export databases and `AE007W-0003522` for the complete July 2012 import/export movement database.
- Downloaded response `Mail_AE007W0003500.docx` says the July 2012 information was delivered in CD format and lists control totals, including DUS record groups and DIN total records. `Mail_AE007W0003522.docx` similarly says the requested information was delivered by CD.
- Downloaded response `Mail_AE007W0003487.docx` says there was no monthly subscription for the data and that the requester had to ask monthly through the transparency-request system. It also refers to a data dictionary being attached, which suggests the request workflow had its own dataset documentation.
- The July 2013 transparency response register includes requests for monthly import/export operations in flat-text format, DIN/DUS fields, and fields explicitly requested by users such as RUT and Empresa.
- Downloaded responses `ae007w0004634.pdf` and `ae007w0004733.pdf` say broad monthly import/export information would be sent by certified postal mail on CD. Response `ae007w0004703.pdf` says RAR files were attached for import/export data for specific tariff codes from 2005-2012. Response `ae007w0004672.pdf` says an Excel file was attached for a specific import request.

Interpretation: pre-2016 transparency registers are a real lead for understanding historical Aduana data distribution. They prove that bulk and filtered trade extracts circulated through request-specific CD, Excel, and RAR deliveries before or around the datos.gob.cl transition. However, the inspected public response-register pages and response documents usually do not include the actual attached data files or CDs, so they do not currently provide a public retrievable source for legal importer/exporter names or RUTs. They are stronger evidence of prior request-specific access than of an official public lookup table.

Product implication: this route may help validate DataSur-style historical practice and file schemas if actual delivered files can be lawfully obtained from original recipients, archived attachments, or a new formal transparency request. It should not be treated as a public open-data source until the underlying delivered files and their legal reuse terms are obtained and inspected.

### Wayback Aduana.cl check

The Wayback check targeted old Aduana.cl public statistics pages and downloadable resources, especially the period before the 2017 transparency disputes over importer/exporter names and RUTs.

Local evidence is stored under `data/research/wayback-aduana-cl/`.

Checks performed:

- CDX query for the archived Aduana.cl statistics landing page from 2014-2016 found 40 distinct 200-status captures.
- CDX queries for the old public import, export, and series statistics pages found 42, 33, and 18 distinct 200-status captures, respectively.
- Broad CDX queries for `.xls`, `.xlsx`, `.zip`, and `.rar` resources under Aduana.cl from 2010-2016 did not find 200-status captures through the tested wildcard patterns.
- Keyword CDX queries for archived Aduana.cl URLs containing `importador`, `exportador`, or `rut` from 2000-2016 returned zero 200-status captures.
- Representative archived import/export pages were downloaded and link-inspected. Their downloadable Excel links are named as country/product/series reports, for example `impo_pais_2016_04.xlsx`, `impo_prod_2016_04.xlsx`, `expo_pais_2016_06.xlsx`, `expo_prod_2016_06.xlsx`, `importaciones_por_paises_y_bloques_2015_final.xls`, and `exportaciones_por_paises_y_bloques_2015_final.xls`.
- An exact CDX query found two archived captures of `import_productos_ene_15.xlsx`; other sampled exact workbook URLs did not have archived 200-status captures.

The downloaded workbook sample `import_productos_ene_15.xlsx` is aggregate-only. It has sheets `índice` and `detalle`, both with the heading `Importaciones - Valor CIF (US$ miles)` and columns `Capítulo SA`, `Productos`, `Ene_2014`, `Ene_2015`, and `%Var`. It contains product/chapter-level CIF values, not declaration rows, importer names, importer RUTs, or anonymous importer correlatives.

Interpretation: the sampled pre-2017 Aduana.cl Wayback captures show public statistical pages and aggregate workbooks by country, product, or series. They do not reveal a public official identity-bearing file or a lookup table from `NUM_UNICO_IMPORTADOR`, `NRO_EXPORTADOR`, or `NRO_EXPORTADOR_SEC` to names/RUTs. This is not proof that no such file ever existed anywhere on Aduana.cl, but it supports the narrower conclusion that the inspected archived public statistics pages are not a source for importer/exporter legal identity. The identity-bearing Excel files referenced in transparency disputes may have been request/email outputs rather than durable public web downloads.

### Wayback datos.gob.cl check

The datos.gob.cl Wayback check targeted archived CKAN pages for Aduana import/export datasets, archived resource/download URLs, the Aduana data dictionary page, and identity-looking URL keywords.

Local evidence is stored under `data/research/wayback-datos-gob-cl/`.

Checks performed:

- CDX queries for `registros-de-importacion*` found 117 distinct 200-status captures from 2016, mostly the archived `Registros de Importación 2015` dataset page and its resource pages.
- CDX queries for `registros-de-exportacion*` found 25 distinct 200-status captures from 2016, covering archived `Registros de Exportación 2015` and `Registros de Exportación 2016` dataset/resource pages.
- CDX queries for `registro-de-importacion*`, `registro-de-importaciones*`, `registro-de-exportacion*`, and `registro-de-exportaciones*` found zero 200-status captures for the 2000-2016 window through the tested patterns.
- A CDX query found one archived capture of the data dictionary dataset page: `Diccionario de Datos para Datos Abiertos Aduana`, version 2.0.
- Keyword CDX queries for datos.gob.cl URLs containing `importador`, `exportador`, or `rut` from 2000-2016 returned zero 200-status captures.
- Exact CDX queries for sampled metadata and monthly RAR download URLs listed on the archived 2015/2016 pages returned zero archived 200-status binary captures. The archived pages preserve the resource links and descriptions, but the sampled downloadable files themselves were not archived by Wayback.

The archived dataset pages describe the same open-data shape already seen in current datos.gob.cl research: monthly RAR files for import/export item records plus XLSX metadata. Examples include `Octubre2015 - Importaciones`, `Metadata - Importaciones`, `Octubre2015 - Exportaciones`, `Metadata - Exportaciones`, `Metadata - Exportación Bultos`, and monthly bultos resources. The archived dictionary page describes an XLSX dictionary for Aduana open-data import and export files.

Interpretation: the sampled datos.gob.cl Wayback captures do not reveal older public files with importer/exporter legal names, RUTs, or a lookup table from anonymous correlatives to legal identity. Instead, they show the official CKAN open-data packaging that matches the inspected current/historical datos.gob.cl files: monthly item-record RARs and metadata workbooks. As with the Aduana.cl Wayback check, this is not proof that no archived file exists anywhere, but it does not provide a path to public company identity.

Follow-up pilot: `docs/research/CHILE_ADUANA_IDENTITY_INFERENCE_PILOT.md` tests a manual "possible importer/exporter" workflow. It found that export identity inference is feasible for a subset of records when bulto marks and product text expose recognizable company/brand evidence, while import inference remains much weaker from the inspected public files.

Inference design: `docs/research/CHILE_ADUANA_IDENTITY_INFERENCE_SYSTEM.md` defines the recommended V1 system for possible importer/exporter identities. It keeps Aduana correlatives as anonymous source identifiers and stores possible legal/business identities in a separate evidence-backed layer with confidence score, review status, and provenance.

Implementation note: `scripts/research/chile_aduana_identity_validation.py` implements the V1 historical-bridge validation pipeline described in `docs/research/CHILE_ADUANA_HISTORICAL_IDENTITY_VALIDATION.md`. `scripts/research/chile_aduana_historical_acquisition.py` now acquires official historical datos.gob.cl resources for that validation pass without implementing production ingestion. January 2003, 2010, and 2015 import/export samples were downloaded, extracted, and manifest-preserved. They still expose anonymous importer/exporter correlatives rather than importer/exporter legal names or RUTs. The 2003 import sample has an older 157-field layout, but the inspected identity result is the same: `NUM_UNICO_IMPORTADOR`, not importer name/RUT.

### Coded Fields Needing Dictionary Or Annex 51 / Code Tables

The official dictionary confirms field names, order, descriptions, types, lengths, and precision. It does not provide all code-to-label mappings. Most coded fields below need Annex 51 or another official code table before user-facing labels should be shown.

Import coded fields to decode:

- Operation/document/customs: `TIPO_DOCTO`, `ADU`, `FORM`, `ADUCTROL`, `ADUA_RS`, `ADU_DI`.
- Geography: `CODCOMUN`, `CODCOMRS`, `CODPAISCON`, `PA_ORIG`, `PA_ADQ`, `CODPAISCIA`.
- Ports and transport: `VIA_TRAN`, `TRANSB`, `PTO_EMB`, `PTO_DESEM`, `TPO_CARGA`, `ALMACEN`.
- Payment, currency, and commercial terms: `PAGO_GRAV`, `BCO_COM`, `CODORDIV`, `FORM_PAGO`, `MONEDA`, `CL_COMPRA`, `COD_FLE`, `COD_SEG`.
- Packages and units: `TPO_BUL1` through `TPO_BUL8`, `MEDIDA`.
- Tariff/classification: `ARANC-ALA`, `ARANC-NAC`, `NUMCOR`, `NUMACU`.
- Tax/account and observations: `CTA_OTRO`, `CTA_OTR1` through `CTA_OTR7`, `ADVAL`, `CTA1` through `CTA4`, `CODOBS1` through `CODOBS4`.

Export coded fields to decode:

- Operation/customs/geography: `ADUANA`, `TIPOOPERACION`, `COMUNAEXPORTADORPPAL`, `COMUNAEXPSECUNDARIO`, `REGIONORIGEN`, `ADUANAREGSUSP`.
- Ports and countries: `PUERTOEMB`, `PUERTODESEMB`, `PAISDESTINO`, `PAISCIATRANSP`. The selected export main file includes glosa fields for embark port, disembark port, and destination country, but official code tables are still needed for reliable joins and validation.
- Transport and cargo: `TIPOCARGA`, `VIATRANSPORTE`.
- Payment, currency, and commercial terms: `MONEDA`, `MODALIDADVENTA`, `CLAUSULAVENTA`, `FORMAPAGO`, `CODIGOFLETE`, `CODIGOSEG`.
- Authorizations and cancellation documents: `CODIGOTIPOAUTORIZA`, `TIPODOCTOCANCELA`.
- Product/unit/classification: `CODIGOARANCEL`, `UNIDADMEDIDA`.
- Observations: `CODIGOOBSERVACION1`, `CODIGOOBSERVACION2`, `CODIGOOBSERVACION3`.
- Export companion files not selected for this manual pass also include coded bulto and transport-document fields, such as `TIPOBULTO`, which should be decoded when those files are inspected.

## 10. What To Inspect Manually Next

Inspect these manually before data-model design:

- **2025 imports**: complete recent year with 12 monthly RAR resources plus an XLSX metadata workbook.
- **2025 exports**: complete recent year with 12 main monthly RAR resources, 12 bultos RAR resources, 12 transport-document RAR resources, plus an XLSX metadata workbook.
- **2026 imports/exports beyond March**: monitor newly added months and confirm whether the structure remains stable.
- **Official code tables / Annex 51**: decode coded fields identified above before user-facing labels or filters are finalized.
- **Duplicate/missing dataset questions**: resolve the duplicate 2007 import datasets and the missing 2008 export dataset in CKAN discovery.
- **Resource shape for other resource roles**: inspect export bultos and transport-document files separately before modeling them.
- **Company fields**: monitor for any separate official, licensed, or request-only source that maps importer/exporter correlatives to public legal names or RUTs. None was found in the inspected public datos.gob.cl or aduana.cl resources.
- **Historical coverage expansion**: if this question remains critical, acquire more months/years around known policy or publication changes. The January 2003, 2010, and 2015 import/export samples do not expose legal importer/exporter names or RUTs.

Do not design final tables until the manual file and metadata inspection is complete.
