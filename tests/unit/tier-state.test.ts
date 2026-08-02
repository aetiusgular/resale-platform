import { describe, it, expect } from 'vitest'
import { effectiveTierBps, isUpgrade, shouldRefreshLock, TIER_LOCK_DAYS, TIER_LOCK_MS } from '../../lib/tier-state'

const NOW = 1_800_000_000_000 // fixed epoch for the sandbox (no Date.now in assertions)

describe('tier-state constants', () => {
  it('30-day lock in ms', () => {
    expect(TIER_LOCK_DAYS).toBe(30)
    expect(TIER_LOCK_MS).toBe(30 * 24 * 60 * 60 * 1000)
  })
})

describe('effectiveTierBps', () => {
  it('no lock → pure activity rate', () => {
    expect(effectiveTierBps(500, null, null, NOW)).toBe(500)
    expect(effectiveTierBps(300, null, NOW + 1000, NOW)).toBe(300) // lockedBps null → ignored
  })
  it('activity WORSE during an active lock → keep the locked (better) rate (grace)', () => {
    expect(effectiveTierBps(500, 200, NOW + TIER_LOCK_MS, NOW)).toBe(200)
  })
  it('activity BETTER during an active lock → the better rate wins', () => {
    expect(effectiveTierBps(200, 300, NOW + TIER_LOCK_MS, NOW)).toBe(200)
  })
  it('expired lock → degrade to activity', () => {
    expect(effectiveTierBps(500, 200, NOW - 1, NOW)).toBe(500)
  })
  it('boundary: nowMs === lockedUntil is treated as expired (strict <)', () => {
    expect(effectiveTierBps(500, 200, NOW, NOW)).toBe(500)
  })
})

describe('isUpgrade', () => {
  it('first-ever rate is always an upgrade', () => {
    expect(isUpgrade(500, null)).toBe(true)
  })
  it('strictly lower bps upgrades; equal or worse does not', () => {
    expect(isUpgrade(200, 300)).toBe(true)
    expect(isUpgrade(300, 300)).toBe(false)
    expect(isUpgrade(400, 300)).toBe(false)
  })
})

describe('shouldRefreshLock (rolling grace, non-exploitable)', () => {
  it('no active lock (absent) → always (re)lock at current activity', () => {
    expect(shouldRefreshLock(500, null, null, NOW)).toBe(true)
  })
  it('no active lock (expired) → relock, even if stored bps was better (clears stale)', () => {
    // The #3 fix: elite (200) locked long ago, expired; re-earn tier-3 (350) now → relock.
    expect(shouldRefreshLock(350, 200, NOW - 1, NOW)).toBe(true)
  })
  it('active lock, activity same tier → refresh (rolling 30 days)', () => {
    expect(shouldRefreshLock(200, 200, NOW + TIER_LOCK_MS, NOW)).toBe(true)
  })
  it('active lock, activity improved → relock at the better rate', () => {
    expect(shouldRefreshLock(200, 350, NOW + TIER_LOCK_MS, NOW)).toBe(true)
  })
  it('active lock, activity WORSE → do NOT extend (no gaming a one-time high tier)', () => {
    expect(shouldRefreshLock(500, 200, NOW + TIER_LOCK_MS, NOW)).toBe(false)
  })
  it('boundary: nowMs === until is expired → relock', () => {
    expect(shouldRefreshLock(500, 200, NOW, NOW)).toBe(true)
  })
})
