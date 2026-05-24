import * as fs from 'fs'
import * as path from 'path'
import { parseCsv } from '../../src/ingest/csvParser'

describe('parseCsv', () => {
  const userCsvPath = path.resolve(__dirname, '../../user_transactions.csv')
  const exchangeCsvPath = path.resolve(__dirname, '../../exchange_transactions.csv')

  it('parses user CSV with correct number of rows', () => {
    const rows = parseCsv(userCsvPath, 'user')
    expect(rows.length).toBe(26)
  })

  it('parses exchange CSV with correct number of rows', () => {
    const rows = parseCsv(exchangeCsvPath, 'exchange')
    expect(rows.length).toBe(25)
  })

  it('parses first user row correctly', () => {
    const rows = parseCsv(userCsvPath, 'user')
    const first = rows[0]
    expect(first.transactionId).toBe('USR-001')
    expect(first.timestamp).toBe('2024-03-01T09:00:00Z')
    expect(first.type).toBe('BUY')
    expect(first.asset).toBe('BTC')
    expect(first.quantity).toBe('0.5')
  })

  it('preserves USR-005 asset alias "bitcoin"', () => {
    const rows = parseCsv(userCsvPath, 'user')
    const aliasRow = rows.find(r => r.transactionId === 'USR-005')
    expect(aliasRow).toBeDefined()
    expect(aliasRow!.asset).toBe('bitcoin')
  })

  it('preserves malformed timestamp for USR-018', () => {
    const rows = parseCsv(userCsvPath, 'user')
    const row = rows.find(r => r.transactionId === 'USR-018')
    expect(row).toBeDefined()
    expect(row!.timestamp).toBe('2024-03-09T')
  })

  it('preserves USR-019 negative quantity', () => {
    const rows = parseCsv(userCsvPath, 'user')
    const row = rows.find(r => r.transactionId === 'USR-019')
    expect(row).toBeDefined()
    expect(row!.quantity).toBe('-0.1')
  })

  it('preserves USR-024 with missing type', () => {
    const rows = parseCsv(userCsvPath, 'user')
    const row = rows.find(r => r.transactionId === 'USR-024')
    expect(row).toBeDefined()
    expect(row!.type).toBe('')
  })

  it('all rows have source field set', () => {
    const rows = parseCsv(userCsvPath, 'user')
    rows.forEach(r => expect(r.source).toBe('user'))
  })
})
