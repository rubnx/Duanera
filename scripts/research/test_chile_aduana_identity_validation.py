#!/usr/bin/env python3
"""Unit tests for chile_aduana_identity_validation.py."""

from __future__ import annotations

import unittest
import tempfile
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
import chile_aduana_identity_validation as pipeline


class ChileAduanaIdentityValidationTests(unittest.TestCase):
    def test_parse_number_handles_decimal_comma(self) -> None:
        self.assertEqual(pipeline.parse_number("1.234,56"), 1234.56)
        self.assertEqual(pipeline.parse_number("1234,56"), 1234.56)
        self.assertEqual(pipeline.parse_number(""), 0.0)

    def test_classifies_anonymous_importer_field(self) -> None:
        named, ruts, anonymous, evidence, mode = pipeline.classify_identity_fields(
            ["NUM_UNICO_IMPORTADOR", "NOMEMISOR", "NUMRUTEMI", "DNOMBRE"]
        )

        self.assertEqual(mode, "anonymous")
        self.assertEqual(named, [])
        self.assertEqual(ruts, [])
        self.assertEqual(anonymous, ["NUM_UNICO_IMPORTADOR"])
        self.assertIn("NOMEMISOR", evidence)
        self.assertIn("NUMRUTEMI", evidence)

    def test_classifies_named_identity_fields_without_transport_parties(self) -> None:
        named, ruts, anonymous, evidence, mode = pipeline.classify_identity_fields(
            [
                "NOMBRE_IMPORTADOR",
                "RUT_IMPORTADOR",
                "NOMBRE_CIA_TRANSP",
                "RUT_CIA_TRANSP",
            ]
        )

        self.assertEqual(mode, "named")
        self.assertEqual(named, ["NOMBRE_IMPORTADOR"])
        self.assertEqual(ruts, ["RUT_IMPORTADOR"])
        self.assertEqual(anonymous, [])
        self.assertIn("NOMBRE_CIA_TRANSP", evidence)
        self.assertIn("RUT_CIA_TRANSP", evidence)

    def test_truncates_headerless_columns_to_observed_count(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            path = Path(temp_dir) / "cl_aduana_imports_2003_01.txt"
            path.write_text("1;2;3\n", encoding="latin-1")

            columns, has_header = pipeline.infer_columns(
                pipeline.SourceFile(
                    inventory_status="local_preserved",
                    source_domain="datos.gob.cl",
                    source_page_url="",
                    resource_download_url="",
                    country="CL",
                    trade_flow="import",
                    source_category="dataset_resource",
                    year="2003",
                    month="01",
                    period="2003-01",
                    raw_path="",
                    working_paths=[],
                    file_format="txt",
                    notes="",
                ),
                path,
            )

        self.assertFalse(has_header)
        self.assertEqual(columns, pipeline.DIN_COLUMNS[:3])

    def test_scores_matching_fingerprints_above_unrelated_fingerprints(self) -> None:
        named = pipeline.Fingerprint(
            flow="export",
            entity_kind="exporter",
            entity_id="76000000-0",
            source_identity_type="named",
        )
        anonymous_match = pipeline.Fingerprint(
            flow="export",
            entity_kind="exporter",
            entity_id="123",
            source_identity_type="anonymous",
        )
        anonymous_other = pipeline.Fingerprint(
            flow="export",
            entity_kind="exporter",
            entity_id="456",
            source_identity_type="anonymous",
        )

        for _ in range(20):
            named.add_record(
                year="2015",
                period="2015-01",
                declaration="A",
                value=100,
                hs_code="74031100",
                product_text="catodo cobre refinado",
                country="CHINA",
                port="SAN ANTONIO",
                geography="13101",
                carrier="",
                emitter="",
            )
            anonymous_match.add_record(
                year="2026",
                period="2026-01",
                declaration="B",
                value=100,
                hs_code="74031100",
                product_text="catodo cobre refinado",
                country="CHINA",
                port="SAN ANTONIO",
                geography="13101",
                carrier="",
                emitter="",
            )
            anonymous_other.add_record(
                year="2026",
                period="2026-01",
                declaration="C",
                value=100,
                hs_code="22042168",
                product_text="vino tinto embotellado",
                country="BRASIL",
                port="VALPARAISO",
                geography="13114",
                carrier="",
                emitter="",
            )

        matching_score, _ = pipeline.score_pair(named, anonymous_match)
        unrelated_score, _ = pipeline.score_pair(named, anonymous_other)

        self.assertGreater(matching_score, unrelated_score)
        self.assertEqual(pipeline.confidence_band(matching_score), "alta")


if __name__ == "__main__":
    unittest.main()
