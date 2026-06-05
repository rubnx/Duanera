import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2Icon } from "lucide-react"

import {
  controlDisabled,
  controlFocusRing,
  iconChildStyles,
} from "@/components/ui/component-styles"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  [
    "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none active:not-aria-[haspopup]:translate-y-px",
    "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
    controlFocusRing,
    controlDisabled,
    iconChildStyles,
  ],
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
        primary:
          "bg-ds-primary text-ds-text-inverse hover:bg-ds-primary-hover aria-expanded:bg-ds-primary-active",
        outline:
          "border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "border-ds-border bg-ds-surface text-ds-text-primary hover:bg-ds-muted aria-expanded:bg-ds-muted aria-expanded:text-ds-text-primary",
        ghost:
          "text-ds-text-secondary hover:bg-ds-muted hover:text-ds-text-primary aria-expanded:bg-ds-muted aria-expanded:text-ds-text-primary",
        danger:
          "bg-ds-danger-soft text-ds-danger hover:bg-ds-danger-soft focus-visible:border-ds-danger focus-visible:ring-ds-danger/20",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",
        product:
          "h-(--ds-control-height-lg) gap-2 rounded-ds-md px-4 text-[length:var(--ds-text-sm)] has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        "product-md":
          "h-(--ds-control-height-md) gap-2 rounded-ds-md px-3 text-[length:var(--ds-text-sm)] has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5",
        "product-lg":
          "h-11 gap-2 rounded-ds-md px-5 text-[length:var(--ds-text-md)] has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
        "product-icon-sm": "size-(--ds-control-height-sm) rounded-ds-md",
        "product-icon": "size-(--ds-control-height-lg) rounded-ds-md",
        "product-icon-lg": "size-11 rounded-ds-md",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

type ButtonProps = ButtonPrimitive.Props &
  VariantProps<typeof buttonVariants> & {
    loading?: boolean
    loadingLabel?: string
  }

function Button({
  className,
  variant = "default",
  size = "default",
  disabled,
  loading = false,
  loadingLabel = "Cargando",
  children,
  ...props
}: ButtonProps) {
  return (
    <ButtonPrimitive
      data-slot="button"
      data-loading={loading}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {loading ? (
        <Loader2Icon aria-hidden="true" className="animate-spin" />
      ) : null}
      {loading ? <span className="sr-only">{loadingLabel}</span> : null}
      {children}
    </ButtonPrimitive>
  )
}

export { Button, buttonVariants, type ButtonProps }
