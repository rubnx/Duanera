import type { ReactNode } from "react";

import { TableRow } from "@/components/ui/table";
import {
  CountryCell,
  ChargesCell,
  ExtendedValuesCell,
  LogisticsCell,
  ParticipantCell,
  ProductCell,
  QuantityWeightCell,
  RecordIdentityCell,
  SourceProvenanceCell,
  UnitQuantityCell,
  ValuesCell,
  WeightCell,
} from "@/components/trade-record-results-row-cells";
import { sourceTradeRecordsHref } from "@/sources/source-provenance";
import {
  buildTradeRecordSearchHref,
  type TradeRecordDrilldownTarget,
} from "@/trade/trade-record-links";
import { formatTradeRecordPeriodValue } from "@/trade/trade-record-periods";
import type { TradeRecordTableViewId } from "@/trade/trade-record-table-views";
import type { TradeRecordSearchResponse } from "@/trade/trade-record-search";

type TradeRecordRow = TradeRecordSearchResponse["data"][number];

function recordTradeFlow(value: string) {
  return value === "import" || value === "export" ? value : undefined;
}

function drilldownHref(
  params: Record<string, string | string[] | undefined>,
  target: TradeRecordDrilldownTarget,
) {
  return buildTradeRecordSearchHref(params, target);
}

export function TradeRecordResultsRow({
  params,
  record,
  view,
}: {
  params: Record<string, string | string[] | undefined>;
  record: TradeRecordRow;
  view: TradeRecordTableViewId;
}) {
  const sourceHref = `/sources/${record.sourceFileId}`;
  const batchHref = `${sourceHref}#batch-${record.importBatchId}`;
  const sourceRecordsHref = sourceTradeRecordsHref({
    sourceFileId: record.sourceFileId,
    tradeFlow: recordTradeFlow(record.tradeFlow),
  });
  const batchRecordsHref = sourceTradeRecordsHref({
    sourceFileId: record.sourceFileId,
    importBatchId: record.importBatchId,
    tradeFlow: recordTradeFlow(record.tradeFlow),
  });
  const period = formatTradeRecordPeriodValue(record.periodYear, record.periodMonth);
  const hsFilterHref = record.hsCodeNormalized
    ? drilldownHref(params, {
        type: "hsCodePrefix",
        code: record.hsCodeNormalized,
      })
    : null;
  const participantFilterHref =
    record.tradeFlow === "import" && record.importerCorrelativeId
      ? drilldownHref(params, {
          type: "importer",
          code: record.importerCorrelativeId,
        })
      : record.tradeFlow === "export" &&
          (record.exporterPrimaryCorrelativeId ||
            record.exporterSecondaryCorrelativeId)
        ? drilldownHref(params, {
            type: "exporter",
            code:
              record.exporterPrimaryCorrelativeId ??
              record.exporterSecondaryCorrelativeId!,
          })
        : null;
  const countryCode =
    record.tradeFlow === "export"
      ? record.destinationCountryCode
      : record.originCountryCode;
  const countryFilterHref = countryCode
    ? drilldownHref(params, {
        type: "country",
        code: countryCode,
        tradeFlow: record.tradeFlow === "export" ? "export" : "import",
      })
    : null;
  const customsFilterHref = record.customsOfficeCode
    ? drilldownHref(params, {
        type: "customsOffice",
        code: record.customsOfficeCode,
      })
    : null;
  const portCode =
    record.tradeFlow === "export" ? record.embarkPortCode : record.disembarkPortCode;
  const portFilterHref = portCode
    ? drilldownHref(params, {
        type: record.tradeFlow === "export" ? "embarkPort" : "disembarkPort",
        code: portCode,
      })
    : null;

  const cells = {
    identity: <RecordIdentityCell key="identity" period={period} record={record} />,
    product: <ProductCell key="product" hsFilterHref={hsFilterHref} record={record} />,
    participant: (
      <ParticipantCell
        key="participant"
        participantFilterHref={participantFilterHref}
        record={record}
      />
    ),
    values: <ValuesCell key="values" record={record} />,
    extendedValues: <ExtendedValuesCell key="extendedValues" record={record} />,
    charges: <ChargesCell key="charges" record={record} />,
    unitQuantity: <UnitQuantityCell key="unitQuantity" record={record} />,
    weight: <WeightCell key="weight" record={record} />,
    quantityWeight: <QuantityWeightCell key="quantityWeight" record={record} />,
    country: (
      <CountryCell
        key="country"
        countryFilterHref={countryFilterHref}
        record={record}
      />
    ),
    logistics: (
      <LogisticsCell
        key="logistics"
        customsFilterHref={customsFilterHref}
        portFilterHref={portFilterHref}
        record={record}
      />
    ),
    source: (
      <SourceProvenanceCell
        key="source"
        batchHref={batchHref}
        batchRecordsHref={batchRecordsHref}
        record={record}
        sourceHref={sourceHref}
        sourceRecordsHref={sourceRecordsHref}
      />
    ),
  };

  const viewCells = {
    commercial: [
      cells.identity,
      cells.product,
      cells.participant,
      cells.values,
      cells.quantityWeight,
      cells.country,
      cells.logistics,
      cells.source,
    ],
    values: [
      cells.identity,
      cells.product,
      cells.extendedValues,
      cells.values,
      cells.charges,
      cells.unitQuantity,
      cells.weight,
      cells.source,
    ],
    logistics: [
      cells.identity,
      cells.logistics,
      cells.country,
      cells.product,
      cells.quantityWeight,
      cells.participant,
      cells.source,
    ],
    product: [
      cells.product,
      cells.values,
      cells.quantityWeight,
      cells.country,
      cells.logistics,
      cells.participant,
      cells.source,
    ],
    provenance: [
      cells.source,
      cells.identity,
      cells.product,
      cells.participant,
      cells.logistics,
      cells.values,
    ],
  } satisfies Record<TradeRecordTableViewId, ReactNode[]>;

  return <TableRow key={record.id}>{viewCells[view]}</TableRow>;
}
