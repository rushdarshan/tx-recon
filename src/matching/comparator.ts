import { AssetAliasMap, TypeMapping } from '../types'

export function timestampsWithin(
  ts1: Date | null,
  ts2: Date | null,
  toleranceSeconds: number
): boolean {
  if (ts1 === null || ts2 === null) return false
  const diff = Math.abs(ts1.getTime() - ts2.getTime())
  return diff <= toleranceSeconds * 1000
}

export function quantitiesWithin(
  q1: number | null,
  q2: number | null,
  tolerancePct: number
): boolean {
  if (q1 === null || q2 === null) return false
  if (q1 === 0 && q2 === 0) return true
  const mean = (Math.abs(q1) + Math.abs(q2)) / 2
  if (mean === 0) return false
  const diffPct = (Math.abs(q1 - q2) / mean) * 100
  return diffPct <= tolerancePct
}

export function quantityDiffPct(q1: number, q2: number): number {
  const mean = (Math.abs(q1) + Math.abs(q2)) / 2
  if (mean === 0) return 0
  return (Math.abs(q1 - q2) / mean) * 100
}

export function typesMatch(
  t1: string | null,
  t2: string | null,
  typeMappings: TypeMapping
): boolean {
  if (t1 === null || t2 === null) return false
  if (t1.toUpperCase() === t2.toUpperCase()) return true
  const mapped = typeMappings[t1.toUpperCase()]
  return mapped !== undefined && mapped === t2.toUpperCase()
}

export function assetsMatch(
  a1: string | null,
  a2: string | null,
  aliasMap: AssetAliasMap
): boolean {
  if (a1 === null || a2 === null) return false
  const norm1 = a1.toUpperCase()
  const norm2 = a2.toUpperCase()
  if (norm1 === norm2) return true
  const resolved1 = aliasMap[a1.toLowerCase()]?.toUpperCase() ?? norm1
  const resolved2 = aliasMap[a2.toLowerCase()]?.toUpperCase() ?? norm2
  return resolved1 === resolved2
}
