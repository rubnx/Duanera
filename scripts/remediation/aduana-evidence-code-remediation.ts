import { config } from "dotenv";
import { and, eq, inArray, sql } from "drizzle-orm";
import { pathToFileURL } from "node:url";

import type { DbClient } from "../../src/db/client";
import { assertDevDatabaseTarget } from "../../src/db/dev-guard";
import { codeTables, codeValues } from "../../src/db/schema";

const remediationId = "chile_aduana_evidence_codes_anexo_51_2026_06_02";
const confirmationEnv = "ADUANA_EVIDENCE_CODE_REMEDIATION_CONFIRM";
const baselineWorkbookSha256 =
  "9a06201c5b1450851ff11188457876f0ed29ac60817af2832e3d16fc972c9376";
const baselineWorkbookFilename = "cl_aduana_code_tables_2026_05_26_raw.xlsx";

const expectedScope = new Map([
  ["chile_aduana:aduanas", ["56"]],
  ["chile_aduana:puertos", ["825"]],
  ["chile_aduana:moneda", ["141", "145", "147", "149", "157"]],
]);

const forbiddenScopedValues = new Set([
  "chile_aduana:puertos:0",
  "chile_aduana:tipos_de_carga:S",
  "chile_aduana:puertos:56",
  "chile_aduana:moneda:56",
  "chile_aduana:puertos:141",
  "chile_aduana:puertos:145",
  "chile_aduana:puertos:147",
  "chile_aduana:puertos:149",
  "chile_aduana:puertos:157",
]);

type EvidenceSourceKind =
  | "official_anexo_51_1_current"
  | "official_anexo_51_11_update"
  | "official_anexo_51_20_current";

export type ReviewedEvidenceCodeValue = {
  codeTableKey: string;
  codeValue: string;
  labelEs: string;
  evidenceSource: string;
  evidenceUrl: string;
  evidenceTable: string;
  evidenceDate: string;
  sourceKind: EvidenceSourceKind;
  marchApril2026Impact: string;
};

export type ExistingEvidenceCodeValue = {
  codeTableKey: string;
  codeValue: string;
  labelEs: string | null;
  normalizedLabelEs: string | null;
  reviewStatus: string;
  metadata: unknown;
};

export type EvidenceRemediationAction = "insert" | "update" | "noop";

export type PlannedEvidenceCodeValue = ReviewedEvidenceCodeValue & {
  action: EvidenceRemediationAction;
  normalizedLabelEs: string;
  metadata: EvidenceCodeRemediationMetadata;
};

export type EvidenceCodeRemediationMetadata = {
  remediation_id: string;
  evidence_class: "official_label_found";
  source_kind: EvidenceSourceKind;
  evidence_source: string;
  evidence_url: string;
  evidence_table: string;
  evidence_date: string;
  evidence_confidence: "high";
  march_april_2026_impact: string;
  baseline_workbook_filename: string;
  baseline_workbook_sha256: string;
  applied_by: string;
};

const currentAduanaAnnexUrl =
  "https://www.aduana.cl/compendio-de-normas-anexo-51-b/aduana/2009-11-19/163937.html";
const bcnResolution2222Url = "https://www.bcn.cl/leychile/navegar?f=2022-08-26&i=1180469";

export const reviewedEvidenceCodeValues: ReviewedEvidenceCodeValue[] = [
  {
    codeTableKey: "chile_aduana:aduanas",
    codeValue: "56",
    labelEs: "Araucanía",
    evidenceSource: "Live Aduana Anexo 51-1 lists code 56 as ARAUCANÍA.",
    evidenceUrl: currentAduanaAnnexUrl,
    evidenceTable: "Anexo 51-1",
    evidenceDate: "2026-06-02",
    sourceKind: "official_anexo_51_1_current",
    marchApril2026Impact: "958 import records and 369 export records",
  },
  {
    codeTableKey: "chile_aduana:puertos",
    codeValue: "825",
    labelEs: "Aeródromo La Araucanía",
    evidenceSource:
      "Resolución Exenta 2222, published 2022-08-26, adds Aeródromo La Araucanía to Anexo 51-11 with code 825.",
    evidenceUrl: bcnResolution2222Url,
    evidenceTable: "Anexo 51-11",
    evidenceDate: "2022-08-26",
    sourceKind: "official_anexo_51_11_update",
    marchApril2026Impact: "1 import disembark record and 1 export embark record",
  },
  {
    codeTableKey: "chile_aduana:moneda",
    codeValue: "141",
    labelEs: "Zloty",
    evidenceSource: "Live Aduana Anexo 51-20 lists import MONEDA code 141 as Zloty.",
    evidenceUrl: currentAduanaAnnexUrl,
    evidenceTable: "Anexo 51-20",
    evidenceDate: "2026-06-02",
    sourceKind: "official_anexo_51_20_current",
    marchApril2026Impact: "4 import records",
  },
  {
    codeTableKey: "chile_aduana:moneda",
    codeValue: "145",
    labelEs: "Baht tailandés",
    evidenceSource: "Live Aduana Anexo 51-20 lists import MONEDA code 145 as Baht tailandés.",
    evidenceUrl: currentAduanaAnnexUrl,
    evidenceTable: "Anexo 51-20",
    evidenceDate: "2026-06-02",
    sourceKind: "official_anexo_51_20_current",
    marchApril2026Impact: "2 import records",
  },
  {
    codeTableKey: "chile_aduana:moneda",
    codeValue: "147",
    labelEs: "Ringgit",
    evidenceSource: "Live Aduana Anexo 51-20 lists import MONEDA code 147 as Ringgit.",
    evidenceUrl: currentAduanaAnnexUrl,
    evidenceTable: "Anexo 51-20",
    evidenceDate: "2026-06-02",
    sourceKind: "official_anexo_51_20_current",
    marchApril2026Impact: "2 import records",
  },
  {
    codeTableKey: "chile_aduana:moneda",
    codeValue: "149",
    labelEs: "Rupia Indonesia",
    evidenceSource: "Live Aduana Anexo 51-20 lists import MONEDA code 149 as Rupia Indonesia.",
    evidenceUrl: currentAduanaAnnexUrl,
    evidenceTable: "Anexo 51-20",
    evidenceDate: "2026-06-02",
    sourceKind: "official_anexo_51_20_current",
    marchApril2026Impact: "2 import records",
  },
  {
    codeTableKey: "chile_aduana:moneda",
    codeValue: "157",
    labelEs: "Leu rumano",
    evidenceSource: "Live Aduana Anexo 51-20 lists import MONEDA code 157 as Leu rumano.",
    evidenceUrl: currentAduanaAnnexUrl,
    evidenceTable: "Anexo 51-20",
    evidenceDate: "2026-06-02",
    sourceKind: "official_anexo_51_20_current",
    marchApril2026Impact: "1 import record",
  },
];

export function normalizeEvidenceLabel(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function evidenceCodeRemediationMetadata(
  row: ReviewedEvidenceCodeValue,
): EvidenceCodeRemediationMetadata {
  return {
    remediation_id: remediationId,
    evidence_class: "official_label_found",
    source_kind: row.sourceKind,
    evidence_source: row.evidenceSource,
    evidence_url: row.evidenceUrl,
    evidence_table: row.evidenceTable,
    evidence_date: row.evidenceDate,
    evidence_confidence: "high",
    march_april_2026_impact: row.marchApril2026Impact,
    baseline_workbook_filename: baselineWorkbookFilename,
    baseline_workbook_sha256: baselineWorkbookSha256,
    applied_by: "scripts/remediation/aduana-evidence-code-remediation.ts",
  };
}

function scopedKey(row: Pick<ReviewedEvidenceCodeValue, "codeTableKey" | "codeValue">): string {
  return `${row.codeTableKey}:${row.codeValue}`;
}

function metadataObject(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  return Object.fromEntries(Object.entries(value));
}

function metadataMatches(value: unknown, expected: EvidenceCodeRemediationMetadata): boolean {
  const candidate = metadataObject(value);
  if (!candidate) {
    return false;
  }

  return Object.entries(expected).every(([key, expectedValue]) => candidate[key] === expectedValue);
}

export function assertReviewedEvidenceCodeRemediationScope(
  rows: ReviewedEvidenceCodeValue[] = reviewedEvidenceCodeValues,
): void {
  const expectedKeys = [...expectedScope.entries()]
    .flatMap(([codeTableKey, codes]) => codes.map((codeValue) => `${codeTableKey}:${codeValue}`))
    .sort((a, b) => a.localeCompare(b));
  const actualKeys = rows.map(scopedKey).sort((a, b) => a.localeCompare(b));
  const forbidden = actualKeys.filter((key) => forbiddenScopedValues.has(key));

  if (forbidden.length > 0) {
    throw new Error(
      `Reviewed evidence-code remediation includes forbidden scoped values: ${forbidden.join(",")}.`,
    );
  }

  if (actualKeys.join(",") !== expectedKeys.join(",")) {
    throw new Error(`Reviewed evidence-code remediation scope changed: ${actualKeys.join(",")}.`);
  }

  if (new Set(actualKeys).size !== actualKeys.length) {
    throw new Error("Reviewed evidence-code remediation contains duplicate scoped values.");
  }
}

export function planEvidenceCodeValueRemediation(
  existingRows: ExistingEvidenceCodeValue[],
): PlannedEvidenceCodeValue[] {
  assertReviewedEvidenceCodeRemediationScope();
  const existingByKey = new Map(existingRows.map((row) => [scopedKey(row), row]));

  return reviewedEvidenceCodeValues.map((row) => {
    const normalizedLabelEs = normalizeEvidenceLabel(row.labelEs);
    const metadata = evidenceCodeRemediationMetadata(row);
    const existing = existingByKey.get(scopedKey(row));
    const action: EvidenceRemediationAction = !existing
      ? "insert"
      : existing.labelEs === row.labelEs &&
          existing.normalizedLabelEs === normalizedLabelEs &&
          existing.reviewStatus === "reviewed_official_update" &&
          metadataMatches(existing.metadata, metadata)
        ? "noop"
        : "update";

    return {
      ...row,
      action,
      normalizedLabelEs,
      metadata,
    };
  });
}

function actionCounts(plan: PlannedEvidenceCodeValue[]) {
  return plan.reduce(
    (counts, row) => {
      counts[row.action] += 1;
      return counts;
    },
    { insert: 0, update: 0, noop: 0 } satisfies Record<EvidenceRemediationAction, number>,
  );
}

async function loadCodeTableIds(db: DbClient): Promise<Map<string, string>> {
  const keys = [...expectedScope.keys()];
  const rows = await db
    .select({ id: codeTables.id, codeTableKey: codeTables.codeTableKey })
    .from(codeTables)
    .where(inArray(codeTables.codeTableKey, keys));

  const idsByKey = new Map(rows.map((row) => [row.codeTableKey, row.id]));
  const missingKeys = keys.filter((key) => !idsByKey.has(key));
  if (missingKeys.length > 0) {
    throw new Error(`Missing code tables: ${missingKeys.join(", ")}. Run db:seed:code-tables first.`);
  }

  return idsByKey;
}

async function loadExistingTargetRows(
  db: DbClient,
  codeTableIdsByKey: Map<string, string>,
): Promise<ExistingEvidenceCodeValue[]> {
  const rows: ExistingEvidenceCodeValue[] = [];

  for (const [codeTableKey, targetCodes] of expectedScope) {
    const codeTableId = codeTableIdsByKey.get(codeTableKey);
    if (!codeTableId) {
      throw new Error(`Missing loaded code table id for ${codeTableKey}.`);
    }

    const tableRows = await db
      .select({
        codeValue: codeValues.codeValue,
        labelEs: codeValues.labelEs,
        normalizedLabelEs: codeValues.normalizedLabelEs,
        reviewStatus: codeValues.reviewStatus,
        metadata: codeValues.metadata,
      })
      .from(codeValues)
      .where(and(eq(codeValues.codeTableId, codeTableId), inArray(codeValues.codeValue, targetCodes)));

    rows.push(...tableRows.map((row) => ({ codeTableKey, ...row })));
  }

  return rows;
}

async function applyPlannedRows(
  db: DbClient,
  codeTableIdsByKey: Map<string, string>,
  plan: PlannedEvidenceCodeValue[],
) {
  const rowsToApply = plan.filter((row) => row.action !== "noop");

  for (const row of rowsToApply) {
    const codeTableId = codeTableIdsByKey.get(row.codeTableKey);
    if (!codeTableId) {
      throw new Error(`Missing loaded code table id for ${row.codeTableKey}.`);
    }

    await db
      .insert(codeValues)
      .values({
        codeTableId,
        codeValue: row.codeValue,
        labelEs: row.labelEs,
        normalizedLabelEs: row.normalizedLabelEs,
        metadata: row.metadata,
        reviewStatus: "reviewed_official_update",
      })
      .onConflictDoUpdate({
        target: [codeValues.codeTableId, codeValues.codeValue],
        set: {
          labelEs: sql`excluded.label_es`,
          normalizedLabelEs: sql`excluded.normalized_label_es`,
          metadata: sql`excluded.metadata`,
          reviewStatus: sql`excluded.review_status`,
          updatedAt: new Date(),
        },
      });
  }

  return rowsToApply.length;
}

function parseApplyMode(args: string[]): boolean {
  if (args.includes("--dry-run")) {
    return false;
  }

  return args.includes("--apply");
}

export async function runEvidenceCodeTableRemediation({
  apply,
  db,
}: {
  apply: boolean;
  db: DbClient;
}) {
  assertReviewedEvidenceCodeRemediationScope();
  const codeTableIdsByKey = await loadCodeTableIds(db);
  const existingRows = await loadExistingTargetRows(db, codeTableIdsByKey);
  const plan = planEvidenceCodeValueRemediation(existingRows);
  const counts = actionCounts(plan);

  let appliedRows = 0;
  if (apply) {
    appliedRows = await applyPlannedRows(db, codeTableIdsByKey, plan);
  }

  return {
    mode: apply ? "apply" : "dry-run",
    remediationId,
    targetCodes: [...expectedScope.entries()].map(([codeTableKey, codes]) => ({
      codeTableKey,
      codes,
    })),
    counts,
    appliedRows,
    plan: plan.map((row) => ({
      codeTableKey: row.codeTableKey,
      codeValue: row.codeValue,
      labelEs: row.labelEs,
      action: row.action,
      evidenceTable: row.evidenceTable,
      evidenceUrl: row.evidenceUrl,
    })),
  };
}

async function main() {
  config({ path: ".env.local" });
  config();
  assertDevDatabaseTarget("Aduana evidence-code remediation");

  const apply = parseApplyMode(process.argv.slice(2));
  if (apply && process.env[confirmationEnv] !== "apply") {
    throw new Error(
      `Apply mode requires ${confirmationEnv}=apply. Dry-run is the default.`,
    );
  }

  const { db } = await import("../../src/db/client");
  const result = await runEvidenceCodeTableRemediation({ apply, db });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);

  if (!apply) {
    process.stdout.write(
      `Dry run only. Re-run with --apply and ${confirmationEnv}=apply to update dev code values.\n`,
    );
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Aduana evidence-code remediation failed: ${message}\n`);
    process.exitCode = 1;
  });
}
