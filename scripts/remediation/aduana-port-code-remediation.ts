import { config } from "dotenv";
import { and, eq, inArray, sql } from "drizzle-orm";
import { pathToFileURL } from "node:url";

import type { DbClient } from "../../src/db/client";
import { assertDevDatabaseTarget } from "../../src/db/dev-guard";
import { codeTables, codeValues } from "../../src/db/schema";

const portCodeTableKey = "chile_aduana:puertos";
const remediationId = "chile_aduana_ports_anexo_51_11_2026_06_01";
const baselineWorkbookSha256 =
  "9a06201c5b1450851ff11188457876f0ed29ac60817af2832e3d16fc972c9376";
const baselineWorkbookFilename = "cl_aduana_code_tables_2026_05_26_raw.xlsx";

export type ReviewedPortCodeValue = {
  codeValue: string;
  labelEs: string;
  evidenceSource: string;
  evidenceUrl: string;
  publishedDate: string;
  march2026Impact: string;
};

export type ExistingCodeValue = {
  codeValue: string;
  labelEs: string | null;
  normalizedLabelEs: string | null;
  reviewStatus: string;
  metadata: unknown;
};

export type RemediationAction = "insert" | "update" | "noop";

export type PlannedPortCodeValue = ReviewedPortCodeValue & {
  action: RemediationAction;
  normalizedLabelEs: string;
  metadata: PortRemediationMetadata;
};

export type PortRemediationMetadata = {
  remediation_id: string;
  evidence_class: "official_label_found";
  source_kind: "official_anexo_51_11_update";
  evidence_source: string;
  evidence_url: string;
  evidence_published_date: string;
  evidence_confidence: "high";
  march_2026_impact: string;
  baseline_workbook_filename: string;
  baseline_workbook_sha256: string;
  applied_by: string;
};

const forbiddenCodeValues = new Set(["0", "56", "141", "145", "147"]);

export const reviewedPortCodeValues: ReviewedPortCodeValue[] = [
  {
    codeValue: "225",
    labelEs: "Paso Guanaco Sonso",
    evidenceSource:
      "Resolución Exenta 3194, published 2020-11-19, adds Paso Guanaco Sonso to Anexo 51-11 with code 225.",
    evidenceUrl: "https://www.bcn.cl/leychile/navegar?idNorma=1151885",
    publishedDate: "2020-11-19",
    march2026Impact: "1 export embark record",
  },
  {
    codeValue: "817",
    labelEs: "Puerto Cabo Froward",
    evidenceSource:
      "Resolución Exenta 477, published 2021-03-02, adds Puerto Cabo Froward to Anexo 51-11 with code 817.",
    evidenceUrl: "https://www.bcn.cl/leychile/navegar?idNorma=1156469",
    publishedDate: "2021-03-02",
    march2026Impact: "15 import disembark records; 3 export embark records",
  },
  {
    codeValue: "818",
    labelEs: "Muelle Huachipato",
    evidenceSource:
      "Resolución Exenta 2424, published 2021-10-26, adds Muelle Huachipato to Anexo 51-11 with code 818.",
    evidenceUrl: "https://www.bcn.cl/leychile/navegar?i=1167006&f=2021-10-26",
    publishedDate: "2021-10-26",
    march2026Impact: "4 import disembark records",
  },
  {
    codeValue: "819",
    labelEs: "Terminal Marítimo Escuadrón",
    evidenceSource:
      "Resolución Exenta 2424, published 2021-10-26, adds Terminal Marítimo Escuadrón to Anexo 51-11 with code 819.",
    evidenceUrl: "https://www.bcn.cl/leychile/navegar?i=1167006&f=2021-10-26",
    publishedDate: "2021-10-26",
    march2026Impact: "8 import disembark records",
  },
  {
    codeValue: "820",
    labelEs: "Terminal Portuario Terquim",
    evidenceSource:
      "Resolución Exenta 2424, published 2021-10-26, adds Terminal Portuario Terquim to Anexo 51-11 with code 820.",
    evidenceUrl: "https://www.bcn.cl/leychile/navegar?i=1167006&f=2021-10-26",
    publishedDate: "2021-10-26",
    march2026Impact: "15 import disembark records",
  },
  {
    codeValue: "821",
    labelEs: "Terminal Muelle Mecanizado Esperanza",
    evidenceSource:
      "Resolución Exenta 356, published 2022-02-15, adds Terminal Muelle Mecanizado Esperanza to Anexo 51-11 with code 821.",
    evidenceUrl:
      "https://www.diariooficial.interior.gob.cl/publicaciones/2022/02/15/43179/01/2086306.pdf",
    publishedDate: "2022-02-15",
    march2026Impact: "4 export embark records",
  },
  {
    codeValue: "822",
    labelEs: "Terminal Marítimo Enaex",
    evidenceSource:
      "Resolución Exenta 870, published 2022-04-08, adds Terminal Marítimo Enaex to Anexo 51-11 with code 822.",
    evidenceUrl:
      "https://www.diariooficial.interior.gob.cl/publicaciones/2022/04/08/43224/01/2111321.pdf",
    publishedDate: "2022-04-08",
    march2026Impact: "2 import disembark records",
  },
  {
    codeValue: "823",
    labelEs: "Terminal Marítimo Oxiquim",
    evidenceSource:
      "Resolución Exenta 1242, published 2022-05-23, adds Terminal Marítimo Oxiquim to Anexo 51-11 with code 823.",
    evidenceUrl: "https://www.bcn.cl/leychile/navegar?idNorma=1176404",
    publishedDate: "2022-05-23",
    march2026Impact: "10 import disembark records",
  },
  {
    codeValue: "824",
    labelEs: "Paso Buta Mallin",
    evidenceSource:
      "Resolución Exenta 2222, published 2022-08-26, adds Paso Buta Mallin to Anexo 51-11 with code 824.",
    evidenceUrl: "https://www.bcn.cl/leychile/navegar?f=2022-08-26&i=1180469",
    publishedDate: "2022-08-26",
    march2026Impact: "6 import disembark records",
  },
  {
    codeValue: "826",
    labelEs: "Estación de Medición Recinto",
    evidenceSource:
      "Resolución Exenta 2222, published 2022-08-26, adds Estación de Medición Recinto to Anexo 51-11 with code 826.",
    evidenceUrl: "https://www.bcn.cl/leychile/navegar?f=2022-08-26&i=1180469",
    publishedDate: "2022-08-26",
    march2026Impact: "1 import disembark record",
  },
  {
    codeValue: "827",
    labelEs: "Terminal Gráneles del Norte",
    evidenceSource:
      "Resolución Exenta 2800, published 2022-11-04, creates/habilitates code 827 for Terminal Gráneles del Norte and leaves without effect Resolución Exenta 1244.",
    evidenceUrl: "https://www.bcn.cl/leychile/navegar?idNorma=1183791&idVersion=2022-11-04",
    publishedDate: "2022-11-04",
    march2026Impact: "16 export embark records",
  },
];

export function normalizeLabel(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function portRemediationMetadata(row: ReviewedPortCodeValue): PortRemediationMetadata {
  return {
    remediation_id: remediationId,
    evidence_class: "official_label_found",
    source_kind: "official_anexo_51_11_update",
    evidence_source: row.evidenceSource,
    evidence_url: row.evidenceUrl,
    evidence_published_date: row.publishedDate,
    evidence_confidence: "high",
    march_2026_impact: row.march2026Impact,
    baseline_workbook_filename: baselineWorkbookFilename,
    baseline_workbook_sha256: baselineWorkbookSha256,
    applied_by: "scripts/remediation/aduana-port-code-remediation.ts",
  };
}

function metadataMatches(value: unknown, expected: PortRemediationMetadata): boolean {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return Object.entries(expected).every(([key, expectedValue]) => candidate[key] === expectedValue);
}

export function assertReviewedPortRemediationScope(
  rows: ReviewedPortCodeValue[] = reviewedPortCodeValues,
): void {
  const expectedCodes = ["225", "817", "818", "819", "820", "821", "822", "823", "824", "826", "827"];
  const actualCodes = rows.map((row) => row.codeValue).sort((a, b) => a.localeCompare(b));

  const forbidden = actualCodes.filter((code) => forbiddenCodeValues.has(code));
  if (forbidden.length > 0) {
    throw new Error(`Reviewed port remediation includes forbidden code values: ${forbidden.join(",")}.`);
  }

  if (actualCodes.join(",") !== expectedCodes.join(",")) {
    throw new Error(`Reviewed port remediation codes changed: ${actualCodes.join(",")}.`);
  }

  if (new Set(actualCodes).size !== actualCodes.length) {
    throw new Error("Reviewed port remediation contains duplicate code values.");
  }
}

export function planPortCodeValueRemediation(
  existingRows: ExistingCodeValue[],
): PlannedPortCodeValue[] {
  assertReviewedPortRemediationScope();
  const existingByCode = new Map(existingRows.map((row) => [row.codeValue, row]));

  return reviewedPortCodeValues.map((row) => {
    const normalizedLabelEs = normalizeLabel(row.labelEs);
    const metadata = portRemediationMetadata(row);
    const existing = existingByCode.get(row.codeValue);
    const action: RemediationAction = !existing
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

function actionCounts(plan: PlannedPortCodeValue[]) {
  return plan.reduce(
    (counts, row) => {
      counts[row.action] += 1;
      return counts;
    },
    { insert: 0, update: 0, noop: 0 } satisfies Record<RemediationAction, number>,
  );
}

async function loadPortCodeTableId(db: DbClient): Promise<string> {
  const rows = await db
    .select({ id: codeTables.id })
    .from(codeTables)
    .where(eq(codeTables.codeTableKey, portCodeTableKey))
    .limit(1);

  if (!rows[0]) {
    throw new Error(`Code table ${portCodeTableKey} is missing. Run db:seed:code-tables first.`);
  }

  return rows[0].id;
}

async function loadExistingTargetRows(
  db: DbClient,
  codeTableId: string,
): Promise<ExistingCodeValue[]> {
  return db
    .select({
      codeValue: codeValues.codeValue,
      labelEs: codeValues.labelEs,
      normalizedLabelEs: codeValues.normalizedLabelEs,
      reviewStatus: codeValues.reviewStatus,
      metadata: codeValues.metadata,
    })
    .from(codeValues)
    .where(
      and(
        eq(codeValues.codeTableId, codeTableId),
        inArray(
          codeValues.codeValue,
          reviewedPortCodeValues.map((row) => row.codeValue),
        ),
      ),
    );
}

async function applyPlannedRows(
  db: DbClient,
  codeTableId: string,
  plan: PlannedPortCodeValue[],
) {
  const rowsToApply = plan.filter((row) => row.action !== "noop");

  for (const row of rowsToApply) {
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

export async function runPortCodeTableRemediation({
  apply,
  db,
}: {
  apply: boolean;
  db: DbClient;
}) {
  assertReviewedPortRemediationScope();
  const codeTableId = await loadPortCodeTableId(db);
  const existingRows = await loadExistingTargetRows(db, codeTableId);
  const plan = planPortCodeValueRemediation(existingRows);
  const counts = actionCounts(plan);

  let appliedRows = 0;
  if (apply) {
    appliedRows = await applyPlannedRows(db, codeTableId, plan);
  }

  return {
    mode: apply ? "apply" : "dry-run",
    codeTableKey: portCodeTableKey,
    targetCodes: reviewedPortCodeValues.map((row) => row.codeValue),
    counts,
    appliedRows,
    plan: plan.map((row) => ({
      codeValue: row.codeValue,
      labelEs: row.labelEs,
      action: row.action,
      evidenceUrl: row.evidenceUrl,
    })),
  };
}

async function main() {
  config({ path: ".env.local" });
  config();
  assertDevDatabaseTarget("Aduana port code-table remediation");

  const apply = parseApplyMode(process.argv.slice(2));
  if (apply && process.env.ADUANA_PORT_REMEDIATION_CONFIRM !== "apply") {
    throw new Error(
      "Apply mode requires ADUANA_PORT_REMEDIATION_CONFIRM=apply. Dry-run is the default.",
    );
  }

  const { db } = await import("../../src/db/client");
  const result = await runPortCodeTableRemediation({ apply, db });
  console.log(JSON.stringify(result, null, 2));

  if (!apply) {
    console.log(
      "Dry run only. Re-run with --apply and ADUANA_PORT_REMEDIATION_CONFIRM=apply to update dev code values.",
    );
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
