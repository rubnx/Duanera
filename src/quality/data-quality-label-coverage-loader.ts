import { sql } from "drizzle-orm";

import type { DbClient } from "@/db/client";
import { tradeRecords } from "@/db/schema";
import {
  codeCountsForDimension,
  loadCodeValueSets,
} from "@/quality/code-value-sets";
import {
  labelCoverageFromRows,
  type DataQualityLabelCoverage,
} from "@/quality/label-coverage";
import {
  march2026ReportPeriod,
  type QualityReportPeriod,
} from "@/quality/march-2026";
import { dusExportSpecialLogisticsCodes } from "@/quality/source-special-codes";

export async function loadLabelCoverage(
  db: DbClient,
  period: QualityReportPeriod = march2026ReportPeriod,
): Promise<DataQualityLabelCoverage[]> {
  const codeSets = await loadCodeValueSets(db);
  const [
    importCountries,
    exportCountries,
    importCustoms,
    exportCustoms,
    importPorts,
    exportPorts,
    importTransport,
    exportTransport,
  ] = await Promise.all([
    codeCountsForDimension(db, "import", sql<string>`${tradeRecords.originCountryCode}`, period),
    codeCountsForDimension(db, "export", sql<string>`${tradeRecords.destinationCountryCode}`, period),
    codeCountsForDimension(db, "import", sql<string>`${tradeRecords.customsOfficeCode}`, period),
    codeCountsForDimension(db, "export", sql<string>`${tradeRecords.customsOfficeCode}`, period),
    codeCountsForDimension(db, "import", sql<string>`${tradeRecords.disembarkPortCode}`, period),
    codeCountsForDimension(db, "export", sql<string>`${tradeRecords.embarkPortCode}`, period),
    codeCountsForDimension(db, "import", sql<string>`${tradeRecords.transportModeCode}`, period),
    codeCountsForDimension(db, "export", sql<string>`${tradeRecords.transportModeCode}`, period),
  ]);

  return [
    labelCoverageFromRows({
      caveat: "Origen para importaciones.",
      codeSet: codeSets.countries,
      key: "countries",
      label: "País origen",
      rows: importCountries,
      tradeFlow: "import",
    }),
    labelCoverageFromRows({
      caveat: "Destino para exportaciones.",
      codeSet: codeSets.countries,
      key: "countries",
      label: "País destino",
      rows: exportCountries,
      tradeFlow: "export",
    }),
    labelCoverageFromRows({
      caveat: "Aduana registrada en el archivo fuente.",
      codeSet: codeSets.customsOffices,
      key: "customsOffices",
      label: "Aduana",
      rows: importCustoms,
      tradeFlow: "import",
    }),
    labelCoverageFromRows({
      caveat: "Aduana registrada en el archivo fuente.",
      codeSet: codeSets.customsOffices,
      key: "customsOffices",
      label: "Aduana",
      rows: exportCustoms,
      tradeFlow: "export",
    }),
    labelCoverageFromRows({
      caveat: "Puerto de desembarque para importaciones.",
      codeSet: codeSets.ports,
      key: "ports",
      label: "Puerto desembarque",
      rows: importPorts,
      tradeFlow: "import",
    }),
    labelCoverageFromRows({
      caveat: "Puerto de embarque para exportaciones.",
      codeSet: codeSets.ports,
      key: "ports",
      label: "Puerto embarque",
      rows: exportPorts,
      tradeFlow: "export",
      ignoredSourceCodes: dusExportSpecialLogisticsCodes,
    }),
    labelCoverageFromRows({
      caveat: "Vía de transporte registrada en el archivo fuente.",
      codeSet: codeSets.transportModes,
      key: "transportModes",
      label: "Vía transporte",
      rows: importTransport,
      tradeFlow: "import",
    }),
    labelCoverageFromRows({
      caveat: "Vía de transporte registrada en el archivo fuente.",
      codeSet: codeSets.transportModes,
      key: "transportModes",
      label: "Vía transporte",
      rows: exportTransport,
      tradeFlow: "export",
      ignoredSourceCodes: dusExportSpecialLogisticsCodes,
    }),
  ];
}
