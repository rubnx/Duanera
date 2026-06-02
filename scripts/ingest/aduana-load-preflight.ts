import { pathToFileURL } from "node:url";

import {
  candidateFromWorkingPath,
  loadManifestCandidates,
  parseAduanaLoadPreflightArgs,
  type AduanaLoadPreflightArgs,
} from "./aduana-load-preflight-candidates";
import {
  expectedLayout,
  layoutChecks,
  maxStatus,
  metadataChecks,
  payloadRetentionChecks,
} from "./aduana-load-preflight-checks";
import { fileChecks } from "./aduana-load-preflight-files";
import { sampleCandidateRows } from "./aduana-load-preflight-sampling";

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
