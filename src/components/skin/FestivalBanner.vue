<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useSkin } from '@/composables/useSkin'
import { skinStickerURL } from '@/skins'

/**
 * 首页节日横幅：皮肤生效时出现在主页顶部，可关闭（按会话记忆）。
 * 这是进入网站后最直观的节日装饰；贴纸用角色表情，文字与图片各自占位，
 * 手机端不会互相遮挡。
 */
const { activeSkin } = useSkin()

const dismissed = ref(false)
const DISMISS_PREFIX = 'sse-theme-banner-dismissed:'

const sticker = computed(() => activeSkin.value?.stickers[11] ?? activeSkin.value?.stickers[0] ?? null)
const stickerURL = computed(() => (activeSkin.value && sticker.value)
  ? skinStickerURL(activeSkin.value.id, sticker.value.file)
  : '')

function dismissKey(skinID: string): string {
  return `${DISMISS_PREFIX}${skinID}`
}

function readDismissed(skinID: string): boolean {
  try {
    return sessionStorage.getItem(dismissKey(skinID)) === '1'
  }
  catch {
    return false
  }
}

watch(
  () => activeSkin.value?.id,
  (skinID) => {
    dismissed.value = skinID ? readDismissed(skinID) : false
  },
  { immediate: true },
)

function dismiss() {
  dismissed.value = true
  const skinID = activeSkin.value?.id
  if (!skinID)
    return
  try {
    sessionStorage.setItem(dismissKey(skinID), '1')
  }
  catch {
    // 忽略存储异常，本页仍会保持关闭
  }
}
</script>

<template>
  <aside
    v-if="activeSkin && !dismissed"
    class="festival-banner"
    role="complementary"
    :aria-label="`${activeSkin.name}节日横幅`"
  >
    <span class="festival-banner__code" aria-hidden="true">&lt;/&gt;</span>
    <div class="festival-banner__copy">
      <span class="festival-banner__eyebrow">10.24 · 程序员节</span>
      <strong class="festival-banner__title">{{ activeSkin.description }}</strong>
      <div class="festival-banner__actions">
        <RouterLink class="festival-banner__link" to="/options">
          皮肤设置
          <span aria-hidden="true">→</span>
        </RouterLink>
        <span class="festival-banner__hint">节日限定皮肤已上线</span>
      </div>
    </div>
    <img
      v-if="sticker && stickerURL"
      class="festival-banner__mascot"
      :src="stickerURL"
      :alt="sticker.label"
      loading="lazy"
      decoding="async"
      draggable="false"
    >
    <button
      type="button"
      class="festival-banner__close"
      aria-label="关闭节日横幅"
      title="关闭"
      @click="dismiss"
    >
      ×
    </button>
  </aside>
</template>

<style scoped lang="scss">
.festival-banner {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0 12px 8px;
  padding: 12px 46px 12px 16px;
  overflow: hidden;
  border: 1px solid rgba(61, 111, 214, 0.18);
  border-radius: 14px;
  background:
    radial-gradient(120% 160% at 100% 0%, rgba(255, 255, 255, 0.9) 0%, rgba(255, 255, 255, 0) 55%),
    linear-gradient(120deg, #f4f9ff 0%, #e4f0ff 52%, #d8e9ff 100%);
  box-shadow: 0 6px 20px rgba(47, 91, 184, 0.08);
  color: #1e335c;
  isolation: isolate;
}

.festival-banner__code {
  position: absolute;
  right: 92px;
  bottom: -16px;
  z-index: -1;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 76px;
  font-weight: 700;
  line-height: 1;
  color: rgba(61, 111, 214, 0.08);
  pointer-events: none;
  user-select: none;
}

.festival-banner__copy {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  flex: 1;
}

.festival-banner__eyebrow {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: #3d6fd6;
  text-transform: uppercase;
}

.festival-banner__title {
  font-size: 14px;
  font-weight: 650;
  line-height: 1.45;
  color: #1e335c;
  overflow-wrap: anywhere;
}

.festival-banner__actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 10px;
  margin-top: 1px;
}

.festival-banner__link {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 12px;
  font-weight: 600;
  color: #2f5bb8;
  white-space: nowrap;

  &:hover {
    color: #1f479a;
  }
}

.festival-banner__hint {
  font-size: 11px;
  color: #6b84ad;
  line-height: 1.4;
}

.festival-banner__mascot {
  flex: 0 0 auto;
  width: 72px;
  height: 72px;
  /* contain：不裁切、不拉伸；白底贴纸图与卡片背景自然融合 */
  object-fit: contain;
  border-radius: 14px;
  filter: drop-shadow(0 4px 10px rgba(47, 91, 184, 0.18));
  transform: rotate(2deg);
  user-select: none;
}

.festival-banner__close {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: #6b84ad;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;

  &:hover {
    background: rgba(61, 111, 214, 0.1);
    color: #2f5bb8;
  }

  &:focus-visible {
    outline: 2px solid #3d6fd6;
    outline-offset: 1px;
  }
}

@media (min-width: 769px) {
  .festival-banner {
    margin: 0 0 10px;
    padding: 14px 52px 14px 20px;
  }

  .festival-banner__title {
    font-size: 15px;
  }

  .festival-banner__mascot {
    width: 86px;
    height: 86px;
  }

  .festival-banner__code {
    right: 120px;
    font-size: 96px;
  }
}

@media (max-width: 380px) {
  .festival-banner {
    gap: 8px;
    padding-left: 13px;
    padding-right: 38px;
  }

  .festival-banner__mascot {
    width: 58px;
    height: 58px;
  }

  .festival-banner__hint {
    display: none;
  }
}

:global(body.dark-mode) .festival-banner {
  border-color: rgba(122, 167, 255, 0.24);
  background:
    radial-gradient(120% 160% at 100% 0%, rgba(86, 126, 196, 0.24) 0%, rgba(86, 126, 196, 0) 55%),
    linear-gradient(120deg, #1c2d4a 0%, #1a3557 52%, #18395f 100%);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.28);
  color: #dce8ff;
}

:global(body.dark-mode) .festival-banner__title {
  color: #e8f0ff;
}

:global(body.dark-mode) .festival-banner__eyebrow,
:global(body.dark-mode) .festival-banner__link {
  color: #9cbcff;
}

:global(body.dark-mode) .festival-banner__hint,
:global(body.dark-mode) .festival-banner__close {
  color: #8fa8cc;
}

:global(body.dark-mode) .festival-banner__code {
  color: rgba(156, 188, 255, 0.08);
}
</style>
