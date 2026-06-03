import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  qualityPeriodHref,
  qualityPeriodFromSearchParams,
  type QualityPeriodSearchParams,
} from "@/quality/quality-period-controls";
import {
  qualityPeriodSearchParams,
  type QualityReportPeriod,
} from "@/quality/march-2026";
import { buildTradeRecordSearchHref } from "@/trade/trade-record-links";
import type { TradeRecordPeriodOption } from "@/trade/trade-record-periods";

export type DataQualityPageProps = {
  searchParams?: Promise<QualityPeriodSearchParams>;
};

export async function resolveQualityPeriod({
  periods,
  searchParams,
}: {
  periods: TradeRecordPeriodOption[];
  searchParams?: Promise<QualityPeriodSearchParams>;
}) {
  return qualityPeriodFromSearchParams({
    params: (await searchParams) ?? {},
    periods,
  });
}

export function qualityScopedHref(pathname: string, period: QualityReportPeriod) {
  return qualityPeriodHref(pathname, period);
}

export function QualityNavLinks({ period }: { period: QualityReportPeriod }) {
  const links = [
    { href: "/data-quality/load-readiness", label: "Preparación carga" },
    { href: "/data-quality", label: "Calidad" },
    { href: "/data-quality/remediation", label: "Remediación" },
    { href: "/data-quality/code-tables", label: "Tablas de códigos" },
    { href: "/data-quality/field-mapping", label: "Mapeo de campos" },
    { href: "/sources", label: "Fuentes" },
    { href: "/trade-records", label: "Registros" },
  ];

  return (
    <div className="flex flex-wrap gap-3 text-sm">
      {links.map((link) => {
        const href = link.href.startsWith("/data-quality")
          ? qualityScopedHref(link.href, period)
          : link.href === "/trade-records"
            ? buildTradeRecordSearchHref({
                ...qualityPeriodSearchParams(period),
                limit: "25",
              })
            : link.href;
        return (
          <Link
            key={link.href}
            href={href}
            className="font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            {link.label}
          </Link>
        );
      })}
      <Link
        href="/"
        className="font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        Inicio
      </Link>
    </div>
  );
}

export function QualityPeriodScopeCard({
  resetHref = "/data-quality",
  period,
  periods,
}: {
  resetHref?: string;
  period: QualityReportPeriod;
  periods: TradeRecordPeriodOption[];
}) {
  const isRange = "periodFrom" in period;
  const periodFrom = isRange ? period.periodFrom : period.label;
  const periodTo = isRange ? period.periodTo : period.label;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Alcance del período</CardTitle>
        <CardDescription className="leading-6">
          Por defecto se evalúa el último mes cargado. Usa un rango solo cuando
          necesites comparar meses; los reportes internos evitan consultas amplias sin
          selección explícita.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-3 md:flex-row md:items-end" method="get">
          <label className="flex min-w-[160px] flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-muted-foreground">Desde</span>
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              defaultValue={periodFrom}
              name="periodFrom"
            >
              {periods.map((option) => (
                <option key={`from:${option.value}`} value={option.value}>
                  {option.value}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-[160px] flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-muted-foreground">Hasta</span>
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              defaultValue={periodTo}
              name="periodTo"
            >
              {periods.map((option) => (
                <option key={`to:${option.value}`} value={option.value}>
                  {option.value}
                </option>
              ))}
            </select>
          </label>
          <button
            className="inline-flex h-9 w-fit items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            type="submit"
          >
            Aplicar
          </button>
          <Link
            className="inline-flex h-9 w-fit items-center rounded-md border border-input px-3 text-sm font-medium text-muted-foreground hover:text-foreground"
            href={resetHref}
          >
            Último mes
          </Link>
        </form>
      </CardContent>
    </Card>
  );
}
