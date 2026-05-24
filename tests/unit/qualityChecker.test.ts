import { checkQuality, checkAllQuality } from '../../src/ingest/qualityChecker'
import { RawTransaction } from '../../src/types'

function makeRow(overrides: Partial<RawTransaction> = {}): RawTransaction {
  return {
    transactionId: 'USR-001',
    timestamp: '2024-03-01T09:00:00Z',
    type: 'BUY',
    asset: 'BTC',
    quantity: '0.5',
    priceUsd: '62000',
    fee: '0.0005',
    note: null,
    qualityFlags: [],
    source: 'user',
    rowIndex: 1,
    raw: {},
    ...overrides,
  }
}

describe('checkQuality', () => {
  it('returns no flags for a clean row', () => {
    const flags = checkQuality(makeRow(), new Set())
    expect(flags).toHaveLength(0)
  })

  it('flags malformed timestamp', () => {
    const flags = checkQuality(makeRow({ timestamp: '2024-03-09T' }), new Set())
    expect(flags).toContainEqual(
      expect.objectContaining({ field: 'timestamp', issue: 'malformed', severity: 'warning' })
    )
  })

  it('flags missing timestamp', () => {
    const flags = checkQuality(makeRow({ timestamp: null }), new Set())
    expect(flags).toContainEqual(
      expect.objectContaining({ field: 'timestamp', issue: 'missing' })
    )
  })

  it('flags missing type', () => {
    const flags = checkQuality(makeRow({ type: '' }), new Set())
    expect(flags).toContainEqual(
      expect.objectContaining({ field: 'type', issue: 'missing' })
    )
  })

  it('flags unknown type', () => {
    const flags = checkQuality(makeRow({ type: 'SWAP' }), new Set())
    expect(flags).toContainEqual(
      expect.objectContaining({ field: 'type', issue: 'unknown_type: SWAP' })
    )
  })

  it('flags negative quantity', () => {
    const flags = checkQuality(makeRow({ quantity: '-0.1' }), new Set())
    expect(flags).toContainEqual(
      expect.objectContaining({ field: 'quantity', issue: 'invalid_value: -0.1', severity: 'error' })
    )
  })

  it('flags zero quantity', () => {
    const flags = checkQuality(makeRow({ quantity: '0' }), new Set())
    expect(flags).toContainEqual(
      expect.objectContaining({ field: 'quantity', issue: 'invalid_value: 0', severity: 'error' })
    )
  })

  it('flags missing quantity', () => {
    const flags = checkQuality(makeRow({ quantity: null }), new Set())
    expect(flags).toContainEqual(
      expect.objectContaining({ field: 'quantity', issue: 'missing' })
    )
  })

  it('flags non-numeric quantity', () => {
    const flags = checkQuality(makeRow({ quantity: 'abc' }), new Set())
    expect(flags).toContainEqual(
      expect.objectContaining({ field: 'quantity', issue: 'non_numeric', severity: 'error' })
    )
  })

  it('flags duplicate transaction ID', () => {
    const seen = new Set<string>(['USR-001'])
    const flags = checkQuality(makeRow(), seen)
    expect(flags).toContainEqual(
      expect.objectContaining({ field: 'transactionId', issue: 'duplicate', severity: 'warning' })
    )
  })
})

describe('checkAllQuality', () => {
  it('flags duplicate across multiple rows', () => {
    const row1 = makeRow()
    const row2 = makeRow()
    const flagsMatrix = checkAllQuality([row1, row2])
    expect(flagsMatrix[0]).toHaveLength(0)
    expect(flagsMatrix[1]).toContainEqual(
      expect.objectContaining({ field: 'transactionId', issue: 'duplicate' })
    )
  })
})
