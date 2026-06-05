import Link from "next/link";

import { CountryFlag } from "@/components/common/country-flag";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { productDisplayFromRaw } from "@/trade/trade-record-display";
import {
  formatTradeDisplayCodeLabel,
  formatTradeMoney,
} from "@/trade/trade-record-format";
import {
  buildTradeRecordSearchHref,
  filtersToTradeRecordSearchParams,
} from "@/trade/trade-record-links";
import { formatTradeRecordPeriodValue } from "@/trade/trade-record-periods";
import type { TradeRecordRelatedGroup } from "@/trade/trade-records";
import type {
  TradeRecordSummary,
} from "@/trade/trade-records";
import type { TradeRecordWithLabels } from "@/trade/trade-record-labels";

export type RelatedRecord = TradeRecordWithLabels<TradeRecordSummary>;
export type RelatedGroupWithLabels = Omit<TradeRecordRelatedGroup, "records"> & {
  records: RelatedRecord[];
};

const detailFallback = "No informado";

function formatCountryLabel(code: string | null, label?: string) {
  return formatTradeDisplayCodeLabel({
    code,
    fallback: detailFallback,
    kind: "country",
    label,
  });
}

function formatMoney(value: string | null, currency?: string) {
  return formatTradeMoney(value, currency, detailFallback);
}

function relatedGroupHref(group: RelatedGroupWithLabels) {
  return buildTradeRecordSearchHref(
    filtersToTradeRecordSearchParams({
      ...group.filters,
      limit: 25,
    }),
  );
}

function relatedRecordValue(record: RelatedRecord) {
  if (record.tradeFlow === "import") {
    return formatMoney(record.itemCifValue, record.decodedLabels.currency);
  }

  return formatMoney(record.itemFobValue, record.decodedLabels.currency);
}

function relatedRecordCountry(record: RelatedRecord) {
  if (record.tradeFlow === "export") {
    return {
      code: record.destinationCountryCode,
      name: formatCountryLabel(
        record.destinationCountryCode,
        record.decodedLabels.destinationCountry,
      ),
    };
  }

  return {
    code: record.originCountryCode,
    name: formatCountryLabel(record.originCountryCode, record.decodedLabels.originCountry),
  };
}

export function RelatedRecordsSection({ groups }: { groups: RelatedGroupWithLabels[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Registros relacionados</CardTitle>
        <CardDescription>
          Grupos acotados del mismo mes para investigar patrones sin inferir identidad
          legal. Los correlativos Aduana son anónimos.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {groups.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No encontramos registros relacionados claros con los campos disponibles.
          </p>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {groups.map((group) => (
              <section
                key={group.key}
                className="min-w-0 rounded-lg border border-border"
              >
                <div className="flex flex-col gap-2 border-b px-3 py-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h2 className="text-sm font-medium">{group.title}</h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {group.description}
                    </p>
                  </div>
                  <Link
                    href={relatedGroupHref(group)}
                    className="shrink-0 text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  >
                    Ver búsqueda
                  </Link>
                </div>
                <div className="divide-y divide-border">
                  {group.records.map((related) => {
                    const product = productDisplayFromRaw(related.productDescriptionRaw);
                    const country = relatedRecordCountry(related);
                    const period = formatTradeRecordPeriodValue(
                      related.periodYear,
                      related.periodMonth,
                    );

                    return (
                      <Link
                        key={related.id}
                        href={`/trade-records/${related.id}`}
                        className="grid gap-2 px-3 py-3 text-sm hover:bg-muted/50 md:grid-cols-[1fr_auto]"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline">{period}</Badge>
                            <span className="font-mono text-xs text-muted-foreground">
                              HS {related.hsCodeNormalized ?? "—"}
                            </span>
                          </div>
                          <div className="mt-1 line-clamp-2 font-medium">
                            {product.title}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            <span className="inline-flex min-w-0 items-center gap-2">
                              <CountryFlag
                                countryCode={country.code}
                                countryName={country.name}
                              />
                              <span>{country.name}</span>
                            </span>
                          </div>
                        </div>
                        <div className="min-w-[120px] font-mono text-xs text-muted-foreground md:text-right">
                          {relatedRecordValue(related)}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
