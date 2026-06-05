import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { XIcon } from "lucide-react"

import {
  controlDisabled,
  controlFocusRing,
  iconChildStyles,
} from "@/components/ui/component-styles"
import { cn } from "@/lib/utils"

const filterChipVariants = cva(
  [
    "inline-flex h-(--ds-control-height-sm) max-w-full shrink-0 items-center gap-1.5 rounded-ds-md border px-2.5 text-[length:var(--ds-text-xs)] font-medium whitespace-nowrap transition-colors",
    controlDisabled,
    iconChildStyles,
    "[&_svg:not([class*='size-'])]:size-3.5",
  ],
  {
    variants: {
      variant: {
        default: "border-ds-border bg-ds-surface text-ds-text-primary",
        primary:
          "border-ds-border bg-ds-primary-soft text-ds-primary",
        success:
          "border-ds-success-border bg-ds-success-soft text-ds-success",
        purple:
          "border-ds-purple-border bg-ds-purple-soft text-ds-purple",
        warning:
          "border-ds-warning-border bg-ds-warning-soft text-ds-warning",
      },
      selected: {
        true: "border-ds-primary bg-ds-primary-soft text-ds-primary",
        false: "",
      },
    },
    defaultVariants: {
      variant: "default",
      selected: false,
    },
  }
)

type FilterChipProps = React.ComponentProps<"span"> &
  VariantProps<typeof filterChipVariants>

function FilterChip({
  className,
  variant = "default",
  selected = false,
  ...props
}: FilterChipProps) {
  const isSelected = selected === true

  return (
    <span
      data-slot="filter-chip"
      data-variant={variant}
      data-selected={isSelected}
      className={cn(filterChipVariants({ variant, selected: isSelected }), className)}
      {...props}
    />
  )
}

type FilterChipButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof filterChipVariants>

function FilterChipButton({
  className,
  variant = "default",
  selected = false,
  disabled,
  ...props
}: FilterChipButtonProps) {
  const isSelected = selected === true

  return (
    <button
      type="button"
      data-slot="filter-chip-button"
      data-variant={variant}
      data-selected={isSelected}
      disabled={disabled}
      aria-pressed={isSelected}
      className={cn(
        filterChipVariants({ variant, selected: isSelected }),
        "cursor-pointer hover:bg-ds-muted",
        controlFocusRing,
        className
      )}
      {...props}
    />
  )
}

function FilterChipRemoveButton({
  className,
  children,
  ...props
}: React.ComponentProps<"button"> & { "aria-label": string }) {
  return (
    <button
      type="button"
      data-slot="filter-chip-remove"
      className={cn(
        "-mr-1 inline-flex size-5 items-center justify-center rounded-ds-sm text-current opacity-70 transition-opacity hover:opacity-100 [&_svg:not([class*='size-'])]:size-3",
        controlFocusRing,
        controlDisabled,
        className
      )}
      {...props}
    >
      {children ?? <XIcon aria-hidden="true" />}
    </button>
  )
}

export {
  FilterChip,
  FilterChipButton,
  FilterChipRemoveButton,
  filterChipVariants,
  type FilterChipProps,
  type FilterChipButtonProps,
}
