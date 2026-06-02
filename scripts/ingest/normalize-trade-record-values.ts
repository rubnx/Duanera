import {
  normalizeHsCode,
  parseAduanaDate,
  parseDecimalComma,
} from "../../src/ingest/aduana-main-file";

export type RawValues = Record<string, string>;

export function rawValuesRecord(value: unknown, rowId = "unknown"): RawValues {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Raw row ${rowId} raw_values must be an object.`);
  }

  const rawValues: RawValues = {};
  const invalidKeys: string[] = [];
  for (const [key, rawValue] of Object.entries(value)) {
    if (typeof rawValue !== "string") {
      invalidKeys.push(key);
      continue;
    }

    rawValues[key] = rawValue;
  }

  if (invalidKeys.length > 0) {
    throw new Error(
      `Raw row ${rowId} raw_values contains non-string values for: ${invalidKeys.join(", ")}.`,
    );
  }

  return rawValues;
}

export function parseIntegerValue(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (!/^\d+$/.test(trimmed)) {
    return null;
  }

  return Number.parseInt(trimmed, 10);
}

function text(values: RawValues, key: string): string | null {
  const value = values[key]?.trim();
  return value ? value : null;
}

function integer(values: RawValues, key: string): number | null {
  return parseIntegerValue(text(values, key));
}

function decimal(values: RawValues, key: string): string | null {
  const parsed = parseDecimalComma(values[key]);
  return parsed === null ? null : String(parsed);
}

function productSearchText(parts: Array<string | null>): string | null {
  const value = parts
    .filter((part): part is string => Boolean(part))
    .join(" ")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

  return value.length > 0 ? value : null;
}

function importTradeValues(values: RawValues) {
  const description = text(values, "DNOMBRE");
  const attributes = {
    brand: text(values, "DMARCA"),
    variety: text(values, "DVARIEDAD"),
    other1: text(values, "DOTRO1"),
    other2: text(values, "DOTRO2"),
    attribute5: text(values, "ATR-5"),
    attribute6: text(values, "ATR-6"),
  };

  return {
    declarationIdRaw: text(values, "NUMENCRIPTADO"),
    itemNumber: integer(values, "NUMITEM"),
    acceptanceDateRaw: text(values, "FECACEP"),
    acceptanceDate: parseAduanaDate(text(values, "FECACEP")),
    importerCorrelativeId: text(values, "NUM_UNICO_IMPORTADOR"),
    exporterPrimaryCorrelativeId: null,
    exporterSecondaryCorrelativeId: null,
    hsCodeRaw: text(values, "ARANC-NAC"),
    hsCodeNormalized: normalizeHsCode(text(values, "ARANC-NAC")),
    productDescriptionRaw: description,
    productAttributes: attributes,
    productSearchText: productSearchText([description, ...Object.values(attributes)]),
    quantity: decimal(values, "CANT-MERC"),
    quantityUnitCode: text(values, "MEDIDA"),
    grossWeightTotal: decimal(values, "TOT_PESO"),
    grossWeightItem: null,
    itemCifValue: decimal(values, "CIF-ITEM"),
    itemFobValue: null,
    declarationFobValue: decimal(values, "FOB"),
    freightValue: decimal(values, "FLETE"),
    insuranceValue: decimal(values, "SEGURO"),
    cifValue: decimal(values, "CIF"),
    unitPriceValue: decimal(values, "PRE-UNIT"),
    currencyCodeRaw: text(values, "MONEDA"),
    originCountryCode: text(values, "PA_ORIG"),
    acquisitionCountryCode: text(values, "PA_ADQ"),
    consignmentCountryCode: text(values, "CODPAISCON"),
    destinationCountryCode: null,
    destinationCountryLabelRaw: null,
    customsOfficeCode: text(values, "ADU"),
    embarkPortCode: text(values, "PTO_EMB"),
    embarkPortLabelRaw: null,
    disembarkPortCode: text(values, "PTO_DESEM"),
    disembarkPortLabelRaw: null,
    transportModeCode: text(values, "VIA_TRAN"),
    cargoTypeCode: text(values, "TPO_CARGA"),
  };
}

function exportTradeValues(values: RawValues) {
  const description = text(values, "NOMBRE");
  const attributes = {
    attribute1: text(values, "ATRIBUTO1"),
    attribute2: text(values, "ATRIBUTO2"),
    attribute3: text(values, "ATRIBUTO3"),
    attribute4: text(values, "ATRIBUTO4"),
    attribute5: text(values, "ATRIBUTO5"),
    attribute6: text(values, "ATRIBUTO6"),
  };

  return {
    declarationIdRaw: text(values, "NUMEROIDENT"),
    itemNumber: integer(values, "NUMEROITEM"),
    acceptanceDateRaw: text(values, "FECHAACEPT"),
    acceptanceDate: parseAduanaDate(text(values, "FECHAACEPT")),
    importerCorrelativeId: null,
    exporterPrimaryCorrelativeId: text(values, "NRO_EXPORTADOR"),
    exporterSecondaryCorrelativeId: text(values, "NRO_EXPORTADOR_SEC"),
    hsCodeRaw: text(values, "CODIGOARANCEL"),
    hsCodeNormalized: normalizeHsCode(text(values, "CODIGOARANCEL")),
    productDescriptionRaw: description,
    productAttributes: attributes,
    productSearchText: productSearchText([description, ...Object.values(attributes)]),
    quantity: decimal(values, "CANTIDADMERCANCIA"),
    quantityUnitCode: text(values, "UNIDADMEDIDA"),
    grossWeightTotal: decimal(values, "PESOBRUTOTOTAL"),
    grossWeightItem: decimal(values, "PESOBRUTOITEM"),
    itemCifValue: null,
    itemFobValue: decimal(values, "FOBUS"),
    declarationFobValue: decimal(values, "TOTALVALORFOB"),
    freightValue: decimal(values, "VALORFLETE"),
    insuranceValue: decimal(values, "VALORSEGURO"),
    cifValue: decimal(values, "VALORCIF"),
    unitPriceValue: decimal(values, "FOBUNITARIO"),
    currencyCodeRaw: text(values, "MONEDA"),
    originCountryCode: null,
    acquisitionCountryCode: null,
    consignmentCountryCode: null,
    destinationCountryCode: text(values, "PAISDESTINO"),
    destinationCountryLabelRaw: text(values, "GLOSAPAISDESTINO"),
    customsOfficeCode: text(values, "ADUANA"),
    embarkPortCode: text(values, "PUERTOEMB"),
    embarkPortLabelRaw: text(values, "GLOSAPUERTOEMB"),
    disembarkPortCode: text(values, "PUERTODESEMB"),
    disembarkPortLabelRaw: text(values, "GLOSAPUERTODESEMB"),
    transportModeCode: text(values, "VIATRANSPORTE"),
    cargoTypeCode: text(values, "TIPOCARGA"),
  };
}

export function mapTradeRecordValues(tradeFlow: "import" | "export", values: RawValues) {
  return tradeFlow === "import" ? importTradeValues(values) : exportTradeValues(values);
}
