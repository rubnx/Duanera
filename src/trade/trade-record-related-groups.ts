import type {
  TradeFlow,
  TradeRecordFilters,
  TradeRecordRelatedGroupDefinition,
  TradeRecordSummary,
} from "./trade-records";
import { formatTradeRecordPeriodValue } from "./trade-record-periods";

function exactPeriodFilters(record: TradeRecordSummary): Pick<
  TradeRecordFilters,
  "periodFrom" | "periodTo"
> {
  const period = formatTradeRecordPeriodValue(record.periodYear, record.periodMonth);
  return {
    periodFrom: period,
    periodTo: period,
  };
}

function countryFilterForRecord(record: TradeRecordSummary): Pick<
  TradeRecordFilters,
  "originCountryCode" | "destinationCountryCode"
> {
  if (record.tradeFlow === "export") {
    return {
      destinationCountryCode: record.destinationCountryCode ?? undefined,
    };
  }

  return {
    originCountryCode: record.originCountryCode ?? undefined,
  };
}

function relevantPortFilterForRecord(record: TradeRecordSummary): Pick<
  TradeRecordFilters,
  "embarkPortCode" | "disembarkPortCode"
> {
  if (record.tradeFlow === "export") {
    return {
      embarkPortCode: record.embarkPortCode ?? undefined,
    };
  }

  return {
    disembarkPortCode: record.disembarkPortCode ?? undefined,
  };
}

function participantFilterForRecord(record: TradeRecordSummary): Pick<
  TradeRecordFilters,
  "importerCorrelativeId" | "exporterCorrelativeId"
> {
  if (record.tradeFlow === "import") {
    return {
      importerCorrelativeId: record.importerCorrelativeId ?? undefined,
    };
  }

  return {
    exporterCorrelativeId:
      record.exporterPrimaryCorrelativeId ??
      record.exporterSecondaryCorrelativeId ??
      undefined,
  };
}

function compactFilters(filters: TradeRecordFilters): TradeRecordFilters {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== undefined && value !== ""),
  ) as TradeRecordFilters;
}

export function buildTradeRecordRelatedGroupDefinitions(
  record: TradeRecordSummary,
  limit = 5,
): TradeRecordRelatedGroupDefinition[] {
  const period = exactPeriodFilters(record);
  const baseFilters: TradeRecordFilters = compactFilters({
    tradeFlow: record.tradeFlow as TradeFlow,
    ...period,
    limit,
  });
  const hsCode = record.hsCodeNormalized ?? undefined;
  const relevantCountry = countryFilterForRecord(record);
  const participant = participantFilterForRecord(record);
  const relevantPort = relevantPortFilterForRecord(record);

  return [
    ...(hsCode
      ? [
          {
            key: "same_hs_flow" as const,
            title: "Misma partida HS y flujo",
            description:
              "Otros registros del mismo mes, flujo y código HS normalizado.",
            filters: compactFilters({
              ...baseFilters,
              hsCodePrefix: hsCode,
            }),
          },
        ]
      : []),
    ...(hsCode && (relevantCountry.originCountryCode || relevantCountry.destinationCountryCode)
      ? [
          {
            key: "same_country_hs" as const,
            title:
              record.tradeFlow === "export"
                ? "Mismo destino y HS"
                : "Mismo origen y HS",
            description:
              "Registros del mismo mes que combinan país comercial relevante y código HS.",
            filters: compactFilters({
              ...baseFilters,
              hsCodePrefix: hsCode,
              ...relevantCountry,
            }),
          },
        ]
      : []),
    ...(participant.importerCorrelativeId || participant.exporterCorrelativeId
      ? [
          {
            key: "same_participant" as const,
            title:
              record.tradeFlow === "export"
                ? "Mismo correlativo exportador Aduana"
                : "Mismo correlativo importador Aduana",
            description:
              "Correlativo anónimo de la fuente Aduana; no es identidad legal verificada.",
            filters: compactFilters({
              ...baseFilters,
              ...participant,
            }),
          },
        ]
      : []),
    ...(record.customsOfficeCode
      ? [
          {
            key: "same_customs_office" as const,
            title: "Misma aduana",
            description: "Registros del mismo mes, flujo y oficina Aduana.",
            filters: compactFilters({
              ...baseFilters,
              customsOfficeCode: record.customsOfficeCode,
            }),
          },
        ]
      : []),
    ...(relevantPort.embarkPortCode || relevantPort.disembarkPortCode
      ? [
          {
            key: "same_relevant_port" as const,
            title:
              record.tradeFlow === "export"
                ? "Mismo puerto de embarque"
                : "Mismo puerto de desembarque",
            description:
              "Registros del mismo mes, flujo y puerto relevante para el flujo.",
            filters: compactFilters({
              ...baseFilters,
              ...relevantPort,
            }),
          },
        ]
      : []),
  ];
}
