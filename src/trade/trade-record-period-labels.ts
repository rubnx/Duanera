const monthLabels = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
]

function parsePeriodValue(value: string | undefined) {
  if (!value) {
    return null
  }

  const match = value.match(/^(\d{4})-(0[1-9]|1[0-2])$/)
  if (!match) {
    return null
  }

  return {
    month: Number(match[2]),
    value,
    year: Number(match[1]),
  }
}

export function tradeRecordLoadedYearRange(
  availablePeriods: string[],
  year: number
) {
  const yearPeriods = availablePeriods
    .map(parsePeriodValue)
    .filter((period): period is NonNullable<ReturnType<typeof parsePeriodValue>> =>
      Boolean(period && period.year === year)
    )
    .sort((a, b) => a.month - b.month)

  const first = yearPeriods[0]
  const last = yearPeriods.at(-1)
  if (!first || !last) {
    return null
  }

  return {
    isCompleteYear: yearPeriods.length === 12 && first.month === 1 && last.month === 12,
    periodFrom: first.value,
    periodTo: last.value,
  }
}

export function formatTradeRecordPeriodLabel(value: string | undefined) {
  const period = parsePeriodValue(value)
  if (!period) {
    return value
  }

  return `${monthLabels[period.month - 1]} ${period.year}`
}

export function formatTradeRecordPeriodRangeLabel(
  periodFrom: string | undefined,
  periodTo: string | undefined
) {
  if (!periodFrom && !periodTo) {
    return undefined
  }

  const from = parsePeriodValue(periodFrom)
  const to = parsePeriodValue(periodTo)

  if (from && to && from.year === to.year && from.month === 1 && to.month === 12) {
    return `Todo ${from.year}`
  }

  if (periodFrom && periodTo && periodFrom === periodTo) {
    return formatTradeRecordPeriodLabel(periodFrom)
  }

  if (periodFrom && periodTo) {
    return `${formatTradeRecordPeriodLabel(periodFrom)} → ${formatTradeRecordPeriodLabel(periodTo)}`
  }

  if (periodFrom) {
    return `desde ${formatTradeRecordPeriodLabel(periodFrom)}`
  }

  return `hasta ${formatTradeRecordPeriodLabel(periodTo)}`
}
