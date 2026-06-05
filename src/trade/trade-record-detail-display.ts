import { formatTradeCurrencyLabel, formatTradeDecimal } from "@/trade/trade-record-format";
import type {
  OperationalSourceField,
  OperationalSourceFieldGroup,
} from "@/trade/trade-record-operational-fields";

export type PromotedOperationalSourceFieldDefinition = {
  key: string;
  label: string;
  help: string;
};

export type PromotedOperationalSourceField =
  PromotedOperationalSourceFieldDefinition & {
    field: OperationalSourceField;
  };

export const promotedLogisticsOperationalFieldDefinitions = [
  {
    key: "transportCompany",
    label: "Compañía de transporte",
    help:
      "Nombre del transportista leído desde la fila Aduana preservada. No es identidad legal del importador/exportador.",
  },
  {
    key: "transportDocumentIssuer",
    label: "Emisor documento transporte",
    help:
      "Entidad que emite el documento de transporte según la fuente. Puede actuar como operador documental o logístico, no como identidad legal del importador/exportador.",
  },
  {
    key: "transportCompanyCountry",
    label: "País compañía transporte",
    help: "País asociado a la compañía de transporte según el campo operativo de fuente.",
  },
  {
    key: "paymentForm",
    label: "Forma de pago",
    help: "Forma de pago declarada en la operación según la fila Aduana preservada.",
  },
  {
    key: "saleClause",
    label: "Cláusula",
    help: "Cláusula de compra o venta informada por la fuente, equivalente operacional del Incoterm cuando está disponible.",
  },
  {
    key: "packageDetail",
    label: "Tipo de bulto",
    help: "Detalle de tipos y cantidades de bultos reconstruido desde los campos TPO_BUL y CANT_BUL de la fuente.",
  },
  {
    key: "packageTotal",
    label: "Cantidad de bultos",
    help: "Total de bultos informado por la fuente para la operación.",
  },
  {
    key: "manifestNumber",
    label: "Nro. manifiesto",
    help: "Número de manifiesto asociado al transporte cuando la fuente lo informa.",
  },
  {
    key: "manifestDate",
    label: "Fecha manifiesto",
    help: "Fecha del manifiesto de transporte informada por la fuente.",
  },
  {
    key: "transportDocumentNumber",
    label: "Nro. documento transporte",
    help: "Número del documento de transporte informado por la fuente.",
  },
  {
    key: "transportDocumentDate",
    label: "Fecha documento transporte",
    help: "Fecha del documento de transporte informada por la fuente.",
  },
  {
    key: "warehouse",
    label: "Almacén",
    help: "Almacén informado por la fuente para la operación.",
  },
  {
    key: "warehouseDate",
    label: "Fecha almacén",
    help: "Fecha de almacén informada por la fuente.",
  },
] satisfies PromotedOperationalSourceFieldDefinition[];

export function formatDetailMoneyValue(
  value: string | null,
  currency?: string | null,
  fallback = "No informado",
) {
  if (!value) {
    return fallback;
  }

  const formattedValue = formatTradeDecimal(value, 2, value);
  const currencyLabel = formatTradeCurrencyLabel(currency);

  return currencyLabel ? `${currencyLabel} ${formattedValue}` : formattedValue;
}

export function formatDetailWeightKg(value: string | null, fallback = "No informado") {
  if (!value) {
    return fallback;
  }

  return `${formatTradeDecimal(value, 2, value)} kg`;
}

export function findOperationalSourceField(
  groups: OperationalSourceFieldGroup[],
  key: string,
): OperationalSourceField | null {
  for (const group of groups) {
    const field = group.fields.find((candidate) => candidate.key === key);

    if (field) {
      return field;
    }
  }

  return null;
}

export function promotedLogisticsOperationalSourceFields(
  groups: OperationalSourceFieldGroup[],
): PromotedOperationalSourceField[] {
  return promotedLogisticsOperationalFieldDefinitions
    .map((definition): PromotedOperationalSourceField | null => {
      const field = findOperationalSourceField(groups, definition.key);

      if (!field) {
        return null;
      }

      return {
        ...definition,
        field,
      };
    })
    .filter((field): field is PromotedOperationalSourceField => field !== null);
}
