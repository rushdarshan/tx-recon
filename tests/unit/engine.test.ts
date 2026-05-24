import { runMatching } from '../../src/matching/engine'
import { ParsedTransaction, ReconciliationConfig } from '../../src/types'

const defaultConfig: ReconciliationConfig = {
  timestampToleranceSeconds: 300,
  quantityTolerancePct: 0.01,
}

function userTx(overrides: Partial<ParsedTransaction>): ParsedTransaction {
  return {
    transactionId: 'USR-000',
    timestamp: new Date('2024-03-01T09:00:00Z'),
    type: 'BUY',
    asset: 'BTC',
    quantity: 0.5,
    priceUsd: 62000,
    fee: 0.0005,
    note: null,
    qualityFlags: [],
    source: 'user',
    ...overrides,
  }
}

function exchangeTx(overrides: Partial<ParsedTransaction>): ParsedTransaction {
  return {
    transactionId: 'EXC-000',
    timestamp: new Date('2024-03-01T09:00:32Z'),
    type: 'BUY',
    asset: 'BTC',
    quantity: 0.5,
    priceUsd: 62000,
    fee: 0.0005,
    note: null,
    qualityFlags: [],
    source: 'exchange',
    ...overrides,
  }
}

describe('runMatching', () => {
  it('matches identical transactions on pass 1', () => {
    const users = [userTx({ transactionId: 'USR-001' })]
    const exchanges = [exchangeTx({ transactionId: 'EXC-1001' })]
    const results = runMatching(users, exchanges, defaultConfig)
    expect(results).toHaveLength(1)
    expect(results[0].category).toBe('matched')
    expect(results[0].reason).toBe('Matched on pass 1')
  })

  it('matches via type mapping (TRANSFER_OUT ↔ TRANSFER_IN)', () => {
    const users = [userTx({ transactionId: 'USR-004', type: 'TRANSFER_OUT', quantity: 1.0, timestamp: new Date('2024-03-02T14:45:00Z') })]
    const exchanges = [exchangeTx({ transactionId: 'EXC-1004', type: 'TRANSFER_IN', quantity: 1.0, timestamp: new Date('2024-03-02T14:45:00Z') })]
    const results = runMatching(users, exchanges, defaultConfig)
    const matched = results.find(r => r.category === 'matched')
    expect(matched).toBeDefined()
    expect(matched!.reason).toContain('type-mapped')
  })

  it('matches via asset alias (bitcoin → BTC)', () => {
    const users = [userTx({ transactionId: 'USR-005', asset: 'bitcoin', quantity: 0.25, timestamp: new Date('2024-03-03T10:00:00Z') })]
    const exchanges = [exchangeTx({ transactionId: 'EXC-1005', asset: 'BTC', quantity: 0.25, timestamp: new Date('2024-03-03T10:02:00Z') })]
    const results = runMatching(users, exchanges, defaultConfig)
    const matched = results.find(r => r.category === 'matched')
    expect(matched).toBeDefined()
    expect(matched!.reason).toContain('asset-aliased')
  })

  it('leaves unmatched exchange rows', () => {
    const users = [userTx({ transactionId: 'USR-001' })]
    const exchanges = [
      exchangeTx({ transactionId: 'EXC-1001' }),
      exchangeTx({ transactionId: 'EXC-1024', type: 'BUY', asset: 'ETH', quantity: 0.6, timestamp: new Date('2024-03-13T18:00:00Z') }),
    ]
    const results = runMatching(users, exchanges, defaultConfig)
    const matched = results.find(r => r.category === 'matched')
    const unmatchedExc = results.find(r => r.category === 'unmatched_exchange')
    expect(matched).toBeDefined()
    expect(unmatchedExc).toBeDefined()
    expect(unmatchedExc!.exchangeTxId).toBe('EXC-1024')
  })

  it('flags duplicate user row as unmatched_user', () => {
    const users = [
      userTx({ transactionId: 'USR-001', timestamp: new Date('2024-03-01T09:00:00Z') }),
      userTx({ transactionId: 'USR-001', timestamp: new Date('2024-03-01T09:00:00Z'), qualityFlags: [{ field: 'transactionId', issue: 'duplicate', severity: 'warning' }] }),
    ]
    const exchanges = [exchangeTx({ transactionId: 'EXC-1001' })]
    const results = runMatching(users, exchanges, defaultConfig)
    const matched = results.filter(r => r.category === 'matched')
    const unmatched = results.filter(r => r.category === 'unmatched_user')
    expect(matched).toHaveLength(1)
    expect(unmatched).toHaveLength(1)
    expect(unmatched[0].reason).toContain('duplicate')
  })

  it('handles empty user list', () => {
    const exchanges = [exchangeTx({ transactionId: 'EXC-1001' })]
    const results = runMatching([], exchanges, defaultConfig)
    expect(results).toHaveLength(1)
    expect(results[0].category).toBe('unmatched_exchange')
  })

  it('handles empty exchange list', () => {
    const users = [userTx({ transactionId: 'USR-001' })]
    const results = runMatching(users, [], defaultConfig)
    expect(results).toHaveLength(1)
    expect(results[0].category).toBe('unmatched_user')
  })

  it('matches full sample data correctly', () => {
    const userRows: ParsedTransaction[] = [
      userTx({ transactionId: 'USR-001', timestamp: new Date('2024-03-01T09:00:00Z'), type: 'BUY', asset: 'BTC', quantity: 0.5 }),
      userTx({ transactionId: 'USR-002', timestamp: new Date('2024-03-01T11:30:00Z'), type: 'BUY', asset: 'ETH', quantity: 2.0 }),
      userTx({ transactionId: 'USR-003', timestamp: new Date('2024-03-02T08:15:00Z'), type: 'SELL', asset: 'BTC', quantity: 0.1 }),
      userTx({ transactionId: 'USR-004', timestamp: new Date('2024-03-02T14:45:00Z'), type: 'TRANSFER_OUT', asset: 'ETH', quantity: 1.0 }),
      userTx({ transactionId: 'USR-005', timestamp: new Date('2024-03-03T10:00:00Z'), type: 'BUY', asset: 'bitcoin', quantity: 0.25 }),
    ]

    const exchangeRows: ParsedTransaction[] = [
      exchangeTx({ transactionId: 'EXC-1001', timestamp: new Date('2024-03-01T09:00:32Z'), type: 'BUY', asset: 'BTC', quantity: 0.5 }),
      exchangeTx({ transactionId: 'EXC-1002', timestamp: new Date('2024-03-01T11:30:00Z'), type: 'BUY', asset: 'ETH', quantity: 2.0 }),
      exchangeTx({ transactionId: 'EXC-1003', timestamp: new Date('2024-03-02T08:15:10Z'), type: 'SELL', asset: 'BTC', quantity: 0.1 }),
      exchangeTx({ transactionId: 'EXC-1004', timestamp: new Date('2024-03-02T14:45:00Z'), type: 'TRANSFER_IN', asset: 'ETH', quantity: 1.0 }),
      exchangeTx({ transactionId: 'EXC-1005', timestamp: new Date('2024-03-03T10:02:00Z'), type: 'BUY', asset: 'BTC', quantity: 0.25 }),
    ]

    const results = runMatching(userRows, exchangeRows, defaultConfig)
    const matched = results.filter(r => r.category === 'matched')
    expect(matched).toHaveLength(5)
  })
})
