import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { extractBaseShortcode } from './emojiShortcode'

describe('emojiShortcode', () => {
  it('普通表情：取第一个 shortcode', () => {
    assert.equal(extractBaseShortcode(':smile:'), ':smile:')
    assert.equal(extractBaseShortcode(':heart_eyes:'), ':heart_eyes:')
  })

  it('带肤色变体：剥离 :skin-tone-N:，只留基础表情', () => {
    assert.equal(extractBaseShortcode(':+1::skin-tone-3:'), ':+1:')
    assert.equal(extractBaseShortcode(':+1::skin-tone-1:'), ':+1:')
  })

  it('shortcodes 缺失时回退 :id:', () => {
    assert.equal(extractBaseShortcode(undefined, 'heart'), ':heart:')
    assert.equal(extractBaseShortcode('', 'tada'), ':tada:')
  })

  it('两者皆无：返回空串，调用方放弃插入', () => {
    assert.equal(extractBaseShortcode(), '')
    assert.equal(extractBaseShortcode('', ''), '')
  })

  it('shortcodes 本身是肤色色卡时回退 id，避免插出色卡', () => {
    assert.equal(extractBaseShortcode(':skin-tone-2:', 'raised_hands'), ':raised_hands:')
  })
})
