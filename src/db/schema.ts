import {
  bigint,
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
};

export const sourceFiles = pgTable(
  "source_files",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    countryCode: varchar("country_code", { length: 2 }).notNull(),
    sourceSystem: text("source_system").notNull(),
    sourceDomain: text("source_domain").notNull(),
    sourceName: text("source_name"),
    sourcePageUrl: text("source_page_url"),
    resourceDownloadUrl: text("resource_download_url"),
    acquisitionMethod: text("acquisition_method"),
    originalFilename: text("original_filename").notNull(),
    normalizedRawFilename: text("normalized_raw_filename"),
    normalizedWorkingFilename: text("normalized_working_filename"),
    storageBucket: text("storage_bucket"),
    storageKey: text("storage_key"),
    workingStorageKey: text("working_storage_key"),
    fileHashSha256: text("file_hash_sha256"),
    fileSizeBytes: bigint("file_size_bytes", { mode: "number" }),
    fileFormat: text("file_format"),
    compressionFormat: text("compression_format"),
    fileRole: text("file_role").notNull(),
    tradeFlow: text("trade_flow"),
    sourceCategory: text("source_category"),
    periodYear: integer("period_year"),
    periodMonth: integer("period_month"),
    periodStart: date("period_start"),
    periodEnd: date("period_end"),
    licenseNotes: text("license_notes"),
    processingStatus: text("processing_status").notNull().default("pending"),
    parentSourceFileId: uuid("parent_source_file_id").references(
      (): AnyPgColumn => sourceFiles.id,
    ),
    ...timestamps,
  },
  (table) => [
    index("source_files_source_domain_idx").on(table.sourceDomain),
    index("source_files_file_role_idx").on(table.fileRole),
    index("source_files_trade_flow_period_idx").on(
      table.tradeFlow,
      table.periodYear,
      table.periodMonth,
    ),
    index("source_files_hash_idx").on(table.fileHashSha256),
    index("source_files_parent_idx").on(table.parentSourceFileId),
  ],
);

export const importBatches = pgTable(
  "import_batches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sourceFileId: uuid("source_file_id")
      .notNull()
      .references(() => sourceFiles.id, { onDelete: "restrict" }),
    parserName: text("parser_name").notNull(),
    parserVersion: text("parser_version").notNull(),
    status: text("status").notNull().default("pending"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    rowsTotal: integer("rows_total"),
    rowsParsed: integer("rows_parsed"),
    rowsFailed: integer("rows_failed"),
    warningSummary: text("warning_summary"),
    errorSummary: text("error_summary"),
    ...timestamps,
  },
  (table) => [
    index("import_batches_source_file_idx").on(table.sourceFileId),
    index("import_batches_status_idx").on(table.status),
    index("import_batches_parser_idx").on(table.parserName, table.parserVersion),
  ],
);

export const sourceLayouts = pgTable(
  "source_layouts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    countryCode: varchar("country_code", { length: 2 }).notNull(),
    sourceSystem: text("source_system").notNull(),
    sourceDomain: text("source_domain"),
    tradeFlow: text("trade_flow"),
    recordRole: text("record_role").notNull(),
    layoutName: text("layout_name").notNull(),
    layoutVersion: text("layout_version"),
    sourceFileId: uuid("source_file_id").references(() => sourceFiles.id, {
      onDelete: "restrict",
    }),
    dictionarySourceFileId: uuid("dictionary_source_file_id").references(
      () => sourceFiles.id,
      { onDelete: "restrict" },
    ),
    fieldCount: integer("field_count").notNull(),
    delimiter: text("delimiter"),
    hasHeader: boolean("has_header").notNull().default(false),
    encoding: text("encoding"),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("source_layouts_identity_idx").on(
      table.sourceSystem,
      table.sourceDomain,
      table.tradeFlow,
      table.recordRole,
      table.layoutName,
      table.layoutVersion,
    ),
    index("source_layouts_source_file_idx").on(table.sourceFileId),
    index("source_layouts_dictionary_source_file_idx").on(table.dictionarySourceFileId),
  ],
);

export const sourceLayoutFields = pgTable(
  "source_layout_fields",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sourceLayoutId: uuid("source_layout_id")
      .notNull()
      .references(() => sourceLayouts.id, { onDelete: "cascade" }),
    fieldOrdinal: integer("field_ordinal").notNull(),
    sourceFieldName: text("source_field_name").notNull(),
    sourceDescriptionEs: text("source_description_es"),
    sourceType: text("source_type"),
    sourceLength: integer("source_length"),
    sourcePrecision: integer("source_precision"),
    isCoded: boolean("is_coded").notNull().default(false),
    codeTableKey: text("code_table_key"),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("source_layout_fields_ordinal_idx").on(
      table.sourceLayoutId,
      table.fieldOrdinal,
    ),
    uniqueIndex("source_layout_fields_name_idx").on(
      table.sourceLayoutId,
      table.sourceFieldName,
    ),
    index("source_layout_fields_code_table_key_idx").on(table.codeTableKey),
  ],
);

export const rawTradeRows = pgTable(
  "raw_trade_rows",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sourceFileId: uuid("source_file_id")
      .notNull()
      .references(() => sourceFiles.id, { onDelete: "restrict" }),
    importBatchId: uuid("import_batch_id")
      .notNull()
      .references(() => importBatches.id, { onDelete: "restrict" }),
    sourceLayoutId: uuid("source_layout_id").references(() => sourceLayouts.id, {
      onDelete: "restrict",
    }),
    tradeFlow: text("trade_flow"),
    periodYear: integer("period_year"),
    periodMonth: integer("period_month"),
    rowNumber: integer("row_number").notNull(),
    fieldCount: integer("field_count"),
    rawText: text("raw_text"),
    rawValues: jsonb("raw_values"),
    rowHashSha256: text("row_hash_sha256").notNull(),
    payloadRetentionMode: text("payload_retention_mode").notNull().default("full_postgres"),
    payloadStorageKind: text("payload_storage_kind").notNull().default("postgres"),
    payloadStorageBucket: text("payload_storage_bucket"),
    payloadStorageKey: text("payload_storage_key"),
    payloadHashSha256: text("payload_hash_sha256"),
    payloadRetainedReason: text("payload_retained_reason"),
    payloadPrunedAt: timestamp("payload_pruned_at", { withTimezone: true }),
    payloadReconstructable: boolean("payload_reconstructable").notNull().default(true),
    parseStatus: text("parse_status").notNull().default("pending"),
    parseErrors: jsonb("parse_errors"),
    parseWarnings: jsonb("parse_warnings"),
    parserName: text("parser_name"),
    parserVersion: text("parser_version"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("raw_trade_rows_source_file_row_number_idx").on(
      table.sourceFileId,
      table.rowNumber,
    ),
    index("raw_trade_rows_import_batch_idx").on(table.importBatchId),
    index("raw_trade_rows_source_file_idx").on(table.sourceFileId),
    index("raw_trade_rows_source_layout_idx").on(table.sourceLayoutId),
    index("raw_trade_rows_trade_flow_period_idx").on(
      table.tradeFlow,
      table.periodYear,
      table.periodMonth,
    ),
    index("raw_trade_rows_trade_flow_period_row_number_idx").on(
      table.tradeFlow,
      table.periodYear,
      table.periodMonth,
      table.rowNumber,
      table.id,
    ),
    index("raw_trade_rows_row_hash_idx").on(table.rowHashSha256),
    index("raw_trade_rows_payload_retention_idx").on(table.payloadRetentionMode),
    index("raw_trade_rows_parse_status_idx").on(table.parseStatus),
  ],
);

export const codeTables = pgTable(
  "code_tables",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    codeTableKey: text("code_table_key").notNull(),
    countryCode: varchar("country_code", { length: 2 }).notNull(),
    sourceSystem: text("source_system").notNull(),
    sourceDomain: text("source_domain").notNull(),
    tableName: text("table_name").notNull(),
    sourceSheetName: text("source_sheet_name"),
    sourceFileId: uuid("source_file_id").references(() => sourceFiles.id, {
      onDelete: "restrict",
    }),
    reviewStatus: text("review_status").notNull().default("seeded"),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("code_tables_key_idx").on(table.codeTableKey),
    index("code_tables_source_file_idx").on(table.sourceFileId),
  ],
);

export const codeValues = pgTable(
  "code_values",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    codeTableId: uuid("code_table_id")
      .notNull()
      .references(() => codeTables.id, { onDelete: "cascade" }),
    codeValue: text("code_value").notNull(),
    labelEs: text("label_es"),
    normalizedLabelEs: text("normalized_label_es"),
    validFrom: date("valid_from"),
    validTo: date("valid_to"),
    sortOrder: integer("sort_order"),
    metadata: jsonb("metadata"),
    reviewStatus: text("review_status").notNull().default("seeded"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("code_values_table_value_idx").on(table.codeTableId, table.codeValue),
    index("code_values_code_value_idx").on(table.codeValue),
    index("code_values_normalized_label_idx").on(table.normalizedLabelEs),
  ],
);

export const sourceTradeParticipants = pgTable(
  "source_trade_participants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tradeFlow: text("trade_flow").notNull(),
    participantRole: text("participant_role").notNull(),
    sourceCorrelativeId: text("source_correlative_id").notNull(),
    firstSeenYear: integer("first_seen_year"),
    firstSeenMonth: integer("first_seen_month"),
    lastSeenYear: integer("last_seen_year"),
    lastSeenMonth: integer("last_seen_month"),
    recordCount: integer("record_count").notNull().default(0),
    crossYearStabilityStatus: text("cross_year_stability_status").notNull().default("unknown"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("source_trade_participants_identity_idx").on(
      table.tradeFlow,
      table.participantRole,
      table.sourceCorrelativeId,
    ),
    index("source_trade_participants_correlative_idx").on(table.sourceCorrelativeId),
  ],
);

export const sourceLogisticsParties = pgTable(
  "source_logistics_parties",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    identityKey: text("identity_key").notNull(),
    displayName: text("display_name").notNull(),
    rawNameRepresentative: text("raw_name_representative"),
    normalizedLegalEntityName: text("normalized_legal_entity_name"),
    normalizedGroupName: text("normalized_group_name"),
    countryCode: varchar("country_code", { length: 2 }),
    entityType: text("entity_type"),
    confidence: text("confidence").notNull().default("low"),
    matchReason: text("match_reason"),
    isAmbiguous: boolean("is_ambiguous").notNull().default(false),
    identitySource: text("identity_source").notNull(),
    firstSeenYear: integer("first_seen_year"),
    firstSeenMonth: integer("first_seen_month"),
    lastSeenYear: integer("last_seen_year"),
    lastSeenMonth: integer("last_seen_month"),
    recordCount: integer("record_count").notNull().default(0),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("source_logistics_parties_identity_idx").on(table.identityKey),
    index("source_logistics_parties_display_name_idx").on(table.displayName),
    index("source_logistics_parties_group_idx").on(table.normalizedGroupName),
  ],
);

export const sourceLogisticsPartyAliases = pgTable(
  "source_logistics_party_aliases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    partyId: uuid("party_id")
      .notNull()
      .references(() => sourceLogisticsParties.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    sourceField: text("source_field").notNull(),
    rawValue: text("raw_value").notNull(),
    rawValueNormalized: text("raw_value_normalized").notNull(),
    sourceRut: text("source_rut"),
    sourceRutDv: text("source_rut_dv"),
    sourceCountryCode: text("source_country_code"),
    firstSeenYear: integer("first_seen_year"),
    firstSeenMonth: integer("first_seen_month"),
    lastSeenYear: integer("last_seen_year"),
    lastSeenMonth: integer("last_seen_month"),
    recordCount: integer("record_count").notNull().default(0),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("source_logistics_party_aliases_identity_idx").on(
      table.partyId,
      table.role,
      table.sourceField,
      table.rawValueNormalized,
    ),
    index("source_logistics_party_aliases_party_idx").on(table.partyId),
    index("source_logistics_party_aliases_raw_value_idx").on(table.rawValueNormalized),
  ],
);

export const tradeRecords = pgTable(
  "trade_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sourceFileId: uuid("source_file_id")
      .notNull()
      .references(() => sourceFiles.id, { onDelete: "restrict" }),
    importBatchId: uuid("import_batch_id")
      .notNull()
      .references(() => importBatches.id, { onDelete: "restrict" }),
    rawTradeRowId: uuid("raw_trade_row_id")
      .notNull()
      .references(() => rawTradeRows.id, { onDelete: "restrict" }),
    importerParticipantId: uuid("importer_participant_id").references(
      () => sourceTradeParticipants.id,
      { onDelete: "restrict" },
    ),
    exporterPrimaryParticipantId: uuid("exporter_primary_participant_id").references(
      () => sourceTradeParticipants.id,
      { onDelete: "restrict" },
    ),
    exporterSecondaryParticipantId: uuid("exporter_secondary_participant_id").references(
      () => sourceTradeParticipants.id,
      { onDelete: "restrict" },
    ),
    tradeFlow: text("trade_flow").notNull(),
    periodYear: integer("period_year").notNull(),
    periodMonth: integer("period_month").notNull(),
    declarationIdRaw: text("declaration_id_raw"),
    itemNumber: integer("item_number"),
    acceptanceDateRaw: text("acceptance_date_raw"),
    acceptanceDate: date("acceptance_date"),
    importerCorrelativeId: text("importer_correlative_id"),
    exporterPrimaryCorrelativeId: text("exporter_primary_correlative_id"),
    exporterSecondaryCorrelativeId: text("exporter_secondary_correlative_id"),
    hsCodeRaw: text("hs_code_raw"),
    hsCodeNormalized: text("hs_code_normalized"),
    productDescriptionRaw: text("product_description_raw"),
    productAttributes: jsonb("product_attributes"),
    productSearchText: text("product_search_text"),
    quantity: numeric("quantity", { precision: 18, scale: 6 }),
    quantityUnitCode: text("quantity_unit_code"),
    grossWeightTotal: numeric("gross_weight_total", { precision: 18, scale: 6 }),
    grossWeightItem: numeric("gross_weight_item", { precision: 18, scale: 6 }),
    itemCifValue: numeric("item_cif_value", { precision: 18, scale: 2 }),
    itemFobValue: numeric("item_fob_value", { precision: 18, scale: 2 }),
    declarationFobValue: numeric("declaration_fob_value", { precision: 18, scale: 2 }),
    freightValue: numeric("freight_value", { precision: 18, scale: 2 }),
    insuranceValue: numeric("insurance_value", { precision: 18, scale: 2 }),
    cifValue: numeric("cif_value", { precision: 18, scale: 2 }),
    unitPriceValue: numeric("unit_price_value", { precision: 18, scale: 6 }),
    currencyCodeRaw: text("currency_code_raw"),
    originCountryCode: text("origin_country_code"),
    acquisitionCountryCode: text("acquisition_country_code"),
    consignmentCountryCode: text("consignment_country_code"),
    destinationCountryCode: text("destination_country_code"),
    destinationCountryLabelRaw: text("destination_country_label_raw"),
    customsOfficeCode: text("customs_office_code"),
    embarkPortCode: text("embark_port_code"),
    embarkPortLabelRaw: text("embark_port_label_raw"),
    disembarkPortCode: text("disembark_port_code"),
    disembarkPortLabelRaw: text("disembark_port_label_raw"),
    transportModeCode: text("transport_mode_code"),
    cargoTypeCode: text("cargo_type_code"),
    parserName: text("parser_name").notNull(),
    parserVersion: text("parser_version").notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("trade_records_raw_trade_row_idx").on(table.rawTradeRowId),
    index("trade_records_source_file_idx").on(table.sourceFileId),
    index("trade_records_import_batch_idx").on(table.importBatchId),
    index("trade_records_trade_flow_period_idx").on(
      table.tradeFlow,
      table.periodYear,
      table.periodMonth,
    ),
    index("trade_records_trade_flow_period_origin_country_idx").on(
      table.tradeFlow,
      table.periodYear,
      table.periodMonth,
      table.originCountryCode,
    ),
    index("trade_records_trade_flow_period_destination_country_idx").on(
      table.tradeFlow,
      table.periodYear,
      table.periodMonth,
      table.destinationCountryCode,
    ),
    index("trade_records_trade_flow_period_customs_office_idx").on(
      table.tradeFlow,
      table.periodYear,
      table.periodMonth,
      table.customsOfficeCode,
    ),
    index("trade_records_trade_flow_period_transport_mode_idx").on(
      table.tradeFlow,
      table.periodYear,
      table.periodMonth,
      table.transportModeCode,
    ),
    index("trade_records_trade_flow_period_embark_port_idx").on(
      table.tradeFlow,
      table.periodYear,
      table.periodMonth,
      table.embarkPortCode,
    ),
    index("trade_records_trade_flow_period_disembark_port_idx").on(
      table.tradeFlow,
      table.periodYear,
      table.periodMonth,
      table.disembarkPortCode,
    ),
    index("trade_records_trade_flow_period_cargo_type_idx").on(
      table.tradeFlow,
      table.periodYear,
      table.periodMonth,
      table.cargoTypeCode,
    ),
    index("trade_records_hs_code_idx").on(table.hsCodeNormalized),
    index("trade_records_product_search_trgm_idx").using(
      "gin",
      table.productSearchText.op("gin_trgm_ops"),
    ),
    index("trade_records_importer_correlative_idx").on(table.importerCorrelativeId),
    index("trade_records_exporter_primary_correlative_idx").on(
      table.exporterPrimaryCorrelativeId,
    ),
    index("trade_records_exporter_secondary_correlative_idx").on(
      table.exporterSecondaryCorrelativeId,
    ),
  ],
);

export const tradeRecordLogisticsPartyLinks = pgTable(
  "trade_record_logistics_party_links",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tradeRecordId: uuid("trade_record_id")
      .notNull()
      .references(() => tradeRecords.id, { onDelete: "cascade" }),
    partyId: uuid("party_id")
      .notNull()
      .references(() => sourceLogisticsParties.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    sourceField: text("source_field").notNull(),
    rawValue: text("raw_value").notNull(),
    sourceRut: text("source_rut"),
    sourceRutDv: text("source_rut_dv"),
    sourceCountryCode: text("source_country_code"),
    tradeFlow: text("trade_flow").notNull(),
    periodYear: integer("period_year").notNull(),
    periodMonth: integer("period_month").notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("trade_record_logistics_party_links_identity_idx").on(
      table.tradeRecordId,
      table.partyId,
      table.role,
      table.sourceField,
    ),
    index("trade_record_logistics_party_links_record_idx").on(table.tradeRecordId),
    index("trade_record_logistics_party_links_party_idx").on(table.partyId),
    index("trade_record_logistics_party_links_party_role_idx").on(
      table.partyId,
      table.role,
    ),
    index("trade_record_logistics_party_links_flow_period_idx").on(
      table.tradeFlow,
      table.periodYear,
      table.periodMonth,
    ),
  ],
);
