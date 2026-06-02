import Link from "next/link";

import { DataQualityStatusBadge } from "@/components/data-quality-status-badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  type DataQualityIssueGroup,
  type DataQualityIssueSample,
} from "@/quality/data-quality";
import { formatIntegerEsCl } from "@/lib/format";
import type { TradeFlow } from "@/trade/trade-records";

const formatNumber = formatIntegerEsCl;

function formatMaybe(value: string | number | null | undefined, fallback = "Sin dato") {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  return String(value);
}

function flowLabel(value: TradeFlow | "unknown") {
  if (value === "import") {
    return "Importaciones";
  }

  if (value === "export") {
    return "Exportaciones";
  }

  return "Sin flujo";
}

function IssueSampleTable({ samples }: { samples: DataQualityIssueSample[] }) {
  if (samples.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
        Sin muestras para este criterio en la base dev actual.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table className="min-w-[1040px]">
        <TableHeader>
          <TableRow>
            <TableHead>Registro</TableHead>
            <TableHead>Valor/cantidad</TableHead>
            <TableHead>Códigos</TableHead>
            <TableHead>Evidencia</TableHead>
            <TableHead>Fuente</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {samples.map((sample) => (
            <TableRow key={sample.id}>
              <TableCell className="max-w-[300px] align-top">
                <Link
                  href={sample.recordHref}
                  className="font-medium underline-offset-4 hover:underline"
                >
                  {flowLabel(sample.tradeFlow)} · fila {formatNumber(sample.rawRowNumber)}
                </Link>
                <div className="mt-1 font-mono text-xs text-muted-foreground">
                  {formatMaybe(sample.hsCodeNormalized)} · item {formatMaybe(sample.itemNumber)}
                </div>
                <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                  {formatMaybe(sample.productDescriptionRaw)}
                </div>
              </TableCell>
              <TableCell className="align-top text-xs">
                <div>
                  <span className="text-muted-foreground">{sample.itemValueLabel}: </span>
                  <span className="font-mono">{formatMaybe(sample.itemValue)}</span>
                </div>
                <div className="mt-1">
                  <span className="text-muted-foreground">FOB declaración: </span>
                  <span className="font-mono">
                    {formatMaybe(sample.declarationFobValue)}
                  </span>
                </div>
                <div className="mt-1">
                  <span className="text-muted-foreground">Cantidad: </span>
                  <span className="font-mono">
                    {formatMaybe(sample.quantity)} {formatMaybe(sample.quantityUnitCode, "")}
                  </span>
                </div>
                <div className="mt-1">
                  <span className="text-muted-foreground">Precio unitario: </span>
                  <span className="font-mono">{formatMaybe(sample.unitPriceValue)}</span>
                </div>
                <div className="mt-1">
                  <span className="text-muted-foreground">Peso item/total: </span>
                  <span className="font-mono">
                    {formatMaybe(sample.grossWeightItem)} /{" "}
                    {formatMaybe(sample.grossWeightTotal)}
                  </span>
                </div>
              </TableCell>
              <TableCell className="align-top font-mono text-xs">
                <div>Aduana {formatMaybe(sample.customsOfficeCode)}</div>
                <div className="mt-1">Puerto {formatMaybe(sample.relevantPortCode)}</div>
                <div className="mt-1">Vía {formatMaybe(sample.transportModeCode)}</div>
              </TableCell>
              <TableCell className="max-w-[260px] align-top text-sm text-muted-foreground">
                {sample.evidence}
              </TableCell>
              <TableCell className="max-w-[260px] align-top text-xs">
                <Link
                  href={sample.sourceHref}
                  className="block break-words font-medium underline-offset-4 hover:underline"
                >
                  {sample.sourceFilename}
                </Link>
                <div className="mt-1 font-mono text-muted-foreground">
                  Lote {sample.importBatchId.slice(0, 8)}
                </div>
                {sample.sourceTradeRecordsHref ? (
                  <Link
                    href={sample.sourceTradeRecordsHref}
                    className="mt-2 inline-flex font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  >
                    Ver registros de la fuente
                  </Link>
                ) : null}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function IssueGroupCard({ group }: { group: DataQualityIssueGroup }) {
  return (
    <article className="rounded-lg border border-border bg-background">
      <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <DataQualityStatusBadge status={group.status} />
            <span className="font-mono text-xs text-muted-foreground">
              {formatNumber(group.count)} registros
            </span>
          </div>
          <h2 className="mt-2 text-base font-semibold">{group.title}</h2>
          <p className="mt-1 max-w-4xl text-sm leading-6 text-muted-foreground">
            {group.description}
          </p>
        </div>
        <Link
          href={group.tradeRecordsHref}
          className="w-fit whitespace-nowrap text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Ver búsqueda relacionada
        </Link>
      </div>
      <div className="p-4">
        <div className="mb-3 text-xs text-muted-foreground">
          Mostrando hasta {group.sampleLimit} muestras. La lista relacionada puede ser
          amplia y no siempre filtra exactamente el criterio de QA.
        </div>
        <IssueSampleTable samples={group.samples} />
      </div>
    </article>
  );
}

export function IssueGroupsSection({ groups }: { groups: DataQualityIssueGroup[] }) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Drilldowns de QA</CardTitle>
        <CardDescription>
          Muestras accionables para investigar campos comerciales incompletos, etiquetas
          faltantes y combinaciones de valor/cantidad que pueden confundir análisis. Las
          muestras enlazan a registro, fuente y lote sin exponer rutas locales.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 pt-4">
        {groups.map((group) => (
          <IssueGroupCard key={group.key} group={group} />
        ))}
      </CardContent>
    </Card>
  );
}
