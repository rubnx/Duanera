import { createHash } from "node:crypto";
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline";
import { pathToFileURL } from "node:url";

import { parse } from "csv-parse/sync";
import iconv from "iconv-lite";

import {
  importCodedFields,
  importFieldNames,
  exportCodedFields,
  exportFieldNames,
  codeTableKeyForSourceField,
} from "../seed/source-layout-metadata";
import { parseAduanaRow } from "../../src/ingest/aduana-main-file";

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

type Args = {
  manifestFiles: string[];
  normalizedRawFilenames: string[];
  period: string | null;
  tradeFlow: PreflightFlow | null;
  workingPaths: string[];
  year: number | null;
  month: number | null;
  sampleRows: number;
  pretty: boolean;
  verifyChecksums: boolean;
};

const repoRoot = process.cwd();
const defaultManifestFiles = [
  "data/sources/chile-aduana/datos-gob-cl/manifests/cl_aduana_datos_gob_cl_2026_source_files_manifest.csv",
  "data/sources/chile-aduana/aduana-cl/manifests/cl_aduana_aduana_cl_source_files_manifest.csv",
];

const statusRank: Record<PreflightStatus, number> = {
  compatible: 0,
  warning: 1,
  manual_review: 2,
  blocker: 3,
};

function requiredValue(argv: string[], index: number, flag: string) {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value.`);
  }
  return value;
}

function parsePositiveInteger(value: string, flag: string) {
  if (!/^\d+$/.test(value)) {
    throw new Error(`${flag} must be a positive integer.`);
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`${flag} must be a positive safe integer.`);
  }

  return parsed;
}

function parseFlow(value: string): PreflightFlow {
  if (value !== "import" && value !== "export") {
    throw new Error(`--trade-flow must be import or export, got ${value}.`);
  }

  return value;
}

function parsePeriod(value: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) {
    throw new Error(`--period must use YYYY-MM format, got ${value}.`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) {
    throw new Error(`--period month must be between 01 and 12, got ${value}.`);
  }

  return { year, month, period: value };
}

export function parseAduanaLoadPreflightArgs(argv: string[]): Args {
  const args: Args = {
    manifestFiles: [...defaultManifestFiles],
    normalizedRawFilenames: [],
    period: null,
    tradeFlow: null,
    workingPaths: [],
    year: null,
    month: null,
    sampleRows: 50,
    pretty: false,
    verifyChecksums: true,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--pretty") {
      args.pretty = true;
      continue;
    }
    if (arg === "--skip-checksums") {
      args.verifyChecksums = false;
      continue;
    }
    if (arg === "--manifest-file") {
      args.manifestFiles.push(requiredValue(argv, index, arg));
      index += 1;
      continue;
    }
    if (arg === "--normalized-raw-filename") {
      args.normalizedRawFilenames.push(requiredValue(argv, index, arg));
      index += 1;
      continue;
    }
    if (arg === "--working-path") {
      args.workingPaths.push(requiredValue(argv, index, arg));
      index += 1;
      continue;
    }
    if (arg === "--trade-flow") {
      args.tradeFlow = parseFlow(requiredValue(argv, index, arg));
      index += 1;
      continue;
    }
    if (arg === "--period") {
      const parsed = parsePeriod(requiredValue(argv, index, arg));
      args.period = parsed.period;
      args.year = parsed.year;
      args.month = parsed.month;
      index += 1;
      continue;
    }
    if (arg === "--sample-rows") {
      args.sampleRows = parsePositiveInteger(requiredValue(argv, index, arg), arg);
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

function repoRelativePath(absolutePath: string): string {
  const resolvedPath = path.resolve(absolutePath);
  const relativePath = path.relative(repoRoot, resolvedPath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error(`${absolutePath}: preflight path must stay inside the repository.`);
  }

  return relativePath.split(path.sep).join("/");
}

export function resolvePreflightDataPath(value: string): string {
  const absolutePath = path.resolve(repoRoot, value);
  const relativePath = repoRelativePath(absolutePath);
  if (relativePath !== "data" && !relativePath.startsWith("data/")) {
    throw new Error(`${value}: preflight path must be inside the ignored data/ archive.`);
  }

  return absolutePath;
}

function splitPaths(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(/[|;]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function optionalString(value: string | undefined): string | null {
  if (!value || value === "unknown") {
    return null;
  }

  return value;
}

function optionalInteger(value: string | undefined, fieldName: string): number | null {
  const normalized = optionalString(value);
  if (!normalized) {
    return null;
  }
  if (!/^\d+$/.test(normalized)) {
    throw new Error(`${fieldName} must be an integer, got ${value}.`);
  }

  return Number(normalized);
}

function firstPath(value: string | undefined): string | null {
  return splitPaths(value)[0] ?? null;
}

function firstValue(value: string | undefined): string | null {
  return splitPaths(value)[0] ?? optionalString(value);
}

function parseManifestRows(content: string, manifestPath: string): PreflightManifestRow[] {
  const parsed: unknown = parse(content, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
  });

  if (!Array.isArray(parsed)) {
    throw new Error(`${manifestPath}: manifest parser returned a non-array CSV result.`);
  }

  return parsed.map((row, index) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      throw new Error(`${manifestPath}: manifest row ${index} must be an object.`);
    }

    const result: PreflightManifestRow = {};
    for (const [key, value] of Object.entries(row)) {
      if (typeof value !== "string") {
        throw new Error(`${manifestPath}: manifest row ${index} has non-string column ${key}.`);
      }
      result[key] = value;
    }

    return result;
  });
}

export function isMainAduanaDataManifestRow(row: PreflightManifestRow): boolean {
  const filename = row.normalized_raw_filename ?? "";
  const workingFormat = row.working_file_formats ?? "";
  return (
    (row.trade_flow === "import" || row.trade_flow === "export") &&
    row.source_category === "dataset_resource" &&
    Boolean(row.year) &&
    Boolean(row.month) &&
    Boolean(row.working_paths) &&
    workingFormat.includes("txt") &&
    /^cl_aduana_(imports|exports)_\d{4}_\d{2}_raw\.(rar|zip)$/i.test(filename)
  );
}

function inferFlowFromPath(value: string): PreflightFlow | null {
  if (/imports?/i.test(value)) {
    return "import";
  }
  if (/exports?/i.test(value)) {
    return "export";
  }

  return null;
}

export function candidateFromManifestRow(
  row: PreflightManifestRow,
  manifestPath: string,
): AduanaPreflightCandidate {
  const workingPath = firstPath(row.working_paths);
  if (!workingPath) {
    throw new Error(`${row.normalized_raw_filename ?? "manifest row"}: missing working_paths.`);
  }

  const flow = row.trade_flow === "import" || row.trade_flow === "export"
    ? row.trade_flow
    : inferFlowFromPath(`${row.normalized_raw_filename ?? ""} ${workingPath}`);
  if (!flow) {
    throw new Error(`${row.normalized_raw_filename ?? workingPath}: cannot infer import/export flow.`);
  }

  return {
    source: "manifest",
    manifestPath,
    sourceDomain: optionalString(row.source_domain),
    sourceCategory: optionalString(row.source_category),
    country: optionalString(row.country),
    tradeFlow: flow,
    year: optionalInteger(row.year, "year"),
    month: optionalInteger(row.month, "month"),
    period: optionalString(row.period),
    normalizedRawFilename: optionalString(row.normalized_raw_filename),
    rawPath: optionalString(row.raw_path),
    rawFileRole: optionalString(row.raw_file_role),
    rawFileSize: optionalInteger(row.raw_file_size, "raw_file_size"),
    rawChecksumSha256: optionalString(row.raw_checksum_sha256),
    workingPath,
    workingFileFormat: firstValue(row.working_file_formats),
    workingFileSize: optionalInteger(firstValue(row.working_file_sizes) ?? undefined, "working_file_sizes"),
    workingChecksumSha256: firstValue(row.working_checksum_sha256) ?? null,
  };
}

function candidateFromWorkingPath(args: Args, workingPath: string): AduanaPreflightCandidate {
  const flow = args.tradeFlow ?? inferFlowFromPath(workingPath);
  if (!flow) {
    throw new Error(`${workingPath}: --trade-flow is required when flow cannot be inferred.`);
  }

  return {
    source: "working_path",
    manifestPath: null,
    sourceDomain: null,
    sourceCategory: null,
    country: "CL",
    tradeFlow: flow,
    year: args.year,
    month: args.month,
    period: args.period,
    normalizedRawFilename: null,
    rawPath: null,
    rawFileRole: null,
    rawFileSize: null,
    rawChecksumSha256: null,
    workingPath,
    workingFileFormat: path.extname(workingPath).replace(".", "") || null,
    workingFileSize: null,
    workingChecksumSha256: null,
  };
}

function loadManifestCandidates(args: Args): AduanaPreflightCandidate[] {
  const candidates: AduanaPreflightCandidate[] = [];
  const filenameFilter = new Set(args.normalizedRawFilenames);

  for (const manifestFile of args.manifestFiles) {
    const manifestPath = resolvePreflightDataPath(manifestFile);
    if (!existsSync(manifestPath)) {
      continue;
    }

    const rows = parseManifestRows(readFileSync(manifestPath, "utf8"), repoRelativePath(manifestPath));
    for (const row of rows) {
      const selectedByFilename =
        filenameFilter.size > 0 && filenameFilter.has(row.normalized_raw_filename ?? "");
      const selectedByFilters =
        filenameFilter.size === 0 &&
        isMainAduanaDataManifestRow(row) &&
        (!args.tradeFlow || row.trade_flow === args.tradeFlow) &&
        (!args.period || row.period === args.period);

      if (!selectedByFilename && !selectedByFilters) {
        continue;
      }

      candidates.push(candidateFromManifestRow(row, repoRelativePath(manifestPath)));
    }
  }

  return candidates;
}

function expectedLayout(flow: PreflightFlow): {
  name: string;
  fieldNames: readonly string[];
  codedFields: Set<string>;
} {
  if (flow === "import") {
    return {
      name: "DIN main item file",
      fieldNames: importFieldNames,
      codedFields: importCodedFields,
    };
  }

  return {
    name: "DUS main item file",
    fieldNames: exportFieldNames,
    codedFields: exportCodedFields,
  };
}

function maxStatus(statuses: PreflightStatus[]): PreflightStatus {
  return statuses.reduce<PreflightStatus>(
    (current, status) => (statusRank[status] > statusRank[current] ? status : current),
    "compatible",
  );
}

function check(status: PreflightStatus, key: string, title: string, detail: string): AduanaPreflightCheck {
  return { key, status, title, detail };
}

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

function metadataChecks(candidate: AduanaPreflightCandidate): AduanaPreflightCheck[] {
  const checks: AduanaPreflightCheck[] = [];
  checks.push(
    check(
      candidate.country === "CL" ? "compatible" : "manual_review",
      "country",
      "País fuente",
      candidate.country === "CL"
        ? "Fuente clasificada como Chile."
        : "El país no está confirmado como CL; revisar antes de usar el parser Aduana Chile.",
    ),
  );

  checks.push(
    check(
      candidate.sourceDomain === "datos.gob.cl" || candidate.source === "working_path"
        ? "compatible"
        : "manual_review",
      "source_domain",
      "Dominio fuente",
      candidate.sourceDomain === "datos.gob.cl"
        ? "Fuente datos.gob.cl compatible con el parser DIN/DUS actual."
        : candidate.source === "working_path"
          ? "Ruta working directa; no hay dominio de manifiesto para validar."
          : "Fuente distinta de datos.gob.cl; puede ser archivo operativo Aduana.cl y requiere revisión manual.",
    ),
  );

  const expectedPeriod =
    candidate.year && candidate.month ? `${candidate.year}-${String(candidate.month).padStart(2, "0")}` : null;
  checks.push(
    check(
      expectedPeriod && candidate.period && expectedPeriod !== candidate.period ? "warning" : "compatible",
      "period",
      "Periodo",
      expectedPeriod && candidate.period && expectedPeriod !== candidate.period
        ? `El año/mes (${expectedPeriod}) no coincide con period (${candidate.period}).`
        : `Periodo candidato ${candidate.period ?? expectedPeriod ?? "sin periodo explícito"}.`,
    ),
  );

  checks.push(
    check(
      candidate.rawFileRole === "compressed_source_file" || candidate.rawFileRole === "direct_source_file" || candidate.source === "working_path"
        ? "compatible"
        : "warning",
      "file_role",
      "Rol archivo fuente",
      candidate.rawFileRole
        ? `Rol declarado: ${candidate.rawFileRole}.`
        : "Sin rol raw declarado; confirmar si es fuente oficial o extracto working.",
    ),
  );

  return checks;
}

function riskCodeFields(flow: PreflightFlow): Record<string, Record<string, string>> {
  if (flow === "import") {
    return {
      ADU: { "56": "Aduana 56 sigue sin evidencia oficial de etiqueta en el diccionario actual." },
      MONEDA: {
        "141": "Moneda 141 sigue pendiente de evidencia oficial.",
        "145": "Moneda 145 sigue pendiente de evidencia oficial.",
        "147": "Moneda 147 sigue pendiente de evidencia oficial.",
      },
    };
  }

  return {
    ADUANA: { "56": "Aduana 56 sigue sin evidencia oficial de etiqueta en el diccionario actual." },
    MONEDA: {
      "141": "Moneda 141 sigue pendiente de evidencia oficial.",
      "145": "Moneda 145 sigue pendiente de evidencia oficial.",
      "147": "Moneda 147 sigue pendiente de evidencia oficial.",
    },
  };
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

function layoutChecks(candidate: AduanaPreflightCandidate): AduanaPreflightCheck[] {
  const layout = expectedLayout(candidate.tradeFlow);
  const keyFields =
    candidate.tradeFlow === "import"
      ? ["NUMENCRIPTADO", "NUM_UNICO_IMPORTADOR", "ARANC-NAC", "CIF-ITEM", "TOT_PESO"]
      : ["NUMEROIDENT", "NRO_EXPORTADOR", "CODIGOARANCEL", "FOBUS", "PESOBRUTOITEM"];
  const missingKeyFields = keyFields.filter((field) => !layout.fieldNames.includes(field));
  const codedFieldsWithoutDictionary = [...layout.codedFields].filter((field) => !codeTableKeyForSourceField(field));

  return [
    check(
      missingKeyFields.length === 0 ? "compatible" : "blocker",
      "required_fields",
      "Campos comerciales clave",
      missingKeyFields.length === 0
        ? `Layout ${layout.name} conserva campos clave para normalización MVP.`
        : `Faltan campos clave en el layout esperado: ${missingKeyFields.join(", ")}.`,
    ),
    check(
      codedFieldsWithoutDictionary.length === 0 ? "compatible" : "warning",
      "coded_fields",
      "Campos codificados",
      codedFieldsWithoutDictionary.length === 0
        ? "Los campos codificados principales tienen tabla esperada o no son críticos para filtros actuales."
        : `Hay campos codificados sin tabla confirmada: ${codedFieldsWithoutDictionary.slice(0, 12).join(", ")}.`,
    ),
  ];
}

function payloadRetentionChecks(): AduanaPreflightCheck[] {
  const retention = process.env.RAW_ROW_PAYLOAD_RETENTION;
  return [
    check(
      retention === "errors_and_warnings" ? "compatible" : "warning",
      "payload_retention",
      "Retención de payload",
      retention === "errors_and_warnings"
        ? "RAW_ROW_PAYLOAD_RETENTION=errors_and_warnings está alineado con la recomendación para cargas reales pequeñas."
        : "Si se carga otro mes real en dev, usar RAW_ROW_PAYLOAD_RETENTION=errors_and_warnings para evitar repetir crecimiento full_postgres.",
    ),
  ];
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

export async function runAduanaLoadPreflight(args: Args): Promise<AduanaLoadPreflightReport> {
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
