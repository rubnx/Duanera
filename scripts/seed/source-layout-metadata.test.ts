import assert from "node:assert/strict";
import test from "node:test";

import { codeTableKeyForSourceField } from "./source-layout-metadata";

test("maps source layout coded fields to existing Aduana code-table keys", () => {
  assert.equal(codeTableKeyForSourceField("ADU"), "chile_aduana:aduanas");
  assert.equal(codeTableKeyForSourceField("PTO_DESEM"), "chile_aduana:puertos");
  assert.equal(codeTableKeyForSourceField("PUERTOEMBARQUE"), "chile_aduana:puertos");
  assert.equal(codeTableKeyForSourceField("VIA_TRAN"), "chile_aduana:vias_de_transporte");
  assert.equal(codeTableKeyForSourceField("VIATRANSPORTE"), "chile_aduana:vias_de_transporte");
  assert.equal(codeTableKeyForSourceField("PA_ORIG"), "chile_aduana:paises");
  assert.equal(codeTableKeyForSourceField("PAISDESTINO"), "chile_aduana:paises");
  assert.equal(codeTableKeyForSourceField("MONEDA"), "chile_aduana:moneda");
  assert.equal(codeTableKeyForSourceField("UNIDMER"), "chile_aduana:unidades_de_medida");
});

test("does not invent code-table keys for coded fields without a seeded dictionary", () => {
  assert.equal(codeTableKeyForSourceField("CODCOMUN"), null);
  assert.equal(codeTableKeyForSourceField("CODCOMRS"), null);
  assert.equal(codeTableKeyForSourceField("FORM_PAGO"), null);
  assert.equal(codeTableKeyForSourceField("CODIGOOBSERVACION1"), null);
});
