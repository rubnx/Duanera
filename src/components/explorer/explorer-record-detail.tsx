"use client"

import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  DatabaseIcon,
  FileTextIcon,
  HelpCircleIcon,
  PackageIcon,
  ShieldCheckIcon,
  XIcon,
} from "lucide-react"
import Link from "next/link"
import * as React from "react"

import { CountryFlag } from "@/components/common/country-flag"
import {
  OriginalRowPreview,
  RecordDetailActions,
  RecordDetailPanel,
  RecordDetailSection,
  RecordDetailTab,
  RecordDetailTabs,
  SourceTraceabilityCard,
  type SourceTraceabilityField,
} from "@/components/explorer"
import { useExplorerDrawer } from "@/components/explorer/explorer-drawer-context"
import { buttonVariants } from "@/components/ui/button"
import {
  FieldGroup,
  FieldGroupItem,
  FieldLabel,
  FieldValue,
} from "@/components/ui/field-group"
import { StatusBadge, type StatusBadgeProps } from "@/components/ui/status-badge"
import { cn } from "@/lib/utils"
import { sourceFilenameLabel } from "@/sources/source-provenance-helpers"
import {
  productAttributeDisplayFromRaw,
  productDisplayFromRaw,
  type ProductAttributeDisplay,
  type ProductDisplay,
} from "@/trade/trade-record-display"
import {
  isConfirmedLegalParticipantEntity,
  normalizeTradeParticipantName,
  participantDisplaySubtitle,
  participantDisplayNameWithFlag,
  type TradeParticipantDisplay,
} from "@/trade/trade-participant-display"
import {
  formatTradeCodeLabel,
  formatTradeDisplayCodeLabel,
  formatTradeQuantityDisplay,
  type TradeDisplayCodeKind,
} from "@/trade/trade-record-format"
import { formatTradeFlowLabel } from "@/trade/trade-flow-ui"
import {
  formatDetailMoneyValue,
  formatDetailWeightKg,
  promotedLogisticsOperationalSourceFields,
} from "@/trade/trade-record-detail-display"
import { buildTradeParticipantProfileHref } from "@/trade/trade-record-links"
import { formatTradeRecordPeriodValue } from "@/trade/trade-record-periods"
import {
  formatPayloadRetentionMode,
  formatPayloadStorageKind,
} from "@/trade/trade-record-provenance"
import type { TradeRecordWithLabels } from "@/trade/trade-record-labels"
import type { TradeRecordLogisticsPartyLink } from "@/trade/trade-record-logistics-links"
import type {
  OperationalSourceField,
  OperationalSourceFieldGroup,
} from "@/trade/trade-record-operational-fields"
import type { TradeRecordDetail } from "@/trade/trade-records"

type SourceReconstructionStatus =
  | "postgres"
  | "local"
  | "r2"
  | "unavailable"
  | "hash_mismatch"

type ExplorerDetailRecord = TradeRecordWithLabels<TradeRecordDetail> & {
  logisticsPartyLinks?: TradeRecordLogisticsPartyLink[]
  operationalSourceFields?: OperationalSourceFieldGroup[]
  sourceReconstruction?: {
    status: SourceReconstructionStatus
    verified: boolean
    message: string
  }
}

type DetailField = {
  label: React.ReactNode
  value: React.ReactNode
  always?: boolean
  className?: string
  help?: string
  muted?: boolean
  numeric?: boolean
}

type DetailFetchState =
  | { status: "idle" }
  | { status: "loading"; recordId: string }
  | { status: "success"; record: ExplorerDetailRecord }
  | { status: "error"; error: string; recordId: string }

type SourceParticipantNameEntry = {
  fieldName: string
  label: string
  logisticsPartyLink: TradeRecordLogisticsPartyLink | undefined
  participant: TradeParticipantDisplay
}

const detailTabs = [
  { id: "summary", label: "Resumen" },
  { id: "participants", label: "IDs Aduana" },
  { id: "goods", label: "Producto" },
  { id: "values", label: "Valores" },
  { id: "logistics", label: "Logística" },
  { id: "source", label: "Trazabilidad" },
] as const

type DetailTabId = (typeof detailTabs)[number]["id"]

const sourceParticipantFieldLabels: Record<string, string> = {
  GNOM_CIA_T: "Compañía de transporte",
  NOMBRECIATRANSP: "Compañía de transporte",
  NOMEMISOR: "Emisor documento transporte",
  NOMBREEMISORDOCTRANSP: "Emisor documento transporte",
}

const sourceParticipantFieldOrder = [
  "GNOM_CIA_T",
  "NOMBRECIATRANSP",
  "NOMEMISOR",
  "NOMBREEMISORDOCTRANSP",
]

function periodLabel(record: Pick<ExplorerDetailRecord, "periodYear" | "periodMonth">) {
  return formatTradeRecordPeriodValue(record.periodYear, record.periodMonth)
}

function itemValue(record: ExplorerDetailRecord) {
  if (record.tradeFlow === "export") {
    return {
      help: "Valor FOB declarado para el ítem exportado, sin flete ni seguro internacional.",
      label: "Valor FOB",
      value: formatDetailMoneyValue(record.itemFobValue, record.decodedLabels.currency),
    }
  }

  return {
    help: "Valor CIF declarado para el ítem importado, incluyendo costo, seguro y flete.",
    label: "Valor CIF",
    value: formatDetailMoneyValue(record.itemCifValue, record.decodedLabels.currency),
  }
}

function formatQuantityDisplay(record: ExplorerDetailRecord) {
  return formatTradeQuantityDisplay(
    record.quantity,
    record.quantityUnitCode,
    record.decodedLabels.quantityUnit
  )
}

function isDisplayableFieldValue(value: React.ReactNode) {
  return value !== null && value !== undefined && value !== "" && value !== "No informado"
}

function formatKnownCodeLabel(
  code: string | null,
  label: string | undefined,
  missingLabel: string,
  kind: TradeDisplayCodeKind = "generic"
) {
  if (!code && !label) {
    return "No informado"
  }

  return formatTradeDisplayCodeLabel({
    code,
    fallback: code ? `Código ${code}` : missingLabel,
    kind,
    label,
  })
}

function customsOfficeForRecord(record: ExplorerDetailRecord) {
  return formatKnownCodeLabel(
    record.customsOfficeCode,
    record.decodedLabels.customsOffice,
    "aduana sin etiqueta",
    "customsOffice"
  )
}

function transportModeForRecord(record: ExplorerDetailRecord) {
  return formatKnownCodeLabel(
    record.transportModeCode,
    record.decodedLabels.transportMode,
    "vía sin etiqueta",
    "transportMode"
  )
}

function cargoTypeForRecord(record: ExplorerDetailRecord) {
  return formatKnownCodeLabel(
    record.cargoTypeCode,
    record.decodedLabels.cargoType,
    "tipo sin etiqueta",
    "cargoType"
  )
}

function originCountryForRecord(record: ExplorerDetailRecord) {
  return formatKnownCodeLabel(
    record.originCountryCode,
    record.decodedLabels.originCountry,
    "país sin etiqueta",
    "country"
  )
}

function acquisitionCountryForRecord(record: ExplorerDetailRecord) {
  return formatKnownCodeLabel(
    record.acquisitionCountryCode,
    record.decodedLabels.acquisitionCountry,
    "país sin etiqueta",
    "country"
  )
}

function consignmentCountryForRecord(record: ExplorerDetailRecord) {
  return formatKnownCodeLabel(
    record.consignmentCountryCode,
    record.decodedLabels.consignmentCountry,
    "país sin etiqueta",
    "country"
  )
}

function destinationCountryForRecord(record: ExplorerDetailRecord) {
  return formatKnownCodeLabel(
    record.destinationCountryCode,
    record.decodedLabels.destinationCountry,
    "país sin etiqueta",
    "country"
  )
}

function countryForFlow(record: ExplorerDetailRecord) {
  if (record.tradeFlow === "export") {
    return destinationCountryForRecord(record)
  }

  return originCountryForRecord(record)
}

function countryLabelForFlow(record: ExplorerDetailRecord) {
  return record.tradeFlow === "export" ? "País destino" : "País origen"
}

function countryCodeForFlow(record: ExplorerDetailRecord) {
  return record.tradeFlow === "export"
    ? record.destinationCountryCode
    : record.originCountryCode
}

function CountryValue({
  countryCode,
  countryName,
}: {
  countryCode?: string | null
  countryName: string
}) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <CountryFlag countryCode={countryCode} countryName={countryName} />
      <span className="truncate">{countryName}</span>
    </span>
  )
}

function countryFieldValue(countryCode: string | null, countryName: string) {
  if (!countryCode && countryName === "No informado") {
    return null
  }

  return <CountryValue countryCode={countryCode} countryName={countryName} />
}

function portForFlow(record: ExplorerDetailRecord) {
  if (record.tradeFlow === "export") {
    return {
      label: "Puerto embarque",
      value: formatKnownCodeLabel(
        record.embarkPortCode,
        record.decodedLabels.embarkPort,
        "puerto sin etiqueta",
        "port"
      ),
    }
  }

  return {
    label: "Puerto desembarque",
    value: formatKnownCodeLabel(
      record.disembarkPortCode,
      record.decodedLabels.disembarkPort,
      "puerto sin etiqueta",
      "port"
    ),
  }
}

function sourceFileDisplayName(record: ExplorerDetailRecord) {
  const filename = sourceFilenameLabel(record.sourceFilename) ?? record.sourceFilename
  return filename?.trim() || "Archivo fuente no informado"
}

function sourceCodeField({
  code,
  id,
  label,
  sourceLabel,
}: {
  code: string | null
  id: string
  label: string
  sourceLabel?: string
}) {
  if (!code && !sourceLabel) {
    return null
  }

  return {
    id,
    icon: <DatabaseIcon aria-hidden="true" />,
    label,
    value: formatTradeCodeLabel(code, sourceLabel, "No informado"),
  }
}

function productSourceFragmentFields(
  product: ProductDisplay,
  attributes: ProductAttributeDisplay,
) {
  const fields: SourceTraceabilityField[] = []

  if (product.raw) {
    fields.push({
      id: "source-product-raw",
      icon: <DatabaseIcon aria-hidden="true" />,
      label: "Texto fuente exacto",
      value: product.raw,
    })
  }

  for (const fragment of attributes.fragments) {
    fields.push({
      id: `source-product-attribute-${fragment.key.toLowerCase()}`,
      icon: <DatabaseIcon aria-hidden="true" />,
      label: `${fragment.label} exacta (${fragment.key})`,
      value: fragment.rawValue,
    })
  }

  return fields
}

function participantForFlow(record: ExplorerDetailRecord) {
  if (record.tradeFlow === "export") {
    return {
      label: "ID exportador",
      helper: "ID Aduana",
      profileRole: "exporter" as const,
      value:
        record.exporterPrimaryCorrelativeId ??
        record.exporterSecondaryCorrelativeId ??
        null,
    }
  }

  return {
    label: "ID importador",
    helper: "ID Aduana",
    profileRole: "importer" as const,
    value: record.importerCorrelativeId,
  }
}

function ParticipantIdLink({
  participant,
}: {
  participant: ReturnType<typeof participantForFlow>
}) {
  if (!participant.value) {
    return null
  }

  return (
    <Link
      className="inline-flex max-w-full truncate font-mono font-semibold text-ds-text-primary underline-offset-4 hover:text-ds-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-focus-ring/30"
      href={buildTradeParticipantProfileHref(
        participant.profileRole,
        participant.value
      )}
    >
      {participant.value}
    </Link>
  )
}

function participantIdFieldValue(participant: ReturnType<typeof participantForFlow>) {
  return participant.value ? <ParticipantIdLink participant={participant} /> : null
}

function sourceIntegrityState(record: ExplorerDetailRecord) {
  const verified =
    record.importBatchStatus === "completed" &&
    record.payloadReconstructable &&
    Boolean(record.sourceFileId && record.importBatchId && record.rawTradeRowId)

  return verified
    ? {
        variant: "verified" as const,
        label: "Fuente verificada",
      }
    : {
        variant: "review" as const,
        label: "Trazabilidad por revisar",
      }
}

function sourceReconstructionLabel(status: SourceReconstructionStatus | undefined) {
  const labels: Record<SourceReconstructionStatus, string> = {
    postgres: "Payload en Postgres",
    local: "Reconstruida desde archivo local",
    r2: "Reconstruida desde R2 privado",
    unavailable: "No disponible",
    hash_mismatch: "Hash no coincide",
  }

  return status ? labels[status] : "No evaluado"
}

function recordReviewReasons(record: ExplorerDetailRecord) {
  const reasons: string[] = []
  const value = itemValue(record)
  const port = portForFlow(record)

  if (!record.hsCodeNormalized) reasons.push("Partida arancelaria normalizada no informada")
  if (record.originCountryCode && !record.decodedLabels.originCountry) {
    reasons.push("Código de país origen sin etiqueta")
  }
  if (record.destinationCountryCode && !record.decodedLabels.destinationCountry) {
    reasons.push("Código de país destino sin etiqueta")
  }
  if (record.customsOfficeCode && !record.decodedLabels.customsOffice) {
    reasons.push("Código de aduana sin etiqueta")
  }
  if (!record.productDescriptionRaw) reasons.push("Descripción de mercancía no informada")
  if (!participantForFlow(record).value) reasons.push(`${participantForFlow(record).label} no informado`)
  if (countryForFlow(record) === "No informado") reasons.push("País principal no informado")
  if (port.value === "No informado") reasons.push(`${port.label} no informado`)
  if (value.value === "No informado") reasons.push(`${value.label} no informado`)
  if (!record.payloadReconstructable) reasons.push("Payload no reconstruible")
  if (record.importBatchStatus !== "completed") reasons.push("Lote de importación no completado")

  return reasons
}

function recordQualityState(record: ExplorerDetailRecord): {
  variant: StatusBadgeProps["variant"]
  label: string
  reasons: string[]
} {
  const reasons = recordReviewReasons(record)

  return reasons.length > 0
    ? { variant: "review", label: "Requiere revisión", reasons }
    : { variant: "verified", label: "Registro consistente", reasons }
}

function hasRawPreview(record: ExplorerDetailRecord) {
  const rawValues =
    record.rawValues && typeof record.rawValues === "object" && !Array.isArray(record.rawValues)
      ? Object.keys(record.rawValues as Record<string, unknown>)
      : []

  return rawValues.length > 0 || Boolean(record.rawText)
}

function rawRecordValues(record: ExplorerDetailRecord) {
  return record.rawValues && typeof record.rawValues === "object" && !Array.isArray(record.rawValues)
    ? (record.rawValues as Record<string, unknown>)
    : null
}

function sourceParticipantNameEntries(record: ExplorerDetailRecord): SourceParticipantNameEntry[] {
  const values = rawRecordValues(record)
  const logisticsPartyLinksByField = new Map(
    (record.logisticsPartyLinks ?? []).map((link) => [link.sourceField, link])
  )

  return sourceParticipantFieldOrder
    .map((fieldName) => {
      const logisticsPartyLink = logisticsPartyLinksByField.get(fieldName)
      const rawValue = values?.[fieldName] ?? logisticsPartyLink?.rawValue
      if (rawValue === null || rawValue === undefined) {
        return null
      }

      const participant = normalizeTradeParticipantName(String(rawValue))
      if (!participant) {
        return null
      }

      return {
        fieldName,
        label: sourceParticipantFieldLabels[fieldName] ?? fieldName,
        logisticsPartyLink,
        participant,
      }
    })
    .filter(
      (
        entry,
      ): entry is SourceParticipantNameEntry => entry !== null,
    )
}

function DetailGroup({
  children,
  className,
  title,
  ...props
}: React.ComponentProps<typeof RecordDetailSection> & {
  children: React.ReactNode
  title: string
}) {
  return (
    <RecordDetailSection className={cn("grid gap-3", className)} {...props}>
      <h3 className="text-[length:var(--ds-text-sm)] font-bold text-ds-text-primary">
        {title}
      </h3>
      {children}
    </RecordDetailSection>
  )
}

function DetailFieldHelp({ help, label }: { help: string; label: React.ReactNode }) {
  const tooltipId = React.useId()

  return (
    <span className="group/help relative inline-flex shrink-0">
      <button
        aria-describedby={tooltipId}
        aria-label={`Qué significa ${label}`}
        className="inline-flex size-3.5 items-center justify-center rounded-ds-xs text-ds-text-muted outline-none transition-colors hover:bg-ds-subtle hover:text-ds-text-primary focus-visible:bg-ds-subtle focus-visible:text-ds-text-primary focus-visible:ring-2 focus-visible:ring-ds-focus-ring/25"
        type="button"
      >
        <HelpCircleIcon aria-hidden="true" className="size-3" />
      </button>
      <span
        id={tooltipId}
        role="tooltip"
        className="pointer-events-none invisible absolute top-full left-0 z-30 mt-1.5 w-64 max-w-[calc(100vw-2rem)] rounded-ds-sm bg-ds-text-primary px-2 py-1.5 text-left text-[11px] leading-tight font-medium whitespace-normal text-ds-text-inverse opacity-0 shadow-ds-md transition-opacity delay-150 group-hover/help:visible group-hover/help:opacity-100 group-focus-within/help:visible group-focus-within/help:opacity-100"
      >
        {help}
      </span>
    </span>
  )
}

function DetailFieldLabel({ field }: { field: DetailField }) {
  return (
    <FieldLabel>
      <span className="inline-flex min-w-0 items-center gap-1.5">
        <span className="min-w-0">{field.label}</span>
        {field.help ? <DetailFieldHelp help={field.help} label={field.label} /> : null}
      </span>
    </FieldLabel>
  )
}

function DetailFields({
  columns = 2,
  emptyMessage = "No hay campos adicionales disponibles para esta sección.",
  fields,
}: {
  columns?: 1 | 2 | 3
  emptyMessage?: React.ReactNode
  fields: Array<DetailField | null>
}) {
  const visibleFields = fields.filter(
    (field): field is DetailField =>
      field !== null && (field.always || isDisplayableFieldValue(field.value))
  )

  if (visibleFields.length === 0) {
    return (
      <p className="rounded-ds-md border border-ds-border-soft bg-ds-subtle px-3 py-2 text-ds-xs text-ds-text-muted">
        {emptyMessage}
      </p>
    )
  }

  return (
    <FieldGroup columns={columns}>
      {visibleFields.map((field) => (
        <FieldGroupItem key={String(field.label)} className={field.className}>
          <DetailFieldLabel field={field} />
          <FieldValue muted={field.muted} numeric={field.numeric}>
            {field.value}
          </FieldValue>
        </FieldGroupItem>
      ))}
    </FieldGroup>
  )
}

function OperationalSourceFields({
  groups,
  logisticsPartyLinks,
  reconstruction,
}: {
  groups: OperationalSourceFieldGroup[]
  logisticsPartyLinks: TradeRecordLogisticsPartyLink[]
  reconstruction: ExplorerDetailRecord["sourceReconstruction"]
}) {
  if (groups.length === 0) {
    return (
      <div className="mt-5 rounded-ds-lg border border-ds-border-soft bg-ds-subtle p-4 text-ds-sm text-ds-text-secondary">
        Campos operativos de fuente no disponibles para este registro.{" "}
        {reconstruction?.message}
      </div>
    )
  }

  return (
    <div className="mt-5 grid gap-3">
      <div className="min-w-0">
        <h4 className="text-ds-sm font-semibold text-ds-text-primary">
          Campos operativos de fuente
        </h4>
        <p className="mt-1 text-ds-xs text-ds-text-muted">
          Campos leídos desde la fila Aduana preservada. No son identidad legal de
          importador/exportador.
        </p>
      </div>
      {groups.map((group) => (
        <section
          key={group.key}
          className="rounded-ds-md border border-ds-border-soft bg-ds-surface p-3"
        >
          <h5 className="text-ds-xs font-semibold uppercase text-ds-text-muted">
            {group.title}
          </h5>
          <dl className="mt-3 grid gap-2">
            {group.fields.map((field) => {
              const logisticsPartyLink = logisticsPartyLinks.find(
                (link) => link.sourceField === field.sourceField
              )

              return (
                <div
                  key={`${group.key}:${field.key}:${field.sourceField}`}
                  className="grid grid-cols-[minmax(120px,0.42fr)_minmax(0,1fr)] gap-3 text-ds-xs"
                >
                  <dt className="text-ds-text-muted">
                    {field.label}
                    <span className="ml-1 font-mono text-[10px] text-ds-text-muted/80">
                      {field.sourceField}
                    </span>
                  </dt>
                  <dd className="break-words font-medium text-ds-text-primary">
                    {logisticsPartyLink ? (
                      <Link
                        className="text-ds-link underline-offset-2 hover:underline focus-visible:ring-3 focus-visible:ring-ds-focus-ring/20 focus-visible:outline-none"
                        href={logisticsPartyLink.href}
                      >
                        {field.value}
                      </Link>
                    ) : (
                      field.value
                    )}
                  </dd>
                </div>
              )
            })}
          </dl>
        </section>
      ))}
    </div>
  )
}

function OperationalFieldDisplayValue({
  field,
  logisticsPartyLinks,
}: {
  field: OperationalSourceField
  logisticsPartyLinks: TradeRecordLogisticsPartyLink[]
}) {
  const logisticsPartyLink = logisticsPartyLinks.find(
    (link) => link.sourceField === field.sourceField
  )

  if (!logisticsPartyLink) {
    return field.value
  }

  return (
    <Link
      className="text-ds-link underline-offset-2 hover:underline focus-visible:ring-3 focus-visible:ring-ds-focus-ring/20 focus-visible:outline-none"
      href={logisticsPartyLink.href}
    >
      {logisticsPartyLink.displayName}
    </Link>
  )
}

function ParticipantNameDisplay({
  label,
  logisticsPartyLink,
  participant,
}: {
  label: string
  logisticsPartyLink?: TradeRecordLogisticsPartyLink
  participant: TradeParticipantDisplay
}) {
  const confirmed = isConfirmedLegalParticipantEntity(participant)

  return (
    <div
      className={cn(
        "rounded-ds-md border px-3 py-2.5",
        participant.isAmbiguous
          ? "border-ds-warning-border bg-ds-warning-soft/70"
          : confirmed
            ? "border-ds-success-border bg-ds-success-softer/70"
            : "border-ds-border-soft bg-ds-subtle",
      )}
    >
      <div className="text-ds-xs font-medium text-ds-text-muted">{label}</div>
      <div className="mt-1 font-semibold text-ds-text-primary">
        {logisticsPartyLink ? (
          <Link
            className="text-ds-link underline-offset-2 hover:underline focus-visible:ring-3 focus-visible:ring-ds-focus-ring/20 focus-visible:outline-none"
            href={logisticsPartyLink.href}
          >
            {participantDisplayNameWithFlag(participant)}
          </Link>
        ) : (
          participantDisplayNameWithFlag(participant)
        )}
      </div>
      <div
        className={cn(
          "mt-1 text-ds-xs",
          participant.isAmbiguous ? "text-ds-warning" : "text-ds-text-secondary",
        )}
      >
        {logisticsPartyLink
          ? `Página logística: ${logisticsPartyLink.displayName}`
          : participantDisplaySubtitle(participant)}
      </div>
    </div>
  )
}

function RawPreview({ record }: { record: ExplorerDetailRecord }) {
  const rawValues =
    record.rawValues && typeof record.rawValues === "object" && !Array.isArray(record.rawValues)
      ? Object.entries(record.rawValues as Record<string, unknown>).slice(0, 6)
      : []

  if (rawValues.length === 0 && !record.rawText) {
    return (
      <OriginalRowPreview className="text-ds-text-secondary">
        Vista original no disponible en Postgres. Usar archivo fuente y fila original.
      </OriginalRowPreview>
    )
  }

  return (
    <OriginalRowPreview>
      {rawValues.length > 0 ? (
        <dl className="grid gap-2">
          {rawValues.map(([key, value]) => (
            <div key={key} className="grid grid-cols-[92px_minmax(0,1fr)] gap-2">
              <dt className="truncate text-ds-text-muted">{key}</dt>
              <dd className="truncate font-medium text-ds-text-primary">
                {value === null || value === undefined ? "No informado" : String(value)}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <pre className="max-h-36 overflow-hidden whitespace-pre-wrap break-words font-sans text-ds-xs">
          {record.rawText}
        </pre>
      )}
    </OriginalRowPreview>
  )
}

function DetailRecordIdentity({
  record,
  value,
}: {
  record: ExplorerDetailRecord
  value: ReturnType<typeof itemValue>
}) {
  const hsCode = record.hsCodeNormalized ?? record.hsCodeRaw

  return (
    <div className="grid gap-2 text-[length:var(--ds-text-xs)] text-ds-text-muted">
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        <span>{formatTradeFlowLabel(record.tradeFlow)}</span>
        {hsCode ? <span>Partida arancelaria {hsCode}</span> : null}
        <span>{record.acceptanceDate ?? periodLabel(record)}</span>
      </div>
      <dl className="grid gap-1 sm:grid-cols-2">
        <div className="min-w-0">
          <dt>{countryLabelForFlow(record)}</dt>
          <dd className="truncate font-medium text-ds-text-secondary">
            <CountryValue
              countryCode={countryCodeForFlow(record)}
              countryName={countryForFlow(record)}
            />
          </dd>
        </div>
        <div className="min-w-0">
          <dt>{value.label}</dt>
          <dd className="truncate font-medium tabular-nums text-ds-text-secondary">
            {value.value}
          </dd>
        </div>
      </dl>
    </div>
  )
}

function DrawerCloseButton({
  onClose,
}: {
  onClose: React.MouseEventHandler<HTMLButtonElement>
}) {
  return (
    <button
      aria-label="Cerrar detalle"
      className={cn(buttonVariants({ variant: "ghost", size: "product-icon-sm" }))}
      onClick={onClose}
      type="button"
    >
      <XIcon aria-hidden="true" />
    </button>
  )
}

function ExplorerDetailPanel({
  onClose,
  record,
}: {
  onClose: () => void
  record: ExplorerDetailRecord
}) {
  const product = productDisplayFromRaw(record.productDescriptionRaw)
  const productAttributes = productAttributeDisplayFromRaw(record.productAttributes)
  const productSourceFields = productSourceFragmentFields(product, productAttributes)
  const participant = participantForFlow(record)
  const value = itemValue(record)
  const port = portForFlow(record)
  const sourceState = sourceIntegrityState(record)
  const qualityState = recordQualityState(record)
  const sourceParticipants = sourceParticipantNameEntries(record)
  const operationalGroups = record.operationalSourceFields ?? []
  const logisticsPartyLinks = record.logisticsPartyLinks ?? []
  const promotedOperationalFields =
    promotedLogisticsOperationalSourceFields(operationalGroups)
  const rawPreviewAvailable = hasRawPreview(record)
  const hsCode = record.hsCodeNormalized ?? record.hsCodeRaw
  const participantTabLabel = record.tradeFlow === "export" ? "Exportador" : "Importador"
  const [activeTab, setActiveTab] = React.useState<DetailTabId>("summary")

  React.useEffect(() => {
    setActiveTab("summary")
  }, [record.id])

  const activeTabIndex = detailTabs.findIndex((tab) => tab.id === activeTab)

  function focusTab(tabId: DetailTabId) {
    window.requestAnimationFrame(() => {
      document.getElementById(`explorer-detail-tab-${tabId}`)?.focus()
    })
  }

  function onTabsKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
      return
    }

    event.preventDefault()

    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? detailTabs.length - 1
          : event.key === "ArrowRight"
            ? (activeTabIndex + 1) % detailTabs.length
            : (activeTabIndex - 1 + detailTabs.length) % detailTabs.length
    const nextTab = detailTabs[nextIndex]

    setActiveTab(nextTab.id)
    focusTab(nextTab.id)
  }

  return (
    <RecordDetailPanel
      id="explorer-record-detail-drawer"
      recordId={<DetailRecordIdentity record={record} value={value} />}
      status={<StatusBadge variant={sourceState.variant}>{sourceState.label}</StatusBadge>}
      title={product.title}
      closeAction={<DrawerCloseButton onClose={onClose} />}
    >
      <RecordDetailTabs onKeyDown={onTabsKeyDown}>
        {detailTabs.map((tab) => (
          <RecordDetailTab
            key={tab.id}
            id={`explorer-detail-tab-${tab.id}`}
            active={activeTab === tab.id}
            aria-controls={`explorer-detail-panel-${tab.id}`}
            tabIndex={activeTab === tab.id ? 0 : -1}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.id === "participants" ? participantTabLabel : tab.label}
          </RecordDetailTab>
        ))}
      </RecordDetailTabs>

      {activeTab === "summary" ? (
        <DetailGroup
          id="explorer-detail-panel-summary"
          aria-labelledby="explorer-detail-tab-summary"
          role="tabpanel"
          title="Resumen"
        >
        <DetailFields
          fields={[
            {
              label: "Fecha de aceptación",
              value: record.acceptanceDate ?? periodLabel(record),
              always: true,
            },
            { label: "Régimen", value: formatTradeFlowLabel(record.tradeFlow), always: true },
            {
              label: "Partida arancelaria",
              value: hsCode ? <span className="font-mono">{hsCode}</span> : null,
              always: true,
            },
            {
              label: participant.label,
              value: participantIdFieldValue(participant),
              always: true,
            },
            {
              label: countryLabelForFlow(record),
              value: (
                <CountryValue
                  countryCode={countryCodeForFlow(record)}
                  countryName={countryForFlow(record)}
                />
              ),
              always: true,
            },
            { label: port.label, value: port.value, always: true },
            { label: value.label, value: value.value, always: true, numeric: true },
            { label: "Cantidad", value: formatQuantityDisplay(record) },
            {
              label: "Estado del registro",
              value: (
                <StatusBadge variant={qualityState.variant} size="sm">
                  {qualityState.label}
                </StatusBadge>
              ),
              always: true,
            },
          ]}
        />
        <div
          className={cn(
            "mt-5 rounded-ds-lg border p-4 text-[length:var(--ds-text-sm)]",
            qualityState.variant === "review"
              ? "border-ds-warning-border bg-ds-warning-soft text-ds-warning"
              : "border-ds-success-border bg-ds-success-softer text-ds-success"
          )}
        >
          <div className="flex items-center gap-2 font-semibold">
            {qualityState.variant === "review" ? (
              <AlertTriangleIcon aria-hidden="true" className="size-(--ds-icon-sm)" />
            ) : (
              <CheckCircle2Icon aria-hidden="true" className="size-(--ds-icon-sm)" />
            )}
            {qualityState.label}
          </div>
          {qualityState.reasons.length > 0 ? (
            <ul className="mt-2 grid gap-1 text-ds-xs">
              {qualityState.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-ds-xs">Campos críticos presentes según el esquema actual.</p>
          )}
        </div>
        </DetailGroup>
      ) : null}

      {activeTab === "participants" ? (
        <DetailGroup
          id="explorer-detail-panel-participants"
          aria-labelledby="explorer-detail-tab-participants"
          role="tabpanel"
          title={participantTabLabel}
        >
        <DetailFields
          fields={[
            {
              label: participant.label,
              value: participantIdFieldValue(participant),
              always: true,
            },
            {
              label: "Tipo de identificador",
              value: "ID Aduana anónimo",
              always: true,
              muted: true,
            },
          ]}
        />
        <p className="mt-3 rounded-ds-md border border-ds-border-soft bg-ds-subtle px-3 py-2 text-ds-xs leading-(--ds-leading-normal) text-ds-text-muted">
          El registro no contiene nombre legal ni RUT verificado para importador o
          exportador. No se muestran identidades inferidas.
        </p>
        {sourceParticipants.length > 0 ? (
          <div className="mt-5 grid gap-2">
            <h4 className="text-ds-sm font-semibold text-ds-text-primary">
              Nombres del documento fuente
            </h4>
            <p className="text-ds-xs leading-(--ds-leading-normal) text-ds-text-muted">
              Estos nombres vienen de campos logísticos o documentales de la fuente;
              no son identidad legal del importador/exportador.
            </p>
            <div className="grid gap-2">
              {sourceParticipants.map((entry) => (
                <ParticipantNameDisplay
                  key={entry.fieldName}
                  label={entry.label}
                  logisticsPartyLink={entry.logisticsPartyLink}
                  participant={entry.participant}
                />
              ))}
            </div>
          </div>
        ) : null}
        </DetailGroup>
      ) : null}

      {activeTab === "goods" ? (
        <DetailGroup
          id="explorer-detail-panel-goods"
          aria-labelledby="explorer-detail-tab-goods"
          role="tabpanel"
          title="Producto"
        >
        <DetailFields
          emptyMessage="No hay campos de producto adicionales disponibles."
          fields={[
            {
              label: "Partida arancelaria",
              value: hsCode ? <span className="font-mono">{hsCode}</span> : null,
              always: true,
            },
            { label: "Producto", value: product.title, always: true },
            { label: "Referencia fuente", value: product.sourceReference },
            { label: "Cantidad", value: formatQuantityDisplay(record) },
          ]}
        />

        {product.description ||
        productAttributes.descriptor ||
        productAttributes.format ||
        productAttributes.complementaryDescription ? (
          <div className="mt-5 rounded-ds-lg border border-ds-border-soft bg-ds-subtle p-4">
            <h4 className="text-ds-sm font-semibold text-ds-text-primary">
              Descripción fuente
            </h4>
            {product.description ? (
              <p className="mt-2 text-ds-sm leading-(--ds-leading-normal) text-ds-text-secondary">
                {product.description}
              </p>
            ) : null}
            {productAttributes.descriptor ||
            productAttributes.format ||
            productAttributes.complementaryDescription ? (
              <dl className="mt-3 grid gap-2">
                {[
                  productAttributes.descriptor
                    ? {
                        label: "Marca / descriptor",
                        value: productAttributes.descriptor,
                      }
                    : null,
                  productAttributes.format
                    ? {
                        label: "Formato / medidas",
                        value: productAttributes.format,
                      }
                    : null,
                  productAttributes.complementaryDescription
                    ? {
                        label: "Descripción complementaria",
                        value: productAttributes.complementaryDescription,
                      }
                    : null,
                ]
                  .filter((attribute): attribute is { label: string; value: string } => attribute !== null)
                  .map((attribute) => (
                    <div
                      key={`${attribute.label}:${attribute.value}`}
                      className="grid grid-cols-[150px_minmax(0,1fr)] gap-3 text-ds-xs"
                    >
                      <dt className="text-ds-text-muted">{attribute.label}</dt>
                      <dd className="break-words font-medium text-ds-text-primary">
                        {attribute.value}
                      </dd>
                    </div>
                  ))}
              </dl>
            ) : null}
          </div>
        ) : null}
        </DetailGroup>
      ) : null}

      {activeTab === "values" ? (
        <DetailGroup
          id="explorer-detail-panel-values"
          aria-labelledby="explorer-detail-tab-values"
          role="tabpanel"
          title="Valores"
        >
        <DetailFields
          emptyMessage="No hay valores adicionales disponibles para este registro."
          fields={[
            {
              label: value.label,
              value: value.value,
              always: true,
              help: value.help,
              numeric: true,
            },
            { label: "Cantidad", value: formatQuantityDisplay(record), numeric: true },
            {
              label: "FOB total",
              value: formatDetailMoneyValue(record.declarationFobValue, record.decodedLabels.currency),
              help: "Valor FOB total declarado para la operación o declaración completa.",
              numeric: true,
            },
            {
              label: "CIF total",
              value: formatDetailMoneyValue(record.cifValue, record.decodedLabels.currency),
              help: "Valor CIF total de la operación cuando la fuente lo informa.",
              numeric: true,
            },
            {
              label: "Flete",
              value: formatDetailMoneyValue(record.freightValue, record.decodedLabels.currency),
              help: "Costo de transporte internacional declarado en la operación.",
              numeric: true,
            },
            {
              label: "Seguro",
              value: formatDetailMoneyValue(record.insuranceValue, record.decodedLabels.currency),
              help: "Costo de seguro declarado para la operación.",
              numeric: true,
            },
            {
              label: "Precio unitario",
              value: formatDetailMoneyValue(record.unitPriceValue, record.decodedLabels.currency),
              help: "Valor por unidad declarada o calculada según la fuente normalizada.",
              numeric: true,
            },
            {
              label: "Peso bruto ítem",
              value: formatDetailWeightKg(record.grossWeightItem),
              help: "Peso bruto informado para el ítem. En importaciones este campo puede no venir en la fuente.",
              numeric: true,
            },
            {
              label: "Peso bruto total",
              value: formatDetailWeightKg(record.grossWeightTotal),
              help: "Peso bruto total de la operación, expresado en kilogramos.",
              numeric: true,
            },
          ]}
        />
        </DetailGroup>
      ) : null}

      {activeTab === "logistics" ? (
        <DetailGroup
          id="explorer-detail-panel-logistics"
          aria-labelledby="explorer-detail-tab-logistics"
          role="tabpanel"
          title="Logística"
        >
        <DetailFields
          emptyMessage="No hay campos logísticos adicionales disponibles para este registro."
          fields={[
            {
              label: "País origen",
              value: countryFieldValue(
                record.originCountryCode,
                originCountryForRecord(record)
              ),
            },
            {
              label: "País adquisición",
              value: countryFieldValue(
                record.acquisitionCountryCode,
                acquisitionCountryForRecord(record)
              ),
            },
            {
              label: "País consignación",
              value: countryFieldValue(
                record.consignmentCountryCode,
                consignmentCountryForRecord(record)
              ),
            },
            {
              label: "País destino",
              value: countryFieldValue(
                record.destinationCountryCode,
                destinationCountryForRecord(record)
              ),
            },
            { label: "Aduana", value: customsOfficeForRecord(record), always: true },
            {
              label: "Puerto embarque",
              value: formatKnownCodeLabel(
                record.embarkPortCode,
                record.decodedLabels.embarkPort,
                "puerto sin etiqueta",
                "port"
              ),
            },
            {
              label: "Puerto desembarque",
              value: formatKnownCodeLabel(
                record.disembarkPortCode,
                record.decodedLabels.disembarkPort,
                "puerto sin etiqueta",
                "port"
              ),
            },
            { label: "Vía de transporte", value: transportModeForRecord(record) },
            { label: "Tipo de carga", value: cargoTypeForRecord(record) },
            ...promotedOperationalFields.map((promotedField) => ({
              label: promotedField.label,
              value: (
                <OperationalFieldDisplayValue
                  field={promotedField.field}
                  logisticsPartyLinks={logisticsPartyLinks}
                />
              ),
              help: promotedField.help,
            })),
          ]}
        />
        <OperationalSourceFields
          groups={operationalGroups}
          logisticsPartyLinks={logisticsPartyLinks}
          reconstruction={record.sourceReconstruction}
        />
        </DetailGroup>
      ) : null}

      {activeTab === "source" ? (
        <RecordDetailSection
          id="explorer-detail-panel-source"
          aria-labelledby="explorer-detail-tab-source"
          role="tabpanel"
        >
          <SourceTraceabilityCard
            fields={[
              {
                id: "source",
                icon: <FileTextIcon aria-hidden="true" />,
                label: "Archivo fuente",
                value: sourceFileDisplayName(record),
              },
              {
                id: "row",
                icon: <PackageIcon aria-hidden="true" />,
                label: "Fila original",
                value: record.rawRowNumber,
              },
              record.declarationIdRaw
                ? {
                    id: "declaration",
                    icon: <FileTextIcon aria-hidden="true" />,
                    label: "Declaración fuente",
                    value: record.declarationIdRaw,
                  }
                : null,
              record.itemNumber
                ? {
                    id: "item",
                    icon: <PackageIcon aria-hidden="true" />,
                    label: "Ítem declaración",
                    value: record.itemNumber,
                  }
                : null,
              sourceCodeField({
                code: record.originCountryCode,
                id: "source-origin-country",
                label: "País origen fuente",
                sourceLabel: record.decodedLabels.originCountry,
              }),
              sourceCodeField({
                code: record.destinationCountryCode,
                id: "source-destination-country",
                label: "País destino fuente",
                sourceLabel: record.decodedLabels.destinationCountry,
              }),
              sourceCodeField({
                code: record.customsOfficeCode,
                id: "source-customs-office",
                label: "Aduana fuente",
                sourceLabel: record.decodedLabels.customsOffice,
              }),
              sourceCodeField({
                code: record.embarkPortCode,
                id: "source-embark-port",
                label: "Puerto embarque fuente",
                sourceLabel: record.decodedLabels.embarkPort,
              }),
              sourceCodeField({
                code: record.disembarkPortCode,
                id: "source-disembark-port",
                label: "Puerto desembarque fuente",
                sourceLabel: record.decodedLabels.disembarkPort,
              }),
              sourceCodeField({
                code: record.transportModeCode,
                id: "source-transport-mode",
                label: "Vía transporte fuente",
                sourceLabel: record.decodedLabels.transportMode,
              }),
              sourceCodeField({
                code: record.cargoTypeCode,
                id: "source-cargo-type",
                label: "Tipo carga fuente",
                sourceLabel: record.decodedLabels.cargoType,
              }),
              ...productSourceFields,
              ...sourceParticipants.map((entry) => ({
                id: `source-participant-${entry.fieldName.toLowerCase()}`,
                icon: <DatabaseIcon aria-hidden="true" />,
                label: `${entry.label} fuente`,
                value: entry.participant.rawName,
              })),
              {
                id: "batch",
                icon: <DatabaseIcon aria-hidden="true" />,
                label: "Lote de importación",
                value: record.importBatchId,
              },
              {
                id: "parser",
                icon: <ShieldCheckIcon aria-hidden="true" />,
                label: "Parser",
                value: `${record.parserName} ${record.parserVersion}`,
              },
              {
                id: "payload",
                icon: <CheckCircle2Icon aria-hidden="true" />,
                label: "Payload",
                value: `${formatPayloadRetentionMode(record.payloadRetentionMode)} · ${formatPayloadStorageKind(record.payloadStorageKind)}`,
              },
              {
                id: "source-reconstruction",
                icon: <DatabaseIcon aria-hidden="true" />,
                label: "Lectura fila fuente",
                value: record.sourceReconstruction
                  ? `${sourceReconstructionLabel(record.sourceReconstruction.status)} · ${
                      record.sourceReconstruction.verified ? "verificada" : "no verificada"
                    }`
                  : "No evaluado",
              },
              record.payloadHashSha256
                ? {
                    id: "payload-hash",
                    icon: <CheckCircle2Icon aria-hidden="true" />,
                    label: "Hash payload",
                    value: record.payloadHashSha256,
                  }
                : null,
            ].filter((field): field is NonNullable<typeof field> => field !== null)}
            previewVariant={rawPreviewAvailable ? "default" : "compact"}
            preview={<RawPreview record={record} />}
          />
        </RecordDetailSection>
      ) : null}

      <RecordDetailActions>
        <Link
          className={cn(buttonVariants({ variant: "secondary", size: "product-md" }))}
          href={`/sources/${record.sourceFileId}`}
        >
          Ver origen
        </Link>
        <Link
          className={cn(
            buttonVariants({ variant: "secondary", size: "product-md" }),
            "border-ds-primary-soft bg-ds-primary-softer text-ds-primary hover:border-ds-primary-soft hover:bg-ds-primary-soft hover:text-ds-primary-active"
          )}
          href={`/trade-records/${record.id}`}
        >
          Ver registro completo
        </Link>
      </RecordDetailActions>
    </RecordDetailPanel>
  )
}

function DrawerFrame({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-slot="app-shell-detail-overlay"
      className="pointer-events-none fixed inset-0 z-40 lg:left-[var(--ds-sidebar-width)]"
    >
      <div
        data-slot="app-shell-detail"
        className="pointer-events-auto ml-auto h-full w-full bg-ds-surface shadow-ds-panel sm:max-w-[var(--ds-detail-panel-width)]"
      >
        {children}
      </div>
    </div>
  )
}

function DrawerLoadingPanel({ onClose }: { onClose: () => void }) {
  return (
    <RecordDetailPanel
      id="explorer-record-detail-drawer"
      title="Cargando registro"
      closeAction={<DrawerCloseButton onClose={onClose} />}
    >
      <div
        className="rounded-ds-lg border border-ds-border-soft bg-ds-subtle p-4 text-ds-sm text-ds-text-secondary"
        role="status"
      >
        Cargando detalle del registro seleccionado...
      </div>
    </RecordDetailPanel>
  )
}

function DrawerErrorPanel({
  error,
  onClose,
}: {
  error: string
  onClose: () => void
}) {
  return (
    <RecordDetailPanel
      id="explorer-record-detail-drawer"
      title="No se pudo cargar el registro"
      closeAction={<DrawerCloseButton onClose={onClose} />}
    >
      <div className="rounded-ds-lg border border-ds-warning-border bg-ds-warning-soft p-4 text-ds-sm text-ds-warning">
        {error}
      </div>
    </RecordDetailPanel>
  )
}

function ExplorerRecordDetailDrawer() {
  const drawer = useExplorerDrawer()
  const cacheRef = React.useRef(new Map<string, ExplorerDetailRecord>())
  const [state, setState] = React.useState<DetailFetchState>({ status: "idle" })
  const selectedId = drawer?.selectedId ?? null

  React.useEffect(() => {
    if (!selectedId) {
      setState({ status: "idle" })
      return
    }

    const recordId = selectedId
    const cachedRecord = cacheRef.current.get(recordId)
    if (cachedRecord) {
      setState({ status: "success", record: cachedRecord })
      return
    }

    const controller = new AbortController()
    setState({ status: "loading", recordId })

    async function loadRecord() {
      try {
        const response = await fetch(
          `/api/explorer/records/${encodeURIComponent(recordId)}`,
          {
            headers: { Accept: "application/json" },
            signal: controller.signal,
          }
        )
        const payload = (await response.json()) as {
          data?: ExplorerDetailRecord
          error?: string
        }

        if (!response.ok || !payload.data) {
          throw new Error(payload.error ?? "No se pudo cargar el detalle del registro.")
        }

        cacheRef.current.set(recordId, payload.data)
        setState({ status: "success", record: payload.data })
      } catch (error) {
        if (controller.signal.aborted) {
          return
        }

        setState({
          status: "error",
          recordId,
          error:
            error instanceof Error
              ? error.message
              : "No se pudo cargar el detalle del registro.",
        })
      }
    }

    void loadRecord()

    return () => controller.abort()
  }, [selectedId])

  if (!drawer || !selectedId) {
    return null
  }

  if (state.status === "success" && state.record.id === selectedId) {
    return (
      <DrawerFrame>
        <ExplorerDetailPanel record={state.record} onClose={drawer.closeDrawer} />
      </DrawerFrame>
    )
  }

  if (state.status === "error" && state.recordId === selectedId) {
    return (
      <DrawerFrame>
        <DrawerErrorPanel error={state.error} onClose={drawer.closeDrawer} />
      </DrawerFrame>
    )
  }

  return (
    <DrawerFrame>
      <DrawerLoadingPanel onClose={drawer.closeDrawer} />
    </DrawerFrame>
  )
}

export { ExplorerRecordDetailDrawer, type ExplorerDetailRecord }
