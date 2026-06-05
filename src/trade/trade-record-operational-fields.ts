import { parseAduanaDate } from "@/ingest/aduana-main-file";
import { cleanPublicText } from "@/text/public-text";
import {
  formatUnknownOperationalCode,
  isUnknownOperationalCodeSourceField,
  operationalCodeLabel,
  shouldFormatUnknownOperationalCode,
  type OperationalCodeLabelMaps,
} from "@/trade/trade-record-operational-code-labels";

export type OperationalSourceField = {
  key: string;
  label: string;
  value: string;
  sourceField: string;
};

export type OperationalSourceFieldGroup = {
  key: string;
  title: string;
  fields: OperationalSourceField[];
};

type FieldDefinition = {
  key: string;
  label: string;
  sourceField: string;
  kind?: "date";
};

type FieldDefinitionGroup = {
  key: string;
  title: string;
  fields: FieldDefinition[];
};

export type OperationalSourceFieldCatalogItem = FieldDefinition & {
  groupKey: string;
  groupTitle: string;
  sourceFields: string[];
  tradeFlow: "import" | "export";
};

const importTransportFields: FieldDefinition[] = [
  { key: "transportCompany", label: "Compañía de transporte", sourceField: "GNOM_CIA_T" },
  { key: "transportCompanyCountry", label: "País compañía transporte", sourceField: "CODPAISCIA" },
  { key: "manifestNumber", label: "Nro. manifiesto", sourceField: "NUM_MANIF" },
  { key: "manifestDate", label: "Fecha manifiesto", sourceField: "FEC_MANIF", kind: "date" },
  { key: "transportDocumentNumber", label: "Nro. documento transporte", sourceField: "NUM_CONOC" },
  { key: "transportDocumentDate", label: "Fecha documento transporte", sourceField: "FEC_CONOC", kind: "date" },
  { key: "transportDocumentIssuer", label: "Emisor documento transporte", sourceField: "NOMEMISOR" },
];

const importPaymentFields: FieldDefinition[] = [
  { key: "paymentForm", label: "Forma de pago", sourceField: "FORM_PAGO" },
  { key: "saleClause", label: "Cláusula compra/venta", sourceField: "CL_COMPRA" },
];

const importStorageFields: FieldDefinition[] = [
  { key: "packageTotal", label: "Total bultos", sourceField: "TOT_BULTOS" },
  { key: "packageIdentifier", label: "Identificador bultos", sourceField: "ID_BULTOS" },
  { key: "warehouse", label: "Almacén", sourceField: "ALMACEN" },
  { key: "warehouseDate", label: "Fecha almacén", sourceField: "FEC_ALMAC", kind: "date" },
];

const exportTransportFields: FieldDefinition[] = [
  { key: "transportCompany", label: "Compañía de transporte", sourceField: "NOMBRECIATRANSP" },
  { key: "transportCompanyCountry", label: "País compañía transporte", sourceField: "PAISCIATRANSP" },
  { key: "transportDocumentIssuer", label: "Emisor documento transporte", sourceField: "NOMBREEMISORDOCTRANSP" },
  { key: "cancelingDocumentNumber", label: "Nro. documento cancela", sourceField: "NUMERODOCTOCANCELA" },
  { key: "cancelingDocumentDate", label: "Fecha documento cancela", sourceField: "FECHADOCTOCANCELA", kind: "date" },
];

const exportPaymentFields: FieldDefinition[] = [
  { key: "paymentForm", label: "Forma de pago", sourceField: "FORMAPAGO" },
  { key: "saleClause", label: "Cláusula venta", sourceField: "CLAUSULAVENTA" },
];

const exportPackageFields: FieldDefinition[] = [
  { key: "packageTotal", label: "Total bultos", sourceField: "TOTALBULTOS" },
  { key: "canceledPackageTotal", label: "Total bultos cancela", sourceField: "TOTALBULTOSCANCELA" },
];

const importDefinitionGroups: FieldDefinitionGroup[] = [
  {
    key: "transport",
    title: "Transporte y documentos",
    fields: importTransportFields,
  },
  {
    key: "payment",
    title: "Pago y cláusula",
    fields: importPaymentFields,
  },
  {
    key: "packages",
    title: "Bultos y almacén",
    fields: [
      ...importStorageFields,
      {
        key: "packageDetail",
        label: "Detalle bultos",
        sourceField: "TPO_BUL1-CANT_BUL8",
      },
    ],
  },
];

const exportDefinitionGroups: FieldDefinitionGroup[] = [
  {
    key: "transport",
    title: "Transporte y documentos",
    fields: exportTransportFields,
  },
  {
    key: "payment",
    title: "Pago y cláusula",
    fields: exportPaymentFields,
  },
  {
    key: "packages",
    title: "Bultos",
    fields: exportPackageFields,
  },
];

function sourceFieldsForDefinition(definition: FieldDefinition) {
  if (definition.key !== "packageDetail") {
    return [definition.sourceField];
  }

  return Array.from({ length: 8 }, (_, index) => index + 1)
    .flatMap((index) => [`TPO_BUL${index}`, `CANT_BUL${index}`]);
}

function definitionGroupsForFlow(
  tradeFlow: string,
): FieldDefinitionGroup[] {
  return tradeFlow === "export" ? exportDefinitionGroups : importDefinitionGroups;
}

export function operationalSourceFieldCatalog(
  tradeFlow: "import" | "export" | null = null,
): OperationalSourceFieldCatalogItem[] {
  const flows = tradeFlow ? [tradeFlow] : ["import", "export"] as const;

  return flows.flatMap((flow) =>
    definitionGroupsForFlow(flow).flatMap((groupDefinition) =>
      groupDefinition.fields.map((definition) => ({
        ...definition,
        groupKey: groupDefinition.key,
        groupTitle: groupDefinition.title,
        sourceFields: sourceFieldsForDefinition(definition),
        tradeFlow: flow,
      })),
    ),
  );
}

function sourceText(rawValues: Record<string, string>, sourceField: string) {
  const value = rawValues[sourceField]?.trim();
  return value ? value : null;
}

function displayValue(
  rawValues: Record<string, string>,
  definition: FieldDefinition,
  labelMaps?: OperationalCodeLabelMaps,
) {
  const value = sourceText(rawValues, definition.sourceField);
  if (!value) {
    return null;
  }

  if (definition.kind === "date") {
    return parseAduanaDate(value);
  }

  const decodedValue = labelMaps
    ? operationalCodeLabel(labelMaps, definition.sourceField, value)
    : null;
  if (decodedValue) {
    return decodedValue;
  }

  if (
    isUnknownOperationalCodeSourceField(definition.sourceField) &&
    shouldFormatUnknownOperationalCode(value)
  ) {
    return formatUnknownOperationalCode(value);
  }

  return cleanPublicText(value);
}

function fieldsFromDefinitions(
  rawValues: Record<string, string>,
  definitions: FieldDefinition[],
  labelMaps?: OperationalCodeLabelMaps,
) {
  return definitions
    .map((definition): OperationalSourceField | null => {
      const value = displayValue(rawValues, definition, labelMaps);
      if (!value) {
        return null;
      }

      return {
        key: definition.key,
        label: definition.label,
        sourceField: definition.sourceField,
        value,
      };
    })
    .filter((field): field is OperationalSourceField => field !== null);
}

function importPackagePairs(rawValues: Record<string, string>) {
  const values: string[] = [];

  for (let index = 1; index <= 8; index += 1) {
    const typeField = `TPO_BUL${index}`;
    const type = sourceText(rawValues, typeField);
    const count = sourceText(rawValues, `CANT_BUL${index}`);

    if (!type && !count) {
      continue;
    }

    const typeValue = type
      ? shouldFormatUnknownOperationalCode(type)
        ? formatUnknownOperationalCode(type)
        : cleanPublicText(type)
      : null;

    values.push([typeValue, count].filter(Boolean).join(": "));
  }

  if (values.length === 0) {
    return null;
  }

  return {
    key: "packageDetail",
    label: "Detalle bultos",
    sourceField: "TPO_BUL1-CANT_BUL8",
    value: values.join(" · "),
  };
}

function group(
  key: string,
  title: string,
  fields: Array<OperationalSourceField | null>,
): OperationalSourceFieldGroup | null {
  const visibleFields = fields.filter(
    (field): field is OperationalSourceField => field !== null,
  );

  return visibleFields.length > 0 ? { key, title, fields: visibleFields } : null;
}

export function operationalSourceFieldGroups(
  tradeFlow: string,
  rawValues: Record<string, string> | null,
  labelMaps?: OperationalCodeLabelMaps,
): OperationalSourceFieldGroup[] {
  if (!rawValues) {
    return [];
  }

  const groups =
    tradeFlow === "export"
      ? [
          group(
            "transport",
            "Transporte y documentos",
            fieldsFromDefinitions(rawValues, exportTransportFields, labelMaps),
          ),
          group(
            "payment",
            "Pago y cláusula",
            fieldsFromDefinitions(rawValues, exportPaymentFields, labelMaps),
          ),
          group(
            "packages",
            "Bultos",
            fieldsFromDefinitions(rawValues, exportPackageFields, labelMaps),
          ),
        ]
      : [
          group(
            "transport",
            "Transporte y documentos",
            fieldsFromDefinitions(rawValues, importTransportFields, labelMaps),
          ),
          group(
            "payment",
            "Pago y cláusula",
            fieldsFromDefinitions(rawValues, importPaymentFields, labelMaps),
          ),
          group(
            "packages",
            "Bultos y almacén",
            [
              ...fieldsFromDefinitions(rawValues, importStorageFields, labelMaps),
              importPackagePairs(rawValues),
            ],
          ),
        ];

  return groups.filter(
    (candidate): candidate is OperationalSourceFieldGroup => candidate !== null,
  );
}
