import { loadConfig } from './config'
import { createServer } from './api/server'

function main() {
  const config = loadConfig()
  const app = createServer()

  app.listen(config.port, () => {
    console.log(`Reconciliation engine listening on port ${config.port}`)
  })
}

main()
