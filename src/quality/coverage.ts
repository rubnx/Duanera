export type DataQualityStatus = "ok" | "review" | "warning";

export function coveragePercent(covered: number, total: number): number {
  if (total <= 0) {
    return 0;
  }

  if (covered >= total) {
    return 100;
  }

  const rounded = Math.round((covered / total) * 1000) / 10;
  return rounded >= 100 ? 99.9 : rounded;
}

export function coverageStatus({
  covered,
  okAt = 99,
  total,
  warningBelow = 90,
}: {
  covered: number;
  total: number;
  okAt?: number;
  warningBelow?: number;
}): DataQualityStatus {
  if (total <= 0) {
    return "review";
  }

  const percent = coveragePercent(covered, total);
  if (percent >= okAt) {
    return "ok";
  }

  if (percent < warningBelow) {
    return "warning";
  }

  return "review";
}

export function normalizeCodeForCoverage(
  value: string | null | undefined,
): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (/^\d+$/.test(trimmed)) {
    const withoutLeadingZeros = trimmed.replace(/^0+/, "");
    return withoutLeadingZeros || "0";
  }

  return trimmed.toUpperCase();
}

export function isActionableUndecodedCode({
  code,
  codeSet,
  ignoredSourceCodes = new Set<string>(),
}: {
  code: string | null | undefined;
  codeSet: Set<string>;
  ignoredSourceCodes?: Set<string>;
}) {
  const normalizedCode = normalizeCodeForCoverage(code);
  return Boolean(
    normalizedCode &&
      !codeSet.has(normalizedCode) &&
      !ignoredSourceCodes.has(normalizedCode),
  );
}
