import { and, desc, eq, or, sql, type SQL } from "drizzle-orm";

import type { DbClient } from "@/db/client";
import { rawTradeRows, tradeRecords } from "@/db/schema";
import { productDisplayFromRaw } from "@/trade/trade-record-display";
import { buildTradeRecordSearchHref } from "@/trade/trade-record-links";
import type { TradeFlow } from "@/trade/trade-records";

export type IdentityEvidenceStrength = "direct_source_text" | "context" | "weak";

export type IdentityEvidenceSignal = {
  field: string;
  label: string;
  value: string;
  strength: IdentityEvidenceStrength;
  caveat: string;
};

export type IdentityEvidenceRecord = {
  id: string;
  tradeFlow: TradeFlow;
  declarationIdRaw: string | null;
  itemNumber: number | null;
  hsCodeNormalized: string | null;
  productDescriptionRaw: string | null;
  productAttributes: unknown;
  itemValue: string | null;
  countryCode: string | null;
  customsOfficeCode: string | null;
  relevantPortCode: string | null;
  sourceFileId: string;
  importBatchId: string;
  rawTradeRowId: string;
  rawRowNumber: number;
  rawValues: unknown;
  evidenceSignals: IdentityEvidenceSignal[];
};

export type IdentityEvidenceGroup = {
  tradeFlow: TradeFlow;
  participantRole: "importador" | "exportador";
  correlativeId: string;
  recordCount: number;
  declarationCount: number;
  hsCodeCount: number;
  countryCount: number;
  maxItemValue: string | null;
  tradeRecordsHref: string;
  evidenceUsefulness: IdentityEvidenceStrength;
  evidenceSummary: string;
  records: IdentityEvidenceRecord[];
};

type QueryResult<T> = { rows?: T[] };

type IdentityEvidenceGroupRow = {
  correlativeId: string;
  recordCount: number | string;
  declarationCount: number | string;
  hsCodeCount: number | string;
  countryCount: number | string;
  maxItemValue: string | null;
};

export type IdentityEvidenceOptions = {
  tradeFlow: TradeFlow;
  groupLimit?: number;
  sampleLimit?: number;
  minRecords?: number;
};

const genericEvidenceValues = new Set([
  "0",
  "NO",
  "S",
  "SIN CODIGO",
  "SIN-CODIGO",
  "GENERAL",
  "UNIDAD",
  "ROTUL.",
  "ROTUL",
  "S/M",
  "S/MARCA",
  "NO INFORMADO",
  "DE CARRETERA",
  "ELEMENTOS PAGABLES Y",
  "CRUDO CONGELADO IQF",
  "VEHICULOS DE MOTOR DIESEL",
]);

const genericProductTerms =
  /\b(DE|DEL|LA|EL|LOS|LAS|PARA|CON|SIN|USADO|USADA|NUEVO|NUEVA|MOTOR|VEHICULO|AUTOMOVIL|PRODUCTO|CALIDAD|PREMIUM|CRUDO|CONGELADO|UNIDAD|CAJA|BOTELLAS)\b/gi;

const productAttributeLabels: Record<string, string> = {
  brand: "Marca / descriptor fuente",
  variety: "Variedad / formato",
  other1: "Detalle fuente 1",
  other2: "Detalle fuente 2",
  attribute1: "Atributo fuente 1",
  attribute2: "Atributo fuente 2",
  attribute3: "Atributo fuente 3",
  attribute4: "Atributo fuente 4",
  attribute5: "Atributo fuente 5",
  attribute6: "Atributo fuente 6",
};

function rowsFrom<T>(result: unknown): T[] {
  return ((result as QueryResult<T>).rows ?? []) as T[];
}

function toNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined) {
    return 0;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

export function normalizeIdentityEvidenceValue(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).replace(/\s+/g, " ").trim();
}

export function isUsefulIdentityEvidenceValue(value: unknown) {
  const normalized = normalizeIdentityEvidenceValue(value);
  if (normalized.length < 3) {
    return false;
  }

  const uppercase = normalized.toUpperCase();
  if (genericEvidenceValues.has(uppercase)) {
    return false;
  }

  if (!/[A-ZÁÉÍÓÚÑ]/i.test(normalized)) {
    return false;
  }

  if (/^[0-9.,/ -]+$/.test(normalized)) {
    return false;
  }

  return true;
}

export function identityEvidenceRecordValue(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return Object.fromEntries(Object.entries(value));
}

function rawValue(rawValues: unknown, key: string) {
  const values = identityEvidenceRecordValue(rawValues);
  if (!values) {
    return "";
  }

  return normalizeIdentityEvidenceValue(values[key]);
}

function attributeEntries(value: unknown) {
  const values = identityEvidenceRecordValue(value);
  if (!values) {
    return [];
  }

  return Object.entries(values)
    .map(([field, raw]) => ({
      field,
      label: productAttributeLabels[field] ?? field,
      value: normalizeIdentityEvidenceValue(raw),
    }))
    .filter((entry) => isUsefulIdentityEvidenceValue(entry.value));
}

function looksLikeDistinctiveNameSignal(value: string) {
  const uppercase = value.toUpperCase();
  if (
    /(S\.?A\.?|SPA|LTDA|LIMITADA|VIÑA|VINA|CODELCO|CMPC|AQUACHILE|CONCHA|TORO|GOODYEAR|CATERPILLAR|DECATHLON|SAMSUNG|APPLE|GREENVIC|EMILIANA|ORIZON|FINNING|PRYSMIAN|COBRE CERRILLOS|NOVA ANDINO)/.test(
      uppercase,
    )
  ) {
    return true;
  }

  const withoutGenericTerms = uppercase
    .replace(genericProductTerms, " ")
    .replace(/[-.,/0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!withoutGenericTerms) {
    return false;
  }

  const tokens = withoutGenericTerms.split(" ").filter(Boolean);
  return (
    tokens.length === 1 &&
    tokens.some((token) => token.length >= 5 && !genericEvidenceValues.has(token))
  );
}

function pushSignal(
  signals: IdentityEvidenceSignal[],
  signal: IdentityEvidenceSignal,
) {
  if (
    signals.some(
      (existing) =>
        existing.field === signal.field &&
        existing.value.toUpperCase() === signal.value.toUpperCase(),
    )
  ) {
    return;
  }

  signals.push(signal);
}

export function extractIdentityEvidenceSignals(input: {
  tradeFlow: TradeFlow;
  productDescriptionRaw: string | null;
  productAttributes: unknown;
  rawValues: unknown;
}) {
  const signals: IdentityEvidenceSignal[] = [];
  const product = productDisplayFromRaw(input.productDescriptionRaw);

  if (isUsefulIdentityEvidenceValue(product.title)) {
    pushSignal(signals, {
      field: "product_description",
      label: "Texto producto",
      value: product.title,
      strength: "context",
      caveat:
        "Describe el item comercial; puede contener marca o descripcion, pero no identifica por si solo al importador/exportador.",
    });
  }

  for (const attribute of attributeEntries(input.productAttributes)) {
    pushSignal(signals, {
      field: attribute.field,
      label: attribute.label,
      value: attribute.value,
      strength: looksLikeDistinctiveNameSignal(attribute.value)
        ? "direct_source_text"
        : "context",
      caveat:
        "Texto de atributo fuente. Es una pista para revision, no identidad legal verificada.",
    });
  }

  const rawPartyFields =
    input.tradeFlow === "import"
      ? [
          ["GNOM_CIA_T", "Transportista importacion"],
          ["NOMEMISOR", "Emisor documento importacion"],
          ["ID_BULTOS", "Referencia bultos importacion"],
        ]
      : [
          ["NOMBRECIATRANSP", "Transportista exportacion"],
          ["NOMBREEMISORDOCTRANSP", "Emisor documento exportacion"],
        ];

  for (const [field, label] of rawPartyFields) {
    const value = rawValue(input.rawValues, field);
    if (!isUsefulIdentityEvidenceValue(value)) {
      continue;
    }

    pushSignal(signals, {
      field,
      label,
      value,
      strength: field === "ID_BULTOS" ? "context" : "weak",
      caveat:
        field === "ID_BULTOS"
          ? "Referencia de bultos en la fila principal; requiere contraste con fuente de bultos antes de usarla como evidencia."
          : "Parte logistica o documental. No debe tratarse como importador/exportador comercial.",
    });
  }

  return signals.slice(0, 8);
}

function groupParticipantExpression(tradeFlow: TradeFlow): SQL<string> {
  return tradeFlow === "import"
    ? sql<string>`${tradeRecords.importerCorrelativeId}`
    : sql<string>`coalesce(${tradeRecords.exporterPrimaryCorrelativeId}, ${tradeRecords.exporterSecondaryCorrelativeId})`;
}

function itemValueExpression(tradeFlow: TradeFlow): SQL<string | null> {
  return tradeFlow === "import"
    ? sql<string | null>`${tradeRecords.itemCifValue}::text`
    : sql<string | null>`${tradeRecords.itemFobValue}::text`;
}

function itemValueNumericExpression(tradeFlow: TradeFlow): SQL<string | null> {
  return tradeFlow === "import"
    ? sql<string | null>`${tradeRecords.itemCifValue}`
    : sql<string | null>`${tradeRecords.itemFobValue}`;
}

function relevantCountryExpression(tradeFlow: TradeFlow): SQL<string | null> {
  return tradeFlow === "import"
    ? sql<string | null>`${tradeRecords.originCountryCode}`
    : sql<string | null>`${tradeRecords.destinationCountryCode}`;
}

function relevantPortExpression(tradeFlow: TradeFlow): SQL<string | null> {
  return tradeFlow === "import"
    ? sql<string | null>`${tradeRecords.disembarkPortCode}`
    : sql<string | null>`${tradeRecords.embarkPortCode}`;
}

function participantWhere(tradeFlow: TradeFlow, correlativeId: string) {
  return tradeFlow === "import"
    ? eq(tradeRecords.importerCorrelativeId, correlativeId)
    : or(
        eq(tradeRecords.exporterPrimaryCorrelativeId, correlativeId),
        eq(tradeRecords.exporterSecondaryCorrelativeId, correlativeId),
      );
}

function usefulnessFromRecords(records: IdentityEvidenceRecord[]) {
  if (
    records.some((record) =>
      record.evidenceSignals.some(
        (signal) => signal.strength === "direct_source_text",
      ),
    )
  ) {
    return "direct_source_text" satisfies IdentityEvidenceStrength;
  }

  if (records.some((record) => record.evidenceSignals.length > 0)) {
    return "context" satisfies IdentityEvidenceStrength;
  }

  return "weak" satisfies IdentityEvidenceStrength;
}

function evidenceSummary(strength: IdentityEvidenceStrength) {
  if (strength === "direct_source_text") {
    return "Tiene marcas, atributos o texto fuente utiles para revision interna.";
  }

  if (strength === "context") {
    return "Tiene contexto comercial/logistico, pero la identidad sigue sin verificar.";
  }

  return "No hay pistas fuertes en la muestra; mantener solo el correlative anonimo.";
}

function groupHref(tradeFlow: TradeFlow, correlativeId: string) {
  return buildTradeRecordSearchHref({
    tradeFlow,
    periodFrom: "2026-03",
    periodTo: "2026-03",
    limit: "25",
    ...(tradeFlow === "import"
      ? { importer: correlativeId }
      : { exporter: correlativeId }),
  });
}

async function listGroupRows(
  db: DbClient,
  options: Required<IdentityEvidenceOptions>,
) {
  const participantCode = groupParticipantExpression(options.tradeFlow);
  const countryCode = relevantCountryExpression(options.tradeFlow);
  const itemValue = itemValueNumericExpression(options.tradeFlow);

  if (options.tradeFlow === "export") {
    const result = await db.execute(sql`
      select
        participant."correlativeId" as "correlativeId",
        count(*)::int as "recordCount",
        count(distinct ${tradeRecords.declarationIdRaw})::int as "declarationCount",
        count(distinct ${tradeRecords.hsCodeNormalized})::int as "hsCodeCount",
        count(distinct ${countryCode})::int as "countryCount",
        max(${itemValue})::text as "maxItemValue"
      from ${tradeRecords}
      cross join lateral (
        select distinct participant_code as "correlativeId"
        from (
          values
            (${tradeRecords.exporterPrimaryCorrelativeId}),
            (${tradeRecords.exporterSecondaryCorrelativeId})
        ) as participant_values(participant_code)
        where participant_code is not null
          and participant_code <> ''
          and participant_code <> '0'
      ) as participant
      where ${tradeRecords.tradeFlow} = ${options.tradeFlow}
        and ${tradeRecords.periodYear} = 2026
        and ${tradeRecords.periodMonth} = 3
      group by participant."correlativeId"
      having count(*) >= ${options.minRecords}
      order by count(*) desc, participant."correlativeId" asc
      limit ${options.groupLimit};
    `);

    return rowsFrom<IdentityEvidenceGroupRow>(result);
  }

  const result = await db.execute(sql`
    select
      ${participantCode} as "correlativeId",
      count(*)::int as "recordCount",
      count(distinct ${tradeRecords.declarationIdRaw})::int as "declarationCount",
      count(distinct ${tradeRecords.hsCodeNormalized})::int as "hsCodeCount",
      count(distinct ${countryCode})::int as "countryCount",
      max(${itemValue})::text as "maxItemValue"
    from ${tradeRecords}
    where ${tradeRecords.tradeFlow} = ${options.tradeFlow}
      and ${tradeRecords.periodYear} = 2026
      and ${tradeRecords.periodMonth} = 3
      and ${participantCode} is not null
      and ${participantCode} <> ''
      and ${participantCode} <> '0'
    group by ${participantCode}
    having count(*) >= ${options.minRecords}
    order by count(*) desc, ${participantCode} asc
    limit ${options.groupLimit};
  `);

  return rowsFrom<IdentityEvidenceGroupRow>(result);
}

async function sampleRecordsForGroup(
  db: DbClient,
  tradeFlow: TradeFlow,
  correlativeId: string,
  limit: number,
) {
  const itemValue = itemValueExpression(tradeFlow);
  const itemValueNumeric = itemValueNumericExpression(tradeFlow);
  const countryCode = relevantCountryExpression(tradeFlow);
  const portCode = relevantPortExpression(tradeFlow);
  const where = and(
    eq(tradeRecords.tradeFlow, tradeFlow),
    eq(tradeRecords.periodYear, 2026),
    eq(tradeRecords.periodMonth, 3),
    participantWhere(tradeFlow, correlativeId),
  );

  const rows = await db
    .select({
      id: tradeRecords.id,
      tradeFlow: tradeRecords.tradeFlow,
      declarationIdRaw: tradeRecords.declarationIdRaw,
      itemNumber: tradeRecords.itemNumber,
      hsCodeNormalized: tradeRecords.hsCodeNormalized,
      productDescriptionRaw: tradeRecords.productDescriptionRaw,
      productAttributes: tradeRecords.productAttributes,
      itemValue,
      countryCode,
      customsOfficeCode: tradeRecords.customsOfficeCode,
      relevantPortCode: portCode,
      sourceFileId: tradeRecords.sourceFileId,
      importBatchId: tradeRecords.importBatchId,
      rawTradeRowId: tradeRecords.rawTradeRowId,
      rawRowNumber: rawTradeRows.rowNumber,
      rawValues: rawTradeRows.rawValues,
    })
    .from(tradeRecords)
    .innerJoin(rawTradeRows, eq(tradeRecords.rawTradeRowId, rawTradeRows.id))
    .where(where)
    .orderBy(desc(itemValueNumeric))
    .limit(limit);

  return rows.map((row) => ({
    ...row,
    tradeFlow: row.tradeFlow as TradeFlow,
    evidenceSignals: extractIdentityEvidenceSignals({
      tradeFlow: row.tradeFlow as TradeFlow,
      productDescriptionRaw: row.productDescriptionRaw,
      productAttributes: row.productAttributes,
      rawValues: row.rawValues,
    }),
  }));
}

export async function listIdentityEvidenceGroups(
  db: DbClient,
  options: IdentityEvidenceOptions,
): Promise<IdentityEvidenceGroup[]> {
  const normalizedOptions: Required<IdentityEvidenceOptions> = {
    tradeFlow: options.tradeFlow,
    groupLimit: Math.min(Math.max(Math.trunc(options.groupLimit ?? 8), 1), 20),
    sampleLimit: Math.min(Math.max(Math.trunc(options.sampleLimit ?? 4), 1), 8),
    minRecords: Math.min(Math.max(Math.trunc(options.minRecords ?? 50), 1), 10000),
  };

  const groups = await listGroupRows(db, normalizedOptions);
  const recordsByGroup = await Promise.all(
    groups.map((group) =>
      sampleRecordsForGroup(
        db,
        normalizedOptions.tradeFlow,
        group.correlativeId,
        normalizedOptions.sampleLimit,
      ),
    ),
  );

  return groups.map((group, index) => {
    const records = recordsByGroup[index] ?? [];
    const evidenceUsefulness = usefulnessFromRecords(records);

    return {
      tradeFlow: normalizedOptions.tradeFlow,
      participantRole:
        normalizedOptions.tradeFlow === "import" ? "importador" : "exportador",
      correlativeId: group.correlativeId,
      recordCount: toNumber(group.recordCount),
      declarationCount: toNumber(group.declarationCount),
      hsCodeCount: toNumber(group.hsCodeCount),
      countryCount: toNumber(group.countryCount),
      maxItemValue: group.maxItemValue,
      tradeRecordsHref: groupHref(normalizedOptions.tradeFlow, group.correlativeId),
      evidenceUsefulness,
      evidenceSummary: evidenceSummary(evidenceUsefulness),
      records,
    };
  });
}
