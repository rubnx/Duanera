import { and, eq, sql } from "drizzle-orm";

import type { DbClient } from "../../src/db/client";
import { sourceTradeParticipants } from "../../src/db/schema";

export type ParticipantRole = "importer" | "exporter_primary" | "exporter_secondary";

type ParticipantTradeFlow = "import" | "export";

type ParticipantStats = {
  id: string;
  count: number;
  firstSeenYear: number;
  firstSeenMonth: number;
  lastSeenYear: number;
  lastSeenMonth: number;
};

export function uniqueParticipantIds(stats: Iterable<ParticipantStats>): string[] {
  return [...new Set([...stats].map((entry) => entry.id))];
}

function chunkValues<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function participantKey(
  tradeFlow: string,
  role: ParticipantRole,
  correlativeId: string,
): string {
  return `${tradeFlow}:${role}:${correlativeId}`;
}

export class TradeParticipantTracker {
  private readonly stats = new Map<string, ParticipantStats>();
  private readonly ids = new Map<string, string>();

  constructor(private readonly db: DbClient) {}

  get participantCount(): number {
    return this.stats.size;
  }

  async loadExisting(): Promise<void> {
    this.ids.clear();
    this.stats.clear();

    const rows = await this.db
      .select({
        id: sourceTradeParticipants.id,
        tradeFlow: sourceTradeParticipants.tradeFlow,
        participantRole: sourceTradeParticipants.participantRole,
        sourceCorrelativeId: sourceTradeParticipants.sourceCorrelativeId,
      })
      .from(sourceTradeParticipants);

    for (const row of rows) {
      this.ids.set(
        participantKey(
          row.tradeFlow,
          row.participantRole as ParticipantRole,
          row.sourceCorrelativeId,
        ),
        row.id,
      );
    }
  }

  async ensure(
    tradeFlow: ParticipantTradeFlow,
    role: ParticipantRole,
    correlativeId: string | null,
    periodYear: number,
    periodMonth: number,
  ): Promise<string | null> {
    if (!correlativeId || correlativeId === "0") {
      return null;
    }

    const key = participantKey(tradeFlow, role, correlativeId);
    const existingId = this.ids.get(key);

    const values = {
      tradeFlow,
      participantRole: role,
      sourceCorrelativeId: correlativeId,
      firstSeenYear: periodYear,
      firstSeenMonth: periodMonth,
      lastSeenYear: periodYear,
      lastSeenMonth: periodMonth,
      crossYearStabilityStatus: "unknown",
    };

    const id =
      existingId ??
      (
        await this.db
          .insert(sourceTradeParticipants)
          .values(values)
          .onConflictDoNothing()
          .returning({ id: sourceTradeParticipants.id })
      )[0]?.id;

    if (!id) {
      const [existing] = await this.db
        .select({ id: sourceTradeParticipants.id })
        .from(sourceTradeParticipants)
        .where(
          and(
            eq(sourceTradeParticipants.tradeFlow, tradeFlow),
            eq(sourceTradeParticipants.participantRole, role),
            eq(sourceTradeParticipants.sourceCorrelativeId, correlativeId),
          ),
        )
        .limit(1);

      if (!existing) {
        throw new Error(`Could not create or find participant ${key}.`);
      }

      this.ids.set(key, existing.id);
    } else {
      this.ids.set(key, id);
    }

    const participantId = this.ids.get(key);
    if (!participantId) {
      throw new Error(`Could not cache participant ${key}.`);
    }

    this.trackStats(key, participantId, periodYear, periodMonth);

    return participantId;
  }

  async refreshStats(): Promise<void> {
    const participantIds = uniqueParticipantIds(this.stats.values());
    if (participantIds.length === 0) {
      return;
    }

    for (const chunk of chunkValues(participantIds, 1000)) {
      const touchedValues = sql.join(
        chunk.map((id) => sql`(${id}::uuid)`),
        sql`, `,
      );

      await this.db.execute(sql`
        with touched(id) as (
          values ${touchedValues}
        ),
        participant_counts as (
          select
            tr.importer_participant_id as id,
            count(*)::integer as record_count,
            min(tr.period_year * 100 + tr.period_month)::integer as first_key,
            max(tr.period_year * 100 + tr.period_month)::integer as last_key
          from trade_records tr
          join touched on touched.id = tr.importer_participant_id
          where tr.importer_participant_id is not null
          group by tr.importer_participant_id

          union all

          select
            tr.exporter_primary_participant_id as id,
            count(*)::integer as record_count,
            min(tr.period_year * 100 + tr.period_month)::integer as first_key,
            max(tr.period_year * 100 + tr.period_month)::integer as last_key
          from trade_records tr
          join touched on touched.id = tr.exporter_primary_participant_id
          where tr.exporter_primary_participant_id is not null
          group by tr.exporter_primary_participant_id

          union all

          select
            tr.exporter_secondary_participant_id as id,
            count(*)::integer as record_count,
            min(tr.period_year * 100 + tr.period_month)::integer as first_key,
            max(tr.period_year * 100 + tr.period_month)::integer as last_key
          from trade_records tr
          join touched on touched.id = tr.exporter_secondary_participant_id
          where tr.exporter_secondary_participant_id is not null
          group by tr.exporter_secondary_participant_id
        ),
        participant_rollup as (
          select
            id,
            sum(record_count)::integer as record_count,
            min(first_key)::integer as first_key,
            max(last_key)::integer as last_key
          from participant_counts
          group by id
        )
        update source_trade_participants p
        set
          record_count = participant_rollup.record_count,
          first_seen_year = (participant_rollup.first_key / 100)::integer,
          first_seen_month = (participant_rollup.first_key % 100)::integer,
          last_seen_year = (participant_rollup.last_key / 100)::integer,
          last_seen_month = (participant_rollup.last_key % 100)::integer,
          updated_at = now()
        from participant_rollup
        where p.id = participant_rollup.id
      `);
    }
  }

  private trackStats(
    key: string,
    participantId: string,
    periodYear: number,
    periodMonth: number,
  ): void {
    const stats = this.stats.get(key);
    if (stats) {
      stats.count += 1;
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
      id: participantId,
      count: 1,
      firstSeenYear: periodYear,
      firstSeenMonth: periodMonth,
      lastSeenYear: periodYear,
      lastSeenMonth: periodMonth,
    });
  }
}
