import { isUuid } from "@/lib/ids";

export type TradeRecordCursor = {
  rawRowNumber: number;
  rawTradeRowId: string;
};

const defaultLimit = 50;
const maxLimit = 200;

export function clampTradeRecordLimit(limit: number | undefined): number {
  if (!limit) {
    return defaultLimit;
  }

  if (!Number.isFinite(limit) || limit <= 0) {
    return defaultLimit;
  }

  return Math.min(Math.trunc(limit), maxLimit);
}

export function clampTradeRecordOffset(offset: number | undefined): number {
  if (!offset || !Number.isFinite(offset) || offset < 0) {
    return 0;
  }

  return Math.trunc(offset);
}

export function encodeTradeRecordCursor(cursor: TradeRecordCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

function cursorPayload(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return Object.fromEntries(Object.entries(value));
}

export function decodeTradeRecordCursor(value: string): TradeRecordCursor {
  let decoded: unknown;

  try {
    decoded = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
  } catch {
    throw new Error("Cursor is invalid.");
  }

  const payload = cursorPayload(decoded);
  if (!payload || !("rawRowNumber" in payload) || !("rawTradeRowId" in payload)) {
    throw new Error("Cursor is invalid.");
  }

  const rawRowNumber = Number(payload.rawRowNumber);
  const rawTradeRowId = payload.rawTradeRowId;

  if (
    !Number.isInteger(rawRowNumber) ||
    rawRowNumber < 1 ||
    typeof rawTradeRowId !== "string" ||
    !isUuid(rawTradeRowId)
  ) {
    throw new Error("Cursor is invalid.");
  }

  return {
    rawRowNumber,
    rawTradeRowId: rawTradeRowId.toLowerCase(),
  };
}
