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
  isActionableUndecodedCode,
  normalizeCodeForCoverage,
} from "../../src/quality/data-quality";
import {
  fieldMappingConfidenceLabel,
  fieldMappingCoverageStatus,
  fieldMappingGroupLabel,
  fieldMappingSearchHref,
  fieldMappingSourceTradeHref,
  rawSampleValueRecord,
} from "../../src/quality/field-mapping";
import {
  codeTableRemediationHref,
  codeTableRemediationNextAction,
  codeTableRemediationPriorityLabel,
  codeTableRemediationStatus,
  codeTableTopUndecodedCodes,
} from "../../src/quality/code-table-remediation";
import {
  buildDataQualityRemediationQueueReport,
  dedupeRemediationQueueItems,
  remediationQueueScore,
  type RemediationQueueItemInput,
  type RemediationQueueReport,
} from "../../src/quality/remediation-queue";
import {
  buildLoadReadinessReport,
  loadReadinessAreaStatusFromCounts,
  loadReadinessDecisionFromStatuses,
  safeLoadReadinessLinks,
} from "../../src/quality/load-readiness";
import {
  assertReviewedPortRemediationScope,
  normalizeLabel,
  planPortCodeValueRemediation,
  portRemediationMetadata,
  reviewedPortCodeValues,
} from "../remediation/aduana-port-code-remediation";
import type { DataQualityReport } from "../../src/quality/data-quality";
import type { FieldMappingReport } from "../../src/quality/field-mapping";
import type { CodeTableRemediationReport } from "../../src/quality/code-table-remediation";

test("normalizes Aduana codes for label coverage comparisons", () => {
  assert.equal(normalizeCodeForCoverage("001"), "1");
  assert.equal(normalizeCodeForCoverage("000"), "0");
  assert.equal(normalizeCodeForCoverage(" cl "), "CL");
  assert.equal(normalizeCodeForCoverage(""), null);
  assert.equal(normalizeCodeForCoverage(null), null);
});

test("classifies actionable undecoded codes while ignoring source-special values", () => {
  const codeSet = new Set(["1"]);
  const ignoredSourceCodes = new Set(["0"]);

  assert.equal(
    isActionableUndecodedCode({ code: "001", codeSet, ignoredSourceCodes }),
    false,
  );
  assert.equal(
    isActionableUndecodedCode({ code: "000", codeSet, ignoredSourceCodes }),
    false,
  );
  assert.equal(
    isActionableUndecodedCode({ code: "817", codeSet, ignoredSourceCodes }),
    true,
  );
});

test("computes coverage percentages with stable one-decimal precision", () => {
  assert.equal(coveragePercent(100, 100), 100);
  assert.equal(coveragePercent(1, 3), 33.3);
  assert.equal(coveragePercent(999_999, 1_000_000), 99.9);
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
  const sourceFileId = "00000000-0000-4000-8000-0000000000aa";
  const importBatchId = "00000000-0000-4000-8000-0000000000bb";

  assert.equal(
    fieldMappingSearchHref("export"),
    "/trade-records?tradeFlow=export&periodYear=2026&periodMonth=3&limit=25",
  );
  assert.equal(
    fieldMappingSourceTradeHref({
      sourceFileId,
      importBatchId,
      tradeFlow: "import",
    }),
    `/trade-records?sourceFileId=${sourceFileId}&limit=25&tradeFlow=import&importBatchId=${importBatchId}`,
  );
  assert.equal(
    fieldMappingSourceTradeHref({
      sourceFileId: "source-1",
      importBatchId: "batch-2",
      tradeFlow: "import",
    }),
    null,
  );
});

test("labels field-mapping groups and confidence in Spanish", () => {
  assert.equal(fieldMappingGroupLabel("commercial_values"), "Valores comerciales");
  assert.equal(fieldMappingConfidenceLabel("verified"), "Mapeo directo");
  assert.equal(fieldMappingConfidenceLabel("needs_review"), "Requiere revisión");
});

test("accepts only object-shaped raw sample values for field-mapping QA", () => {
  assert.deepEqual(rawSampleValueRecord({ NUMITEM: "1" }), { NUMITEM: "1" });
  assert.equal(rawSampleValueRecord(null), null);
  assert.equal(rawSampleValueRecord("NUMITEM=1"), null);
  assert.equal(rawSampleValueRecord(["NUMITEM", "1"]), null);
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

test("keeps source-special code-table values out of actionable undecoded rankings", () => {
  const result = codeTableTopUndecodedCodes({
    codeRows: [
      { code: "0", records: 100 },
      { code: "817", records: 10 },
      { code: "992", records: 25 },
    ],
    codeSet: new Set(["992"]),
    definition: { filterKind: "port", tradeFlow: "export" },
    ignoredSourceCodes: new Set(["0"]),
    limit: 5,
  });

  assert.deepEqual(
    result.map((row) => [row.normalizedCode, row.records]),
    [["817", 10]],
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
  assert.match(
    codeTableRemediationNextAction({
      codeTableKey: "chile_aduana:vias_de_transporte",
      priority: "high",
      recordsWithSpecialSourceCode: 100,
      recordsWithUndecodedCode: 0,
      sourceSpecialCodeNote: "Código 0 se conserva como valor fuente.",
    }),
    /Sin brecha de etiqueta accionable/,
  );
});

test("keeps Aduana port remediation scoped to reviewed port rows only", () => {
  assert.doesNotThrow(() => assertReviewedPortRemediationScope());

  const codes = reviewedPortCodeValues.map((row) => row.codeValue).sort();
  assert.deepEqual(codes, [
    "225",
    "817",
    "818",
    "819",
    "820",
    "821",
    "822",
    "823",
    "824",
    "826",
    "827",
  ]);
  assert.equal(codes.includes("0"), false);
  assert.equal(codes.includes("56"), false);
  assert.equal(codes.includes("141"), false);
  assert.equal(codes.includes("145"), false);
  assert.equal(codes.includes("147"), false);
});

test("plans Aduana port remediation inserts, updates, and noops idempotently", () => {
  const exactRow = reviewedPortCodeValues.find((row) => row.codeValue === "817");
  assert.ok(exactRow);

  const plan = planPortCodeValueRemediation([
    {
      codeValue: "817",
      labelEs: exactRow.labelEs,
      normalizedLabelEs: normalizeLabel(exactRow.labelEs),
      reviewStatus: "reviewed_official_update",
      metadata: portRemediationMetadata(exactRow),
    },
    {
      codeValue: "818",
      labelEs: "HUACHIPATO",
      normalizedLabelEs: "huachipato",
      reviewStatus: "seeded",
      metadata: {},
    },
    {
      codeValue: "819",
      labelEs: "Terminal Marítimo Escuadrón",
      normalizedLabelEs: "terminal maritimo escuadron",
      reviewStatus: "reviewed_official_update",
      metadata: { remediation_id: "chile_aduana_ports_anexo_51_11_2026_06_01" },
    },
    {
      codeValue: "820",
      labelEs: "Terminal Portuario Terquim",
      normalizedLabelEs: "terminal portuario terquim",
      reviewStatus: "reviewed_official_update",
      metadata: [],
    },
    {
      codeValue: "821",
      labelEs: "Terminal Muelle Mecanizado Esperanza",
      normalizedLabelEs: "terminal muelle mecanizado esperanza",
      reviewStatus: "reviewed_official_update",
      metadata: null,
    },
  ]);

  const actionsByCode = new Map(plan.map((row) => [row.codeValue, row.action]));
  assert.equal(actionsByCode.get("817"), "noop");
  assert.equal(actionsByCode.get("818"), "update");
  assert.equal(actionsByCode.get("819"), "update");
  assert.equal(actionsByCode.get("820"), "update");
  assert.equal(actionsByCode.get("821"), "update");
  assert.equal(actionsByCode.get("225"), "insert");
});

test("rejects accidental Aduana, currency, or source-special remediation scope drift", () => {
  assert.throws(
    () =>
      assertReviewedPortRemediationScope([
        ...reviewedPortCodeValues,
        {
          codeValue: "56",
          labelEs: "Aduana no revisada",
          evidenceSource: "unsupported",
          evidenceUrl: "https://example.invalid",
          publishedDate: "2026-06-01",
          march2026Impact: "unsupported",
        },
      ]),
    /forbidden code values/,
  );

  assert.throws(
    () =>
      assertReviewedPortRemediationScope([
        ...reviewedPortCodeValues.filter((row) => row.codeValue !== "225"),
        {
          codeValue: "141",
          labelEs: "Moneda no revisada",
          evidenceSource: "unsupported",
          evidenceUrl: "https://example.invalid",
          publishedDate: "2026-06-01",
          march2026Impact: "unsupported",
        },
      ]),
    /forbidden code values/,
  );
});

function remediationItem(
  overrides: Partial<RemediationQueueItemInput>,
): RemediationQueueItemInput {
  return {
    affectedRecords: 1,
    confidence: "verified_signal",
    dedupeKey: "base",
    description: "Descripción",
    id: "base",
    impact: "internal_context",
    importBatchId: null,
    issueType: "qa_drilldown",
    links: [{ href: "/data-quality", label: "Calidad" }],
    nextAction: "Revisar",
    sourceFileId: null,
    sourceLabel: null,
    status: "review",
    title: "Base",
    tradeFlow: "import",
    ...overrides,
  };
}

test("scores remediation queue items by severity, visible MVP impact, and records", () => {
  const visibleWarning = remediationItem({
    affectedRecords: 10,
    impact: "visible_mvp",
    status: "warning",
  });
  const largeReview = remediationItem({
    affectedRecords: 999_999,
    impact: "commercial_values",
    status: "review",
  });

  assert.ok(remediationQueueScore(visibleWarning) > remediationQueueScore(largeReview));
});

test("dedupes remediation queue items without double-counting duplicate signals", () => {
  const rows = dedupeRemediationQueueItems([
    remediationItem({
      affectedRecords: 10,
      dedupeKey: "duplicate",
      id: "low",
      links: [{ href: "/data-quality", label: "Calidad" }],
      status: "review",
      title: "B",
    }),
    remediationItem({
      affectedRecords: 4,
      dedupeKey: "duplicate",
      id: "high",
      impact: "visible_mvp",
      links: [
        { href: "/data-quality", label: "Calidad" },
        { href: "/trade-records?tradeFlow=import", label: "Registros" },
      ],
      status: "warning",
      title: "A",
    }),
  ]);

  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.id, "high");
  assert.equal(rows[0]?.affectedRecords, 10);
  assert.deepEqual(
    rows[0]?.links.map((link) => link.href),
    ["/data-quality", "/trade-records?tradeFlow=import"],
  );
});

test("builds a remediation queue from existing QA reports", () => {
  const dataQuality = {
    fieldCoverage: [
      {
        caveat: "Valor comercial usado por la tabla.",
        covered: 80,
        key: "itemValue",
        label: "Valor item",
        percent: 80,
        status: "warning",
        total: 100,
        tradeFlow: "import",
      },
    ],
    issueGroups: [
      {
        count: 7,
        description: "Códigos de puerto sin etiqueta.",
        key: "undecoded_port",
        sampleLimit: 5,
        samples: [
          {
            importBatchId: "batch-1",
            recordHref: "/trade-records/record-1",
            sourceFileId: "source-1",
            sourceFilename: "import.zip",
            sourceHref: "/sources/source-1#batch-batch-1",
            tradeFlow: "import",
          },
        ],
        status: "warning",
        title: "Puertos sin etiqueta",
        tradeRecordsHref: "/trade-records?tradeFlow=import&port=999",
      },
    ],
    payloadCoverage: [
      {
        reconstructable: true,
        retentionMode: "full_postgres",
        rows: 100,
        storageKind: "postgres",
        tradeFlow: "import",
      },
    ],
    sourceBatchRemediation: [],
  } as unknown as DataQualityReport;
  const fieldMapping = {
    rows: [
      {
        confidence: "needs_review",
        group: "commercial_values",
        label: "CIF item",
        normalizedField: "itemCifValue",
        normalizedPresentRows: 0,
        note: "Requiere revisión",
        sourceHref: "/sources/source-1",
        sourceLabel: "import.zip",
        status: "warning",
        totalRows: 100,
        tradeFlow: "import",
        tradeRecordsHref: "/trade-records?tradeFlow=import",
      },
    ],
  } as unknown as FieldMappingReport;
  const codeTables = {
    rows: [
      {
        codeTableFound: true,
        commercialUse: "Filtro visible.",
        importBatchId: "batch-1",
        label: "Puerto relevante importación",
        nextAction: "Revisar tabla oficial.",
        normalizedField: "disembarkPortCode",
        priority: "high",
        recordsWithUndecodedCode: 7,
        sourceContext: {
          importBatchId: "batch-1",
          sourceFileId: "source-1",
          sourceHref: "/sources/source-1#batch-batch-1",
          sourceLabel: "import.zip",
        },
        status: "warning",
        tradeFlow: "import",
        tradeRecordsHref: "/trade-records?tradeFlow=import&port=999",
      },
    ],
  } as unknown as CodeTableRemediationReport;

  const report = buildDataQualityRemediationQueueReport({
    codeTables,
    dataQuality,
    fieldMapping,
  });

  assert.equal(report.summary.warningItems, 4);
  assert.equal(report.items[0]?.impact, "visible_mvp");
  assert.ok(
    report.items.some((item) =>
      item.links.some((link) => link.href === "/data-quality/code-tables"),
    ),
  );
});

test("classifies load-readiness statuses into overall decisions", () => {
  assert.equal(loadReadinessDecisionFromStatuses(["ready", "ready"]), "go");
  assert.equal(
    loadReadinessDecisionFromStatuses(["ready", "review"]),
    "review-first",
  );
  assert.equal(
    loadReadinessDecisionFromStatuses(["ready", "blocked", "review"]),
    "no-go",
  );
});

test("classifies load-readiness area counts conservatively", () => {
  assert.equal(
    loadReadinessAreaStatusFromCounts({ blockers: 0, warnings: 0 }),
    "ready",
  );
  assert.equal(
    loadReadinessAreaStatusFromCounts({ blockers: 0, warnings: 4 }),
    "review",
  );
  assert.equal(
    loadReadinessAreaStatusFromCounts({ blockers: 1, warnings: 0 }),
    "blocked",
  );
});

test("keeps load-readiness links internal and deduped", () => {
  const links = safeLoadReadinessLinks([
    { href: "/data-quality", label: "Calidad" },
    { href: "/data-quality", label: "Calidad" },
    { href: "https://example.com", label: "Externo" },
    { href: "/Users/ruben/data/raw.txt", label: "Ruta local" },
    { href: "r2://duanera-source-archive/key", label: "R2" },
    { label: "scripts/ingest/aduana-parser.test.ts" },
  ]);

  assert.deepEqual(links, [
    { href: "/data-quality", label: "Calidad" },
    { href: undefined, label: "scripts/ingest/aduana-parser.test.ts" },
  ]);
});

function buildMinimalLoadReadinessReport({
  codeSummary = {},
  fieldRows = [],
  fieldSummary = {},
  remediationSummary = {},
  sourceBatchStatus = "completed",
}: {
  codeSummary?: Partial<CodeTableRemediationReport["summary"]>;
  fieldRows?: unknown[];
  fieldSummary?: Partial<FieldMappingReport["summary"]>;
  remediationSummary?: Partial<RemediationQueueReport["summary"]>;
  sourceBatchStatus?: string;
}) {
  const dataQuality = {
    totals: {
      failedRows: 0,
      parsedRows: 100,
      rawRows: 100,
      rawToTradeDelta: 0,
      tradeRecords: 100,
      warningRows: 0,
    },
    flows: [
      {
        failedRows: 0,
        parsedRows: 100,
        rawRows: 100,
        rawToTradeDelta: 0,
        status: "ok",
        tradeFlow: "import",
        tradeRecords: 100,
        warningRows: 0,
      },
    ],
    payloadCoverage: [],
    sourceCoverage: [
      {
        batchStatus: sourceBatchStatus,
        failedRows: 0,
        filename: "import.zip",
        importBatchId: "batch-1",
        parsedRows: 100,
        rawRows: 100,
        sourceFileId: "source-1",
        sourceHref: "/sources/source-1#batch-batch-1",
        tradeFlow: "import",
        tradeRecords: 100,
        tradeRecordsHref: "/trade-records?sourceFileId=source-1",
      },
    ],
  } as unknown as DataQualityReport;
  const fieldMapping = {
    rows: fieldRows,
    summary: {
      inferredMappings: 0,
      reviewMappings: 0,
      totalMappings: fieldRows.length,
      verifiedMappings: 0,
      warningMappings: 0,
      ...fieldSummary,
    },
  } as unknown as FieldMappingReport;
  const codeTables = {
    summary: {
      highPriorityGaps: 0,
      lowPriorityGaps: 0,
      mediumPriorityGaps: 0,
      recordsWithUndecodedCodes: 0,
      totalDimensions: 0,
      ...codeSummary,
    },
  } as unknown as CodeTableRemediationReport;
  const remediation = {
    items: [],
    summary: {
      affectedRecordSignals: 0,
      reviewItems: 0,
      totalItems: 0,
      visibleMvpItems: 0,
      warningItems: 0,
      ...remediationSummary,
    },
  } as unknown as RemediationQueueReport;

  return buildLoadReadinessReport({
    codeTables,
    dataQuality,
    fieldMapping,
    remediation,
  });
}

test("builds load-readiness report with no-go when blockers remain", () => {
  const dataQuality = {
    totals: {
      failedRows: 0,
      parsedRows: 100,
      rawRows: 100,
      rawToTradeDelta: 0,
      tradeRecords: 100,
      warningRows: 0,
    },
    flows: [
      {
        failedRows: 0,
        parsedRows: 100,
        rawRows: 100,
        rawToTradeDelta: 0,
        status: "ok",
        tradeFlow: "import",
        tradeRecords: 100,
        warningRows: 0,
      },
    ],
    payloadCoverage: [
      {
        reconstructable: true,
        retentionMode: "full_postgres",
        rows: 100,
        storageKind: "postgres",
        tradeFlow: "import",
      },
    ],
    sourceCoverage: [
      {
        batchStatus: "completed",
        failedRows: 0,
        filename: "import.zip",
        importBatchId: "batch-1",
        parsedRows: 100,
        rawRows: 100,
        sourceFileId: "source-1",
        sourceHref: "/sources/source-1#batch-batch-1",
        tradeFlow: "import",
        tradeRecords: 100,
        tradeRecordsHref: "/trade-records?sourceFileId=source-1",
      },
    ],
  } as unknown as DataQualityReport;
  const fieldMapping = {
    rows: [
      {
        group: "commercial_values",
        normalizedField: "itemCifValue",
        status: "warning",
        tradeFlow: "import",
      },
    ],
    summary: {
      inferredMappings: 0,
      reviewMappings: 0,
      totalMappings: 1,
      verifiedMappings: 0,
      warningMappings: 1,
    },
  } as unknown as FieldMappingReport;
  const codeTables = {
    summary: {
      highPriorityGaps: 0,
      lowPriorityGaps: 0,
      mediumPriorityGaps: 0,
      recordsWithUndecodedCodes: 0,
      totalDimensions: 0,
    },
  } as unknown as CodeTableRemediationReport;
  const remediation = {
    items: [
      {
        impact: "visible_mvp",
      },
    ],
    summary: {
      affectedRecordSignals: 1,
      reviewItems: 0,
      totalItems: 1,
      visibleMvpItems: 1,
      warningItems: 1,
    },
  } as unknown as RemediationQueueReport;

  const report = buildLoadReadinessReport({
    codeTables,
    dataQuality,
    fieldMapping,
    remediation,
  });

  assert.equal(report.decision, "no-go");
  assert.ok(report.summary.blockedAreas >= 1);
  assert.ok(
    report.areas.some(
      (area) =>
        area.key === "field_mapping" &&
        area.actions.some((action) => action.href === "/data-quality/field-mapping"),
    ),
  );
});

test("keeps DIN import item gross weight source limitation from becoming a load-readiness blocker", () => {
  const report = buildMinimalLoadReadinessReport({
    fieldRows: [
      {
        group: "quantity_weight",
        normalizedField: "grossWeightItem",
        status: "warning",
        tradeFlow: "import",
      },
    ],
    fieldSummary: {
      reviewMappings: 1,
      warningMappings: 1,
    },
  });
  const fieldMappingArea = report.areas.find((area) => area.key === "field_mapping");

  assert.equal(report.decision, "review-first");
  assert.equal(fieldMappingArea?.status, "review");
  assert.ok(
    fieldMappingArea?.evidence.some(
      (item) => item.label === "Limitaciones fuente esperadas" && item.value === "1",
    ),
  );
});

test("keeps secondary export CIF mapping review from becoming a load-readiness blocker", () => {
  const report = buildMinimalLoadReadinessReport({
    fieldRows: [
      {
        group: "commercial_values",
        normalizedField: "cifValue",
        status: "warning",
        tradeFlow: "export",
      },
    ],
    fieldSummary: {
      reviewMappings: 1,
      warningMappings: 1,
    },
  });
  const fieldMappingArea = report.areas.find((area) => area.key === "field_mapping");

  assert.equal(report.decision, "review-first");
  assert.equal(fieldMappingArea?.status, "review");
});

test("keeps remediation queue warnings visible without duplicating blockers", () => {
  const report = buildMinimalLoadReadinessReport({
    remediationSummary: {
      affectedRecordSignals: 25,
      reviewItems: 1,
      totalItems: 3,
      visibleMvpItems: 2,
      warningItems: 2,
    },
  });
  const remediationArea = report.areas.find(
    (area) => area.key === "march_remediation",
  );

  assert.equal(report.decision, "review-first");
  assert.equal(remediationArea?.status, "review");
});

test("blocks load-readiness when source batches are incomplete", () => {
  const dataQuality = {
    totals: {
      failedRows: 0,
      parsedRows: 100,
      rawRows: 100,
      rawToTradeDelta: 0,
      tradeRecords: 100,
      warningRows: 0,
    },
    flows: [
      {
        failedRows: 0,
        parsedRows: 100,
        rawRows: 100,
        rawToTradeDelta: 0,
        status: "ok",
        tradeFlow: "import",
        tradeRecords: 100,
        warningRows: 0,
      },
    ],
    payloadCoverage: [
      {
        reconstructable: true,
        retentionMode: "full_postgres",
        rows: 100,
        storageKind: "postgres",
        tradeFlow: "import",
      },
    ],
    sourceCoverage: [
      {
        batchStatus: "running",
        failedRows: 0,
        filename: "import.zip",
        importBatchId: "batch-1",
        parsedRows: 100,
        rawRows: 100,
        sourceFileId: "source-1",
        sourceHref: "/sources/source-1#batch-batch-1",
        tradeFlow: "import",
        tradeRecords: 100,
        tradeRecordsHref: "/trade-records?sourceFileId=source-1",
      },
    ],
  } as unknown as DataQualityReport;
  const fieldMapping = {
    rows: [],
    summary: {
      inferredMappings: 0,
      reviewMappings: 0,
      totalMappings: 0,
      verifiedMappings: 0,
      warningMappings: 0,
    },
  } as unknown as FieldMappingReport;
  const codeTables = {
    summary: {
      highPriorityGaps: 0,
      lowPriorityGaps: 0,
      mediumPriorityGaps: 0,
      recordsWithUndecodedCodes: 0,
      totalDimensions: 0,
    },
  } as unknown as CodeTableRemediationReport;
  const remediation = {
    items: [],
    summary: {
      affectedRecordSignals: 0,
      reviewItems: 0,
      totalItems: 0,
      visibleMvpItems: 0,
      warningItems: 0,
    },
  } as unknown as RemediationQueueReport;

  const report = buildLoadReadinessReport({
    codeTables,
    dataQuality,
    fieldMapping,
    remediation,
  });

  const sourceArea = report.areas.find(
    (area) => area.key === "source_archive_provenance",
  );

  assert.equal(report.decision, "no-go");
  assert.equal(sourceArea?.status, "blocked");
});
