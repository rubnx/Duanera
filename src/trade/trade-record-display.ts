import {
  cleanPublicDescriptorText,
  cleanPublicText,
  cleanPublicTextPart,
} from "@/text/public-text";

export type ProductDisplay = {
  title: string;
  titleRaw: string;
  sourceReference?: string;
  description?: string;
  descriptionRaw?: string;
  details: string[];
  raw: string | null;
  fragments: ProductSourceFragment[];
};

export type ProductAttributeEntry = {
  label: string;
  value: string;
};

export type ProductSourceFragmentRole =
  | "source_reference"
  | "description"
  | "descriptor"
  | "format"
  | "complementary_description"
  | "unknown";

export type ProductSourceFragment = {
  key: string;
  label: string;
  role: ProductSourceFragmentRole;
  value: string;
  rawValue: string;
};

export type ProductAttributeDisplay = {
  descriptor?: string;
  descriptorRaw?: string;
  format?: string;
  formatRaw?: string;
  complementaryDescription?: string;
  complementaryDescriptionRaw?: string;
  fragments: ProductSourceFragment[];
};

const attributeMetadata: Record<
  string,
  { label: string; role: ProductSourceFragmentRole }
> = {
  brand: { label: "Marca / descriptor", role: "descriptor" },
  variety: { label: "Formato / medidas", role: "format" },
  other1: { label: "Descripción complementaria", role: "complementary_description" },
  other2: { label: "Descripción complementaria", role: "complementary_description" },
  attribute1: { label: "Descripción complementaria", role: "complementary_description" },
  attribute2: { label: "Descripción complementaria", role: "complementary_description" },
  attribute3: { label: "Descripción complementaria", role: "complementary_description" },
  attribute4: { label: "Descripción complementaria", role: "complementary_description" },
  attribute5: { label: "Descripción complementaria", role: "complementary_description" },
  attribute6: { label: "Descripción complementaria", role: "complementary_description" },
};

export function friendlySourceText(value: string | null | undefined) {
  return cleanPublicText(value);
}

export function friendlyDescriptorText(value: string | null | undefined) {
  return cleanPublicDescriptorText(value);
}

function joinContinuationFragments(values: string[]) {
  return values
    .map(cleanPublicTextPart)
    .filter(Boolean)
    .join(" ")
    .replace(/\s+([,.;:])/g, "$1")
    .trim();
}

function isLikelySourceReference(value: string, partCount: number) {
  if (partCount < 2) {
    return false;
  }

  const normalized = value.toUpperCase();
  return (
    normalized === "SIN-CODIGO" ||
    /\d/.test(value) ||
    /^[A-Z]{1,4}-[A-Z0-9-]+$/.test(value)
  );
}

export function productDisplayFromRaw(value: string | null | undefined): ProductDisplay {
  if (!value) {
    return {
      title: "Sin descripción",
      titleRaw: "Sin descripción",
      details: [],
      raw: null,
      fragments: [],
    };
  }

  const parts = value.split("~").map(cleanPublicTextPart).filter(Boolean);
  if (parts.length === 0) {
    return {
      title: "Sin descripción",
      titleRaw: "Sin descripción",
      details: [],
      raw: value,
      fragments: [],
    };
  }

  const hasReference = isLikelySourceReference(parts[0], parts.length);
  const titleRaw = hasReference ? (parts[1] ?? parts[0]) : parts[0];
  const title = friendlySourceText(titleRaw);
  const details = hasReference ? parts.slice(2) : parts.slice(1);
  const descriptionRaw = joinContinuationFragments(details) || undefined;
  const fragments: ProductSourceFragment[] = parts.map((part, index) => {
    const isSourceReference = hasReference && index === 0;
    const isTitle = index === (hasReference ? 1 : 0);

    return {
      key: `part${index + 1}`,
      label: isSourceReference
        ? "Referencia fuente"
        : isTitle
          ? "Producto fuente"
          : "Descripción complementaria",
      role: isSourceReference
        ? "source_reference"
        : isTitle
          ? "description"
          : "complementary_description",
      value: isSourceReference ? part : friendlySourceText(part),
      rawValue: part,
    };
  });

  return {
    title,
    titleRaw,
    sourceReference: hasReference ? parts[0] : undefined,
    description: descriptionRaw ? friendlySourceText(descriptionRaw) : undefined,
    descriptionRaw,
    details,
    raw: value,
    fragments,
  };
}

export function productAttributeDisplayFromRaw(value: unknown): ProductAttributeDisplay {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { fragments: [] };
  }

  const fragments = Object.entries(value)
    .map(([key, rawValue]) => {
      if (rawValue === null || rawValue === undefined) {
        return null;
      }

      const rawText = cleanPublicTextPart(String(rawValue));
      const metadata = attributeMetadata[key] ?? {
        label: "Campo fuente sin clasificar",
        role: "unknown" as const,
      };
      const text =
        metadata.role === "descriptor"
          ? friendlyDescriptorText(rawText)
          : friendlySourceText(rawText);
      if (!text) {
        return null;
      }

      return {
        key,
        label: metadata.label,
        role: metadata.role,
        value: text,
        rawValue: rawText,
      };
    })
    .filter((entry): entry is ProductSourceFragment => entry !== null);

  const descriptor = fragments.find((fragment) => fragment.role === "descriptor")?.value;
  const descriptorRaw = fragments.find((fragment) => fragment.role === "descriptor")?.rawValue;
  const format = fragments.find((fragment) => fragment.role === "format")?.value;
  const formatRaw = fragments.find((fragment) => fragment.role === "format")?.rawValue;
  const complementaryDescriptionRaw = joinContinuationFragments(
    fragments
      .filter((fragment) => fragment.role === "complementary_description")
      .map((fragment) => fragment.rawValue),
  );
  const complementaryDescription = complementaryDescriptionRaw
    ? friendlySourceText(complementaryDescriptionRaw)
    : "";

  return {
    descriptor,
    descriptorRaw,
    format,
    formatRaw,
    complementaryDescription: complementaryDescription || undefined,
    complementaryDescriptionRaw: complementaryDescriptionRaw || undefined,
    fragments,
  };
}

export function productAttributeEntries(value: unknown): ProductAttributeEntry[] {
  const display = productAttributeDisplayFromRaw(value);
  const entries: ProductAttributeEntry[] = [];

  if (display.descriptor) {
    entries.push({ label: "Marca / descriptor", value: display.descriptor });
  }

  if (display.format) {
    entries.push({ label: "Formato / medidas", value: display.format });
  }

  if (display.complementaryDescription) {
    entries.push({
      label: "Descripción complementaria",
      value: display.complementaryDescription,
    });
  }

  for (const fragment of display.fragments) {
    if (fragment.role === "unknown") {
      entries.push({ label: fragment.label, value: fragment.value });
    }
  }

  return entries;
}

export function isNonZeroDecimal(value: string | null | undefined) {
  if (value === null || value === undefined) {
    return false;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed !== 0;
}
