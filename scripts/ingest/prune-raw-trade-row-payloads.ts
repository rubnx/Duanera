import { config } from "dotenv";
import { sql } from "drizzle-orm";
import { pathToFileURL } from "node:url";

import type { DbClient } from "../../src/db/client";
import { assertDevDatabaseTarget } from "../../src/db/dev-guard";
import { positiveIntegerEnvValue } from "../../src/lib/env";

type QueryResult<T> = {
  rows?: T[];
};

type PruneCounts = {
  candidate_rows: number;
  eligible_rows: number;
  blocked_rows: number;
  already_pruned_rows: number;
};

type PrunedRow = {
  id: string;
};

type PruneMode = "dry-run" | "prune";

type PruneArgs = {
  mode: PruneMode;
};

type PruneEnv = {
  RAW_ROW_PRUNE_BATCH_SIZE?: string;
  RAW_ROW_PRUNE_CONFIRM?: string;
  RAW_ROW_PRUNE_FLOW?: string;
  RAW_ROW_PRUNE_LIMIT?: string;
};

export function parsePruneArgs(argv: string[]): PruneArgs {
  const args: PruneArgs = { mode: "dry-run" };
  let explicitMode: PruneMode | null = null;

  for (const arg of argv) {
    if (arg === "--dry-run") {
      if (explicitMode === "prune") {
        throw new Error("Use either --dry-run or --prune, not both.");
      }
      args.mode = "dry-run";
      explicitMode = "dry-run";
      continue;
    }

    if (arg === "--prune") {
      if (explicitMode === "dry-run") {
        throw new Error("Use either --dry-run or --prune, not both.");
      }
      args.mode = "prune";
      explicitMode = "prune";
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

export function resolvePruneMode(args: PruneArgs, env: PruneEnv): PruneMode {
  const hasEnvConfirmation = env.RAW_ROW_PRUNE_CONFIRM === "prune";

  if (args.mode === "prune" && !hasEnvConfirmation) {
    throw new Error(
      "Prune mode requires RAW_ROW_PRUNE_CONFIRM=prune. Dry-run is the default.",
    );
  }

  if (args.mode === "dry-run" && hasEnvConfirmation) {
    throw new Error(
      "RAW_ROW_PRUNE_CONFIRM=prune is set but --prune was not passed. Unset it for dry-run or pass --prune intentionally.",
    );
  }

  return args.mode;
}

export function parsePruneFlow(raw: string | undefined): "import" | "export" | null {
  if (!raw) {
    return null;
  }

  if (raw !== "import" && raw !== "export") {
    throw new Error(`RAW_ROW_PRUNE_FLOW must be import or export, got ${raw}.`);
  }

  return raw;
}

function positiveIntegerEnv(name: string, raw: string | undefined, defaultValue: number): number {
  return positiveIntegerEnvValue(name, raw, defaultValue);
}

function flowFilter(flow: "import" | "export" | null) {
  if (!flow) {
    return sql``;
  }

  return sql`and r.trade_flow = ${flow}`;
}

function rowsFrom<T>(result: unknown): T[] {
  return ((result as QueryResult<T>).rows ?? []) as T[];
}

export async function runRawRowPayloadPruner({
  argv,
  db,
  env,
}: {
  argv: string[];
  db: DbClient;
  env: PruneEnv;
}) {
  const args = parsePruneArgs(argv);
  const mode = resolvePruneMode(args, env);
  const totalLimit = positiveIntegerEnv("RAW_ROW_PRUNE_LIMIT", env.RAW_ROW_PRUNE_LIMIT, 100);
  const batchSize = Math.min(
    positiveIntegerEnv("RAW_ROW_PRUNE_BATCH_SIZE", env.RAW_ROW_PRUNE_BATCH_SIZE, 100),
    totalLimit,
  );
  const optionalFlowFilter = flowFilter(parsePruneFlow(env.RAW_ROW_PRUNE_FLOW));

  const countsResult = await db.execute(sql`
    with candidates as (
      select r.id
      from raw_trade_rows r
      where r.payload_retention_mode = 'errors_and_warnings'
        and r.payload_retained_reason = 'pending_post_normalization_prune'
        and r.payload_storage_kind = 'postgres'
        and r.payload_pruned_at is null
        and r.payload_reconstructable = true
        and r.parse_status = 'parsed'
        and r.parse_errors is null
        and r.parse_warnings is null
        and (r.raw_text is not null or r.raw_values is not null)
        ${optionalFlowFilter}
    ),
    eligible as (
      select r.id
      from raw_trade_rows r
      inner join trade_records t on t.raw_trade_row_id = r.id
      where r.id in (select id from candidates)
        and t.source_file_id = r.source_file_id
        and t.import_batch_id = r.import_batch_id
        and t.trade_flow = r.trade_flow
        and t.period_year = r.period_year
        and t.period_month = r.period_month
    ),
    already_pruned as (
      select r.id
      from raw_trade_rows r
      where r.payload_retention_mode = 'errors_and_warnings'
        and r.payload_retained_reason = 'pruned_after_normalization'
        and r.payload_pruned_at is not null
        ${optionalFlowFilter}
    )
    select
      (select count(*)::int from candidates) as candidate_rows,
      (select count(*)::int from eligible) as eligible_rows,
      ((select count(*)::int from candidates) - (select count(*)::int from eligible)) as blocked_rows,
      (select count(*)::int from already_pruned) as already_pruned_rows
  `);

  const counts = rowsFrom<PruneCounts>(countsResult)[0] ?? {
    candidate_rows: 0,
    eligible_rows: 0,
    blocked_rows: 0,
    already_pruned_rows: 0,
  };

  process.stdout.write("Raw row payload prune summary:\n");
  process.stdout.write(`${JSON.stringify(counts, null, 2)}\n`);
  process.stdout.write(`Mode: ${mode}. Limit: ${totalLimit}. Batch size: ${batchSize}.\n`);

  if (mode === "dry-run") {
    process.stdout.write(
      "Dry run only. Re-run with --prune and RAW_ROW_PRUNE_CONFIRM=prune to update dev rows.\n",
    );
    return { counts, mode, pruned: 0 };
  }

  let pruned = 0;

  while (pruned < totalLimit) {
    const remaining = totalLimit - pruned;
    const currentBatchSize = Math.min(batchSize, remaining);

    const updateResult = await db.execute(sql`
      with eligible as (
        select r.id
        from raw_trade_rows r
        inner join trade_records t on t.raw_trade_row_id = r.id
        where r.payload_retention_mode = 'errors_and_warnings'
          and r.payload_retained_reason = 'pending_post_normalization_prune'
          and r.payload_storage_kind = 'postgres'
          and r.payload_pruned_at is null
          and r.payload_reconstructable = true
          and r.parse_status = 'parsed'
          and r.parse_errors is null
          and r.parse_warnings is null
          and (r.raw_text is not null or r.raw_values is not null)
          and t.source_file_id = r.source_file_id
          and t.import_batch_id = r.import_batch_id
          and t.trade_flow = r.trade_flow
          and t.period_year = r.period_year
          and t.period_month = r.period_month
          ${optionalFlowFilter}
        order by r.source_file_id, r.row_number, r.id
        limit ${currentBatchSize}
      )
      update raw_trade_rows r
      set
        raw_text = null,
        raw_values = null,
        payload_retained_reason = 'pruned_after_normalization',
        payload_pruned_at = now(),
        updated_at = now()
      from eligible e
      where r.id = e.id
      returning r.id
    `);

    const prunedRows = rowsFrom<PrunedRow>(updateResult);
    pruned += prunedRows.length;
    process.stdout.write(`Pruned ${prunedRows.length} rows in batch; ${pruned} total.\n`);

    if (prunedRows.length < currentBatchSize) {
      break;
    }
  }

  process.stdout.write(`Raw row payload pruning complete. Pruned ${pruned} rows.\n`);
  return { counts, mode, pruned };
}

async function main() {
  config({ path: ".env.local" });
  config();
  assertDevDatabaseTarget("raw trade row payload pruner");

  const { db } = await import("../../src/db/client");
  await runRawRowPayloadPruner({
    argv: process.argv.slice(2),
    db,
    env: {
      ...(process.env.RAW_ROW_PRUNE_BATCH_SIZE !== undefined
        ? { RAW_ROW_PRUNE_BATCH_SIZE: process.env.RAW_ROW_PRUNE_BATCH_SIZE }
        : {}),
      ...(process.env.RAW_ROW_PRUNE_CONFIRM !== undefined
        ? { RAW_ROW_PRUNE_CONFIRM: process.env.RAW_ROW_PRUNE_CONFIRM }
        : {}),
      ...(process.env.RAW_ROW_PRUNE_FLOW !== undefined
        ? { RAW_ROW_PRUNE_FLOW: process.env.RAW_ROW_PRUNE_FLOW }
        : {}),
      ...(process.env.RAW_ROW_PRUNE_LIMIT !== undefined
        ? { RAW_ROW_PRUNE_LIMIT: process.env.RAW_ROW_PRUNE_LIMIT }
        : {}),
    },
  });
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Raw row payload pruning failed: ${message}\n`);
    process.exitCode = 1;
  });
}
