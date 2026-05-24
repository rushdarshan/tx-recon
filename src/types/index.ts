export type Source = 'user' | 'exchange'

export type TransactionType = 'BUY' | 'SELL' | 'TRANSFER_IN' | 'TRANSFER_OUT'

export interface QualityFlag {
  field: string
  issue: string
  severity: 'warning' | 'error'
}

export interface RawTransaction {
  transactionId: string | null
  timestamp: string | null
  type: string | null
  asset: string | null
  quantity: string | null
  priceUsd: string | null
  fee: string | null
  note: string | null
  qualityFlags: QualityFlag[]
  source: Source
  rowIndex: number
  raw: Record<string, string>
}

export interface ParsedTransaction {
  transactionId: string | null
  timestamp: Date | null
  type: TransactionType | null
  asset: string | null
  quantity: number | null
  priceUsd: number | null
  fee: number | null
  note: string | null
  qualityFlags: QualityFlag[]
  source: Source
  rowIndex: number
}

export type MatchCategory =
  | 'matched'
  | 'conflicting'
  | 'unmatched_user'
  | 'unmatched_exchange'

export interface MatchResult {
  category: MatchCategory
  reason: string
  userTxId: string | null
  exchangeTxId: string | null
  userTimestamp: string | null
  exchangeTimestamp: string | null
  asset: string | null
  type: string | null
  userQuantity: number | null
  exchangeQuantity: number | null
  userPriceUsd: number | null
  exchangePriceUsd: number | null
  userFee: number | null
  exchangeFee: number | null
  userNote: string | null
  exchangeNote: string | null
}

export interface ReconciliationConfig {
  timestampToleranceSeconds: number
  quantityTolerancePct: number
  port?: number
  mongoUri?: string
  userCsvPath?: string
  exchangeCsvPath?: string
}

export interface ReconciliationSummary {
  matched: number
  conflicting: number
  unmatchedUser: number
  unmatchedExchange: number
}

export interface TypeMapping {
  [key: string]: string
}

export interface AssetAliasMap {
  [alias: string]: string
}
