import { generateCsv, computeSummary, toReportRow, ReportRow } from '../../src/report/generator'

describe('generateCsv', () => {
  it('includes CSV header', () => {
    const csv = generateCsv([])
    expect(csv.split('\n')[0]).toBe('category,reason,user_tx_id,exchange_tx_id,user_timestamp,exchange_timestamp,asset,type,user_quantity,exchange_quantity,user_price_usd,exchange_price_usd,user_fee,exchange_fee,user_note,exchange_note')
  })

  it('includes matched row data', () => {
    const row = toReportRow({
      category: 'matched',
      reason: 'Matched on pass 1',
      userTxId: 'USR-001',
      exchangeTxId: 'EXC-1001',
      userTimestamp: '2024-03-01T09:00:00.000Z',
      exchangeTimestamp: '2024-03-01T09:00:32.000Z',
      asset: 'BTC',
      type: 'BUY',
      userQuantity: 0.5,
      exchangeQuantity: 0.5,
      userPriceUsd: 62000,
      exchangePriceUsd: 62000,
      userFee: 0.0005,
      exchangeFee: 0.0005,
      userNote: 'Monthly DCA',
      exchangeNote: '',
    })
    const csv = generateCsv([row])
    const lines = csv.trim().split('\n')
    expect(lines).toHaveLength(2)
    expect(lines[1]).toContain('matched')
    expect(lines[1]).toContain('USR-001')
    expect(lines[1]).toContain('EXC-1001')
  })

  it('leaves exchange fields empty for unmatched_user', () => {
    const row = toReportRow({
      category: 'unmatched_user',
      reason: 'Unmatched user — no matching exchange transaction found',
      userTxId: 'USR-024',
      exchangeTxId: null,
      userTimestamp: null,
      exchangeTimestamp: null,
      asset: 'BTC',
      type: null,
      userQuantity: 0.4,
      exchangeQuantity: null,
      userPriceUsd: 62800,
      exchangePriceUsd: null,
      userFee: 0.0004,
      exchangeFee: null,
      userNote: 'Missing timestamp entirely',
      exchangeNote: null,
    })
    const csv = generateCsv([row])
    expect(csv).toContain('unmatched_user')
    expect(csv).toContain('USR-024')
    const cols = csv.trim().split('\n')[1].split(',')
    expect(cols[3]).toBe('')
  })

  it('escapes commas in reason field', () => {
    const row = toReportRow({
      category: 'conflicting',
      reason: 'Qty differs: 0.3 vs 0.3001, exceeds 0.01%',
      userTxId: 'USR-012',
      exchangeTxId: 'EXC-1012',
      userTimestamp: null,
      exchangeTimestamp: null,
      asset: 'BTC',
      type: 'BUY',
      userQuantity: 0.3,
      exchangeQuantity: 0.3001,
      userPriceUsd: null,
      exchangePriceUsd: null,
      userFee: null,
      exchangeFee: null,
      userNote: null,
      exchangeNote: null,
    })
    const csv = generateCsv([row])
    expect(csv).toContain('"')
  })
})

describe('computeSummary', () => {
  it('counts categories correctly', () => {
    const rows: ReportRow[] = [
      toReportRow({ category: 'matched', reason: '', userTxId: null, exchangeTxId: null, userTimestamp: null, exchangeTimestamp: null, asset: null, type: null, userQuantity: null, exchangeQuantity: null, userPriceUsd: null, exchangePriceUsd: null, userFee: null, exchangeFee: null, userNote: null, exchangeNote: null }),
      toReportRow({ category: 'matched', reason: '', userTxId: null, exchangeTxId: null, userTimestamp: null, exchangeTimestamp: null, asset: null, type: null, userQuantity: null, exchangeQuantity: null, userPriceUsd: null, exchangePriceUsd: null, userFee: null, exchangeFee: null, userNote: null, exchangeNote: null }),
      toReportRow({ category: 'conflicting', reason: '', userTxId: null, exchangeTxId: null, userTimestamp: null, exchangeTimestamp: null, asset: null, type: null, userQuantity: null, exchangeQuantity: null, userPriceUsd: null, exchangePriceUsd: null, userFee: null, exchangeFee: null, userNote: null, exchangeNote: null }),
      toReportRow({ category: 'unmatched_user', reason: '', userTxId: null, exchangeTxId: null, userTimestamp: null, exchangeTimestamp: null, asset: null, type: null, userQuantity: null, exchangeQuantity: null, userPriceUsd: null, exchangePriceUsd: null, userFee: null, exchangeFee: null, userNote: null, exchangeNote: null }),
      toReportRow({ category: 'unmatched_exchange', reason: '', userTxId: null, exchangeTxId: null, userTimestamp: null, exchangeTimestamp: null, asset: null, type: null, userQuantity: null, exchangeQuantity: null, userPriceUsd: null, exchangePriceUsd: null, userFee: null, exchangeFee: null, userNote: null, exchangeNote: null }),
    ]
    const summary = computeSummary(rows)
    expect(summary).toEqual({ matched: 2, conflicting: 1, unmatchedUser: 1, unmatchedExchange: 1 })
  })
})
