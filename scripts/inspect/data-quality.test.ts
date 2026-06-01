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
