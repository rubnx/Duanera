"use client"

import { AlertTriangleIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

export default function ExplorerError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-ds-app px-6 text-ds-text-primary">
      <section className="w-full max-w-xl rounded-ds-xl border border-ds-warning-border bg-ds-surface p-6 shadow-ds-soft">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-ds-md bg-ds-warning-soft text-ds-warning">
            <AlertTriangleIcon aria-hidden="true" className="size-(--ds-icon-md)" />
          </span>
          <div className="min-w-0">
            <h1 className="text-ds-xl font-bold leading-(--ds-leading-tight)">
              No pudimos cargar el Explorador
            </h1>
            <p className="mt-2 text-ds-sm leading-(--ds-leading-normal) text-ds-text-secondary">
              La consulta de registros o metadatos falló. No se muestran datos
              parciales para evitar mezclar resultados incompletos.
            </p>
            {error.digest ? (
              <p className="mt-3 break-words font-mono text-ds-xs text-ds-text-muted">
                Referencia: {error.digest}
              </p>
            ) : null}
            <Button className="mt-5" type="button" variant="primary" size="product" onClick={reset}>
              Reintentar
            </Button>
          </div>
        </div>
      </section>
    </main>
  )
}
