import test from "node:test";
import assert from "node:assert/strict";

import {
  findOperationalSourceField,
  formatDetailMoneyValue,
  formatDetailWeightKg,
  promotedLogisticsOperationalSourceFields,
} from "../../src/trade/trade-record-detail-display";

test("formats drawer money with currency in the value", () => {
  assert.equal(formatDetailMoneyValue("13720.45", "DÓLAR"), "US$ 13.720,45");
  assert.equal(formatDetailMoneyValue(null, "DÓLAR"), "No informado");
});

test("formats drawer weight with kilograms", () => {
  assert.equal(formatDetailWeightKg("172.52"), "172,52 kg");
  assert.equal(formatDetailWeightKg(null), "No informado");
});

test("finds promoted operational logistics fields by key", () => {
  const field = findOperationalSourceField(
    [
      {
        key: "transport",
        title: "Transporte y documentos",
        fields: [
          {
            key: "transportCompany",
            label: "Compañía de transporte",
            sourceField: "GNOM_CIA_T",
            value: "Hapag lloyd",
          },
        ],
      },
    ],
    "transportCompany",
  );

  assert.equal(field?.value, "Hapag lloyd");
  assert.equal(findOperationalSourceField([], "transportCompany"), null);
});

test("promotes high-signal logistics source fields in drawer order", () => {
  const fields = promotedLogisticsOperationalSourceFields([
    {
      key: "transport",
      title: "Transporte y documentos",
      fields: [
        {
          key: "transportDocumentNumber",
          label: "Nro. documento transporte",
          sourceField: "NUM_CONOC",
          value: "DOC-123",
        },
        {
          key: "transportCompany",
          label: "Compañía de transporte",
          sourceField: "GNOM_CIA_T",
          value: "Hapag lloyd",
        },
      ],
    },
    {
      key: "packages",
      title: "Bultos y almacén",
      fields: [
        {
          key: "packageDetail",
          label: "Detalle bultos",
          sourceField: "TPO_BUL1-CANT_BUL8",
          value: "Cajas: 3",
        },
        {
          key: "packageTotal",
          label: "Total bultos",
          sourceField: "TOT_BULTOS",
          value: "3",
        },
      ],
    },
    {
      key: "payment",
      title: "Pago y cláusula",
      fields: [
        {
          key: "paymentForm",
          label: "Forma de pago",
          sourceField: "FORM_PAGO",
          value: "Contado",
        },
      ],
    },
  ]);

  assert.deepEqual(
    fields.map((field) => field.label),
    [
      "Compañía de transporte",
      "Forma de pago",
      "Tipo de bulto",
      "Cantidad de bultos",
      "Nro. documento transporte",
    ],
  );
  assert.equal(fields.find((field) => field.key === "packageDetail")?.field.value, "Cajas: 3");
});
