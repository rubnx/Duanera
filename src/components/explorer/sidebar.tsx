import * as React from "react"

import { controlDisabled, controlFocusRing } from "@/components/ui/component-styles"
import { cn } from "@/lib/utils"

type SidebarProps = React.ComponentProps<"aside">

function Sidebar({ className, ...props }: SidebarProps) {
  return (
    <aside
      data-slot="sidebar"
      className={cn(
        "border-ds-border-soft bg-ds-shell text-ds-text-secondary lg:sticky lg:top-0 lg:h-screen lg:border-r",
        className
      )}
      {...props}
    />
  )
}

function SidebarInner({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-inner"
      className={cn("flex h-full flex-col gap-4 p-4", className)}
      {...props}
    />
  )
}

function SidebarBrand({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-brand"
      className={cn(
        "flex h-12 items-center gap-3 px-1 text-[20px] font-bold leading-(--ds-leading-tight) text-ds-text-primary",
        className
      )}
      {...props}
    />
  )
}

function SidebarSection({ className, ...props }: React.ComponentProps<"nav">) {
  return (
    <nav
      data-slot="sidebar-section"
      className={cn("flex flex-col gap-1", className)}
      {...props}
    />
  )
}

type SidebarItemProps = React.ComponentProps<"a"> & {
  active?: boolean
  disabled?: boolean
  icon?: React.ReactNode
  badge?: React.ReactNode
}

function SidebarItem({
  active = false,
  disabled = false,
  href,
  icon,
  badge,
  className,
  children,
  tabIndex,
  ...props
}: SidebarItemProps) {
  return (
    <a
      data-slot="sidebar-item"
      data-active={active}
      data-disabled={disabled}
      aria-current={active ? "page" : undefined}
      aria-disabled={disabled || undefined}
      href={disabled ? undefined : href}
      tabIndex={disabled ? -1 : tabIndex}
      className={cn(
        "relative flex h-10 items-center gap-3 rounded-ds-md px-3 text-[length:var(--ds-text-sm)] font-medium transition-colors hover:bg-ds-muted hover:text-ds-text-primary",
        "data-[active=true]:bg-ds-primary-soft data-[active=true]:font-semibold data-[active=true]:text-ds-primary",
        "[&_svg]:pointer-events-none [&_svg]:size-(--ds-icon-md) [&_svg]:shrink-0",
        controlFocusRing,
        controlDisabled,
        className
      )}
      {...props}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {badge ? <span className="shrink-0">{badge}</span> : null}
      {active ? (
        <span
          aria-hidden="true"
          className="absolute right-3 top-1/2 size-2 -translate-y-1/2 rounded-full bg-ds-primary"
        />
      ) : null}
    </a>
  )
}

function SidebarDataCard({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-data-card"
      className={cn(
        "rounded-ds-md border border-ds-border-soft bg-ds-subtle p-3 text-[length:var(--ds-text-xs)] leading-(--ds-leading-normal) text-ds-text-muted",
        className
      )}
      {...props}
    />
  )
}

function SidebarFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-footer"
      className={cn(
        "mt-auto flex flex-col gap-1 border-t border-ds-border-soft pt-4",
        className
      )}
      {...props}
    />
  )
}

export {
  Sidebar,
  SidebarInner,
  SidebarBrand,
  SidebarSection,
  SidebarItem,
  SidebarDataCard,
  SidebarFooter,
  type SidebarProps,
  type SidebarItemProps,
}
