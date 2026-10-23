<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'
import { uploadPhoto } from '@/api/editPostAndComment/utils'
import { confirmDialog } from '@/components/ConfirmDialog'
import { showMsg } from '@/components/MessageBox'
import { SettingsToggle } from '@/components/settings'
import { useSkin } from '@/composables/useSkin'
import { SKIN_LIST, skinAssetURL, skinStickerURL } from '@/skins'
import { isRemoteImageURL, resolveUserImageURL } from '@/utils/imageSource'

/**
 * 设置页「外观」分组：
 * - 皮肤选择（默认 / 各节日限定）；
 * - 开场画面开关 + 预览；
 * - 全站背景开关、来源（皮肤内置 / 自定义图床）、上传/移除；
 * - 节日表情墙（12 张贴纸）。
 *
 * 图片边界：
 * - 皮肤内置背景/贴纸 → skinAssetURL()（public 资源）；
 * - 用户上传背景 → uploadPhotos 返回的绝对 http(s) 图床地址，存服务端。
 *   绝不允许把 public 相对路径写入用户设置。
 */
const {
  state,
  event,
  eventActive,
  effectiveThemeId,
  activeSkin,
  splashSources,
  previewSplash,
  setThemeMode,
  resetThemeModeToAuto,
  setSplashEnabled,
  setBackgroundEnabled,
  setBackgroundSource,
  setCustomBackground,
  clearCustomBackground,
} = useSkin()

const bgFileInput = useTemplateRef<HTMLInputElement>('bgFileInput')
const uploading = ref(false)

const skinCards = computed(() => SKIN_LIST)
const saving = computed(() => state.saving || uploading.value)
const customPreview = computed(() => resolveUserImageURL(state.prefs.customBackgroundUrl))

const isDefaultEffective = computed(() => effectiveThemeId.value === 'default')
const isCustomSource = computed(() => state.prefs.backgroundSource === 'custom')

const skinBackgroundPreview = computed(() => {
  const skin = activeSkin.value
  return skin ? skinAssetURL(skin.id, skin.background.desktop) : ''
})

const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  month: 'long',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

function formatDate(iso: string): string {
  const t = Date.parse(iso)
  return Number.isFinite(t) ? dateFormatter.format(t) : ''
}

const eventRange = computed(() => {
  const e = event.value
  if (!e)
    return ''
  const start = formatDate(e.startsAt)
  const end = formatDate(e.endsAt)
  return start && end ? `${start} — ${end}（北京时间）` : ''
})

const eventStatus = computed(() => {
  const e = event.value
  if (!e)
    return { text: '正在读取活动时间…', tone: 'muted' as const }
  if (eventActive.value)
    return { text: '活动进行中 · 节日皮肤自动启用', tone: 'active' as const }
  const now = Date.now()
  const start = Date.parse(e.startsAt)
  if (Number.isFinite(start) && now < start)
    return { text: '活动尚未开始 · 开始后自动启用', tone: 'pending' as const }
  return { text: '活动已结束 · 仍可手动使用本皮肤', tone: 'ended' as const }
})

const eventLabel = computed(() => event.value?.name || '节日皮肤')

const selectedSticker = ref<{ label: string, note?: string } | null>(null)
const stickerWall = computed(() => {
  const skin = activeSkin.value
  if (!skin)
    return []
  return skin.stickers.map(sticker => ({
    ...sticker,
    url: skinStickerURL(skin.id, sticker.file),
  }))
})

async function run(action: Promise<{ ok: boolean, msg: string }>) {
  const result = await action
  if (!result.ok)
    showMsg(result.msg)
  return result
}

async function chooseTheme(themeMode: string) {
  if (saving.value || state.prefs.themeMode === themeMode)
    return
  await run(setThemeMode(themeMode))
}

async function useAutoTheme() {
  if (saving.value)
    return
  const result = await run(resetThemeModeToAuto())
  if (result.ok)
    showMsg('已恢复：活动期间自动使用节日皮肤')
}

async function onSplashToggle(value: boolean) {
  if (saving.value)
    return
  const result = await run(setSplashEnabled(value))
  if (result.ok && value)
    showMsg('已开启，下次进入网站时会展示 3 秒开场画面')
}

async function onBackgroundToggle(value: boolean) {
  if (saving.value)
    return
  await run(setBackgroundEnabled(value))
}

async function chooseBackgroundSource(source: 'default' | 'custom') {
  if (saving.value || state.prefs.backgroundSource === source)
    return
  if (source === 'custom' && !customPreview.value) {
    showMsg('请先上传一张自定义背景图片')
    bgFileInput.value?.click()
    return
  }
  await run(setBackgroundSource(source))
}

function openFilePicker() {
  if (saving.value)
    return
  bgFileInput.value?.click()
}

async function onBackgroundFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file)
    return
  if (!file.type.startsWith('image/')) {
    showMsg('请选择图片文件')
    input.value = ''
    return
  }
  if (file.size > 15 * 1024 * 1024) {
    showMsg('图片不能超过 15MB')
    input.value = ''
    return
  }

  uploading.value = true
  try {
    const data = await uploadPhoto(file)
    // 图床必须返回绝对地址；相对路径/空地址一律不落库，避免换环境 404。
    if (!isRemoteImageURL(data.fileURL)) {
      showMsg('上传成功但未拿到有效的图床地址，请重试')
      return
    }
    const result = await run(setCustomBackground(data.fileURL))
    if (result.ok)
      showMsg('背景已更新')
  }
  catch (e) {
    console.error('[skin] upload background failed', e)
    showMsg('上传失败，请稍后重试')
  }
  finally {
    uploading.value = false
    input.value = ''
  }
}

async function removeCustomBackground() {
  if (saving.value || !customPreview.value)
    return
  const ok = await confirmDialog({
    message: '移除已上传的背景图片？移除后会使用皮肤自带背景。',
    confirmText: '移除',
    danger: true,
  })
  if (!ok)
    return
  const result = await run(clearCustomBackground())
  if (result.ok)
    showMsg('已移除自定义背景')
}

function previewSplashScreen() {
  if (!activeSkin.value) {
    showMsg('切换到节日皮肤后即可预览开场画面')
    return
  }
  previewSplash()
}
</script>

<template>
  <div class="skin-settings">
    <div class="skin-settings__status">
      <span class="skin-settings__status-dot" :class="`skin-settings__status-dot--${eventStatus.tone}`" aria-hidden="true" />
      <div class="skin-settings__status-text">
        <span class="skin-settings__status-title">{{ eventStatus.text }}</span>
        <span v-if="eventRange" class="skin-settings__status-meta">{{ eventRange }}</span>
      </div>
    </div>

    <div class="skin-settings__section">
      <div class="skin-settings__section-head">
        <span class="skin-settings__section-title">网站皮肤</span>
        <button
          v-if="state.prefs.themeMode !== 'auto'"
          type="button"
          class="skin-settings__text-btn"
          :disabled="saving"
          @click="useAutoTheme"
        >
          恢复活动自动切换
        </button>
      </div>

      <div class="skin-theme-grid">
        <button
          type="button"
          class="skin-theme-card"
          :class="{ 'skin-theme-card--active': isDefaultEffective }"
          :aria-pressed="isDefaultEffective"
          :disabled="saving"
          @click="chooseTheme('default')"
        >
          <span class="skin-theme-card__thumb skin-theme-card__thumb--default" aria-hidden="true">
            <span class="skin-theme-card__thumb-bar" />
            <span class="skin-theme-card__thumb-block" />
            <span class="skin-theme-card__thumb-block skin-theme-card__thumb-block--short" />
          </span>
          <span class="skin-theme-card__copy">
            <strong>默认皮肤</strong>
            <span>站点原有配色</span>
          </span>
          <span v-if="isDefaultEffective" class="skin-theme-card__check" aria-hidden="true">✓</span>
        </button>

        <button
          v-for="skin in skinCards"
          :key="skin.id"
          type="button"
          class="skin-theme-card"
          :class="{ 'skin-theme-card--active': effectiveThemeId === skin.id }"
          :aria-pressed="effectiveThemeId === skin.id"
          :disabled="saving"
          @click="chooseTheme(skin.id)"
        >
          <span class="skin-theme-card__thumb">
            <img
              :src="skinAssetURL(skin.id, skin.background.desktop)"
              alt=""
              loading="lazy"
              decoding="async"
              draggable="false"
            >
          </span>
          <span class="skin-theme-card__copy">
            <strong>{{ skin.name }}</strong>
            <span>{{ skin.description }}</span>
            <span v-if="state.prefs.themeMode === 'auto' && eventActive" class="skin-theme-card__badge">活动期间自动</span>
            <span v-else-if="state.prefs.themeMode === skin.id" class="skin-theme-card__badge skin-theme-card__badge--manual">已手动保留</span>
          </span>
          <span v-if="effectiveThemeId === skin.id" class="skin-theme-card__check" aria-hidden="true">✓</span>
        </button>
      </div>
      <p class="skin-settings__hint">
        活动当天默认全员自动使用{{ eventLabel }}；活动结束后自动回到默认皮肤，手动选择过的皮肤会保留。
      </p>
    </div>

    <SettingsToggle
      :model-value="state.prefs.splashEnabled"
      :disabled="saving"
      title="进入网站时显示开场画面"
      hint="展示 3 秒，右上角可随时跳过；每个会话只出现一次"
      @update:model-value="onSplashToggle"
    />

    <div class="skin-settings__section skin-settings__section--bg">
      <div class="skin-settings__section-head skin-settings__section-head--padded">
        <span class="skin-settings__section-title">全站背景</span>
        <button
          v-if="activeSkin && splashSources"
          type="button"
          class="skin-settings__text-btn"
          :disabled="saving"
          @click="previewSplashScreen"
        >
          预览开场画面
        </button>
      </div>

      <SettingsToggle
        :model-value="state.prefs.backgroundEnabled"
        :disabled="saving"
        title="显示全站背景图片"
        hint="关闭后使用网站默认底色，不影响其他功能"
        @update:model-value="onBackgroundToggle"
      />

      <div class="skin-bg-source" :class="{ 'skin-bg-source--disabled': !state.prefs.backgroundEnabled }">
        <div class="skin-bg-source__segmented" role="group" aria-label="背景来源">
          <button
            type="button"
            class="skin-bg-source__option"
            :class="{ 'skin-bg-source__option--active': !isCustomSource }"
            :aria-pressed="!isCustomSource"
            :disabled="saving || !state.prefs.backgroundEnabled"
            @click="chooseBackgroundSource('default')"
          >
            皮肤背景
          </button>
          <button
            type="button"
            class="skin-bg-source__option"
            :class="{ 'skin-bg-source__option--active': isCustomSource }"
            :aria-pressed="isCustomSource"
            :disabled="saving || !state.prefs.backgroundEnabled"
            @click="chooseBackgroundSource('custom')"
          >
            自定义图片
          </button>
        </div>

        <div class="skin-bg-preview" :class="{ 'skin-bg-preview--empty': !state.prefs.backgroundEnabled }">
          <template v-if="state.prefs.backgroundEnabled">
            <img
              v-if="isCustomSource && customPreview"
              :src="customPreview"
              alt="自定义背景预览"
              loading="lazy"
              decoding="async"
              draggable="false"
            >
            <img
              v-else-if="!isCustomSource && skinBackgroundPreview"
              :src="skinBackgroundPreview"
              :alt="`${eventLabel}自带背景预览`"
              loading="lazy"
              decoding="async"
              draggable="false"
            >
            <div v-else class="skin-bg-preview__placeholder">
              {{ isCustomSource ? '尚未上传自定义图片' : '当前皮肤没有内置背景' }}
            </div>
            <span class="skin-bg-preview__badge">
              {{ isCustomSource ? (customPreview ? '图床图片' : '待上传') : (skinBackgroundPreview ? '皮肤内置资源' : '默认底色') }}
            </span>
          </template>
          <div v-else class="skin-bg-preview__placeholder">
            背景已关闭
          </div>
        </div>

        <div class="skin-bg-actions">
          <button
            type="button"
            class="skin-settings__btn skin-settings__btn--primary"
            :disabled="saving || !state.prefs.backgroundEnabled"
            @click="openFilePicker"
          >
            {{ uploading ? '上传中…' : (customPreview ? '更换图片' : '上传图片') }}
          </button>
          <button
            v-if="customPreview"
            type="button"
            class="skin-settings__btn"
            :disabled="saving || !state.prefs.backgroundEnabled"
            @click="removeCustomBackground"
          >
            移除
          </button>
        </div>
        <p class="skin-settings__hint">
          建议使用 16:9 横图（JPG/PNG，至少 1280px 宽，≤15MB）。自定义图片会上传到图床并以绝对地址保存；皮肤内置背景来自前端 public 资源，两者互不混用。
        </p>
        <input
          ref="bgFileInput"
          type="file"
          accept="image/jpeg,image/png,image/gif"
          class="skin-bg-file"
          @change="onBackgroundFileChange"
        >
      </div>
    </div>

    <div v-if="stickerWall.length" class="skin-settings__section skin-settings__section--stickers">
      <div class="skin-settings__section-head">
        <span class="skin-settings__section-title">节日表情墙</span>
        <span class="skin-settings__section-meta">{{ eventLabel }}</span>
      </div>
      <div class="skin-sticker-wall" role="list">
        <button
          v-for="sticker in stickerWall"
          :key="sticker.id"
          type="button"
          class="skin-sticker"
          role="listitem"
          :aria-label="`${sticker.label}${sticker.note ? `：${sticker.note}` : ''}`"
          :title="sticker.note || sticker.label"
          @click="selectedSticker = sticker"
        >
          <img
            :src="sticker.url"
            :alt="sticker.label"
            loading="lazy"
            decoding="async"
            draggable="false"
          >
          <span>{{ sticker.label }}</span>
        </button>
      </div>
      <p class="skin-sticker__caption">
        <template v-if="selectedSticker">
          <strong>{{ selectedSticker.label }}</strong>
          <span v-if="selectedSticker.note"> · {{ selectedSticker.note }}</span>
        </template>
        <template v-else>
          点一张贴纸，收获一句程序员祝福
        </template>
      </p>
    </div>
  </div>
</template>

<style scoped lang="scss">
.skin-settings {
  background: var(--color-card);
}

.skin-settings__status {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 13px 16px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-card);
}

.skin-settings__status-dot {
  flex: 0 0 auto;
  width: 8px;
  height: 8px;
  margin-top: 5px;
  border-radius: 50%;
  background: var(--color-text-muted);

  &--active {
    background: #22c55e;
    box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.14);
  }

  &--pending {
    background: #f59e0b;
    box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.14);
  }

  &--ended {
    background: #94a3b8;
    box-shadow: 0 0 0 4px rgba(148, 163, 184, 0.14);
  }
}

.skin-settings__status-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.skin-settings__status-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
  line-height: 1.4;
}

.skin-settings__status-meta {
  font-size: 11px;
  color: var(--color-text-muted);
  line-height: 1.5;
}

.skin-settings__section {
  padding: 13px 16px;
  border-bottom: 1px solid var(--color-border);

  &--bg {
    padding: 0;
  }

  &--stickers {
    border-bottom: none;
  }
}

.skin-settings__section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}

.skin-settings__section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
}

.skin-settings__section-head--padded {
  padding: 13px 16px 0;
}

.skin-settings__section-meta {
  font-size: 11px;
  color: var(--color-text-muted);
}

.skin-settings__text-btn {
  padding: 2px 0;
  border: none;
  background: transparent;
  color: var(--accent);
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;

  &:hover {
    color: var(--accent-hover);
    text-decoration: underline;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.skin-theme-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 10px;
}

.skin-theme-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-lg);
  background: var(--color-bg);
  color: var(--color-text);
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;

  &:hover {
    border-color: var(--accent);
  }

  &--active {
    border-color: var(--accent);
    box-shadow: 0 0 0 2px var(--accent-soft);
    background: var(--color-card);
  }

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.skin-theme-card__thumb {
  position: relative;
  flex: 0 0 auto;
  width: 72px;
  height: 54px;
  overflow: hidden;
  border-radius: 8px;
  background: linear-gradient(135deg, #eef5ff, #d9e9ff);

  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center 38%;
  }

  &--default {
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: 7px;
    background: linear-gradient(135deg, #f5f6f7, #e8edf3);
  }
}

.skin-theme-card__thumb-bar {
  width: 100%;
  height: 7px;
  border-radius: 4px;
  background: #2c3d56;
  opacity: 0.75;
}

.skin-theme-card__thumb-block {
  width: 100%;
  height: 9px;
  border-radius: 3px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(44, 61, 86, 0.08);

  &--short {
    width: 68%;
  }
}

.skin-theme-card__copy {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;

  strong {
    font-size: 13px;
    font-weight: 600;
    line-height: 1.35;
    color: var(--color-text);
  }

  > span:not(.skin-theme-card__badge) {
    font-size: 11px;
    line-height: 1.4;
    color: var(--color-text-muted);
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }
}

.skin-theme-card__badge {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  margin-top: 2px;
  padding: 1px 6px;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent) !important;
  font-size: 10px !important;
  font-weight: 600;

  &--manual {
    background: rgba(148, 163, 184, 0.16);
    color: var(--color-text-secondary) !important;
  }
}

.skin-theme-card__check {
  position: absolute;
  top: 6px;
  right: 6px;
  display: grid;
  place-items: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--accent);
  color: #fff;
  font-size: 11px;
  line-height: 1;
}

.skin-settings__hint {
  margin: 9px 0 0;
  font-size: 11px;
  line-height: 1.6;
  color: var(--color-text-muted);
}

.skin-bg-source {
  position: relative;
  padding: 12px 16px 13px;

  &--disabled {
    opacity: 0.62;
  }
}

.skin-bg-source__segmented {
  display: inline-flex;
  padding: 3px;
  border-radius: 999px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
}

.skin-bg-source__option {
  min-height: 30px;
  padding: 0 14px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;

  &--active {
    background: var(--color-card);
    color: var(--accent);
    font-weight: 600;
    box-shadow: 0 1px 3px rgba(44, 61, 86, 0.1);
  }

  &:disabled {
    cursor: not-allowed;
  }
}

.skin-bg-preview {
  position: relative;
  margin-top: 10px;
  width: 100%;
  aspect-ratio: 16 / 7;
  min-height: 120px;
  max-height: 190px;
  overflow: hidden;
  border-radius: 10px;
  border: 1px solid var(--color-border);
  background:
    linear-gradient(135deg, #f2f7ff, #e3efff);

  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center 40%;
  }

  &--empty {
    background: var(--color-bg);
  }
}

.skin-bg-preview__placeholder {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  padding: 12px;
  font-size: 12px;
  color: var(--color-text-muted);
  text-align: center;
}

.skin-bg-preview__badge {
  position: absolute;
  right: 8px;
  bottom: 8px;
  padding: 3px 8px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.58);
  color: #fff;
  font-size: 10px;
  letter-spacing: 0.02em;
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

.skin-bg-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.skin-settings__btn {
  min-height: 34px;
  padding: 0 14px;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-md);
  background: var(--color-card);
  color: var(--color-text-secondary);
  font-size: 12px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;

  &--primary {
    border-color: transparent;
    background: var(--accent);
    color: #fff;
  }

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
}

.skin-bg-file {
  /* 不用 display:none：部分 iOS 版本会拒绝程序化点击隐藏的 file input */
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.skin-sticker-wall {
  display: flex;
  gap: 8px;
  padding-bottom: 6px;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: thin;
}

.skin-sticker {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  width: 68px;
  padding: 4px;
  border: 1px solid transparent;
  border-radius: 10px;
  background: transparent;
  color: var(--color-text-muted);
  font-size: 10px;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, transform 0.15s ease;

  img {
    width: 56px;
    height: 56px;
    object-fit: contain;
    border-radius: 12px;
    background: #fff;
    box-shadow: 0 2px 8px rgba(47, 91, 184, 0.1);
    user-select: none;
  }

  &:hover {
    background: var(--color-hover);
    transform: translateY(-1px);
  }

  &:active {
    transform: scale(0.97);
  }

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }
}

.skin-sticker__caption {
  margin: 6px 0 0;
  min-height: 18px;
  font-size: 12px;
  color: var(--color-text-secondary);

  strong {
    color: var(--accent);
  }
}

:global(body.dark-mode) .skin-theme-card__thumb--default {
  background: linear-gradient(135deg, #1e293b, #243044);
}

:global(body.dark-mode) .skin-theme-card__thumb-bar {
  background: #94a3b8;
}

:global(body.dark-mode) .skin-theme-card__thumb-block {
  background: #334155;
}

:global(body.dark-mode) .skin-sticker img {
  background: #f8fafc;
}

@media (max-width: 480px) {
  .skin-theme-card {
    align-items: flex-start;
  }

  .skin-theme-card__thumb {
    width: 60px;
    height: 46px;
  }

  .skin-theme-card__copy > span:not(.skin-theme-card__badge) {
    -webkit-line-clamp: 2;
  }

  .skin-bg-preview {
    aspect-ratio: 16 / 8;
  }
}
</style>
