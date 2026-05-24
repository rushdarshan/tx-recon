import mongoose, { Schema, Document } from 'mongoose'

export interface IMatchResultDoc {
  category: 'matched' | 'conflicting' | 'unmatched_user' | 'unmatched_exchange'
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

export interface IReconciliationRun extends Document {
  runId: string
  config: {
    timestampToleranceSeconds: number
    quantityTolerancePct: number
  }
  status: 'pending' | 'running' | 'completed' | 'failed'
  summary: {
    matched: number
    conflicting: number
    unmatchedUser: number
    unmatchedExchange: number
  }
  results: IMatchResultDoc[]
  errorMessage?: string
  startedAt: Date
  completedAt?: Date
}

const matchResultSchema = new Schema<IMatchResultDoc>({
  category: { type: String, enum: ['matched', 'conflicting', 'unmatched_user', 'unmatched_exchange'], required: true },
  reason: { type: String, required: true },
  userTxId: { type: String, default: null },
  exchangeTxId: { type: String, default: null },
  userTimestamp: { type: String, default: null },
  exchangeTimestamp: { type: String, default: null },
  asset: { type: String, default: null },
  type: { type: String, default: null },
  userQuantity: { type: Number, default: null },
  exchangeQuantity: { type: Number, default: null },
  userPriceUsd: { type: Number, default: null },
  exchangePriceUsd: { type: Number, default: null },
  userFee: { type: Number, default: null },
  exchangeFee: { type: Number, default: null },
  userNote: { type: String, default: null },
  exchangeNote: { type: String, default: null },
}, { _id: false })

const reconciliationRunSchema = new Schema<IReconciliationRun>({
  runId: { type: String, required: true, unique: true },
  config: {
    timestampToleranceSeconds: { type: Number, required: true },
    quantityTolerancePct: { type: Number, required: true },
  },
  status: { type: String, enum: ['pending', 'running', 'completed', 'failed'], required: true },
  summary: {
    matched: { type: Number, default: 0 },
    conflicting: { type: Number, default: 0 },
    unmatchedUser: { type: Number, default: 0 },
    unmatchedExchange: { type: Number, default: 0 },
  },
  results: { type: [matchResultSchema], default: [] },
  errorMessage: { type: String },
  startedAt: { type: Date, default: Date.now },
  completedAt: { type: Date },
})

reconciliationRunSchema.index({ runId: 1 })

export const ReconciliationRun = mongoose.model<IReconciliationRun>('ReconciliationRun', reconciliationRunSchema)
