import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { detectAppPlatform } from './appPlatform'

const UA = {
  android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
  harmonyNext: 'Mozilla/5.0 (Phone; OpenHarmony 5.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36 ArkWeb/4.1.6.1 Mobile',
  harmonyLegacy: 'Mozilla/5.0 (Linux; Android 12; HarmonyOS; NOH-AN00) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.88 Mobile Safari/537.36',
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  windows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  linux: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
}

describe('集市 App 终端识别', () => {
  it('手机端：Android 走 Android 包', () => {
    const info = detectAppPlatform(UA.android)
    assert.deepEqual(
      { platform: info.platform, device: info.device, supported: info.supported },
      { platform: 'android', device: 'mobile', supported: true },
    )
  })

  it('手机端：鸿蒙 NEXT（OpenHarmony）识别为鸿蒙，但 HAP 未签名暂不提供', () => {
    const info = detectAppPlatform(UA.harmonyNext)
    assert.equal(info.platform, 'harmony')
    assert.equal(info.device, 'mobile')
    assert.equal(info.supported, false)
  })

  it('手机端：老版鸿蒙仍带 Android 标记，走 Android 包', () => {
    const info = detectAppPlatform(UA.harmonyLegacy)
    assert.equal(info.platform, 'android')
    assert.equal(info.device, 'mobile')
  })

  it('手机端：iPhone 暂未提供', () => {
    const info = detectAppPlatform(UA.iphone)
    assert.equal(info.platform, 'ios')
    assert.equal(info.device, 'mobile')
    assert.equal(info.supported, false)
  })

  it('iPadOS 13+ 伪装成 Macintosh，有触屏时仍判为 iOS', () => {
    const info = detectAppPlatform(UA.mac, 5)
    assert.equal(info.platform, 'ios')
    assert.equal(info.device, 'mobile')
    assert.equal(info.supported, false)
  })

  it('桌面端：Windows 走 Windows 包', () => {
    const info = detectAppPlatform(UA.windows)
    assert.equal(info.platform, 'windows')
    assert.equal(info.device, 'desktop')
    assert.equal(info.supported, true)
  })

  it('桌面端：Linux 走 Linux 包', () => {
    const info = detectAppPlatform(UA.linux)
    assert.equal(info.platform, 'linux')
    assert.equal(info.device, 'desktop')
    assert.equal(info.supported, true)
  })

  it('桌面端：macOS 暂未提供', () => {
    const info = detectAppPlatform(UA.mac)
    assert.equal(info.device, 'desktop')
    assert.equal(info.supported, false)
  })

  it('识别不出的桌面浏览器归为 other，不支持下载', () => {
    const info = detectAppPlatform('SomeUnknownBrowser/1.0')
    assert.equal(info.platform, 'other')
    assert.equal(info.device, 'desktop')
    assert.equal(info.supported, false)
  })

  it('识别不出的手机浏览器归为 other + mobile', () => {
    const info = detectAppPlatform('SomeFeaturePhone/1.0 Mobile')
    assert.equal(info.platform, 'other')
    assert.equal(info.device, 'mobile')
    assert.equal(info.supported, false)
  })
})