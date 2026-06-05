import * as React from "react"

import { cn } from "@/lib/utils"

type SourceTraceabilityField = {
  id?: React.Key
  label: React.ReactNode
  value: React.ReactNode
  icon?: React.ReactNode
}

type SourceTraceabilityCardProps = React.ComponentProps<"section"> & {
  emptyMessage?: React.ReactNode
  title?: React.ReactNode
  fields?: SourceTraceabilityField[]
  preview?: React.ReactNode
  previewVariant?: "default" | "compact"
}

function SourceTraceabilityCard({
  className,
  emptyMessage = "Sin información de trazabilidad disponible.",
  title = "Fuente y trazabilidad",
  fields,
  preview,
  previewVariant = "default",
  children,
  ...props
}: SourceTraceabilityCardProps) {
  const titleId = React.useId()
  const hasFields = Boolean(fields?.length)
  const hasContent = hasFields || preview || children
  const compactPreview = previewVariant === "compact"

  return (
    <section
      data-slot="source-traceability-card"
      aria-labelledby={titleId}
      className={cn(
        "rounded-ds-lg border border-ds-success-border bg-[linear-gradient(180deg,var(--ds-success-softer),var(--ds-bg-surface))] p-4 text-[length:var(--ds-text-sm)] text-ds-text-primary",
        className
      )}
      {...props}
    >
      <h3 id={titleId} className="text-[length:var(--ds-text-md)] font-bold text-ds-success">
        {title}
      </h3>
      {hasFields || preview ? (
        <div
          className={cn(
            "mt-4 grid gap-4",
            hasFields && preview && !compactPreview
              ? "md:grid-cols-[minmax(0,1fr)_minmax(180px,0.8fr)]"
              : "grid-cols-1"
          )}
        >
          {hasFields ? (
            <dl className="grid gap-3">
              {fields?.map((field, index) => (
                <div
                  key={field.id ?? index}
                  className="grid grid-cols-[20px_minmax(0,1fr)] gap-3"
                >
                  <span className="mt-0.5 text-ds-success [&_svg]:size-(--ds-icon-sm)">
                    {field.icon}
                  </span>
                  <div className="min-w-0">
                    <dt className="text-[length:var(--ds-text-xs)] text-ds-text-muted">
                      {field.label}
                    </dt>
                    <dd className="mt-1 select-text break-words text-[length:var(--ds-text-sm)] font-medium text-ds-text-primary">
                      {field.value}
                    </dd>
                  </div>
                </div>
              ))}
            </dl>
          ) : null}
          {preview ? (
            <div
              className={cn(
                "min-w-0 rounded-ds-md border border-ds-border-soft bg-ds-surface p-3",
                compactPreview
                  ? "border-ds-success-border bg-ds-success-softer/60 py-2"
                  : undefined
              )}
            >
              {preview}
            </div>
          ) : null}
        </div>
      ) : null}
      {!hasContent ? (
        <p className="mt-3 text-[length:var(--ds-text-sm)] text-ds-text-secondary">
          {emptyMessage}
        </p>
      ) : null}
      {children}
    </section>
  )
}

function OriginalRowPreview({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="original-row-preview"
      className={cn("overflow-hidden rounded-ds-sm text-[length:var(--ds-text-xs)]", className)}
      {...props}
    />
  )
}

export {
  SourceTraceabilityCard,
  OriginalRowPreview,
  type SourceTraceabilityCardProps,
  type SourceTraceabilityField,
}
