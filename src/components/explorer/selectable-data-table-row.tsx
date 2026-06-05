"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { DataTableRow } from "@/components/explorer/data-table-shell"
import { useExplorerDrawer } from "@/components/explorer/explorer-drawer-context"

type SelectableDataTableRowProps = Omit<
  React.ComponentProps<typeof DataTableRow>,
  "interactive" | "onClick" | "onKeyDown"
> & {
  href: string
  recordId: string
}

function SelectableDataTableRow({
  href,
  recordId,
  children,
  ...props
}: SelectableDataTableRowProps) {
  const router = useRouter()
  const drawer = useExplorerDrawer()
  const rowRef = React.useRef<HTMLTableRowElement>(null)
  const selected = drawer ? drawer.selectedId === recordId : props.selected

  function openDetail() {
    if (drawer) {
      if (drawer.selectedId === recordId) {
        drawer.closeDrawer()
        return
      }

      drawer.openRecord(recordId)
      return
    }

    router.push(href, { scroll: false })
  }

  function shouldIgnoreRowActivation(target: EventTarget | null) {
    return (
      target instanceof Element &&
      Boolean(
        target.closest(
          "a, button, input, select, textarea, summary, [role='button'], [data-row-action='ignore']"
        )
      )
    )
  }

  React.useEffect(() => {
    if (!drawer || drawer.selectedId || drawer.focusReturnRecordId !== recordId) {
      return
    }

    drawer.clearFocusReturnRecord(recordId)
    window.requestAnimationFrame(() => {
      rowRef.current?.focus({ preventScroll: true })
    })
  }, [drawer, recordId])

  function handleKeyDown(event: React.KeyboardEvent<HTMLTableRowElement>) {
    if (event.key !== "Enter" && event.key !== " ") {
      return
    }

    if (shouldIgnoreRowActivation(event.target)) {
      return
    }

    event.preventDefault()
    openDetail()
  }

  return (
    <DataTableRow
      {...props}
      aria-controls={selected && drawer ? drawer.drawerId : props["aria-controls"]}
      aria-expanded={selected || undefined}
      data-explorer-record-row="true"
      ref={rowRef}
      interactive
      onClick={(event) => {
        if (shouldIgnoreRowActivation(event.target)) {
          return
        }

        openDetail()
      }}
      onKeyDown={handleKeyDown}
      selected={selected}
    >
      {children}
    </DataTableRow>
  )
}

export { SelectableDataTableRow, type SelectableDataTableRowProps }
