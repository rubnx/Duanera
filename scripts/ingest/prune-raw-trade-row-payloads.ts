import { config } from "dotenv";
import { sql } from "drizzle-orm";

import { assertDevDatabaseTarget } from "../../src/db/dev-guard";

config({ path: ".env.local" });
config();
assertDevDatabaseTarget("raw trade row payload pruner");

const { db } = await import("../../src/db/client");

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

function positiveIntegerEnv(name: string, defaultValue: number): number {
  const raw = process.env[name];
  if (!raw) {
    return defaultValue;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer, got ${raw}.`);
  }

  return parsed;
}

function flowFilter() {
  const raw = process.env.RAW_ROW_PRUNE_FLOW;
  if (!raw) {
    return sql``;
  }

  if (raw !== "import" && raw !== "export") {
    throw new Error(`RAW_ROW_PRUNE_FLOW must be import or export, got ${raw}.`);
  }

  return sql`and r.trade_flow = ${raw}`;
}

function rowsFrom<T>(result: unknown): T[] {
  return ((result as QueryResult<T>).rows ?? []) as T[];
}

const confirmPrune = process.env.RAW_ROW_PRUNE_CONFIRM === "prune";
const totalLimit = positiveIntegerEnv("RAW_ROW_PRUNE_LIMIT", 100);
const batchSize = Math.min(
  positiveIntegerEnv("RAW_ROW_PRUNE_BATCH_SIZE", 100),
  totalLimit,
);
const optionalFlowFilter = flowFilter();

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

console.log("Raw row payload prune summary:");
console.log(JSON.stringify(counts, null, 2));
console.log(`Mode: ${confirmPrune ? "prune" : "dry-run"}. Limit: ${totalLimit}. Batch size: ${batchSize}.`);

if (!confirmPrune) {
  console.log("Dry run only. Set RAW_ROW_PRUNE_CONFIRM=prune to update rows.");
  process.exit(0);
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
  console.log(`Pruned ${prunedRows.length} rows in batch; ${pruned} total.`);

  if (prunedRows.length < currentBatchSize) {
    break;
  }
}

console.log(`Raw row payload pruning complete. Pruned ${pruned} rows.`);
