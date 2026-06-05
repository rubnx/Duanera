import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const statusBadgeVariants = cva(
  "inline-flex h-6 w-fit shrink-0 items-center justify-center gap-1 rounded-4xl border px-2 text-[length:var(--ds-text-xs)] font-medium whitespace-nowrap [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3",
  {
    variants: {
      variant: {
        verified:
          "border-ds-success-border bg-ds-success-soft text-ds-success",
        review:
          "border-ds-warning-border bg-ds-warning-soft text-ds-warning",
        error: "border-ds-danger-border bg-ds-danger-soft text-ds-danger",
        neutral: "border-ds-border bg-ds-muted text-ds-text-secondary",
      },
      size: {
        sm: "h-5 px-1.5 text-[length:var(--ds-text-xs)]",
        md: "h-6 px-2 text-[length:var(--ds-text-xs)]",
      },
    },
    defaultVariants: {
      variant: "neutral",
      size: "md",
    },
  }
)

type StatusBadgeProps = React.ComponentProps<"span"> &
  VariantProps<typeof statusBadgeVariants>

function StatusBadge({
  className,
  variant = "neutral",
  size = "md",
  ...props
}: StatusBadgeProps) {
  return (
    <span
      data-slot="status-badge"
      data-variant={variant}
      data-size={size}
      className={cn(statusBadgeVariants({ variant, size }), className)}
      {...props}
    />
  )
}

export { StatusBadge, statusBadgeVariants, type StatusBadgeProps }
