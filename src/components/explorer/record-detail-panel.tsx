"use client"

import * as React from "react"
import { XIcon } from "lucide-react"
import { useRouter } from "next/navigation"

import { IconButton } from "@/components/ui/icon-button"
import {
  controlDisabled,
  controlFocusRing,
} from "@/components/ui/component-styles"
import { StatusBadge, type StatusBadgeProps } from "@/components/ui/status-badge"
import { cn } from "@/lib/utils"

const focusReturnStorageKey = "explorer:focus-return-record-id"

type RecordDetailPanelProps = React.ComponentProps<"aside"> & {
  closeLabel?: string
  closeHref?: string
  focusReturnRecordId?: string
  title?: React.ReactNode
  recordId?: React.ReactNode
  status?: React.ReactNode
  closeAction?: React.ReactNode
  onClose?: React.MouseEventHandler<HTMLButtonElement>
}

function RecordDetailPanel({
  className,
  closeLabel = "Cerrar detalle",
  closeHref,
  focusReturnRecordId,
  title = "Detalle del registro",
  recordId,
  status,
  closeAction,
  onClose,
  children,
  ...props
}: RecordDetailPanelProps) {
  const titleId = React.useId()
  const router = useRouter()

  React.useEffect(() => {
    if (!closeHref) {
      return
    }
    const targetHref = closeHref

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented) {
        return
      }

      event.preventDefault()
      if (focusReturnRecordId) {
        window.sessionStorage.setItem(focusReturnStorageKey, focusReturnRecordId)
      }
      router.push(targetHref, { scroll: false })
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [closeHref, focusReturnRecordId, router])

  return (
    <aside
      data-slot="record-detail-panel"
      aria-labelledby={titleId}
      className={cn(
        "h-full overflow-y-auto border-l border-ds-border bg-ds-surface shadow-ds-panel",
        className
      )}
      {...props}
    >
      <div className="flex min-h-full flex-col gap-5 p-5 sm:p-6">
        <header className="flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <h2
              id={titleId}
              className="text-[length:var(--ds-text-lg)] font-bold leading-(--ds-leading-tight) text-ds-text-primary"
            >
              {title}
            </h2>
            {recordId ? (
              <div className="mt-2 break-words text-[length:var(--ds-text-sm)] font-medium text-ds-text-secondary">
                {recordId}
              </div>
            ) : null}
            {status ? <div className="mt-3">{status}</div> : null}
          </div>
          {closeAction ??
            (onClose ? (
              <IconButton aria-label={closeLabel} size="sm" onClick={onClose}>
                <XIcon aria-hidden="true" />
              </IconButton>
            ) : null)}
        </header>
        {children}
      </div>
    </aside>
  )
}

function RecordDetailTabs({
  className,
  "aria-label": ariaLabel = "Secciones del registro",
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="record-detail-tabs"
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "flex gap-5 border-b border-ds-border text-[length:var(--ds-text-xs)] font-semibold text-ds-text-secondary",
        className
      )}
      {...props}
    />
  )
}

function RecordDetailTab({
  className,
  active = false,
  disabled = false,
  ...props
}: React.ComponentProps<"button"> & { active?: boolean }) {
  return (
    <button
      type="button"
      data-slot="record-detail-tab"
      data-active={active}
      role="tab"
      aria-selected={active}
      disabled={disabled}
      className={cn(
        "h-10 border-b-2 border-transparent text-left transition-colors hover:text-ds-primary data-[active=true]:border-ds-primary data-[active=true]:text-ds-primary",
        controlFocusRing,
        controlDisabled,
        className
      )}
      {...props}
    />
  )
}

function RecordDetailSection({
  className,
  ...props
}: React.ComponentProps<"section">) {
  return (
    <section
      data-slot="record-detail-section"
      className={cn("min-w-0", className)}
      {...props}
    />
  )
}

function RecordDetailActions({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="record-detail-actions"
      className={cn(
        "grid grid-cols-1 gap-2 border-t border-ds-border-soft pt-3 sm:grid-cols-2",
        className
      )}
      {...props}
    />
  )
}

function VerifiedSourceBadge({
  children = "Fuente verificada",
  ...props
}: Omit<StatusBadgeProps, "variant">) {
  return (
    <StatusBadge variant="verified" {...props}>
      {children}
    </StatusBadge>
  )
}

export {
  RecordDetailPanel,
  RecordDetailTabs,
  RecordDetailTab,
  RecordDetailSection,
  RecordDetailActions,
  VerifiedSourceBadge,
  type RecordDetailPanelProps,
}
