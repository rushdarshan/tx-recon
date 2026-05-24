import {
  timestampsWithin,
  quantitiesWithin,
  quantityDiffPct,
  typesMatch,
  assetsMatch,
} from '../../src/matching/comparator'
import { DEFAULT_TYPE_MAPPINGS, DEFAULT_ASSET_ALIASES } from '../../src/matching/typeMappings'

describe('timestampsWithin', () => {
  it('returns true for exact same time', () => {
    const d = new Date('2024-03-01T09:00:00Z')
    expect(timestampsWithin(d, d, 300)).toBe(true)
  })

  it('returns true within tolerance', () => {
    const d1 = new Date('2024-03-01T09:00:00Z')
    const d2 = new Date('2024-03-01T09:00:32Z')
    expect(timestampsWithin(d1, d2, 300)).toBe(true)
  })

  it('returns false outside tolerance', () => {
    const d1 = new Date('2024-03-01T09:00:00Z')
    const d2 = new Date('2024-03-01T10:00:00Z')
    expect(timestampsWithin(d1, d2, 300)).toBe(false)
  })

  it('returns false when either is null', () => {
    expect(timestampsWithin(null, new Date(), 300)).toBe(false)
    expect(timestampsWithin(new Date(), null, 300)).toBe(false)
    expect(timestampsWithin(null, null, 300)).toBe(false)
  })
})

describe('quantitiesWithin', () => {
  it('returns true for exact same quantity', () => {
    expect(quantitiesWithin(0.5, 0.5, 0.01)).toBe(true)
  })

  it('returns true within tolerance', () => {
    expect(quantitiesWithin(0.3, 0.3001, 0.01)).toBe(false)
    expect(quantitiesWithin(0.3, 0.300001, 0.01)).toBe(true)
  })

  it('returns false outside tolerance', () => {
    expect(quantitiesWithin(0.3, 0.31, 0.01)).toBe(false)
  })

  it('returns true when both are zero', () => {
    expect(quantitiesWithin(0, 0, 0.01)).toBe(true)
  })

  it('returns false when either is null', () => {
    expect(quantitiesWithin(null, 0.5, 0.01)).toBe(false)
    expect(quantitiesWithin(0.5, null, 0.01)).toBe(false)
    expect(quantitiesWithin(null, null, 0.01)).toBe(false)
  })
})

describe('quantityDiffPct', () => {
  it('computes percentage difference', () => {
    const diff = quantityDiffPct(100, 101)
    expect(diff).toBeCloseTo(0.995, 2)
  })
})

describe('typesMatch', () => {
  it('matches exact same type', () => {
    expect(typesMatch('BUY', 'BUY', {})).toBe(true)
  })

  it('matches case-insensitively', () => {
    expect(typesMatch('buy', 'BUY', {})).toBe(true)
  })

  it('matches TRANSFER_IN to TRANSFER_OUT via mapping', () => {
    expect(typesMatch('TRANSFER_OUT', 'TRANSFER_IN', DEFAULT_TYPE_MAPPINGS)).toBe(true)
  })

  it('does not match unrelated types', () => {
    expect(typesMatch('BUY', 'SELL', DEFAULT_TYPE_MAPPINGS)).toBe(false)
  })

  it('returns false when either is null', () => {
    expect(typesMatch(null, 'BUY', {})).toBe(false)
    expect(typesMatch('BUY', null, {})).toBe(false)
  })
})

describe('assetsMatch', () => {
  it('matches exact same asset', () => {
    expect(assetsMatch('BTC', 'BTC', {})).toBe(true)
  })

  it('matches case-insensitively', () => {
    expect(assetsMatch('btc', 'BTC', {})).toBe(true)
  })

  it('resolves aliased asset', () => {
    expect(assetsMatch('bitcoin', 'BTC', DEFAULT_ASSET_ALIASES)).toBe(true)
  })

  it('does not match different assets', () => {
    expect(assetsMatch('BTC', 'ETH', DEFAULT_ASSET_ALIASES)).toBe(false)
  })

  it('returns false when either is null', () => {
    expect(assetsMatch(null, 'BTC', {})).toBe(false)
    expect(assetsMatch('BTC', null, {})).toBe(false)
  })
})
