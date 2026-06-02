import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  buildTradeRecordPresetHref,
  tradeRecordPresetCategories,
  tradeRecordPresets,
  type TradeRecordPreset,
  type TradeRecordPresetDefaultPeriod,
} from "@/trade/trade-record-presets";

function PresetLink({
  defaultPeriod,
  isActive,
  preset,
}: {
  defaultPeriod: TradeRecordPresetDefaultPeriod;
  isActive: boolean;
  preset: TradeRecordPreset;
}) {
  return (
    <Link
      href={buildTradeRecordPresetHref(preset, defaultPeriod)}
      aria-current={isActive ? "page" : undefined}
      className={[
        "block min-w-0 rounded-lg border px-3 py-2 text-left transition-colors",
        isActive
          ? "border-primary bg-primary/5"
          : "border-border hover:border-foreground/30 hover:bg-muted/40",
      ].join(" ")}
    >
      <div className="flex min-w-0 items-center justify-between gap-2">
        <span className="truncate text-sm font-medium">{preset.title}</span>
        {isActive ? (
          <Badge variant="secondary" className="shrink-0">
            Activa
          </Badge>
        ) : null}
      </div>
      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
        {preset.description}
      </p>
    </Link>
  );
}

export function TradeRecordPresetViews({
  activePresetId,
  defaultPeriod,
}: {
  activePresetId: string | null;
  defaultPeriod: TradeRecordPresetDefaultPeriod;
}) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Vistas comerciales rápidas</CardTitle>
        <CardDescription>
          Atajos compartibles para explorar el último mes cargado con filtros
          existentes. Son vistas de conveniencia, no conclusiones de mercado
          verificadas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {tradeRecordPresetCategories.map((category) => {
          const presets = tradeRecordPresets.filter(
            (preset) => preset.category === category.id,
          );

          return (
            <section key={category.id} className="min-w-0">
              <h2 className="mb-2 text-xs font-medium text-muted-foreground">
                {category.label}
              </h2>
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                {presets.map((preset) => (
                  <PresetLink
                    key={preset.id}
                    defaultPeriod={defaultPeriod}
                    preset={preset}
                    isActive={activePresetId === preset.id}
                  />
                ))}
              </div>
            </section>
          );
        })}
        <p className="text-xs text-muted-foreground">
          Cada vista abre una URL normal de búsqueda. No aplica nombres de empresas ni
          identidades legales; los correlativos Aduana siguen siendo anónimos cuando
          aparecen en resultados.
        </p>
      </CardContent>
    </Card>
  );
}
