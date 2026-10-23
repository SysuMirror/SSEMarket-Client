import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  isRemoteImageURL,
  normalizeCustomBackgroundURL,
  resolveUserImageURL,
} from './imageSource'

describe('imageSource', () => {
  it('只接受绝对 http(s) 图床地址', () => {
    assert.equal(isRemoteImageURL('https://cdn.example.com/a.jpg?x-oss-process=resize'), true)
    assert.equal(isRemoteImageURL('http://cdn.example.com/a.png'), true)
    assert.equal(isRemoteImageURL(' /skins/programmers-day-2026/bg-desktop.webp '), false)
    assert.equal(isRemoteImageURL('skins/bg.webp'), false)
    assert.equal(isRemoteImageURL('//cdn.example.com/a.jpg'), false)
    assert.equal(isRemoteImageURL('data:image/png;base64,AAAA'), false)
    assert.equal(isRemoteImageURL('blob:https://x/y'), false)
    assert.equal(isRemoteImageURL('javascript:alert(1)'), false)
    assert.equal(isRemoteImageURL(`https://cdn.example.com/${'a'.repeat(2100)}`), false)
  })

  it('规范化自定义背景地址：trim、去 fragment、空串表示清除', () => {
    assert.equal(
      normalizeCustomBackgroundURL(' https://cdn.example.com/a.jpg#x '),
      'https://cdn.example.com/a.jpg',
    )
    assert.equal(normalizeCustomBackgroundURL('   '), '')
    assert.equal(normalizeCustomBackgroundURL('/skins/bg.webp'), null)
    assert.equal(normalizeCustomBackgroundURL('javascript:alert(1)'), null)
  })

  it('展示用户图片时非法地址一律回退为空', () => {
    assert.equal(resolveUserImageURL('https://cdn.example.com/a.jpg'), 'https://cdn.example.com/a.jpg')
    assert.equal(resolveUserImageURL('/new/skins/bg.webp'), '')
    assert.equal(resolveUserImageURL(null), '')
  })
})
