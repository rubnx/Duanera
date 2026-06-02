import Link from "next/link";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { TableCell } from "@/components/ui/table";
import { sourceFilenameLabel } from "@/sources/source-provenance";
import { productDisplayFromRaw } from "@/trade/trade-record-display";
import {
  formatTradeCodeLabel,
  formatTradeMoney,
  formatTradeQuantity,
} from "@/trade/trade-record-format";
import {
  formatPayloadRetainedReason,
  formatPayloadRetentionMode,
} from "@/trade/trade-record-provenance";
import type { TradeRecordSearchResponse } from "@/trade/trade-record-search";

type TradeRecordRow = TradeRecordSearchResponse["data"][number];

type RowHref = string | null;

function participant(record: TradeRecordRow) {
  if (record.tradeFlow === "import") {
    return {
      label: "Importador Aduana",
      value: record.importerCorrelativeId ?? "—",
    };
  }

  return {
    label: "Exportador Aduana",
    value:
      record.exporterPrimaryCorrelativeId ??
      record.exporterSecondaryCorrelativeId ??
      "—",
  };
}

function formatImportBatchStatus(value: string) {
  const labels: Record<string, string> = {
    completed: "Lote completo",
    failed: "Lote fallido",
    running: "Lote en proceso",
    pending: "Lote pendiente",
  };

  return labels[value] ?? `Lote ${value}`;
}

function compactPayloadRetentionLabel(record: TradeRecordRow) {
  if (record.payloadRetainedReason === "pruned_after_normalization") {
    return "Payload podado";
  }

  if (record.payloadRetentionMode === "full_postgres") {
    return "Payload completo";
  }

  if (record.payloadRetentionMode === "errors_and_warnings") {
    return "Payload selectivo";
  }

  return formatPayloadRetentionMode(record.payloadRetentionMode);
}

function payloadRetentionTitle(record: TradeRecordRow) {
  const reason = record.payloadRetainedReason
    ? ` · ${formatPayloadRetainedReason(record.payloadRetainedReason)}`
    : "";

  return `${formatPayloadRetentionMode(record.payloadRetentionMode)}${reason}`;
}

function itemValueForFlow(record: TradeRecordRow) {
  if (record.tradeFlow === "import") {
    return {
      label: "CIF item",
      value: formatTradeMoney(record.itemCifValue, record.decodedLabels.currency),
    };
  }

  return {
    label: "FOB item",
    value: formatTradeMoney(record.itemFobValue, record.decodedLabels.currency),
  };
}

function countryForFlow(record: TradeRecordRow) {
  if (record.tradeFlow === "import") {
    return {
      label: "Origen",
      value: formatTradeCodeLabel(
        record.originCountryCode,
        record.decodedLabels.originCountry,
      ),
    };
  }

  return {
    label: "Destino",
    value: formatTradeCodeLabel(
      record.destinationCountryCode,
      record.decodedLabels.destinationCountry,
    ),
  };
}

function portForFlow(record: TradeRecordRow) {
  if (record.tradeFlow === "import") {
    return {
      label: "Desembarque",
      value: formatTradeCodeLabel(
        record.disembarkPortCode,
        record.decodedLabels.disembarkPort,
      ),
    };
  }

  return {
    label: "Embarque",
    value: formatTradeCodeLabel(record.embarkPortCode, record.decodedLabels.embarkPort),
  };
}

function FilterAction({
  href,
  children,
}: {
  href: RowHref;
  children: ReactNode;
}) {
  if (!href) {
    return null;
  }

  return (
    <Link
      href={href}
      className="w-fit text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
    >
      {children}
    </Link>
  );
}

export function RecordIdentityCell({
  period,
  record,
}: {
  period: string;
  record: TradeRecordRow;
}) {
  return (
    <TableCell className="align-top">
      <div className="flex flex-col gap-1">
        <Badge variant="secondary" className="w-fit">
          {record.tradeFlow === "import" ? "Importación" : "Exportación"}
        </Badge>
        <div className="font-mono text-xs text-muted-foreground">{period}</div>
        <div className="font-mono text-xs">
          Declaración {record.declarationIdRaw ?? "—"} · Item{" "}
          {record.itemNumber ?? "—"}
        </div>
        <div className="text-xs text-muted-foreground">
          {record.acceptanceDate ?? "Sin fecha aceptación"}
        </div>
      </div>
    </TableCell>
  );
}

export function ProductCell({
  hsFilterHref,
  record,
}: {
  hsFilterHref: RowHref;
  record: TradeRecordRow;
}) {
  const product = productDisplayFromRaw(record.productDescriptionRaw);

  return (
    <TableCell className="max-w-[320px] align-top whitespace-normal">
      <div className="flex flex-col gap-1">
        <div className="font-mono text-xs text-muted-foreground">
          HS {record.hsCodeNormalized ?? "—"}
        </div>
        <FilterAction href={hsFilterHref}>Filtrar HS</FilterAction>
        <Link
          href={`/trade-records/${record.id}`}
          className="font-medium leading-snug underline-offset-4 hover:underline"
        >
          {product.title}
        </Link>
        {product.sourceReference ? (
          <div className="font-mono text-xs text-muted-foreground">
            Ref. fuente: {product.sourceReference}
          </div>
        ) : null}
        {product.details.length > 0 ? (
          <div className="line-clamp-2 text-xs text-muted-foreground">
            {product.details.join(" · ")}
          </div>
        ) : null}
      </div>
    </TableCell>
  );
}

export function ParticipantCell({
  participantFilterHref,
  record,
}: {
  participantFilterHref: RowHref;
  record: TradeRecordRow;
}) {
  const participantSummary = participant(record);

  return (
    <TableCell className="align-top">
      <div className="flex flex-col gap-1">
        <div className="text-xs text-muted-foreground">
          {participantSummary.label}
        </div>
        <div className="font-mono text-xs">{participantSummary.value}</div>
        <FilterAction href={participantFilterHref}>Ver mismo correlativo</FilterAction>
        <div className="max-w-[170px] whitespace-normal text-xs text-muted-foreground">
          Correlativo anónimo, no identidad legal.
        </div>
      </div>
    </TableCell>
  );
}

export function ValuesCell({ record }: { record: TradeRecordRow }) {
  const itemValue = itemValueForFlow(record);

  return (
    <TableCell className="align-top">
      <div className="flex flex-col gap-1">
        <div className="text-xs text-muted-foreground">{itemValue.label}</div>
        <div className="font-mono text-xs">{itemValue.value}</div>
        <div className="text-xs text-muted-foreground">FOB declaración</div>
        <div className="font-mono text-xs">
          {formatTradeMoney(
            record.declarationFobValue,
            record.decodedLabels.currency,
          )}
        </div>
      </div>
    </TableCell>
  );
}

export function QuantityWeightCell({ record }: { record: TradeRecordRow }) {
  return (
    <TableCell className="align-top">
      <div className="flex flex-col gap-1">
        <div className="font-mono text-xs">
          {formatTradeQuantity(
            record.quantity,
            record.quantityUnitCode,
            record.decodedLabels.quantityUnit,
          )}
        </div>
        <div className="text-xs text-muted-foreground">Peso bruto item</div>
        <div className="font-mono text-xs">{record.grossWeightItem ?? "—"}</div>
        <div className="text-xs text-muted-foreground">Peso bruto total</div>
        <div className="font-mono text-xs">{record.grossWeightTotal ?? "—"}</div>
      </div>
    </TableCell>
  );
}

export function CountryCell({
  countryFilterHref,
  record,
}: {
  countryFilterHref: RowHref;
  record: TradeRecordRow;
}) {
  const country = countryForFlow(record);

  return (
    <TableCell className="max-w-[210px] align-top whitespace-normal text-xs">
      <div className="flex flex-col gap-1">
        <div className="text-muted-foreground">{country.label}</div>
        <div>{country.value}</div>
        <FilterAction href={countryFilterHref}>Filtrar país</FilterAction>
      </div>
    </TableCell>
  );
}

export function LogisticsCell({
  customsFilterHref,
  portFilterHref,
  record,
}: {
  customsFilterHref: RowHref;
  portFilterHref: RowHref;
  record: TradeRecordRow;
}) {
  const port = portForFlow(record);

  return (
    <TableCell className="max-w-[260px] align-top whitespace-normal text-xs">
      <div className="flex flex-col gap-1">
        <div>
          <span className="text-muted-foreground">Aduana: </span>
          {formatTradeCodeLabel(
            record.customsOfficeCode,
            record.decodedLabels.customsOffice,
          )}
        </div>
        <FilterAction href={customsFilterHref}>Filtrar aduana</FilterAction>
        <div>
          <span className="text-muted-foreground">{port.label}: </span>
          {port.value}
        </div>
        <FilterAction href={portFilterHref}>Filtrar puerto</FilterAction>
        <div>
          <span className="text-muted-foreground">Vía: </span>
          {formatTradeCodeLabel(
            record.transportModeCode,
            record.decodedLabels.transportMode,
          )}
        </div>
        {record.cargoTypeCode || record.decodedLabels.cargoType ? (
          <div>
            <span className="text-muted-foreground">Carga: </span>
            {formatTradeCodeLabel(
              record.cargoTypeCode,
              record.decodedLabels.cargoType,
            )}
          </div>
        ) : null}
      </div>
    </TableCell>
  );
}

export function SourceProvenanceCell({
  batchHref,
  batchRecordsHref,
  record,
  sourceHref,
  sourceRecordsHref,
}: {
  batchHref: string;
  batchRecordsHref: RowHref;
  record: TradeRecordRow;
  sourceHref: string;
  sourceRecordsHref: RowHref;
}) {
  const sourceFilename =
    sourceFilenameLabel(record.sourceFilename) ?? "Fuente sin nombre";

  return (
    <TableCell className="max-w-[280px] align-top whitespace-normal text-xs">
      <div className="flex flex-col gap-1.5">
        <Link
          href={sourceHref}
          className="break-words font-medium underline-offset-4 hover:underline"
        >
          {sourceFilename}
        </Link>
        <div className="font-mono text-xs text-muted-foreground">
          Fila cruda {record.rawRowNumber}
        </div>
        <div className="flex flex-wrap gap-2">
          <FilterAction href={sourceRecordsHref}>Filtrar fuente</FilterAction>
          <FilterAction href={batchRecordsHref}>Filtrar lote</FilterAction>
          <FilterAction href={batchHref}>Ver lote</FilterAction>
        </div>
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          <Badge
            variant="outline"
            className="w-fit text-[11px]"
            title={`Estado del lote: ${record.importBatchStatus}`}
          >
            {formatImportBatchStatus(record.importBatchStatus)}
          </Badge>
          <Badge
            variant="outline"
            className="w-fit text-[11px]"
            title={payloadRetentionTitle(record)}
          >
            {compactPayloadRetentionLabel(record)}
          </Badge>
          <Badge
            variant="outline"
            className="w-fit text-[11px]"
            title={
              record.payloadReconstructable
                ? "La fila cruda puede reconstruirse desde la fuente preservada."
                : "La fila cruda no está marcada como reconstruible."
            }
          >
            {record.payloadReconstructable ? "Reconstruible" : "No reconstruible"}
          </Badge>
        </div>
        <div className="break-words text-xs text-muted-foreground">
          Parser{" "}
          <span className="font-mono">
            {record.parserName} {record.parserVersion}
          </span>
        </div>
      </div>
    </TableCell>
  );
}
