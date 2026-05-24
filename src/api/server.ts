import express from 'express'
import routes from './routes'

export function createServer() {
  const app = express()
  app.use(express.json())

  app.get('/', (_req, res) => {
    res.json({
      success: true,
      message: 'Transaction Reconciliation Engine API is running',
    })
  })

  app.use('/', routes)
  return app
}
