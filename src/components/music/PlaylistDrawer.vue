<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { musicCoverOrDefault, useMusicStore } from '@/store/musicStore'

const {
  playlist,
  currentIndex,
  isPlaying,
  showPlaylist,
  playMusic,
  togglePlay,
  removeFromPlaylist,
} = useMusicStore()

function playAt(index: number) {
  if (index === currentIndex.value) {
    togglePlay()
    return
  }
  const music = playlist.value[index]
  if (music)
    playMusic(music)
}

function close() {
  showPlaylist.value = false
}
</script>

<template>
  <Teleport to="body">
    <Transition name="drawer" :duration="300">
      <div
        v-if="showPlaylist && playlist.length > 0"
        class="drawer-mask"
        @click="close"
      >
        <div
          class="drawer"
          @click.stop
        >
          <div class="drawer-head">
            <span>当前播放（{{ playlist.length }}）</span>
            <button
              type="button"
              class="close-btn"
              @click="close"
            >
              <Icon icon="tabler:x" />
            </button>
          </div>

          <div class="drawer-list">
            <div
              v-for="(music, index) in playlist"
              :key="music.musicID"
              class="row"
              :class="{ active: index === currentIndex }"
              @click="playAt(index)"
            >
              <div class="equalizer" :class="{ paused: !isPlaying }">
                <span /><span /><span />
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
                  {{ music.artist || '未知歌手' }}
                </div>
              </div>
              <button
                type="button"
                class="remove"
                title="移出队列"
                @click.stop="removeFromPlaylist(index)"
              >
                <Icon icon="tabler:x" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style lang="scss" scoped>
$accent: #ec4141;

.drawer-mask {
  position: fixed;
  inset: 0;
  z-index: 2500;
  background: rgba(0, 0, 0, 0.25);
}

.drawer {
  position: absolute;
  right: 12px;
  bottom: 80px;
  width: 360px;
  max-height: min(60vh, 480px);
  display: flex;
  flex-direction: column;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.28);
  overflow: hidden;
}

.drawer-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;

  .close-btn {
    border: none;
    background: none;
    color: var(--color-text);
    opacity: 0.6;
    font-size: 18px;
    cursor: pointer;

    &:hover {
      opacity: 1;
    }
  }
}

.drawer-list {
  overflow-y: auto;
  padding: 6px;
}

.row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  cursor: pointer;

  &:hover {
    background: var(--color-nav-hover);

    .remove {
      opacity: 0.55;
    }
  }

  &.active {
    .title {
      color: $accent;
    }
  }

  .cover {
    width: 40px;
    height: 40px;
    border-radius: 6px;
    object-fit: cover;
    flex-shrink: 0;
  }

  .info {
    flex: 1;
    min-width: 0;

    .title {
      font-size: 14px;
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
      margin-top: 2px;
    }
  }

  .remove {
    border: none;
    background: none;
    color: var(--color-text);
    opacity: 0;
    font-size: 16px;
    cursor: pointer;
    padding: 4px;

    &:hover {
      opacity: 1;
    }
  }
}

/* 当前曲目跳动条 */
.equalizer {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  width: 14px;
  height: 16px;
  flex-shrink: 0;
  visibility: hidden;

  .row.active & {
    visibility: visible;
  }

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

/* 移动端：底部抽屉 */
@media screen and (max-width: 768px) {
  .drawer {
    right: 0;
    left: 0;
    bottom: 0;
    width: auto;
    max-height: 60vh;
    border-radius: 14px 14px 0 0;
  }
}

.drawer-enter-active,
.drawer-leave-active {
  transition: opacity 0.25s ease;
}

.drawer-enter-active .drawer,
.drawer-leave-active .drawer {
  transition: transform 0.25s ease;
}

.drawer-enter-from,
.drawer-leave-to {
  opacity: 0;

  .drawer {
    transform: translateY(16px);
  }
}
</style>
