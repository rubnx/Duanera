import { countValueToNumber } from "@/db/count-values";
import type { DataQualityStatus } from "@/quality/coverage";
import { normalizeCodeForCoverage } from "@/quality/coverage";
import {
  type CodeTableRemediationFilterKind,
  type CodeTableRemediationPriority,
} from "@/quality/code-table-remediation-definitions";
import { march2026ReportPeriod } from "@/quality/march-2026";
import { buildTradeRecordSearchHref } from "@/trade/trade-record-links";
import type { TradeFlow } from "@/trade/trade-records";
import type {
  CodeTableCodeCountInput,
  TopUndecodedCode,
} from "@/quality/code-table-remediation";

const reportPeriod = march2026ReportPeriod;
const toNumber = countValueToNumber;

export function codeTableRemediationPriorityRank(
  priority: CodeTableRemediationPriority,
) {
  const ranks: Record<CodeTableRemediationPriority, number> = {
    high: 0,
    medium: 1,
    low: 2,
  };

  return ranks[priority];
}

export function codeTableRemediationStatus({
  codeTableFound = true,
  decodedCodes,
  distinctCodes,
  priority,
  recordsWithCode = 0,
}: {
  codeTableFound?: boolean;
  decodedCodes: number;
  distinctCodes: number;
  priority: CodeTableRemediationPriority;
  recordsWithCode?: number;
}): DataQualityStatus {
  if (!codeTableFound && recordsWithCode > 0) {
    return priority === "high" ? "warning" : "review";
  }

  if (distinctCodes <= 0) {
    return "review";
  }

  if (decodedCodes === distinctCodes) {
    return "ok";
  }

  return priority === "high" ? "warning" : "review";
}

export function codeTableRemediationNextAction({
  codeTableKey,
  codeTableFound = true,
  priority,
  recordsWithUndecodedCode,
  recordsWithSpecialSourceCode = 0,
  sourceSpecialCodeNote,
  unsupportedReason,
}: {
  codeTableKey: string;
  codeTableFound?: boolean;
  priority: CodeTableRemediationPriority;
  recordsWithUndecodedCode: number;
  recordsWithSpecialSourceCode?: number;
  sourceSpecialCodeNote?: string | null;
  unsupportedReason?: string;
}) {
  if (!codeTableFound && recordsWithUndecodedCode > 0) {
    return `Confirmar si la tabla oficial ${codeTableKey} fue cargada o si el campo fuente usa otro diccionario; no corregir valores sin evidencia oficial.`;
  }

  if (recordsWithUndecodedCode === 0) {
    if (recordsWithSpecialSourceCode > 0 && sourceSpecialCodeNote) {
      return `Sin brecha de etiqueta accionable para los códigos restantes. ${sourceSpecialCodeNote}`;
    }

    return unsupportedReason
      ? `Sin brecha de etiqueta detectada; mantener como contexto. ${unsupportedReason}`
      : "Sin brecha de etiqueta detectada en marzo 2026.";
  }

  const specialSuffix =
    recordsWithSpecialSourceCode > 0 && sourceSpecialCodeNote
      ? ` Mantener separado el valor especial: ${sourceSpecialCodeNote}`
      : "";

  if (priority === "high") {
    return `Priorizar contraste con diccionario/código oficial ${codeTableKey}; afecta filtros o rankings visibles.${specialSuffix}`;
  }

  if (priority === "medium") {
    return `Revisar ${codeTableKey} antes de comparar unidades, moneda o valores agregados.${specialSuffix}`;
  }

  return `Registrar brecha para limpieza posterior; impacto bajo en el MVP actual.${specialSuffix}`;
}

export function codeTableRemediationHref({
  code,
  definition,
}: {
  code?: string;
  definition: {
    filterKind?: CodeTableRemediationFilterKind;
    tradeFlow: TradeFlow;
  };
}) {
  const params: Record<string, string> = {
    tradeFlow: definition.tradeFlow,
    periodYear: String(reportPeriod.year),
    periodMonth: String(reportPeriod.month),
    limit: "25",
  };

  if (code && definition.filterKind) {
    params[definition.filterKind] = code;
  }

  return buildTradeRecordSearchHref(params);
}

export function codeTableTopUndecodedCodes({
  codeRows,
  codeSet,
  definition,
  ignoredSourceCodes = new Set<string>(),
  limit = 5,
}: {
  codeRows: CodeTableCodeCountInput[];
  codeSet: Set<string>;
  definition: {
    filterKind?: CodeTableRemediationFilterKind;
    tradeFlow: TradeFlow;
  };
  ignoredSourceCodes?: Set<string>;
  limit?: number;
}): TopUndecodedCode[] {
  const undecoded = new Map<string, TopUndecodedCode>();

  for (const row of codeRows) {
    const records = toNumber(row.records);
    const normalizedCode = normalizeCodeForCoverage(row.code);
    if (
      !normalizedCode ||
      codeSet.has(normalizedCode) ||
      ignoredSourceCodes.has(normalizedCode)
    ) {
      continue;
    }

    const displayCode = row.code?.trim() || normalizedCode;
    const existing = undecoded.get(normalizedCode);
    if (existing) {
      existing.records += records;
      continue;
    }

    undecoded.set(normalizedCode, {
      code: displayCode,
      normalizedCode,
      records,
      tradeRecordsHref: codeTableRemediationHref({
        code: displayCode,
        definition,
      }),
    });
  }

  return [...undecoded.values()]
    .sort(
      (a, b) =>
        b.records - a.records ||
        a.normalizedCode.localeCompare(b.normalizedCode),
    )
    .slice(0, limit);
}
