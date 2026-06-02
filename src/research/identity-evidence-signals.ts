import { productDisplayFromRaw } from "@/trade/trade-record-display";
import type { TradeFlow } from "@/trade/trade-records";
import type {
  IdentityEvidenceRecord,
  IdentityEvidenceSignal,
  IdentityEvidenceStrength,
} from "@/research/identity-evidence";

const genericEvidenceValues = new Set([
  "0",
  "NO",
  "S",
  "SIN CODIGO",
  "SIN-CODIGO",
  "GENERAL",
  "UNIDAD",
  "ROTUL.",
  "ROTUL",
  "S/M",
  "S/MARCA",
  "NO INFORMADO",
  "DE CARRETERA",
  "ELEMENTOS PAGABLES Y",
  "CRUDO CONGELADO IQF",
  "VEHICULOS DE MOTOR DIESEL",
]);

const genericProductTerms =
  /\b(DE|DEL|LA|EL|LOS|LAS|PARA|CON|SIN|USADO|USADA|NUEVO|NUEVA|MOTOR|VEHICULO|AUTOMOVIL|PRODUCTO|CALIDAD|PREMIUM|CRUDO|CONGELADO|UNIDAD|CAJA|BOTELLAS)\b/gi;

const productAttributeLabels: Record<string, string> = {
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

export function normalizeIdentityEvidenceValue(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).replace(/\s+/g, " ").trim();
}

export function isUsefulIdentityEvidenceValue(value: unknown) {
  const normalized = normalizeIdentityEvidenceValue(value);
  if (normalized.length < 3) {
    return false;
  }

  const uppercase = normalized.toUpperCase();
  if (genericEvidenceValues.has(uppercase)) {
    return false;
  }

  if (!/[A-ZÁÉÍÓÚÑ]/i.test(normalized)) {
    return false;
  }

  if (/^[0-9.,/ -]+$/.test(normalized)) {
    return false;
  }

  return true;
}

export function identityEvidenceRecordValue(
  value: unknown,
): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return Object.fromEntries(Object.entries(value));
}

function rawValue(rawValues: unknown, key: string) {
  const values = identityEvidenceRecordValue(rawValues);
  if (!values) {
    return "";
  }

  return normalizeIdentityEvidenceValue(values[key]);
}

function attributeEntries(value: unknown) {
  const values = identityEvidenceRecordValue(value);
  if (!values) {
    return [];
  }

  return Object.entries(values)
    .map(([field, raw]) => ({
      field,
      label: productAttributeLabels[field] ?? field,
      value: normalizeIdentityEvidenceValue(raw),
    }))
    .filter((entry) => isUsefulIdentityEvidenceValue(entry.value));
}

function looksLikeDistinctiveNameSignal(value: string) {
  const uppercase = value.toUpperCase();
  if (
    /(S\.?A\.?|SPA|LTDA|LIMITADA|VIÑA|VINA|CODELCO|CMPC|AQUACHILE|CONCHA|TORO|GOODYEAR|CATERPILLAR|DECATHLON|SAMSUNG|APPLE|GREENVIC|EMILIANA|ORIZON|FINNING|PRYSMIAN|COBRE CERRILLOS|NOVA ANDINO)/.test(
      uppercase,
    )
  ) {
    return true;
  }

  const withoutGenericTerms = uppercase
    .replace(genericProductTerms, " ")
    .replace(/[-.,/0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!withoutGenericTerms) {
    return false;
  }

  const tokens = withoutGenericTerms.split(" ").filter(Boolean);
  return (
    tokens.length === 1 &&
    tokens.some((token) => token.length >= 5 && !genericEvidenceValues.has(token))
  );
}

function pushSignal(
  signals: IdentityEvidenceSignal[],
  signal: IdentityEvidenceSignal,
) {
  if (
    signals.some(
      (existing) =>
        existing.field === signal.field &&
        existing.value.toUpperCase() === signal.value.toUpperCase(),
    )
  ) {
    return;
  }

  signals.push(signal);
}

export function extractIdentityEvidenceSignals(input: {
  tradeFlow: TradeFlow;
  productDescriptionRaw: string | null;
  productAttributes: unknown;
  rawValues: unknown;
}) {
  const signals: IdentityEvidenceSignal[] = [];
  const product = productDisplayFromRaw(input.productDescriptionRaw);

  if (isUsefulIdentityEvidenceValue(product.title)) {
    pushSignal(signals, {
      field: "product_description",
      label: "Texto producto",
      value: product.title,
      strength: "context",
      caveat:
        "Describe el item comercial; puede contener marca o descripcion, pero no identifica por si solo al importador/exportador.",
    });
  }

  for (const attribute of attributeEntries(input.productAttributes)) {
    pushSignal(signals, {
      field: attribute.field,
      label: attribute.label,
      value: attribute.value,
      strength: looksLikeDistinctiveNameSignal(attribute.value)
        ? "direct_source_text"
        : "context",
      caveat:
        "Texto de atributo fuente. Es una pista para revision, no identidad legal verificada.",
    });
  }

  const rawPartyFields =
    input.tradeFlow === "import"
      ? [
          ["GNOM_CIA_T", "Transportista importacion"],
          ["NOMEMISOR", "Emisor documento importacion"],
          ["ID_BULTOS", "Referencia bultos importacion"],
        ]
      : [
          ["NOMBRECIATRANSP", "Transportista exportacion"],
          ["NOMBREEMISORDOCTRANSP", "Emisor documento exportacion"],
        ];

  for (const [field, label] of rawPartyFields) {
    const value = rawValue(input.rawValues, field);
    if (!isUsefulIdentityEvidenceValue(value)) {
      continue;
    }

    pushSignal(signals, {
      field,
      label,
      value,
      strength: field === "ID_BULTOS" ? "context" : "weak",
      caveat:
        field === "ID_BULTOS"
          ? "Referencia de bultos en la fila principal; requiere contraste con fuente de bultos antes de usarla como evidencia."
          : "Parte logistica o documental. No debe tratarse como importador/exportador comercial.",
    });
  }

  return signals.slice(0, 8);
}

export function identityEvidenceUsefulnessFromRecords(
  records: IdentityEvidenceRecord[],
) {
  if (
    records.some((record) =>
      record.evidenceSignals.some(
        (signal) => signal.strength === "direct_source_text",
      ),
    )
  ) {
    return "direct_source_text" satisfies IdentityEvidenceStrength;
  }

  if (records.some((record) => record.evidenceSignals.length > 0)) {
    return "context" satisfies IdentityEvidenceStrength;
  }

  return "weak" satisfies IdentityEvidenceStrength;
}

export function identityEvidenceSummary(strength: IdentityEvidenceStrength) {
  if (strength === "direct_source_text") {
    return "Tiene marcas, atributos o texto fuente utiles para revision interna.";
  }

  if (strength === "context") {
    return "Tiene contexto comercial/logistico, pero la identidad sigue sin verificar.";
  }

  return "No hay pistas fuertes en la muestra; mantener solo el correlative anonimo.";
}
