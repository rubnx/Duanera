import { NextResponse } from "next/server";

import { db } from "@/db/client";
import { listTradeRecordsForExport } from "@/trade/trade-record-export";
import {
  buildTradeRecordExportXlsx,
  tradeRecordExportXlsxContentType,
  tradeRecordExportXlsxFileName,
} from "@/trade/trade-record-export-xlsx";
import { TradeRecordSearchError } from "@/trade/trade-record-search";
import { summarizeTradeRecords } from "@/trade/trade-records";

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;

  try {
    const { filters, plan, rows } = await listTradeRecordsForExport(db, searchParams);

    if (!plan.allowed) {
      return NextResponse.json(
        {
          error: "La exportación XLSX no está permitida con los filtros actuales.",
          plan,
        },
        { status: 400 },
      );
    }

    const summary = await summarizeTradeRecords(db, filters);
    const workbook = await buildTradeRecordExportXlsx({
      filters,
      plan,
      rows,
      summary,
    });

    return new Response(workbook, {
      headers: {
        "Content-Disposition": `attachment; filename="${tradeRecordExportXlsxFileName(plan)}"`,
        "Content-Type": tradeRecordExportXlsxContentType(),
      },
    });
  } catch (error) {
    if (error instanceof TradeRecordSearchError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    throw error;
  }
}
