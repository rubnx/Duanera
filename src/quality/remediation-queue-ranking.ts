import type {
  RemediationQueueConfidence,
  RemediationQueueImpact,
  RemediationQueueItem,
  RemediationQueueItemInput,
  RemediationQueueLink,
} from "@/quality/remediation-queue";
import type { DataQualityStatus } from "@/quality/data-quality";

export function safeRemediationQueueLinks(links: RemediationQueueLink[]) {
  const seen = new Set<string>();
  return links.filter((link) => {
    if (!link.href || seen.has(link.href)) {
      return false;
    }

    seen.add(link.href);
    return true;
  });
}

function statusRank(status: DataQualityStatus) {
  const ranks: Record<DataQualityStatus, number> = {
    warning: 3,
    review: 2,
    ok: 1,
  };

  return ranks[status];
}

function impactRank(impact: RemediationQueueImpact) {
  const ranks: Record<RemediationQueueImpact, number> = {
    visible_mvp: 6,
    commercial_values: 5,
    comparability: 4,
    provenance: 3,
    payload: 2,
    internal_context: 1,
  };

  return ranks[impact];
}

function confidenceRank(confidence: RemediationQueueConfidence) {
  const ranks: Record<RemediationQueueConfidence, number> = {
    needs_review: 3,
    inferred_signal: 2,
    verified_signal: 1,
  };

  return ranks[confidence];
}

export function remediationQueueScore(item: RemediationQueueItemInput) {
  return (
    statusRank(item.status) * 1_000_000_000 +
    impactRank(item.impact) * 10_000_000 +
    Math.min(item.affectedRecords, 9_999_999) +
    confidenceRank(item.confidence) * 10_000
  );
}

export function remediationQueueSort(
  left: RemediationQueueItem,
  right: RemediationQueueItem,
) {
  if (left.score !== right.score) {
    return right.score - left.score;
  }

  return left.title.localeCompare(right.title);
}

export function dedupeRemediationQueueItems(
  items: RemediationQueueItemInput[],
): RemediationQueueItem[] {
  const byKey = new Map<string, RemediationQueueItemInput>();

  for (const item of items) {
    const existing = byKey.get(item.dedupeKey);
    if (!existing) {
      byKey.set(item.dedupeKey, {
        ...item,
        links: safeRemediationQueueLinks(item.links),
      });
      continue;
    }

    const chosen =
      remediationQueueScore(item) > remediationQueueScore(existing)
        ? item
        : existing;
    byKey.set(item.dedupeKey, {
      ...chosen,
      affectedRecords: Math.max(existing.affectedRecords, item.affectedRecords),
      links: safeRemediationQueueLinks([...existing.links, ...item.links]),
    });
  }

  return [...byKey.values()]
    .map((item) => ({
      ...item,
      links: safeRemediationQueueLinks(item.links),
      score: remediationQueueScore(item),
    }))
    .sort(remediationQueueSort);
}
