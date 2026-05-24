import express from 'express'
import swaggerUi from 'swagger-ui-express'
import { swaggerSpec } from './swagger'
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

  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec))

  app.use('/', routes)
  return app
}
