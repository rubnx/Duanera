import {
  and,
  eq,
  inArray,
  sql,
  type SQL,
} from "drizzle-orm";

import type { DbClient } from "../../src/db/client";
import {
  sourceLogisticsParties,
  sourceLogisticsPartyAliases,
  tradeRecordLogisticsPartyLinks,
  tradeRecords,
} from "../../src/db/schema";
import {
  normalizeTradeParticipantName,
  type TradeParticipantDisplay,
} from "../../src/trade/trade-participant-display";
import type { RawValues } from "./normalize-trade-record-values";

export type LogisticsPartyRole = "carrier" | "issuer";

export type LogisticsPartyEvidence = {
  role: LogisticsPartyRole;
  sourceField: string;
  rawName: string;
  sourceRut: string | null;
  sourceRutDv: string | null;
  sourceCountryCode: string | null;
  display: TradeParticipantDisplay;
};

export type LogisticsPartyRawRow = {
  rawTradeRowId: string;
  sourceFileId: string;
  importBatchId: string;
  tradeFlow: "import" | "export";
  periodYear: number;
  periodMonth: number;
  rawValues: RawValues;
};

type LogisticsPartyIdentity = {
  key: string;
  source: "rut" | "legal_entity" | "raw_name";
};

type PartyStats = {
  id: string;
  firstSeenYear: number;
  firstSeenMonth: number;
  lastSeenYear: number;
  lastSeenMonth: number;
};

const unusableNameValues = new Set([
  "0",
  "00",
  "00000000",
  "NO EXISTE",
  "NO APLICA",
  "SIN INFORMACION",
  "SIN INFORMACIÓN",
  "S/I",
  "N/A",
]);

function text(values: RawValues, key: string): string | null {
  const value = values[key]?.trim();
  return value ? value : null;
}

export function normalizeRawName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function normalizedRawNameSql(expression: SQL<string>) {
  return sql<string>`upper(trim(regexp_replace(
    translate(
      ${expression},
      'ÁÀÂÄÃÅÉÈÊËÍÌÎÏÓÒÔÖÕÚÙÛÜÑáàâäãåéèêëíìîïóòôöõúùûüñ',
      'AAAAAAEEEEIIIIOOOOOUUUUNaaaaaaeeeeiiiiooooouuuun'
    ),
    '[^[:alnum:]]+',
    ' ',
    'g'
  )))`;
}

function usableName(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const normalized = normalizeRawName(value);
  if (!normalized || unusableNameValues.has(normalized)) {
    return null;
  }

  return value.trim();
}

function normalizeRut(value: string | null) {
  if (!value) {
    return null;
  }

  const digits = value.replace(/\D/g, "");
  if (!digits || /^0+$/.test(digits)) {
    return null;
  }

  return digits;
}

function normalizeRutDv(value: string | null) {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toUpperCase().replace(/[^0-9K]/g, "");
  return normalized || null;
}

function normalizeCountryCode(value: string | null) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim().toUpperCase();
  return trimmed || null;
}

function identityForEvidence(evidence: LogisticsPartyEvidence): LogisticsPartyIdentity {
  if (evidence.sourceRut) {
    const dv = evidence.sourceRutDv ? `-${evidence.sourceRutDv}` : "";
    return {
      key: `rut:${evidence.sourceRut}${dv}`,
      source: "rut",
    };
  }

  if (evidence.display.normalizedLegalEntityName && !evidence.display.isAmbiguous) {
    return {
      key: `legal:${normalizeRawName(evidence.display.normalizedLegalEntityName)}`,
      source: "legal_entity",
    };
  }

  return {
    key: `raw:${normalizeRawName(evidence.rawName)}`,
    source: "raw_name",
  };
}

function evidenceFromField({
  rawName,
  role,
  sourceCountryCode,
  sourceField,
  sourceRut,
  sourceRutDv,
}: {
  role: LogisticsPartyRole;
  sourceField: string;
  rawName: string | null;
  sourceRut: string | null;
  sourceRutDv: string | null;
  sourceCountryCode: string | null;
}): LogisticsPartyEvidence | null {
  const usableRawName = usableName(rawName);
  if (!usableRawName) {
    return null;
  }

  const display = normalizeTradeParticipantName(usableRawName);
  if (!display) {
    return null;
  }

  return {
    role,
    sourceField,
    rawName: usableRawName,
    sourceRut: normalizeRut(sourceRut),
    sourceRutDv: normalizeRutDv(sourceRutDv),
    sourceCountryCode: normalizeCountryCode(sourceCountryCode),
    display,
  };
}

export function extractLogisticsPartyEvidence(
  tradeFlow: "import" | "export",
  values: RawValues,
): LogisticsPartyEvidence[] {
  if (tradeFlow === "export") {
    return [
      evidenceFromField({
        role: "carrier",
        sourceField: "NOMBRECIATRANSP",
        rawName: text(values, "NOMBRECIATRANSP"),
        sourceRut: text(values, "RUTCIATRANSP"),
        sourceRutDv: text(values, "DVRUTCIATRANSP"),
        sourceCountryCode: text(values, "PAISCIATRANSP"),
      }),
      evidenceFromField({
        role: "issuer",
        sourceField: "NOMBREEMISORDOCTRANSP",
        rawName: text(values, "NOMBREEMISORDOCTRANSP"),
        sourceRut: text(values, "RUTEMISOR"),
        sourceRutDv: text(values, "DVRUTEMISOR"),
        sourceCountryCode: null,
      }),
    ].filter((entry): entry is LogisticsPartyEvidence => entry !== null);
  }

  return [
    evidenceFromField({
      role: "carrier",
      sourceField: "GNOM_CIA_T",
      rawName: text(values, "GNOM_CIA_T"),
      sourceRut: text(values, "NUMRUTCIA"),
      sourceRutDv: text(values, "DIGVERCIA"),
      sourceCountryCode: text(values, "CODPAISCIA"),
    }),
    evidenceFromField({
      role: "issuer",
      sourceField: "NOMEMISOR",
      rawName: text(values, "NOMEMISOR"),
      sourceRut: text(values, "NUMRUTEMI"),
      sourceRutDv: text(values, "DIGVEREMI"),
      sourceCountryCode: null,
    }),
  ].filter((entry): entry is LogisticsPartyEvidence => entry !== null);
}

function partyKey(identityKey: string) {
  return identityKey;
}

function aliasKey({
  partyId,
  evidence,
}: {
  partyId: string;
  evidence: LogisticsPartyEvidence;
}) {
  return [
    partyId,
    evidence.role,
    evidence.sourceField,
    normalizeRawName(evidence.rawName),
  ].join("\u001f");
}

function touchedPartyIds(stats: Iterable<PartyStats>) {
  return [...new Set([...stats].map((entry) => entry.id))];
}

function chunkValues<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

export class TradeLogisticsPartyTracker {
  private readonly ids = new Map<string, string>();
  private readonly stats = new Map<string, PartyStats>();
  private readonly aliases = new Set<string>();

  constructor(private readonly db: DbClient) {}

  get partyCount(): number {
    return this.stats.size;
  }

  async loadExisting(): Promise<void> {
    this.ids.clear();
    this.stats.clear();

    const rows = await this.db
      .select({
        id: sourceLogisticsParties.id,
        identityKey: sourceLogisticsParties.identityKey,
      })
      .from(sourceLogisticsParties);

    for (const row of rows) {
      this.ids.set(partyKey(row.identityKey), row.id);
    }
  }

  async ensure(
    evidence: LogisticsPartyEvidence,
    periodYear: number,
    periodMonth: number,
  ): Promise<string> {
    const identity = identityForEvidence(evidence);
    const key = partyKey(identity.key);
    const existingId = this.ids.get(key);
    const values = {
      identityKey: identity.key,
      displayName: evidence.display.displayName,
      rawNameRepresentative: evidence.rawName,
      normalizedLegalEntityName: evidence.display.normalizedLegalEntityName,
      normalizedGroupName: evidence.display.normalizedGroupName,
      countryCode: evidence.display.countryCode,
      entityType: evidence.display.entityType,
      confidence: evidence.display.confidence,
      matchReason: evidence.display.matchReason,
      isAmbiguous: evidence.display.isAmbiguous,
      identitySource: identity.source,
      firstSeenYear: periodYear,
      firstSeenMonth: periodMonth,
      lastSeenYear: periodYear,
      lastSeenMonth: periodMonth,
    };

    const insertedId =
      existingId ??
      (
        await this.db
          .insert(sourceLogisticsParties)
          .values(values)
          .onConflictDoNothing()
          .returning({ id: sourceLogisticsParties.id })
      )[0]?.id;

    if (!insertedId) {
      const [existing] = await this.db
        .select({ id: sourceLogisticsParties.id })
        .from(sourceLogisticsParties)
        .where(eq(sourceLogisticsParties.identityKey, identity.key))
        .limit(1);

      if (!existing) {
        throw new Error(`Could not create or find logistics party ${identity.key}.`);
      }

      this.ids.set(key, existing.id);
    } else {
      this.ids.set(key, insertedId);
    }

    const partyId = this.ids.get(key);
    if (!partyId) {
      throw new Error(`Could not cache logistics party ${identity.key}.`);
    }

    await this.upsertAlias(partyId, evidence, periodYear, periodMonth);
    this.trackStats(key, partyId, periodYear, periodMonth);

    return partyId;
  }

  markPartyIdsTouched(partyIds: string[]): void {
    for (const id of new Set(partyIds)) {
      this.stats.set(`party:${id}`, {
        id,
        firstSeenYear: 0,
        firstSeenMonth: 0,
        lastSeenYear: 0,
        lastSeenMonth: 0,
      });
    }
  }

  async refreshStats(): Promise<void> {
    const partyIds = touchedPartyIds(this.stats.values());
    if (partyIds.length === 0) {
      return;
    }

    for (const chunk of chunkValues(partyIds, 1000)) {
      const values = sql.join(chunk.map((id) => sql`(${id}::uuid)`), sql`, `);

      await this.db.execute(sql`
        with touched(id) as (
          values ${values}
        ),
        party_rollup as (
          select
            l.party_id as id,
            count(distinct l.trade_record_id)::integer as record_count,
            min(l.period_year * 100 + l.period_month)::integer as first_key,
            max(l.period_year * 100 + l.period_month)::integer as last_key
          from trade_record_logistics_party_links l
          join touched on touched.id = l.party_id
          group by l.party_id
        )
        update source_logistics_parties p
        set
          record_count = coalesce(party_rollup.record_count, 0),
          first_seen_year = case when party_rollup.first_key is null then null else (party_rollup.first_key / 100)::integer end,
          first_seen_month = case when party_rollup.first_key is null then null else (party_rollup.first_key % 100)::integer end,
          last_seen_year = case when party_rollup.last_key is null then null else (party_rollup.last_key / 100)::integer end,
          last_seen_month = case when party_rollup.last_key is null then null else (party_rollup.last_key % 100)::integer end,
          updated_at = now()
        from touched
        left join party_rollup on party_rollup.id = touched.id
        where p.id = touched.id
      `);

      await this.db.execute(sql`
        with touched(id) as (
          values ${values}
        ),
        alias_rollup as (
          select
            a.id,
            a.party_id,
            count(distinct l.trade_record_id)::integer as record_count,
            min(l.period_year * 100 + l.period_month)::integer as first_key,
            max(l.period_year * 100 + l.period_month)::integer as last_key
          from source_logistics_party_aliases a
          join touched on touched.id = a.party_id
          join trade_record_logistics_party_links l
            on l.party_id = a.party_id
           and l.role = a.role
           and l.source_field = a.source_field
           and ${normalizedRawNameSql(sql`l.raw_value`)} = a.raw_value_normalized
          group by a.id, a.party_id
        ),
        refreshed_aliases as (
          select
            a.id,
            coalesce(alias_rollup.record_count, 0) as record_count,
            alias_rollup.first_key,
            alias_rollup.last_key
          from source_logistics_party_aliases a
          join touched on touched.id = a.party_id
          left join alias_rollup on alias_rollup.id = a.id
        )
        update source_logistics_party_aliases a
        set
          record_count = refreshed_aliases.record_count,
          first_seen_year = case when refreshed_aliases.first_key is null then null else (refreshed_aliases.first_key / 100)::integer end,
          first_seen_month = case when refreshed_aliases.first_key is null then null else (refreshed_aliases.first_key % 100)::integer end,
          last_seen_year = case when refreshed_aliases.last_key is null then null else (refreshed_aliases.last_key / 100)::integer end,
          last_seen_month = case when refreshed_aliases.last_key is null then null else (refreshed_aliases.last_key % 100)::integer end,
          updated_at = now()
        from refreshed_aliases
        where a.id = refreshed_aliases.id
      `);
    }
  }

  private async upsertAlias(
    partyId: string,
    evidence: LogisticsPartyEvidence,
    periodYear: number,
    periodMonth: number,
  ): Promise<void> {
    const key = aliasKey({ partyId, evidence });
    if (this.aliases.has(key)) {
      return;
    }

    await this.db
      .insert(sourceLogisticsPartyAliases)
      .values({
        partyId,
        role: evidence.role,
        sourceField: evidence.sourceField,
        rawValue: evidence.rawName,
        rawValueNormalized: normalizeRawName(evidence.rawName),
        sourceRut: evidence.sourceRut,
        sourceRutDv: evidence.sourceRutDv,
        sourceCountryCode: evidence.sourceCountryCode,
        firstSeenYear: periodYear,
        firstSeenMonth: periodMonth,
        lastSeenYear: periodYear,
        lastSeenMonth: periodMonth,
      })
      .onConflictDoUpdate({
        target: [
          sourceLogisticsPartyAliases.partyId,
          sourceLogisticsPartyAliases.role,
          sourceLogisticsPartyAliases.sourceField,
          sourceLogisticsPartyAliases.rawValueNormalized,
        ],
        set: {
          rawValue: sql`excluded.raw_value`,
          sourceRut: sql`excluded.source_rut`,
          sourceRutDv: sql`excluded.source_rut_dv`,
          sourceCountryCode: sql`excluded.source_country_code`,
          updatedAt: new Date(),
        },
      });

    this.aliases.add(key);
  }

  private trackStats(
    key: string,
    partyId: string,
    periodYear: number,
    periodMonth: number,
  ): void {
    const stats = this.stats.get(key);
    if (stats) {
      if (periodYear * 100 + periodMonth < stats.firstSeenYear * 100 + stats.firstSeenMonth) {
        stats.firstSeenYear = periodYear;
        stats.firstSeenMonth = periodMonth;
      }
      if (periodYear * 100 + periodMonth > stats.lastSeenYear * 100 + stats.lastSeenMonth) {
        stats.lastSeenYear = periodYear;
        stats.lastSeenMonth = periodMonth;
      }
      return;
    }

    this.stats.set(key, {
      id: partyId,
      firstSeenYear: periodYear,
      firstSeenMonth: periodMonth,
      lastSeenYear: periodYear,
      lastSeenMonth: periodMonth,
    });
  }
}

export async function upsertLogisticsPartyLinksForRawRows(
  db: DbClient,
  tracker: TradeLogisticsPartyTracker,
  rows: LogisticsPartyRawRow[],
): Promise<number> {
  if (rows.length === 0) {
    return 0;
  }

  const rawRowIds = rows.map((row) => row.rawTradeRowId);
  const tradeRecordRows = await db
    .select({
      id: tradeRecords.id,
      rawTradeRowId: tradeRecords.rawTradeRowId,
    })
    .from(tradeRecords)
    .where(inArray(tradeRecords.rawTradeRowId, rawRowIds));
  const tradeRecordIdByRawRowId = new Map(
    tradeRecordRows.map((row) => [row.rawTradeRowId, row.id]),
  );
  const linkValues: Array<typeof tradeRecordLogisticsPartyLinks.$inferInsert> = [];
  let linked = 0;

  for (const row of rows) {
    const tradeRecordId = tradeRecordIdByRawRowId.get(row.rawTradeRowId);
    if (!tradeRecordId) {
      continue;
    }

    for (const evidence of extractLogisticsPartyEvidence(row.tradeFlow, row.rawValues)) {
      const partyId = await tracker.ensure(evidence, row.periodYear, row.periodMonth);
      linkValues.push({
        tradeRecordId,
        partyId,
        role: evidence.role,
        sourceField: evidence.sourceField,
        rawValue: evidence.rawName,
        sourceRut: evidence.sourceRut,
        sourceRutDv: evidence.sourceRutDv,
        sourceCountryCode: evidence.sourceCountryCode,
        tradeFlow: row.tradeFlow,
        periodYear: row.periodYear,
        periodMonth: row.periodMonth,
      });
      linked += 1;
    }
  }

  for (const chunk of chunkValues(linkValues, 500)) {
    await db
      .insert(tradeRecordLogisticsPartyLinks)
      .values(chunk)
      .onConflictDoUpdate({
        target: [
          tradeRecordLogisticsPartyLinks.tradeRecordId,
          tradeRecordLogisticsPartyLinks.partyId,
          tradeRecordLogisticsPartyLinks.role,
          tradeRecordLogisticsPartyLinks.sourceField,
        ],
        set: {
          rawValue: sql`excluded.raw_value`,
          sourceRut: sql`excluded.source_rut`,
          sourceRutDv: sql`excluded.source_rut_dv`,
          sourceCountryCode: sql`excluded.source_country_code`,
          tradeFlow: sql`excluded.trade_flow`,
          periodYear: sql`excluded.period_year`,
          periodMonth: sql`excluded.period_month`,
          updatedAt: new Date(),
        },
      });
  }

  return linked;
}

export async function deleteLogisticsPartyLinksForRawRows(
  db: DbClient,
  rawTradeRowIds: string[],
): Promise<string[]> {
  if (rawTradeRowIds.length === 0) {
    return [];
  }

  const rows = await db
    .select({ id: tradeRecords.id })
    .from(tradeRecords)
    .where(inArray(tradeRecords.rawTradeRowId, rawTradeRowIds));
  const tradeRecordIds = rows.map((row) => row.id);
  if (tradeRecordIds.length === 0) {
    return [];
  }

  const partyRows = await db
    .select({ partyId: tradeRecordLogisticsPartyLinks.partyId })
    .from(tradeRecordLogisticsPartyLinks)
    .where(inArray(tradeRecordLogisticsPartyLinks.tradeRecordId, tradeRecordIds));
  const partyIds = [...new Set(partyRows.map((row) => row.partyId))];

  await db
    .delete(tradeRecordLogisticsPartyLinks)
    .where(inArray(tradeRecordLogisticsPartyLinks.tradeRecordId, tradeRecordIds));

  return partyIds;
}

export function logisticsPartyRoleLabel(role: LogisticsPartyRole) {
  return role === "issuer"
    ? "Emisor documento transporte"
    : "Compañía de transporte";
}

export function parseLogisticsPartyRole(value: string | null | undefined) {
  return value === "issuer" || value === "carrier" ? value : null;
}
