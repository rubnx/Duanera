import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import test, { after } from "node:test";
import assert from "node:assert/strict";

import {
  candidateFromManifestRow,
  isMainAduanaDataManifestRow,
  parseAduanaLoadPreflightArgs,
  resolvePreflightDataPath,
  runAduanaLoadPreflight,
  type PreflightManifestRow,
} from "./aduana-load-preflight";
import { importFieldNames } from "../../src/ingest/aduana-source-layouts";

const testDir = "data/.duanera-test-aduana-preflight";
const workingPath = `${testDir}/cl_aduana_imports_2026_04.txt`;

after(() => {
  rmSync(testDir, { force: true, recursive: true });
});

function importFixtureLine(overrides: Record<string, string> = {}) {
  return importFieldNames
    .map((fieldName, index) => overrides[fieldName] ?? String(index + 1))
    .join(";");
}

function manifestRow(overrides: Partial<PreflightManifestRow> = {}): PreflightManifestRow {
  return {
    country: "CL",
    month: "04",
    normalized_raw_filename: "cl_aduana_imports_2026_04_raw.rar",
    period: "2026-04",
    raw_checksum_sha256: "",
    raw_file_format: "rar",
    raw_file_role: "compressed_source_file",
    raw_file_size: "",
    raw_path: `${testDir}/cl_aduana_imports_2026_04_raw.rar`,
    source_category: "dataset_resource",
    source_domain: "datos.gob.cl",
    trade_flow: "import",
    working_checksum_sha256: "",
    working_file_formats: "txt",
    working_file_sizes: "",
    working_paths: workingPath,
    year: "2026",
    ...overrides,
  };
}

test("parses Aduana load preflight arguments", () => {
  const args = parseAduanaLoadPreflightArgs([
    "--period",
    "2026-04",
    "--trade-flow",
    "import",
    "--sample-rows",
    "25",
    "--skip-checksums",
    "--pretty",
  ]);

  assert.equal(args.period, "2026-04");
  assert.equal(args.year, 2026);
  assert.equal(args.month, 4);
  assert.equal(args.tradeFlow, "import");
  assert.equal(args.sampleRows, 25);
  assert.equal(args.verifyChecksums, false);
  assert.equal(args.pretty, true);

  assert.throws(() => parseAduanaLoadPreflightArgs(["--period", "2026-13"]), /between 01 and 12/);
  assert.throws(() => parseAduanaLoadPreflightArgs(["--sample-rows", "1e2"]), /positive integer/);
});

test("keeps preflight paths inside the ignored data archive", () => {
  assert.equal(resolvePreflightDataPath("data/sources"), `${process.cwd()}/data/sources`);
  assert.throws(
    () => resolvePreflightDataPath("package.json"),
    /must be inside the ignored data\/ archive/,
  );
  assert.throws(
    () => resolvePreflightDataPath("../outside.txt"),
    /must stay inside the repository/,
  );
});

test("selects only monthly Aduana main data manifest rows by default", () => {
  assert.equal(isMainAduanaDataManifestRow(manifestRow()), true);
  assert.equal(
    isMainAduanaDataManifestRow(
      manifestRow({
        normalized_raw_filename: "cl_aduana_exports_2026_04_bultos_raw.rar",
        working_paths: `${testDir}/cl_aduana_exports_2026_04_bultos.txt`,
      }),
    ),
    false,
  );
  assert.equal(
    isMainAduanaDataManifestRow(manifestRow({ source_category: "operational_file" })),
    false,
  );
});

test("builds preflight candidates from manifest rows", () => {
  const candidate = candidateFromManifestRow(manifestRow(), "data/manifest.csv");

  assert.equal(candidate.source, "manifest");
  assert.equal(candidate.tradeFlow, "import");
  assert.equal(candidate.year, 2026);
  assert.equal(candidate.month, 4);
  assert.equal(candidate.period, "2026-04");
  assert.equal(candidate.workingPath, workingPath);
});

test("preflights a compatible import working file without database writes", async () => {
  mkdirSync(testDir, { recursive: true });
  writeFileSync(
    workingPath,
    [
      importFixtureLine({
        ADU: "48",
        ARANC: "unused",
        "ARANC-NAC": "40111000",
        "CIF-ITEM": "123,45",
        MONEDA: "13",
        NUM_UNICO_IMPORTADOR: "123456",
        NUMENCRIPTADO: "DECL-1",
        TOT_PESO: "10,00",
      }),
      importFixtureLine({ ADU: "56", MONEDA: "141", PTO_DESEM: "825" }),
    ].join("\n"),
  );

  const report = await runAduanaLoadPreflight({
    manifestFiles: [],
    normalizedRawFilenames: [],
    period: "2026-04",
    tradeFlow: "import",
    workingPaths: [workingPath],
    year: 2026,
    month: 4,
    sampleRows: 2,
    pretty: false,
    verifyChecksums: false,
  });

  assert.equal(report.mode, "read-only");
  assert.equal(report.databaseWritesAttempted, false);
  assert.equal(report.summary.candidates, 1);
  assert.equal(report.summary.blockers, 0);
  assert.equal(report.summary.overallStatus, "warning");
  assert.equal(report.candidates[0]?.sample.rowsRead, 2);
  assert.equal(report.candidates[0]?.sample.failedRows, 0);
  assert.deepEqual(report.candidates[0]?.sample.fieldCounts, { "178": 2 });
  assert.ok(
    report.candidates[0]?.sample.observedRiskCodes.some(
      (risk) => risk.field === "ADU" && risk.code === "56",
    ),
  );
  assert.ok(
    report.candidates[0]?.sample.observedRiskCodes.some(
      (risk) =>
        risk.field === "ADU" &&
        risk.code === "56" &&
        risk.risk.includes("evidencia oficial"),
    ),
  );
  assert.ok(
    report.candidates[0]?.sample.observedRiskCodes.some(
      (risk) => risk.field === "PTO_DESEM" && risk.code === "825",
    ),
  );
  assert.ok(
    report.candidates[0]?.sample.observedRiskCodes.some(
      (risk) => risk.field === "MONEDA" && risk.code === "141",
    ),
  );
});

test("blocks preflight when sampled field counts do not match the current layout", async () => {
  mkdirSync(testDir, { recursive: true });
  writeFileSync(workingPath, "a;b;c\n");

  const report = await runAduanaLoadPreflight({
    manifestFiles: [],
    normalizedRawFilenames: [],
    period: "2026-04",
    tradeFlow: "import",
    workingPaths: [workingPath],
    year: 2026,
    month: 4,
    sampleRows: 1,
    pretty: false,
    verifyChecksums: false,
  });

  assert.equal(report.summary.overallStatus, "blocker");
  assert.equal(report.candidates[0]?.sample.failedRows, 1);
});

test("reports missing working files as blockers without throwing", async () => {
  rmSync(testDir, { force: true, recursive: true });

  const report = await runAduanaLoadPreflight({
    manifestFiles: [],
    normalizedRawFilenames: [],
    period: "2026-04",
    tradeFlow: "import",
    workingPaths: [workingPath],
    year: 2026,
    month: 4,
    sampleRows: 1,
    pretty: false,
    verifyChecksums: false,
  });

  assert.equal(report.summary.overallStatus, "blocker");
  assert.equal(report.candidates[0]?.sample.rowsRead, 0);
  assert.ok(
    report.candidates[0]?.checks.some(
      (check) => check.key === "working_file_exists" && check.status === "blocker",
    ),
  );
});
