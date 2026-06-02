import type { DataQualityStatus } from "@/quality/coverage";
import type { DataQualityFieldCoverage } from "@/quality/field-coverage";
import type { DataQualityLabelCoverage } from "@/quality/label-coverage";
import type { DataQualityFlowSummary } from "@/quality/source-coverage";
import type { TradeFlow } from "@/trade/trade-records";

export type DataQualityPayloadCoverage = {
  tradeFlow: TradeFlow | "unknown";
  retentionMode: string;
  storageKind: string;
  reconstructable: boolean;
  rows: number;
};

export type DataQualityFinding = {
  status: DataQualityStatus;
  title: string;
  detail: string;
};

export function buildDataQualityFindings({
  fieldCoverage,
  flows,
  labelCoverage,
  payloadCoverage,
}: {
  fieldCoverage: DataQualityFieldCoverage[];
  flows: DataQualityFlowSummary[];
  labelCoverage: DataQualityLabelCoverage[];
  payloadCoverage: DataQualityPayloadCoverage[];
}): DataQualityFinding[] {
  const findings: DataQualityFinding[] = [];

  for (const flow of flows) {
    if (flow.status === "ok") {
      findings.push({
        status: "ok",
        title: `${flow.tradeFlow === "import" ? "Importaciones" : "Exportaciones"}: filas normalizadas`,
        detail: `${flow.rawRows.toLocaleString("es-CL")} filas crudas y ${flow.tradeRecords.toLocaleString("es-CL")} registros normalizados; diferencia ${flow.rawToTradeDelta.toLocaleString("es-CL")}.`,
      });
    } else {
      findings.push({
        status: flow.status,
        title: `${flow.tradeFlow === "import" ? "Importaciones" : "Exportaciones"}: revisar normalización`,
        detail: `Diferencia raw-normalizado ${flow.rawToTradeDelta.toLocaleString("es-CL")} y ${flow.failedRows.toLocaleString("es-CL")} filas fallidas.`,
      });
    }
  }

  const labelProblems = labelCoverage.filter((row) => row.status !== "ok");
  if (labelProblems.length > 0) {
    findings.push({
      status: labelProblems.some((row) => row.status === "warning") ? "warning" : "review",
      title: "Cobertura de etiquetas decodificadas",
      detail: `${labelProblems.length} dimensiones tienen códigos sin match perfecto en tablas Aduana. La UI debe mostrar código + etiqueta cuando exista y conservar el código fuente.`,
    });
  } else {
    findings.push({
      status: "ok",
      title: "Etiquetas decodificadas",
      detail: "Países, aduanas, puertos y vías principales decodifican contra tablas Aduana para los registros con código.",
    });
  }

  const missingCoreFields = fieldCoverage.filter((row) => row.status === "warning");
  if (missingCoreFields.length > 0) {
    const fieldLabel = missingCoreFields.length === 1 ? "campo" : "campos";
    const verb = missingCoreFields.length === 1 ? "está" : "están";
    findings.push({
      status: "warning",
      title: "Campos comerciales incompletos",
      detail: `${missingCoreFields.length} ${fieldLabel} de alto valor ${verb} bajo el umbral de cobertura. Priorizar revisión de parser o mapeo antes de usar esos campos para decisiones.`,
    });
  }

  const prunedRows = payloadCoverage.reduce(
    (total, row) => total + (row.retentionMode === "pruned" ? row.rows : 0),
    0,
  );
  findings.push({
    status: prunedRows > 0 ? "review" : "ok",
    title: "Payload crudo y trazabilidad",
    detail:
      prunedRows > 0
        ? `${prunedRows.toLocaleString("es-CL")} filas tienen payload podado; revisar reconstructibilidad antes de auditoría fina.`
        : "Las filas de marzo 2026 mantienen payload crudo completo en Postgres dev y trazabilidad a fuente/lote/fila.",
  });

  findings.push({
    status: "review",
    title: "Correlativos anónimos",
    detail:
      "Los correlativos importador/exportador siguen siendo identificadores anónimos de Aduana. No deben presentarse como RUT, razón social ni identidad legal verificada.",
  });

  return findings;
}
