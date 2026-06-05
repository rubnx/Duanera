import { config } from "dotenv";
import { and, eq, sql, type SQL } from "drizzle-orm";
import { pathToFileURL } from "node:url";

import type { DbClient } from "../../src/db/client";
import { tradeRecords } from "../../src/db/schema";
import {
  parsePositiveSafeIntegerCliValue,
  requiredCliValue,
} from "../../src/lib/cli-args";
import {
  cleanPublicText,
  isPublicCodeLikeText,
  normalizePublicSearchText,
} from "../../src/text/public-text";
import {
  formatTradeRecordPeriodValue,
  listProductTradeRecordPeriods,
} from "../../src/trade/trade-record-periods";
import type { TradeFlow } from "../../src/trade/trade-records";
import {
  parsePeriodCliValue,
  parseTradeFlowCliValue,
  tradeRecordPeriodRangeWhere,
} from "./report-cli-helpers";

export type PublicTextQualityArgs = {
  json: boolean;
  limit: number;
  periodFrom: string | null;
  periodTo: string | null;
  tradeFlow: TradeFlow | null;
};

export type PublicTextFragmentInput = {
  exampleRecordId?: string | null;
  field: string;
  raw: string;
  records: number;
};

export type PublicTextIssueType =
  | "all_caps"
  | "accent_fixed"
  | "broken_word_fixed"
  | "spacing_or_unit_fixed"
  | "still_suspicious";

export type PublicTextRecommendation =
  | "safe_auto_rule"
  | "needs_review"
  | "ignore";

export type PublicTextQualityIssue = {
  cleaned: string;
  count: number;
  exampleLinks: string[];
  fields: string[];
  issueTypes: PublicTextIssueType[];
  raw: string;
  recommendation: PublicTextRecommendation;
};

export type PublicTextQualityReport = {
  filters: {
    limit: number;
    periodFrom: string;
    periodTo: string;
    tradeFlow: TradeFlow | null;
  };
  issues: PublicTextQualityIssue[];
  totals: {
    fragmentsReviewed: number;
    issuesReturned: number;
  };
};

const defaultLimit = 50;
const minGroupScanLimit = 250;
const maxGroupScanLimit = 2_500;

export function parsePublicTextQualityArgs(argv: string[]): PublicTextQualityArgs {
  const args: PublicTextQualityArgs = {
    json: false,
    limit: defaultLimit,
    periodFrom: null,
    periodTo: null,
    tradeFlow: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--json") {
      args.json = true;
      continue;
    }

    if (arg === "--limit") {
      args.limit = parsePositiveSafeIntegerCliValue(
        requiredCliValue(argv, index, arg),
        arg,
      );
      index += 1;
      continue;
    }

    if (arg.startsWith("--limit=")) {
      args.limit = parsePositiveSafeIntegerCliValue(
        arg.slice("--limit=".length),
        "--limit",
      );
      continue;
    }

    if (arg === "--period-from") {
      args.periodFrom = parsePeriodCliValue(requiredCliValue(argv, index, arg), arg);
      index += 1;
      continue;
    }

    if (arg.startsWith("--period-from=")) {
      args.periodFrom = parsePeriodCliValue(arg.slice("--period-from=".length), "--period-from");
      continue;
    }

    if (arg === "--period-to") {
      args.periodTo = parsePeriodCliValue(requiredCliValue(argv, index, arg), arg);
      index += 1;
      continue;
    }

    if (arg.startsWith("--period-to=")) {
      args.periodTo = parsePeriodCliValue(arg.slice("--period-to=".length), "--period-to");
      continue;
    }

    if (arg === "--trade-flow") {
      args.tradeFlow = parseTradeFlowCliValue(requiredCliValue(argv, index, arg));
      index += 1;
      continue;
    }

    if (arg.startsWith("--trade-flow=")) {
      args.tradeFlow = parseTradeFlowCliValue(arg.slice("--trade-flow=".length));
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

function reportWhere(args: {
  periodFrom: string;
  periodTo: string;
  tradeFlow: TradeFlow | null;
}) {
  const conditions: SQL[] = [
    tradeRecordPeriodRangeWhere(args.periodFrom, args.periodTo),
  ];

  if (args.tradeFlow) {
    conditions.push(eq(tradeRecords.tradeFlow, args.tradeFlow));
  }

  return and(...conditions) ?? sql`true`;
}

function cleanPart(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function hasAllCapsWords(value: string) {
  const letters = value.replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ]/g, "");
  return letters.length >= 4 && value === value.toUpperCase();
}

function hasSpacingOrUnitChange(raw: string, cleaned: string) {
  const rawCompact = raw.replace(/\s+/g, " ").trim();
  return (
    rawCompact !== cleaned &&
    (/(\d)\s*(MTS?|CMS?|MMS?|KGS?|LTS?|GRAMOS?)\b/i.test(raw) ||
      /%\s*[A-ZÁÉÍÓÚÑ]/.test(raw) ||
      /\s{2,}/.test(raw) ||
      /\s+[,.;:]/.test(raw))
  );
}

function normalizedWithoutWhitespace(value: string) {
  return normalizePublicSearchText(value).replace(/\s+/g, "");
}

export function classifyPublicTextIssue(
  rawValue: string,
): {
  cleaned: string;
  issueTypes: PublicTextIssueType[];
  recommendation: PublicTextRecommendation;
} {
  const raw = cleanPart(rawValue);
  const cleaned = cleanPublicText(raw);
  const issueTypes: PublicTextIssueType[] = [];

  if (!raw || !cleaned || raw === cleaned || isPublicCodeLikeText(raw)) {
    return { cleaned, issueTypes, recommendation: "ignore" };
  }

  if (hasAllCapsWords(raw)) {
    issueTypes.push("all_caps");
  }

  if (
    normalizePublicSearchText(raw) === normalizePublicSearchText(cleaned) &&
    raw.toLowerCase() !== cleaned.toLowerCase()
  ) {
    issueTypes.push("accent_fixed");
  }

  if (normalizedWithoutWhitespace(raw) === normalizedWithoutWhitespace(cleaned)) {
    const rawWords = normalizePublicSearchText(raw).split(" ").length;
    const cleanedWords = normalizePublicSearchText(cleaned).split(" ").length;
    if (rawWords > cleanedWords) {
      issueTypes.push("broken_word_fixed");
    }
  }

  if (hasSpacingOrUnitChange(raw, cleaned)) {
    issueTypes.push("spacing_or_unit_fixed");
  }

  if (issueTypes.length === 0 && /[A-Z]{4,}|\s{2,}|[A-Za-z][0-9]|[0-9][A-Za-z]/.test(raw)) {
    issueTypes.push("still_suspicious");
  }

  const recommendation = issueTypes.includes("still_suspicious")
    ? "needs_review"
    : issueTypes.length > 0
      ? "safe_auto_rule"
      : "ignore";

  return { cleaned, issueTypes, recommendation };
}

export function buildPublicTextQualityIssues(
  fragments: PublicTextFragmentInput[],
  limit = defaultLimit,
): PublicTextQualityIssue[] {
  const grouped = new Map<string, PublicTextQualityIssue>();

  for (const fragment of fragments) {
    const raw = cleanPart(fragment.raw);
    const classification = classifyPublicTextIssue(raw);

    if (classification.recommendation === "ignore") {
      continue;
    }

    const existing = grouped.get(raw);
    const exampleLink = fragment.exampleRecordId
      ? `/trade-records/${fragment.exampleRecordId}`
      : null;

    if (existing) {
      existing.count += fragment.records;
      if (!existing.fields.includes(fragment.field)) {
        existing.fields.push(fragment.field);
      }
      if (exampleLink && existing.exampleLinks.length < 3 && !existing.exampleLinks.includes(exampleLink)) {
        existing.exampleLinks.push(exampleLink);
      }
      continue;
    }

    grouped.set(raw, {
      cleaned: classification.cleaned,
      count: fragment.records,
      exampleLinks: exampleLink ? [exampleLink] : [],
      fields: [fragment.field],
      issueTypes: classification.issueTypes,
      raw,
      recommendation: classification.recommendation,
    });
  }

  return [...grouped.values()]
    .sort((a, b) => b.count - a.count || a.raw.localeCompare(b.raw))
    .slice(0, limit);
}

export function publicTextGroupScanLimit(issueLimit = defaultLimit) {
  return Math.min(
    Math.max(issueLimit * 50, minGroupScanLimit),
    maxGroupScanLimit,
  );
}

async function defaultPeriod(db: DbClient) {
  const periods = await listProductTradeRecordPeriods(db);
  const latest = periods[0];

  if (latest) {
    return latest.value;
  }

  return formatTradeRecordPeriodValue(2026, 4);
}

async function resolveReportPeriod(db: DbClient, args: PublicTextQualityArgs) {
  const fallback = await defaultPeriod(db);
  const periodFrom = args.periodFrom ?? args.periodTo ?? fallback;
  const periodTo = args.periodTo ?? args.periodFrom ?? periodFrom;

  if (periodFrom > periodTo) {
    throw new Error("--period-from must be before or equal to --period-to.");
  }

  return { periodFrom, periodTo };
}

type FragmentRow = {
  example_record_id: string | null;
  field: string;
  raw: string;
  records: string | number;
};

async function listPublicTextFragments(
  db: DbClient,
  args: {
    groupLimit: number;
    periodFrom: string;
    periodTo: string;
    tradeFlow: TradeFlow | null;
  },
): Promise<PublicTextFragmentInput[]> {
  const where = reportWhere(args);
  const result = await db.execute(sql`
    with product_descriptions as (
      select
        'product_description_raw'::text as field,
        btrim(${tradeRecords.productDescriptionRaw}) as raw,
        count(*)::int as records,
        min(${tradeRecords.id}::text) as example_record_id
      from ${tradeRecords}
      where ${where}
        and ${tradeRecords.productDescriptionRaw} is not null
        and btrim(${tradeRecords.productDescriptionRaw}) <> ''
      group by btrim(${tradeRecords.productDescriptionRaw})
      order by records desc
      limit ${args.groupLimit}
    ),
    product_attributes as (
      select
        ('product_attributes.' || attributes.key)::text as field,
        btrim(attributes.value) as raw,
        count(*)::int as records,
        min(${tradeRecords.id}::text) as example_record_id
      from ${tradeRecords}
      cross join lateral jsonb_each_text(
        case
          when jsonb_typeof(${tradeRecords.productAttributes}) = 'object'
            then ${tradeRecords.productAttributes}
          else '{}'::jsonb
        end
      ) as attributes(key, value)
      where ${where}
        and ${tradeRecords.productAttributes} is not null
        and btrim(attributes.value) <> ''
      group by attributes.key, btrim(attributes.value)
      order by records desc
      limit ${args.groupLimit}
    )
    select field, raw, records, example_record_id
    from product_descriptions
    union all
    select field, raw, records, example_record_id
    from product_attributes
  `);

  return (result.rows as FragmentRow[]).map((row) => ({
    exampleRecordId: row.example_record_id,
    field: row.field,
    raw: row.raw,
    records: Number(row.records),
  }));
}

function renderTextReport(report: PublicTextQualityReport) {
  const lines = [
    "Duanera public text quality report",
    `Period: ${report.filters.periodFrom} to ${report.filters.periodTo}`,
    `Flow: ${report.filters.tradeFlow ?? "all"}`,
    `Fragments reviewed: ${report.totals.fragmentsReviewed}`,
    `Issues returned: ${report.totals.issuesReturned}`,
    "",
  ];

  for (const [index, issue] of report.issues.entries()) {
    lines.push(
      `${index + 1}. ${issue.count} records · ${issue.recommendation} · ${issue.issueTypes.join(", ")}`,
      `   raw: ${issue.raw}`,
      `   cleaned: ${issue.cleaned}`,
      `   fields: ${issue.fields.join(", ")}`,
      `   examples: ${issue.exampleLinks.join(", ") || "none"}`,
      "",
    );
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

export async function runPublicTextQualityReport(db: DbClient, argv: string[]) {
  const args = parsePublicTextQualityArgs(argv);
  const period = await resolveReportPeriod(db, args);
  const fragments = await listPublicTextFragments(db, {
    groupLimit: publicTextGroupScanLimit(args.limit),
    ...period,
    tradeFlow: args.tradeFlow,
  });
  const issues = buildPublicTextQualityIssues(fragments, args.limit);
  const report: PublicTextQualityReport = {
    filters: {
      limit: args.limit,
      periodFrom: period.periodFrom,
      periodTo: period.periodTo,
      tradeFlow: args.tradeFlow,
    },
    issues,
    totals: {
      fragmentsReviewed: fragments.length,
      issuesReturned: issues.length,
    },
  };

  process.stdout.write(args.json ? `${JSON.stringify(report, null, 2)}\n` : renderTextReport(report));
  return report;
}

async function main() {
  config({ path: ".env.local" });
  config();

  const { db } = await import("../../src/db/client");
  await runPublicTextQualityReport(db, process.argv.slice(2));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Public text quality report failed: ${message}\n`);
    process.exitCode = 1;
  });
}
