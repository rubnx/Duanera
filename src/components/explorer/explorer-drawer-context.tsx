"use client"

import * as React from "react"

type ExplorerDrawerContextValue = {
  drawerId: string
  focusReturnRecordId: string | null
  selectedId: string | null
  clearFocusReturnRecord: (recordId: string) => void
  closeDrawer: (options?: { restoreFocus?: boolean }) => void
  openRecord: (recordId: string) => void
}

const ExplorerDrawerContext =
  React.createContext<ExplorerDrawerContextValue | null>(null)

function selectedIdFromLocation() {
  if (typeof window === "undefined") {
    return null
  }

  return new URL(window.location.href).searchParams.get("selected")
}

function writeSelectedUrl(recordId: string | null) {
  const url = new URL(window.location.href)

  if (recordId) {
    url.searchParams.set("selected", recordId)
  } else {
    url.searchParams.delete("selected")
  }

  window.history.pushState({ selectedRecordId: recordId }, "", url)
}

function ExplorerDrawerProvider({
  children,
  drawerId,
  initialSelectedId = null,
}: {
  children: React.ReactNode
  drawerId: string
  initialSelectedId?: string | null
}) {
  const [selectedId, setSelectedId] = React.useState<string | null>(initialSelectedId)
  const [focusReturnRecordId, setFocusReturnRecordId] = React.useState<string | null>(
    initialSelectedId
  )
  const previousInitialSelectedIdRef = React.useRef(initialSelectedId)

  const openRecord = React.useCallback((recordId: string) => {
    setFocusReturnRecordId(recordId)
    setSelectedId(recordId)
    writeSelectedUrl(recordId)
  }, [])

  const closeDrawer = React.useCallback((options?: { restoreFocus?: boolean }) => {
    const restoreFocus = options?.restoreFocus ?? true

    setSelectedId((currentSelectedId) => {
      if (currentSelectedId && restoreFocus) {
        setFocusReturnRecordId(currentSelectedId)
      }

      return null
    })
    writeSelectedUrl(null)
  }, [])

  const clearFocusReturnRecord = React.useCallback((recordId: string) => {
    setFocusReturnRecordId((currentRecordId) =>
      currentRecordId === recordId ? null : currentRecordId
    )
  }, [])

  React.useEffect(() => {
    if (previousInitialSelectedIdRef.current === initialSelectedId) {
      return
    }

    previousInitialSelectedIdRef.current = initialSelectedId
    setSelectedId(initialSelectedId)
    setFocusReturnRecordId(initialSelectedId)
  }, [initialSelectedId])

  React.useEffect(() => {
    function handlePopState() {
      const nextSelectedId = selectedIdFromLocation()
      setSelectedId(nextSelectedId)
      setFocusReturnRecordId(nextSelectedId)
    }

    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [])

  React.useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented || !selectedId) {
        return
      }

      event.preventDefault()
      closeDrawer({ restoreFocus: false })
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [closeDrawer, selectedId])

  React.useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!selectedId || !(event.target instanceof Element)) {
        return
      }

      const clickedInsideDrawer = event.target.closest('[data-slot="record-detail-panel"]')
      const clickedRecordRow = event.target.closest('[data-explorer-record-row="true"]')

      if (clickedInsideDrawer || clickedRecordRow) {
        return
      }

      closeDrawer({ restoreFocus: false })
    }

    document.addEventListener("pointerdown", handlePointerDown)
    return () => document.removeEventListener("pointerdown", handlePointerDown)
  }, [closeDrawer, selectedId])

  const value = React.useMemo<ExplorerDrawerContextValue>(
    () => ({
      clearFocusReturnRecord,
      closeDrawer,
      drawerId,
      focusReturnRecordId,
      openRecord,
      selectedId,
    }),
    [
      clearFocusReturnRecord,
      closeDrawer,
      drawerId,
      focusReturnRecordId,
      openRecord,
      selectedId,
    ]
  )

  return (
    <ExplorerDrawerContext.Provider value={value}>
      {children}
    </ExplorerDrawerContext.Provider>
  )
}

function useExplorerDrawer() {
  return React.useContext(ExplorerDrawerContext)
}

export { ExplorerDrawerProvider, useExplorerDrawer }
