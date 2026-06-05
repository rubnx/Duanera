import assert from "node:assert/strict";
import test from "node:test";

import {
  emptyOperationalCodeLabelMaps,
  operationalCodeLabel,
} from "../../src/trade/trade-record-operational-code-labels";
import { operationalSourceFieldGroups } from "../../src/trade/trade-record-operational-fields";

test("maps import operational source fields into display groups", () => {
  const groups = operationalSourceFieldGroups("import", {
    GNOM_CIA_T: "CMA CGM",
    CODPAISCIA: "250",
    NUM_MANIF: "266301",
    FEC_MANIF: "25012026",
    NUM_CONOC: "ABC123",
    FEC_CONOC: "26012026",
    NOMEMISOR: "CMA CGM CHILE",
    FORM_PAGO: "11",
    CL_COMPRA: "FOB",
    TOT_BULTOS: "32",
    ID_BULTOS: "CONTENEDOR",
    TPO_BUL1: "32",
    CANT_BUL1: "2",
    TPO_BUL2: "",
    CANT_BUL2: "",
    ALMACEN: "PARTICULAR",
    FEC_ALMAC: "00000000",
  });

  assert.deepEqual(
    groups.map((group) => [group.key, group.fields.map((field) => field.key)]),
    [
      [
        "transport",
        [
          "transportCompany",
          "transportCompanyCountry",
          "manifestNumber",
          "manifestDate",
          "transportDocumentNumber",
          "transportDocumentDate",
          "transportDocumentIssuer",
        ],
      ],
      ["payment", ["paymentForm", "saleClause"]],
      ["packages", ["packageTotal", "packageIdentifier", "warehouse", "packageDetail"]],
    ],
  );

  assert.equal(groups[0]?.fields.find((field) => field.key === "manifestDate")?.value, "2026-01-25");
  assert.equal(
    groups[2]?.fields.find((field) => field.key === "packageDetail")?.value,
    "Código Aduana 32: 2",
  );
  assert.equal(
    groups.flatMap((group) => group.fields).some((field) => field.sourceField === "FEC_ALMAC"),
    false,
  );
});

test("maps export operational source fields without identity claims", () => {
  const groups = operationalSourceFieldGroups("export", {
    NOMBRECIATRANSP: "MAERSK LINE",
    PAISCIATRANSP: "208",
    NOMBREEMISORDOCTRANSP: "MAERSK CHILE S.A.",
    NUMERODOCTOCANCELA: "DOC-1",
    FECHADOCTOCANCELA: "15042026",
    FORMAPAGO: "1",
    CLAUSULAVENTA: "FOB",
    TOTALBULTOS: "10",
    TOTALBULTOSCANCELA: "",
  });

  assert.deepEqual(
    groups.map((group) => [group.key, group.fields.map((field) => field.sourceField)]),
    [
      [
        "transport",
        [
          "NOMBRECIATRANSP",
          "PAISCIATRANSP",
          "NOMBREEMISORDOCTRANSP",
          "NUMERODOCTOCANCELA",
          "FECHADOCTOCANCELA",
        ],
      ],
      ["payment", ["FORMAPAGO", "CLAUSULAVENTA"]],
      ["packages", ["TOTALBULTOS"]],
    ],
  );
  assert.equal(groups[0]?.fields.find((field) => field.key === "cancelingDocumentDate")?.value, "2026-04-15");
  assert.equal(
    groups.flatMap((group) => group.fields).some((field) => /importador|exportador/i.test(field.label)),
    false,
  );
});

test("decodes official operational codes and labels unknown source codes", () => {
  const labelMaps = emptyOperationalCodeLabelMaps();
  labelMaps["chile_aduana:paises"].set("250", "Martinica");
  labelMaps["chile_aduana:clausulas_de_compra_venta"].set(
    "11",
    "TRANSPORTE PAGADO HASTA",
  );

  const groups = operationalSourceFieldGroups(
    "import",
    {
      CODPAISCIA: "250",
      FORM_PAGO: "32",
      CL_COMPRA: "11",
      TPO_BUL1: "74",
      CANT_BUL1: "1",
    },
    labelMaps,
  );
  const fields = groups.flatMap((group) => group.fields);

  assert.equal(
    fields.find((field) => field.key === "transportCompanyCountry")?.value,
    "250 · Martinica",
  );
  assert.equal(
    fields.find((field) => field.key === "saleClause")?.value,
    "11 · Transporte pagado hasta",
  );
  assert.equal(
    fields.find((field) => field.key === "paymentForm")?.value,
    "Código Aduana 32",
  );
  assert.equal(
    fields.find((field) => field.key === "packageDetail")?.value,
    "Código Aduana 74: 1",
  );
  labelMaps["chile_aduana:paises"].set("784", "EMIRATOS ARABES UNIDOS");
  assert.equal(
    operationalCodeLabel(labelMaps, "CODPAISCIA", "784"),
    "784 · Emiratos Árabes Unidos",
  );
});

test("returns no groups when no raw values are available", () => {
  assert.deepEqual(operationalSourceFieldGroups("import", null), []);
  assert.deepEqual(operationalSourceFieldGroups("export", {}), []);
});
