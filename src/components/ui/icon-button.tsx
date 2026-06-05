import * as React from "react"

import { Button, type ButtonProps } from "@/components/ui/button"
import { iconChildStyles } from "@/components/ui/component-styles"
import { cn } from "@/lib/utils"

type IconButtonProps = Omit<ButtonProps, "children" | "size"> & {
  "aria-label": string
  children: React.ReactNode
  size?: "sm" | "md" | "lg"
}

const iconButtonSizes: Record<NonNullable<IconButtonProps["size"]>, ButtonProps["size"]> = {
  sm: "product-icon-sm",
  md: "product-icon",
  lg: "product-icon-lg",
}

function IconButton({
  className,
  size = "md",
  variant = "ghost",
  children,
  ...props
}: IconButtonProps) {
  return (
    <Button
      data-slot="icon-button"
      variant={variant}
      size={iconButtonSizes[size]}
      className={cn(iconChildStyles, "[&_svg:not([class*='size-'])]:size-(--ds-icon-md)", className)}
      {...props}
    >
      {children}
    </Button>
  )
}

export { IconButton, type IconButtonProps }
