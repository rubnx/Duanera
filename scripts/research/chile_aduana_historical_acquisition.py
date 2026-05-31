#!/usr/bin/env python3
"""Acquire historical Chile Aduana files for identity validation.

This research helper downloads official datos.gob.cl resources already listed
in the identity-validation source inventory. It preserves raw files, extracts
working text files, and writes a historical source manifest.

It is not a production ingestion pipeline.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import re
import shutil
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
INVENTORY_PATH = REPO_ROOT / "data" / "research" / "chile-aduana-identity-validation" / "source_inventory.csv"
SOURCE_ROOT = REPO_ROOT / "data" / "sources" / "chile-aduana" / "datos-gob-cl"
MANIFEST_PATH = SOURCE_ROOT / "manifests" / "cl_aduana_datos_gob_cl_historical_source_files_manifest.csv"

MONTH_TOKENS = {
    "01": ["enero", "ene"],
    "02": ["febrero", "feb"],
    "03": ["marzo", "mar"],
    "04": ["abril", "abr"],
    "05": ["mayo", "may"],
    "06": ["junio", "jun"],
    "07": ["julio", "jul"],
    "08": ["agosto", "ago"],
    "09": ["septiembre", "sep"],
    "10": ["octubre", "oct"],
    "11": ["noviembre", "nov"],
    "12": ["diciembre", "dic"],
}

MANIFEST_FIELDS = [
    "source_domain",
    "source_page_url",
    "resource_download_url",
    "country",
    "trade_flow",
    "source_category",
    "year",
    "month",
    "period",
    "original_filename",
    "normalized_raw_filename",
    "raw_path",
    "raw_file_role",
    "raw_file_format",
    "raw_file_size",
    "raw_checksum_sha256",
    "requires_extraction",
    "original_child_filenames",
    "normalized_working_filenames",
    "working_paths",
    "working_file_formats",
    "working_file_sizes",
    "working_checksum_sha256",
    "downloaded_at",
    "notes",
]


@dataclass(frozen=True)
class Resource:
    source_domain: str
    source_page_url: str
    resource_download_url: str
    country: str
    trade_flow: str
    source_category: str
    year: str
    month: str
    period: str
    original_filename: str
    normalized_raw_filename: str
    raw_path: Path
    raw_file_role: str
    raw_file_format: str
    normalized_working_filename: str
    working_path: Path
    notes: str


def relative(path: Path) -> str:
    return str(path.relative_to(REPO_ROOT))


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_inventory(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        raise FileNotFoundError(f"Missing source inventory: {path}. Run identity validation with --include-ckan first.")
    with path.open(newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def read_manifest(path: Path) -> dict[str, dict[str, str]]:
    if not path.exists():
        return {}
    with path.open(newline="", encoding="utf-8") as handle:
        return {row["raw_path"]: row for row in csv.DictReader(handle)}


def write_manifest(path: Path, rows: list[dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    rows = sorted(rows, key=lambda row: (row["year"], row["month"], row["trade_flow"], row["source_category"], row["normalized_raw_filename"]))
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=MANIFEST_FIELDS)
        writer.writeheader()
        writer.writerows(rows)


def token_matches_month(text: str, month: str) -> bool:
    normalized = text.lower()
    tokens = MONTH_TOKENS[month]
    return any(re.search(rf"(^|[^a-z]){re.escape(token)}([^a-z]|$)", normalized) for token in tokens)


def original_filename(url: str) -> str:
    return url.rstrip("/").split("/")[-1]


def resource_part_number(row: dict[str, str]) -> int | None:
    text = f"{row.get('notes', '')} {row.get('resource_download_url', '')}".lower()
    match = re.search(r"part0?(\d+)", text)
    if match:
        return int(match.group(1))
    match = re.search(r"(\d+)\s*/\s*(\d+)", text)
    if match:
        return int(match.group(1))
    return None


def expected_import_part_count(rows: list[dict[str, str]]) -> int | None:
    counts: set[int] = set()
    for row in rows:
        match = re.search(r"(\d+)\s*/\s*(\d+)", row.get("notes", ""))
        if match:
            counts.add(int(match.group(2)))
    if not counts:
        return None
    if len(counts) != 1:
        raise RuntimeError(f"Conflicting multipart counts found: {sorted(counts)}")
    return counts.pop()


def select_inventory_rows(inventory: list[dict[str, str]], flow: str, year: str, month: str) -> list[dict[str, str]]:
    selected = []
    for row in inventory:
        if row.get("inventory_status") != "ckan_available":
            continue
        if row.get("source_domain") != "datos.gob.cl":
            continue
        if row.get("trade_flow") != flow:
            continue
        if row.get("year") != year:
            continue
        if not token_matches_month(f"{row.get('notes', '')} {row.get('resource_download_url', '')}", month):
            continue
        category = row.get("source_category")
        if flow == "export" and category in {"main_data", "bultos", "transport_docs"}:
            selected.append(row)
        if flow == "import" and category == "main_data":
            selected.append(row)

    if flow == "export":
        categories = {row["source_category"] for row in selected}
        required = {"main_data", "bultos", "transport_docs"}
        missing = sorted(required - categories)
        if missing:
            raise RuntimeError(f"Missing export resource categories for {year}-{month}: {missing}")
        selected.sort(key=lambda row: ["main_data", "bultos", "transport_docs"].index(row["source_category"]))
    else:
        expected = expected_import_part_count(selected)
        parts = {resource_part_number(row) for row in selected}
        if expected is None and len(selected) == 1 and None in parts:
            return selected
        if expected is None:
            raise RuntimeError(f"Could not determine multipart count for import {year}-{month}")
        missing_parts = [part for part in range(1, expected + 1) if part not in parts]
        if missing_parts:
            raise RuntimeError(f"Missing import multipart resources for {year}-{month}: {missing_parts}")
        selected.sort(key=lambda row: resource_part_number(row) or 0)

    return selected


def build_resource(row: dict[str, str], flow: str, year: str, month: str) -> Resource:
    category = row["source_category"]
    plural = "imports" if flow == "import" else "exports"
    original = original_filename(row["resource_download_url"])
    raw_format = original.split(".")[-1].lower()
    period = f"{year}-{month}"
    raw_dir = SOURCE_ROOT / plural / "raw"
    working_dir = SOURCE_ROOT / plural / "working"

    if flow == "import":
        part = resource_part_number(row)
        if part is None and ".part" in original.lower():
            raise RuntimeError(f"Could not infer import part number from {row}")
        if part is None:
            raw_name = f"cl_aduana_imports_{year}_{month}_raw.{raw_format}"
        else:
            raw_name = f"cl_aduana_imports_{year}_{month}_raw.part{part:02d}.{raw_format}"
        working_name = f"cl_aduana_imports_{year}_{month}.txt"
    else:
        suffix = {
            "main_data": "",
            "bultos": "_bultos",
            "transport_docs": "_transport_docs",
        }[category]
        raw_name = f"cl_aduana_exports_{year}_{month}{suffix}_raw.{raw_format}"
        working_name = f"cl_aduana_exports_{year}_{month}{suffix}.txt"

    return Resource(
        source_domain="datos.gob.cl",
        source_page_url=row["source_page_url"],
        resource_download_url=row["resource_download_url"],
        country="CL",
        trade_flow=flow,
        source_category="dataset_resource" if category == "main_data" else f"dataset_resource_{category}",
        year=year,
        month=month,
        period=period,
        original_filename=original,
        normalized_raw_filename=raw_name,
        raw_path=raw_dir / raw_name,
        raw_file_role="compressed_source_file",
        raw_file_format=raw_format,
        normalized_working_filename=working_name,
        working_path=working_dir / working_name,
        notes=f"Historical official CKAN resource acquired for identity validation: {row['notes']}",
    )


def download_resource(resource: Resource, manifest_by_raw_path: dict[str, dict[str, str]], dry_run: bool) -> None:
    manifest_row = manifest_by_raw_path.get(relative(resource.raw_path))
    if resource.raw_path.exists():
        if not manifest_row:
            print(f"use existing raw awaiting manifest: {relative(resource.raw_path)}")
            return
        current_size = str(resource.raw_path.stat().st_size)
        current_checksum = sha256(resource.raw_path)
        if current_size != manifest_row.get("raw_file_size") or current_checksum != manifest_row.get("raw_checksum_sha256"):
            raise RuntimeError(f"Existing raw file differs from manifest: {resource.raw_path}")
        print(f"skip raw already verified: {relative(resource.raw_path)}")
        return

    print(f"download {resource.resource_download_url}")
    print(f"  -> {relative(resource.raw_path)}")
    if dry_run:
        return
    resource.raw_path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = resource.raw_path.with_suffix(resource.raw_path.suffix + ".download")
    subprocess.run(
        [
            "curl",
            "--http1.1",
            "-fL",
            "--retry",
            "5",
            "--retry-all-errors",
            "--retry-delay",
            "2",
            "--continue-at",
            "-",
            "--output",
            str(tmp_path),
            resource.resource_download_url,
        ],
        check=True,
    )
    tmp_path.replace(resource.raw_path)


def list_archive(archive_path: Path) -> list[str]:
    result = subprocess.run(
        ["bsdtar", "-tf", str(archive_path)],
        check=True,
        capture_output=True,
        text=True,
    )
    return [line.strip() for line in result.stdout.splitlines() if line.strip()]


def extraction_commands(archive_path: Path, output_dir: Path) -> list[tuple[str, list[str]]]:
    commands: list[tuple[str, list[str]]] = []
    if shutil.which("unar"):
        commands.append(
            (
                "unar",
                [
                    "unar",
                    "-quiet",
                    "-force-overwrite",
                    "-no-directory",
                    "-output-directory",
                    str(output_dir),
                    str(archive_path),
                ],
            )
        )
    commands.append(("bsdtar", ["bsdtar", "-xf", str(archive_path), "-C", str(output_dir)]))
    return commands


def extract_archive(archive_path: Path, working_path: Path, dry_run: bool) -> tuple[str, str, str]:
    print(f"extract {relative(archive_path)}")
    names = list_archive(archive_path)
    text_names = [name for name in names if name.lower().endswith((".txt", ".csv"))]
    if not text_names:
        raise RuntimeError(f"Archive does not contain a TXT/CSV child: {archive_path}; children={names}")
    if dry_run:
        return text_names[0], "", ""

    working_path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp_dir_text:
        tmp_dir = Path(tmp_dir_text)
        errors: list[str] = []
        for tool_name, command in extraction_commands(archive_path, tmp_dir):
            result = subprocess.run(command, capture_output=True, text=True)
            if result.returncode == 0:
                break
            message = (result.stderr or result.stdout or "").strip()
            errors.append(f"{tool_name}: {message}")
        else:
            raise RuntimeError(f"archive extraction failed for {archive_path}: {' | '.join(errors)}")
        candidates = [path for path in tmp_dir.rglob("*") if path.is_file() and path.name.lower().endswith((".txt", ".csv"))]
        if len(candidates) != 1:
            raise RuntimeError(f"Expected exactly one TXT/CSV child in {archive_path}, got {[str(p) for p in candidates]}")
        if working_path.exists():
            working_path.unlink()
        shutil.copy2(candidates[0], working_path)
        return candidates[0].name, str(working_path.stat().st_size), sha256(working_path)


def manifest_row(resource: Resource, child_name: str, working_size: str, working_checksum: str) -> dict[str, str]:
    return {
        "source_domain": resource.source_domain,
        "source_page_url": resource.source_page_url,
        "resource_download_url": resource.resource_download_url,
        "country": resource.country,
        "trade_flow": resource.trade_flow,
        "source_category": resource.source_category,
        "year": resource.year,
        "month": resource.month,
        "period": resource.period,
        "original_filename": resource.original_filename,
        "normalized_raw_filename": resource.normalized_raw_filename,
        "raw_path": relative(resource.raw_path),
        "raw_file_role": resource.raw_file_role,
        "raw_file_format": resource.raw_file_format,
        "raw_file_size": "" if not resource.raw_path.exists() else str(resource.raw_path.stat().st_size),
        "raw_checksum_sha256": "" if not resource.raw_path.exists() else sha256(resource.raw_path),
        "requires_extraction": "true",
        "original_child_filenames": child_name,
        "normalized_working_filenames": resource.normalized_working_filename,
        "working_paths": relative(resource.working_path),
        "working_file_formats": resource.working_path.suffix.lstrip(".").lower(),
        "working_file_sizes": working_size,
        "working_checksum_sha256": working_checksum,
        "downloaded_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "notes": resource.notes,
    }


def raw_only_manifest_row(resource: Resource, extraction_error: str = "") -> dict[str, str]:
    notes = resource.notes
    if extraction_error:
        notes = f"{notes}; extraction_pending: {extraction_error}"
    return {
        "source_domain": resource.source_domain,
        "source_page_url": resource.source_page_url,
        "resource_download_url": resource.resource_download_url,
        "country": resource.country,
        "trade_flow": resource.trade_flow,
        "source_category": resource.source_category,
        "year": resource.year,
        "month": resource.month,
        "period": resource.period,
        "original_filename": resource.original_filename,
        "normalized_raw_filename": resource.normalized_raw_filename,
        "raw_path": relative(resource.raw_path),
        "raw_file_role": resource.raw_file_role,
        "raw_file_format": resource.raw_file_format,
        "raw_file_size": "" if not resource.raw_path.exists() else str(resource.raw_path.stat().st_size),
        "raw_checksum_sha256": "" if not resource.raw_path.exists() else sha256(resource.raw_path),
        "requires_extraction": "true",
        "original_child_filenames": "",
        "normalized_working_filenames": resource.normalized_working_filename,
        "working_paths": "",
        "working_file_formats": "",
        "working_file_sizes": "",
        "working_checksum_sha256": "",
        "downloaded_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "notes": notes,
    }


def acquire(args: argparse.Namespace) -> int:
    year = str(args.year)
    month = str(args.month).zfill(2)
    inventory = read_inventory(args.inventory)
    rows = select_inventory_rows(inventory, args.flow, year, month)
    resources = [build_resource(row, args.flow, year, month) for row in rows]
    manifest_by_raw_path = read_manifest(args.manifest)

    print(f"selected {len(resources)} resources for {args.flow} {year}-{month}")
    for resource in resources:
        print(f"- {resource.source_category}: {resource.resource_download_url}")
        print(f"  raw: {relative(resource.raw_path)}")
        print(f"  working: {relative(resource.working_path)}")
    if args.dry_run:
        return 0

    for resource in resources:
        download_resource(resource, manifest_by_raw_path, args.dry_run)

    new_rows = list(manifest_by_raw_path.values())
    new_by_raw_path = {row["raw_path"]: row for row in new_rows}
    for resource in resources:
        new_by_raw_path[relative(resource.raw_path)] = raw_only_manifest_row(resource)

    try:
        for resource in resources:
            archive_for_extract = resource.raw_path
            if args.flow == "import":
                archive_for_extract = resources[0].raw_path
                if resource != resources[0]:
                    continue
            child_name, working_size, working_checksum = extract_archive(archive_for_extract, resource.working_path, args.dry_run)
            if args.flow == "import":
                for part_resource in resources:
                    new_by_raw_path[relative(part_resource.raw_path)] = manifest_row(
                        part_resource,
                        child_name,
                        working_size,
                        working_checksum,
                    )
                break
            new_by_raw_path[relative(resource.raw_path)] = manifest_row(resource, child_name, working_size, working_checksum)
    except RuntimeError as error:
        message = str(error)
        for resource in resources:
            new_by_raw_path[relative(resource.raw_path)] = raw_only_manifest_row(resource, message)
        write_manifest(args.manifest, list(new_by_raw_path.values()))
        print(f"wrote raw-only manifest after extraction failure: {relative(args.manifest)}", file=sys.stderr)
        print(message, file=sys.stderr)
        return 2

    write_manifest(args.manifest, list(new_by_raw_path.values()))
    print(f"wrote manifest {relative(args.manifest)}")
    return 0


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--flow", choices=["import", "export"], required=True)
    parser.add_argument("--year", required=True)
    parser.add_argument("--month", required=True)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--inventory", type=Path, default=INVENTORY_PATH)
    parser.add_argument("--manifest", type=Path, default=MANIFEST_PATH)
    return parser.parse_args(argv)


if __name__ == "__main__":
    raise SystemExit(acquire(parse_args(sys.argv[1:])))
