import { QualityFlag, RawTransaction } from '../types'

const VALID_TYPES = new Set(['BUY', 'SELL', 'TRANSFER_IN', 'TRANSFER_OUT'])

function isIso8601(value: string): boolean {
  const d = new Date(value)
  return !isNaN(d.getTime()) && value.includes('T')
}

export function checkQuality(row: RawTransaction, seenIds: Set<string>): QualityFlag[] {
  const flags: QualityFlag[] = []

  if (row.timestamp === null || row.timestamp === '') {
    flags.push({ field: 'timestamp', issue: 'missing', severity: 'warning' })
  } else if (!isIso8601(row.timestamp)) {
    flags.push({ field: 'timestamp', issue: 'malformed', severity: 'warning' })
  }

  if (row.type === null || row.type === '') {
    flags.push({ field: 'type', issue: 'missing', severity: 'warning' })
  } else if (!VALID_TYPES.has(row.type)) {
    flags.push({ field: 'type', issue: `unknown_type: ${row.type}`, severity: 'warning' })
  }

  if (row.quantity === null || row.quantity === '') {
    flags.push({ field: 'quantity', issue: 'missing', severity: 'warning' })
  } else {
    const qty = parseFloat(row.quantity)
    if (isNaN(qty)) {
      flags.push({ field: 'quantity', issue: 'non_numeric', severity: 'error' })
    } else if (qty <= 0) {
      flags.push({ field: 'quantity', issue: `invalid_value: ${qty}`, severity: 'error' })
    }
  }

  if (!row.transactionId || row.transactionId === '') {
    flags.push({ field: 'transactionId', issue: 'missing', severity: 'error' })
  }

  if (row.transactionId && seenIds.has(row.transactionId)) {
    flags.push({ field: 'transactionId', issue: 'duplicate', severity: 'warning' })
  }
  if (row.transactionId) {
    seenIds.add(row.transactionId)
  }

  return flags
}

export function checkAllQuality(rows: RawTransaction[]): QualityFlag[][] {
  const seenIds = new Set<string>()
  return rows.map(row => checkQuality(row, seenIds))
}
