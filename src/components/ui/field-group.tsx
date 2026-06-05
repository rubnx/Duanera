import * as React from "react"

import { cn } from "@/lib/utils"

function FieldGroup({
  className,
  columns = 2,
  ...props
}: React.ComponentProps<"dl"> & { columns?: 1 | 2 | 3 }) {
  return (
    <dl
      data-slot="field-group"
      data-columns={columns}
      className={cn(
        "grid gap-x-6 gap-y-4 data-[columns=1]:grid-cols-1 data-[columns=2]:grid-cols-1 data-[columns=3]:grid-cols-1 md:data-[columns=2]:grid-cols-2 lg:data-[columns=3]:grid-cols-3",
        className
      )}
      {...props}
    />
  )
}

function FieldGroupItem({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-group-item"
      className={cn("min-w-0", className)}
      {...props}
    />
  )
}

function FieldLabel({ className, ...props }: React.ComponentProps<"dt">) {
  return (
    <dt
      data-slot="field-label"
      className={cn("text-[length:var(--ds-text-xs)] text-ds-text-muted", className)}
      {...props}
    />
  )
}

function FieldValue({
  className,
  children,
  emptyValue = "No informado",
  muted = false,
  numeric = false,
  ...props
}: React.ComponentProps<"dd"> & {
  emptyValue?: React.ReactNode
  muted?: boolean
  numeric?: boolean
}) {
  const isEmpty = children === null || children === undefined || children === ""

  return (
    <dd
      data-slot="field-value"
      data-empty={isEmpty}
      data-muted={muted}
      data-numeric={numeric}
      className={cn(
        "mt-1 min-w-0 break-words text-[length:var(--ds-text-md)] leading-(--ds-leading-normal) font-medium text-ds-text-primary data-[empty=true]:text-ds-text-muted data-[muted=true]:text-ds-text-secondary data-[numeric=true]:tabular-nums",
        className
      )}
      {...props}
    >
      {isEmpty ? emptyValue : children}
    </dd>
  )
}

export { FieldGroup, FieldGroupItem, FieldLabel, FieldValue }
