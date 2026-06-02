import { sql } from "drizzle-orm";

import type { DbClient } from "@/db/client";
import { queryResultRows } from "@/db/query-result";
import { tradeRecords } from "@/db/schema";
import {
  tradeRecordCountryExpression,
  tradeRecordHsCodePrefixExpression,
  tradeRecordItemValueExpression,
  tradeRecordParticipantCorrelativeExpression,
  tradeRecordRelevantPortExpression,
  tradeRecordRelevantPortLabelExpression,
} from "@/trade/trade-record-expressions";
import { buildTradeRecordWhere } from "@/trade/trade-record-where";
import type { TradeRecordFilters } from "@/trade/trade-records";

export type TradeRecordComparisonRow = {
  code: string;
  labelRaw: string | null;
  productDescriptionRaw: string | null;
  records: number;
  totalItemValue: string | null;
  declarationFobValue: string | null;
  quantity: string | null;
  quantityUnitCode: string | null;
  quantityUnitIsMixed: boolean;
  grossWeightItem: string | null;
  grossWeightTotal: string | null;
  averageUnitPrice: string | null;
  currencyCode: string | null;
  currencyIsMixed: boolean;
};

export type TradeRecordComparison = {
  limit: number;
  skippedReason: "broad_result_set" | null;
  groups: {
    products: TradeRecordComparisonRow[];
    countries: TradeRecordComparisonRow[];
    customsOffices: TradeRecordComparisonRow[];
    ports: TradeRecordComparisonRow[];
    participants: TradeRecordComparisonRow[];
  };
};

type TradeRecordComparisonDimension =
  | "products"
  | "countries"
  | "customsOffices"
  | "ports"
  | "participants";

type TradeRecordComparisonQueryRow = TradeRecordComparisonRow & {
  dimension: TradeRecordComparisonDimension;
};

function normalizeComparisonRow(row: TradeRecordComparisonQueryRow) {
  return {
    code: row.code,
    labelRaw: row.labelRaw,
    productDescriptionRaw: row.productDescriptionRaw,
    records: Number(row.records),
    totalItemValue: row.totalItemValue,
    declarationFobValue: row.declarationFobValue,
    quantity: row.quantity,
    quantityUnitCode: row.quantityUnitCode,
    quantityUnitIsMixed: row.quantityUnitIsMixed,
    grossWeightItem: row.grossWeightItem,
    grossWeightTotal: row.grossWeightTotal,
    averageUnitPrice: row.averageUnitPrice,
    currencyCode: row.currencyCode,
    currencyIsMixed: row.currencyIsMixed,
  } satisfies TradeRecordComparisonRow;
}

export async function compareTradeRecordGroups(
  db: DbClient,
  filters: TradeRecordFilters = {},
  limit = 6,
): Promise<TradeRecordComparison> {
  const rowLimit = Math.min(Math.max(Math.trunc(limit), 1), 10);
  const where = buildTradeRecordWhere(filters) ?? sql`true`;
  const itemValue = tradeRecordItemValueExpression(filters);
  const countryCode = tradeRecordCountryExpression(filters);
  const portCode = tradeRecordRelevantPortExpression(filters);
  const portLabel = tradeRecordRelevantPortLabelExpression(filters);
  const participantCode = tradeRecordParticipantCorrelativeExpression(filters);

  const result = await db.execute(sql`
    with filtered as (
      select
        ${tradeRecordHsCodePrefixExpression()} as hs_code_prefix,
        ${tradeRecords.productDescriptionRaw} as product_description_raw,
        ${countryCode} as country_code,
        ${tradeRecords.customsOfficeCode} as customs_office_code,
        ${portCode} as port_code,
        ${portLabel} as port_label_raw,
        ${participantCode} as participant_code,
        ${itemValue} as item_value,
        ${tradeRecords.declarationFobValue} as declaration_fob_value,
        ${tradeRecords.quantity} as quantity,
        ${tradeRecords.quantityUnitCode} as quantity_unit_code,
        ${tradeRecords.grossWeightItem} as gross_weight_item,
        ${tradeRecords.grossWeightTotal} as gross_weight_total,
        ${tradeRecords.currencyCodeRaw} as currency_code_raw
      from ${tradeRecords}
      where ${where}
    ),
    expanded as (
      select
        dimensions.dimension,
        dimensions.code,
        dimensions.label_raw,
        dimensions.group_product_description_raw,
        filtered.*
      from filtered
      cross join lateral (
        values
          ('products', hs_code_prefix, null::text, product_description_raw),
          ('countries', country_code, null::text, null::text),
          ('customsOffices', customs_office_code, null::text, null::text),
          ('ports', port_code, port_label_raw, null::text),
          ('participants', participant_code, null::text, null::text)
      ) as dimensions(dimension, code, label_raw, group_product_description_raw)
      where code is not null and code <> ''
    ),
    grouped as (
      select
        dimension,
        code,
        min(label_raw) as label_raw,
        min(group_product_description_raw) as product_description_raw,
        count(*) as records,
        sum(item_value)::text as total_item_value,
        sum(declaration_fob_value)::text as declaration_fob_value,
        case
          when count(quantity) > 0
            and count(quantity) = count(quantity_unit_code)
            and count(distinct quantity_unit_code) = 1
          then sum(quantity)::text
          else null
        end as quantity,
        case
          when count(quantity) > 0
            and count(quantity) = count(quantity_unit_code)
            and count(distinct quantity_unit_code) = 1
          then min(quantity_unit_code)
          else null
        end as quantity_unit_code,
        count(distinct quantity_unit_code) > 1
          or count(quantity) <> count(quantity_unit_code) as quantity_unit_is_mixed,
        sum(gross_weight_item)::text as gross_weight_item,
        sum(gross_weight_total)::text as gross_weight_total,
        case
          when count(quantity) > 0
            and count(quantity) = count(quantity_unit_code)
            and count(quantity) = count(item_value)
            and count(item_value) = count(currency_code_raw)
            and count(distinct quantity_unit_code) = 1
            and count(distinct currency_code_raw) = 1
            and sum(quantity) > 0
          then (sum(item_value) / sum(quantity))::text
          else null
        end as average_unit_price,
        case
          when count(item_value) > 0
            and count(item_value) = count(currency_code_raw)
            and count(distinct currency_code_raw) = 1
          then min(currency_code_raw)
          else null
        end as currency_code,
        count(distinct currency_code_raw) > 1
          or count(item_value) <> count(currency_code_raw) as currency_is_mixed,
        row_number() over (
          partition by dimension
          order by count(*) desc, sum(item_value) desc nulls last, code asc
        ) as dimension_rank
      from expanded
      group by dimension, code
    )
    select
      dimension,
      code,
      label_raw as "labelRaw",
      product_description_raw as "productDescriptionRaw",
      records,
      total_item_value as "totalItemValue",
      declaration_fob_value as "declarationFobValue",
      quantity,
      quantity_unit_code as "quantityUnitCode",
      quantity_unit_is_mixed as "quantityUnitIsMixed",
      gross_weight_item as "grossWeightItem",
      gross_weight_total as "grossWeightTotal",
      average_unit_price as "averageUnitPrice",
      currency_code as "currencyCode",
      currency_is_mixed as "currencyIsMixed"
    from grouped
    where dimension_rank <= ${rowLimit}
    order by dimension, dimension_rank;
  `);

  const rows = queryResultRows<TradeRecordComparisonQueryRow>(
    result,
    "trade record comparison query result",
  );
  const byDimension: TradeRecordComparison["groups"] = {
    products: [],
    countries: [],
    customsOffices: [],
    ports: [],
    participants: [],
  };

  for (const row of rows) {
    byDimension[row.dimension].push(normalizeComparisonRow(row));
  }

  return {
    limit: rowLimit,
    skippedReason: null,
    groups: byDimension,
  };
}

export function emptyTradeRecordComparison(
  reason: TradeRecordComparison["skippedReason"],
  limit = 6,
): TradeRecordComparison {
  return {
    limit: Math.min(Math.max(Math.trunc(limit), 1), 10),
    skippedReason: reason,
    groups: {
      products: [],
      countries: [],
      customsOffices: [],
      ports: [],
      participants: [],
    },
  };
}
