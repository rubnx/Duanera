import { isUuid } from "@/lib/ids";
import type { SourceProvenanceSummary } from "@/sources/source-provenance";

export function sourceFilenameLabel(filename: string | null | undefined) {
  if (!filename) {
    return null;
  }

  return filename.split(/[\\/]/).filter(Boolean).at(-1) ?? filename;
}

export function sourceTradeFlow(value: string | null | undefined) {
  return value === "import" || value === "export" ? value : undefined;
}

export function sourceTradeFlowLabel(value: string | null | undefined) {
  if (value === "import") {
    return "Importaciones";
  }

  if (value === "export") {
    return "Exportaciones";
  }

  return "Referencia";
}

export function sourceFileRoleLabel(value: string) {
  const labels: Record<string, string> = {
    compressed_source_file: "Archivo oficial comprimido",
    direct_source_file: "Archivo directo",
    reference_file: "Referencia oficial",
  };

  return labels[value] ?? value;
}

export function sourceProcessingStatusLabel(value: string) {
  const labels: Record<string, string> = {
    completed: "Completado",
    failed: "Fallido",
    metadata_seeded: "Metadatos cargados",
    partial: "Parcial",
    pending: "Pendiente",
  };

  return labels[value] ?? value;
}

export function isSourceProvenanceId(value: string) {
  return isUuid(value);
}

export function safeSourcePageUrl(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

export function sourceDisplayFilename(source: Pick<
  SourceProvenanceSummary,
  "normalizedRawFilename" | "originalFilename"
>) {
  return (
    sourceFilenameLabel(source.normalizedRawFilename ?? source.originalFilename) ??
    source.originalFilename
  );
}

export function sourcePeriodLabel(
  source: Pick<
    SourceProvenanceSummary,
    "periodYear" | "periodMonth" | "periodStart" | "periodEnd"
  >,
) {
  if (source.periodYear && source.periodMonth) {
    return `${source.periodYear}-${String(source.periodMonth).padStart(2, "0")}`;
  }

  if (source.periodStart && source.periodEnd) {
    return `${source.periodStart} a ${source.periodEnd}`;
  }

  return "No informado";
}

export function sourceTradeRecordsHref({
  importBatchId,
  sourceFileId,
  tradeFlow,
}: {
  sourceFileId: string;
  importBatchId?: string;
  tradeFlow?: "import" | "export";
}) {
  if (!isUuid(sourceFileId) || (importBatchId && !isUuid(importBatchId))) {
    return null;
  }

  const query = new URLSearchParams({
    sourceFileId: sourceFileId.toLowerCase(),
    limit: "25",
  });

  if (tradeFlow) {
    query.set("tradeFlow", tradeFlow);
  }

  if (importBatchId) {
    query.set("importBatchId", importBatchId.toLowerCase());
  }

  return `/trade-records?${query.toString()}`;
}
