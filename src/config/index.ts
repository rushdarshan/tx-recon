import dotenv from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'
import { ReconciliationConfig } from '../types'

dotenv.config()

const DEFAULT_CONFIG_PATH = path.resolve(__dirname, '../../config/default.json')

function loadFileConfig(): Partial<ReconciliationConfig> {
  try {
    const raw = fs.readFileSync(DEFAULT_CONFIG_PATH, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

function loadEnvConfig(): Partial<ReconciliationConfig> {
  const config: Partial<ReconciliationConfig> = {}
  if (process.env.TIMESTAMP_TOLERANCE_SECONDS) {
    config.timestampToleranceSeconds = parseInt(process.env.TIMESTAMP_TOLERANCE_SECONDS, 10)
  }
  if (process.env.QUANTITY_TOLERANCE_PCT) {
    config.quantityTolerancePct = parseFloat(process.env.QUANTITY_TOLERANCE_PCT)
  }
  return config
}

export function loadConfig(overrides?: Partial<ReconciliationConfig>): ReconciliationConfig {
  const fileConfig = loadFileConfig()
  const envConfig = loadEnvConfig()

  const merged: ReconciliationConfig = {
    timestampToleranceSeconds: 300,
    quantityTolerancePct: 0.01,
    port: 3000,
    mongoUri: 'mongodb://localhost:27017/reconciliation',
    userCsvPath: 'user_transactions.csv',
    exchangeCsvPath: 'exchange_transactions.csv',
    ...fileConfig,
    ...envConfig,
    ...overrides,
  }

  if (merged.timestampToleranceSeconds <= 0) {
    throw new Error(`Invalid timestampToleranceSeconds: ${merged.timestampToleranceSeconds}`)
  }
  if (merged.quantityTolerancePct <= 0) {
    throw new Error(`Invalid quantityTolerancePct: ${merged.quantityTolerancePct}`)
  }

  return merged
}
