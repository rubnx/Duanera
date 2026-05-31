#!/usr/bin/env python3
"""Validate possible Chile Aduana importer/exporter identity inference.

This is a research-only pipeline. It inventories local official source files,
detects identity fields, builds behavioral fingerprints, and scores matches
between historical named entities and anonymous post-anonymization IDs when
both sides are available locally.

It does not download source files, mutate raw data, write to a database, or
implement production ingestion.
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import re
import sys
import unicodedata
import urllib.error
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable

from datos_gob_cl_aduana_discovery import (
    classify_flow,
    fetch_all_packages,
    package_year,
    resource_kind,
)


REPO_ROOT = Path(__file__).resolve().parents[2]
SOURCE_ROOT = REPO_ROOT / "data" / "sources" / "chile-aduana"
OUTPUT_ROOT = REPO_ROOT / "data" / "research" / "chile-aduana-identity-validation"


DIN_COLUMNS = [
    "NUMENCRIPTADO",
    "TIPO_DOCTO",
    "ADU",
    "FORM",
    "FECVENCI",
    "CODCOMUN",
    "NUM_UNICO_IMPORTADOR",
    "CODPAISCON",
    "DESDIRALM",
    "CODCOMRS",
    "ADUCTROL",
    "NUMPLAZO",
    "INDPARCIAL",
    "NUMHOJINS",
    "TOTINSUM",
    "CODALMA",
    "NUM_RS",
    "FEC_RS",
    "ADUA_RS",
    "NUMHOJANE",
    "NUM_SEC",
    "PA_ORIG",
    "PA_ADQ",
    "VIA_TRAN",
    "TRANSB",
    "PTO_EMB",
    "PTO_DESEM",
    "TPO_CARGA",
    "ALMACEN",
    "FEC_ALMAC",
    "FECRETIRO",
    "NU_REGR",
    "ANO_REG",
    "CODVISBUEN",
    "NUMREGLA",
    "NUMANORES",
    "CODULTVB",
    "PAGO_GRAV",
    "FECTRA",
    "FECACEP",
    "GNOM_CIA_T",
    "CODPAISCIA",
    "NUMRUTCIA",
    "DIGVERCIA",
    "NUM_MANIF",
    "NUM_MANIF1",
    "NUM_MANIF2",
    "FEC_MANIF",
    "NUM_CONOC",
    "FEC_CONOC",
    "NOMEMISOR",
    "NUMRUTEMI",
    "DIGVEREMI",
    "GREG_IMP",
    "REG_IMP",
    "BCO_COM",
    "CODORDIV",
    "FORM_PAGO",
    "NUMDIAS",
    "VALEXFAB",
    "MONEDA",
    "MONGASFOB",
    "CL_COMPRA",
    "TOT_ITEMS",
    "FOB",
    "TOT_HOJAS",
    "COD_FLE",
    "FLETE",
    "TOT_BULTOS",
    "COD_SEG",
    "SEGURO",
    "TOT_PESO",
    "CIF",
    "NUM_AUT",
    "FEC_AUT",
    "GBCOCEN",
    "ID_BULTOS",
    "TPO_BUL1",
    "CANT_BUL1",
    "TPO_BUL2",
    "CANT_BUL2",
    "TPO_BUL3",
    "CANT_BUL3",
    "TPO_BUL4",
    "CANT_BUL4",
    "TPO_BUL5",
    "CANT_BUL5",
    "TPO_BUL6",
    "CANT_BUL6",
    "TPO_BUL7",
    "CANT_BUL7",
    "TPO_BUL8",
    "CANT_BUL8",
    "CTA_OTRO",
    "MON_OTRO",
    "CTA_OTR1",
    "MON_OTR1",
    "CTA_OTR2",
    "MON_OTR2",
    "CTA_OTR3",
    "MON_OTR3",
    "CTA_OTR4",
    "MON_OTR4",
    "CTA_OTR5",
    "MON_OTR5",
    "CTA_OTR6",
    "MON_OTR6",
    "CTA_OTR7",
    "MON_OTR7",
    "MON_178",
    "MON_191",
    "FEC_501",
    "VAL_601",
    "FEC_502",
    "VAL_602",
    "FEC_503",
    "VAL_603",
    "FEC_504",
    "VAL_604",
    "FEC_505",
    "VAL_605",
    "FEC_506",
    "VAL_606",
    "FEC_507",
    "VAL_607",
    "TASA",
    "NCUOTAS",
    "ADU_DI",
    "NUM_DI",
    "FEC_DI",
    "MON_699",
    "MON_199",
    "NUMITEM",
    "DNOMBRE",
    "DMARCA",
    "DVARIEDAD",
    "DOTRO1",
    "DOTRO2",
    "ATR-5",
    "ATR-6",
    "SAJU-ITEM",
    "AJU-ITEM",
    "CANT-MERC",
    "MERMAS",
    "MEDIDA",
    "PRE-UNIT",
    "ARANC-ALA",
    "NUMCOR",
    "NUMACU",
    "CODOBS1",
    "DESOBS1",
    "CODOBS2",
    "DESOBS2",
    "CODOBS3",
    "DESOBS3",
    "CODOBS4",
    "DESOBS4",
    "ARANC-NAC",
    "CIF-ITEM",
    "ADVAL-ALA",
    "ADVAL",
    "VALAD",
    "OTRO1",
    "CTA1",
    "SIGVAL1",
    "VAL1",
    "OTRO2",
    "CTA2",
    "SIGVAL2",
    "VAL2",
    "OTRO3",
    "CTA3",
    "SIGVAL3",
    "VAL3",
    "OTRO4",
    "CTA4",
    "SIGVAL4",
    "VAL4",
]


DUS_COLUMNS = [
    "FECHAACEPT",
    "NUMEROIDENT",
    "ADUANA",
    "TIPOOPERACION",
    "CODIGORUTEXPORTADORPPAL",
    "NRO_EXPORTADOR",
    "PORCENTAJEEXPPPAL",
    "COMUNAEXPORTADORPPAL",
    "CODIGORUTEXPSEC",
    "NRO_EXPORTADOR_SEC",
    "PORCENTAJEEXPSECUNDARIO",
    "COMUNAEXPSECUNDARIO",
    "PUERTOEMB",
    "GLOSAPUERTOEMB",
    "REGIONORIGEN",
    "TIPOCARGA",
    "VIATRANSPORTE",
    "PUERTODESEMB",
    "GLOSAPUERTODESEMB",
    "PAISDESTINO",
    "GLOSAPAISDESTINO",
    "NOMBRECIATRANSP",
    "PAISCIATRANSP",
    "RUTCIATRANSP",
    "DVRUTCIATRANSP",
    "NOMBREEMISORDOCTRANSP",
    "RUTEMISOR",
    "DVRUTEMISOR",
    "CODIGOTIPOAUTORIZA",
    "NUMEROINFORMEEXPO",
    "DVNUMEROINFORMEEXP",
    "FECHAINFORMEEXP",
    "MONEDA",
    "MODALIDADVENTA",
    "CLAUSULAVENTA",
    "FORMAPAGO",
    "VALORCLAUSULAVENTA",
    "COMISIONESEXTERIOR",
    "OTROSGASTOS",
    "VALORLIQUIDORETORNO",
    "NUMEROREGSUSP",
    "ADUANAREGSUSP",
    "PLAZOVIGENCIAREGSUSP",
    "TOTALITEM",
    "TOTALBULTOS",
    "PESOBRUTOTOTAL",
    "TOTALVALORFOB",
    "VALORFLETE",
    "CODIGOFLETE",
    "VALORSEGURO",
    "CODIGOSEG",
    "VALORCIF",
    "NUMEROPARCIALIDAD",
    "TOTALPARCIALES",
    "PARCIAL",
    "OBSERVACION",
    "NUMERODOCTOCANCELA",
    "FECHADOCTOCANCELA",
    "TIPODOCTOCANCELA",
    "PESOBRUTOCANCELA",
    "TOTALBULTOSCANCELA",
    "NUMEROITEM",
    "NOMBRE",
    "ATRIBUTO1",
    "ATRIBUTO2",
    "ATRIBUTO3",
    "ATRIBUTO4",
    "ATRIBUTO5",
    "ATRIBUTO6",
    "CODIGOARANCEL",
    "UNIDADMEDIDA",
    "CANTIDADMERCANCIA",
    "FOBUNITARIO",
    "FOBUS",
    "CODIGOOBSERVACION1",
    "VALOROBSERVACION1",
    "GLOSAOBSERVACION1",
    "CODIGOOBSERVACION2",
    "VALOROBSERVACION2",
    "GLOSAOBSERVACION2",
    "CODIGOOBSERVACION3",
    "VALOROBSERVACION3",
    "GLOSAOBSERVACION3",
    "PESOBRUTOITEM",
]


OPERATIONAL_IMPORT_COLUMNS = [
    "PERIODO",
    "MES",
    "COD_ADUANA_TRAMITACION",
    "COD_TIPO_OPERACION",
    "COD_COMUNA_IMPORTADOR",
    "COD_PAIS_ORIGEN",
    "COD_PAIS_ADQUISICION",
    "COD_VIA_TRANSPORTE",
    "COD_PUERTO_EMBARQUE",
    "COD_PUERTO_DESEMBARQUE",
    "COD_UNIDAD_MEDIDA",
    "ITEM_SA",
    "CIF_ITEM",
    "FOB_ITEM",
    "PESO_BRUTO_KG",
    "CANTIDAD_MERCANCIA",
]


OPERATIONAL_EXPORT_COLUMNS = [
    "PERIODO",
    "MES",
    "COD_ADUANA_TRAMITACION",
    "COD_TIPO_OPERACION",
    "COD_REGION_ORIGEN",
    "COD_VIA_TRANSPORTE",
    "COD_PUERTO_EMBARQUE",
    "COD_PUERTO_DESEMBARQUE",
    "COD_PAIS_DESTINO",
    "COD_MODALIDAD_VENTA",
    "MONEDA",
    "CLAUSULA_VENTA",
    "COD_TIPO_CARGA",
    "ITEM_SA",
    "FOB_US_DUSLEG",
    "FOBUS_AJUSTADO_IVV",
    "PESO_BRUTO_KG",
    "CANTIDAD_MERCANCIA",
    "COD_UNIDAD_MEDIDA",
]


STOP_MARKS = {
    "",
    "0",
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "ROT",
    "ROT.",
    "ROTUL",
    "ROTUL.",
    "ROTULADO",
    "ROTULADO.",
    "S/M",
    "S/N",
    "SIN MARCA",
}


@dataclass
class SourceFile:
    inventory_status: str
    source_domain: str
    source_page_url: str
    resource_download_url: str
    country: str
    trade_flow: str
    source_category: str
    year: str
    month: str
    period: str
    raw_path: str
    working_paths: list[str]
    file_format: str
    notes: str


@dataclass
class FieldAvailability:
    source_file: SourceFile
    identity_mode: str
    field_count: int
    has_header: bool
    named_identity_fields: list[str] = field(default_factory=list)
    rut_identity_fields: list[str] = field(default_factory=list)
    anonymous_identity_fields: list[str] = field(default_factory=list)
    evidence_fields: list[str] = field(default_factory=list)
    detected_columns: list[str] = field(default_factory=list)


@dataclass
class Fingerprint:
    flow: str
    entity_kind: str
    entity_id: str
    source_identity_type: str
    source_names: Counter[str] = field(default_factory=Counter)
    source_ruts: Counter[str] = field(default_factory=Counter)
    years: Counter[str] = field(default_factory=Counter)
    periods: Counter[str] = field(default_factory=Counter)
    declarations: set[str] = field(default_factory=set)
    row_count: int = 0
    value_usd: float = 0.0
    hs_codes: Counter[str] = field(default_factory=Counter)
    product_terms: Counter[str] = field(default_factory=Counter)
    countries: Counter[str] = field(default_factory=Counter)
    ports: Counter[str] = field(default_factory=Counter)
    geography: Counter[str] = field(default_factory=Counter)
    bulto_marks: Counter[str] = field(default_factory=Counter)
    carriers: Counter[str] = field(default_factory=Counter)
    emitters: Counter[str] = field(default_factory=Counter)

    def add_record(
        self,
        *,
        year: str,
        period: str,
        declaration: str,
        value: float,
        hs_code: str,
        product_text: str,
        country: str,
        port: str,
        geography: str,
        carrier: str,
        emitter: str,
        source_name: str = "",
        source_rut: str = "",
    ) -> None:
        self.row_count += 1
        self.value_usd += value
        if year:
            self.years[year] += 1
        if period:
            self.periods[period] += 1
        if declaration:
            self.declarations.add(declaration)
        add_counter(self.hs_codes, hs_code)
        add_terms(self.product_terms, product_text)
        add_counter(self.countries, country)
        add_counter(self.ports, port)
        add_counter(self.geography, geography)
        add_counter(self.carriers, carrier)
        add_counter(self.emitters, emitter)
        add_counter(self.source_names, source_name)
        add_counter(self.source_ruts, source_rut)

    def add_bulto_mark(self, mark: str) -> None:
        cleaned = clean_text(mark)
        if cleaned.upper() in STOP_MARKS:
            return
        if len(cleaned) < 3:
            return
        self.bulto_marks[cleaned[:120]] += 1


def strip_accents(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    return "".join(char for char in normalized if not unicodedata.combining(char))


def clean_text(value: str | None) -> str:
    if value is None:
        return ""
    text = strip_accents(str(value).replace("~", " ").replace("\x00", " "))
    return " ".join(text.split()).strip()


def norm_field(value: str) -> str:
    return re.sub(r"[^A-Z0-9]+", "_", strip_accents(value).upper()).strip("_")


def parse_number(value: str | None) -> float:
    if not value:
        return 0.0
    text = str(value).strip()
    if not text:
        return 0.0
    try:
        return float(text.replace(".", "").replace(",", "."))
    except ValueError:
        return 0.0


def add_counter(counter: Counter[str], value: str | None) -> None:
    cleaned = clean_text(value)
    if cleaned:
        counter[cleaned] += 1


def add_terms(counter: Counter[str], value: str | None) -> None:
    cleaned = clean_text(value).upper()
    if not cleaned:
        return
    chunks = re.split(r"[^A-Z0-9]+", cleaned)
    for chunk in chunks:
        if len(chunk) >= 4 and not chunk.isdigit():
            counter[chunk] += 1


def split_manifest_paths(value: str) -> list[str]:
    return [item for item in (value or "").split("|") if item]


def read_source_files(source_root: Path) -> list[SourceFile]:
    files: list[SourceFile] = []
    for manifest_path in sorted(source_root.glob("*/manifests/*.csv")):
        with manifest_path.open(newline="", encoding="utf-8") as handle:
            reader = csv.DictReader(handle)
            for row in reader:
                files.append(
                    SourceFile(
                        inventory_status="local_preserved",
                        source_domain=row.get("source_domain", ""),
                        source_page_url=row.get("source_page_url", ""),
                        resource_download_url=row.get("resource_download_url", ""),
                        country=row.get("country", ""),
                        trade_flow=row.get("trade_flow", ""),
                        source_category=row.get("source_category", ""),
                        year=row.get("year", ""),
                        month=row.get("month", ""),
                        period=row.get("period", ""),
                        raw_path=row.get("raw_path", ""),
                        working_paths=split_manifest_paths(row.get("working_paths", "")),
                        file_format=row.get("working_file_formats", "") or row.get("raw_file_format", ""),
                        notes=row.get("notes", ""),
                    )
                )
    return files


def ckan_source_files(allow_insecure_tls: bool) -> list[SourceFile]:
    try:
        packages = fetch_all_packages(rows=100, allow_insecure_tls=allow_insecure_tls)
    except (urllib.error.URLError, RuntimeError) as error:
        print(f"WARNING: CKAN inventory failed: {error}", file=sys.stderr)
        return []

    files: list[SourceFile] = []
    for package in packages:
        flow = classify_flow(package)
        year = package_year(package)
        source_page_url = f"https://datos.gob.cl/dataset/{package.get('name')}"
        for resource in package.get("resources", []):
            files.append(
                SourceFile(
                    inventory_status="ckan_available",
                    source_domain="datos.gob.cl",
                    source_page_url=source_page_url,
                    resource_download_url=resource.get("url") or "",
                    country="CL",
                    trade_flow=flow,
                    source_category=resource_kind(resource),
                    year=str(year or ""),
                    month="",
                    period=str(year or ""),
                    raw_path="",
                    working_paths=[],
                    file_format=(resource.get("format") or "").lower(),
                    notes=f"CKAN resource: {resource.get('name') or ''}",
                )
            )
    return files


def local_path(path_text: str) -> Path:
    path = Path(path_text)
    if path.is_absolute():
        return path
    return REPO_ROOT / path


def observed_delimited_field_count(path: Path) -> int:
    with path.open(encoding="latin-1", errors="replace", newline="") as handle:
        sample = handle.readline().rstrip("\n\r")
    if not sample:
        return 0
    delimiter = ";" if sample.count(";") >= sample.count(",") else ","
    return len(next(csv.reader([sample], delimiter=delimiter)))


def adjust_columns_to_observed_count(columns: list[str], path: Path) -> list[str]:
    observed = observed_delimited_field_count(path)
    if observed == 0 or observed == len(columns):
        return columns
    if observed < len(columns):
        return columns[:observed]
    return columns + [f"UNMAPPED_FIELD_{index}" for index in range(len(columns) + 1, observed + 1)]


def infer_columns(source_file: SourceFile, path: Path) -> tuple[list[str], bool]:
    name = path.name.lower()
    if name.endswith(".txt") and "imports" in name and "_bultos" not in name:
        return adjust_columns_to_observed_count(DIN_COLUMNS, path), False
    if name.endswith(".txt") and "exports" in name and "_bultos" not in name and "transport" not in name:
        return adjust_columns_to_observed_count(DUS_COLUMNS, path), False
    if name.endswith("_bultos.txt"):
        return ["NUMEROIDENT", "FECHAACEPT", "NUMEROBULTO", "TIPOBULTO", "CANTIDADBULTO", "IDENTIFICACIONBULTO"], False
    if name.endswith("_transport_docs.txt"):
        return ["NUMEROIDENT", "FECHAACEPT", "NSECDOCTRANSP", "NUMERODOCTRANSP", "FECHADOCTRANSP", "NOMBRENAVE", "NUMEROVIAJE"], False
    if name.endswith(".csv"):
        with path.open(encoding="latin-1", errors="replace", newline="") as handle:
            sample = handle.readline().strip()
        delimiter = ";" if sample.count(";") >= sample.count(",") else ","
        header = next(csv.reader([sample], delimiter=delimiter))
        normalized_header = [norm_field(col) for col in header]
        if "PERIODO" in normalized_header and "ITEM_SA" in normalized_header:
            if "COD_PAIS_DESTINO" in normalized_header:
                return OPERATIONAL_EXPORT_COLUMNS, True
            return OPERATIONAL_IMPORT_COLUMNS, True
        return normalized_header, True
    return [], False


def classify_identity_fields(columns: list[str]) -> tuple[list[str], list[str], list[str], list[str], str]:
    normalized = [norm_field(col) for col in columns]
    anonymous = [
        col
        for col in normalized
        if col in {"NUM_UNICO_IMPORTADOR", "NRO_EXPORTADOR", "NRO_EXPORTADOR_SEC"}
    ]
    named: list[str] = []
    ruts: list[str] = []
    evidence: list[str] = []
    for col in normalized:
        is_transport_or_doc_party = any(
            token in col
            for token in [
                "CIA_TRANSP",
                "TRANSPORT",
                "TRANSPORTE",
                "EMISOR",
                "EMI",
                "NAVE",
                "CARRIER",
            ]
        )
        if is_transport_or_doc_party:
            if any(token in col for token in ["NOMBRE", "RUT", "CIA", "EMISOR"]):
                evidence.append(col)
            continue
        mentions_trade_party = "IMPORTADOR" in col or "EXPORTADOR" in col or "CONSIGNATARIO" in col
        if mentions_trade_party and any(token in col for token in ["NOMBRE", "RAZON", "RAZON_SOCIAL"]):
            named.append(col)
        if mentions_trade_party and "RUT" in col and col not in {"CODIGORUTEXPORTADORPPAL", "CODIGORUTEXPSEC"}:
            ruts.append(col)
    if named or ruts:
        mode = "named"
    elif anonymous:
        mode = "anonymous"
    else:
        mode = "none"
    return named, ruts, anonymous, sorted(set(evidence)), mode


def detect_field_availability(source_files: list[SourceFile]) -> list[FieldAvailability]:
    results: list[FieldAvailability] = []
    seen_working_paths: set[str] = set()
    for source_file in source_files:
        for working_path in source_file.working_paths:
            path = local_path(working_path)
            path_key = str(path)
            if path_key in seen_working_paths:
                continue
            if not path.exists() or path.suffix.lower() not in {".txt", ".csv"}:
                continue
            seen_working_paths.add(path_key)
            columns, has_header = infer_columns(source_file, path)
            if not columns:
                continue
            named, ruts, anonymous, evidence, mode = classify_identity_fields(columns)
            results.append(
                FieldAvailability(
                    source_file=source_file,
                    identity_mode=mode,
                    field_count=len(columns),
                    has_header=has_header,
                    named_identity_fields=named,
                    rut_identity_fields=ruts,
                    anonymous_identity_fields=anonymous,
                    evidence_fields=evidence,
                    detected_columns=columns,
                )
            )
    return results


def detect_delimiter(path: Path) -> str:
    with path.open(encoding="latin-1", errors="replace", newline="") as handle:
        sample = handle.readline()
    return ";" if sample.count(";") >= sample.count(",") else ","


def iter_records(
    path: Path,
    columns: list[str],
    has_header: bool,
    max_rows: int | None = None,
) -> Iterable[dict[str, str]]:
    delimiter = detect_delimiter(path)
    with path.open(encoding="latin-1", errors="replace", newline="") as handle:
        reader = csv.reader(handle, delimiter=delimiter)
        if has_header:
            header = next(reader, [])
            source_columns = [norm_field(col) for col in header]
        else:
            source_columns = columns
        for row_number, row in enumerate(reader, start=1):
            if max_rows is not None and row_number > max_rows:
                break
            if not row:
                continue
            if len(row) < len(source_columns):
                row = row + [""] * (len(source_columns) - len(row))
            yield dict(zip(source_columns, row))


def first_value(row: dict[str, str], names: list[str]) -> str:
    for name in names:
        value = row.get(norm_field(name), "")
        if value:
            return value
    return ""


def fingerprint_key(flow: str, identity_type: str, entity_id: str) -> str:
    return f"{flow}:{identity_type}:{entity_id}"


def get_fingerprint(
    fingerprints: dict[str, Fingerprint],
    *,
    flow: str,
    entity_kind: str,
    entity_id: str,
    source_identity_type: str,
) -> Fingerprint:
    key = fingerprint_key(flow, source_identity_type, entity_id)
    if key not in fingerprints:
        fingerprints[key] = Fingerprint(
            flow=flow,
            entity_kind=entity_kind,
            entity_id=entity_id,
            source_identity_type=source_identity_type,
        )
    return fingerprints[key]


def build_fingerprints(
    availability: list[FieldAvailability],
    max_rows_per_file: int | None,
) -> tuple[dict[str, Fingerprint], dict[str, Fingerprint]]:
    historical: dict[str, Fingerprint] = {}
    anonymous: dict[str, Fingerprint] = {}
    export_decl_to_entity: dict[str, str] = {}
    bulto_files: list[tuple[FieldAvailability, Path]] = []
    seen_working_paths: set[str] = set()

    for item in availability:
        source = item.source_file
        for working_path in source.working_paths:
            path = local_path(working_path)
            path_key = str(path)
            if path_key in seen_working_paths:
                continue
            if not path.exists() or path.suffix.lower() not in {".txt", ".csv"}:
                continue
            seen_working_paths.add(path_key)
            columns, has_header = infer_columns(source, path)
            lower_name = path.name.lower()
            if lower_name.endswith("_bultos.txt"):
                bulto_files.append((item, path))
                continue
            if "transport_docs" in lower_name:
                continue
            if item.identity_mode not in {"named", "anonymous"}:
                continue

            for row in iter_records(path, columns, has_header, max_rows_per_file):
                flow = source.trade_flow or ("export" if "export" in lower_name else "import")
                year = source.year or first_value(row, ["PERIODO"])[:4]
                period = source.period or "-".join(
                    part for part in [first_value(row, ["PERIODO"])[:4], first_value(row, ["MES"]).zfill(2)] if part
                )
                if flow == "export":
                    declaration = first_value(row, ["NUMEROIDENT"])
                    entity_id = first_value(row, ["NRO_EXPORTADOR"])
                    value = parse_number(first_value(row, ["FOBUS", "FOB_US_DUSLEG", "FOBUS_AJUSTADO_IVV"]))
                    hs_code = first_value(row, ["CODIGOARANCEL", "ITEM_SA"])
                    product = " ".join(
                        clean_text(first_value(row, [col]))
                        for col in ["NOMBRE", "ATRIBUTO1", "ATRIBUTO2", "ATRIBUTO3", "ATRIBUTO4"]
                    )
                    country = first_value(row, ["GLOSAPAISDESTINO", "PAISDESTINO", "COD_PAIS_DESTINO"])
                    port = first_value(row, ["GLOSAPUERTOEMB", "PUERTOEMB", "COD_PUERTO_EMBARQUE"])
                    geography = first_value(row, ["COMUNAEXPORTADORPPAL", "COD_REGION_ORIGEN", "REGIONORIGEN"])
                    carrier = first_value(row, ["NOMBRECIATRANSP"])
                    emitter = first_value(row, ["NOMBREEMISORDOCTRANSP"])
                    entity_kind = "exporter"
                    if item.identity_mode == "anonymous" and declaration and entity_id:
                        export_decl_to_entity[declaration] = fingerprint_key(flow, "anonymous", entity_id)
                else:
                    declaration = first_value(row, ["NUMENCRIPTADO"])
                    entity_id = first_value(row, ["NUM_UNICO_IMPORTADOR"])
                    value = parse_number(first_value(row, ["CIF-ITEM", "CIF_ITEM", "CIF"]))
                    hs_code = first_value(row, ["ARANC-NAC", "ITEM_SA"])
                    product = " ".join(
                        clean_text(first_value(row, [col]))
                        for col in ["DNOMBRE", "DMARCA", "DVARIEDAD", "DOTRO1", "DOTRO2"]
                    )
                    country = first_value(row, ["PA_ORIG", "COD_PAIS_ORIGEN"])
                    port = first_value(row, ["PTO_DESEM", "COD_PUERTO_DESEMBARQUE"])
                    geography = first_value(row, ["CODCOMUN", "COD_COMUNA_IMPORTADOR"])
                    carrier = first_value(row, ["GNOM_CIA_T"])
                    emitter = first_value(row, ["NOMEMISOR"])
                    entity_kind = "importer"

                source_name = first_value(row, item.named_identity_fields)
                source_rut = first_value(row, item.rut_identity_fields)
                if item.identity_mode == "named":
                    identity = clean_text(source_rut) or clean_text(source_name)
                    if not identity:
                        continue
                    fp = get_fingerprint(
                        historical,
                        flow=flow,
                        entity_kind=entity_kind,
                        entity_id=identity,
                        source_identity_type="named",
                    )
                else:
                    if not entity_id:
                        continue
                    fp = get_fingerprint(
                        anonymous,
                        flow=flow,
                        entity_kind=entity_kind,
                        entity_id=entity_id,
                        source_identity_type="anonymous",
                    )
                fp.add_record(
                    year=year,
                    period=period,
                    declaration=declaration,
                    value=value,
                    hs_code=hs_code,
                    product_text=product,
                    country=country,
                    port=port,
                    geography=geography,
                    carrier=carrier,
                    emitter=emitter,
                    source_name=source_name,
                    source_rut=source_rut,
                )

    for _item, path in bulto_files:
        for row in iter_records(
            path,
            ["NUMEROIDENT", "FECHAACEPT", "NUMEROBULTO", "TIPOBULTO", "CANTIDADBULTO", "IDENTIFICACIONBULTO"],
            False,
            max_rows_per_file,
        ):
            key = export_decl_to_entity.get(row.get("NUMEROIDENT", ""))
            if key and key in anonymous:
                anonymous[key].add_bulto_mark(row.get("IDENTIFICACIONBULTO", ""))

    return historical, anonymous


def top_keys(counter: Counter[str], limit: int = 20) -> set[str]:
    return {key for key, _count in counter.most_common(limit)}


def jaccard(left: set[str], right: set[str]) -> float:
    if not left or not right:
        return 0.0
    return len(left & right) / len(left | right)


def score_pair(named: Fingerprint, anon: Fingerprint) -> tuple[float, str]:
    hs = jaccard(top_keys(named.hs_codes, 20), top_keys(anon.hs_codes, 20))
    products = jaccard(top_keys(named.product_terms, 40), top_keys(anon.product_terms, 40))
    countries = jaccard(top_keys(named.countries, 15), top_keys(anon.countries, 15))
    ports = jaccard(top_keys(named.ports, 15), top_keys(anon.ports, 15))
    geography = jaccard(top_keys(named.geography, 10), top_keys(anon.geography, 10))
    bultos = jaccard(top_keys(named.bulto_marks, 20), top_keys(anon.bulto_marks, 20))
    logistics = max(
        jaccard(top_keys(named.carriers, 10), top_keys(anon.carriers, 10)),
        jaccard(top_keys(named.emitters, 10), top_keys(anon.emitters, 10)),
    )
    score = (
        0.30 * hs
        + 0.25 * products
        + 0.15 * countries
        + 0.10 * ports
        + 0.10 * geography
        + 0.07 * bultos
        + 0.03 * logistics
    )
    if min(named.row_count, anon.row_count) < 10:
        score *= 0.75
    if hs == 0 and products < 0.10:
        score *= 0.50
    reasons = [
        f"hs={hs:.2f}",
        f"product_terms={products:.2f}",
        f"countries={countries:.2f}",
        f"ports={ports:.2f}",
        f"geography={geography:.2f}",
        f"bultos={bultos:.2f}",
        f"logistics_weak={logistics:.2f}",
    ]
    return round(score, 4), "; ".join(reasons)


def confidence_band(score: float) -> str:
    if score >= 0.70:
        return "alta"
    if score >= 0.45:
        return "media"
    if score > 0:
        return "baja"
    return "sin_match"


def generate_candidate_matches(
    historical: dict[str, Fingerprint],
    anonymous: dict[str, Fingerprint],
    limit_per_anonymous: int,
) -> list[dict[str, str]]:
    by_flow: dict[str, list[Fingerprint]] = defaultdict(list)
    for fp in historical.values():
        by_flow[fp.flow].append(fp)

    rows: list[dict[str, str]] = []
    for anon in anonymous.values():
        scored: list[tuple[float, str, Fingerprint]] = []
        for named in by_flow.get(anon.flow, []):
            score, reason = score_pair(named, anon)
            if score > 0:
                scored.append((score, reason, named))
        scored.sort(key=lambda item: item[0], reverse=True)
        for score, reason, named in scored[:limit_per_anonymous]:
            rows.append(
                {
                    "flow": anon.flow,
                    "anonymous_id": anon.entity_id,
                    "anonymous_kind": anon.entity_kind,
                    "candidate_identity": named.entity_id,
                    "candidate_names": top_counter_text(named.source_names),
                    "candidate_ruts": top_counter_text(named.source_ruts),
                    "confidence_score": f"{score:.4f}",
                    "confidence_band": confidence_band(score),
                    "evidence_summary": reason,
                    "anonymous_rows": str(anon.row_count),
                    "anonymous_declarations": str(len(anon.declarations)),
                    "anonymous_value_usd": f"{anon.value_usd:.2f}",
                    "candidate_rows": str(named.row_count),
                    "candidate_declarations": str(len(named.declarations)),
                    "candidate_value_usd": f"{named.value_usd:.2f}",
                }
            )
    rows.sort(key=lambda row: (row["flow"], row["anonymous_id"], -float(row["confidence_score"])))
    return rows


def top_counter_text(counter: Counter[str], limit: int = 8) -> str:
    return " | ".join(f"{key}:{count}" for key, count in counter.most_common(limit))


def fingerprint_rows(fingerprints: dict[str, Fingerprint]) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for fp in sorted(fingerprints.values(), key=lambda item: (item.flow, item.entity_kind, item.entity_id)):
        rows.append(
            {
                "flow": fp.flow,
                "entity_kind": fp.entity_kind,
                "entity_id": fp.entity_id,
                "source_identity_type": fp.source_identity_type,
                "source_names": top_counter_text(fp.source_names),
                "source_ruts": top_counter_text(fp.source_ruts),
                "years": top_counter_text(fp.years),
                "periods": top_counter_text(fp.periods),
                "row_count": str(fp.row_count),
                "declaration_count": str(len(fp.declarations)),
                "value_usd": f"{fp.value_usd:.2f}",
                "top_hs_codes": top_counter_text(fp.hs_codes),
                "top_product_terms": top_counter_text(fp.product_terms, 12),
                "top_countries": top_counter_text(fp.countries),
                "top_ports": top_counter_text(fp.ports),
                "top_geography": top_counter_text(fp.geography),
                "top_bulto_marks": top_counter_text(fp.bulto_marks),
                "top_carriers": top_counter_text(fp.carriers),
                "top_emitters": top_counter_text(fp.emitters),
            }
        )
    return rows


def write_csv(path: Path, rows: list[dict[str, str]], fieldnames: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow({field: row.get(field, "") for field in fieldnames})


def write_json(path: Path, payload: dict[str, object]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def source_inventory_rows(source_files: list[SourceFile]) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for source in source_files:
        rows.append(
            {
                "inventory_status": source.inventory_status,
                "source_domain": source.source_domain,
                "source_page_url": source.source_page_url,
                "resource_download_url": source.resource_download_url,
                "country": source.country,
                "trade_flow": source.trade_flow,
                "source_category": source.source_category,
                "year": source.year,
                "month": source.month,
                "period": source.period,
                "raw_path": source.raw_path,
                "working_paths": "|".join(source.working_paths),
                "file_format": source.file_format,
                "notes": source.notes,
            }
        )
    return rows


def field_availability_rows(availability: list[FieldAvailability]) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for item in availability:
        source = item.source_file
        rows.append(
            {
                "source_domain": source.source_domain,
                "trade_flow": source.trade_flow,
                "source_category": source.source_category,
                "year": source.year,
                "month": source.month,
                "period": source.period,
                "working_paths": "|".join(source.working_paths),
                "identity_mode": item.identity_mode,
                "has_header": "yes" if item.has_header else "no",
                "field_count": str(item.field_count),
                "named_identity_fields": "|".join(item.named_identity_fields),
                "rut_identity_fields": "|".join(item.rut_identity_fields),
                "anonymous_identity_fields": "|".join(item.anonymous_identity_fields),
                "evidence_fields_not_identity": "|".join(item.evidence_fields),
            }
        )
    return rows


def review_sample_rows(matches: list[dict[str, str]], sample_size: int) -> list[dict[str, str]]:
    selected = sorted(matches, key=lambda row: float(row["confidence_score"]), reverse=True)[:sample_size]
    rows: list[dict[str, str]] = []
    for row in selected:
        review = dict(row)
        review.update(
            {
                "review_status": "unreviewed",
                "reviewed_identity_correct": "",
                "reviewer_notes": "",
            }
        )
        rows.append(review)
    return rows


def validation_result_rows(review_rows: list[dict[str, str]]) -> list[dict[str, str]]:
    totals: dict[str, dict[str, int]] = defaultdict(lambda: {"reviewed": 0, "correct": 0})
    for row in review_rows:
        status = row.get("review_status", "")
        if status == "unreviewed":
            continue
        band = row.get("confidence_band", "")
        totals[band]["reviewed"] += 1
        if row.get("reviewed_identity_correct", "").lower() in {"yes", "true", "1"}:
            totals[band]["correct"] += 1
    rows: list[dict[str, str]] = []
    for band in ["alta", "media", "baja"]:
        reviewed = totals[band]["reviewed"]
        correct = totals[band]["correct"]
        precision = correct / reviewed if reviewed else math.nan
        rows.append(
            {
                "confidence_band": band,
                "reviewed_count": str(reviewed),
                "correct_count": str(correct),
                "precision": "" if math.isnan(precision) else f"{precision:.4f}",
                "precision_target": "0.8000" if band == "alta" else "",
                "status": "needs_manual_review" if reviewed == 0 else ("pass" if band != "alta" or precision >= 0.8 else "fail"),
            }
        )
    return rows


def run(args: argparse.Namespace) -> int:
    source_files = read_source_files(args.source_root)
    if args.include_ckan:
        source_files.extend(ckan_source_files(args.allow_insecure_tls))
    availability = detect_field_availability(source_files)
    historical, anonymous = build_fingerprints(availability, args.max_rows_per_file)
    matches = generate_candidate_matches(historical, anonymous, args.limit_per_anonymous)
    review_rows = review_sample_rows(matches, args.review_sample_size)
    validation_rows = validation_result_rows(review_rows)

    output_root = args.output_root
    output_root.mkdir(parents=True, exist_ok=True)

    write_csv(
        output_root / "source_inventory.csv",
        source_inventory_rows(source_files),
        [
            "inventory_status",
            "source_domain",
            "source_page_url",
            "resource_download_url",
            "country",
            "trade_flow",
            "source_category",
            "year",
            "month",
            "period",
            "raw_path",
            "working_paths",
            "file_format",
            "notes",
        ],
    )
    write_csv(
        output_root / "field_availability_by_year.csv",
        field_availability_rows(availability),
        [
            "source_domain",
            "trade_flow",
            "source_category",
            "year",
            "month",
            "period",
            "working_paths",
            "identity_mode",
            "has_header",
            "field_count",
            "named_identity_fields",
            "rut_identity_fields",
            "anonymous_identity_fields",
            "evidence_fields_not_identity",
        ],
    )
    fingerprint_fieldnames = [
        "flow",
        "entity_kind",
        "entity_id",
        "source_identity_type",
        "source_names",
        "source_ruts",
        "years",
        "periods",
        "row_count",
        "declaration_count",
        "value_usd",
        "top_hs_codes",
        "top_product_terms",
        "top_countries",
        "top_ports",
        "top_geography",
        "top_bulto_marks",
        "top_carriers",
        "top_emitters",
    ]
    write_csv(output_root / "historical_company_fingerprints.csv", fingerprint_rows(historical), fingerprint_fieldnames)
    write_csv(output_root / "anonymous_id_fingerprints.csv", fingerprint_rows(anonymous), fingerprint_fieldnames)
    match_fields = [
        "flow",
        "anonymous_id",
        "anonymous_kind",
        "candidate_identity",
        "candidate_names",
        "candidate_ruts",
        "confidence_score",
        "confidence_band",
        "evidence_summary",
        "anonymous_rows",
        "anonymous_declarations",
        "anonymous_value_usd",
        "candidate_rows",
        "candidate_declarations",
        "candidate_value_usd",
    ]
    write_csv(output_root / "candidate_matches.csv", matches, match_fields)
    write_csv(
        output_root / "review_sample.csv",
        review_rows,
        match_fields + ["review_status", "reviewed_identity_correct", "reviewer_notes"],
    )
    write_csv(
        output_root / "validation_results.csv",
        validation_rows,
        ["confidence_band", "reviewed_count", "correct_count", "precision", "precision_target", "status"],
    )
    write_json(
        output_root / "run_summary.json",
        {
            "source_file_count": len(source_files),
            "field_availability_rows": len(availability),
            "historical_fingerprint_count": len(historical),
            "anonymous_fingerprint_count": len(anonymous),
            "candidate_match_count": len(matches),
            "review_sample_count": len(review_rows),
            "note": (
                "Candidate matches require historical named files. If historical_fingerprint_count is zero, "
                "add pre-anonymization Aduana files with legal names/RUTs and rerun."
            ),
            "max_rows_per_file": args.max_rows_per_file,
        },
    )

    print(f"Wrote research outputs to {output_root}")
    print(f"Sources: {len(source_files)}")
    print(f"Field availability rows: {len(availability)}")
    print(f"Historical named fingerprints: {len(historical)}")
    print(f"Anonymous fingerprints: {len(anonymous)}")
    print(f"Candidate matches: {len(matches)}")
    if not historical:
        print("No local historical named fingerprints found; candidate_matches.csv is expected to be empty.")
    return 0


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-root", type=Path, default=SOURCE_ROOT)
    parser.add_argument("--output-root", type=Path, default=OUTPUT_ROOT)
    parser.add_argument("--limit-per-anonymous", type=int, default=3)
    parser.add_argument("--review-sample-size", type=int, default=200)
    parser.add_argument(
        "--max-rows-per-file",
        type=int,
        default=None,
        help="Optional research/testing cap. Omit for a full scan.",
    )
    parser.add_argument(
        "--include-ckan",
        action="store_true",
        help="Include datos.gob.cl CKAN package/resource inventory without downloading resources.",
    )
    parser.add_argument(
        "--allow-insecure-tls",
        action="store_true",
        help="Allow unverified TLS for CKAN discovery if the local Python CA store is incomplete.",
    )
    return parser.parse_args(argv)


if __name__ == "__main__":
    raise SystemExit(run(parse_args(sys.argv[1:])))
