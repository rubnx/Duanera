// Mock-only fixtures for the Explorer UI foundation.
// Replace this module with service-backed data when the Explorer is wired to real records.

type ExplorerMockSourceState = "verified" | "review"
type ExplorerMockFlow = "Importación" | "Exportación"

type ExplorerMockTradeRecord = {
  id: string
  operationDate: string
  flow: ExplorerMockFlow
  importer: string | null
  exporter: string | null
  hsCode: string
  productDescription: string
  originCountry: string | null
  destinationCountry: string | null
  port: string | null
  customsOffice: string | null
  transportMode: string | null
  cifUsd: number | null
  fobUsd: number | null
  netWeightKg: number | null
  grossWeightKg: number | null
  quantity: number | null
  unit: string | null
  sourceState: ExplorerMockSourceState
  reviewReason?: string
  source: {
    batchId: string
    fileName: string
    sourceName: string
    loadedAt: string
    rawRowNumber: number
    originalRowPreview: Record<string, string | number | null>
  }
}

type ExplorerMockFilter = {
  id: string
  label: string
  value: string
  state?: "default" | "primary" | "success" | "purple" | "warning"
  removable?: boolean
}

type ExplorerMockLoadingRow = {
  id: string
  cellWidths: string[]
}

type ExplorerMockEmptyState = {
  title: string
  description: string
  query: string
  filters: ExplorerMockFilter[]
}

type ExplorerMockSelectedState = {
  selectedRecordId: string
  panelOpen: true
  activeTab: "Resumen" | "Mercancía" | "Valores" | "Transporte" | "Documentos" | "Historial"
}

const explorerMockFilters: ExplorerMockFilter[] = [
  {
    id: "flow-imports",
    label: "Flujo",
    value: "Importaciones",
    state: "primary",
  },
  {
    id: "period-24m",
    label: "Periodo",
    value: "Últimos 24 meses",
  },
  {
    id: "country-cl",
    label: "Mercado",
    value: "Chile",
  },
  {
    id: "hs-847130",
    label: "Partida HS",
    value: "8471.30",
    state: "success",
    removable: true,
  },
  {
    id: "port-san-antonio",
    label: "Puerto",
    value: "San Antonio",
    state: "purple",
    removable: true,
  },
]

const explorerMockRecords: ExplorerMockTradeRecord[] = [
  {
    id: "MOCK-IMP-2024-05-28-001245",
    operationDate: "28-05-2024",
    flow: "Importación",
    importer: "Comercializadora Andina SpA",
    exporter: "Guangdong Auto Parts Co., Ltd.",
    hsCode: "8471.30.00.00",
    productDescription: "Máquinas automáticas para procesamiento de datos",
    originCountry: "China",
    destinationCountry: "Chile",
    port: "San Antonio",
    customsOffice: "San Antonio",
    transportMode: "Marítima",
    cifUsd: 1245980,
    fobUsd: 1192100,
    netWeightKg: 18230,
    grossWeightKg: 19110,
    quantity: 1,
    unit: "unidad",
    sourceState: "verified",
    source: {
      batchId: "BATCH-ADUANA-2024-05-IMPORT",
      fileName: "DUS_SA_20240528_001245.csv",
      sourceName: "Servicio Nacional de Aduanas de Chile",
      loadedAt: "29-05-2024 02:14",
      rawRowNumber: 3482,
      originalRowPreview: {
        fecha_operacion: "2024-05-28",
        partida: "8471.30.00.00",
        cif_usd: 1245980,
        puerto: "SAN ANTONIO",
      },
    },
  },
  {
    id: "MOCK-IMP-2024-05-27-000918",
    operationDate: "27-05-2024",
    flow: "Importación",
    importer:
      "Inversiones del Sur y Compañía Comercializadora Internacional Limitada",
    exporter: "Shenzhen Precision Technology Manufacturing Group Limited",
    hsCode: "8517.62.90.00",
    productDescription:
      "Aparatos para recepción, conversión y transmisión o regeneración de voz, imagen u otros datos",
    originCountry: "China",
    destinationCountry: "Chile",
    port: "Valparaíso",
    customsOffice: "Valparaíso",
    transportMode: "Marítima",
    cifUsd: 987450,
    fobUsd: 951210,
    netWeightKg: 14100,
    grossWeightKg: 15030,
    quantity: 42,
    unit: "bultos",
    sourceState: "verified",
    source: {
      batchId: "BATCH-ADUANA-2024-05-IMPORT",
      fileName: "DIN_VALPO_20240527_000918.csv",
      sourceName: "Servicio Nacional de Aduanas de Chile",
      loadedAt: "28-05-2024 01:47",
      rawRowNumber: 2176,
      originalRowPreview: {
        importador:
          "INVERSIONES DEL SUR Y COMPAÑÍA COMERCIALIZADORA INTERNACIONAL LTDA",
        partida: "8517.62.90.00",
        cif_usd: 987450,
        peso_neto: 14100,
      },
    },
  },
  {
    id: "MOCK-EXP-2024-05-27-000441",
    operationDate: "27-05-2024",
    flow: "Exportación",
    importer: "Distribuidora Atlántico S.A.",
    exporter:
      "Exportadora Agrícola Valle Central Sociedad Anónima de Comercialización y Servicios",
    hsCode: "0806.10.00.00",
    productDescription:
      "Uvas frescas variedad red globe acondicionadas en cajas de cartón para exportación, calibre mixto, temporada 2024",
    originCountry: "Chile",
    destinationCountry: "Estados Unidos",
    port: "San Antonio",
    customsOffice: "San Antonio",
    transportMode: "Marítima",
    cifUsd: null,
    fobUsd: 2150000,
    netWeightKg: 21500,
    grossWeightKg: 23180,
    quantity: 1840,
    unit: "cajas",
    sourceState: "verified",
    source: {
      batchId: "BATCH-ADUANA-2024-05-EXPORT",
      fileName: "DUS_EXP_SA_20240527_000441.csv",
      sourceName: "Servicio Nacional de Aduanas de Chile",
      loadedAt: "28-05-2024 03:22",
      rawRowNumber: 928,
      originalRowPreview: {
        exportador: "EXPORTADORA AGRÍCOLA VALLE CENTRAL S.A.",
        destino: "ESTADOS UNIDOS",
        fob_usd: 2150000,
        cantidad: 1840,
      },
    },
  },
  {
    id: "MOCK-IMP-2024-05-26-000775",
    operationDate: "26-05-2024",
    flow: "Importación",
    importer: "Transporte y Logística Chile SpA",
    exporter: null,
    hsCode: "8708.99.90.00",
    productDescription: "Partes y accesorios para vehículos automóviles",
    originCountry: null,
    destinationCountry: "Chile",
    port: "Los Libertadores",
    customsOffice: "Los Andes",
    transportMode: "Carretera",
    cifUsd: 756300,
    fobUsd: 731800,
    netWeightKg: null,
    grossWeightKg: 11850,
    quantity: null,
    unit: null,
    sourceState: "review",
    reviewReason:
      "Exportador, país de origen, peso neto y cantidad no informados en la fila fuente.",
    source: {
      batchId: "BATCH-ADUANA-2024-05-IMPORT",
      fileName: "DIN_LOSANDES_20240526_000775.csv",
      sourceName: "Servicio Nacional de Aduanas de Chile",
      loadedAt: "27-05-2024 02:09",
      rawRowNumber: 1407,
      originalRowPreview: {
        importador: "TRANSPORTE Y LOGÍSTICA CHILE SPA",
        partida: "8708.99.90.00",
        cif_usd: 756300,
        peso_neto: null,
      },
    },
  },
  {
    id: "MOCK-IMP-2024-05-25-000362",
    operationDate: "25-05-2024",
    flow: "Importación",
    importer: "Importadora Pacífico Ltda.",
    exporter: "Busan Electronics Trading Corporation",
    hsCode: "8528.72.20.00",
    productDescription:
      "Monitores y proyectores que no incorporan aparato receptor de televisión, para uso industrial y comercial",
    originCountry: "Corea del Sur",
    destinationCountry: "Chile",
    port: "San Antonio",
    customsOffice: "San Antonio",
    transportMode: "Marítima",
    cifUsd: 1320750,
    fobUsd: 1278800,
    netWeightKg: 17320,
    grossWeightKg: 18140,
    quantity: 620,
    unit: "unidades",
    sourceState: "verified",
    source: {
      batchId: "BATCH-ADUANA-2024-05-IMPORT",
      fileName: "DIN_SA_20240525_000362.csv",
      sourceName: "Servicio Nacional de Aduanas de Chile",
      loadedAt: "26-05-2024 02:31",
      rawRowNumber: 884,
      originalRowPreview: {
        origen: "COREA DEL SUR",
        partida: "8528.72.20.00",
        cif_usd: 1320750,
        puerto: "SAN ANTONIO",
      },
    },
  },
  {
    id: "MOCK-IMP-2024-05-25-000184",
    operationDate: "25-05-2024",
    flow: "Importación",
    importer: "Motriz SpA",
    exporter: "Hamburg Maschinenbau Ersatzteile GmbH",
    hsCode: "8483.40.90.00",
    productDescription:
      "Engranajes y ruedas de fricción, husillos fileteados de bolas o rodillos, reductores y variadores de velocidad",
    originCountry: "Alemania",
    destinationCountry: "Chile",
    port: "Valparaíso",
    customsOffice: "Valparaíso",
    transportMode: "Marítima",
    cifUsd: 610200,
    fobUsd: 586900,
    netWeightKg: 9200,
    grossWeightKg: 9780,
    quantity: 18,
    unit: "pallets",
    sourceState: "review",
    reviewReason:
      "Descripción extensa normalizada desde glosa fuente; revisar clasificación HS antes de usar en reporte.",
    source: {
      batchId: "BATCH-ADUANA-2024-05-IMPORT",
      fileName: "DIN_VALPO_20240525_000184.csv",
      sourceName: "Servicio Nacional de Aduanas de Chile",
      loadedAt: "26-05-2024 02:44",
      rawRowNumber: 512,
      originalRowPreview: {
        glosa:
          "ENGRANAJES, RUEDAS DE FRICCIÓN, REDUCTORES Y VARIADORES DE VELOCIDAD",
        partida: "8483.40.90.00",
        cif_usd: 610200,
        observacion: "clasificación por revisar",
      },
    },
  },
]

const explorerMockLoadingRows: ExplorerMockLoadingRow[] = Array.from(
  { length: 8 },
  (_, index) => ({
    id: `loading-row-${index + 1}`,
    cellWidths: ["72px", "180px", "260px", "96px", "112px", "88px", "104px"],
  })
)

const explorerMockEmptySearchResults: ExplorerMockEmptyState = {
  title: "Sin resultados",
  description:
    "No encontramos registros para la búsqueda actual. Ajusta el texto, periodo, país, partida HS o puerto.",
  query: "importador inexistente 8471 valdivia",
  filters: [
    {
      id: "empty-period",
      label: "Periodo",
      value: "Mayo 2024",
    },
    {
      id: "empty-hs",
      label: "Partida HS",
      value: "8471.30",
      state: "success",
    },
    {
      id: "empty-port",
      label: "Puerto",
      value: "Valdivia",
      state: "purple",
    },
  ],
}

const explorerMockSelectedState: ExplorerMockSelectedState = {
  selectedRecordId: "MOCK-IMP-2024-05-28-001245",
  panelOpen: true,
  activeTab: "Resumen",
}

const explorerMockStates = {
  filters: explorerMockFilters,
  normalRecords: explorerMockRecords,
  longCompanyNameRecord: explorerMockRecords[1],
  longProductDescriptionRecord: explorerMockRecords[2],
  missingValuesRecord: explorerMockRecords[3],
  sourceVerifiedRecords: explorerMockRecords.filter(
    (record) => record.sourceState === "verified"
  ),
  reviewRequiredRecords: explorerMockRecords.filter(
    (record) => record.sourceState === "review"
  ),
  emptySearchResults: explorerMockEmptySearchResults,
  loadingRows: explorerMockLoadingRows,
  selectedRowWithDetailPanel: {
    ...explorerMockSelectedState,
    record: explorerMockRecords.find(
      (record) => record.id === explorerMockSelectedState.selectedRecordId
    ),
  },
} as const

function formatExplorerMockCurrency(value: number | null) {
  if (value === null) {
    return "No informado"
  }

  return new Intl.NumberFormat("es-CL", {
    maximumFractionDigits: 0,
    style: "currency",
    currency: "USD",
  }).format(value)
}

function formatExplorerMockWeight(value: number | null) {
  if (value === null) {
    return "No informado"
  }

  return `${new Intl.NumberFormat("es-CL", {
    maximumFractionDigits: 0,
  }).format(value)} kg`
}

function getExplorerMockDetailFields(record: ExplorerMockTradeRecord) {
  return [
    { label: "Fecha de operación", value: record.operationDate },
    { label: "Régimen", value: record.flow },
    { label: "Importador", value: record.importer },
    { label: "Exportador", value: record.exporter },
    { label: "Producto HS", value: record.hsCode },
    { label: "Descripción", value: record.productDescription },
    { label: "País de origen", value: record.originCountry },
    { label: "País de destino", value: record.destinationCountry },
    { label: "Puerto", value: record.port },
    { label: "Aduana", value: record.customsOffice },
    { label: "Vía de transporte", value: record.transportMode },
    { label: "Valor CIF", value: formatExplorerMockCurrency(record.cifUsd) },
    { label: "Valor FOB", value: formatExplorerMockCurrency(record.fobUsd) },
    { label: "Peso neto", value: formatExplorerMockWeight(record.netWeightKg) },
    { label: "Peso bruto", value: formatExplorerMockWeight(record.grossWeightKg) },
    {
      label: "Cantidad",
      value:
        record.quantity === null || record.unit === null
          ? "No informado"
          : `${new Intl.NumberFormat("es-CL").format(record.quantity)} ${record.unit}`,
    },
  ]
}

function getExplorerMockSourceFields(record: ExplorerMockTradeRecord) {
  return [
    { id: "batch", label: "Lote de importación", value: record.source.batchId },
    { id: "file", label: "Archivo fuente", value: record.source.fileName },
    { id: "row", label: "Fila original", value: record.source.rawRowNumber },
    { id: "loaded", label: "Fecha de carga", value: record.source.loadedAt },
    { id: "source", label: "Fuente", value: record.source.sourceName },
  ]
}

export {
  explorerMockEmptySearchResults,
  explorerMockFilters,
  explorerMockLoadingRows,
  explorerMockRecords,
  explorerMockSelectedState,
  explorerMockStates,
  formatExplorerMockCurrency,
  formatExplorerMockWeight,
  getExplorerMockDetailFields,
  getExplorerMockSourceFields,
  type ExplorerMockEmptyState,
  type ExplorerMockFilter,
  type ExplorerMockFlow,
  type ExplorerMockLoadingRow,
  type ExplorerMockSelectedState,
  type ExplorerMockSourceState,
  type ExplorerMockTradeRecord,
}
