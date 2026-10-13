import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  collectEmojiIDs,
  formatEmojiToken,
  parseEmojiSegments,
  stripEmojiTokens,
} from './emojiToken.js'

// 与后端 domain.StripEmojiTokens 对齐：token 形态 [emoji:<id>]，预览还原成 [表情]。

test('formatEmojiToken 产出后端约定的 token', () => {
  assert.equal(formatEmojiToken(12), '[emoji:12]')
})

test('parseEmojiSegments 切出文本与表情片段', () => {
  assert.deepEqual(parseEmojiSegments('你好[emoji:3]呀'), [
    { type: 'text', text: '你好' },
    { type: 'emoji', emojiID: 3 },
    { type: 'text', text: '呀' },
  ])
  assert.deepEqual(parseEmojiSegments('[emoji:1]'), [{ type: 'emoji', emojiID: 1 }])
  assert.deepEqual(parseEmojiSegments('纯文本'), [{ type: 'text', text: '纯文本' }])
  assert.deepEqual(parseEmojiSegments(''), [])
})

test('parseEmojiSegments 不吞掉非法 token', () => {
  assert.deepEqual(parseEmojiSegments('[emoji:abc]'), [{ type: 'text', text: '[emoji:abc]' }])
  assert.deepEqual(parseEmojiSegments('[emoji:]'), [{ type: 'text', text: '[emoji:]' }])
})

test('stripEmojiTokens 与后端预览口径一致', () => {
  assert.equal(stripEmojiTokens('你好[emoji:12]呀[emoji:3]'), '你好[表情]呀[表情]')
  assert.equal(stripEmojiTokens('[emoji:abc] 不是合法 token'), '[emoji:abc] 不是合法 token')
  assert.equal(stripEmojiTokens('纯文字不被动'), '纯文字不被动')
})

test('collectEmojiIDs 去重且保持出现顺序', () => {
  assert.deepEqual(collectEmojiIDs('[emoji:5]x[emoji:2][emoji:5]'), [5, 2])
  assert.deepEqual(collectEmojiIDs('没有表情'), [])
})
