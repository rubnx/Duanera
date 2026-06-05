import * as React from "react"
import { Loader2Icon, SearchIcon } from "lucide-react"

import { cn } from "@/lib/utils"

type GlobalSearchProps = React.ComponentProps<"form"> & {
  disabled?: boolean
  inputProps?: Omit<React.ComponentProps<"input">, "type">
  label?: string
  loading?: boolean
  placeholder?: string
  shortcutLabel?: string
}

function GlobalSearch({
  children,
  className,
  disabled = false,
  inputProps,
  label = "Buscar registros",
  loading = false,
  placeholder = "Buscar importador, exportador, producto o HS",
  shortcutLabel = "Cmd K",
  ...props
}: GlobalSearchProps) {
  return (
    <form
      data-slot="global-search"
      data-disabled={disabled}
      data-loading={loading}
      role="search"
      aria-busy={loading || undefined}
      className={cn(
        "flex h-(--ds-search-height) w-full max-w-[540px] items-center gap-2 rounded-ds-lg border border-ds-border bg-ds-surface px-3 text-[length:var(--ds-text-sm)] focus-within:border-ds-focus-ring focus-within:ring-3 focus-within:ring-ds-focus-ring/20 data-[disabled=true]:opacity-60",
        className
      )}
      {...props}
    >
      <SearchIcon
        aria-hidden="true"
        className="size-(--ds-icon-md) shrink-0 text-ds-text-muted"
      />
      <input
        type="search"
        aria-label={label}
        disabled={disabled}
        placeholder={placeholder}
        {...inputProps}
        className={cn(
          "min-w-0 flex-1 bg-transparent text-[length:var(--ds-text-sm)] text-ds-text-primary outline-none placeholder:text-ds-text-muted",
          inputProps?.className
        )}
      />
      {loading ? (
        <Loader2Icon
          aria-hidden="true"
          className="size-(--ds-icon-md) shrink-0 animate-spin text-ds-text-muted"
        />
      ) : null}
      {shortcutLabel ? (
        <kbd className="hidden h-7 shrink-0 items-center rounded-ds-sm bg-ds-muted px-2 text-[length:var(--ds-text-xs)] font-medium text-ds-text-secondary sm:inline-flex">
          {shortcutLabel}
        </kbd>
      ) : null}
      {children}
    </form>
  )
}

export { GlobalSearch, type GlobalSearchProps }
