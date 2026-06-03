import {
  codeTableKeyForSourceField,
  exportCodedFields,
  exportFieldNames,
  importCodedFields,
  importFieldNames,
} from "../../src/ingest/aduana-source-layouts";
import type {
  AduanaPreflightCandidate,
  AduanaPreflightCheck,
  PreflightFlow,
  PreflightStatus,
} from "./aduana-load-preflight";

const statusRank: Record<PreflightStatus, number> = {
  compatible: 0,
  warning: 1,
  manual_review: 2,
  blocker: 3,
};

export function maxStatus(statuses: PreflightStatus[]): PreflightStatus {
  return statuses.reduce<PreflightStatus>(
    (current, status) => (statusRank[status] > statusRank[current] ? status : current),
    "compatible",
  );
}

export function check(
  status: PreflightStatus,
  key: string,
  title: string,
  detail: string,
): AduanaPreflightCheck {
  return { key, status, title, detail };
}

export function expectedLayout(flow: PreflightFlow): {
  name: string;
  fieldNames: readonly string[];
  codedFields: Set<string>;
} {
  if (flow === "import") {
    return {
      name: "DIN main item file",
      fieldNames: importFieldNames,
      codedFields: importCodedFields,
    };
  }

  return {
    name: "DUS main item file",
    fieldNames: exportFieldNames,
    codedFields: exportCodedFields,
  };
}

export function metadataChecks(
  candidate: AduanaPreflightCandidate,
): AduanaPreflightCheck[] {
  const checks: AduanaPreflightCheck[] = [];
  checks.push(
    check(
      candidate.country === "CL" ? "compatible" : "manual_review",
      "country",
      "País fuente",
      candidate.country === "CL"
        ? "Fuente clasificada como Chile."
        : "El país no está confirmado como CL; revisar antes de usar el parser Aduana Chile.",
    ),
  );

  checks.push(
    check(
      candidate.sourceDomain === "datos.gob.cl" || candidate.source === "working_path"
        ? "compatible"
        : "manual_review",
      "source_domain",
      "Dominio fuente",
      candidate.sourceDomain === "datos.gob.cl"
        ? "Fuente datos.gob.cl compatible con el parser DIN/DUS actual."
        : candidate.source === "working_path"
          ? "Ruta working directa; no hay dominio de manifiesto para validar."
          : "Fuente distinta de datos.gob.cl; puede ser archivo operativo Aduana.cl y requiere revisión manual.",
    ),
  );

  const expectedPeriod =
    candidate.year && candidate.month ? `${candidate.year}-${String(candidate.month).padStart(2, "0")}` : null;
  checks.push(
    check(
      expectedPeriod && candidate.period && expectedPeriod !== candidate.period ? "warning" : "compatible",
      "period",
      "Periodo",
      expectedPeriod && candidate.period && expectedPeriod !== candidate.period
        ? `El año/mes (${expectedPeriod}) no coincide con period (${candidate.period}).`
        : `Periodo candidato ${candidate.period ?? expectedPeriod ?? "sin periodo explícito"}.`,
    ),
  );

  checks.push(
    check(
      candidate.rawFileRole === "compressed_source_file" || candidate.rawFileRole === "direct_source_file" || candidate.source === "working_path"
        ? "compatible"
        : "warning",
      "file_role",
      "Rol archivo fuente",
      candidate.rawFileRole
        ? `Rol declarado: ${candidate.rawFileRole}.`
        : "Sin rol raw declarado; confirmar si es fuente oficial o extracto working.",
    ),
  );

  return checks;
}

export function riskCodeFields(flow: PreflightFlow): Record<string, Record<string, string>> {
  const unresolvedAduanaCodes = {
    "56": "Aduana 56 tiene evidencia oficial en Anexo 51 como Araucanía; verificar que code_tables contenga la fila revisada antes de cargar otro mes.",
  };
  const unresolvedCurrencyCodes = {
    "141": "Moneda 141 tiene evidencia oficial en Anexo 51-20; verificar que code_tables contenga la fila revisada antes de cargar otro mes.",
    "145": "Moneda 145 tiene evidencia oficial en Anexo 51-20; verificar que code_tables contenga la fila revisada antes de cargar otro mes.",
    "147": "Moneda 147 tiene evidencia oficial en Anexo 51-20; verificar que code_tables contenga la fila revisada antes de cargar otro mes.",
    "149": "Moneda 149 tiene evidencia oficial en Anexo 51-20; verificar que code_tables contenga la fila revisada antes de cargar otro mes.",
    "157": "Moneda 157 tiene evidencia oficial en Anexo 51-20; verificar que code_tables contenga la fila revisada antes de cargar otro mes.",
  };
  const unresolvedPortCodes = {
    "825": "Puerto 825 tiene evidencia oficial en Anexo 51-11 como Aeródromo La Araucanía; verificar que code_tables contenga la fila revisada antes de cargar otro mes.",
  };

  if (flow === "import") {
    return {
      ADU: unresolvedAduanaCodes,
      MONEDA: unresolvedCurrencyCodes,
      PTO_DESEM: unresolvedPortCodes,
    };
  }

  return {
    ADUANA: unresolvedAduanaCodes,
    MONEDA: unresolvedCurrencyCodes,
    PUERTOEMB: unresolvedPortCodes,
  };
}

export function layoutChecks(
  candidate: AduanaPreflightCandidate,
): AduanaPreflightCheck[] {
  const layout = expectedLayout(candidate.tradeFlow);
  const keyFields =
    candidate.tradeFlow === "import"
      ? ["NUMENCRIPTADO", "NUM_UNICO_IMPORTADOR", "ARANC-NAC", "CIF-ITEM", "TOT_PESO"]
      : ["NUMEROIDENT", "NRO_EXPORTADOR", "CODIGOARANCEL", "FOBUS", "PESOBRUTOITEM"];
  const missingKeyFields = keyFields.filter((field) => !layout.fieldNames.includes(field));
  const codedFieldsWithoutDictionary = [...layout.codedFields].filter((field) => !codeTableKeyForSourceField(field));

  return [
    check(
      missingKeyFields.length === 0 ? "compatible" : "blocker",
      "required_fields",
      "Campos comerciales clave",
      missingKeyFields.length === 0
        ? `Layout ${layout.name} conserva campos clave para normalización MVP.`
        : `Faltan campos clave en el layout esperado: ${missingKeyFields.join(", ")}.`,
    ),
    check(
      codedFieldsWithoutDictionary.length === 0 ? "compatible" : "warning",
      "coded_fields",
      "Campos codificados",
      codedFieldsWithoutDictionary.length === 0
        ? "Los campos codificados principales tienen tabla esperada o no son críticos para filtros actuales."
        : `Hay campos codificados sin tabla confirmada: ${codedFieldsWithoutDictionary.slice(0, 12).join(", ")}.`,
    ),
  ];
}

export function payloadRetentionChecks(): AduanaPreflightCheck[] {
  const retention = process.env.RAW_ROW_PAYLOAD_RETENTION;
  return [
    check(
      retention === "errors_and_warnings" ? "compatible" : "warning",
      "payload_retention",
      "Retención de payload",
      retention === "errors_and_warnings"
        ? "RAW_ROW_PAYLOAD_RETENTION=errors_and_warnings está alineado con la recomendación para cargas reales pequeñas."
        : "Si se carga otro mes real en dev, usar RAW_ROW_PAYLOAD_RETENTION=errors_and_warnings para evitar repetir crecimiento full_postgres.",
    ),
  ];
}
