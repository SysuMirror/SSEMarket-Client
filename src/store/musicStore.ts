import type { MusicSummary } from '@/api/music/uploadMusic'
import { Howl } from 'howler'
import { computed, ref } from 'vue'
import { reportMusicPlayed } from '@/api/music/controlMusic'
import { getMusicList } from '@/api/music/getMusicList'
import defaultCover from '@/assets/music-default-cover.svg'

import { showMsg } from '@/components/MessageBox'

const apiUrl = import.meta.env.VITE_API_BASE_URL

/** 文件/封面 URL 统一由前端拼接（后端只发 musicID 与 hasCover） */
function musicFileURL(musicID: number): string {
  return `${apiUrl}/music/file/${musicID}`
}
export function musicCoverURL(musicID: number): string {
  return `${apiUrl}/music/cover/${musicID}`
}

/** 无封面时兜底到自绘默认封面 */
export function musicCoverOrDefault(music: MusicSummary | null): string {
  return music && music.hasCover ? musicCoverURL(music.musicID) : defaultCover
}

export type PlayMode = 'list' | 'one' | 'shuffle'

const PLAYLIST_KEY = 'music-player-state'

const playlist = ref<MusicSummary[]>([])
const currentIndex = ref(-1)
const current = computed<MusicSummary | null>(() => playlist.value[currentIndex.value] ?? null)
const isPlaying = ref(false)
const progress = ref(0) // 当前播放秒数
const duration = ref(0) // 当前曲目总秒数
const volume = ref(0.8)
const playMode = ref<PlayMode>('list')
const showNowPlaying = ref(false)
const showPlaylist = ref(false)
/* 悬浮球抑制：仅当用户在音乐页（或帖子卡片）显式点播后才出现；
   关闭/隐藏后置回 true，直到下一次显式点播 */
const ballSuppressed = ref(true)
const playError = ref('')

let howl: Howl | null = null
let progressTimer: number | null = null
let restored = false

function persistState() {
  try {
    localStorage.setItem(PLAYLIST_KEY, JSON.stringify({
      ids: playlist.value.map(m => m.musicID),
      index: currentIndex.value,
      volume: volume.value,
      playMode: playMode.value,
    }))
  }
  catch { /* localStorage 不可用时忽略 */ }
}

/** 刷新后恢复播放列表与音量（不自动续播，等用户点击） */
async function restoreOnce() {
  if (restored)
    return
  restored = true
  try {
    const saved = JSON.parse(localStorage.getItem(PLAYLIST_KEY) || 'null')
    if (saved && Array.isArray(saved.ids) && saved.ids.length > 0) {
      const list = await getMusicList({ ids: saved.ids })
      playlist.value = list
      // 保存的 id 可能已被删除，夹回有效范围
      const idx = Math.min(Math.max(saved.index ?? 0, 0), Math.max(list.length - 1, 0))
      currentIndex.value = list.length > 0 ? idx : -1
    }
    if (typeof saved?.volume === 'number')
      volume.value = Math.min(Math.max(saved.volume, 0), 1)
    if (saved?.playMode)
      playMode.value = saved.playMode
  }
  catch { /* 恢复失败静默 */ }
}

function stopProgressTimer() {
  if (progressTimer !== null) {
    clearInterval(progressTimer)
    progressTimer = null
  }
}

function startProgressTimer() {
  stopProgressTimer()
  progressTimer = window.setInterval(() => {
    if (howl) {
      const seek = howl.seek()
      progress.value = typeof seek === 'number' ? seek : 0
    }
  }, 250)
}

function onTrackEnd() {
  if (playMode.value === 'one') {
    howl?.seek(0)
    howl?.play()
    return
  }
  nextTrack(true)
}

function loadHowl(music: MusicSummary) {
  howl?.unload()
  progress.value = 0
  duration.value = music.durationSec
  playError.value = ''
  howl = new Howl({
    src: [musicFileURL(music.musicID)],
    format: [music.format],
    html5: true, // 原生流式播放，支持 Range/Seek，不整段缓冲
    preload: 'metadata',
    volume: volume.value,
    onload: () => {
      if (howl) {
        const d = howl.duration()
        if (Number.isFinite(d) && d > 0)
          duration.value = Math.round(d)
      }
    },
    onplay: () => {
      isPlaying.value = true
      startProgressTimer()
    },
    onpause: () => {
      isPlaying.value = false
      stopProgressTimer()
    },
    onend: onTrackEnd,
    onloaderror: () => {
      isPlaying.value = false
      stopProgressTimer()
      playError.value = '音频加载失败'
      showMsg(`音频加载失败：${music.title}`)
    },
    onplayerror: () => {
      // 多为浏览器自动播放策略拦截，回到暂停态等用户再次点击
      isPlaying.value = false
    },
  })
}

function playIndex(index: number) {
  const music = playlist.value[index]
  if (!music)
    return
  currentIndex.value = index
  loadHowl(music)
  howl?.play()
  persistState()
  reportMusicPlayed(music.musicID)
}

function nextIndex(): number {
  const len = playlist.value.length
  if (len === 0)
    return -1
  if (playMode.value === 'shuffle' && len > 1) {
    let i = currentIndex.value
    while (i === currentIndex.value)
      i = Math.floor(Math.random() * len)
    return i
  }
  return (currentIndex.value + 1) % len
}

function prevIndex(): number {
  const len = playlist.value.length
  if (len === 0)
    return -1
  if (playMode.value === 'shuffle' && len > 1) {
    let i = currentIndex.value
    while (i === currentIndex.value)
      i = Math.floor(Math.random() * len)
    return i
  }
  return (currentIndex.value - 1 + len) % len
}

function nextTrack(fromEnd = false) {
  const i = nextIndex()
  if (i >= 0)
    playIndex(i)
  else if (fromEnd)
    togglePlay()
}

function prevTrack() {
  // 播放超过 3 秒先回到开头（网易云行为）
  if (howl && typeof howl.seek() === 'number' && (howl.seek() as number) > 3) {
    howl.seek(0)
    return
  }
  const i = prevIndex()
  if (i >= 0)
    playIndex(i)
}

/** 播放一首：已在列表则定位，否则追加到列表末尾 */
function playMusic(music: MusicSummary) {
  ballSuppressed.value = false
  const idx = playlist.value.findIndex(m => m.musicID === music.musicID)
  if (idx >= 0) {
    // 同一曲重复点击：从头播
    if (idx === currentIndex.value && howl) {
      howl.seek(0)
      if (!isPlaying.value)
        howl.play()
      return
    }
    playIndex(idx)
  }
  else {
    playlist.value.push(music)
    playIndex(playlist.value.length - 1)
  }
}

/** 按 ID 播放（帖子内嵌音乐卡片用）：拉元数据后进入全局播放器 */
async function playById(musicID: number) {
  if (!Number.isInteger(musicID) || musicID <= 0)
    return
  try {
    const list = await getMusicList({ ids: [musicID] })
    const music = list.find(m => m.musicID === musicID)
    if (!music) {
      showMsg('音频不存在或已被删除')
      return
    }
    playMusic(music)
  }
  catch {
    showMsg('获取音乐信息失败')
  }
}

/** 整表替换（"播放全部"） */
function playAll(list: MusicSummary[], startIndex = 0) {
  ballSuppressed.value = false
  playlist.value = [...list]
  if (playlist.value.length === 0)
    return
  playIndex(Math.min(Math.max(startIndex, 0), playlist.value.length - 1))
}

function togglePlay() {
  if (!howl) {
    if (currentIndex.value < 0 && playlist.value.length > 0)
      playIndex(0)
    return
  }
  if (isPlaying.value)
    howl.pause()
  else
    howl.play()
}

function seekTo(sec: number) {
  if (!howl)
    return
  howl.seek(sec)
  progress.value = sec
}

function setVolume(v: number) {
  volume.value = Math.min(Math.max(v, 0), 1)
  howl?.volume(volume.value)
  persistState()
}

function cyclePlayMode() {
  playMode.value = playMode.value === 'list' ? 'one' : playMode.value === 'one' ? 'shuffle' : 'list'
  persistState()
}

function removeFromPlaylist(index: number) {
  if (index < 0 || index >= playlist.value.length)
    return
  const wasCurrent = index === currentIndex.value
  playlist.value.splice(index, 1)
  if (playlist.value.length === 0) {
    howl?.unload()
    howl = null
    currentIndex.value = -1
    isPlaying.value = false
    stopProgressTimer()
    showNowPlaying.value = false
    showPlaylist.value = false
  }
  else if (index < currentIndex.value) {
    currentIndex.value -= 1
  }
  else if (wasCurrent) {
    // 删除的是当前曲目：接着播同位置的下一首（原下一首补位）
    playIndex(Math.min(currentIndex.value, playlist.value.length - 1))
  }
  persistState()
}

/** 关闭播放器：停止播放并清空列表（悬浮球关闭按钮用） */
function closePlayer() {
  stopProgressTimer()
  howl?.unload()
  howl = null
  playlist.value = []
  currentIndex.value = -1
  isPlaying.value = false
  progress.value = 0
  duration.value = 0
  showNowPlaying.value = false
  showPlaylist.value = false
  playError.value = ''
  ballSuppressed.value = true
  persistState()
}

/** 收起悬浮球（音乐继续播放），下一次显式点播时再出现 */
function dismissBall() {
  ballSuppressed.value = true
}

function openNowPlaying() {
  if (currentIndex.value >= 0)
    showNowPlaying.value = true
}

export function useMusicStore() {
  return {
    playlist,
    currentIndex,
    current,
    isPlaying,
    progress,
    duration,
    volume,
    playMode,
    showNowPlaying,
    showPlaylist,
    playError,
    restoreOnce,
    playMusic,
    playById,
    playAll,
    togglePlay,
    nextTrack,
    prevTrack,
    seekTo,
    setVolume,
    cyclePlayMode,
    removeFromPlaylist,
    openNowPlaying,
    closePlayer,
    dismissBall,
    ballSuppressed,
  }
}

/** 秒数格式化 mm:ss */
export function formatDuration(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0)
    return '--:--'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}
