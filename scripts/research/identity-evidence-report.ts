import { existsSync, readFileSync } from "node:fs";
import { config } from "dotenv";

config({ path: ".env.local" });
config();

const { db } = await import("../../src/db/client");
const { listIdentityEvidenceGroups } = await import(
  "../../src/research/identity-evidence"
);

type BultoMark = {
  declarationId: string;
  itemNumber: string;
  packageType: string;
  quantity: string;
  mark: string;
};

const exportBultosPath =
  "data/sources/chile-aduana/datos-gob-cl/exports/working/cl_aduana_exports_2026_03_bultos.txt";

function parseArgs(argv: string[]) {
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

function isUsefulBultoMark(value: string) {
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

function readExportBultoMarks(declarationIds: Set<string>) {
  if (declarationIds.size === 0) {
    return new Map<string, BultoMark[]>();
  }

  const marksByItem = new Map<string, BultoMark[]>();
  if (!existsSync(exportBultosPath)) {
    console.warn(
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

const args = parseArgs(process.argv.slice(2));
const groups = await listIdentityEvidenceGroups(db, {
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
  args.flow === "export" ? readExportBultoMarks(declarationIds) : new Map();

console.log("Duanera internal identity-evidence report");
console.log(`Flow: ${args.flow}`);
console.log("Period: 2026-03");
console.log(
  "Caveat: anonymous Aduana correlatives are not legal company identities; all signals are unverified review evidence.",
);
console.log("");

for (const group of groups) {
  console.log(
    `${group.tradeFlow.toUpperCase()} ${group.participantRole} ${group.correlativeId}`,
  );
  console.log(
    `records=${group.recordCount} declarations=${group.declarationCount} hs_codes=${group.hsCodeCount} countries=${group.countryCount}`,
  );
  console.log(`summary=${group.evidenceSummary}`);

  for (const record of group.records.slice(0, 3)) {
    console.log(
      `  record=${record.id} declaration=${record.declarationIdRaw ?? "unknown"} hs=${record.hsCodeNormalized ?? "unknown"} row=${record.rawRowNumber}`,
    );
    for (const signal of record.evidenceSignals.slice(0, 4)) {
      console.log(
        `    [${signal.strength}] ${signal.label}: ${signal.value} (${signal.caveat})`,
      );
    }

    const marks =
      record.declarationIdRaw && record.itemNumber !== null
        ? bultoMarks.get(bultoKey(record.declarationIdRaw, record.itemNumber)) ?? []
        : [];
    for (const mark of marks) {
      console.log(
        `    [bulto_companion] Bulto item ${mark.itemNumber}: ${mark.mark} (${mark.packageType}, ${mark.quantity})`,
      );
    }
  }
  console.log("");
}
