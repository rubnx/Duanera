#!/usr/bin/env python3
"""Unit tests for chile_aduana_historical_acquisition.py."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent))
import chile_aduana_historical_acquisition as acquisition


def row(flow: str, category: str, notes: str, url: str) -> dict[str, str]:
    return {
        "inventory_status": "ckan_available",
        "source_domain": "datos.gob.cl",
        "source_page_url": f"https://datos.gob.cl/dataset/{flow}-2015",
        "resource_download_url": url,
        "country": "CL",
        "trade_flow": flow,
        "source_category": category,
        "year": "2015",
        "month": "",
        "period": "2015",
        "file_format": "rar",
        "notes": notes,
    }


class ChileAduanaHistoricalAcquisitionTests(unittest.TestCase):
    def test_selects_january_export_resource_set(self) -> None:
        rows = [
            row("export", "main_data", "CKAN resource: Enero 2015- Exportaciones", "https://example.test/ene-exportaciones.rar"),
            row("export", "bultos", "CKAN resource: Enero 2015- Exportaciones - BULTOS", "https://example.test/ene-exportaciones-bultos.rar"),
            row("export", "transport_docs", "CKAN resource: Enero 2015- Exportaciones - Dtran", "https://example.test/ene-exportaciones-dtran.rar"),
            row("export", "main_data", "CKAN resource: Febrero 2015- Exportaciones", "https://example.test/feb-exportaciones.rar"),
        ]

        selected = acquisition.select_inventory_rows(rows, "export", "2015", "01")

        self.assertEqual([item["source_category"] for item in selected], ["main_data", "bultos", "transport_docs"])

    def test_requires_all_import_parts(self) -> None:
        rows = [
            row("import", "main_data", "CKAN resource: Enero 2015- Importaciones 1/3", "https://example.test/enero-2015-importaciones.part01.rar"),
            row("import", "main_data", "CKAN resource: Enero 2015- Importaciones 3/3", "https://example.test/enero-2015-importaciones.part03.rar"),
        ]

        with self.assertRaisesRegex(RuntimeError, "Missing import multipart resources"):
            acquisition.select_inventory_rows(rows, "import", "2015", "01")

    def test_allows_single_file_historical_import(self) -> None:
        rows = [
            row("import", "main_data", "CKAN resource: Importaciones - enero 2003", "https://example.test/importaciones-enero-2003.rar"),
            row("import", "main_data", "CKAN resource: Importaciones - febrero 2003", "https://example.test/importaciones-febrero-2003.rar"),
        ]
        for item in rows:
            item["year"] = "2003"

        selected = acquisition.select_inventory_rows(rows, "import", "2003", "01")

        self.assertEqual(len(selected), 1)
        self.assertIn("enero-2003", selected[0]["resource_download_url"])

    def test_builds_normalized_export_paths(self) -> None:
        selected = row(
            "export",
            "bultos",
            "CKAN resource: Enero 2015- Exportaciones - BULTOS",
            "https://example.test/ene-exportaciones-bultos.rar",
        )

        resource = acquisition.build_resource(selected, "export", "2015", "01")

        self.assertEqual(resource.normalized_raw_filename, "cl_aduana_exports_2015_01_bultos_raw.rar")
        self.assertEqual(resource.normalized_working_filename, "cl_aduana_exports_2015_01_bultos.txt")
        self.assertEqual(resource.source_category, "dataset_resource_bultos")

    def test_builds_normalized_import_part_paths(self) -> None:
        selected = row(
            "import",
            "main_data",
            "CKAN resource: Enero 2015- Importaciones 2/5",
            "https://example.test/enero-2015-importaciones.part02.rar",
        )

        resource = acquisition.build_resource(selected, "import", "2015", "01")

        self.assertEqual(resource.normalized_raw_filename, "cl_aduana_imports_2015_01_raw.part02.rar")
        self.assertEqual(resource.normalized_working_filename, "cl_aduana_imports_2015_01.txt")

    def test_builds_normalized_single_import_paths(self) -> None:
        selected = row(
            "import",
            "main_data",
            "CKAN resource: Importaciones - enero 2003",
            "https://example.test/importaciones-enero-2003.rar",
        )

        resource = acquisition.build_resource(selected, "import", "2003", "01")

        self.assertEqual(resource.normalized_raw_filename, "cl_aduana_imports_2003_01_raw.rar")
        self.assertEqual(resource.normalized_working_filename, "cl_aduana_imports_2003_01.txt")

    def test_raw_only_manifest_row_records_pending_extraction(self) -> None:
        selected = row(
            "import",
            "main_data",
            "CKAN resource: Enero 2015- Importaciones 1/5",
            "https://example.test/enero-2015-importaciones.part01.rar",
        )
        resource = acquisition.build_resource(selected, "import", "2015", "01")

        manifest_row = acquisition.raw_only_manifest_row(resource, "missing extractor")

        self.assertEqual(manifest_row["working_paths"], "")
        self.assertEqual(manifest_row["normalized_working_filenames"], "cl_aduana_imports_2015_01.txt")
        self.assertIn("extraction_pending: missing extractor", manifest_row["notes"])

    def test_extraction_commands_prefer_unar_when_available(self) -> None:
        with patch.object(acquisition.shutil, "which", return_value="/usr/local/bin/unar"):
            commands = acquisition.extraction_commands(Path("sample.part01.rar"), Path("out"))

        self.assertEqual(commands[0][0], "unar")
        self.assertEqual(commands[1][0], "bsdtar")


if __name__ == "__main__":
    unittest.main()
