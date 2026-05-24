import * as fs from 'fs'
import { parse } from 'csv-parse/sync'
import { RawTransaction, Source } from '../types'

export function parseCsv(filePath: string, source: Source): RawTransaction[] {
  const content = fs.readFileSync(filePath, 'utf-8')
  const records: Record<string, string>[] = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
    relax_column_count: true,
  })

  return records.map((record) => {
    return {
      transactionId: record.transaction_id ?? '',
      timestamp: record.timestamp ?? null,
      type: record.type ?? null,
      asset: record.asset ?? null,
      quantity: record.quantity ?? null,
      priceUsd: record.price_usd ?? null,
      fee: record.fee ?? null,
      note: record.note ?? null,
      qualityFlags: [],
      source,
    }
  })
}
