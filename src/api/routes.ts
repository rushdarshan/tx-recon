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

/**
 * @openapi
 * /reconcile:
 *   post:
 *     summary: Run reconciliation
 *     description: Ingests CSV files, matches transactions, and returns summary
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userCsvPath:
 *                 type: string
 *                 default: user_transactions.csv
 *               exchangeCsvPath:
 *                 type: string
 *                 default: exchange_transactions.csv
 *               timestampToleranceSeconds:
 *                 type: number
 *                 default: 300
 *               quantityTolerancePct:
 *                 type: number
 *                 default: 0.01
 *     responses:
 *       200:
 *         description: Reconciliation completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     runId:
 *                       type: string
 *                     summary:
 *                       type: object
 *                       properties:
 *                         matched:
 *                           type: integer
 *                         conflicting:
 *                           type: integer
 *                         unmatchedUser:
 *                           type: integer
 *                         unmatchedExchange:
 *                           type: integer
 *       400:
 *         description: Invalid tolerance values
 */
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

/**
 * @openapi
 * /report/{runId}:
 *   get:
 *     summary: Download reconciliation CSV
 *     parameters:
 *       - in: path
 *         name: runId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: CSV file
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *       404:
 *         description: Run not found
 */
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

/**
 * @openapi
 * /report/{runId}/summary:
 *   get:
 *     summary: Get reconciliation summary
 *     parameters:
 *       - in: path
 *         name: runId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Summary data
 *       404:
 *         description: Run not found
 */
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

/**
 * @openapi
 * /report/{runId}/unmatched:
 *   get:
 *     summary: List unmatched transactions
 *     parameters:
 *       - in: path
 *         name: runId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Unmatched transactions
 *       404:
 *         description: Run not found
 */
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
