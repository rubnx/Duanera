import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { isInternalToolsEnabled } from "@/research/internal-research-access";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const showInternalTools = isInternalToolsEnabled();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[1120px] flex-col gap-5 px-4 py-8 lg:px-6">
      <header className="flex flex-col gap-3 border-b pb-5">
        <Badge variant="outline" className="w-fit">
          Duanera MVP
        </Badge>
        <h1 className="max-w-3xl text-3xl font-semibold tracking-tight">
          Base interna para explorar registros Aduana
        </h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          La muestra dev permite buscar registros normalizados de importacion y
          exportacion, manteniendo trazabilidad al archivo fuente, lote y fila cruda.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Buscador interno</CardTitle>
            <CardDescription>
              Tabla filtrable sobre la muestra normalizada de marzo 2026.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Link
              href="/trade-records"
              className="inline-flex h-8 w-fit items-center rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Abrir registros
            </Link>
            <p className="text-sm text-muted-foreground">
              Los IDs de importador/exportador son correlativos anonimos de Aduana, no
              identidades legales verificadas.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Fuentes y lotes</CardTitle>
            <CardDescription>
              Vista read-only de archivos fuente, lotes y conteos de trazabilidad.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Link
              href="/sources"
              className="inline-flex h-8 w-fit items-center rounded-lg border border-border px-2.5 text-sm font-medium hover:bg-muted"
            >
              Abrir fuentes
            </Link>
            <p className="text-sm text-muted-foreground">
              No muestra rutas locales, credenciales ni claves privadas de almacenamiento.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>API dev</CardTitle>
            <CardDescription>
              La UI usa el mismo adaptador de busqueda que la ruta API.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <code className="block break-words rounded-lg bg-muted p-3 text-xs">
              /api/trade-records?tradeFlow=import&amp;periodFrom=2026-03&amp;periodTo=2026-03&amp;limit=5
            </code>
          </CardContent>
        </Card>

        {showInternalTools ? (
          <Card>
            <CardHeader>
              <CardTitle>Calidad de datos</CardTitle>
              <CardDescription>
                Cobertura interna de marzo 2026 por flujo, fuente, campos y etiquetas.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Link
                href="/data-quality"
                className="inline-flex h-8 w-fit items-center rounded-lg border border-border px-2.5 text-sm font-medium hover:bg-muted"
              >
                Abrir calidad
              </Link>
              <p className="text-sm text-muted-foreground">
                Vista read-only para detectar riesgos de mapeo, cobertura y uso comercial.
              </p>
            </CardContent>
          </Card>
        ) : null}

        {showInternalTools ? (
          <Card>
            <CardHeader>
              <CardTitle>Investigacion identidad</CardTitle>
              <CardDescription>
                Revision interna de pistas textuales para correlativos anonimos.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Link
                href="/research/identity-inference"
                className="inline-flex h-8 w-fit items-center rounded-lg border border-border px-2.5 text-sm font-medium hover:bg-muted"
              >
                Abrir investigacion
              </Link>
              <p className="text-sm text-muted-foreground">
                Muestra evidencia no verificada; no crea nombres legales ni perfiles de
                empresa.
              </p>
            </CardContent>
          </Card>
        ) : null}
      </section>
    </main>
  );
}
