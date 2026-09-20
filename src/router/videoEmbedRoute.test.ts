import assert from 'node:assert/strict'
import { test } from 'node:test'

;(globalThis as any).window ??= {
  location: new URL('https://ssemarket.cn/'),
  history: { state: null, replaceState() {}, pushState() {} },
  addEventListener() {},
  removeEventListener() {},
}
;(globalThis as any).location ??= (globalThis as any).window.location
;(globalThis as any).document ??= {
  createElement: () => ({ content: { innerHTML: '' }, innerHTML: '' }),
  addEventListener() {},
  removeEventListener() {},
  visibilityState: 'visible',
}

const { default: router } = await import('./index.js')

function findRoute(path: string) {
  return router.options.routes.find(route => route.path === path)
}

test('exposes a layout-free public video embed route', () => {
  const route = findRoute('/embed/video/:videoID')

  assert.ok(route, 'embed route is registered')
  assert.equal(route.name, 'VideoEmbed')
  assert.equal(route.meta?.public, true)
  assert.equal(typeof route.component, 'function')
})

test('resolves embed URLs with a numeric video ID', () => {
  const resolved = router.resolve('/embed/video/8')

  assert.equal(resolved.name, 'VideoEmbed')
  assert.equal(resolved.params.videoID, '8')
})
