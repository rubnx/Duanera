import path from "node:path";

export type ArchiveManifestReference = {
  country?: string;
  sourceCategory?: string;
  sourceDomain?: string;
  sourceManifestPath: string;
  tradeFlow?: string;
  period?: string;
  fileRole?: string;
  checksumSha256?: string;
};

export type ArchiveManifestKeyMode = "legacy" | "snapshot";

export type ArchiveCandidateMetadataInput = {
  fileRole: string;
  sha256: string;
  sourceKind: string;
  country: string | null;
  sourceDomain: string | null;
  tradeFlow: string | null;
  period: string | null;
  sourceManifestPath: string | null;
};

export function classifyArchivePath(relativePath: string): string {
  const basename = path.posix.basename(relativePath);
  if (basename === ".DS_Store" || basename.endsWith(".download")) {
    return "disposable";
  }

  if (relativePath.includes("/manifests/") || relativePath === "data/sources/chile-aduana/README.md") {
    return "source_manifest";
  }

  if (relativePath.startsWith("data/research/chile-aduana-identity-validation/")) {
    return "generated_validation";
  }

  if (relativePath.startsWith("data/research/")) {
    return "research_evidence";
  }

  if (relativePath.includes("/raw/")) {
    return "official_source_raw";
  }

  if (relativePath.includes("/working/")) {
    return "working_file";
  }

  return "unknown";
}

export function archiveSourceDomainFor(
  relativePath: string,
  reference?: ArchiveManifestReference,
): string | null {
  if (reference?.sourceDomain) {
    return reference.sourceDomain;
  }
  if (relativePath.includes("/datos-gob-cl/")) {
    return "datos.gob.cl";
  }
  if (relativePath.includes("/aduana-cl/")) {
    return "aduana.cl";
  }
  return null;
}

export function archiveTradeFlowFor(
  relativePath: string,
  reference?: ArchiveManifestReference,
): string | null {
  if (reference?.tradeFlow) {
    return reference.tradeFlow;
  }
  if (relativePath.includes("/imports/")) {
    return "import";
  }
  if (relativePath.includes("/exports/")) {
    return "export";
  }
  if (relativePath.includes("/references/") || relativePath.includes("/code-tables/")) {
    return "reference";
  }
  return null;
}

export function archiveSourceKindFor(classification: string, relativePath: string): string {
  if (classification === "generated_validation") {
    return "generated_validation";
  }
  if (classification === "research_evidence") {
    return "research_evidence";
  }
  if (classification === "disposable") {
    return "disposable";
  }
  if (relativePath.startsWith("data/sources/")) {
    return "official_source";
  }
  return "unknown";
}

export function archiveFileRoleFor(
  classification: string,
  reference?: ArchiveManifestReference,
): string {
  if (reference?.fileRole) {
    return reference.fileRole;
  }

  const roles: Record<string, string> = {
    disposable: "disposable",
    generated_validation: "generated_validation",
    official_source_raw: "official_source_file",
    research_evidence: "research_evidence",
    source_manifest: "source_manifest",
    unknown: "unknown",
    working_file: "working_file",
  };

  return roles[classification] ?? "unknown";
}

export function archivePeriodFor(
  relativePath: string,
  reference?: ArchiveManifestReference,
): string | null {
  if (reference?.period) {
    return reference.period;
  }

  const monthMatch = /_(\d{4})_(\d{2})(?:_|\.|$)/.exec(relativePath);
  if (monthMatch) {
    return `${monthMatch[1]}-${monthMatch[2]}`;
  }

  const yearMatch = /_(\d{4})(?:_|\.|$)/.exec(relativePath);
  return yearMatch?.[1] ?? null;
}

function periodKey(period: string | null): string {
  if (!period) {
    return "undated";
  }

  const monthMatch = /^(\d{4})-(\d{2})$/.exec(period);
  if (monthMatch) {
    return `${monthMatch[1]}/${monthMatch[2]}`;
  }

  return period;
}

function sourceGroup(relativePath: string): string {
  if (relativePath.includes("/imports/")) {
    return "imports";
  }
  if (relativePath.includes("/exports/")) {
    return "exports";
  }
  if (relativePath.includes("/code-tables/")) {
    return "code-tables";
  }
  if (relativePath.includes("/references/")) {
    return "references";
  }
  return "misc";
}

function roleDirectory(relativePath: string, classification: string): string {
  if (relativePath.includes("/raw/")) {
    return "raw";
  }
  if (relativePath.includes("/working/")) {
    return "working";
  }
  return classification;
}

export function archiveR2KeyFor(
  relativePath: string,
  classification: string,
  reference?: ArchiveManifestReference,
  options?: {
    manifestKeyMode?: ArchiveManifestKeyMode;
    sha256?: string;
  },
): string | null {
  const basename = path.posix.basename(relativePath);
  const sourceDomain = archiveSourceDomainFor(relativePath, reference)?.replaceAll(".", "-");
  const period = archivePeriodFor(relativePath, reference);

  if (classification === "disposable") {
    return null;
  }

  if (classification === "source_manifest") {
    if (options?.manifestKeyMode === "snapshot") {
      if (!options.sha256) {
        throw new Error(`${relativePath}: snapshot source manifest keys require a SHA-256 checksum.`);
      }
      const domainSegment = sourceDomain ?? "unknown-source";
      return `manifests/cl/aduana/${domainSegment}/snapshots/${basename}/${options.sha256}/${basename}`;
    }

    if (sourceDomain) {
      return `manifests/cl/aduana/${sourceDomain}/${basename}`;
    }
    return `manifests/cl/aduana/${basename}`;
  }

  if (relativePath.startsWith("data/sources/chile-aduana/")) {
    const domainSegment = sourceDomain ?? "unknown-source";
    return [
      "sources",
      "cl",
      "aduana",
      domainSegment,
      sourceGroup(relativePath),
      periodKey(period),
      roleDirectory(relativePath, classification),
      basename,
    ].join("/");
  }

  if (classification === "generated_validation") {
    const suffix = relativePath.replace("data/research/chile-aduana-identity-validation/", "");
    return `research/cl/aduana/identity-validation/${suffix}`;
  }

  if (classification === "research_evidence") {
    const suffix = relativePath.replace("data/research/", "");
    return `research/cl/aduana/${suffix}`;
  }

  return `unclassified/${relativePath.replace(/^data\//, "")}`;
}

export function archiveR2MetadataFor(
  candidate: ArchiveCandidateMetadataInput,
): Record<string, string> {
  const metadata: Record<string, string> = {
    file_role: candidate.fileRole,
    sha256: candidate.sha256,
    source_kind: candidate.sourceKind,
  };

  if (candidate.country) {
    metadata.country = candidate.country;
  }
  if (candidate.sourceDomain) {
    metadata.source_domain = candidate.sourceDomain;
  }
  if (candidate.tradeFlow) {
    metadata.trade_flow = candidate.tradeFlow;
  }
  if (candidate.period) {
    metadata.period = candidate.period;
  }
  if (candidate.sourceManifestPath) {
    metadata.manifest_local_path = candidate.sourceManifestPath;
  }

  return metadata;
}
