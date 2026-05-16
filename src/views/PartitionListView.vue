<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const coverFallback = `${import.meta.env.BASE_URL}icons/image-fallback.svg`

function onPartitionCoverError(e: Event) {
  const img = e.target as HTMLImageElement
  if (img.dataset.fallbackApplied === '1')
    return
  img.dataset.fallbackApplied = '1'
  img.src = coverFallback
}
const partitions = ref([
  { name: '日常吐槽', description: '言短情长，抒发心声。', src: 'https://sse-market-source-1320172928.cos.ap-guangzhou.myqcloud.com/assets/image/daily.jpg' },
  { name: '优质贴', description: '优质内容，分享交流。', src: 'https://sse-market-source-1320172928.cos.ap-guangzhou.myqcloud.com/assets/image/secondhand.jpg' },
  { name: '课程交流', description: '课程内容，分享交流。', src: 'https://sse-market-source-1320172928.cos.ap-guangzhou.myqcloud.com/assets/image/study.jpg' },
  { name: '打听求助', description: '疑虑相询，忧难互助。', src: 'https://sse-market-source-1320172928.cos.ap-guangzhou.myqcloud.com/assets/image/help.jpg' },
  { name: '学习交流', description: '知识碰撞，学术思辨。', src: 'https://sse-market-source-1320172928.cos.ap-guangzhou.myqcloud.com/assets/image/study.jpg' },
  { name: '院务', description: '院内事务，信息发布。', src: 'https://pic2.zhimg.com/v2-4fd432574e38d33d52e35041a8e7fd52_720w.jpg?source=172ae18b' },
  { name: '求职招募', description: '梦想职路，共创未来。', src: 'https://sse-market-source-1320172928.cos.ap-guangzhou.myqcloud.com/assets/image/recruit.jpg' },
  { name: '其他', description: '畅所欲言，创意无限。', src: 'https://sse-market-source-1320172928.cos.ap-guangzhou.myqcloud.com/assets/image/else.jpg' },
])

function sendPartition(p: string) {
  router.push(`/partition/${encodeURIComponent(p)}`)
}
</script>

<template>
  <div class="picker">
    <h2 class="picker__title">
      选择分区
    </h2>
    <div class="picker__grid">
      <article
        v-for="(p, index) in partitions"
        :key="index"
        class="picker-card"
      >
        <div class="picker-card__media">
          <img
            :src="p.src"
            class="picker-card__img"
            :alt="p.name"
            loading="lazy"
            decoding="async"
            @error="onPartitionCoverError"
          >
        </div>
        <div class="picker-card__body">
          <h3 class="picker-card__name">
            {{ p.name }}
          </h3>
          <p class="picker-card__desc">
            {{ p.description }}
          </p>
          <button
            type="button"
            class="picker-card__btn"
            @click="sendPartition(p.name)"
          >
            进入分区
          </button>
        </div>
      </article>
    </div>
  </div>
</template>

<style scoped lang="scss">
.picker {
  width: 100%;
  max-width: 720px;
  margin: 0 auto;
  padding: 6px 10px 12px;
  box-sizing: border-box;
  color: var(--chat-text, var(--color-text));
}

.picker__title {
  margin: 0 0 8px;
  font-size: 1.05rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--chat-text, var(--color-text));
}

.picker__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  width: 100%;
}

@media screen and (min-width: 520px) {
  .picker__grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media screen and (min-width: 840px) {
  .picker__grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

.picker-card {
  display: flex;
  flex-direction: column;
  min-width: 0;
  border-radius: 12px;
  overflow: hidden;
  background: var(--chat-bg-highlight, #fff);
  border: 1px solid var(--chat-border, #e2e8f0);
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05);
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;

  &:hover {
    border-color: var(--chat-border-strong, #cbd5e1);
    box-shadow: 0 2px 8px rgba(15, 23, 42, 0.07);
  }
}

.picker-card__media {
  position: relative;
  width: 100%;
  aspect-ratio: 5 / 3;
  max-height: 88px;
  background: var(--chat-bg-main, #f1f5f9);
}

.picker-card__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.picker-card__body {
  padding: 8px 10px 10px;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.picker-card__name {
  margin: 0 0 4px;
  font-size: 0.875rem;
  font-weight: 600;
  line-height: 1.3;
  color: var(--chat-text, var(--color-text));
}

.picker-card__desc {
  margin: 0 0 8px;
  font-size: 11px;
  line-height: 1.35;
  color: var(--chat-text-secondary, #64748b);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  flex: 1;
}

.picker-card__btn {
  align-self: flex-start;
  margin-top: auto;
  padding: 5px 10px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.2;
  color: #fff;
  background: var(--chat-accent, #2c3d56);
  border: none;
  border-radius: 8px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition:
    filter 0.12s ease,
    transform 0.12s ease;

  &:hover {
    filter: brightness(1.05);
  }

  &:active {
    transform: scale(0.98);
  }
}

body.dark-mode .picker-card {
  background: var(--chat-bg-highlight, #1e293b);
  border-color: var(--chat-border, #334155);
}

body.dark-mode .picker-card__desc {
  color: var(--chat-text-secondary, #94a3b8);
}
</style>
