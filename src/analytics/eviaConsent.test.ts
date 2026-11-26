import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'

function createMemoryStorage() {
  const store = new Map<string, string>()
  return {
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null
    },
    setItem(key: string, value: string) {
      store.set(key, String(value))
    },
    removeItem(key: string) {
      store.delete(key)
    },
    clear() {
      store.clear()
    },
  }
}

const storage = createMemoryStorage()
const session = createMemoryStorage()
;(globalThis as Record<string, unknown>).localStorage = storage
;(globalThis as Record<string, unknown>).sessionStorage = session

const evia = await import('./evia.js')

beforeEach(async () => {
  storage.clear()
  session.clear()
  if (!evia.isEviaConsentEnabled())
    await evia.setEviaConsentEnabled(true, { source: 'test_reset' })
})

test('consent defaults to enabled and persists opt-out / opt-in to localStorage', async () => {
  assert.equal(evia.isEviaConsentEnabled(), true)

  const changes: boolean[] = []
  const unsubscribe = evia.onEviaConsentChange(value => changes.push(value))

  await evia.setEviaConsentEnabled(false, { source: 'options' })
  assert.equal(evia.isEviaConsentEnabled(), false)
  assert.equal(storage.getItem(evia.EVIA_CONSENT_STORAGE_KEY), '0')
  assert.deepEqual(changes, [false])

  // Idempotent no-op when already disabled
  await evia.setEviaConsentEnabled(false, { source: 'options' })
  assert.deepEqual(changes, [false])

  await evia.setEviaConsentEnabled(true, { source: 'options' })
  assert.equal(evia.isEviaConsentEnabled(), true)
  assert.equal(storage.getItem(evia.EVIA_CONSENT_STORAGE_KEY), '1')
  assert.deepEqual(changes, [false, true])

  unsubscribe()
})

test('disabling consent suppresses subsequent calls cleanly without throwing', async () => {
  await evia.setEviaConsentEnabled(false, { source: 'options' })
  assert.equal(evia.initEvia(), null)
  assert.equal(evia.flushEvia(), null)
  assert.equal(await evia.waitForContentEncryptionConfig(10), null)
  assert.doesNotThrow(() => evia.trackEvia('post_opened', { post_id: 1, from: 'detail' }))
  assert.doesNotThrow(() => evia.identifyEvia('newsse-u42'))
  assert.doesNotThrow(() => evia.reportEviaOperationFailure({ operation: 'api:GET:/test', errorCategory: 'network', retryable: true }))
  assert.doesNotThrow(() => evia.trackExperimentExposure('feed_rank_v2', 'treatment'))
})

test('post entry hint round-trips once for matching postId and ignores mismatch', () => {
  evia.markPostEntry(1024, 'hot', 3)
  assert.equal(evia.consumePostEntry(9999), null)
  assert.deepEqual(evia.consumePostEntry(1024), { source: 'hot', rank: 3 })
  assert.equal(evia.consumePostEntry(1024), null)
})

test('bucketing helpers normalize length, price, count, and age cleanly', () => {
  assert.equal(evia.bucketLength(0), 0)
  assert.equal(evia.bucketLength(50), 1)
  assert.equal(evia.bucketLength(5000), 20)

  assert.equal(evia.bucketPrice(0), '0')
  assert.equal(evia.bucketPrice(15), '1_19')
  assert.equal(evia.bucketPrice(180), '100_299')
  assert.equal(evia.bucketPrice(2500), '1000_plus')

  assert.equal(evia.bucketCount(0), '0')
  assert.equal(evia.bucketCount(4), '1_5')
  assert.equal(evia.bucketCount(150), 'gt_100')

  assert.equal(evia.bucketAgeHours(Date.now() - 10 * 60 * 1000), 'lt_1h')
  assert.equal(evia.bucketAgeHours(Date.now() - 48 * 3600 * 1000), '1_3d')
  assert.equal(evia.bucketAgeHours('not-a-date'), 'unknown')
})

test('active dwell tracker returns bounded non-negative durations', () => {
  const tracker = evia.createActiveDwellTracker()
  const snap = tracker.snapshot()
  assert.ok(snap.totalMs >= 0 && snap.totalMs <= 3_600_000)
  assert.ok(snap.activeMs >= 0 && snap.activeMs <= snap.totalMs)
  assert.equal(snap.hiddenCount, 0)
  tracker.dispose()
})
