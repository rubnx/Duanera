import { createReadStream, existsSync } from "node:fs";
import { createInterface } from "node:readline";

import iconv from "iconv-lite";

import { parseAduanaRow } from "../../src/ingest/aduana-main-file";
import { resolvePreflightDataPath } from "./aduana-load-preflight-candidates";
import {
  check,
  expectedLayout,
  riskCodeFields,
} from "./aduana-load-preflight-checks";
import type {
  AduanaPreflightCandidate,
  AduanaPreflightCheck,
  AduanaPreflightSample,
} from "./aduana-load-preflight";

export async function sampleCandidateRows(
  candidate: AduanaPreflightCandidate,
  sampleRows: number,
): Promise<{ sample: AduanaPreflightSample; checks: AduanaPreflightCheck[] }> {
  const layout = expectedLayout(candidate.tradeFlow);
  const checks: AduanaPreflightCheck[] = [];
  const fieldCounts: Record<string, number> = {};
  const observedRiskCodes: AduanaPreflightSample["observedRiskCodes"] = [];
  const riskFields = riskCodeFields(candidate.tradeFlow);
  const workingPath = resolvePreflightDataPath(candidate.workingPath);

  if (!existsSync(workingPath)) {
    return {
      sample: {
        sampleRowsRequested: sampleRows,
        rowsRead: 0,
        parsedRows: 0,
        failedRows: 0,
        firstRowLooksLikeHeader: false,
        fieldCounts,
        observedRiskCodes,
      },
      checks: [
        check(
          "blocker",
          "sample_rows",
          "Muestra raw",
          "No se pudo leer la muestra porque el archivo working no existe.",
        ),
      ],
    };
  }

  const reader = createInterface({
    input: createReadStream(workingPath).pipe(iconv.decodeStream("win1252")),
    crlfDelay: Infinity,
  });

  let rowsRead = 0;
  let parsedRows = 0;
  let failedRows = 0;
  let firstRowLooksLikeHeader = false;

  for await (const line of reader) {
    if (rowsRead >= sampleRows) {
      break;
    }

    rowsRead += 1;
    const parsed = parseAduanaRow(line, rowsRead, layout.fieldNames);
    fieldCounts[String(parsed.fieldCount)] = (fieldCounts[String(parsed.fieldCount)] ?? 0) + 1;

    if (rowsRead === 1) {
      const rawValues = Object.values(parsed.rawValues);
      firstRowLooksLikeHeader = layout.fieldNames
        .slice(0, 5)
        .every((fieldName, index) => rawValues[index] === fieldName);
    }

    if (parsed.parseErrors.length > 0) {
      failedRows += 1;
    } else {
      parsedRows += 1;
    }

    for (const [field, codes] of Object.entries(riskFields)) {
      const value = parsed.rawValues[field]?.trim();
      if (value && codes[value] && !observedRiskCodes.some((risk) => risk.field === field && risk.code === value)) {
        observedRiskCodes.push({ field, code: value, risk: codes[value] });
      }
    }
  }

  checks.push(
    check(
      rowsRead > 0 ? "compatible" : "blocker",
      "sample_rows",
      "Muestra raw",
      rowsRead > 0 ? `Se leyeron ${rowsRead} filas de muestra.` : "No se pudo leer ninguna fila de muestra.",
    ),
  );
  checks.push(
    check(
      failedRows === 0 ? "compatible" : "blocker",
      "field_count",
      "Conteo de campos",
      failedRows === 0
        ? `Todas las filas muestreadas calzan con ${layout.fieldNames.length} campos.`
        : `${failedRows} de ${rowsRead} filas no calzan con ${layout.fieldNames.length} campos.`,
    ),
  );
  checks.push(
    check(
      firstRowLooksLikeHeader ? "blocker" : "compatible",
      "header",
      "Encabezado",
      firstRowLooksLikeHeader
        ? "La primera fila parece encabezado; el parser actual espera archivo sin encabezado."
        : "La muestra no parece incluir encabezado; compatible con el parser actual.",
    ),
  );
  checks.push(
    check(
      observedRiskCodes.length > 0 ? "warning" : "compatible",
      "known_code_table_risks",
      "Riesgos de diccionario",
      observedRiskCodes.length > 0
        ? `La muestra contiene códigos pendientes: ${observedRiskCodes.map((risk) => `${risk.field}=${risk.code}`).join(", ")}.`
        : "La muestra no expuso los códigos de diccionario pendientes conocidos.",
    ),
  );
  checks.push(
    check(
      "compatible",
      "anonymous_correlatives",
      "Correlativos anónimos",
      candidate.tradeFlow === "import"
        ? "NUM_UNICO_IMPORTADOR debe tratarse como identificador anónimo Aduana, no RUT ni nombre legal."
        : "NRO_EXPORTADOR/NRO_EXPORTADOR_SEC deben tratarse como identificadores anónimos Aduana, no RUT ni nombre legal.",
    ),
  );

  return {
    sample: {
      sampleRowsRequested: sampleRows,
      rowsRead,
      parsedRows,
      failedRows,
      firstRowLooksLikeHeader,
      fieldCounts,
      observedRiskCodes,
    },
    checks,
  };
}
