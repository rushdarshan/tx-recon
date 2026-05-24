import { ReconciliationSummary } from '../types'

const CSV_HEADERS = [
  'category', 'reason',
  'user_tx_id', 'exchange_tx_id',
  'user_timestamp', 'exchange_timestamp',
  'asset', 'type',
  'user_quantity', 'exchange_quantity',
  'user_price_usd', 'exchange_price_usd',
  'user_fee', 'exchange_fee',
  'user_note', 'exchange_note',
]

function escapeCsv(value: string | null | undefined): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export interface ReportRow {
  category: string
  reason: string
  userTxId: string | null
  exchangeTxId: string | null
  userTimestamp: string | null
  exchangeTimestamp: string | null
  asset: string | null
  type: string | null
  userQuantity: number | null
  exchangeQuantity: number | null
  userPriceUsd: number | null
  exchangePriceUsd: number | null
  userFee: number | null
  exchangeFee: number | null
  userNote: string | null
  exchangeNote: string | null
}

export function generateCsv(rows: ReportRow[]): string {
  const header = CSV_HEADERS.join(',')
  const body = rows.map(row => [
    escapeCsv(row.category),
    escapeCsv(row.reason),
    escapeCsv(row.userTxId),
    escapeCsv(row.exchangeTxId),
    escapeCsv(row.userTimestamp),
    escapeCsv(row.exchangeTimestamp),
    escapeCsv(row.asset),
    escapeCsv(row.type),
    escapeCsv(row.userQuantity?.toString()),
    escapeCsv(row.exchangeQuantity?.toString()),
    escapeCsv(row.userPriceUsd?.toString()),
    escapeCsv(row.exchangePriceUsd?.toString()),
    escapeCsv(row.userFee?.toString()),
    escapeCsv(row.exchangeFee?.toString()),
    escapeCsv(row.userNote),
    escapeCsv(row.exchangeNote),
  ].join(','))

  return header + '\n' + body.join('\n') + '\n'
}

export function computeSummary(rows: ReportRow[]): ReconciliationSummary {
  return {
    matched: rows.filter(r => r.category === 'matched').length,
    conflicting: rows.filter(r => r.category === 'conflicting').length,
    unmatchedUser: rows.filter(r => r.category === 'unmatched_user').length,
    unmatchedExchange: rows.filter(r => r.category === 'unmatched_exchange').length,
  }
}

export function toReportRow(result: {
  category: string
  reason: string
  userTxId: string | null
  exchangeTxId: string | null
  userTimestamp: string | null
  exchangeTimestamp: string | null
  asset: string | null
  type: string | null
  userQuantity: number | null
  exchangeQuantity: number | null
  userPriceUsd: number | null
  exchangePriceUsd: number | null
  userFee: number | null
  exchangeFee: number | null
  userNote: string | null
  exchangeNote: string | null
}): ReportRow {
  return { ...result }
}
