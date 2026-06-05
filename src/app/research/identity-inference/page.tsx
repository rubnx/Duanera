import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { db } from "@/db/client";
import {
  listIdentityEvidenceGroups,
  type IdentityEvidenceGroup,
  type IdentityEvidenceSignal,
  type IdentityEvidenceStrength,
} from "@/research/identity-evidence";
import { isInternalResearchEnabled } from "@/research/internal-research-access";
import { formatIntegerEsCl } from "@/lib/format";
import { formatTradeFlowLabel } from "@/trade/trade-flow-ui";
import { productDisplayFromRaw } from "@/trade/trade-record-display";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function flowFromParams(params: Record<string, string | string[] | undefined>) {
  return firstValue(params.tradeFlow) === "export" ? "export" : "import";
}

const formatNumber = formatIntegerEsCl;

function formatMoney(value: string | null) {
  if (!value) {
    return "No informado";
  }

  return `${value} DOLAR`;
}

function strengthLabel(value: IdentityEvidenceStrength) {
  const labels: Record<IdentityEvidenceStrength, string> = {
    direct_source_text: "Texto fuente directo",
    context: "Contexto comercial",
    weak: "Pista debil",
  };

  return labels[value];
}

function signalTone(value: IdentityEvidenceStrength) {
  if (value === "direct_source_text") {
    return "border-emerald-600/30 bg-emerald-50 text-emerald-900";
  }

  if (value === "context") {
    return "border-amber-600/30 bg-amber-50 text-amber-900";
  }

  return "border-border bg-muted/30 text-muted-foreground";
}

function roleLabel(group: IdentityEvidenceGroup) {
  return group.tradeFlow === "import"
    ? "ID importador Aduana"
    : "ID exportador Aduana";
}

function SignalPill({ signal }: { signal: IdentityEvidenceSignal }) {
  return (
    <div
      className={`min-w-0 rounded-md border px-2 py-1 ${signalTone(signal.strength)}`}
      title={signal.caveat}
    >
      <div className="text-[11px] font-medium">{signal.label}</div>
      <div className="mt-0.5 break-words font-mono text-xs">{signal.value}</div>
    </div>
  );
}

function GroupCard({ group }: { group: IdentityEvidenceGroup }) {
  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <CardTitle className="flex flex-wrap items-center gap-2">
              <span>{roleLabel(group)}</span>
              <span className="font-mono">{group.correlativeId}</span>
            </CardTitle>
            <CardDescription className="mt-2">
              {group.evidenceSummary} No es nombre legal ni RUT verificado.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{strengthLabel(group.evidenceUsefulness)}</Badge>
            <Link
              href={group.tradeRecordsHref}
              className="inline-flex h-7 items-center rounded-lg border border-border px-2 text-xs font-medium hover:bg-muted"
            >
              Ver registros
            </Link>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 pt-4">
        <div className="grid gap-3 md:grid-cols-5">
          <Metric label="Registros" value={formatNumber(group.recordCount)} />
          <Metric label="Declaraciones" value={formatNumber(group.declarationCount)} />
          <Metric label="Codigos HS" value={formatNumber(group.hsCodeCount)} />
          <Metric label="Paises" value={formatNumber(group.countryCount)} />
          <Metric label="Max. valor item" value={formatMoney(group.maxItemValue)} />
        </div>

        <div className="grid gap-3 xl:grid-cols-2">
          {group.records.map((record) => (
            <article
              key={record.id}
              className="min-w-0 rounded-lg border border-border bg-muted/10 p-3"
            >
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <Link
                    href={`/trade-records/${record.id}`}
                    className="break-words text-sm font-medium underline-offset-4 hover:underline"
                  >
                    {productDisplayFromRaw(record.productDescriptionRaw).title}
                  </Link>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span className="font-mono">HS {record.hsCodeNormalized ?? "—"}</span>
                    <span className="font-mono">Fila {record.rawRowNumber}</span>
                    <span className="font-mono">Pais {record.countryCode ?? "—"}</span>
                    <span className="font-mono">Puerto {record.relevantPortCode ?? "—"}</span>
                  </div>
                </div>
                <Link
                  href={`/sources/${record.sourceFileId}#batch-${record.importBatchId}`}
                  className="w-fit shrink-0 text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  Fuente/lote
                </Link>
              </div>

              {record.evidenceSignals.length > 0 ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {record.evidenceSignals.map((signal) => (
                    <SignalPill
                      key={`${record.id}:${signal.field}:${signal.value}`}
                      signal={signal}
                    />
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-xs text-muted-foreground">
                  Sin pistas textuales utiles en esta muestra del correlativo.
                </p>
              )}
            </article>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-background px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 break-words font-mono text-sm font-medium">{value}</div>
    </div>
  );
}

export default async function IdentityInferenceResearchPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  if (!isInternalResearchEnabled()) {
    notFound();
  }

  const params = await searchParams;
  const tradeFlow = flowFromParams(params);
  const groups = await listIdentityEvidenceGroups(db, {
    tradeFlow,
    groupLimit: 8,
    sampleLimit: 4,
    minRecords: 50,
  });

  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 px-4 py-5 lg:px-6">
      <header className="flex flex-col gap-3 border-b pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <Badge variant="outline" className="w-fit">
            Investigacion interna
          </Badge>
          <h1 className="text-2xl font-semibold tracking-tight">
            Pistas posibles de identidad
          </h1>
          <p className="max-w-5xl text-sm leading-6 text-muted-foreground">
            Vista read-only para revisar evidencia textual asociada a correlativos
            anonimos de Aduana en marzo 2026. Las pistas son internas, no verificadas
            por Aduana, y no deben tratarse como nombres legales, RUTs ni perfiles de
            empresa.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          <Link
            href="/trade-records"
            className="font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Registros
          </Link>
          <Link
            href="/sources"
            className="font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Fuentes
          </Link>
        </div>
      </header>

      <Card className="border-amber-500/30 bg-amber-50/40">
        <CardHeader>
          <CardTitle>Reglas de seguridad</CardTitle>
          <CardDescription className="leading-6">
            Esta pagina no crea identidades, no une correlativos y no publica posibles
            empresas. Los transportistas, emisores documentales, marcas y bultos son
            evidencia para revision, no identidad comercial verificada. Los bultos de
            exportacion existen como archivos companion locales, pero no forman parte de
            los registros normalizados mostrados aqui; el reporte CLI los revisa de forma
            separada.
          </CardDescription>
        </CardHeader>
      </Card>

      <section className="flex flex-wrap gap-2">
        <Link
          href="/research/identity-inference?tradeFlow=import"
          className={`inline-flex h-8 items-center rounded-lg border px-2.5 text-sm font-medium ${
            tradeFlow === "import"
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border hover:bg-muted"
          }`}
        >
          Importaciones
        </Link>
        <Link
          href="/research/identity-inference?tradeFlow=export"
          className={`inline-flex h-8 items-center rounded-lg border px-2.5 text-sm font-medium ${
            tradeFlow === "export"
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border hover:bg-muted"
          }`}
        >
          Exportaciones
        </Link>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <Metric label="Flujo revisado" value={formatTradeFlowLabel(tradeFlow, "plural")} />
        <Metric label="Grupos visibles" value={formatNumber(groups.length)} />
        <Metric
          label="Periodo"
          value="2026-03"
        />
      </section>

      <section className="flex flex-col gap-4">
        {groups.map((group) => (
          <GroupCard key={`${group.tradeFlow}:${group.correlativeId}`} group={group} />
        ))}
      </section>
    </main>
  );
}
