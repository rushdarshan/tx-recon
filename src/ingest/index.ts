import { parseCsv } from './csvParser'
import { checkAllQuality } from './qualityChecker'
import { Transaction } from '../db/models/Transaction'
import { ParsedTransaction, RawTransaction } from '../types'

function parseValue(value: string | null): number | null {
  if (value === null || value === '') return null
  const n = parseFloat(value)
  return isNaN(n) ? null : n
}

function toParsed(raw: RawTransaction): ParsedTransaction {
  return {
    transactionId: raw.transactionId,
    timestamp: raw.timestamp ? new Date(raw.timestamp) : null,
    type: (raw.type as ParsedTransaction['type']) ?? null,
    asset: raw.asset ?? null,
    quantity: parseValue(raw.quantity),
    priceUsd: parseValue(raw.priceUsd),
    fee: parseValue(raw.fee),
    note: raw.note ?? null,
    qualityFlags: raw.qualityFlags,
    source: raw.source,
  }
}

export async function ingestCsv(filePath: string, source: 'user' | 'exchange'): Promise<ParsedTransaction[]> {
  const rawRows = parseCsv(filePath, source)
  const flagsMatrix = checkAllQuality(rawRows)

  const parsedRows: ParsedTransaction[] = rawRows.map((row, i) => {
    row.qualityFlags = flagsMatrix[i]
    return toParsed(row)
  })

  const docs = parsedRows.map((row) => ({
    transactionId: row.transactionId,
    timestamp: row.timestamp,
    type: row.type,
    asset: row.asset,
    quantity: row.quantity,
    priceUsd: row.priceUsd,
    fee: row.fee,
    note: row.note,
    qualityFlags: row.qualityFlags,
    source: row.source,
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
