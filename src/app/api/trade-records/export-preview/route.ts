import { NextResponse } from "next/server";

import { db } from "@/db/client";
import { planTradeRecordExport } from "@/trade/trade-record-export";
import { TradeRecordSearchError } from "@/trade/trade-record-search";

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;

  try {
    const plan = await planTradeRecordExport(db, searchParams);

    return NextResponse.json(plan);
  } catch (error) {
    if (error instanceof TradeRecordSearchError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    throw error;
  }
}
