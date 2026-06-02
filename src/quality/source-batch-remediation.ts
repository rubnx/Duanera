import type { DataQualityStatus } from "@/quality/coverage";

export type DataQualityRemediationIssueCounts = {
  missingImportGrossWeightItem: number;
  undecodedCustomsOffice: number;
  undecodedPort: number;
  undecodedTransportMode: number;
  missingOrZeroItemValue: number;
  missingOrZeroDeclarationFob: number;
  quantityUnitValueReview: number;
};

export function dataQualitySourceBatchKey({
  importBatchId,
  sourceFileId,
  tradeFlow,
}: {
  sourceFileId: string;
  importBatchId: string;
  tradeFlow: string;
}) {
  return `${sourceFileId}:${importBatchId}:${tradeFlow}`;
}

export function dataQualityRemediationTotal(
  counts: DataQualityRemediationIssueCounts,
) {
  return (
    counts.missingImportGrossWeightItem +
    counts.undecodedCustomsOffice +
    counts.undecodedPort +
    counts.undecodedTransportMode +
    counts.missingOrZeroItemValue +
    counts.missingOrZeroDeclarationFob +
    counts.quantityUnitValueReview
  );
}

export function dataQualityRemediationStatus(
  counts: DataQualityRemediationIssueCounts,
): DataQualityStatus {
  if (
    counts.missingImportGrossWeightItem > 0 ||
    counts.missingOrZeroItemValue > 0 ||
    counts.missingOrZeroDeclarationFob > 0
  ) {
    return "warning";
  }

  return dataQualityRemediationTotal(counts) > 0 ? "review" : "ok";
}

export function dataQualityRemediationNextStep(
  counts: DataQualityRemediationIssueCounts,
) {
  if (counts.missingOrZeroItemValue > 0 || counts.missingOrZeroDeclarationFob > 0) {
    return "Revisar mapeo de valores comerciales contra el archivo fuente antes de usar agregados.";
  }

  if (counts.missingImportGrossWeightItem > 0) {
    return "Revisar parser/mapeo de peso bruto item para importaciones; comparar contra peso total y metadatos fuente.";
  }

  if (
    counts.undecodedCustomsOffice > 0 ||
    counts.undecodedPort > 0 ||
    counts.undecodedTransportMode > 0
  ) {
    return "Validar tablas de códigos Aduana cargadas y confirmar si los códigos fuente son nuevos, especiales o mal normalizados.";
  }

  if (counts.quantityUnitValueReview > 0) {
    return "Revisar normalización de cantidad, unidad y precio unitario antes de comparar unidades.";
  }

  return "Sin señales QA priorizadas para este lote en marzo 2026.";
}
