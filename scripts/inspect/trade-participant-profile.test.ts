import assert from "node:assert/strict";
import test from "node:test";
import { PgDialect } from "drizzle-orm/pg-core";

import {
  buildTradeParticipantProfileHref,
} from "../../src/trade/trade-record-links";
import {
  parseTradeParticipantProfileRole,
  tradeParticipantProfileFilters,
  tradeParticipantProfileLabels,
} from "../../src/trade/trade-participant-profile";
import {
  buildTradeRecordWhere,
} from "../../src/trade/trade-record-where";

const dialect = new PgDialect();

function whereQueryForProfile(role: "importer" | "exporter", id: string) {
  const where = buildTradeRecordWhere(
    tradeParticipantProfileFilters(role, id),
    { productFacing: true },
  );

  assert.ok(where);
  return dialect.sqlToQuery(where);
}

test("parses only supported participant profile roles", () => {
  assert.equal(parseTradeParticipantProfileRole("importer"), "importer");
  assert.equal(parseTradeParticipantProfileRole("exporter"), "exporter");
  assert.equal(parseTradeParticipantProfileRole("company"), null);
  assert.equal(parseTradeParticipantProfileRole(undefined), null);
});

test("builds anonymous Aduana profile links", () => {
  assert.equal(
    buildTradeParticipantProfileHref("importer", "1153"),
    "/participants/importer/1153",
  );
  assert.equal(
    buildTradeParticipantProfileHref("exporter", "ABC 123"),
    "/participants/exporter/ABC%20123",
  );
});

test("uses flow-aware anonymous ID labels without identity claims", () => {
  const importer = tradeParticipantProfileLabels("importer", "1153");
  const exporter = tradeParticipantProfileLabels("exporter", "7788");
  const combinedCopy = [
    importer.title,
    importer.participantLabel,
    importer.valueLabel,
    exporter.title,
    exporter.participantLabel,
    exporter.valueLabel,
  ].join(" ");

  assert.equal(importer.title, "Importador ID Aduana 1153");
  assert.equal(importer.valueLabel, "US$ CIF");
  assert.equal(exporter.title, "Exportador ID Aduana 7788");
  assert.equal(exporter.valueLabel, "US$ FOB");
  assert.doesNotMatch(combinedCopy.toLowerCase(), /rut|probable|empresa|company/);
});

test("importer profile filters by importer correlative only", () => {
  assert.deepEqual(tradeParticipantProfileFilters("importer", "1153"), {
    tradeFlow: "import",
    importerCorrelativeId: "1153",
  });

  const query = whereQueryForProfile("importer", "1153");
  assert.match(query.sql, /"trade_records"."importer_correlative_id" =/);
  assert.doesNotMatch(query.sql, /exporter_primary_correlative_id/);
  assert.deepEqual(query.params.filter((param) => param === "1153"), ["1153"]);
});

test("exporter profile matches primary or secondary exporter correlative", () => {
  assert.deepEqual(tradeParticipantProfileFilters("exporter", "7788"), {
    tradeFlow: "export",
    exporterCorrelativeId: "7788",
  });

  const query = whereQueryForProfile("exporter", "7788");
  assert.match(query.sql, /"trade_records"."exporter_primary_correlative_id" =/);
  assert.match(query.sql, /"trade_records"."exporter_secondary_correlative_id" =/);
  assert.deepEqual(query.params.filter((param) => param === "7788"), [
    "7788",
    "7788",
  ]);
});
