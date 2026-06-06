"use client"

import { useRef } from "react"

import { ExplorerSortFilterControl } from "@/components/explorer/explorer-primary-filter-controls"

type ExplorerToolbarSortProps = {
  omitParams: string[]
  params: Record<string, string | string[] | undefined>
  value?: string
}

function paramText(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    const joined = value.filter((item) => item.trim()).join(",")
    return joined || undefined
  }

  return value
}

const preservedParamKeys = [
  "tradeFlow",
  "periodFrom",
  "periodTo",
  "q",
  "hsCodePrefix",
  "importer",
  "exporter",
  "originCountry",
  "destinationCountry",
  "customsOffice",
  "transportMode",
  "embarkPort",
  "disembarkPort",
  "cargoType",
  "logisticsParty",
  "logisticsRole",
  "view",
  "ranking",
  "minItemValue",
  "maxItemValue",
  "minDeclarationFob",
  "maxDeclarationFob",
  "minQuantity",
  "maxQuantity",
  "minGrossWeightItem",
  "maxGrossWeightItem",
  "minGrossWeightTotal",
  "maxGrossWeightTotal",
  "sourceFileId",
  "importBatchId",
] as const

function ExplorerToolbarSort({
  omitParams,
  params,
  value,
}: ExplorerToolbarSortProps) {
  const formRef = useRef<HTMLFormElement>(null)

  return (
    <form
      ref={formRef}
      action="/explorer"
      className="flex min-w-0 items-center"
    >
      {preservedParamKeys.map((key) => {
        if (omitParams.includes(key)) {
          return null
        }

        const raw = paramText(params[key])
        if (!raw) {
          return null
        }

        return <input key={key} type="hidden" name={key} value={raw} />
      })}
      <ExplorerSortFilterControl
        className="w-[10.5rem] [&_button]:h-7 [&_button]:text-ds-xs"
        hideLabel
        value={value}
        onValueChange={() => {
          window.requestAnimationFrame(() => {
            formRef.current?.requestSubmit()
          })
        }}
      />
    </form>
  )
}

export { ExplorerToolbarSort }
