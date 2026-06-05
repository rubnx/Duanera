import {
  ArrowLeftIcon,
  ExternalLinkIcon,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CountryFlag } from "@/components/common/country-flag";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { db } from "@/db/client";
import { formatIntegerEsCl } from "@/lib/format";
import {
  productDisplayFromRaw,
} from "@/trade/trade-record-display";
import {
  formatTradeDisplayCodeLabel,
  type TradeDisplayCodeKind,
} from "@/trade/trade-record-format";
import {
  filtersToTradeRecordSearchParams,
} from "@/trade/trade-record-links";
import {
  enrichTradeRecordsWithLabels,
  type TradeRecordWithLabels,
} from "@/trade/trade-record-labels";
import {
  getTradeParticipantProfile,
  parseTradeParticipantProfileRole,
  tradeParticipantProfileFilters,
  type TradeParticipantProfile,
  type TradeParticipantProfileRank,
} from "@/trade/trade-participant-profile";
import { formatTradeRecordPeriodValue } from "@/trade/trade-record-periods";
import {
  formatTradeProfileMoney,
  tradeProfileRankDisplay,
} from "@/trade/trade-profile-display";
import type { TradeRecordSummary } from "@/trade/trade-records";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{
    role: string;
    id: string;
  }>;
};

type RecentRecord = TradeRecordWithLabels<TradeRecordSummary>;

function profileExplorerHref(
  profile: Pick<TradeParticipantProfile, "id" | "role">,
  extras: Record<string, string | undefined> = {},
) {
  const query = new URLSearchParams(
    filtersToTradeRecordSearchParams(
      tradeParticipantProfileFilters(profile.role, profile.id),
    ),
  );

  for (const [key, value] of Object.entries(extras)) {
    if (value) {
      query.set(key, value);
    }
  }

  return `/explorer?${query.toString()}`;
}

function rankExplorerHref(
  profile: Pick<TradeParticipantProfile, "id" | "role" | "tradeFlow">,
  rank: TradeParticipantProfileRank,
  kind: "country" | "customsOffice" | "hs" | "port",
) {
  const extras: Record<string, string | undefined> = {};

  if (kind === "hs") {
    extras.hsCodePrefix = rank.code;
  } else if (kind === "customsOffice") {
    extras.customsOffice = rank.code;
  } else if (kind === "port") {
    if (profile.tradeFlow === "export") {
      extras.embarkPort = rank.code;
    } else {
      extras.disembarkPort = rank.code;
    }
  } else if (profile.tradeFlow === "export") {
    extras.destinationCountry = rank.code;
  } else {
    extras.originCountry = rank.code;
  }

  return profileExplorerHref(profile, extras);
}

function Metric({
  label,
  value,
  help,
}: {
  label: string;
  value: string;
  help?: string;
}) {
  return (
    <div className="min-w-0 rounded-ds-md border border-ds-border-soft bg-ds-surface px-3 py-2">
      <div className="text-ds-xs font-medium text-ds-text-muted">{label}</div>
      <div className="mt-1 truncate text-ds-lg font-bold text-ds-text-primary">
        {value}
      </div>
      {help ? <div className="mt-0.5 text-ds-xs text-ds-text-muted">{help}</div> : null}
    </div>
  );
}

function RankList({
  emptyText,
  kind,
  profile,
  ranks,
  title,
}: {
  emptyText: string;
  kind: "country" | "customsOffice" | "hs" | "port";
  profile: Pick<TradeParticipantProfile, "id" | "role" | "tradeFlow" | "valueLabel">;
  ranks: TradeParticipantProfileRank[];
  title: string;
}) {
  const displayKind: TradeDisplayCodeKind | "hs" =
    kind === "country"
      ? "country"
      : kind === "customsOffice"
        ? "customsOffice"
        : kind === "port"
          ? "port"
          : "hs";

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {ranks.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          <div className="divide-y divide-ds-border-soft">
            {ranks.map((rank) => {
              const display = tradeProfileRankDisplay(rank, displayKind);

              return (
                <Link
                  key={rank.code}
                  className="flex min-w-0 items-center justify-between gap-3 py-2 text-sm hover:text-ds-primary"
                  href={rankExplorerHref(profile, rank, kind)}
                >
                  <span className="min-w-0">
                    <span className="flex min-w-0 items-center gap-2">
                      {kind === "country" ? (
                        <CountryFlag countryCode={rank.code} countryName={display.title} />
                      ) : null}
                      <span className="block truncate font-semibold text-ds-text-primary">
                        {display.title}
                      </span>
                    </span>
                    {display.subtitle ? (
                      <span className="block truncate text-ds-xs text-ds-text-muted">
                        {display.subtitle}
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-right text-ds-xs text-ds-text-muted">
                    <span className="block font-mono text-ds-text-primary">
                      {formatIntegerEsCl(rank.records)}
                    </span>
                    <span>
                      {profile.valueLabel} {formatTradeProfileMoney(rank.totalItemValue)}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MonthlyActivityTable({
  profile,
}: {
  profile: TradeParticipantProfile;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Actividad mensual</CardTitle>
        <CardDescription>Últimos meses con actividad para este ID Aduana.</CardDescription>
      </CardHeader>
      <CardContent>
        {profile.monthlyActivity.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay actividad para mostrar.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="py-2 pr-3 text-left font-medium">Mes</th>
                  <th className="px-3 py-2 text-right font-medium">Registros</th>
                  <th className="py-2 pl-3 text-right font-medium">{profile.valueLabel}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {profile.monthlyActivity.map((month) => (
                  <tr key={month.period}>
                    <td className="py-2 pr-3 font-mono text-xs">{month.period}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatIntegerEsCl(month.records)}
                    </td>
                    <td className="py-2 pl-3 text-right tabular-nums">
                      {formatTradeProfileMoney(month.totalItemValue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function recentRecordExplorerHref(
  profile: TradeParticipantProfile,
  record: TradeRecordSummary,
) {
  const period = formatTradeRecordPeriodValue(record.periodYear, record.periodMonth);

  return profileExplorerHref(profile, {
    periodFrom: period,
    periodTo: period,
    selected: record.id,
  });
}

function recentRecordCountry(profile: TradeParticipantProfile, record: RecentRecord) {
  if (profile.tradeFlow === "export") {
    return {
      code: record.destinationCountryCode,
      name: formatTradeDisplayCodeLabel({
        code: record.destinationCountryCode,
        kind: "country",
        label: record.decodedLabels.destinationCountry,
      }),
    };
  }

  return {
    code: record.originCountryCode,
    name: formatTradeDisplayCodeLabel({
      code: record.originCountryCode,
      kind: "country",
      label: record.decodedLabels.originCountry,
    }),
  };
}

function recentRecordPort(profile: TradeParticipantProfile, record: RecentRecord) {
  if (profile.tradeFlow === "export") {
    return formatTradeDisplayCodeLabel({
      code: record.embarkPortCode,
      kind: "port",
      label: record.decodedLabels.embarkPort,
    });
  }

  return formatTradeDisplayCodeLabel({
    code: record.disembarkPortCode,
    kind: "port",
    label: record.decodedLabels.disembarkPort,
  });
}

function recentRecordValue(profile: TradeParticipantProfile, record: RecentRecord) {
  return profile.tradeFlow === "export"
    ? formatTradeProfileMoney(record.itemFobValue)
    : formatTradeProfileMoney(record.itemCifValue);
}

function RecentRecordsTable({
  profile,
  records,
}: {
  profile: TradeParticipantProfile;
  records: RecentRecord[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Registros recientes</CardTitle>
        <CardDescription>Máximo 25 filas recientes para revisar el detalle.</CardDescription>
      </CardHeader>
      <CardContent>
        {records.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay registros recientes.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="py-2 pr-3 text-left font-medium">Fecha</th>
                  <th className="px-3 py-2 text-left font-medium">Partida</th>
                  <th className="px-3 py-2 text-left font-medium">Producto</th>
                  <th className="px-3 py-2 text-left font-medium">{profile.countryLabel}</th>
                  <th className="px-3 py-2 text-left font-medium">{profile.portLabel}</th>
                  <th className="py-2 pl-3 text-right font-medium">{profile.valueLabel}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {records.map((record) => {
                  const product = productDisplayFromRaw(record.productDescriptionRaw);
                  const country = recentRecordCountry(profile, record);

                  return (
                    <tr key={record.id}>
                      <td className="py-2 pr-3 font-mono text-xs">
                        {record.acceptanceDate ?? formatTradeRecordPeriodValue(record.periodYear, record.periodMonth)}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {record.hsCodeNormalized ?? record.hsCodeRaw ?? "No informado"}
                      </td>
                      <td className="max-w-[280px] px-3 py-2">
                        <Link
                          className="line-clamp-1 font-semibold text-ds-text-primary hover:text-ds-primary"
                          href={recentRecordExplorerHref(profile, record)}
                        >
                          {product.title}
                        </Link>
                        {product.description || product.sourceReference ? (
                          <div className="mt-0.5 truncate text-xs text-muted-foreground">
                            {product.description ?? `Ref. fuente: ${product.sourceReference}`}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-3 py-2">
                        <span className="inline-flex min-w-0 items-center gap-2">
                          <CountryFlag countryCode={country.code} countryName={country.name} />
                          <span>{country.name}</span>
                        </span>
                      </td>
                      <td className="px-3 py-2">{recentRecordPort(profile, record)}</td>
                      <td className="py-2 pl-3 text-right tabular-nums">
                        {recentRecordValue(profile, record)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default async function ParticipantProfilePage({ params }: PageProps) {
  const { id, role: rawRole } = await params;
  const role = parseTradeParticipantProfileRole(rawRole);

  if (!role) {
    notFound();
  }

  const profile = await getTradeParticipantProfile(db, { id, role });
  const recentRecords = await enrichTradeRecordsWithLabels(db, profile.recentRecords);
  const hasRecords = profile.totals.records > 0;

  return (
    <main className="mx-auto flex w-full max-w-[1280px] flex-col gap-4 px-4 py-5 lg:px-6">
      <header className="flex flex-col gap-4 border-b border-ds-border-soft pb-4">
        <Link
          className="inline-flex w-fit items-center gap-1 text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          href="/explorer"
        >
          <ArrowLeftIcon className="size-4" />
          Explorador
        </Link>
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">
              {profile.tradeFlow === "import" ? "Importaciones" : "Exportaciones"}
            </Badge>
            <StatusBadge variant="neutral">ID Aduana anónimo</StatusBadge>
            <StatusBadge variant="review">Identidad legal no disponible</StatusBadge>
          </div>
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-medium text-ds-text-muted">
                {profile.participantLabel}
              </p>
              <h1 className="text-3xl font-bold tracking-tight text-ds-text-primary">
                {profile.title}
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-ds-text-secondary">
                Perfil agregado desde registros Aduana disponibles. Muestra actividad de este ID
                Aduana, sin afirmar nombre legal ni RUT.
              </p>
            </div>
            <Link
              className="inline-flex h-9 w-fit items-center gap-2 rounded-ds-md border border-ds-border bg-ds-surface px-3 text-sm font-semibold text-ds-text-primary hover:bg-ds-muted"
              href={profileExplorerHref(profile)}
            >
              Ver registros
              <ExternalLinkIcon className="size-4" />
            </Link>
          </div>
        </div>
      </header>

      {!hasRecords ? (
        <Card>
          <CardHeader>
            <CardTitle>No encontramos actividad</CardTitle>
            <CardDescription>
              Este ID Aduana no aparece en los periodos productivos cargados.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-3">
            <Metric
              label="Registros"
              value={formatIntegerEsCl(profile.totals.records)}
            />
            <Metric
              label={profile.valueLabel}
              value={formatTradeProfileMoney(profile.totals.totalItemValue)}
            />
            <Metric
              help="Meses con al menos un registro"
              label="Meses activos"
              value={formatIntegerEsCl(profile.totals.activeMonths)}
            />
          </section>

          <section className="grid gap-4 xl:grid-cols-[1fr_360px]">
            <div className="flex flex-col gap-4">
              <MonthlyActivityTable profile={profile} />
              <RecentRecordsTable profile={profile} records={recentRecords} />
            </div>
            <aside className="grid gap-4">
              <RankList
                emptyText="Sin partidas para mostrar."
                kind="hs"
                profile={profile}
                ranks={profile.rankings.hsGroups}
                title="Top partidas / productos"
              />
              <RankList
                emptyText="Sin países para mostrar."
                kind="country"
                profile={profile}
                ranks={profile.rankings.countries}
                title={`Top ${profile.countryLabel.toLowerCase()}`}
              />
              <RankList
                emptyText="Sin puertos para mostrar."
                kind="port"
                profile={profile}
                ranks={profile.rankings.ports}
                title={`Top ${profile.portLabel.toLowerCase()}`}
              />
              <RankList
                emptyText="Sin aduanas para mostrar."
                kind="customsOffice"
                profile={profile}
                ranks={profile.rankings.customsOffices}
                title="Top aduanas"
              />
            </aside>
          </section>
        </>
      )}
    </main>
  );
}
