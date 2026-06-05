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
import { normalizeUuid } from "@/lib/ids";
import { cn } from "@/lib/utils";
import { formatTradeFlowLabel } from "@/trade/trade-flow-ui";
import {
  productDisplayFromRaw,
} from "@/trade/trade-record-display";
import type { TradeDisplayCodeKind } from "@/trade/trade-record-format";
import {
  filtersToTradeRecordSearchParams,
} from "@/trade/trade-record-links";
import {
  enrichTradeRecordsWithLabels,
  type TradeRecordWithLabels,
} from "@/trade/trade-record-labels";
import {
  getLogisticsPartyProfile,
  type LogisticsPartyProfile,
  type LogisticsPartyProfileRank,
} from "@/trade/trade-logistics-party-profile";
import { formatTradeRecordPeriodValue } from "@/trade/trade-record-periods";
import {
  formatTradeProfileMoney,
  tradeProfileRankDisplay,
} from "@/trade/trade-profile-display";
import type {
  TradeRecordLogisticsRole,
  TradeRecordSummary,
} from "@/trade/trade-records";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ role?: string }>;
};

type RecentRecord = TradeRecordWithLabels<TradeRecordSummary>;

function parseRole(value: string | undefined): TradeRecordLogisticsRole | undefined {
  return value === "issuer" || value === "carrier" ? value : undefined;
}

function roleLabel(role: TradeRecordLogisticsRole) {
  return role === "issuer"
    ? "Emisor documento transporte"
    : "Compañía de transporte";
}

function profileRoleHref(profileId: string, role?: TradeRecordLogisticsRole) {
  const query = role ? `?role=${role}` : "";
  return `/logistics-parties/${profileId}${query}`;
}

function profileExplorerHref(
  profile: Pick<LogisticsPartyProfile, "filters" | "flowBreakdown">,
  extras: Record<string, string | undefined | null> = {},
) {
  const query = new URLSearchParams(filtersToTradeRecordSearchParams(profile.filters));
  if (!query.has("tradeFlow") && profile.flowBreakdown.length === 1) {
    query.set("tradeFlow", profile.flowBreakdown[0]!.tradeFlow);
  }
  for (const [key, value] of Object.entries(extras)) {
    if (value) {
      query.set(key, value);
    } else if (value === null) {
      query.delete(key);
    }
  }

  return `/explorer?${query.toString()}`;
}

function rankValue(rank: LogisticsPartyProfileRank) {
  const parts = [
    rank.importCifValue ? `CIF imp. ${formatTradeProfileMoney(rank.importCifValue)}` : null,
    rank.exportFobValue ? `FOB exp. ${formatTradeProfileMoney(rank.exportFobValue)}` : null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" · ") : "Sin valor informado";
}

function Metric({
  help,
  label,
  value,
}: {
  help?: string;
  label: string;
  value: string;
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
  ranks,
  title,
}: {
  emptyText: string;
  kind: TradeDisplayCodeKind | "hs" | "participant";
  ranks: LogisticsPartyProfileRank[];
  title: string;
}) {
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
              const display = tradeProfileRankDisplay(rank, kind);
              return (
                <div
                  key={rank.code}
                  className="flex min-w-0 items-center justify-between gap-3 py-2 text-sm"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-ds-text-primary">
                      {display.title}
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
                    <span>{rankValue(rank)}</span>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MonthlyActivityTable({ profile }: { profile: LogisticsPartyProfile }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Actividad mensual</CardTitle>
        <CardDescription>
          Últimos meses donde esta entidad aparece en campos logísticos/documentales.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {profile.monthlyActivity.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay actividad para mostrar.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="py-2 pr-3 text-left font-medium">Mes</th>
                  <th className="px-3 py-2 text-right font-medium">Registros</th>
                  <th className="px-3 py-2 text-right font-medium">US$ CIF importaciones</th>
                  <th className="py-2 pl-3 text-right font-medium">US$ FOB exportaciones</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {profile.monthlyActivity.map((month) => (
                  <tr key={month.period}>
                    <td className="py-2 pr-3 font-mono text-xs">{month.period}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatIntegerEsCl(month.records)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatTradeProfileMoney(month.importCifValue)}
                    </td>
                    <td className="py-2 pl-3 text-right tabular-nums">
                      {formatTradeProfileMoney(month.exportFobValue)}
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

function RecentRecordsTable({
  profile,
  records,
}: {
  profile: LogisticsPartyProfile;
  records: RecentRecord[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Registros recientes</CardTitle>
        <CardDescription>
          Muestra trazable de registros donde aparece esta entidad logística.
        </CardDescription>
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
                  <th className="px-3 py-2 text-left font-medium">Operación</th>
                  <th className="px-3 py-2 text-left font-medium">Partida</th>
                  <th className="px-3 py-2 text-left font-medium">Producto</th>
                  <th className="px-3 py-2 text-left font-medium">ID Aduana</th>
                  <th className="py-2 pl-3 text-right font-medium">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {records.map((record) => {
                  const product = productDisplayFromRaw(record.productDescriptionRaw);
                  const period = formatTradeRecordPeriodValue(
                    record.periodYear,
                    record.periodMonth,
                  );
                  const participant =
                    record.tradeFlow === "export"
                      ? record.exporterPrimaryCorrelativeId ?? record.exporterSecondaryCorrelativeId
                      : record.importerCorrelativeId;
                  const value =
                    record.tradeFlow === "export"
                      ? record.itemFobValue
                      : record.itemCifValue;

                  return (
                    <tr key={record.id}>
                      <td className="py-2 pr-3 font-mono text-xs">
                        {record.acceptanceDate ?? period}
                      </td>
                      <td className="px-3 py-2">{formatTradeFlowLabel(record.tradeFlow)}</td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {record.hsCodeNormalized ?? record.hsCodeRaw ?? "No informado"}
                      </td>
                      <td className="max-w-[260px] px-3 py-2">
                        <Link
                          className="block truncate font-medium text-ds-text-primary hover:text-ds-primary"
                          href={profileExplorerHref(profile, {
                            periodFrom: period,
                            periodTo: period,
                            selected: record.id,
                            tradeFlow: record.tradeFlow === "export" ? "export" : "import",
                          })}
                        >
                          {product.title}
                        </Link>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {participant ?? "No informado"}
                      </td>
                      <td className="py-2 pl-3 text-right tabular-nums">
                        {formatTradeProfileMoney(value)}
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

export default async function LogisticsPartyProfilePage({
  params,
  searchParams,
}: PageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const normalizedId = normalizeUuid(id);
  if (!normalizedId) {
    notFound();
  }

  const activeRole = parseRole(query.role);
  const profile = await getLogisticsPartyProfile(
    db,
    normalizedId,
    activeRole,
    { productFacing: true },
  );
  if (!profile) {
    notFound();
  }

  const recentRecords = await enrichTradeRecordsWithLabels(db, profile.recentRecords);

  return (
    <main className="min-h-screen bg-ds-bg-subtle px-4 py-5 text-ds-text-primary sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-5">
        <div className="flex items-center justify-between gap-3">
          <Link
            className="inline-flex items-center gap-2 text-sm font-medium text-ds-text-secondary hover:text-ds-primary"
            href="/explorer"
          >
            <ArrowLeftIcon aria-hidden="true" className="size-4" />
            Volver al Explorador
          </Link>
          <Link
            className="inline-flex items-center gap-2 rounded-ds-md border border-ds-border bg-ds-surface px-3 py-2 text-sm font-semibold hover:border-ds-primary hover:text-ds-primary"
            href={profileExplorerHref(profile)}
          >
            Ver registros
            <ExternalLinkIcon aria-hidden="true" className="size-4" />
          </Link>
        </div>

        <section className="rounded-ds-lg border border-ds-border-soft bg-ds-surface p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <StatusBadge variant="review">Entidad logística</StatusBadge>
                {profile.countryCode ? (
                  <Badge variant="outline" className="gap-1.5">
                    <CountryFlag countryCode={profile.countryCode} />
                    {profile.countryCode}
                  </Badge>
                ) : null}
                {profile.roleBreakdown.map((role) => (
                  <Badge key={role.role} variant="secondary">{roleLabel(role.role)}</Badge>
                ))}
              </div>
              <h1 className="truncate text-2xl font-bold tracking-normal text-ds-text-primary">
                {profile.title}
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-ds-text-muted">
                Esta entidad aparece en campos de transporte o documento de transporte.
                No es una identidad legal verificada de importador o exportador.
              </p>
              <nav
                aria-label="Filtrar perfil por rol logístico"
                className="mt-3 flex flex-wrap gap-2"
              >
                {[
                  { label: "Todos los roles", role: undefined },
                  { label: roleLabel("issuer"), role: "issuer" as const },
                  { label: roleLabel("carrier"), role: "carrier" as const },
                ].map((item) => {
                  const isActive = activeRole === item.role;
                  return (
                    <Link
                      key={item.role ?? "all"}
                      className={cn(
                        "inline-flex h-8 items-center rounded-ds-md border px-3 text-xs font-semibold transition-colors",
                        isActive
                          ? "border-ds-primary bg-ds-primary-softer text-ds-primary"
                          : "border-ds-border-soft bg-ds-surface text-ds-text-secondary hover:border-ds-primary hover:text-ds-primary",
                      )}
                      href={profileRoleHref(profile.id, item.role)}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-ds-text-muted">
                {profile.normalizedGroupName ? <span>{profile.normalizedGroupName}</span> : null}
                {profile.rawNameRepresentative ? (
                  <span>Fuente: {profile.rawNameRepresentative}</span>
                ) : null}
                {profile.isAmbiguous ? <span>Entidad legal no clara</span> : null}
              </div>
            </div>
            <div className="grid min-w-[280px] gap-2 sm:grid-cols-2">
              <Metric label="Registros" value={formatIntegerEsCl(profile.totals.records)} />
              <Metric label="Meses activos" value={formatIntegerEsCl(profile.totals.activeMonths)} />
              <Metric label="US$ CIF importaciones" value={formatTradeProfileMoney(profile.totals.importCifValue)} />
              <Metric label="US$ FOB exportaciones" value={formatTradeProfileMoney(profile.totals.exportFobValue)} />
            </div>
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {profile.flowBreakdown.map((flow) => (
            <Metric
              key={flow.tradeFlow}
              label={formatTradeFlowLabel(flow.tradeFlow)}
              value={formatIntegerEsCl(flow.records)}
              help={`${flow.tradeFlow === "export" ? "FOB" : "CIF"} ${formatTradeProfileMoney(flow.value)}`}
            />
          ))}
          {profile.roleBreakdown.map((role) => (
            <Metric
              key={role.role}
              label={roleLabel(role.role)}
              value={formatIntegerEsCl(role.records)}
              help="Registros donde aparece con este rol"
            />
          ))}
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <MonthlyActivityTable profile={profile} />
          <RankList
            title="IDs Aduana relacionados"
            kind="participant"
            ranks={profile.rankings.participants}
            emptyText="Sin IDs Aduana para mostrar."
          />
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <RankList
            title="Partidas principales"
            kind="hs"
            ranks={profile.rankings.hsGroups}
            emptyText="Sin partidas para mostrar."
          />
          <RankList
            title="Países principales"
            kind="country"
            ranks={profile.rankings.countries}
            emptyText="Sin países para mostrar."
          />
          <RankList
            title="Puertos principales"
            kind="port"
            ranks={profile.rankings.ports}
            emptyText="Sin puertos para mostrar."
          />
          <RankList
            title="Aduanas principales"
            kind="customsOffice"
            ranks={profile.rankings.customsOffices}
            emptyText="Sin aduanas para mostrar."
          />
        </div>

        <RecentRecordsTable profile={profile} records={recentRecords} />
      </div>
    </main>
  );
}
