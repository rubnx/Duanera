import { createHash } from "node:crypto";
import { createReadStream, existsSync, statSync } from "node:fs";
import { createInterface } from "node:readline";
import { pathToFileURL } from "node:url";

import iconv from "iconv-lite";

import { parseAduanaRow } from "../../src/ingest/aduana-main-file";
import {
  candidateFromWorkingPath,
  loadManifestCandidates,
  parseAduanaLoadPreflightArgs,
  resolvePreflightDataPath,
  type AduanaLoadPreflightArgs,
} from "./aduana-load-preflight-candidates";
import {
  check,
  expectedLayout,
  layoutChecks,
  maxStatus,
  metadataChecks,
  payloadRetentionChecks,
  riskCodeFields,
} from "./aduana-load-preflight-checks";

export {
  candidateFromManifestRow,
  isMainAduanaDataManifestRow,
  parseAduanaLoadPreflightArgs,
  resolvePreflightDataPath,
} from "./aduana-load-preflight-candidates";

export type PreflightStatus = "compatible" | "warning" | "manual_review" | "blocker";
export type PreflightFlow = "import" | "export";

export type PreflightManifestRow = Record<string, string | undefined>;

export type AduanaPreflightCandidate = {
  source: "manifest" | "working_path";
  manifestPath: string | null;
  sourceDomain: string | null;
  sourceCategory: string | null;
  country: string | null;
  tradeFlow: PreflightFlow;
  year: number | null;
  month: number | null;
  period: string | null;
  normalizedRawFilename: string | null;
  rawPath: string | null;
  rawFileRole: string | null;
  rawFileSize: number | null;
  rawChecksumSha256: string | null;
  workingPath: string;
  workingFileFormat: string | null;
  workingFileSize: number | null;
  workingChecksumSha256: string | null;
};

export type AduanaPreflightCheck = {
  key: string;
  status: PreflightStatus;
  title: string;
  detail: string;
};

export type AduanaPreflightSample = {
  sampleRowsRequested: number;
  rowsRead: number;
  parsedRows: number;
  failedRows: number;
  firstRowLooksLikeHeader: boolean;
  fieldCounts: Record<string, number>;
  observedRiskCodes: Array<{
    field: string;
    code: string;
    risk: string;
  }>;
};

export type AduanaPreflightCandidateReport = {
  candidate: AduanaPreflightCandidate;
  status: PreflightStatus;
  checks: AduanaPreflightCheck[];
  expectedLayout: {
    name: string;
    fieldCount: number;
    codedFields: string[];
  };
  sample: AduanaPreflightSample;
};

export type AduanaLoadPreflightReport = {
  version: 1;
  generatedAt: string;
  mode: "read-only";
  databaseWritesAttempted: false;
  summary: {
    candidates: number;
    compatible: number;
    warnings: number;
    manualReview: number;
    blockers: number;
    overallStatus: PreflightStatus;
  };
  caveats: string[];
  candidates: AduanaPreflightCandidateReport[];
};

function sha256File(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

async function fileChecks(
  candidate: AduanaPreflightCandidate,
  verifyChecksums: boolean,
): Promise<AduanaPreflightCheck[]> {
  const checks: AduanaPreflightCheck[] = [];
  const workingPath = resolvePreflightDataPath(candidate.workingPath);
  if (!existsSync(workingPath)) {
    return [
      check(
        "blocker",
        "working_file_exists",
        "Archivo working",
        "El archivo working no existe en el archivo local data/.",
      ),
    ];
  }

  const workingStat = statSync(workingPath);
  checks.push(
    check(
      "compatible",
      "working_file_exists",
      "Archivo working",
      `Existe y pesa ${workingStat.size} bytes.`,
    ),
  );

  if (candidate.workingFileSize !== null && candidate.workingFileSize !== workingStat.size) {
    checks.push(
      check(
        "blocker",
        "working_file_size",
        "Tamaño working",
        `El manifiesto declara ${candidate.workingFileSize} bytes, pero el archivo local pesa ${workingStat.size}.`,
      ),
    );
  }

  if (candidate.rawPath) {
    const rawPath = resolvePreflightDataPath(candidate.rawPath);
    if (!existsSync(rawPath)) {
      checks.push(
        check("blocker", "raw_file_exists", "Archivo raw", "El archivo raw declarado no existe en data/."),
      );
    } else {
      const rawStat = statSync(rawPath);
      const status =
        candidate.rawFileSize !== null && candidate.rawFileSize !== rawStat.size ? "blocker" : "compatible";
      checks.push(
        check(
          status,
          "raw_file_size",
          "Tamaño raw",
          status === "compatible"
            ? `El archivo raw existe y pesa ${rawStat.size} bytes.`
            : `El manifiesto declara ${candidate.rawFileSize} bytes, pero el raw local pesa ${rawStat.size}.`,
        ),
      );
    }
  } else {
    checks.push(
      check(
        "warning",
        "raw_file_declared",
        "Archivo raw",
        "No hay raw_path de manifiesto; confirmar preservación oficial antes de cargar.",
      ),
    );
  }

  if (verifyChecksums && candidate.workingChecksumSha256) {
    const actual = await sha256File(workingPath);
    checks.push(
      check(
        actual === candidate.workingChecksumSha256 ? "compatible" : "blocker",
        "working_checksum",
        "Checksum working",
        actual === candidate.workingChecksumSha256
          ? "SHA-256 working coincide con el manifiesto."
          : `SHA-256 working no coincide. Manifest=${candidate.workingChecksumSha256}; local=${actual}.`,
      ),
    );
  } else if (candidate.source === "manifest") {
    checks.push(
      check(
        "warning",
        "working_checksum",
        "Checksum working",
        "No hay checksum working verificable en el manifiesto o fue omitido por --skip-checksums.",
      ),
    );
  }

  if (verifyChecksums && candidate.rawPath && candidate.rawChecksumSha256 && existsSync(resolvePreflightDataPath(candidate.rawPath))) {
    const actual = await sha256File(resolvePreflightDataPath(candidate.rawPath));
    checks.push(
      check(
        actual === candidate.rawChecksumSha256 ? "compatible" : "blocker",
        "raw_checksum",
        "Checksum raw",
        actual === candidate.rawChecksumSha256
          ? "SHA-256 raw coincide con el manifiesto."
          : `SHA-256 raw no coincide. Manifest=${candidate.rawChecksumSha256}; local=${actual}.`,
      ),
    );
  }

  return checks;
}

async function sampleCandidateRows(
  candidate: AduanaPreflightCandidate,
  sampleRows: number,
): Promise<{ sample: AduanaPreflightSample; checks: AduanaPreflightCheck[] }> {
  const layout = expectedLayout(candidate.tradeFlow);
  const checks: AduanaPreflightCheck[] = [];
  const fieldCounts: Record<string, number> = {};
  const observedRiskCodes: AduanaPreflightSample["observedRiskCodes"] = [];
  const riskFields = riskCodeFields(candidate.tradeFlow);
  const workingPath = resolvePreflightDataPath(candidate.workingPath);

  if (!existsSync(workingPath)) {
    return {
      sample: {
        sampleRowsRequested: sampleRows,
        rowsRead: 0,
        parsedRows: 0,
        failedRows: 0,
        firstRowLooksLikeHeader: false,
        fieldCounts,
        observedRiskCodes,
      },
      checks: [
        check(
          "blocker",
          "sample_rows",
          "Muestra raw",
          "No se pudo leer la muestra porque el archivo working no existe.",
        ),
      ],
    };
  }

  const reader = createInterface({
    input: createReadStream(workingPath).pipe(iconv.decodeStream("win1252")),
    crlfDelay: Infinity,
  });

  let rowsRead = 0;
  let parsedRows = 0;
  let failedRows = 0;
  let firstRowLooksLikeHeader = false;

  for await (const line of reader) {
    if (rowsRead >= sampleRows) {
      break;
    }

    rowsRead += 1;
    const parsed = parseAduanaRow(line, rowsRead, layout.fieldNames);
    fieldCounts[String(parsed.fieldCount)] = (fieldCounts[String(parsed.fieldCount)] ?? 0) + 1;

    if (rowsRead === 1) {
      const rawValues = Object.values(parsed.rawValues);
      firstRowLooksLikeHeader = layout.fieldNames
        .slice(0, 5)
        .every((fieldName, index) => rawValues[index] === fieldName);
    }

    if (parsed.parseErrors.length > 0) {
      failedRows += 1;
    } else {
      parsedRows += 1;
    }

    for (const [field, codes] of Object.entries(riskFields)) {
      const value = parsed.rawValues[field]?.trim();
      if (value && codes[value] && !observedRiskCodes.some((risk) => risk.field === field && risk.code === value)) {
        observedRiskCodes.push({ field, code: value, risk: codes[value] });
      }
    }
  }

  checks.push(
    check(
      rowsRead > 0 ? "compatible" : "blocker",
      "sample_rows",
      "Muestra raw",
      rowsRead > 0 ? `Se leyeron ${rowsRead} filas de muestra.` : "No se pudo leer ninguna fila de muestra.",
    ),
  );
  checks.push(
    check(
      failedRows === 0 ? "compatible" : "blocker",
      "field_count",
      "Conteo de campos",
      failedRows === 0
        ? `Todas las filas muestreadas calzan con ${layout.fieldNames.length} campos.`
        : `${failedRows} de ${rowsRead} filas no calzan con ${layout.fieldNames.length} campos.`,
    ),
  );
  checks.push(
    check(
      firstRowLooksLikeHeader ? "blocker" : "compatible",
      "header",
      "Encabezado",
      firstRowLooksLikeHeader
        ? "La primera fila parece encabezado; el parser actual espera archivo sin encabezado."
        : "La muestra no parece incluir encabezado; compatible con el parser actual.",
    ),
  );
  checks.push(
    check(
      observedRiskCodes.length > 0 ? "warning" : "compatible",
      "known_code_table_risks",
      "Riesgos de diccionario",
      observedRiskCodes.length > 0
        ? `La muestra contiene códigos pendientes: ${observedRiskCodes.map((risk) => `${risk.field}=${risk.code}`).join(", ")}.`
        : "La muestra no expuso los códigos de diccionario pendientes conocidos.",
    ),
  );
  checks.push(
    check(
      "compatible",
      "anonymous_correlatives",
      "Correlativos anónimos",
      candidate.tradeFlow === "import"
        ? "NUM_UNICO_IMPORTADOR debe tratarse como identificador anónimo Aduana, no RUT ni nombre legal."
        : "NRO_EXPORTADOR/NRO_EXPORTADOR_SEC deben tratarse como identificadores anónimos Aduana, no RUT ni nombre legal.",
    ),
  );

  return {
    sample: {
      sampleRowsRequested: sampleRows,
      rowsRead,
      parsedRows,
      failedRows,
      firstRowLooksLikeHeader,
      fieldCounts,
      observedRiskCodes,
    },
    checks,
  };
}

export async function preflightCandidate(
  candidate: AduanaPreflightCandidate,
  options: { sampleRows: number; verifyChecksums: boolean },
): Promise<AduanaPreflightCandidateReport> {
  const [fileCheckRows, sampleResult] = await Promise.all([
    fileChecks(candidate, options.verifyChecksums),
    sampleCandidateRows(candidate, options.sampleRows),
  ]);
  const checks = [
    ...metadataChecks(candidate),
    ...layoutChecks(candidate),
    ...fileCheckRows,
    ...sampleResult.checks,
    ...payloadRetentionChecks(),
  ];
  const layout = expectedLayout(candidate.tradeFlow);
  const status = maxStatus(checks.map((row) => row.status));

  return {
    candidate,
    status,
    checks,
    expectedLayout: {
      name: layout.name,
      fieldCount: layout.fieldNames.length,
      codedFields: [...layout.codedFields].sort(),
    },
    sample: sampleResult.sample,
  };
}

export async function runAduanaLoadPreflight(
  args: AduanaLoadPreflightArgs,
): Promise<AduanaLoadPreflightReport> {
  const candidates = [
    ...loadManifestCandidates(args),
    ...args.workingPaths.map((workingPath) => candidateFromWorkingPath(args, workingPath)),
  ];

  if (candidates.length === 0) {
    throw new Error(
      "No preflight candidates found. Pass --normalized-raw-filename, --period, or --working-path.",
    );
  }

  const reports = [];
  for (const candidate of candidates) {
    reports.push(
      await preflightCandidate(candidate, {
        sampleRows: args.sampleRows,
        verifyChecksums: args.verifyChecksums,
      }),
    );
  }

  const statuses = reports.map((report) => report.status);
  const overallStatus = maxStatus(statuses);

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    mode: "read-only",
    databaseWritesAttempted: false,
    summary: {
      candidates: reports.length,
      compatible: statuses.filter((status) => status === "compatible").length,
      warnings: statuses.filter((status) => status === "warning").length,
      manualReview: statuses.filter((status) => status === "manual_review").length,
      blockers: statuses.filter((status) => status === "blocker").length,
      overallStatus,
    },
    caveats: [
      "Este preflight no inserta source_files, import_batches, raw_trade_rows ni trade_records.",
      "La compatibilidad se basa en muestras locales y en el layout DIN/DUS March 2026; no reemplaza una carga dev controlada.",
      "Los correlativos Aduana de importador/exportador siguen siendo identificadores anónimos, no nombres legales ni RUT verificados.",
    ],
    candidates: reports,
  };
}

async function main() {
  const args = parseAduanaLoadPreflightArgs(process.argv.slice(2));
  const report = await runAduanaLoadPreflight(args);
  process.stdout.write(JSON.stringify(report, null, args.pretty ? 2 : 0));
  process.stdout.write("\n");
  process.stderr.write(
    `Aduana load preflight: ${report.summary.candidates} candidates, status ${report.summary.overallStatus}, ${report.summary.blockers} blockers.\n`,
  );
  if (report.summary.blockers > 0) {
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Aduana load preflight failed: ${message}\n`);
    process.exitCode = 1;
  });
}
