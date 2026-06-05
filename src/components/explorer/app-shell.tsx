import * as React from "react"

import { cn } from "@/lib/utils"

type AppShellProps = React.ComponentProps<"div"> & {
  sidebar: React.ReactNode
  detailPanel?: React.ReactNode
  mainProps?: React.ComponentProps<"main">
}

function AppShell({
  className,
  sidebar,
  detailPanel,
  mainProps,
  children,
  ...props
}: AppShellProps) {
  const { className: mainClassName, ...mainRest } = mainProps ?? {}

  return (
    <div
      data-slot="app-shell"
      className={cn("min-h-screen bg-ds-app text-ds-text-primary", className)}
      {...props}
    >
      <div
        data-slot="app-shell-grid"
        className="grid min-h-screen grid-cols-1 lg:grid-cols-[var(--ds-sidebar-width)_minmax(0,1fr)]"
      >
        {sidebar}
        <main
          data-slot="app-shell-main"
          className={cn("min-w-0", mainClassName)}
          {...mainRest}
        >
          {children}
        </main>
        {detailPanel}
      </div>
    </div>
  )
}

function AppShellMain({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="app-shell-main-content"
      className={cn("mx-auto flex min-h-screen w-full flex-col", className)}
      {...props}
    />
  )
}

function AppShellContent({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="app-shell-content"
      className={cn("flex min-w-0 flex-1 flex-col gap-5 px-6 py-5", className)}
      {...props}
    />
  )
}

export { AppShell, AppShellMain, AppShellContent, type AppShellProps }
