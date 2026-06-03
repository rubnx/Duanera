import type {
  LoadReadinessDecision,
  LoadReadinessLink,
  LoadReadinessStatus,
} from "@/quality/load-readiness";

export function loadReadinessStatusRank(status: LoadReadinessStatus) {
  const ranks: Record<LoadReadinessStatus, number> = {
    blocked: 3,
    review: 2,
    ready: 1,
  };

  return ranks[status];
}

export function loadReadinessDecisionFromStatuses(
  statuses: LoadReadinessStatus[],
): LoadReadinessDecision {
  if (statuses.some((status) => status === "blocked")) {
    return "no-go";
  }

  if (statuses.some((status) => status === "review")) {
    return "review-first";
  }

  return "go";
}

export function loadReadinessAreaStatusFromCounts({
  blockers,
  warnings,
}: {
  blockers: number;
  warnings: number;
}): LoadReadinessStatus {
  if (blockers > 0) {
    return "blocked";
  }

  if (warnings > 0) {
    return "review";
  }

  return "ready";
}

function isSafeInternalHref(href: string | null | undefined) {
  if (!href) {
    return false;
  }

  if (!href.startsWith("/") || href.startsWith("//")) {
    return false;
  }

  const unsafeFragments = [
    "/Users/",
    "\\",
    "r2://",
    "http://",
    "https://",
    "storage_key",
    "storageKey",
    "bucket=",
    "secret",
    "token",
  ];

  return !unsafeFragments.some((fragment) => href.includes(fragment));
}

export function safeLoadReadinessLinks<T extends LoadReadinessLink>(
  links: T[],
): T[] {
  const seen = new Set<string>();
  const safeLinks: T[] = [];

  for (const link of links) {
    const href = link.href ?? undefined;

    if (href && !isSafeInternalHref(href)) {
      continue;
    }

    const dedupeKey = `${href ?? "plain"}:${link.label}`;
    if (seen.has(dedupeKey)) {
      continue;
    }

    seen.add(dedupeKey);
    safeLinks.push({ ...link, href });
  }

  return safeLinks;
}

export function loadReadinessDecisionLabel(decision: LoadReadinessDecision) {
  const labels: Record<LoadReadinessDecision, string> = {
    go: "Go dev",
    "no-go": "No-go",
    "review-first": "Revisar primero",
  };

  return labels[decision];
}

export function loadReadinessStatusLabel(status: LoadReadinessStatus) {
  const labels: Record<LoadReadinessStatus, string> = {
    blocked: "Bloqueado",
    ready: "Listo",
    review: "Revisar",
  };

  return labels[status];
}

export function loadReadinessDecisionSummary(decision: LoadReadinessDecision) {
  const summaries: Record<LoadReadinessDecision, string> = {
    go: "No hay blockers detectados en la evidencia evaluada para una carga dev controlada.",
    "no-go":
      "Hay al menos un blocker. Corrige o documenta esas brechas antes de intentar otro mes.",
    "review-first":
      "No hay blockers, pero quedan puntos relevantes que deben revisarse durante la carga dev.",
  };

  return summaries[decision];
}
