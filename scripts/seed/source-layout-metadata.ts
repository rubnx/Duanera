import { config } from "dotenv";
import { and, eq } from "drizzle-orm";

import {
  sourceFiles,
  sourceLayoutFields,
  sourceLayouts,
} from "../../src/db/schema";
import { assertDevDatabaseTarget } from "../../src/db/dev-guard";

config({ path: ".env.local" });
config();
assertDevDatabaseTarget("source-layout-metadata seed");

const { db } = await import("../../src/db/client");

const DATA_DICTIONARY_URL =
  "https://datos.gob.cl/dataset/8e686c07-1e86-476e-87eb-d7dd243340a6/resource/792ca993-e4e4-4b83-a965-7aafca93fe2f/download/campos-de-dus-y-din-para-archivos-de-datos-abiertos-v2.0.xlsx";

const DATA_DICTIONARY_PAGE_URL =
  "https://datos.gob.cl/dataset/diccionario-de-datos-para-datos-abiertos-aduana";

const importFieldNames = [
  "NUMENCRIPTADO",
  "TIPO_DOCTO",
  "ADU",
  "FORM",
  "FECVENCI",
  "CODCOMUN",
  "NUM_UNICO_IMPORTADOR",
  "CODPAISCON",
  "DESDIRALM",
  "CODCOMRS",
  "ADUCTROL",
  "NUMPLAZO",
  "INDPARCIAL",
  "NUMHOJINS",
  "TOTINSUM",
  "CODALMA",
  "NUM_RS",
  "FEC_RS",
  "ADUA_RS",
  "NUMHOJANE",
  "NUM_SEC",
  "PA_ORIG",
  "PA_ADQ",
  "VIA_TRAN",
  "TRANSB",
  "PTO_EMB",
  "PTO_DESEM",
  "TPO_CARGA",
  "ALMACEN",
  "FEC_ALMAC",
  "FECRETIRO",
  "NU_REGR",
  "ANO_REG",
  "CODVISBUEN",
  "NUMREGLA",
  "NUMANORES",
  "CODULTVB",
  "PAGO_GRAV",
  "FECTRA",
  "FECACEP",
  "GNOM_CIA_T",
  "CODPAISCIA",
  "NUMRUTCIA",
  "DIGVERCIA",
  "NUM_MANIF",
  "NUM_MANIF1",
  "NUM_MANIF2",
  "FEC_MANIF",
  "NUM_CONOC",
  "FEC_CONOC",
  "NOMEMISOR",
  "NUMRUTEMI",
  "DIGVEREMI",
  "GREG_IMP",
  "REG_IMP",
  "BCO_COM",
  "CODORDIV",
  "FORM_PAGO",
  "NUMDIAS",
  "VALEXFAB",
  "MONEDA",
  "MONGASFOB",
  "CL_COMPRA",
  "TOT_ITEMS",
  "FOB",
  "TOT_HOJAS",
  "COD_FLE",
  "FLETE",
  "TOT_BULTOS",
  "COD_SEG",
  "SEGURO",
  "TOT_PESO",
  "CIF",
  "NUM_AUT",
  "FEC_AUT",
  "GBCOCEN",
  "ID_BULTOS",
  "TPO_BUL1",
  "CANT_BUL1",
  "TPO_BUL2",
  "CANT_BUL2",
  "TPO_BUL3",
  "CANT_BUL3",
  "TPO_BUL4",
  "CANT_BUL4",
  "TPO_BUL5",
  "CANT_BUL5",
  "TPO_BUL6",
  "CANT_BUL6",
  "TPO_BUL7",
  "CANT_BUL7",
  "TPO_BUL8",
  "CANT_BUL8",
  "CTA_OTRO",
  "MON_OTRO",
  "CTA_OTR1",
  "MON_OTR1",
  "CTA_OTR2",
  "MON_OTR2",
  "CTA_OTR3",
  "MON_OTR3",
  "CTA_OTR4",
  "MON_OTR4",
  "CTA_OTR5",
  "MON_OTR5",
  "CTA_OTR6",
  "MON_OTR6",
  "CTA_OTR7",
  "MON_OTR7",
  "MON_178",
  "MON_191",
  "FEC_501",
  "VAL_601",
  "FEC_502",
  "VAL_602",
  "FEC_503",
  "VAL_603",
  "FEC_504",
  "VAL_604",
  "FEC_505",
  "VAL_605",
  "FEC_506",
  "VAL_606",
  "FEC_507",
  "VAL_607",
  "TASA",
  "NCUOTAS",
  "ADU_DI",
  "NUM_DI",
  "FEC_DI",
  "MON_699",
  "MON_199",
  "NUMITEM",
  "DNOMBRE",
  "DMARCA",
  "DVARIEDAD",
  "DOTRO1",
  "DOTRO2",
  "ATR-5",
  "ATR-6",
  "SAJU-ITEM",
  "AJU-ITEM",
  "CANT-MERC",
  "MERMAS",
  "MEDIDA",
  "PRE-UNIT",
  "ARANC-ALA",
  "NUMCOR",
  "NUMACU",
  "CODOBS1",
  "DESOBS1",
  "CODOBS2",
  "DESOBS2",
  "CODOBS3",
  "DESOBS3",
  "CODOBS4",
  "DESOBS4",
  "ARANC-NAC",
  "CIF-ITEM",
  "ADVAL-ALA",
  "ADVAL",
  "VALAD",
  "OTRO1",
  "CTA1",
  "SIGVAL1",
  "VAL1",
  "OTRO2",
  "CTA2",
  "SIGVAL2",
  "VAL2",
  "OTRO3",
  "CTA3",
  "SIGVAL3",
  "VAL3",
  "OTRO4",
  "CTA4",
  "SIGVAL4",
  "VAL4",
] as const;

const exportFieldNames = [
  "FECHAACEPT",
  "NUMEROIDENT",
  "ADUANA",
  "TIPOOPERACION",
  "CODIGORUTEXPORTADORPPAL",
  "NRO_EXPORTADOR",
  "PORCENTAJEEXPPPAL",
  "COMUNAEXPORTADORPPAL",
  "CODIGORUTEXPSEC",
  "NRO_EXPORTADOR_SEC",
  "PORCENTAJEEXPSECUNDARIO",
  "COMUNAEXPSECUNDARIO",
  "PUERTOEMB",
  "GLOSAPUERTOEMB",
  "REGIONORIGEN",
  "TIPOCARGA",
  "VIATRANSPORTE",
  "PUERTODESEMB",
  "GLOSAPUERTODESEMB",
  "PAISDESTINO",
  "GLOSAPAISDESTINO",
  "NOMBRECIATRANSP",
  "PAISCIATRANSP",
  "RUTCIATRANSP",
  "DVRUTCIATRANSP",
  "NOMBREEMISORDOCTRANSP",
  "RUTEMISOR",
  "DVRUTEMISOR",
  "CODIGOTIPOAUTORIZA",
  "NUMEROINFORMEEXPO",
  "DVNUMEROINFORMEEXP",
  "FECHAINFORMEEXP",
  "MONEDA",
  "MODALIDADVENTA",
  "CLAUSULAVENTA",
  "FORMAPAGO",
  "VALORCLAUSULAVENTA",
  "COMISIONESEXTERIOR",
  "OTROSGASTOS",
  "VALORLIQUIDORETORNO",
  "NUMEROREGSUSP",
  "ADUANAREGSUSP",
  "PLAZOVIGENCIAREGSUSP",
  "TOTALITEM",
  "TOTALBULTOS",
  "PESOBRUTOTOTAL",
  "TOTALVALORFOB",
  "VALORFLETE",
  "CODIGOFLETE",
  "VALORSEGURO",
  "CODIGOSEG",
  "VALORCIF",
  "NUMEROPARCIALIDAD",
  "TOTALPARCIALES",
  "PARCIAL",
  "OBSERVACION",
  "NUMERODOCTOCANCELA",
  "FECHADOCTOCANCELA",
  "TIPODOCTOCANCELA",
  "PESOBRUTOCANCELA",
  "TOTALBULTOSCANCELA",
  "NUMEROITEM",
  "NOMBRE",
  "ATRIBUTO1",
  "ATRIBUTO2",
  "ATRIBUTO3",
  "ATRIBUTO4",
  "ATRIBUTO5",
  "ATRIBUTO6",
  "CODIGOARANCEL",
  "UNIDADMEDIDA",
  "CANTIDADMERCANCIA",
  "FOBUNITARIO",
  "FOBUS",
  "CODIGOOBSERVACION1",
  "VALOROBSERVACION1",
  "GLOSAOBSERVACION1",
  "CODIGOOBSERVACION2",
  "VALOROBSERVACION2",
  "GLOSAOBSERVACION2",
  "CODIGOOBSERVACION3",
  "VALOROBSERVACION3",
  "GLOSAOBSERVACION3",
  "PESOBRUTOITEM",
] as const;

const importCodedFields = new Set([
  "TIPO_DOCTO",
  "ADU",
  "FORM",
  "ADUCTROL",
  "ADUA_RS",
  "ADU_DI",
  "CODCOMUN",
  "CODCOMRS",
  "CODPAISCON",
  "PA_ORIG",
  "PA_ADQ",
  "CODPAISCIA",
  "VIA_TRAN",
  "TRANSB",
  "PTO_EMB",
  "PTO_DESEM",
  "TPO_CARGA",
  "ALMACEN",
  "PAGO_GRAV",
  "BCO_COM",
  "CODORDIV",
  "FORM_PAGO",
  "MONEDA",
  "CL_COMPRA",
  "COD_FLE",
  "COD_SEG",
  "TPO_BUL1",
  "TPO_BUL2",
  "TPO_BUL3",
  "TPO_BUL4",
  "TPO_BUL5",
  "TPO_BUL6",
  "TPO_BUL7",
  "TPO_BUL8",
  "MEDIDA",
  "ARANC-ALA",
  "ARANC-NAC",
  "NUMCOR",
  "NUMACU",
  "CTA_OTRO",
  "CTA_OTR1",
  "CTA_OTR2",
  "CTA_OTR3",
  "CTA_OTR4",
  "CTA_OTR5",
  "CTA_OTR6",
  "CTA_OTR7",
  "ADVAL",
  "CTA1",
  "CTA2",
  "CTA3",
  "CTA4",
  "CODOBS1",
  "CODOBS2",
  "CODOBS3",
  "CODOBS4",
]);

const exportCodedFields = new Set([
  "ADUANA",
  "TIPOOPERACION",
  "COMUNAEXPORTADORPPAL",
  "COMUNAEXPSECUNDARIO",
  "REGIONORIGEN",
  "ADUANAREGSUSP",
  "PUERTOEMB",
  "PUERTODESEMB",
  "PAISDESTINO",
  "PAISCIATRANSP",
  "TIPOCARGA",
  "VIATRANSPORTE",
  "MONEDA",
  "MODALIDADVENTA",
  "CLAUSULAVENTA",
  "FORMAPAGO",
  "CODIGOFLETE",
  "CODIGOSEG",
  "CODIGOTIPOAUTORIZA",
  "TIPODOCTOCANCELA",
  "CODIGOARANCEL",
  "UNIDADMEDIDA",
  "CODIGOOBSERVACION1",
  "CODIGOOBSERVACION2",
  "CODIGOOBSERVACION3",
]);

type LayoutSeed = {
  countryCode: string;
  sourceSystem: string;
  sourceDomain: string;
  tradeFlow: string;
  recordRole: string;
  layoutName: string;
  layoutVersion: string;
  fieldNames: readonly string[];
  codedFields: Set<string>;
  notes: string;
};

async function upsertDictionarySourceFile() {
  const values = {
    countryCode: "CL",
    sourceSystem: "chile_aduana",
    sourceDomain: "datos.gob.cl",
    sourceName: "Diccionario de Datos para Datos abiertos Aduana",
    sourcePageUrl: DATA_DICTIONARY_PAGE_URL,
    resourceDownloadUrl: DATA_DICTIONARY_URL,
    acquisitionMethod: "datos_gob_cl_ckan",
    originalFilename: "campos-de-dus-y-din-para-archivos-de-datos-abiertos-v2.0.xlsx",
    normalizedRawFilename: "cl_aduana_data_dictionary_v2_0_raw.xlsx",
    normalizedWorkingFilename: "cl_aduana_data_dictionary_v2_0.xlsx",
    fileFormat: "xlsx",
    fileRole: "reference_file",
    sourceCategory: "data_dictionary",
    processingStatus: "metadata_seeded",
  };

  const existing = await db
    .select({ id: sourceFiles.id })
    .from(sourceFiles)
    .where(eq(sourceFiles.resourceDownloadUrl, DATA_DICTIONARY_URL))
    .limit(1);

  if (existing[0]) {
    const [updated] = await db
      .update(sourceFiles)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(sourceFiles.id, existing[0].id))
      .returning({ id: sourceFiles.id });

    return updated.id;
  }

  const [inserted] = await db.insert(sourceFiles).values(values).returning({
    id: sourceFiles.id,
  });

  return inserted.id;
}

async function upsertLayout(seed: LayoutSeed, dictionarySourceFileId: string) {
  const values = {
    countryCode: seed.countryCode,
    sourceSystem: seed.sourceSystem,
    sourceDomain: seed.sourceDomain,
    tradeFlow: seed.tradeFlow,
    recordRole: seed.recordRole,
    layoutName: seed.layoutName,
    layoutVersion: seed.layoutVersion,
    dictionarySourceFileId,
    fieldCount: seed.fieldNames.length,
    delimiter: ";",
    hasHeader: false,
    encoding: "latin-1-compatible",
    notes: seed.notes,
  };

  const existing = await db
    .select({ id: sourceLayouts.id })
    .from(sourceLayouts)
    .where(
      and(
        eq(sourceLayouts.sourceSystem, seed.sourceSystem),
        eq(sourceLayouts.sourceDomain, seed.sourceDomain),
        eq(sourceLayouts.tradeFlow, seed.tradeFlow),
        eq(sourceLayouts.recordRole, seed.recordRole),
        eq(sourceLayouts.layoutName, seed.layoutName),
        eq(sourceLayouts.layoutVersion, seed.layoutVersion),
      ),
    )
    .limit(1);

  if (existing[0]) {
    const [updated] = await db
      .update(sourceLayouts)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(sourceLayouts.id, existing[0].id))
      .returning({ id: sourceLayouts.id });

    return updated.id;
  }

  const [inserted] = await db.insert(sourceLayouts).values(values).returning({
    id: sourceLayouts.id,
  });

  return inserted.id;
}

async function replaceLayoutFields(layoutId: string, seed: LayoutSeed) {
  await db
    .delete(sourceLayoutFields)
    .where(eq(sourceLayoutFields.sourceLayoutId, layoutId));

  await db.insert(sourceLayoutFields).values(
    seed.fieldNames.map((sourceFieldName, index) => ({
      sourceLayoutId: layoutId,
      fieldOrdinal: index + 1,
      sourceFieldName,
      isCoded: seed.codedFields.has(sourceFieldName),
      codeTableKey: seed.codedFields.has(sourceFieldName)
        ? `chile_aduana:${sourceFieldName.toLowerCase()}`
        : null,
    })),
  );
}

function assertFieldCount(name: string, fields: readonly string[], expected: number) {
  if (fields.length !== expected) {
    throw new Error(`${name} expected ${expected} fields, got ${fields.length}.`);
  }
}

const layoutSeeds: LayoutSeed[] = [
  {
    countryCode: "CL",
    sourceSystem: "chile_aduana",
    sourceDomain: "datos.gob.cl",
    tradeFlow: "import",
    recordRole: "main_data",
    layoutName: "DIN main item file",
    layoutVersion: "v2.0",
    fieldNames: importFieldNames,
    codedFields: importCodedFields,
    notes:
      "Confirmed from inspected March 2026 import TXT and official dictionary titulos sheet DIN row.",
  },
  {
    countryCode: "CL",
    sourceSystem: "chile_aduana",
    sourceDomain: "datos.gob.cl",
    tradeFlow: "export",
    recordRole: "main_data",
    layoutName: "DUS main item file",
    layoutVersion: "v2.0",
    fieldNames: exportFieldNames,
    codedFields: exportCodedFields,
    notes:
      "Confirmed from inspected March 2026 export TXT and official dictionary titulos sheet DUS row.",
  },
];

assertFieldCount("DIN import layout", importFieldNames, 178);
assertFieldCount("DUS export layout", exportFieldNames, 84);

const dictionarySourceFileId = await upsertDictionarySourceFile();

for (const seed of layoutSeeds) {
  const layoutId = await upsertLayout(seed, dictionarySourceFileId);
  await replaceLayoutFields(layoutId, seed);
  console.log(
    `Seeded ${seed.tradeFlow} ${seed.recordRole} layout with ${seed.fieldNames.length} fields.`,
  );
}

console.log("Source layout metadata seed complete.");
