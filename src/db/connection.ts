import mongoose from 'mongoose'

export async function connect(mongoUri: string): Promise<void> {
  mongoose.connection.on('connected', () => console.log('MongoDB connected'))
  mongoose.connection.on('error', err => console.error('MongoDB error:', err))
  mongoose.connection.on('disconnected', () => console.log('MongoDB disconnected'))

  await mongoose.connect(mongoUri, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  })
}

export async function disconnect(): Promise<void> {
  await mongoose.disconnect()
}
