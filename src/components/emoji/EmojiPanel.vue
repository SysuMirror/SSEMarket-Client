<script setup lang="ts">
import type { EmojiItem, EmojiPackItem, EmojiSearchData } from '@/api/emoji/emoji'
import { Icon } from '@iconify/vue'
import { computed, ref, useTemplateRef } from 'vue'
import { confirmDialog } from '@/components/ConfirmDialog'
import { showMsg } from '@/components/MessageBox'
import { emojiSrc, useEmoji } from '@/composables/useEmoji'
import { useUserStore } from '@/store/userStore'

/**
 * 微信式表情面板：内置组「小汐（SSE娘）」页签打头，个人表情组「我的表情」默认为空
 * （收自己上传与长按添加的），添加过的表情包组各占一个页签；
 * 搜索能搜到表情和组（组可一键添加）；上传支持「单张进我的表情」和「建组（可分享）」。
 * 点一张表情 → emit pick，由聊天输入区决定是插入还是直接发送。
 */

const emit = defineEmits<{
  (e: 'pick', emoji: EmojiItem): void
}>()

const { userInfo } = useUserStore()
const {
  panel,
  loadEmojiPanel,
  addPackToPanel,
  removePackFromPanel,
  deletePackForever,
  deleteSticker,
  uploadStickers,
  createPack,
  searchEmojiPacks,
} = useEmoji()

type TabKind = 'builtin' | 'personal' | 'pack' | 'search'
const activeTab = ref<TabKind>('builtin')
const activePackID = ref(0)

const managePersonal = ref(false)

const searchKeyword = ref('')
const searchResult = ref<EmojiSearchData | null>(null)
const searching = ref(false)

const showUpload = ref(false)
const uploadMode = ref<'single' | 'pack'>('single')
const uploadTitle = ref('')
const uploadPublic = ref(false)
const uploading = ref(false)
const uploadInput = useTemplateRef<HTMLInputElement>('uploadInput')
const pendingFiles = ref<File[]>([])

void loadEmojiPanel()

const activePack = computed<EmojiPackItem | null>(() =>
  panel.packs.find(pack => pack.packID === activePackID.value) ?? null,
)

const activeStickers = computed<EmojiItem[]>(() => {
  if (activeTab.value === 'builtin')
    return panel.builtinStickers
  if (activeTab.value === 'personal')
    return panel.personalStickers
  if (activeTab.value === 'pack')
    return activePack.value?.stickers ?? []
  return searchResult.value?.stickers ?? []
})

function selectTab(tab: TabKind, packID = 0) {
  activeTab.value = tab
  activePackID.value = packID
  if (tab === 'pack' && activePack.value === null) {
    activeTab.value = 'builtin'
    activePackID.value = 0
  }
}

function pick(emoji: EmojiItem) {
  emit('pick', emoji)
}

async function runSearch() {
  const keyword = searchKeyword.value.trim()
  if (!keyword) {
    searchResult.value = null
    return
  }
  searching.value = true
  try {
    searchResult.value = await searchEmojiPacks(keyword)
    if (!searchResult.value)
      showMsg('搜索失败，请重试', 'error')
  }
  finally {
    searching.value = false
  }
}

async function togglePack(pack: EmojiPackItem) {
  const result = pack.addedByMe
    ? await removePackFromPanel(pack.packID)
    : await addPackToPanel(pack.packID)
  showMsg(result.msg, result.ok ? 'success' : 'error')
}

async function removePackTab(pack: EmojiPackItem) {
  const result = await removePackFromPanel(pack.packID)
  showMsg(result.msg, result.ok ? 'success' : 'error')
  if (result.ok && activeTab.value === 'pack' && activePackID.value === pack.packID)
    selectTab('builtin')
}

async function deletePack(pack: EmojiPackItem) {
  if (!await confirmDialog({ message: `删除表情包组「${pack.title}」？组内表情会一并删除。`, danger: true }))
    return
  const result = await deletePackForever(pack.packID)
  showMsg(result.msg, result.ok ? 'success' : 'error')
  if (result.ok)
    selectTab('builtin')
}

async function destroySticker(emoji: EmojiItem) {
  const result = await deleteSticker(emoji.emojiID)
  showMsg(result.ok ? `已移出「${panel.personalPack?.title || '我的表情'}」` : result.msg, result.ok ? 'success' : 'error')
}

function onFilesChosen(event: Event) {
  const input = event.target as HTMLInputElement
  pendingFiles.value = Array.from(input.files ?? [])
}

async function submitUpload() {
  if (pendingFiles.value.length === 0) {
    showMsg('请先选择表情图片', 'error')
    return
  }
  uploading.value = true
  try {
    const result = uploadMode.value === 'single'
      ? await uploadStickers(pendingFiles.value)
      : await createPack(pendingFiles.value, uploadTitle.value.trim(), uploadPublic.value)
    showMsg(result.msg, result.ok ? 'success' : 'error')
    if (result.ok) {
      pendingFiles.value = []
      if (uploadInput.value)
        uploadInput.value.value = ''
      const createdPack = (result as { pack?: EmojiPackItem | null }).pack
      uploadTitle.value = ''
      uploadPublic.value = false
      showUpload.value = false
      if (uploadMode.value === 'pack' && createdPack?.packID)
        selectTab('pack', createdPack.packID)
      else
        selectTab('personal')
    }
  }
  finally {
    uploading.value = false
  }
}
</script>

<template>
  <div class="emoji-panel">
    <div class="emoji-panel__tabs">
      <button
        type="button"
        class="emoji-panel__tab"
        :class="{ 'emoji-panel__tab--active': activeTab === 'builtin' }"
        :title="panel.builtinPack?.title || '小汐（SSE娘）'"
        @click="selectTab('builtin')"
      >
        {{ panel.builtinPack?.title || '小汐（SSE娘）' }}
      </button>
      <button
        type="button"
        class="emoji-panel__tab"
        :class="{ 'emoji-panel__tab--active': activeTab === 'personal' }"
        :title="panel.personalPack?.title || '我的表情'"
        @click="selectTab('personal')"
      >
        {{ panel.personalPack?.title || '我的表情' }}
      </button>
      <button
        v-for="pack in panel.packs"
        :key="pack.packID"
        type="button"
        class="emoji-panel__tab"
        :class="{ 'emoji-panel__tab--active': activeTab === 'pack' && activePackID === pack.packID }"
        :title="pack.title"
        @click="selectTab('pack', pack.packID)"
      >
        {{ pack.title }}
      </button>
      <span class="emoji-panel__tabs-spacer" />
      <button
        type="button"
        class="emoji-panel__icon-btn"
        :class="{ 'emoji-panel__icon-btn--active': activeTab === 'search' }"
        title="搜索表情 / 表情包组"
        @click="selectTab('search')"
      >
        <Icon icon="tabler:search" width="16" height="16" />
      </button>
      <button
        type="button"
        class="emoji-panel__icon-btn"
        :class="{ 'emoji-panel__icon-btn--active': showUpload }"
        title="上传表情 / 建组"
        @click="showUpload = !showUpload"
      >
        <Icon icon="tabler:upload" width="16" height="16" />
      </button>
    </div>

    <div v-if="showUpload" class="emoji-panel__upload">
      <div class="emoji-panel__upload-modes">
        <button
          type="button"
          class="emoji-panel__tab"
          :class="{ 'emoji-panel__tab--active': uploadMode === 'single' }"
          @click="uploadMode = 'single'"
        >
          单张 → 我的表情
        </button>
        <button
          type="button"
          class="emoji-panel__tab"
          :class="{ 'emoji-panel__tab--active': uploadMode === 'pack' }"
          @click="uploadMode = 'pack'"
        >
          建表情包组
        </button>
      </div>
      <div v-if="uploadMode === 'pack'" class="emoji-panel__upload-pack">
        <input v-model="uploadTitle" class="emoji-panel__input" placeholder="组名称" maxlength="30">
        <label class="emoji-panel__public">
          <input v-model="uploadPublic" type="checkbox">
          分享（别人可搜索并添加）
        </label>
      </div>
      <div class="emoji-panel__upload-actions">
        <input
          ref="uploadInput"
          type="file"
          accept="image/png,image/jpeg,image/gif"
          multiple
          class="emoji-panel__file"
          @change="onFilesChosen"
        >
        <span class="emoji-panel__file-count">
          {{ pendingFiles.length > 0 ? `已选 ${pendingFiles.length} 张` : 'PNG / JPG / GIF，单张 ≤ 2MB' }}
        </span>
        <button type="button" class="emoji-panel__primary" :disabled="uploading" @click="submitUpload">
          {{ uploading ? '上传中…' : '上传' }}
        </button>
      </div>
    </div>

    <div v-if="activeTab === 'search'" class="emoji-panel__search">
      <input
        v-model="searchKeyword"
        class="emoji-panel__input"
        placeholder="搜表情名 / 组名，回车搜索"
        @keydown.enter="runSearch"
      >
      <button type="button" class="emoji-panel__primary" :disabled="searching" @click="runSearch">
        搜索
      </button>
      <template v-if="searchResult">
        <div v-if="searchResult.packs.length" class="emoji-panel__packs">
          <div v-for="pack in searchResult.packs" :key="pack.packID" class="emoji-panel__pack-card">
            <div class="emoji-panel__pack-previews">
              <img
                v-for="sticker in pack.preview"
                :key="sticker.emojiID"
                :src="emojiSrc(sticker)"
                :alt="sticker.name"
              >
            </div>
            <div class="emoji-panel__pack-meta">
              <span class="emoji-panel__pack-title">{{ pack.title }}</span>
              <span class="emoji-panel__pack-count">{{ pack.stickerCount }} 张</span>
              <span v-if="pack.isPublic" class="emoji-panel__pack-share">已分享</span>
            </div>
            <button
              type="button"
              class="emoji-panel__pack-add"
              :class="{ 'emoji-panel__pack-add--added': pack.addedByMe }"
              @click="togglePack(pack)"
            >
              {{ pack.addedByMe ? '移除' : '添加' }}
            </button>
          </div>
        </div>
        <div v-if="searchResult.stickers.length" class="emoji-panel__grid">
          <button
            v-for="sticker in searchResult.stickers"
            :key="sticker.emojiID"
            type="button"
            class="emoji-panel__tile"
            :title="sticker.name"
            @click.stop="pick(sticker)"
          >
            <img :src="emojiSrc(sticker)" :alt="sticker.name" loading="lazy">
          </button>
        </div>
        <p v-if="!searchResult.packs.length && !searchResult.stickers.length" class="emoji-panel__empty">
          没有找到相关表情或表情包组
        </p>
      </template>
    </div>

    <template v-else>
      <div v-if="activeTab === 'pack' && activePack" class="emoji-panel__pack-head">
        <span class="emoji-panel__pack-title">{{ activePack.title }}</span>
        <span class="emoji-panel__pack-count">{{ activePack.stickerCount }} 张</span>
        <span v-if="activePack.isPublic" class="emoji-panel__pack-share">已分享</span>
        <span class="emoji-panel__tabs-spacer" />
        <button type="button" class="emoji-panel__icon-btn" title="从面板移除该组" @click="removePackTab(activePack)">
          <Icon icon="tabler:minus" width="16" height="16" />
        </button>
        <button
          v-if="activePack.ownerUserID === userInfo.userID"
          type="button"
          class="emoji-panel__icon-btn"
          title="删除该组"
          @click="deletePack(activePack)"
        >
          <Icon icon="tabler:trash" width="16" height="16" />
        </button>
      </div>

      <div v-if="activeTab === 'personal'" class="emoji-panel__pack-head">
        <span class="emoji-panel__pack-title">{{ panel.personalPack?.title || '我的表情' }}</span>
        <span class="emoji-panel__pack-count">{{ panel.personalStickers.length }} 张</span>
        <span class="emoji-panel__tabs-spacer" />
        <button
          type="button"
          class="emoji-panel__icon-btn"
          :class="{ 'emoji-panel__icon-btn--active': managePersonal }"
          title="管理"
          @click="managePersonal = !managePersonal"
        >
          <Icon icon="tabler:settings" width="16" height="16" />
        </button>
      </div>

      <div v-if="activeStickers.length" class="emoji-panel__grid">
        <div v-for="sticker in activeStickers" :key="sticker.emojiID" class="emoji-panel__cell">
          <button
            type="button"
            class="emoji-panel__tile"
            :title="sticker.name"
            @click.stop="pick(sticker)"
          >
            <img :src="emojiSrc(sticker)" :alt="sticker.name" loading="lazy">
          </button>
          <button
            v-if="managePersonal && activeTab === 'personal'"
            type="button"
            class="emoji-panel__cell-btn"
            title="移出我的表情"
            @click="destroySticker(sticker)"
          >
            <Icon icon="tabler:x" width="12" height="12" />
          </button>
        </div>
      </div>
      <p v-else class="emoji-panel__empty">
        {{ activeTab === 'personal' ? '还是空的：上传一张，或在聊天里长按表情加入' : '这个组还没有表情' }}
      </p>
    </template>
  </div>
</template>

<style scoped lang="scss">
.emoji-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  background: var(--chat-bg-highlight, #fff);
  border: 1px solid var(--chat-border, #e5e7eb);
  border-radius: 14px;
  max-height: 46vh;
  overflow-y: auto;
}

.emoji-panel__tabs {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.emoji-panel__tabs-spacer {
  flex: 1;
}

.emoji-panel__tab {
  border: 1px solid var(--chat-border, #e5e7eb);
  background: transparent;
  border-radius: 999px;
  padding: 4px 12px;
  font-size: 13px;
  cursor: pointer;
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: inherit;

  &--active {
    background: var(--chat-bubble-self, #e8f1ff);
    border-color: transparent;
  }
}

.emoji-panel__icon-btn {
  border: 1px solid var(--chat-border, #e5e7eb);
  background: transparent;
  border-radius: 8px;
  padding: 4px 6px;
  cursor: pointer;
  display: inline-flex;
  color: inherit;

  &--active {
    background: var(--chat-bubble-self, #e8f1ff);
    border-color: transparent;
  }
}

.emoji-panel__upload,
.emoji-panel__search {
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-top: 1px dashed var(--chat-border, #e5e7eb);
  padding-top: 8px;
}

.emoji-panel__upload-modes {
  display: flex;
  gap: 6px;
}

.emoji-panel__upload-pack {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.emoji-panel__upload-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.emoji-panel__input {
  flex: 1;
  min-width: 140px;
  border: 1px solid var(--chat-border, #e5e7eb);
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 13px;
  background: transparent;
  color: inherit;
}

.emoji-panel__public {
  font-size: 13px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.emoji-panel__file-count {
  font-size: 12px;
  opacity: 0.75;
}

.emoji-panel__primary {
  border: none;
  background: var(--chat-bubble-self, #2f6fed);
  color: #fff;
  border-radius: 8px;
  padding: 6px 14px;
  font-size: 13px;
  cursor: pointer;

  &:disabled {
    opacity: 0.6;
    cursor: default;
  }
}

.emoji-panel__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(64px, 1fr));
  gap: 6px;
}

.emoji-panel__cell {
  position: relative;
}

.emoji-panel__tile {
  width: 100%;
  aspect-ratio: 1;
  border: 1px solid transparent;
  border-radius: 10px;
  background: transparent;
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: var(--chat-bubble-peer, rgba(15, 23, 42, 0.05));
  }

  img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }
}

.emoji-panel__cell-btn {
  position: absolute;
  top: 2px;
  right: 2px;
  border: none;
  border-radius: 50%;
  width: 18px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(15, 23, 42, 0.55);
  color: #fff;
  cursor: pointer;
  padding: 0;
}

.emoji-panel__pack-head {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.emoji-panel__packs {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.emoji-panel__pack-card {
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1px solid var(--chat-border, #e5e7eb);
  border-radius: 12px;
  padding: 8px 10px;
}

.emoji-panel__pack-previews {
  display: flex;
  gap: 4px;

  img {
    width: 40px;
    height: 40px;
    object-fit: contain;
    border-radius: 6px;
    background: rgba(15, 23, 42, 0.04);
  }
}

.emoji-panel__pack-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.emoji-panel__pack-title {
  font-size: 14px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.emoji-panel__pack-count,
.emoji-panel__pack-share {
  font-size: 12px;
  opacity: 0.7;
}

.emoji-panel__pack-share {
  opacity: 1;
  color: #16a34a;
}

.emoji-panel__pack-add {
  border: 1px solid var(--chat-border, #e5e7eb);
  background: transparent;
  border-radius: 8px;
  padding: 5px 12px;
  font-size: 13px;
  cursor: pointer;
  color: inherit;

  &--added {
    opacity: 0.7;
  }
}

.emoji-panel__empty {
  font-size: 13px;
  opacity: 0.65;
  padding: 12px 4px;
}
</style>
