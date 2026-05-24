import mongoose from 'mongoose'

export async function connect(mongoUri: string): Promise<void> {
  await mongoose.connect(mongoUri)
}

export async function disconnect(): Promise<void> {
  await mongoose.disconnect()
}
