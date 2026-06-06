import { config } from "dotenv";
import { sql } from "drizzle-orm";

import type { DbClient } from "../../src/db/client";
import { parseDelimitedLine } from "../../src/ingest/aduana-main-file";

export type ParseFailureSummaryRow = {
  period: string;
  tradeFlow: "import" | "export";
  fieldCount: number;
  parseErrors: string;
  rows: number;
  firstRow: number;
  lastRow: number;
};

export type ParseFailureClassification =
  | "export_split_line_segment"
  | "export_short_record"
  | "import_short_record"
  | "unknown_field_count";

export function classifyParseFailure(row: {
  tradeFlow: "import" | "export";
  fieldCount: number;
  parseErrors: string;
}): ParseFailureClassification {
  if (
    row.tradeFlow === "export" &&
    (row.fieldCount === 19 || row.fieldCount === 66) &&
    row.parseErrors.includes("Expected 84 fields")
  ) {
    return "export_split_line_segment";
  }

  if (
    row.tradeFlow === "export" &&
    row.fieldCount === 63 &&
    row.parseErrors.includes("Expected 84 fields")
  ) {
    return "export_short_record";
  }

  if (
    row.tradeFlow === "import" &&
    row.fieldCount >= 135 &&
    row.fieldCount <= 137 &&
    row.parseErrors.includes("Expected 178 fields")
  ) {
    return "import_short_record";
  }

  return "unknown_field_count";
}

export function classificationLabel(classification: ParseFailureClassification): string {
  switch (classification) {
    case "export_split_line_segment":
      return "Export split-line segment";
    case "export_short_record":
      return "Export short 63-field record";
    case "import_short_record":
      return "Import short 135-137-field record";
    case "unknown_field_count":
      return "Unknown field-count failure";
  }
}

export function classifyRecommendation(classification: ParseFailureClassification): string {
  switch (classification) {
    case "export_split_line_segment":
      return "Safe to retain for now; likely recoverable later with a conservative adjacent-row join.";
    case "export_short_record":
      return "Retain and review before recovery; may represent a source-specific short record shape.";
    case "import_short_record":
      return "Retain and review before recovery; not enough evidence for automatic reconstruction.";
    case "unknown_field_count":
      return "Stop and inspect before additional unattended loads if this appears in volume.";
  }
}

export function combinedAdjacentFieldCount(firstRawText: string, secondRawText: string): number {
  return parseDelimitedLine(`${firstRawText}${secondRawText}`).length;
}

async function loadFailureSummary(database: DbClient): Promise<ParseFailureSummaryRow[]> {
  const result = await database.execute(sql`
    select format('%s-%s', period_year, lpad(period_month::text, 2, '0')) as period,
      trade_flow as "tradeFlow",
      field_count as "fieldCount",
      parse_errors::text as "parseErrors",
      count(*)::int as rows,
      min(row_number)::int as "firstRow",
      max(row_number)::int as "lastRow"
    from raw_trade_rows
    where period_year = 2025
      and period_month between 1 and 5
      and parse_status = 'failed'
    group by period_year, period_month, trade_flow, field_count, parse_errors::text
    order by period, trade_flow, field_count;
  `);

  return result.rows as ParseFailureSummaryRow[];
}

async function loadRetainedPayloadSummary(database: DbClient) {
  const result = await database.execute(sql`
    select format('%s-%s', period_year, lpad(period_month::text, 2, '0')) as period,
      trade_flow as "tradeFlow",
      count(*)::int as rows,
      count(*) filter (where raw_text is not null)::int as "retainedRawText",
      count(*) filter (where raw_values is not null)::int as "retainedRawValues",
      count(*) filter (where payload_retained_reason = 'parse_error')::int as "parseErrorRetained"
    from raw_trade_rows
    where period_year = 2025
      and period_month between 1 and 5
      and parse_status = 'failed'
    group by period_year, period_month, trade_flow
    order by period, trade_flow;
  `);

  return result.rows;
}

async function loadSplitLinePairSummary(database: DbClient) {
  const result = await database.execute(sql`
    with failed as (
      select source_file_id, period_year, period_month, trade_flow, row_number, field_count, raw_text
      from raw_trade_rows
      where period_year = 2025
        and period_month between 1 and 5
        and trade_flow = 'export'
        and parse_status = 'failed'
    )
    select format('%s-%s', a.period_year, lpad(a.period_month::text, 2, '0')) as period,
      count(*)::int as pairs,
      min(a.row_number)::int as "firstPairRow",
      max(a.row_number)::int as "lastPairRow"
    from failed a
    join failed b
      on b.source_file_id = a.source_file_id
      and b.row_number = a.row_number + 1
      and b.field_count = 66
    where a.field_count = 19
    group by a.period_year, a.period_month
    order by period;
  `);

  return result.rows;
}

async function loadSplitLineExamples(database: DbClient) {
  const result = await database.execute(sql`
    with failed as (
      select source_file_id, period_year, period_month, trade_flow, row_number, field_count, raw_text
      from raw_trade_rows
      where period_year = 2025
        and period_month between 1 and 5
        and trade_flow = 'export'
        and parse_status = 'failed'
    )
    select format('%s-%s', a.period_year, lpad(a.period_month::text, 2, '0')) as period,
      a.row_number as "firstRow",
      b.row_number as "secondRow",
      a.raw_text as "firstRawText",
      b.raw_text as "secondRawText"
    from failed a
    join failed b
      on b.source_file_id = a.source_file_id
      and b.row_number = a.row_number + 1
      and b.field_count = 66
    where a.field_count = 19
    order by period, a.row_number
    limit 5;
  `);

  return result.rows.map((row) => ({
    ...row,
    combinedFieldCount: combinedAdjacentFieldCount(
      String(row.firstRawText ?? ""),
      String(row.secondRawText ?? ""),
    ),
  }));
}

async function loadIntegritySummary(database: DbClient) {
  const result = await database.execute(sql`
    with duplicate_raw_links as (
      select raw_trade_row_id
      from trade_records
      where period_year = 2025 and period_month between 1 and 5
      group by raw_trade_row_id
      having count(*) > 1
    ), parsed_missing_records as (
      select r.id
      from raw_trade_rows r
      left join trade_records t on t.raw_trade_row_id = r.id
      where r.period_year = 2025
        and r.period_month between 1 and 5
        and r.parse_status = 'parsed'
        and t.id is null
    ), orphan_records as (
      select t.id
      from trade_records t
      left join raw_trade_rows r on r.id = t.raw_trade_row_id
      where t.period_year = 2025
        and t.period_month between 1 and 5
        and r.id is null
    ), source_batch_mismatches as (
      select t.id
      from trade_records t
      join raw_trade_rows r on r.id = t.raw_trade_row_id
      where t.period_year = 2025
        and t.period_month between 1 and 5
        and (
          t.source_file_id <> r.source_file_id
          or t.import_batch_id <> r.import_batch_id
          or t.trade_flow <> r.trade_flow
          or t.period_year <> r.period_year
          or t.period_month <> r.period_month
        )
    ), pending_prune as (
      select id
      from raw_trade_rows
      where period_year = 2025
        and period_month between 1 and 5
        and parse_status = 'parsed'
        and payload_retention_mode = 'errors_and_warnings'
        and payload_retained_reason = 'pending_post_normalization_prune'
    )
    select 'duplicate_raw_trade_row_links' as "checkName", count(*)::int as count from duplicate_raw_links
    union all select 'parsed_missing_trade_records', count(*)::int from parsed_missing_records
    union all select 'orphan_trade_records', count(*)::int from orphan_records
    union all select 'source_batch_mismatches', count(*)::int from source_batch_mismatches
    union all select 'pending_prune_rows', count(*)::int from pending_prune
    order by "checkName";
  `);

  return result.rows;
}

async function main() {
  config({ path: ".env.local" });
  const { db } = await import("../../src/db/client");

  const failureSummary = await loadFailureSummary(db);
  const classified = failureSummary.map((row) => ({
    ...row,
    classification: classificationLabel(classifyParseFailure(row)),
    recommendation: classifyRecommendation(classifyParseFailure(row)),
  }));

  console.log("Failure summary");
  console.table(classified);

  console.log("Retained payload summary");
  console.table(await loadRetainedPayloadSummary(db));

  console.log("Adjacent export 19+66 split-line pairs");
  console.table(await loadSplitLinePairSummary(db));

  console.log("Split-line examples");
  console.table(await loadSplitLineExamples(db));

  console.log("Integrity summary");
  console.table(await loadIntegritySummary(db));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
