import { NextResponse } from "next/server";

import { db } from "@/db/client";
import {
  buildTradeRecordExportCsv,
  listTradeRecordsForExport,
} from "@/trade/trade-record-export";
import { TradeRecordSearchError } from "@/trade/trade-record-search";

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;

  try {
    const { plan, rows } = await listTradeRecordsForExport(db, searchParams);

    if (!plan.allowed) {
      return NextResponse.json(
        {
          error: "La exportación no está permitida con los filtros actuales.",
          plan,
        },
        { status: 400 },
      );
    }

    const csv = buildTradeRecordExportCsv({ plan, rows });

    return new Response(csv, {
      headers: {
        "Content-Disposition": `attachment; filename="${plan.fileName}"`,
        "Content-Type": "text/csv; charset=utf-8",
      },
    });
  } catch (error) {
    if (error instanceof TradeRecordSearchError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    throw error;
  }
}
