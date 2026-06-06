import * as React from "react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { controlFocusRing } from "@/components/ui/component-styles"
import { cn } from "@/lib/utils"

function DataTableShell({
  className,
  ...props
}: React.ComponentProps<"section">) {
  return (
    <section
      data-slot="data-table-shell"
      className={cn("min-w-0 bg-ds-surface", className)}
      {...props}
    />
  )
}

function DataTableToolbar({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="data-table-toolbar"
      className={cn(
        "flex min-h-11 items-center gap-3 border-b border-ds-border-soft px-4 py-2",
        className
      )}
      {...props}
    />
  )
}

function DataTableTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2
      data-slot="data-table-title"
      className={cn("text-ds-md font-bold text-ds-text-primary", className)}
      {...props}
    />
  )
}

function DataTableCount({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="data-table-count"
      className={cn("text-ds-sm text-ds-text-muted", className)}
      {...props}
    />
  )
}

function DataTableActions({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="data-table-actions"
      className={cn("ml-auto flex items-center gap-2", className)}
      {...props}
    />
  )
}

function DataTable({
  className,
  loading = false,
  ...props
}: React.ComponentProps<"table"> & { loading?: boolean }) {
  return (
    <Table
      data-slot="data-table"
      data-loading={loading}
      aria-busy={loading || undefined}
      className={cn("text-ds-sm text-ds-text-primary", className)}
      {...props}
    />
  )
}

function DataTableHeader({
  className,
  ...props
}: React.ComponentProps<"thead">) {
  return (
    <TableHeader
      data-slot="data-table-header"
      className={cn(
        "sticky top-0 z-10 bg-ds-subtle [&_tr]:border-ds-border",
        className
      )}
      {...props}
    />
  )
}

function DataTableHead({
  className,
  ...props
}: React.ComponentProps<"th">) {
  return (
    <TableHead
      data-slot="data-table-head"
      className={cn(
        "group/help h-(--ds-table-header-height) bg-ds-subtle px-(--ds-table-cell-x) text-ds-xs font-semibold text-ds-text-secondary",
        className
      )}
      {...props}
    />
  )
}

function DataTableBody({
  className,
  ...props
}: React.ComponentProps<"tbody">) {
  return (
    <TableBody
      data-slot="data-table-body"
      className={cn(className)}
      {...props}
    />
  )
}

function DataTableRow({
  className,
  disabled = false,
  interactive = false,
  selected = false,
  tabIndex,
  ...props
}: React.ComponentProps<"tr"> & {
  disabled?: boolean
  interactive?: boolean
  selected?: boolean
}) {
  return (
    <TableRow
      data-slot="data-table-row"
      data-disabled={disabled}
      data-interactive={interactive}
      data-selected={selected}
      aria-disabled={disabled || undefined}
      aria-selected={selected || undefined}
      tabIndex={interactive && !disabled ? (tabIndex ?? 0) : tabIndex}
      className={cn(
        "h-(--ds-table-row-height) border-ds-border-soft bg-ds-surface transition-colors duration-(--ds-duration-fast) ease-(--ds-ease-standard) hover:bg-ds-primary-softer/50 data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-60 data-[interactive=true]:cursor-pointer data-[selected=true]:bg-ds-primary-softer data-[selected=true]:shadow-[inset_3px_0_0_var(--ds-primary)]",
        interactive ? controlFocusRing : undefined,
        className
      )}
      {...props}
    />
  )
}

function DataTableCell({
  className,
  children,
  emptyValue = "No informado",
  muted = false,
  numeric = false,
  truncate = false,
  ...props
}: React.ComponentProps<"td"> & {
  emptyValue?: React.ReactNode
  muted?: boolean
  numeric?: boolean
  truncate?: boolean
}) {
  const isEmpty = children === null || children === undefined || children === ""

  return (
    <TableCell
      data-slot="data-table-cell"
      data-empty={isEmpty}
      data-muted={muted}
      data-numeric={numeric}
      data-truncate={truncate}
      className={cn(
        "px-(--ds-table-cell-x) py-(--ds-table-cell-y) align-middle text-ds-sm whitespace-normal data-[empty=true]:text-ds-text-muted data-[muted=true]:text-ds-text-secondary data-[truncate=true]:max-w-72 data-[truncate=true]:truncate data-[truncate=true]:whitespace-nowrap",
        numeric ? "text-right tabular-nums" : undefined,
        className
      )}
      {...props}
    >
      {isEmpty ? emptyValue : children}
    </TableCell>
  )
}

type DataTableStateProps = React.ComponentProps<"div"> & {
  variant?: "empty" | "loading"
}

function DataTableState({
  className,
  children,
  variant = "empty",
  ...props
}: DataTableStateProps) {
  const defaultCopy =
    variant === "loading"
      ? "Cargando registros..."
      : "No encontramos registros con estos filtros."

  return (
    <div
      data-slot="data-table-state"
      data-variant={variant}
      role={variant === "loading" ? "status" : undefined}
      aria-live={variant === "loading" ? "polite" : undefined}
      className={cn(
        "flex min-h-48 items-center justify-center border-y border-ds-border-soft px-6 text-center text-ds-sm text-ds-text-muted",
        className
      )}
      {...props}
    >
      {children ?? defaultCopy}
    </div>
  )
}

function DataTableEmpty(props: Omit<DataTableStateProps, "variant">) {
  return <DataTableState data-slot="data-table-empty" variant="empty" {...props} />
}

function DataTableLoading(props: Omit<DataTableStateProps, "variant">) {
  return (
    <DataTableState data-slot="data-table-loading" variant="loading" {...props} />
  )
}

function DataTablePagination({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="data-table-pagination"
      className={cn(
        "flex min-h-11 items-center gap-2 border-t border-ds-border-soft bg-ds-subtle px-4 py-2 text-ds-sm text-ds-text-secondary",
        className
      )}
      {...props}
    />
  )
}

export {
  DataTableShell,
  DataTableToolbar,
  DataTableTitle,
  DataTableCount,
  DataTableActions,
  DataTable,
  DataTableHeader,
  DataTableHead,
  DataTableBody,
  DataTableRow,
  DataTableCell,
  DataTableState,
  DataTableEmpty,
  DataTableLoading,
  DataTablePagination,
}
