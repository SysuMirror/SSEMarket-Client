<script setup lang="ts">
import type { MusicSummary } from '@/api/music/uploadMusic'

import { Icon } from '@iconify/vue'
import { ref, watch } from 'vue'
import { publishMusic } from '@/api/music/controlMusic'
import { getMusicList } from '@/api/music/getMusicList'
import { readAudioDuration, uploadMusic } from '@/api/music/uploadMusic'
import { showMsg } from '@/components/MessageBox'
import { formatDuration, musicCoverOrDefault } from '@/store/musicStore'

const emit = defineEmits<{
  insert: [musicID: number]
}>()

/**
 * 发帖页「插入音乐」选歌弹窗：
 * 上半部分列出我上传过的歌（点选插入），下半部分直接上传新歌（上传即发布并插入）。
 * 插入结果通过 insert 事件抛给父组件，父组件负责在编辑器光标处写 ::music id:: 标记。
 */

const visible = defineModel<boolean>({ default: false })

const MINE_PAGE_SIZE = 50
const loading = ref(false)
const mine = ref<MusicSummary[]>([])
const uploading = ref(false)
const uploadPct = ref(0)

const fileInput = ref<HTMLInputElement | null>(null)

async function loadMine() {
  loading.value = true
  try {
    mine.value = await getMusicList({ mine: true, limit: MINE_PAGE_SIZE })
  }
  catch (e) {
    console.error(e)
    showMsg('我的音乐列表获取失败')
  }
  finally {
    loading.value = false
  }
}

watch(visible, (v) => {
  if (v)
    loadMine()
})

function pick(m: MusicSummary) {
  emit('insert', m.musicID)
  visible.value = false
}

function openFilePicker() {
  if (!uploading.value)
    fileInput.value?.click()
}

async function onFileChosen(event: Event) {
  const el = event.target as HTMLInputElement
  const file = el.files?.[0]
  el.value = ''
  if (!file || uploading.value)
    return
  uploading.value = true
  uploadPct.value = 0
  try {
    // 一段式直发：解析出的元数据即最终信息，适合发帖场景的快速插图
    const duration = await readAudioDuration(file)
    const draft = await uploadMusic(file, duration, pct => (uploadPct.value = pct))
    const published = await publishMusic({ musicID: draft.musicID })
    emit('insert', published.musicID)
    visible.value = false
  }
  catch (e) {
    console.error(e)
    showMsg(e instanceof Error ? e.message : '上传失败，请重试')
  }
  finally {
    uploading.value = false
  }
}
</script>

<template>
  <Transition name="mpicker" :duration="300">
    <div v-if="visible" class="mpicker-mask" @click.self="visible = false">
      <div class="mpicker">
        <header class="mpicker__head">
          <Icon icon="tabler:disc" width="18" height="18" aria-hidden="true" />
          <span>插入音乐</span>
          <button type="button" class="mpicker__close" aria-label="关闭" @click="visible = false">
            <Icon icon="tabler:x" width="18" height="18" aria-hidden="true" />
          </button>
        </header>

        <div class="mpicker__body">
          <div class="mpicker__section-title">
            我的音乐
          </div>
          <div v-if="loading" class="mpicker__hint">
            加载中…
          </div>
          <div v-else-if="mine.length === 0" class="mpicker__hint">
            还没有上传过音乐，从下面直接上传吧
          </div>
          <ul v-else class="mpicker__list">
            <li v-for="m in mine" :key="m.musicID">
              <button type="button" class="mpicker__row" @click="pick(m)">
                <img class="mpicker__cover" :src="musicCoverOrDefault(m)" alt="" loading="lazy">
                <span class="mpicker__meta">
                  <span class="mpicker__title">{{ m.title }}</span>
                  <span class="mpicker__artist">{{ m.artist || '未知歌手' }} · {{ formatDuration(m.durationSec) }}</span>
                </span>
                <span class="mpicker__insert">插入</span>
              </button>
            </li>
          </ul>
        </div>

        <footer class="mpicker__foot">
          <input ref="fileInput" type="file" accept=".mp3,.flac,audio/mpeg,audio/flac" hidden @change="onFileChosen">
          <button
            type="button"
            class="mpicker__upload"
            :disabled="uploading"
            @click="openFilePicker"
          >
            <Icon icon="tabler:cloud-upload" width="16" height="16" aria-hidden="true" />
            {{ uploading ? `上传中 ${uploadPct}%` : '上传新歌并插入' }}
          </button>
        </footer>
      </div>
    </div>
  </Transition>
</template>

<style scoped lang="scss">
$accent: #ec4141;

.mpicker-mask {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(15, 23, 42, 0.45);
}

.mpicker {
  display: flex;
  flex-direction: column;
  width: min(420px, calc(100vw - 32px));
  max-height: min(560px, calc(100vh - 48px));
  background: var(--color-card, #fff);
  border-radius: 14px;
  box-shadow: 0 18px 50px rgba(2, 6, 23, 0.25);
  overflow: hidden;
}

.mpicker__head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 16px;
  font-size: 15px;
  font-weight: 600;
  color: $accent;
  border-bottom: 1px solid rgba(148, 163, 184, 0.25);
}

.mpicker__close {
  margin-left: auto;
  display: inline-flex;
  padding: 4px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #64748b;
  cursor: pointer;

  &:hover {
    background: rgba(148, 163, 184, 0.18);
  }
}

.mpicker__body {
  flex: 1;
  min-height: 120px;
  overflow-y: auto;
  padding: 10px 12px;
}

.mpicker__section-title {
  padding: 2px 6px 8px;
  font-size: 12px;
  color: #94a3b8;
}

.mpicker__hint {
  padding: 28px 12px;
  text-align: center;
  font-size: 13px;
  color: #94a3b8;
}

.mpicker__list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.mpicker__row {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px;
  border: none;
  border-radius: 10px;
  background: transparent;
  cursor: pointer;
  text-align: left;

  &:hover {
    background: rgba(236, 65, 65, 0.07);

    .mpicker__insert {
      opacity: 1;
    }
  }
}

.mpicker__cover {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  object-fit: cover;
  flex-shrink: 0;
}

.mpicker__meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.mpicker__title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text, #1f2328);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mpicker__artist {
  font-size: 12px;
  color: #94a3b8;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mpicker__insert {
  font-size: 12px;
  font-weight: 600;
  color: $accent;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.mpicker__foot {
  padding: 12px 14px;
  border-top: 1px solid rgba(148, 163, 184, 0.25);
}

.mpicker__upload {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  padding: 9px 12px;
  border: none;
  border-radius: 10px;
  background: $accent;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s ease;

  &:hover:not(:disabled) {
    opacity: 0.9;
  }

  &:disabled {
    cursor: default;
    opacity: 0.75;
  }
}

.mpicker-enter-active,
.mpicker-leave-active {
  transition: opacity 0.22s ease;
}

.mpicker-enter-active .mpicker,
.mpicker-leave-active .mpicker {
  transition: transform 0.22s ease;
}

.mpicker-enter-from,
.mpicker-leave-to {
  opacity: 0;

  .mpicker {
    transform: translateY(12px) scale(0.98);
  }
}
</style>
