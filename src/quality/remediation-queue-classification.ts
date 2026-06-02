import type { CodeTableRemediationPriority } from "@/quality/code-table-remediation";
import type {
  DataQualityFieldCoverage,
  DataQualityIssueGroup,
} from "@/quality/data-quality";
import type { FieldMappingConfidence, FieldMappingGroup } from "@/quality/field-mapping";
import type {
  RemediationQueueConfidence,
  RemediationQueueImpact,
} from "@/quality/remediation-queue";

export function issueImpact(group: DataQualityIssueGroup): RemediationQueueImpact {
  if (
    group.key === "missing_or_zero_item_value" ||
    group.key === "missing_or_zero_declaration_fob"
  ) {
    return "commercial_values";
  }

  if (group.key === "quantity_unit_value_review") {
    return "comparability";
  }

  if (
    group.key === "undecoded_customs_office" ||
    group.key === "undecoded_port" ||
    group.key === "undecoded_transport_mode"
  ) {
    return "visible_mvp";
  }

  return "commercial_values";
}

export function fieldCoverageImpact(
  field: DataQualityFieldCoverage,
): RemediationQueueImpact {
  if (
    field.key.includes("itemValue") ||
    field.key.includes("declarationFob") ||
    field.key.includes("grossWeight")
  ) {
    return "commercial_values";
  }

  if (field.key.includes("quantity") || field.key.includes("unitPrice")) {
    return "comparability";
  }

  if (
    field.key.includes("Country") ||
    field.key.includes("customs") ||
    field.key.includes("Port") ||
    field.key.includes("transport")
  ) {
    return "visible_mvp";
  }

  return "internal_context";
}

export function fieldMappingImpact(group: FieldMappingGroup): RemediationQueueImpact {
  const impacts: Record<FieldMappingGroup, RemediationQueueImpact> = {
    anonymous_correlative: "internal_context",
    commercial_values: "commercial_values",
    geography_logistics: "visible_mvp",
    hs_product: "visible_mvp",
    provenance: "provenance",
    quantity_weight: "comparability",
  };

  return impacts[group];
}

export function mappingConfidence(
  confidence: FieldMappingConfidence,
): RemediationQueueConfidence {
  if (confidence === "verified") {
    return "verified_signal";
  }

  if (confidence === "inferred") {
    return "inferred_signal";
  }

  return "needs_review";
}

export function codeTableImpact(
  priority: CodeTableRemediationPriority,
): RemediationQueueImpact {
  if (priority === "high") {
    return "visible_mvp";
  }

  if (priority === "medium") {
    return "comparability";
  }

  return "internal_context";
}
