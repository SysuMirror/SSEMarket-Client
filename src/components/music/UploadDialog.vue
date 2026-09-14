<script setup lang="ts">
import type { MusicSummary } from '@/api/music/uploadMusic'
import { Icon } from '@iconify/vue'
import { computed, ref, watch } from 'vue'
import { publishMusic } from '@/api/music/controlMusic'
import { readAudioDuration, uploadMusic } from '@/api/music/uploadMusic'
import defaultCover from '@/assets/music-default-cover.svg'
import { showMsg } from '@/components/MessageBox'

const emit = defineEmits<{
  published: [music: MusicSummary]
}>()

const visible = defineModel<boolean>({ default: false })

type Stage = 'pick' | 'uploading' | 'confirm'

const stage = ref<Stage>('pick')
const percent = ref(0)
const fileName = ref('')
const uploadingName = ref('')
const music = ref<MusicSummary | null>(null)

// 确认阶段的可编辑字段
const title = ref('')
const artist = ref('')
const album = ref('')
const coverFile = ref<File | null>(null)
const coverPreviewURL = ref('') // 自选封面本地即时预览
const publishing = ref(false)

const sizeText = computed(() => {
  if (!music.value)
    return ''
  const bytes = music.value.sizeBytes
  return bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)}MB` : `${Math.max(1, Math.round(bytes / 1024))}KB`
})

const realCoverSrc = computed(() => {
  if (coverPreviewURL.value)
    return coverPreviewURL.value
  if (music.value?.hasCover)
    return `${import.meta.env.VITE_API_BASE_URL}/music/cover/${music.value.musicID}`
  return defaultCover
})

const audioInput = ref<HTMLInputElement | null>(null)
const coverInput = ref<HTMLInputElement | null>(null)

// 每次打开重置状态（放弃的草稿由服务端 24h 定时清理）
watch(visible, (open) => {
  if (open) {
    stage.value = 'pick'
    percent.value = 0
    fileName.value = ''
    uploadingName.value = ''
    music.value = null
    coverFile.value = null
    coverPreviewURL.value = ''
  }
})

function pickAudio() {
  audioInput.value?.click()
}

async function onAudioChosen(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file)
    return
  const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
  if (!['.mp3', '.flac', '.ogg', '.wav', '.m4a'].includes(ext)) {
    showMsg('仅支持 mp3/flac/ogg/wav/m4a 格式')
    input.value = ''
    return
  }
  if (file.size > 60 * 1024 * 1024) {
    showMsg('文件太大，不能超过60MB')
    input.value = ''
    return
  }
  await startUpload(file)
}

async function onDrop(e: DragEvent) {
  const file = e.dataTransfer?.files?.[0]
  if (!file)
    return
  if (!/\.(?:mp3|flac|ogg|wav|m4a)$/i.test(file.name)) {
    showMsg('仅支持 mp3/flac/ogg/wav/m4a 格式')
    return
  }
  await startUpload(file)
}

async function startUpload(file: File) {
  fileName.value = file.name
  uploadingName.value = file.name
  stage.value = 'uploading'
  percent.value = 0
  try {
    const duration = await readAudioDuration(file)
    const result = await uploadMusic(file, duration, (pct) => {
      percent.value = pct
    })
    music.value = result
    title.value = result.title
    artist.value = result.artist
    album.value = result.album
    stage.value = 'confirm'
  }
  catch (err) {
    showMsg(String(err))
    stage.value = 'pick'
  }
}

function chooseCover() {
  coverInput.value?.click()
}

function onCoverChosen(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file)
    return
  if (!/^image\/(?:jpeg|png|webp)$/.test(file.type)) {
    showMsg('封面仅支持 jpg/png/webp 格式')
    input.value = ''
    return
  }
  if (file.size > 10 * 1024 * 1024) {
    showMsg('封面图片太大，不能超过10MB')
    input.value = ''
    return
  }
  coverFile.value = file
  coverPreviewURL.value = URL.createObjectURL(file)
}

async function doPublish() {
  if (!music.value || publishing.value)
    return
  publishing.value = true
  try {
    const published = await publishMusic({
      musicID: music.value.musicID,
      title: title.value.trim() || undefined,
      artist: artist.value.trim() || undefined,
      album: album.value.trim() || undefined,
      cover: coverFile.value,
    })
    showMsg('发布成功')
    emit('published', published)
    visible.value = false
  }
  catch (err) {
    showMsg(String(err))
  }
  finally {
    publishing.value = false
  }
}

// 关闭（放弃的草稿由服务端 24h 定时清理，这里不删）
function onClose() {
  visible.value = false
}
</script>

<template>
  <Teleport to="body">
    <Transition name="dialog" :duration="280">
      <div
        v-if="visible"
        class="dialog-mask"
        @click.self="onClose"
      >
        <div class="dialog">
          <div class="dialog-head">
            <span>上传音乐</span>
            <button
              type="button"
              class="close-btn"
              @click="onClose"
            >
              <Icon icon="tabler:x" />
            </button>
          </div>

          <!-- 第一步：选择文件 -->
          <div
            v-if="stage === 'pick'"
            class="dropzone"
            tabindex="0"
            @click="pickAudio"
            @keydown.enter="pickAudio"
            @dragover.prevent
            @drop.prevent="onDrop"
          >
            <Icon icon="tabler:cloud-upload" class="dz-icon" />
            <div class="dz-text">
              点击选择或拖拽音频文件到这里
            </div>
            <div class="dz-hint">
              支持 mp3 / flac / ogg / wav / m4a，单个文件不超过 60MB
            </div>
          </div>

          <!-- 第一步半：上传中 -->
          <div
            v-else-if="stage === 'uploading'"
            class="uploading"
          >
            <Icon icon="tabler:disc" class="up-icon" />
            <div class="up-name">
              {{ uploadingName }}
            </div>
            <div class="up-bar">
              <div
                class="up-fill"
                :style="{ width: `${percent}%` }"
              />
            </div>
            <div class="up-pct">
              {{ percent }}%
            </div>
          </div>

          <!-- 第二步：确认信息并发布 -->
          <div
            v-else-if="music"
            class="confirm"
          >
            <div class="confirm-layout">
              <div class="cover-side">
                <img
                  class="cover-preview"
                  :src="realCoverSrc"
                  alt="封面预览"
                >
                <button
                  type="button"
                  class="cover-btn"
                  @click="chooseCover"
                >
                  <Icon icon="tabler:photo-edit" />
                  {{ music.hasCover || coverFile ? '更换封面' : '上传封面' }}
                </button>
                <div class="cover-hint">
                  {{ music.hasCover || coverFile ? '已使用内嵌/自选封面，可更换' : '该音频没有内嵌封面，可上传一张' }}
                </div>
              </div>

              <div class="form-side">
                <label class="field">
                  <span>标题</span>
                  <input
                    v-model="title"
                    type="text"
                    maxlength="100"
                    placeholder="歌曲标题"
                  >
                </label>
                <label class="field">
                  <span>歌手</span>
                  <input
                    v-model="artist"
                    type="text"
                    maxlength="100"
                    placeholder="歌手（可留空）"
                  >
                </label>
                <label class="field">
                  <span>专辑</span>
                  <input
                    v-model="album"
                    type="text"
                    maxlength="100"
                    placeholder="专辑（可留空）"
                  >
                </label>
                <div class="file-meta">
                  {{ fileName }} · {{ music.format.toUpperCase() }} · {{ sizeText }}
                </div>
              </div>
            </div>

            <div class="actions">
              <button
                type="button"
                class="btn ghost"
                @click="onClose"
              >
                取消
              </button>
              <button
                type="button"
                class="btn primary"
                :disabled="publishing"
                @click="doPublish"
              >
                {{ publishing ? '发布中…' : '发布' }}
              </button>
            </div>
          </div>

          <input
            ref="audioInput"
            type="file"
            accept=".mp3,.flac,.ogg,.wav,.m4a,audio/*"
            hidden
            @change="onAudioChosen"
          >
          <input
            ref="coverInput"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            @change="onCoverChosen"
          >
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style lang="scss" scoped>
$accent: #ec4141;

.dialog-mask {
  position: fixed;
  inset: 0;
  z-index: 3200;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.dialog {
  width: min(560px, 100%);
  max-height: 88vh;
  overflow-y: auto;
  background: var(--color-bg);
  border-radius: 14px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35);
}

.dialog-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text);
  border-bottom: 1px solid var(--color-border);

  .close-btn {
    border: none;
    background: none;
    font-size: 20px;
    color: var(--color-text);
    opacity: 0.6;
    cursor: pointer;

    &:hover {
      opacity: 1;
    }
  }
}

/* 选择文件 */
.dropzone {
  margin: 24px 20px;
  padding: 44px 20px;
  border: 2px dashed var(--color-border);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  transition:
    border-color 0.2s,
    background 0.2s;

  &:hover,
  &:focus {
    border-color: $accent;
    background: rgba(236, 65, 65, 0.05);
    outline: none;
  }

  .dz-icon {
    font-size: 52px;
    color: $accent;
  }

  .dz-text {
    font-size: 15px;
    color: var(--color-text);
  }

  .dz-hint {
    font-size: 12px;
    color: var(--color-text);
    opacity: 0.55;
  }
}

/* 上传中 */
.uploading {
  padding: 36px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;

  .up-icon {
    font-size: 48px;
    color: $accent;
  }

  .up-name {
    font-size: 14px;
    color: var(--color-text);
    max-width: 100%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .up-bar {
    width: 100%;
    height: 6px;
    border-radius: 3px;
    background: var(--color-border);
    overflow: hidden;

    .up-fill {
      height: 100%;
      background: $accent;
      border-radius: 3px;
      transition: width 0.2s;
    }
  }

  .up-pct {
    font-size: 12px;
    color: var(--color-text);
    opacity: 0.6;
  }
}

/* 确认发布 */
.confirm {
  padding: 20px;
}

.confirm-layout {
  display: flex;
  gap: 24px;
}

.cover-side {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;

  .cover-preview {
    width: 180px;
    height: 180px;
    border-radius: 10px;
    object-fit: cover;
    box-shadow: 0 6px 24px rgba(0, 0, 0, 0.25);
  }

  .cover-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 14px;
    font-size: 13px;
    border: 1px solid $accent;
    border-radius: 16px;
    background: none;
    color: $accent;
    cursor: pointer;

    &:hover {
      background: rgba(236, 65, 65, 0.08);
    }
  }

  .cover-hint {
    font-size: 11px;
    color: var(--color-text);
    opacity: 0.5;
    max-width: 180px;
    text-align: center;
  }
}

.form-side {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;

  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;

    span {
      font-size: 12px;
      color: var(--color-text);
      opacity: 0.65;
    }

    input {
      height: 38px;
      padding: 0 12px;
      font-size: 14px;
      color: var(--color-text);
      background: var(--color-bg);
      border: 1px solid var(--color-border);
      border-radius: 8px;
      outline: none;

      &:focus {
        border-color: $accent;
      }
    }
  }

  .file-meta {
    font-size: 12px;
    color: var(--color-text);
    opacity: 0.5;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 22px;

  .btn {
    padding: 9px 26px;
    font-size: 14px;
    border-radius: 18px;
    cursor: pointer;
    border: none;

    &.ghost {
      background: none;
      border: 1px solid var(--color-border);
      color: var(--color-text);

      &:hover {
        border-color: var(--color-text);
      }
    }

    &.primary {
      background: $accent;
      color: #fff;

      &:hover {
        background: lighten($accent, 6%);
      }

      &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
    }
  }
}

@media screen and (max-width: 600px) {
  .confirm-layout {
    flex-direction: column;
    align-items: center;
  }
}

.dialog-enter-active,
.dialog-leave-active {
  transition: opacity 0.2s ease;
}

.dialog-enter-active .dialog,
.dialog-leave-active .dialog {
  transition: transform 0.2s ease;
}

.dialog-enter-from,
.dialog-leave-to {
  opacity: 0;

  .dialog {
    transform: translateY(12px) scale(0.98);
  }
}
</style>
