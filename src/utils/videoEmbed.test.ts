import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseVideoReference, videoEmbedPath } from './videoEmbed.js'

test('parses a video ID and marketplace video URL', () => {
  assert.equal(parseVideoReference('8'), 8)
  assert.equal(parseVideoReference(' 8 '), 8)
  assert.equal(parseVideoReference('/video/8'), 8)
  assert.equal(parseVideoReference('/video/8/'), 8)
  assert.equal(parseVideoReference('https://ssemarket.cn/video/8'), 8)
  assert.equal(parseVideoReference('http://localhost:5173/video/8'), 8)
})

test('rejects video references that are not a public video ID', () => {
  const invalid = [
    '',
    '0',
    '-1',
    '8x',
    'javascript:alert(1)',
    'https://example.com/video/8',
  ]
  for (const value of invalid)
    assert.equal(parseVideoReference(value), null)
})

test('builds the canonical embed route for a valid video ID', () => {
  assert.equal(videoEmbedPath(8), '/embed/video/8')
})
