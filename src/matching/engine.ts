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

const STRICT_PASSES: PassDefinition[] = [
  { name: 'Pass 1: exact', useTypeMapping: false, useAliasMapping: false, tsToleranceMult: 1, qtyToleranceMult: 1 },
  { name: 'Pass 2: type mapping', useTypeMapping: true, useAliasMapping: false, tsToleranceMult: 1, qtyToleranceMult: 1 },
  { name: 'Pass 3: asset aliases', useTypeMapping: true, useAliasMapping: true, tsToleranceMult: 1, qtyToleranceMult: 1 },
]

const CONFLICT_PASSES: PassDefinition[] = [
  { name: 'Pass 4: relaxed quantity', useTypeMapping: true, useAliasMapping: true, tsToleranceMult: 1, qtyToleranceMult: 10 },
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

function withinBaseTolerance(
  userTx: IndexedTx,
  exchangeTx: IndexedTx,
  config: ReconciliationConfig,
  typeMap: Record<string, string>,
  aliasMap: Record<string, string>
): boolean {
  return (
    timestampsWithin(userTx.tx.timestamp, exchangeTx.tx.timestamp, config.timestampToleranceSeconds) &&
    quantitiesWithin(userTx.tx.quantity, exchangeTx.tx.quantity, config.quantityTolerancePct) &&
    typesMatch(userTx.tx.type, exchangeTx.tx.type, typeMap) &&
    assetsMatch(userTx.tx.asset, exchangeTx.tx.asset, aliasMap)
  )
}

function buildDifferenceDetails(
  userTx: IndexedTx,
  exchangeTx: IndexedTx,
  config: ReconciliationConfig,
  typeMap: Record<string, string>,
  aliasMap: Record<string, string>
): string[] {
  const details: string[] = []
  if (!typesMatch(userTx.tx.type, exchangeTx.tx.type, typeMap)) {
    details.push(`type mismatch (${userTx.tx.type ?? 'null'} vs ${exchangeTx.tx.type ?? 'null'})`)
  }
  if (!assetsMatch(userTx.tx.asset, exchangeTx.tx.asset, aliasMap)) {
    details.push(`asset mismatch (${userTx.tx.asset ?? 'null'} vs ${exchangeTx.tx.asset ?? 'null'})`)
  }
  if (userTx.tx.timestamp && exchangeTx.tx.timestamp) {
    const tsDiff = Math.abs(userTx.tx.timestamp.getTime() - exchangeTx.tx.timestamp.getTime()) / 1000
    if (!timestampsWithin(userTx.tx.timestamp, exchangeTx.tx.timestamp, config.timestampToleranceSeconds)) {
      details.push(`timestamp diff ${tsDiff}s (tolerance ${config.timestampToleranceSeconds}s)`)
    }
  } else {
    details.push('timestamp missing')
  }
  if (userTx.tx.quantity !== null && exchangeTx.tx.quantity !== null) {
    const diff = quantityDiffPct(userTx.tx.quantity, exchangeTx.tx.quantity)
    if (!quantitiesWithin(userTx.tx.quantity, exchangeTx.tx.quantity, config.quantityTolerancePct)) {
      details.push(`quantity diff ${diff.toFixed(4)}% (tolerance ${config.quantityTolerancePct}%)`)
    }
  } else {
    details.push('quantity missing')
  }
  return details
}

function buildMatchReason(pass: PassDefinition, userTx: IndexedTx, exchangeTx: IndexedTx): string {
  if (pass.name.startsWith('Pass 1')) {
    return 'Matched on pass 1'
  }
  const details: string[] = []
  if ((userTx.tx.type ?? '').toUpperCase() !== (exchangeTx.tx.type ?? '').toUpperCase()) {
    details.push('type-mapped')
  }
  if ((userTx.tx.asset ?? '').toUpperCase() !== (exchangeTx.tx.asset ?? '').toUpperCase()) {
    details.push('asset-aliased')
  }
  return details.length ? `Matched on ${pass.name} [${details.join(', ')}]` : `Matched on ${pass.name}`
}

function buildConflictReason(context: string, details: string[]): string {
  if (details.length === 0) return `${context} [fields differ beyond tolerance]`
  return `${context} [${details.join(', ')}]`
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

  const exchangeById = new Map<string, number[]>()
  availableExchange.forEach((entry, idx) => {
    if (!entry?.tx.transactionId) return
    const list = exchangeById.get(entry.tx.transactionId) ?? []
    list.push(idx)
    exchangeById.set(entry.tx.transactionId, list)
  })

  for (let ui = 0; ui < availableUser.length; ui++) {
    if (usedUser.has(ui)) continue
    const uTx = availableUser[ui]
    if (!uTx?.tx.transactionId) continue
    const candidates = exchangeById.get(uTx.tx.transactionId)
    if (!candidates || candidates.length === 0) continue
    const matchIndex = candidates.find(idx => !usedExchange.has(idx))
    if (matchIndex === undefined) continue
    const eTx = availableExchange[matchIndex]
    if (!eTx) continue

    const typeMap = DEFAULT_TYPE_MAPPINGS
    const aliasMap = DEFAULT_ASSET_ALIASES
    const baseOk = withinBaseTolerance(uTx, eTx, config, typeMap, aliasMap)
    if (baseOk) {
      results.push(buildMatchResult(uTx, eTx, 'matched', 'Matched on transactionId'))
    } else {
      const details = buildDifferenceDetails(uTx, eTx, config, typeMap, aliasMap)
      results.push(buildMatchResult(uTx, eTx, 'conflicting', buildConflictReason('Conflicting on transactionId', details)))
    }
    usedUser.add(ui)
    usedExchange.add(matchIndex)
  }

  for (const pass of STRICT_PASSES) {
    for (let ui = 0; ui < availableUser.length; ui++) {
      if (usedUser.has(ui)) continue
      const uTx = availableUser[ui]
      if (!uTx) continue

      for (let ei = 0; ei < availableExchange.length; ei++) {
        if (usedExchange.has(ei)) continue
        const eTx = availableExchange[ei]
        if (!eTx) continue

        if (relate(uTx, eTx, pass, config)) {
          const reason = buildMatchReason(pass, uTx, eTx)
          results.push(buildMatchResult(uTx, eTx, 'matched', reason))
          usedUser.add(ui)
          usedExchange.add(ei)
          break
        }
      }
    }
  }

  for (const pass of CONFLICT_PASSES) {
    const typeMap = pass.useTypeMapping ? DEFAULT_TYPE_MAPPINGS : {}
    const aliasMap = pass.useAliasMapping ? DEFAULT_ASSET_ALIASES : {}
    for (let ui = 0; ui < availableUser.length; ui++) {
      if (usedUser.has(ui)) continue
      const uTx = availableUser[ui]
      if (!uTx) continue

      for (let ei = 0; ei < availableExchange.length; ei++) {
        if (usedExchange.has(ei)) continue
        const eTx = availableExchange[ei]
        if (!eTx) continue

        if (relate(uTx, eTx, pass, config)) {
          if (withinBaseTolerance(uTx, eTx, config, typeMap, aliasMap)) {
            continue
          }
          const details = buildDifferenceDetails(uTx, eTx, config, typeMap, aliasMap)
          results.push(buildMatchResult(uTx, eTx, 'conflicting', buildConflictReason(`Conflicting on ${pass.name}`, details)))
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
