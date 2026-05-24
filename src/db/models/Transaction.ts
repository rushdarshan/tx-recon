import mongoose, { Schema, Document } from 'mongoose'

export interface QualityFlagDoc {
  field: string
  issue: string
  severity: 'warning' | 'error'
}

export interface ITransaction extends Document {
  transactionId: string
  timestamp: Date | null
  type: string | null
  asset: string | null
  quantity: number | null
  priceUsd: number | null
  fee: number | null
  note: string | null
  qualityFlags: QualityFlagDoc[]
  source: 'user' | 'exchange'
  ingestedAt: Date
}

const qualityFlagSchema = new Schema<QualityFlagDoc>({
  field: { type: String, required: true },
  issue: { type: String, required: true },
  severity: { type: String, enum: ['warning', 'error'], required: true },
}, { _id: false })

const transactionSchema = new Schema<ITransaction>({
  transactionId: { type: String, required: true },
  timestamp: { type: Date, default: null },
  type: { type: String, default: null },
  asset: { type: String, default: null },
  quantity: { type: Number, default: null },
  priceUsd: { type: Number, default: null },
  fee: { type: Number, default: null },
  note: { type: String, default: null },
  qualityFlags: { type: [qualityFlagSchema], default: [] },
  source: { type: String, enum: ['user', 'exchange'], required: true },
  ingestedAt: { type: Date, default: Date.now },
})

transactionSchema.index({ transactionId: 1, source: 1 })
transactionSchema.index({ source: 1 })

export const Transaction = mongoose.model<ITransaction>('Transaction', transactionSchema)
