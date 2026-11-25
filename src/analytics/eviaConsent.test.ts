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
;(globalThis as Record<string, unknown>).localStorage = storage

const evia = await import('./evia.js')

beforeEach(async () => {
  storage.clear()
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
})
