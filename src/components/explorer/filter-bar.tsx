import * as React from "react"

import { cn } from "@/lib/utils"

function FilterBar({
  className,
  "aria-label": ariaLabel = "Filtros",
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="filter-bar"
      role="group"
      aria-label={ariaLabel}
      className={cn(
        "flex min-w-0 flex-wrap items-end gap-2 border-b border-ds-border-soft px-3 py-2",
        className
      )}
      {...props}
    />
  )
}

function FilterBarGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="filter-bar-group"
      className={cn("flex min-w-0 flex-1 flex-wrap items-end gap-2", className)}
      {...props}
    />
  )
}

function FilterBarActions({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="filter-bar-actions"
      className={cn("ml-auto flex items-end gap-2", className)}
      {...props}
    />
  )
}

export { FilterBar, FilterBarGroup, FilterBarActions }
