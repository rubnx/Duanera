import { NextResponse } from "next/server"

import { db } from "@/db/client"
import { reconstructTradeRecordSourceRow } from "@/sources/source-row-reconstruction"
import { loadOperationalCodeLabelMaps } from "@/trade/trade-record-operational-code-labels"
import { enrichTradeRecordWithLabels } from "@/trade/trade-record-labels"
import { loadTradeRecordLogisticsPartyLinks } from "@/trade/trade-record-logistics-links"
import { operationalSourceFieldGroups } from "@/trade/trade-record-operational-fields"
import { getTradeRecordById } from "@/trade/trade-records"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const record = await getTradeRecordById(db, id, { productFacing: true })

  if (!record) {
    return NextResponse.json({ error: "Registro no encontrado." }, { status: 404 })
  }

  const sourceRow = await reconstructTradeRecordSourceRow(db, record)
  const [operationalCodeLabelMaps, enrichedRecord, logisticsPartyLinks] = await Promise.all([
    loadOperationalCodeLabelMaps(db),
    enrichTradeRecordWithLabels(db, record),
    loadTradeRecordLogisticsPartyLinks(db, record.id),
  ])
  const operationalSourceFields = operationalSourceFieldGroups(
    record.tradeFlow,
    sourceRow.rawValues,
    operationalCodeLabelMaps,
  )

  return NextResponse.json({
    data: {
      ...enrichedRecord,
      rawText: sourceRow.rawText,
      rawValues: sourceRow.rawValues,
      logisticsPartyLinks,
      operationalSourceFields,
      sourceReconstruction: {
        status: sourceRow.status,
        verified: sourceRow.verified,
        message: sourceRow.message,
      },
    },
  })
}
