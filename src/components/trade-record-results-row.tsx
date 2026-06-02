import { TableRow } from "@/components/ui/table";
import {
  CountryCell,
  LogisticsCell,
  ParticipantCell,
  ProductCell,
  QuantityWeightCell,
  RecordIdentityCell,
  SourceProvenanceCell,
  ValuesCell,
} from "@/components/trade-record-results-row-cells";
import { sourceTradeRecordsHref } from "@/sources/source-provenance";
import {
  buildTradeRecordSearchHref,
  type TradeRecordDrilldownTarget,
} from "@/trade/trade-record-links";
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
}: {
  params: Record<string, string | string[] | undefined>;
  record: TradeRecordRow;
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
  const period = `${record.periodYear}-${String(record.periodMonth).padStart(2, "0")}`;
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
        type: "port",
        code: portCode,
      })
    : null;

  return (
    <TableRow key={record.id}>
      <RecordIdentityCell period={period} record={record} />
      <ProductCell hsFilterHref={hsFilterHref} record={record} />
      <ParticipantCell
        participantFilterHref={participantFilterHref}
        record={record}
      />
      <ValuesCell record={record} />
      <QuantityWeightCell record={record} />
      <CountryCell countryFilterHref={countryFilterHref} record={record} />
      <LogisticsCell
        customsFilterHref={customsFilterHref}
        portFilterHref={portFilterHref}
        record={record}
      />
      <SourceProvenanceCell
        batchHref={batchHref}
        batchRecordsHref={batchRecordsHref}
        record={record}
        sourceHref={sourceHref}
        sourceRecordsHref={sourceRecordsHref}
      />
    </TableRow>
  );
}
