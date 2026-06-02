import { and, eq } from "drizzle-orm";

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
    for (const stats of this.stats.values()) {
      await this.db
        .update(sourceTradeParticipants)
        .set({
          recordCount: stats.count,
          firstSeenYear: stats.firstSeenYear,
          firstSeenMonth: stats.firstSeenMonth,
          lastSeenYear: stats.lastSeenYear,
          lastSeenMonth: stats.lastSeenMonth,
          updatedAt: new Date(),
        })
        .where(eq(sourceTradeParticipants.id, stats.id));
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
