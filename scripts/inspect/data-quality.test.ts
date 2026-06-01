import test from "node:test";
import assert from "node:assert/strict";

import {
  coveragePercent,
  coverageStatus,
  dataQualityIssueRecordHref,
  dataQualityIssueSearchHref,
  dataQualityIssueStatus,
  dataQualityRemediationNextStep,
  dataQualityRemediationStatus,
  dataQualityRemediationTotal,
  dataQualitySourceBatchKey,
  normalizeCodeForCoverage,
} from "../../src/quality/data-quality";
import {
  fieldMappingConfidenceLabel,
  fieldMappingCoverageStatus,
  fieldMappingGroupLabel,
  fieldMappingSearchHref,
  fieldMappingSourceTradeHref,
} from "../../src/quality/field-mapping";
import {
  codeTableRemediationHref,
  codeTableRemediationNextAction,
  codeTableRemediationPriorityLabel,
  codeTableRemediationStatus,
  codeTableTopUndecodedCodes,
} from "../../src/quality/code-table-remediation";

test("normalizes Aduana codes for label coverage comparisons", () => {
  assert.equal(normalizeCodeForCoverage("001"), "1");
  assert.equal(normalizeCodeForCoverage("000"), "0");
  assert.equal(normalizeCodeForCoverage(" cl "), "CL");
  assert.equal(normalizeCodeForCoverage(""), null);
  assert.equal(normalizeCodeForCoverage(null), null);
});

test("computes coverage percentages with stable one-decimal precision", () => {
  assert.equal(coveragePercent(100, 100), 100);
  assert.equal(coveragePercent(1, 3), 33.3);
  assert.equal(coveragePercent(0, 0), 0);
});

test("classifies coverage conservatively", () => {
  assert.equal(coverageStatus({ covered: 100, total: 100 }), "ok");
  assert.equal(coverageStatus({ covered: 95, total: 100 }), "review");
  assert.equal(coverageStatus({ covered: 89, total: 100 }), "warning");
  assert.equal(coverageStatus({ covered: 0, total: 0 }), "review");
});

test("builds data-quality issue drilldown links through the trade-record parser contract", () => {
  assert.equal(dataQualityIssueRecordHref("record-123"), "/trade-records/record-123");
  assert.equal(
    dataQualityIssueSearchHref({
      tradeFlow: "export",
      periodFrom: "2026-03",
      periodTo: "2026-03",
      transportModeCode: "1",
      limit: 25,
    }),
    "/trade-records?tradeFlow=export&periodFrom=2026-03&periodTo=2026-03&transportMode=1&limit=25",
  );
});

test("classifies issue groups by presence without hiding clean checks", () => {
  assert.equal(dataQualityIssueStatus(0), "ok");
  assert.equal(dataQualityIssueStatus(3), "review");
  assert.equal(dataQualityIssueStatus(3, "warning"), "warning");
});

test("summarizes source/batch remediation issue counts by priority", () => {
  const cleanCounts = {
    missingImportGrossWeightItem: 0,
    undecodedCustomsOffice: 0,
    undecodedPort: 0,
    undecodedTransportMode: 0,
    missingOrZeroItemValue: 0,
    missingOrZeroDeclarationFob: 0,
    quantityUnitValueReview: 0,
  };
  const weightCounts = {
    ...cleanCounts,
    missingImportGrossWeightItem: 12,
    undecodedPort: 2,
  };
  const logisticsCounts = {
    ...cleanCounts,
    undecodedCustomsOffice: 1,
    undecodedTransportMode: 3,
  };

  assert.equal(dataQualityRemediationTotal(weightCounts), 14);
  assert.equal(dataQualityRemediationStatus(cleanCounts), "ok");
  assert.equal(dataQualityRemediationStatus(logisticsCounts), "review");
  assert.equal(dataQualityRemediationStatus(weightCounts), "warning");
  assert.match(dataQualityRemediationNextStep(weightCounts), /peso bruto item/);
  assert.match(dataQualityRemediationNextStep(logisticsCounts), /tablas de códigos/);
});

test("builds stable source/batch remediation keys", () => {
  assert.equal(
    dataQualitySourceBatchKey({
      sourceFileId: "source-1",
      importBatchId: "batch-2",
      tradeFlow: "import",
    }),
    "source-1:batch-2:import",
  );
});

test("classifies field-mapping coverage conservatively", () => {
  assert.equal(
    fieldMappingCoverageStatus({
      confidence: "verified",
      normalizedTotalRows: 100,
      normalizedPresentRows: 100,
      rawFields: ["CIF-ITEM"],
      rawSampleRows: 100,
      rawPresentRows: 100,
    }),
    "ok",
  );
  assert.equal(
    fieldMappingCoverageStatus({
      confidence: "inferred",
      normalizedTotalRows: 100,
      normalizedPresentRows: 91,
      rawFields: ["FECACEP"],
      rawSampleRows: 100,
      rawPresentRows: 100,
    }),
    "review",
  );
  assert.equal(
    fieldMappingCoverageStatus({
      confidence: "needs_review",
      normalizedTotalRows: 100,
      normalizedPresentRows: 0,
      rawFields: [],
      rawSampleRows: 100,
      rawPresentRows: 0,
    }),
    "warning",
  );
});

test("builds field-mapping links through safe route contracts", () => {
  assert.equal(
    fieldMappingSearchHref("export"),
    "/trade-records?tradeFlow=export&periodYear=2026&periodMonth=3&limit=25",
  );
  assert.equal(
    fieldMappingSourceTradeHref({
      sourceFileId: "source-1",
      importBatchId: "batch-2",
      tradeFlow: "import",
    }),
    "/trade-records?sourceFileId=source-1&limit=25&tradeFlow=import&importBatchId=batch-2",
  );
});

test("labels field-mapping groups and confidence in Spanish", () => {
  assert.equal(fieldMappingGroupLabel("commercial_values"), "Valores comerciales");
  assert.equal(fieldMappingConfidenceLabel("verified"), "Mapeo directo");
  assert.equal(fieldMappingConfidenceLabel("needs_review"), "Requiere revisión");
});

test("classifies code-table remediation coverage by commercial priority", () => {
  assert.equal(
    codeTableRemediationStatus({
      decodedCodes: 3,
      distinctCodes: 3,
      priority: "high",
      recordsWithCode: 100,
    }),
    "ok",
  );
  assert.equal(
    codeTableRemediationStatus({
      decodedCodes: 2,
      distinctCodes: 3,
      priority: "high",
      recordsWithCode: 100,
    }),
    "warning",
  );
  assert.equal(
    codeTableRemediationStatus({
      decodedCodes: 2,
      distinctCodes: 3,
      priority: "medium",
      recordsWithCode: 100,
    }),
    "review",
  );
  assert.equal(
    codeTableRemediationStatus({
      codeTableFound: false,
      decodedCodes: 0,
      distinctCodes: 3,
      priority: "high",
      recordsWithCode: 100,
    }),
    "warning",
  );
  assert.equal(
    codeTableRemediationStatus({
      decodedCodes: 0,
      distinctCodes: 0,
      priority: "low",
      recordsWithCode: 0,
    }),
    "review",
  );
});

test("builds code-table sample links through supported /trade-records filters", () => {
  assert.equal(
    codeTableRemediationHref({
      code: "076",
      definition: { filterKind: "originCountry", tradeFlow: "import" },
    }),
    "/trade-records?tradeFlow=import&periodYear=2026&periodMonth=3&originCountry=076&limit=25",
  );
  assert.equal(
    codeTableRemediationHref({
      code: "099",
      definition: { tradeFlow: "export" },
    }),
    "/trade-records?tradeFlow=export&periodYear=2026&periodMonth=3&limit=25",
  );
});

test("ranks top undecoded code-table gaps by affected records", () => {
  const rows = [
    { code: "001", records: 10 },
    { code: "002", records: 40 },
    { code: "0002", records: 5 },
    { code: "003", records: 40 },
    { code: "004", records: 1 },
  ];

  const result = codeTableTopUndecodedCodes({
    codeRows: rows,
    codeSet: new Set(["1"]),
    definition: { filterKind: "customsOffice", tradeFlow: "import" },
    limit: 2,
  });

  assert.deepEqual(
    result.map((row) => [row.normalizedCode, row.records, row.tradeRecordsHref]),
    [
      [
        "2",
        45,
        "/trade-records?tradeFlow=import&periodYear=2026&periodMonth=3&customsOffice=002&limit=25",
      ],
      [
        "3",
        40,
        "/trade-records?tradeFlow=import&periodYear=2026&periodMonth=3&customsOffice=003&limit=25",
      ],
    ],
  );
});

test("labels and explains code-table remediation actions conservatively", () => {
  assert.equal(codeTableRemediationPriorityLabel("high"), "Alta");
  assert.match(
    codeTableRemediationNextAction({
      codeTableKey: "chile_aduana:puertos",
      codeTableFound: false,
      priority: "high",
      recordsWithUndecodedCode: 5,
    }),
    /no corregir valores sin evidencia oficial/,
  );
  assert.match(
    codeTableRemediationNextAction({
      codeTableKey: "chile_aduana:moneda",
      priority: "medium",
      recordsWithUndecodedCode: 5,
    }),
    /comparar unidades, moneda o valores agregados/,
  );
});
