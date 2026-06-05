import { productDisplayFromRaw } from "@/trade/trade-record-display";
import {
  formatTradeDecimal,
  formatTradeDisplayCodeLabel,
  type TradeDisplayCodeKind,
} from "@/trade/trade-record-format";

export type TradeProfileRankDisplayKind =
  | TradeDisplayCodeKind
  | "hs"
  | "participant";

export type TradeProfileDisplayRank = {
  code: string;
  labelRaw: string | null;
};

export function formatTradeProfileMoney(value: string | null) {
  return value ? formatTradeDecimal(value, 2, value) : "No informado";
}

export function tradeProfileRankDisplay(
  rank: TradeProfileDisplayRank,
  kind: TradeProfileRankDisplayKind,
) {
  if (kind === "hs") {
    return {
      title: rank.code,
      subtitle: rank.labelRaw ? productDisplayFromRaw(rank.labelRaw).title : null,
    };
  }

  if (kind === "participant") {
    return {
      title: `ID Aduana ${rank.code}`,
      subtitle: null,
    };
  }

  return {
    title: formatTradeDisplayCodeLabel({
      code: rank.code,
      kind,
      label: rank.labelRaw ?? undefined,
    }),
    subtitle: null,
  };
}
