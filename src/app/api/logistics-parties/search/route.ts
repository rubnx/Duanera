import { NextResponse } from "next/server";

import { db } from "@/db/client";
import {
  logisticsPartySearchInput,
  searchLogisticsParties,
} from "@/trade/trade-logistics-party-search";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const input = logisticsPartySearchInput(searchParams);
  const data = await searchLogisticsParties(db, input);

  return NextResponse.json({ data });
}
