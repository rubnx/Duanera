#!/usr/bin/env python3
"""Discover Servicio Nacional de Aduanas datasets through datos.gob.cl CKAN.

This is a research-only helper. It queries package_search and summarizes
dataset/resource metadata; it does not download source files or parse rows.
"""

from __future__ import annotations

import argparse
import json
import ssl
import subprocess
import sys
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from datetime import date
from typing import Any


API_URL = "https://datos.gob.cl/api/3/action/package_search"
ADUANA_OWNER_ORG = "AE007"
ADUANA_ORG_NAME = "servicio_nacional_de_aduanas"


def strip_accents(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    return "".join(char for char in normalized if not unicodedata.combining(char))


def norm_text(value: str | None) -> str:
    return strip_accents(value or "").lower()


def request_package_search(start: int, rows: int, allow_insecure_tls: bool) -> dict[str, Any]:
    params = {
        "fq": f"owner_org:{ADUANA_OWNER_ORG}",
        "start": str(start),
        "rows": str(rows),
        "sort": "name asc",
    }
    url = f"{API_URL}?{urllib.parse.urlencode(params)}"
    request = urllib.request.Request(url, headers={"User-Agent": "Duanera research script"})
    context = ssl._create_unverified_context() if allow_insecure_tls else None
    try:
        with urllib.request.urlopen(request, timeout=60, context=context) as response:
            payload = json.load(response)
    except urllib.error.URLError as error:
        if allow_insecure_tls:
            raise
        if not isinstance(getattr(error, "reason", None), ssl.SSLCertVerificationError):
            raise
        result = subprocess.run(
            ["curl", "-fsSL", url],
            check=True,
            capture_output=True,
            text=True,
        )
        payload = json.loads(result.stdout)
    if not payload.get("success"):
        raise RuntimeError(f"CKAN package_search failed: {payload!r}")
    return payload["result"]


def fetch_all_packages(rows: int, allow_insecure_tls: bool) -> list[dict[str, Any]]:
    packages: list[dict[str, Any]] = []
    start = 0
    total = None
    while total is None or start < total:
        result = request_package_search(
            start=start,
            rows=rows,
            allow_insecure_tls=allow_insecure_tls,
        )
        total = int(result["count"])
        batch = result.get("results", [])
        packages.extend(batch)
        if not batch:
            break
        start += rows
    return packages


def package_text(package: dict[str, Any]) -> str:
    fields = [
        package.get("name"),
        package.get("title"),
        package.get("notes"),
        package.get("url"),
    ]
    return norm_text(" ".join(field or "" for field in fields))


def classify_flow(package: dict[str, Any]) -> str:
    text = package_text(package)
    name = norm_text(package.get("name"))
    title = norm_text(package.get("title"))

    if "comercio exterior" in text and "datos agregados" in text:
        return "other"

    if "diccionario" in text:
        return "dictionary"

    if (
        "export" in name
        or "export" in title
        or "documentos unicos de salida" in text
        or "dus" in text
    ):
        return "export"

    if (
        "import" in name
        or "import" in title
        or "declaraciones de ingreso" in text
        or "din" in text
    ):
        return "import"

    return "other"


def package_year(package: dict[str, Any]) -> int | None:
    text = package_text(package)
    for year in range(2035, 1990, -1):
        if str(year) in text:
            return year
    return None


def resource_kind(resource: dict[str, Any]) -> str:
    text = norm_text(" ".join([resource.get("name") or "", resource.get("description") or ""]))
    if "diccionario" in text or "campos" in text:
        return "data_dictionary"
    if "metadata" in text or "descripcion" in text or "estructura" in text:
        return "metadata"
    if "bulto" in text:
        return "bultos"
    if "transporte" in text or "dtran" in text or "doc transp" in text:
        return "transport_docs"
    return "main_data"


def summarize_package(package: dict[str, Any]) -> dict[str, Any]:
    resources = package.get("resources", [])
    format_counts = Counter((resource.get("format") or "unknown").lower() for resource in resources)
    kind_counts = Counter(resource_kind(resource) for resource in resources)
    datastore_count = sum(1 for resource in resources if resource.get("datastore_active"))
    total_size = sum(int(resource.get("size") or 0) for resource in resources)
    return {
        "name": package.get("name"),
        "title": package.get("title"),
        "url": f"https://datos.gob.cl/dataset/{package.get('name')}",
        "id": package.get("id"),
        "flow": classify_flow(package),
        "year": package_year(package),
        "license_id": package.get("license_id"),
        "license_title": package.get("license_title"),
        "metadata_created": package.get("metadata_created"),
        "metadata_modified": package.get("metadata_modified"),
        "num_resources": len(resources),
        "formats": dict(sorted(format_counts.items())),
        "resource_kinds": dict(sorted(kind_counts.items())),
        "datastore_active_resources": datastore_count,
        "total_resource_size": total_size or None,
        "resources": [
            {
                "name": resource.get("name"),
                "description": resource.get("description"),
                "format": resource.get("format"),
                "size": resource.get("size"),
                "kind": resource_kind(resource),
                "datastore_active": resource.get("datastore_active"),
                "url": resource.get("url"),
                "id": resource.get("id"),
            }
            for resource in resources
        ],
    }


def fmt_size(value: int | None) -> str:
    return "" if value in (None, 0) else f"{value:,}"


def fmt_dict(value: dict[str, int]) -> str:
    if not value:
        return ""
    return ", ".join(f"{key}:{count}" for key, count in value.items())


def flow_years(summaries: list[dict[str, Any]], flow: str) -> list[int]:
    return sorted({item["year"] for item in summaries if item["flow"] == flow and item["year"]})


def latest_by_flow(summaries: list[dict[str, Any]], flow: str) -> dict[str, Any] | None:
    candidates = [item for item in summaries if item["flow"] == flow and item["year"]]
    if not candidates:
        return None
    return max(candidates, key=lambda item: (item["year"], item["metadata_modified"] or ""))


def render_package_table(summaries: list[dict[str, Any]], flow: str) -> list[str]:
    lines = [
        "| Year | Dataset | Resources | Formats | Resource roles | Datastore resources | License |",
        "| ---: | --- | ---: | --- | --- | ---: | --- |",
    ]
    rows = [item for item in summaries if item["flow"] == flow]
    rows.sort(key=lambda item: (item["year"] or 0, item["name"] or ""))
    for item in rows:
        year = item["year"] or ""
        lines.append(
            "| "
            + " | ".join(
                [
                    str(year),
                    f"[{item['title']}]({item['url']})",
                    str(item["num_resources"]),
                    fmt_dict(item["formats"]),
                    fmt_dict(item["resource_kinds"]),
                    str(item["datastore_active_resources"]),
                    item.get("license_title") or item.get("license_id") or "",
                ]
            )
            + " |"
        )
    return lines


def render_resource_table(package: dict[str, Any]) -> list[str]:
    lines = [
        f"### {package['title']} ({package['year']})",
        "",
        f"Dataset page: {package['url']}",
        "",
        "| Resource | Role | Format | Size bytes | Datastore | Download URL |",
        "| --- | --- | --- | ---: | --- | --- |",
    ]
    for resource in package["resources"]:
        lines.append(
            "| "
            + " | ".join(
                [
                    resource.get("name") or "",
                    resource.get("kind") or "",
                    resource.get("format") or "",
                    fmt_size(resource.get("size")),
                    "yes" if resource.get("datastore_active") else "no",
                    resource.get("url") or "",
                ]
            )
            + " |"
        )
    return lines


def render_markdown(summaries: list[dict[str, Any]]) -> str:
    by_flow = defaultdict(list)
    for item in summaries:
        by_flow[item["flow"]].append(item)

    lines = [
        "# datos.gob.cl CKAN Aduana Discovery",
        "",
        f"Date accessed: {date.today().isoformat()}",
        "",
        f"Endpoint: {API_URL}",
        "",
        f"Query used: `fq=owner_org:{ADUANA_OWNER_ORG}` via CKAN `package_search`.",
        "",
        "No resource files were downloaded by this script.",
        "",
        "## Summary",
        "",
        f"- Servicio Nacional de Aduanas packages discovered: {len(summaries)}",
        f"- Import datasets discovered: {len(by_flow['import'])}; years: {', '.join(map(str, flow_years(summaries, 'import')))}",
        f"- Export datasets discovered: {len(by_flow['export'])}; years: {', '.join(map(str, flow_years(summaries, 'export')))}",
        f"- Dictionary/reference datasets discovered: {len(by_flow['dictionary'])}",
        f"- Other Aduana datasets discovered: {len(by_flow['other'])}",
        "",
        "## Import Datasets",
        "",
        *render_package_table(summaries, "import"),
        "",
        "## Export Datasets",
        "",
        *render_package_table(summaries, "export"),
        "",
        "## Dictionary Datasets",
        "",
        *render_package_table(summaries, "dictionary"),
        "",
        "## Latest Dataset Resources",
        "",
    ]

    for flow in ("import", "export"):
        latest = latest_by_flow(summaries, flow)
        if latest:
            lines.extend(render_resource_table(latest))
            lines.append("")

    return "\n".join(lines).rstrip() + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--rows", type=int, default=100, help="CKAN page size for package_search.")
    parser.add_argument(
        "--format",
        choices=("markdown", "json"),
        default="markdown",
        help="Output format.",
    )
    parser.add_argument(
        "--allow-insecure-tls",
        action="store_true",
        help="Disable TLS certificate verification when the local Python cert store is incomplete.",
    )
    args = parser.parse_args()

    packages = fetch_all_packages(rows=args.rows, allow_insecure_tls=args.allow_insecure_tls)
    summaries = [summarize_package(package) for package in packages]

    org_names = {
        (package.get("organization") or {}).get("name")
        for package in packages
        if package.get("organization")
    }
    if ADUANA_ORG_NAME not in org_names:
        print(
            f"warning: expected organization {ADUANA_ORG_NAME!r} not found in results",
            file=sys.stderr,
        )

    if args.format == "json":
        json.dump(summaries, sys.stdout, ensure_ascii=False, indent=2)
        print()
    else:
        sys.stdout.write(render_markdown(summaries))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
