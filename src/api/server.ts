import express from 'express'
import path from 'path'
import swaggerUi from 'swagger-ui-express'
import { swaggerSpec } from './swagger'
import routes from './routes'

export function createServer() {
  const app = express()
  app.use(express.json())

  app.use(express.static(path.join(process.cwd(), 'public')))

  app.get('/', (_req, res) => {
    res.sendFile(path.join(process.cwd(), 'public/index.html'))
  })

  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec))

  app.use('/', routes)
  return app
}
