import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { DEFAULT_THEME_ID, isThemeWindowActive, resolveThemeID } from './resolve'

const event = {
  themeId: 'programmers-day-2026',
  startsAt: '2026-10-24T00:00:00+08:00',
  endsAt: '2026-10-25T00:00:00+08:00',
}

function at(iso: string): number {
  return Date.parse(iso)
}

describe('皮肤活动时间窗', () => {
  it('左闭右开：10.24 全天生效，10.25 零点结束', () => {
    assert.equal(isThemeWindowActive(event, at('2026-10-23T23:59:59+08:00')), false)
    assert.equal(isThemeWindowActive(event, at('2026-10-24T00:00:00+08:00')), true)
    assert.equal(isThemeWindowActive(event, at('2026-10-24T23:59:59+08:00')), true)
    assert.equal(isThemeWindowActive(event, at('2026-10-25T00:00:00+08:00')), false)
  })

  it('时间解析失败时回退到后端 active', () => {
    assert.equal(isThemeWindowActive({ ...event, startsAt: 'bad' }, Date.now(), true), true)
    assert.equal(isThemeWindowActive(null, Date.now(), true), false)
  })
})

describe('皮肤选择', () => {
  it('auto：活动期间节皮肤，活动结束自动回默认', () => {
    assert.equal(resolveThemeID('auto', event, true), 'programmers-day-2026')
    assert.equal(resolveThemeID('auto', event, false), DEFAULT_THEME_ID)
    assert.equal(resolveThemeID('auto', null, true), DEFAULT_THEME_ID)
  })

  it('default 强制默认，手动皮肤活动结束后仍保留', () => {
    assert.equal(resolveThemeID('default', event, true), DEFAULT_THEME_ID)
    assert.equal(resolveThemeID('programmers-day-2026', event, false), 'programmers-day-2026')
  })
})
