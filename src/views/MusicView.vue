<script setup lang="ts">
import type { MusicSummary } from '@/api/music/uploadMusic'
import { Icon } from '@iconify/vue'
import { computed, onMounted, ref } from 'vue'
import { deleteMusic } from '@/api/music/controlMusic'
import { getMusicList } from '@/api/music/getMusicList'
import { confirmDialog } from '@/components/ConfirmDialog'
import { showMsg } from '@/components/MessageBox'
import UploadDialog from '@/components/music/UploadDialog.vue'
import { formatDuration, musicCoverOrDefault, useMusicStore } from '@/store/musicStore'

const PAGE_SIZE = 20

const { current, isPlaying, playMusic, playAll, togglePlay } = useMusicStore()

const isLoading = ref(true)
const songs = ref<MusicSummary[]>([])
const searchInput = ref('')
const searchKeyword = ref('')
const page = ref(0)
const hasMore = ref(false)
const uploadVisible = ref(false)

const isCurrent = (music: MusicSummary) => current.value?.musicID === music.musicID

async function fetchSongs() {
  isLoading.value = true
  try {
    const list = await getMusicList({
      search: searchKeyword.value,
      limit: PAGE_SIZE,
      offset: page.value * PAGE_SIZE,
    })
    songs.value = list
    hasMore.value = list.length === PAGE_SIZE
  }
  catch (err) {
    showMsg(String(err))
  }
  finally {
    isLoading.value = false
  }
}

function search() {
  searchKeyword.value = searchInput.value.trim()
  page.value = 0
  fetchSongs()
}

function prevPage() {
  if (page.value <= 0)
    return
  page.value -= 1
  fetchSongs()
}

function nextPage() {
  if (!hasMore.value)
    return
  page.value += 1
  fetchSongs()
}

function playSong(music: MusicSummary) {
  if (isCurrent(music))
    togglePlay()
  else
    playMusic(music)
}

function playEverything() {
  if (songs.value.length === 0)
    return
  playAll(songs.value, 0)
}

async function removeSong(music: MusicSummary) {
  if (!await confirmDialog({ message: `确定删除「${music.title}」吗？`, confirmText: '删除', danger: true }))
    return
  try {
    await deleteMusic(music.musicID)
    showMsg('删除成功')
    await fetchSongs()
  }
  catch (err) {
    showMsg(String(err))
  }
}

function onPublished(music: MusicSummary) {
  page.value = 0
  searchKeyword.value = ''
  searchInput.value = ''
  fetchSongs()
  playMusic(music)
}

onMounted(fetchSongs)

const emptyHint = computed(() =>
  searchKeyword.value ? '没有找到相关音乐' : '还没有音乐，来上传第一首吧',
)
</script>

<template>
  <div class="music-view">
    <div class="page-head">
      <h1 class="page-title">
        <Icon icon="tabler:disc" />
        音乐
      </h1>
      <div class="head-actions">
        <form
          class="search"
          @submit.prevent="search"
        >
          <input
            v-model="searchInput"
            type="text"
            placeholder="搜索歌曲 / 歌手 / 专辑"
          >
          <button type="submit">
            <Icon icon="tabler:search" />
          </button>
        </form>
        <button
          type="button"
          class="btn play-all"
          :disabled="songs.length === 0"
          @click="playEverything"
        >
          <Icon icon="tabler:player-play-filled" />
          播放全部
        </button>
        <button
          type="button"
          class="btn upload"
          @click="uploadVisible = true"
        >
          <Icon icon="tabler:cloud-upload" />
          上传音乐
        </button>
      </div>
    </div>

    <div
      v-if="isLoading"
      class="loading"
    >
      加载中…
    </div>

    <template v-else>
      <div
        v-if="songs.length === 0"
        class="empty"
      >
        <Icon icon="tabler:music" class="empty-icon" />
        <div>{{ emptyHint }}</div>
      </div>

      <div
        v-else
        class="song-list"
      >
        <div
          v-for="(music, index) in songs"
          :key="music.musicID"
          class="song-row"
          :class="{ current: isCurrent(music) }"
          @click="playSong(music)"
        >
          <div class="index">
            <span
              v-if="!isCurrent(music)"
              class="num"
            >{{ page * PAGE_SIZE + index + 1 }}</span>
            <div
              v-else
              class="equalizer"
              :class="{ paused: !isPlaying }"
            >
              <span /><span /><span />
            </div>
          </div>

          <img
            class="cover"
            :src="musicCoverOrDefault(music)"
            alt="封面"
            loading="lazy"
            @error="music.hasCover = false"
          >

          <div class="info">
            <div class="title">
              {{ music.title }}
            </div>
            <div class="artist">
              {{ music.artist || '未知歌手' }}<template v-if="music.album">
                · {{ music.album }}
              </template>
            </div>
          </div>

          <div class="duration">
            {{ formatDuration(music.durationSec) }}
          </div>
          <div class="plays">
            <Icon icon="tabler:player-play-filled" />
            {{ music.playCount }}
          </div>
          <div class="uploader">
            {{ music.uploaderName || `用户${music.uploaderID}` }}
          </div>

          <button
            v-if="music.isOwner"
            type="button"
            class="delete"
            title="删除"
            @click.stop="removeSong(music)"
          >
            <Icon icon="tabler:trash" />
          </button>
          <span
            v-else
            class="delete-placeholder"
          />
        </div>
      </div>

      <div
        v-if="songs.length > 0"
        class="pagination"
      >
        <button
          type="button"
          class="btn page-btn"
          :disabled="page === 0"
          @click="prevPage"
        >
          <Icon icon="tabler:chevron-left" />
          上一页
        </button>
        <span class="page-info">第 {{ page + 1 }} 页</span>
        <button
          type="button"
          class="btn page-btn"
          :disabled="!hasMore"
          @click="nextPage"
        >
          下一页
          <Icon icon="tabler:chevron-right" />
        </button>
      </div>
    </template>

    <UploadDialog v-model="uploadVisible" @published="onPublished" />
  </div>
</template>

<style lang="scss" scoped>
$accent: #ec4141;

.music-view {
  width: 100%;
  max-width: 960px;
  margin: 0 auto;
  padding: 16px 12px 32px;
}

.page-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 18px;

  .page-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 24px;
    font-weight: 700;
    color: var(--color-text);
    margin: 0;

    .iconify {
      color: $accent;
    }
  }
}

.head-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.search {
  display: flex;
  align-items: center;

  input {
    width: 200px;
    height: 36px;
    padding: 0 12px;
    font-size: 13px;
    color: var(--color-text);
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: 18px 0 0 18px;
    outline: none;

    &:focus {
      border-color: $accent;
    }
  }

  button {
    width: 40px;
    height: 36px;
    border: 1px solid var(--color-border);
    border-left: none;
    border-radius: 0 18px 18px 0;
    background: var(--color-nav-bg);
    color: var(--color-text);
    cursor: pointer;
    font-size: 17px;

    &:hover {
      color: $accent;
    }
  }
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  font-size: 13px;
  border-radius: 18px;
  border: none;
  cursor: pointer;

  &.play-all {
    background: var(--color-nav-bg);
    color: var(--color-text);
    border: 1px solid var(--color-border);

    &:hover:not(:disabled) {
      color: $accent;
      border-color: $accent;
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  &.upload {
    background: $accent;
    color: #fff;

    &:hover {
      background: lighten($accent, 6%);
    }
  }

  &.page-btn {
    background: var(--color-nav-bg);
    color: var(--color-text);
    border: 1px solid var(--color-border);

    &:hover:not(:disabled) {
      color: $accent;
      border-color: $accent;
    }

    &:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }
  }
}

.loading,
.empty {
  padding: 64px 0;
  text-align: center;
  color: var(--color-text);
  opacity: 0.6;

  .empty-icon {
    font-size: 56px;
    opacity: 0.4;
  }
}

.song-list {
  display: flex;
  flex-direction: column;
  border-radius: 12px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  overflow: hidden;
}

.song-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 16px;
  cursor: pointer;
  border-bottom: 1px solid var(--color-border);
  transition: background 0.15s;

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: var(--color-nav-hover);

    .delete {
      opacity: 0.55;
    }
  }

  &.current .info .title {
    color: $accent;
  }

  .index {
    width: 26px;
    text-align: center;
    flex-shrink: 0;

    .num {
      font-size: 13px;
      color: var(--color-text);
      opacity: 0.5;
      font-variant-numeric: tabular-nums;
    }
  }

  .cover {
    width: 52px;
    height: 52px;
    border-radius: 8px;
    object-fit: cover;
    flex-shrink: 0;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
  }

  .info {
    flex: 1;
    min-width: 0;

    .title {
      font-size: 15px;
      font-weight: 600;
      color: var(--color-text);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .artist {
      font-size: 12px;
      color: var(--color-text);
      opacity: 0.55;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-top: 3px;
    }
  }

  .duration,
  .plays,
  .uploader {
    font-size: 12px;
    color: var(--color-text);
    opacity: 0.6;
    flex-shrink: 0;
  }

  .duration {
    width: 48px;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .plays {
    width: 64px;
    display: inline-flex;
    align-items: center;
    justify-content: flex-end;
    gap: 3px;
  }

  .uploader {
    width: 90px;
    text-align: right;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .delete {
    width: 30px;
    height: 30px;
    border: none;
    border-radius: 50%;
    background: none;
    color: var(--color-text);
    opacity: 0;
    font-size: 17px;
    cursor: pointer;
    flex-shrink: 0;
    padding: 0;

    &:hover {
      opacity: 1;
      color: $accent;
    }
  }

  .delete-placeholder {
    width: 30px;
    flex-shrink: 0;
  }
}

/* 当前曲目跳动条 */
.equalizer {
  display: inline-flex;
  align-items: flex-end;
  gap: 2px;
  height: 14px;

  span {
    width: 3px;
    background: $accent;
    border-radius: 1px;
    animation: eq-bounce 0.9s ease-in-out infinite;

    &:nth-child(1) {
      height: 60%;
      animation-delay: -0.3s;
    }

    &:nth-child(2) {
      height: 100%;
      animation-delay: -0.15s;
    }

    &:nth-child(3) {
      height: 45%;
    }
  }

  &.paused span {
    animation-play-state: paused;
  }
}

@keyframes eq-bounce {
  0%,
  100% {
    transform: scaleY(0.4);
  }

  50% {
    transform: scaleY(1);
  }
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-top: 18px;

  .page-info {
    font-size: 13px;
    color: var(--color-text);
    opacity: 0.6;
  }
}

/* 移动端精简列 */
@media screen and (max-width: 768px) {
  .song-row {
    .uploader,
    .plays {
      display: none;
    }

    .cover {
      width: 44px;
      height: 44px;
    }
  }

  .search input {
    width: 140px;
  }
}
</style>
