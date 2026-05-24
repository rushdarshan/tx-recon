import { Router, Request, Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { loadConfig } from '../config'
import { connect, disconnect } from '../db/connection'
import { Transaction } from '../db/models/Transaction'
import { ReconciliationRun } from '../db/models/ReconciliationRun'
import { ingestAll } from '../ingest'
import { runMatching } from '../matching/engine'
import { generateCsv, computeSummary, toReportRow } from '../report/generator'
import { ReconciliationConfig, MatchResult } from '../types'

const router = Router()

router.post('/reconcile', async (req: Request, res: Response) => {
  try {
    const baseConfig = loadConfig(req.body)
    const runId = uuidv4()
    const config = req.body as Partial<ReconciliationConfig>

    const runConfig: ReconciliationConfig = {
      ...baseConfig,
      ...config,
    }

    if (runConfig.timestampToleranceSeconds <= 0 || runConfig.quantityTolerancePct <= 0) {
      res.status(400).json({ error: 'Tolerances must be positive numbers' })
      return
    }

    await connect(runConfig.mongoUri!)

    const run = new ReconciliationRun({
      runId,
      config: {
        timestampToleranceSeconds: runConfig.timestampToleranceSeconds,
        quantityTolerancePct: runConfig.quantityTolerancePct,
      },
      status: 'running',
      summary: { matched: 0, conflicting: 0, unmatchedUser: 0, unmatchedExchange: 0 },
      results: [],
    })
    await run.save()

    await Transaction.deleteMany({})

    const { userRows, exchangeRows } = await ingestAll(
      runConfig.userCsvPath!,
      runConfig.exchangeCsvPath!
    )

    const results: MatchResult[] = runMatching(userRows, exchangeRows, runConfig)

    const reportRows = results.map(r => toReportRow(r))
    const summary = computeSummary(reportRows)

    run.status = 'completed'
    run.summary = summary
    run.results = results
    run.completedAt = new Date()
    await run.save()

    await disconnect()

    res.json({ runId, summary })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/report/:runId', async (req: Request, res: Response) => {
  try {
    const config = loadConfig()
    await connect(config.mongoUri!)

    const run = await ReconciliationRun.findOne({ runId: req.params.runId })
    if (!run) {
      await disconnect()
      res.status(404).json({ error: 'Run not found' })
      return
    }

    const csv = generateCsv(run.results.map(r => toReportRow(r)))

    await disconnect()

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename="reconciliation-${req.params.runId}.csv"`)
    res.send(csv)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/report/:runId/summary', async (req: Request, res: Response) => {
  try {
    const config = loadConfig()
    await connect(config.mongoUri!)

    const run = await ReconciliationRun.findOne({ runId: req.params.runId })
    if (!run) {
      await disconnect()
      res.status(404).json({ error: 'Run not found' })
      return
    }

    await disconnect()

    res.json({
      runId: run.runId,
      ...run.summary,
      config: run.config,
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/report/:runId/unmatched', async (req: Request, res: Response) => {
  try {
    const config = loadConfig()
    await connect(config.mongoUri!)

    const run = await ReconciliationRun.findOne({ runId: req.params.runId })
    if (!run) {
      await disconnect()
      res.status(404).json({ error: 'Run not found' })
      return
    }

    const unmatched = run.results.filter(
      r => r.category === 'unmatched_user' || r.category === 'unmatched_exchange'
    )

    await disconnect()

    res.json(unmatched)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
