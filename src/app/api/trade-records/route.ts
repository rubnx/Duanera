import { NextResponse } from "next/server";

import { db } from "../../../db/client";
import {
  searchTradeRecords,
  TradeRecordSearchError,
} from "../../../trade/trade-record-search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const result = await searchTradeRecords(db, searchParams);

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof TradeRecordSearchError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
      );
    }

    console.error(error);
    return NextResponse.json(
      { error: "Unexpected trade record search error." },
      { status: 500 },
    );
  }
}
