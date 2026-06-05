import assert from "node:assert/strict";
import test from "node:test";

import {
  cleanPublicDescriptorText,
  cleanPublicText,
  normalizePublicSearchText,
  publicSearchTerms,
} from "../../src/text/public-text";
import { cleanPublicReferenceLabel } from "../../src/text/reference-labels";

test("keeps product description formatting separate from descriptor formatting", () => {
  const raw = "SINTETICOS HANGZHOU FUBU-F AN";

  assert.equal(cleanPublicText(raw), "Sintéticos hangzhou FUBU-F an");
  assert.equal(cleanPublicDescriptorText(raw), "Sintéticos Hangzhou FUBU-F AN");
});

test("keeps reference label formatting separate from product prose formatting", () => {
  const raw = "OTROS PUERTOS DE CHINA NO ESPECIFICADOS";

  assert.equal(cleanPublicText(raw), "Otros puertos de china no especificados");
  assert.equal(
    cleanPublicReferenceLabel(raw),
    "Otros puertos de China no especificados",
  );
});

test("keeps search normalization accent-insensitive and display-free", () => {
  assert.equal(normalizePublicSearchText("Túnez tapicería"), "tunez tapiceria");
  assert.deepEqual(publicSearchTerms("Confección de tapicería"), [
    "confeccion",
    "tapiceria",
  ]);
});

test("does not use reference label rules for brand-like product descriptors", () => {
  assert.equal(
    cleanPublicDescriptorText("SINTETICOS HANGZHOU FUBU-F AN"),
    "Sintéticos Hangzhou FUBU-F AN",
  );
  assert.equal(cleanPublicReferenceLabel("SAN ANTONIO"), "San Antonio");
});
