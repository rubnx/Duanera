import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { config } from "dotenv";

import type { DbClient } from "../../src/db/client";
import { listIdentityEvidenceGroups } from "../../src/research/identity-evidence";

type BultoMark = {
  declarationId: string;
  itemNumber: string;
  packageType: string;
  quantity: string;
  mark: string;
};

const repoRoot = process.cwd();
const defaultExportBultosPath =
  "data/sources/chile-aduana/datos-gob-cl/exports/working/cl_aduana_exports_2026_03_bultos.txt";

type IdentityEvidenceReportArgs = {
  flow: "import" | "export";
  limit: number;
};

export function parseArgs(argv: string[]): IdentityEvidenceReportArgs {
  const flow = argv.includes("--export") ? "export" : "import";
  const limitArg = argv.find((arg) => arg.startsWith("--limit="));
  const limit = limitArg ? Number(limitArg.split("=")[1]) : 5;

  return {
    flow: flow as "import" | "export",
    limit: Number.isFinite(limit) ? Math.min(Math.max(Math.trunc(limit), 1), 10) : 5,
  };
}

function clean(value: string | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

export function isUsefulBultoMark(value: string) {
  const normalized = value.toUpperCase();
  if (!normalized || normalized === "ROTUL." || normalized === "ROTUL") {
    return false;
  }

  if (/^[A-Z]{4}\d{7}$/.test(normalized)) {
    return false;
  }

  if (/^[0-9.,/ -]+$/.test(normalized)) {
    return false;
  }

  return /[A-ZÁÉÍÓÚÑ]/i.test(value);
}

function bultoKey(declarationId: string, itemNumber: string | number) {
  return `${clean(declarationId)}:${clean(String(itemNumber))}`;
}

export function resolveResearchDataPath(localPath: string): string {
  const absolutePath = path.resolve(repoRoot, localPath);
  const relativePath = path.relative(repoRoot, absolutePath);
  const posixRelativePath = relativePath.split(path.sep).join("/");

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error(`${localPath}: research data path must stay inside the repository.`);
  }

  if (posixRelativePath !== "data" && !posixRelativePath.startsWith("data/")) {
    throw new Error(`${localPath}: research data path must be inside the ignored data/ archive.`);
  }

  return absolutePath;
}

export function readExportBultoMarks(
  declarationIds: Set<string>,
  options: {
    filePath?: string;
    warn?: (message: string) => void;
  } = {},
) {
  if (declarationIds.size === 0) {
    return new Map<string, BultoMark[]>();
  }

  const marksByItem = new Map<string, BultoMark[]>();
  const exportBultosPath = resolveResearchDataPath(
    options.filePath ?? defaultExportBultosPath,
  );

  if (!existsSync(exportBultosPath)) {
    options.warn?.(
      `Export bulto companion file not found; skipping companion marks: ${exportBultosPath}`,
    );
    return marksByItem;
  }

  const text = readFileSync(exportBultosPath, "latin1");

  for (const line of text.split(/\r?\n/)) {
    if (!line) {
      continue;
    }

    const [declarationId, , itemNumber, packageType, quantity, mark] = line.split(";");
    if (!declarationId || !declarationIds.has(declarationId)) {
      continue;
    }

    const normalizedMark = clean(mark);
    if (!isUsefulBultoMark(normalizedMark)) {
      continue;
    }

    const normalizedItemNumber = clean(itemNumber);
    const key = bultoKey(declarationId, normalizedItemNumber);
    const existing = marksByItem.get(key) ?? [];
    if (existing.length < 5) {
      existing.push({
        declarationId,
        itemNumber: normalizedItemNumber,
        packageType: clean(packageType),
        quantity: clean(quantity),
        mark: normalizedMark,
      });
      marksByItem.set(key, existing);
    }
  }

  return marksByItem;
}

export async function runIdentityEvidenceReport(
  database: DbClient,
  argv: string[] = process.argv.slice(2),
) {
  const args = parseArgs(argv);
  const groups = await listIdentityEvidenceGroups(database, {
    tradeFlow: args.flow,
    groupLimit: args.limit,
    sampleLimit: 4,
    minRecords: 50,
  });

  const declarationIds = new Set(
    groups
      .flatMap((group) => group.records)
      .map((record) => record.declarationIdRaw)
      .filter((value): value is string => Boolean(value)),
  );
  const bultoMarks =
    args.flow === "export"
      ? readExportBultoMarks(declarationIds, {
          warn: (message) => process.stderr.write(`${message}\n`),
        })
      : new Map();

  process.stdout.write("Duanera internal identity-evidence report\n");
  process.stdout.write(`Flow: ${args.flow}\n`);
  process.stdout.write("Period: 2026-03\n");
  process.stdout.write(
    "Caveat: anonymous Aduana correlatives are not legal company identities; all signals are unverified review evidence.\n",
  );
  process.stdout.write("\n");

  for (const group of groups) {
    process.stdout.write(
      `${group.tradeFlow.toUpperCase()} ${group.participantRole} ${group.correlativeId}\n`,
    );
    process.stdout.write(
      `records=${group.recordCount} declarations=${group.declarationCount} hs_codes=${group.hsCodeCount} countries=${group.countryCount}\n`,
    );
    process.stdout.write(`summary=${group.evidenceSummary}\n`);

    for (const record of group.records.slice(0, 3)) {
      process.stdout.write(
        `  record=${record.id} declaration=${record.declarationIdRaw ?? "unknown"} hs=${record.hsCodeNormalized ?? "unknown"} row=${record.rawRowNumber}\n`,
      );
      for (const signal of record.evidenceSignals.slice(0, 4)) {
        process.stdout.write(
          `    [${signal.strength}] ${signal.label}: ${signal.value} (${signal.caveat})\n`,
        );
      }

      const marks =
        record.declarationIdRaw && record.itemNumber !== null
          ? bultoMarks.get(bultoKey(record.declarationIdRaw, record.itemNumber)) ?? []
          : [];
      for (const mark of marks) {
        process.stdout.write(
          `    [bulto_companion] Bulto item ${mark.itemNumber}: ${mark.mark} (${mark.packageType}, ${mark.quantity})\n`,
        );
      }
    }
    process.stdout.write("\n");
  }

  return { flow: args.flow, groupCount: groups.length };
}

async function main() {
  config({ path: ".env.local" });
  config();

  const { db } = await import("../../src/db/client");
  await runIdentityEvidenceReport(db);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Identity evidence report failed: ${message}\n`);
    process.exitCode = 1;
  });
}
