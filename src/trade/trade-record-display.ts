export type ProductDisplay = {
  title: string;
  sourceReference?: string;
  details: string[];
  raw: string | null;
};

export type ProductAttributeEntry = {
  label: string;
  value: string;
};

const attributeLabels: Record<string, string> = {
  brand: "Marca / descriptor fuente",
  variety: "Variedad / formato",
  other1: "Detalle fuente 1",
  other2: "Detalle fuente 2",
  attribute1: "Atributo fuente 1",
  attribute2: "Atributo fuente 2",
  attribute3: "Atributo fuente 3",
  attribute4: "Atributo fuente 4",
  attribute5: "Atributo fuente 5",
  attribute6: "Atributo fuente 6",
};

function cleanPart(value: string) {
  return value.replace(/\s+/g, " ").trim();
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
      details: [],
      raw: null,
    };
  }

  const parts = value.split("~").map(cleanPart).filter(Boolean);
  if (parts.length === 0) {
    return {
      title: "Sin descripción",
      details: [],
      raw: value,
    };
  }

  const hasReference = isLikelySourceReference(parts[0], parts.length);
  const title = hasReference ? (parts[1] ?? parts[0]) : parts[0];

  return {
    title,
    sourceReference: hasReference ? parts[0] : undefined,
    details: hasReference ? parts.slice(2) : parts.slice(1),
    raw: value,
  };
}

export function productAttributeEntries(
  value: unknown,
): ProductAttributeEntry[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }

  return Object.entries(value)
    .map(([key, rawValue]) => {
      if (rawValue === null || rawValue === undefined) {
        return null;
      }

      const text = cleanPart(String(rawValue));
      if (!text) {
        return null;
      }

      return {
        label: attributeLabels[key] ?? key,
        value: text,
      };
    })
    .filter((entry): entry is ProductAttributeEntry => entry !== null);
}

export function isNonZeroDecimal(value: string | null | undefined) {
  if (value === null || value === undefined) {
    return false;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed !== 0;
}
