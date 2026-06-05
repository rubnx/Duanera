import assert from "node:assert/strict";
import test from "node:test";
import { PgDialect } from "drizzle-orm/pg-core";

import {
  buildLogisticsPartyProfileHref,
  filtersToTradeRecordSearchParams,
} from "../../src/trade/trade-record-links";
import {
  logisticsPartyProfileFilters,
} from "../../src/trade/trade-logistics-party-profile";
import {
  logisticsPartyMatchingRecordCountSql,
  logisticsPartySearchInput,
} from "../../src/trade/trade-logistics-party-search";
import {
  parseTradeRecordSearchParams,
  TradeRecordSearchError,
} from "../../src/trade/trade-record-search-params";
import {
  buildTradeRecordWhere,
} from "../../src/trade/trade-record-where";

const dialect = new PgDialect();
const partyId = "11111111-1111-4111-8111-111111111111";

test("builds logistics party profile links", () => {
  assert.equal(
    buildLogisticsPartyProfileHref(partyId),
    `/logistics-parties/${partyId}`,
  );
});

test("builds logistics party explorer filters", () => {
  assert.deepEqual(logisticsPartyProfileFilters(partyId), {
    logisticsPartyId: partyId,
  });
  assert.deepEqual(logisticsPartyProfileFilters(partyId, "issuer"), {
    logisticsPartyId: partyId,
    logisticsRole: "issuer",
  });
  assert.deepEqual(
    filtersToTradeRecordSearchParams(logisticsPartyProfileFilters(partyId, "carrier")),
    {
      logisticsParty: partyId,
      logisticsRole: "carrier",
    },
  );
});

test("parses logistics party search params", () => {
  const filters = parseTradeRecordSearchParams({
    logisticsParty: partyId,
    logisticsRole: "issuer",
  });

  assert.equal(filters.logisticsPartyId, partyId);
  assert.equal(filters.logisticsRole, "issuer");
});

test("rejects unsupported logistics role", () => {
  assert.throws(
    () => parseTradeRecordSearchParams({
      logisticsParty: partyId,
      logisticsRole: "forwarder",
    }),
    TradeRecordSearchError,
  );
});

test("parses logistics party search input", () => {
  const params = new URLSearchParams({
    q: " maersk ",
    limit: "1000",
  });

  assert.deepEqual(logisticsPartySearchInput(params), {
    query: "maersk",
    limit: 50,
  });

  assert.deepEqual(logisticsPartySearchInput(new URLSearchParams("limit=bad")), {
    query: "",
    limit: 20,
  });
});

test("counts logistics search records with the same product-facing predicate", () => {
  const tradeRecordWhere = buildTradeRecordWhere({}, { productFacing: true });

  assert.ok(tradeRecordWhere);
  const query = dialect.sqlToQuery(
    logisticsPartyMatchingRecordCountSql(tradeRecordWhere),
  );

  assert.match(query.sql, /count\(distinct trl\.trade_record_id/);
  assert.match(query.sql, /trl\.party_id = source_logistics_parties\.id/);
  assert.match(query.sql, /source_files/);
  assert.match(query.sql, /source_category/);
  assert.match(query.sql, /period_year/);
  assert.match(query.sql, /period_month/);
});

test("filters trade records with logistics party exists predicate", () => {
  const where = buildTradeRecordWhere(
    {
      logisticsPartyId: partyId,
      logisticsRole: "issuer",
    },
    { productFacing: true },
  );

  assert.ok(where);
  const query = dialect.sqlToQuery(where);
  assert.match(query.sql, /trade_record_logistics_party_links/);
  assert.match(query.sql, /party_id/);
  assert.match(query.sql, /role/);
  assert.deepEqual(
    query.params.filter((param) => param === partyId || param === "issuer"),
    [partyId, "issuer"],
  );
});

test("filters trade records with logistics role only", () => {
  const where = buildTradeRecordWhere({
    logisticsRole: "carrier",
  });

  assert.ok(where);
  const query = dialect.sqlToQuery(where);
  assert.match(query.sql, /trade_record_logistics_party_links/);
  assert.match(query.sql, /role/);
  assert.deepEqual(
    query.params.filter((param) => param === partyId || param === "carrier"),
    ["carrier"],
  );
});
