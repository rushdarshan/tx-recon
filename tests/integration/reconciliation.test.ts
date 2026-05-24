import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import * as path from 'path'
import { ingestAll } from '../../src/ingest'
import { runMatching } from '../../src/matching/engine'
import { ReconciliationConfig } from '../../src/types'

const USER_CSV = path.resolve(__dirname, '../../user_transactions.csv')
const EXCHANGE_CSV = path.resolve(__dirname, '../../exchange_transactions.csv')

const config: ReconciliationConfig = {
  timestampToleranceSeconds: 300,
  quantityTolerancePct: 0.01,
}

let mongoServer: MongoMemoryServer

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create()
  await mongoose.connect(mongoServer.getUri())
})

afterAll(async () => {
  await mongoose.disconnect()
  await mongoServer.stop()
})

describe('Full reconciliation pipeline', () => {
  it('ingests both CSVs and matches transactions', async () => {
    const { userRows, exchangeRows } = await ingestAll(USER_CSV, EXCHANGE_CSV)

    expect(userRows.length).toBeGreaterThan(0)
    expect(exchangeRows.length).toBeGreaterThan(0)

    const results = runMatching(userRows, exchangeRows, config)
    const matched = results.filter(r => r.category === 'matched')
    const unmatchedUser = results.filter(r => r.category === 'unmatched_user')
    const unmatchedExchange = results.filter(r => r.category === 'unmatched_exchange')
    const conflicting = results.filter(r => r.category === 'conflicting')

    const accountedFor = matched.length * 2 + unmatchedUser.length + unmatchedExchange.length + conflicting.length * 2
    expect(accountedFor).toBe(userRows.length + exchangeRows.length)

    expect(matched.length).toBeGreaterThanOrEqual(20)
    expect(unmatchedUser.length).toBeGreaterThanOrEqual(1)
    expect(unmatchedExchange.length).toBeGreaterThanOrEqual(2)
    expect(conflicting.length).toBe(0)

    const total = matched.length + unmatchedUser.length + unmatchedExchange.length + conflicting.length
    expect(total).toBe(results.length)
  })

  it('matches USR-001 to EXC-1001', async () => {
    const { userRows, exchangeRows } = await ingestAll(USER_CSV, EXCHANGE_CSV)
    const results = runMatching(userRows, exchangeRows, config)

    const matched = results.find(r =>
      r.category === 'matched' && r.userTxId === 'USR-001' && r.exchangeTxId === 'EXC-1001'
    )
    expect(matched).toBeDefined()
  })

  it('matches USR-004 TRANSFER_OUT to EXC-1004 TRANSFER_IN', async () => {
    const { userRows, exchangeRows } = await ingestAll(USER_CSV, EXCHANGE_CSV)
    const results = runMatching(userRows, exchangeRows, config)

    const matched = results.find(r =>
      r.category === 'matched' && r.userTxId === 'USR-004' && r.exchangeTxId === 'EXC-1004'
    )
    expect(matched).toBeDefined()
    expect(matched!.reason).toContain('type-mapped')
  })

  it('matches USR-005 bitcoin alias to EXC-1005 BTC', async () => {
    const { userRows, exchangeRows } = await ingestAll(USER_CSV, EXCHANGE_CSV)
    const results = runMatching(userRows, exchangeRows, config)

    const matched = results.find(r =>
      r.category === 'matched' && r.userTxId === 'USR-005' && r.exchangeTxId === 'EXC-1005'
    )
    expect(matched).toBeDefined()
    expect(matched!.reason).toContain('asset-aliased')
  })

  it('USR-024 with missing type is unmatched', async () => {
    const { userRows, exchangeRows } = await ingestAll(USER_CSV, EXCHANGE_CSV)
    const results = runMatching(userRows, exchangeRows, config)

    const unmatched = results.find(r =>
      r.category === 'unmatched_user' && r.userTxId === 'USR-024'
    )
    expect(unmatched).toBeDefined()
  })

  it('EXC-1024 and EXC-1025 are unmatched exchange', async () => {
    const { userRows, exchangeRows } = await ingestAll(USER_CSV, EXCHANGE_CSV)
    const results = runMatching(userRows, exchangeRows, config)

    const exc1024 = results.find(r => r.exchangeTxId === 'EXC-1024')
    const exc1025 = results.find(r => r.exchangeTxId === 'EXC-1025')
    expect(exc1024?.category).toBe('unmatched_exchange')
    expect(exc1025?.category).toBe('unmatched_exchange')
  })

  it('second USR-001 duplicate is unmatched_user', async () => {
    const { userRows, exchangeRows } = await ingestAll(USER_CSV, EXCHANGE_CSV)
    const results = runMatching(userRows, exchangeRows, config)

    const duplicates = results.filter(r => r.category === 'unmatched_user' && r.userTxId === 'USR-001')
    expect(duplicates.length).toBe(1)
    expect(duplicates[0].reason).toContain('duplicate')
  })
})
