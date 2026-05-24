import { parseCsv } from './csvParser'
import { checkAllQuality } from './qualityChecker'
import { Transaction } from '../db/models/Transaction'
import { ParsedTransaction, RawTransaction, QualityFlag } from '../types'

function parseValue(value: string | null): number | null {
  if (value === null || value === '') return null
  const n = parseFloat(value)
  return isNaN(n) ? null : n
}

function parseTimestamp(value: string | null): Date | null {
  if (value === null || value === '') return null
  const d = new Date(value)
  return isNaN(d.getTime()) ? null : d
}

function toParsed(raw: RawTransaction): ParsedTransaction {
  return {
    transactionId: raw.transactionId,
    timestamp: parseTimestamp(raw.timestamp),
    type: (raw.type as ParsedTransaction['type']) ?? null,
    asset: raw.asset ?? null,
    quantity: parseValue(raw.quantity),
    priceUsd: parseValue(raw.priceUsd),
    fee: parseValue(raw.fee),
    note: raw.note ?? null,
    qualityFlags: raw.qualityFlags,
    source: raw.source,
    rowIndex: raw.rowIndex,
  }
}

function logQualityIssues(row: RawTransaction, flags: QualityFlag[]): void {
  if (flags.length === 0) return
  const issues = flags.map(flag => `${flag.field}:${flag.issue}`).join(', ')
  const id = row.transactionId || '(missing-id)'
  console.warn(`[ingest] ${row.source} ${id} flagged: ${issues}`)
}

export async function ingestCsv(filePath: string, source: 'user' | 'exchange'): Promise<ParsedTransaction[]> {
  const rawRows = parseCsv(filePath, source)
  const flagsMatrix = checkAllQuality(rawRows)

  const parsedRows: ParsedTransaction[] = rawRows.map((row, i) => {
    row.qualityFlags = flagsMatrix[i]
    logQualityIssues(row, row.qualityFlags)
    return toParsed(row)
  })

  const docs = rawRows.map((raw, i) => ({
    transactionId: parsedRows[i].transactionId,
    timestamp: parsedRows[i].timestamp,
    type: parsedRows[i].type,
    asset: parsedRows[i].asset,
    quantity: parsedRows[i].quantity,
    priceUsd: parsedRows[i].priceUsd,
    fee: parsedRows[i].fee,
    note: parsedRows[i].note,
    qualityFlags: parsedRows[i].qualityFlags,
    source: parsedRows[i].source,
    rowIndex: raw.rowIndex,
    raw: raw.raw,
  }))

  await Transaction.insertMany(docs, { ordered: false })

  return parsedRows
}

export async function ingestAll(userCsvPath: string, exchangeCsvPath: string): Promise<{
  userRows: ParsedTransaction[]
  exchangeRows: ParsedTransaction[]
}> {
  const userRows = await ingestCsv(userCsvPath, 'user')
  const exchangeRows = await ingestCsv(exchangeCsvPath, 'exchange')
  return { userRows, exchangeRows }
}
