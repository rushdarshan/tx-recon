import { MongoMemoryServer } from 'mongodb-memory-server'
import { loadConfig } from './config'
import { createServer } from './api/server'

async function main() {
  const config = loadConfig()

  if (!config.mongoUri || config.mongoUri === 'mongodb://localhost:27017/reconciliation') {
    const mongod = await MongoMemoryServer.create()
    config.mongoUri = mongod.getUri()
    console.log(`Started in-memory MongoDB at ${config.mongoUri}`)
  }

  process.env.MONGO_URI = config.mongoUri

  const app = createServer()

  app.listen(config.port, () => {
    console.log(`Reconciliation engine listening on port ${config.port}`)
  })
}

main()
