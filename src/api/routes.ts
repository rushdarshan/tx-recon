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

interface ErrorDetail {
  field?: string
  message: string
}

function sendData(res: Response, data: unknown, meta?: Record<string, unknown>) {
  if (meta) {
    res.json({ data, meta })
    return
  }
  res.json({ data })
}

function sendError(
  res: Response,
  status: number,
  code: string,
  message: string,
  details?: ErrorDetail[]
) {
  const payload: { error: { code: string; message: string; details?: ErrorDetail[] } } = {
    error: { code, message },
  }
  if (details && details.length > 0) {
    payload.error.details = details
  }
  res.status(status).json(payload)
}

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
      const details: ErrorDetail[] = []
      if (runConfig.timestampToleranceSeconds <= 0) {
        details.push({ field: 'timestampToleranceSeconds', message: 'Must be a positive number' })
      }
      if (runConfig.quantityTolerancePct <= 0) {
        details.push({ field: 'quantityTolerancePct', message: 'Must be a positive number' })
      }
      sendError(res, 400, 'VALIDATION_ERROR', 'Invalid tolerance values', details)
      return
    }

    await connect(runConfig.mongoUri!)

    await Transaction.deleteMany({})

    const { userRows, exchangeRows } = await ingestAll(
      runConfig.userCsvPath!,
      runConfig.exchangeCsvPath!
    )

    const results: MatchResult[] = runMatching(userRows, exchangeRows, runConfig)

    const reportRows = results.map(r => toReportRow(r))
    const summary = computeSummary(reportRows)

    const run = new ReconciliationRun({
      runId,
      config: {
        timestampToleranceSeconds: runConfig.timestampToleranceSeconds,
        quantityTolerancePct: runConfig.quantityTolerancePct,
      },
      status: 'completed',
      summary,
      results,
      completedAt: new Date(),
    })
    await run.save()

    await disconnect()

    sendData(res, { runId, summary })
  } catch (err: any) {
    sendError(res, 500, 'INTERNAL_ERROR', err.message ?? 'Unexpected error')
  }
})

router.get('/report/:runId', async (req: Request, res: Response) => {
  try {
    const config = loadConfig()
    await connect(config.mongoUri!)

    const run = await ReconciliationRun.findOne({ runId: req.params.runId }).lean()
    if (!run) {
      await disconnect()
      sendError(res, 404, 'NOT_FOUND', 'Run not found')
      return
    }

    const csv = generateCsv(run.results.map(r => toReportRow(r)))

    await disconnect()

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename="reconciliation-${req.params.runId}.csv"`)
    res.send(csv)
  } catch (err: any) {
    sendError(res, 500, 'INTERNAL_ERROR', err.message ?? 'Unexpected error')
  }
})

router.get('/report/:runId/summary', async (req: Request, res: Response) => {
  try {
    const config = loadConfig()
    await connect(config.mongoUri!)

    const run = await ReconciliationRun.findOne({ runId: req.params.runId }).lean()
    if (!run) {
      await disconnect()
      sendError(res, 404, 'NOT_FOUND', 'Run not found')
      return
    }

    await disconnect()

    sendData(res, {
      runId: run.runId,
      summary: run.summary,
      config: run.config,
    })
  } catch (err: any) {
    sendError(res, 500, 'INTERNAL_ERROR', err.message ?? 'Unexpected error')
  }
})

router.get('/report/:runId/unmatched', async (req: Request, res: Response) => {
  try {
    const config = loadConfig()
    await connect(config.mongoUri!)

    const run = await ReconciliationRun.findOne({ runId: req.params.runId }).lean()
    if (!run) {
      await disconnect()
      sendError(res, 404, 'NOT_FOUND', 'Run not found')
      return
    }

    const unmatched = run.results.filter(
      r => r.category === 'unmatched_user' || r.category === 'unmatched_exchange'
    )

    await disconnect()

    sendData(res, unmatched)
  } catch (err: any) {
    sendError(res, 500, 'INTERNAL_ERROR', err.message ?? 'Unexpected error')
  }
})

export default router
