import assert from "node:assert/strict";
import test from "node:test";

import {
  friendlySourceText,
  productAttributeDisplayFromRaw,
  productAttributeEntries,
  productDisplayFromRaw,
} from "../../src/trade/trade-record-display";
import {
  cleanPublicDescriptorText,
  cleanPublicText,
  normalizePublicSearchText,
} from "../../src/text/public-text";

test("cleans public source text with safe Spanish display rules", () => {
  assert.equal(
    cleanPublicText("CONFECCION DE TAPICERIA"),
    "Confección de tapicería",
  );
  assert.equal(cleanPublicText("100%POLIESTER"), "100% poliéster");
  assert.equal(cleanPublicText("CHO: 1.45MTS"), "Ancho: 1.45 m");
  assert.equal(cleanPublicText("YFELPA2"), "YFELPA2");
  assert.equal(cleanPublicText("54075230"), "54075230");
  assert.equal(cleanPublicText("FUBU-F"), "FUBU-F");
  assert.equal(cleanPublicText("I.D.D.T.-F"), "I.D.D.T.-F");
  assert.equal(cleanPublicText("DE METAL COMUN"), "De metal común");
});

test("cleans descriptor text without lowercasing brand-like tokens", () => {
  assert.equal(
    cleanPublicDescriptorText("SINTETICOS HANGZHOU FUBU-F AN"),
    "Sintéticos Hangzhou FUBU-F AN",
  );
  assert.equal(cleanPublicDescriptorText("CONFECCION DE TAPICERIA"), "Confección de Tapicería");
  assert.equal(cleanPublicDescriptorText("I.D.D.T.-F"), "I.D.D.T.-F");
});

test("normalizes public search text without accents", () => {
  assert.equal(normalizePublicSearchText("tapicería"), "tapiceria");
  assert.equal(normalizePublicSearchText("tapiceria"), "tapiceria");
  assert.equal(
    normalizePublicSearchText("  POLIÉSTER   SINTÉTICO  "),
    "poliester sintetico",
  );
});

test("formats product source description into business-readable fragments", () => {
  const product = productDisplayFromRaw(
    "YFELPA2~TEJIDOS DE HILADOS DE FILAMENTOS~SINTETICOS PARA TAPICERIA",
  );

  assert.equal(product.title, "Tejidos de hilados de filamentos");
  assert.equal(product.titleRaw, "TEJIDOS DE HILADOS DE FILAMENTOS");
  assert.equal(product.sourceReference, "YFELPA2");
  assert.equal(product.description, "Sintéticos para tapicería");
  assert.deepEqual(
    product.fragments.map((fragment) => [
      fragment.key,
      fragment.label,
      fragment.role,
      fragment.value,
      fragment.rawValue,
    ]),
    [
      ["part1", "Referencia fuente", "source_reference", "YFELPA2", "YFELPA2"],
      [
        "part2",
        "Producto fuente",
        "description",
        "Tejidos de hilados de filamentos",
        "TEJIDOS DE HILADOS DE FILAMENTOS",
      ],
      [
        "part3",
        "Descripción complementaria",
        "complementary_description",
        "Sintéticos para tapicería",
        "SINTETICOS PARA TAPICERIA",
      ],
    ],
  );
});

test("cleans all-caps source text for public display without losing raw text", () => {
  assert.equal(
    friendlySourceText(
      "MT.2, 100%POLIESTER CON HILAD OS DE DISTINTOS COLORES, PARA CONFECCION DE TAPICERIA, CORTI NAJES Y OTROS",
    ),
    "M2, 100% poliéster con hilados de distintos colores, para confección de tapicería, cortinajes y otros",
  );

  assert.equal(
    friendlySourceText("CHO: 1.45MTS, PESO: 365 GRAMOS"),
    "Ancho: 1.45 m, peso: 365 gramos",
  );
});

test("normalizes known product attribute keys into semantic display slots", () => {
  const display = productAttributeDisplayFromRaw({
    brand: "SINTETICOS HANGZHOU FUBU-F AN",
    other1: "MT.2, 100%POLIESTER CON HILAD",
    other2: "OS DE DISTINTOS COLORES, PARA",
    variety: "CHO: 1.45MTS, PESO: 365 GRAMOS",
    attribute5: "CONFECCION DE TAPICERIA, CORTI",
    attribute6: "NAJES Y OTROS",
  });

  assert.equal(display.descriptor, "Sintéticos Hangzhou FUBU-F AN");
  assert.equal(display.descriptorRaw, "SINTETICOS HANGZHOU FUBU-F AN");
  assert.equal(display.format, "Ancho: 1.45 m, peso: 365 gramos");
  assert.equal(display.formatRaw, "CHO: 1.45MTS, PESO: 365 GRAMOS");
  assert.equal(
    display.complementaryDescription,
    "M2, 100% poliéster con hilados de distintos colores, para confección de tapicería, cortinajes y otros",
  );
  assert.equal(
    display.complementaryDescriptionRaw,
    "MT.2, 100%POLIESTER CON HILAD OS DE DISTINTOS COLORES, PARA CONFECCION DE TAPICERIA, CORTI NAJES Y OTROS",
  );
  assert.deepEqual(
    productAttributeEntries({
      brand: "SINTETICOS HANGZHOU FUBU-F AN",
      other1: "MT.2, 100%POLIESTER CON HILAD",
      other2: "OS DE DISTINTOS COLORES, PARA",
    }),
    [
      {
        label: "Marca / descriptor",
        value: "Sintéticos Hangzhou FUBU-F AN",
      },
      {
        label: "Descripción complementaria",
        value: "M2, 100% poliéster con hilados de distintos colores, para",
      },
    ],
  );
});

test("keeps unknown product attribute fields out of primary semantic slots", () => {
  const display = productAttributeDisplayFromRaw({
    mysteryParserField: "VALOR FUENTE",
  });

  assert.equal(display.descriptor, undefined);
  assert.equal(display.format, undefined);
  assert.equal(display.complementaryDescription, undefined);
  assert.deepEqual(display.fragments, [
    {
      key: "mysteryParserField",
      label: "Campo fuente sin clasificar",
      role: "unknown",
      value: "Valor fuente",
      rawValue: "VALOR FUENTE",
    },
  ]);
  assert.deepEqual(productAttributeEntries({ mysteryParserField: "VALOR FUENTE" }), [
    {
      label: "Campo fuente sin clasificar",
      value: "Valor fuente",
    },
  ]);
});
