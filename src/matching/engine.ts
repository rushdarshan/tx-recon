import { ParsedTransaction, MatchResult, ReconciliationConfig } from '../types'
import { timestampsWithin, quantitiesWithin, quantityDiffPct, typesMatch, assetsMatch } from './comparator'
import { DEFAULT_TYPE_MAPPINGS, DEFAULT_ASSET_ALIASES } from './typeMappings'

interface PassDefinition {
  name: string
  useTypeMapping: boolean
  useAliasMapping: boolean
  tsToleranceMult: number
  qtyToleranceMult: number
}

const PASSES: PassDefinition[] = [
  { name: 'Pass 1: exact', useTypeMapping: false, useAliasMapping: false, tsToleranceMult: 1, qtyToleranceMult: 1 },
  { name: 'Pass 2: relaxed quantity', useTypeMapping: false, useAliasMapping: false, tsToleranceMult: 1, qtyToleranceMult: 10 },
  { name: 'Pass 3: type mapping', useTypeMapping: true, useAliasMapping: false, tsToleranceMult: 1, qtyToleranceMult: 10 },
  { name: 'Pass 4: asset aliases', useTypeMapping: true, useAliasMapping: true, tsToleranceMult: 1, qtyToleranceMult: 10 },
  { name: 'Pass 5: max tolerance', useTypeMapping: true, useAliasMapping: true, tsToleranceMult: 3, qtyToleranceMult: 50 },
]

interface IndexedTx {
  tx: ParsedTransaction
  index: number
}

export function relate(
  userTx: IndexedTx,
  exchangeTx: IndexedTx,
  pass: PassDefinition,
  config: ReconciliationConfig
): boolean {
  const tsTolerance = config.timestampToleranceSeconds * pass.tsToleranceMult
  const qtyTolerance = config.quantityTolerancePct * pass.qtyToleranceMult
  const typeMap = pass.useTypeMapping ? DEFAULT_TYPE_MAPPINGS : {}
  const aliasMap = pass.useAliasMapping ? DEFAULT_ASSET_ALIASES : {}

  return (
    timestampsWithin(userTx.tx.timestamp, exchangeTx.tx.timestamp, tsTolerance) &&
    quantitiesWithin(userTx.tx.quantity, exchangeTx.tx.quantity, qtyTolerance) &&
    typesMatch(userTx.tx.type, exchangeTx.tx.type, typeMap) &&
    assetsMatch(userTx.tx.asset, exchangeTx.tx.asset, aliasMap)
  )
}

function safeIsoString(d: Date | null | undefined): string | null {
  if (d === null || d === undefined) return null
  try {
    return d.toISOString()
  } catch {
    return null
  }
}

function buildMatchResult(
  userTx: IndexedTx | null,
  exchangeTx: IndexedTx | null,
  category: MatchResult['category'],
  reason: string
): MatchResult {
  return {
    category,
    reason,
    userTxId: userTx?.tx.transactionId ?? null,
    exchangeTxId: exchangeTx?.tx.transactionId ?? null,
    userTimestamp: safeIsoString(userTx?.tx.timestamp),
    exchangeTimestamp: safeIsoString(exchangeTx?.tx.timestamp),
    asset: userTx?.tx.asset ?? exchangeTx?.tx.asset ?? null,
    type: userTx?.tx.type ?? exchangeTx?.tx.type ?? null,
    userQuantity: userTx?.tx.quantity ?? null,
    exchangeQuantity: exchangeTx?.tx.quantity ?? null,
    userPriceUsd: userTx?.tx.priceUsd ?? null,
    exchangePriceUsd: exchangeTx?.tx.priceUsd ?? null,
    userFee: userTx?.tx.fee ?? null,
    exchangeFee: exchangeTx?.tx.fee ?? null,
    userNote: userTx?.tx.note ?? null,
    exchangeNote: exchangeTx?.tx.note ?? null,
  }
}

export function runMatching(
  userRows: ParsedTransaction[],
  exchangeRows: ParsedTransaction[],
  config: ReconciliationConfig
): MatchResult[] {
  const results: MatchResult[] = []

  const availableUser: (IndexedTx | null)[] = userRows.map((tx, i) => ({ tx, index: i }))
  const availableExchange: (IndexedTx | null)[] = exchangeRows.map((tx, i) => ({ tx, index: i }))

  const usedUser = new Set<number>()
  const usedExchange = new Set<number>()

  for (const pass of PASSES) {
    for (let ui = 0; ui < availableUser.length; ui++) {
      if (usedUser.has(ui)) continue
      const uTx = availableUser[ui]
      if (!uTx) continue

      for (let ei = 0; ei < availableExchange.length; ei++) {
        if (usedExchange.has(ei)) continue
        const eTx = availableExchange[ei]
        if (!eTx) continue

        if (relate(uTx, eTx, pass, config)) {
          let reason: string
          if (pass.name.startsWith('Pass 1')) {
            reason = 'Matched on pass 1'
          } else {
            const tsTolerance = config.timestampToleranceSeconds * pass.tsToleranceMult
            const qtyTolerance = config.quantityTolerancePct * pass.qtyToleranceMult
            const details: string[] = []
            if (uTx.tx.type !== eTx.tx.type) details.push('type-mapped')
            if ((uTx.tx.asset?.toUpperCase() ?? '') !== (eTx.tx.asset?.toUpperCase() ?? '')) details.push('asset-aliased')
            if (uTx.tx.timestamp && eTx.tx.timestamp) {
              const tsDiff = Math.abs(uTx.tx.timestamp.getTime() - eTx.tx.timestamp.getTime()) / 1000
              if (tsDiff > config.timestampToleranceSeconds) details.push(`timestamp diff ${tsDiff}s (tolerance ${tsTolerance}s)`)
            }
            if (uTx.tx.quantity && eTx.tx.quantity) {
              const diff = quantityDiffPct(uTx.tx.quantity, eTx.tx.quantity)
              if (diff > config.quantityTolerancePct) details.push(`quantity diff ${diff.toFixed(4)}% (tolerance ${qtyTolerance}%)`)
            }
            reason = `Matched on ${pass.name} [${details.join(', ')}]`
          }

          results.push(buildMatchResult(uTx, eTx, 'matched', reason))
          usedUser.add(ui)
          usedExchange.add(ei)
          break
        }
      }
    }
  }

  for (let ui = 0; ui < availableUser.length; ui++) {
    if (usedUser.has(ui)) continue
    const uTx = availableUser[ui]!
    const reason = uTx.tx.qualityFlags.some(f => f.field === 'transactionId' && f.issue === 'duplicate')
      ? 'Unmatched user — duplicate row'
      : 'Unmatched user — no matching exchange transaction found'
    results.push(buildMatchResult(uTx, null, 'unmatched_user', reason))
  }

  for (let ei = 0; ei < availableExchange.length; ei++) {
    if (usedExchange.has(ei)) continue
    const eTx = availableExchange[ei]!
    results.push(buildMatchResult(null, eTx, 'unmatched_exchange', 'Unmatched exchange — no matching user transaction found'))
  }

  return results
}
