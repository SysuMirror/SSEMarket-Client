<script setup lang="ts">
import type { NovelItem } from '@/api/novel/types'
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import NovelCover from '@/components/novel/NovelCover.vue'
import { formatCount, formatWordCount } from '@/utils/novelText'
import { novelBookPath } from '@/utils/novelRoute'

defineOptions({ name: 'NovelCard' })

const { novel } = defineProps<{
  novel: NovelItem
}>()

const showProgress = computed(() => novel.progressPercent > 0 && novel.progressPercent < 100)
const isCompleted = computed(() => novel.status === 'completed')
</script>

<template>
  <!-- 番茄小说式竖版封面卡：封面(带连载/完结角标) + 书名(两行) + 进度/作者 + 数据行。
       整卡链到书详情页（继续阅读 / 投币都在详情页，列表卡保持干净）。 -->
  <article class="novel-card">
    <RouterLink class="novel-card__main" :to="novelBookPath(novel.novelID)">
      <span class="novel-card__coverbox">
        <NovelCover class="novel-card__cover" :title="novel.title" :cover-url="novel.coverURL" />
        <span
          class="novel-card__status"
          :class="{ 'novel-card__status--done': isCompleted }"
        >
          {{ isCompleted ? '完结' : '连载' }}
        </span>
      </span>
      <span class="novel-card__title">{{ novel.title }}</span>
      <span
        class="novel-card__sub"
        :class="{ 'novel-card__sub--progress': showProgress }"
      >
        {{
          showProgress
            ? `读到 ${novel.progressChapterNum}章 · ${novel.progressPercent.toFixed(0)}%`
            : (novel.authorName || '佚名')
        }}
      </span>
      <span class="novel-card__meta">
        {{ novel.chapterNum }}章 · {{ formatWordCount(novel.wordNum) }} · {{ formatCount(novel.readNum) }}人在读
      </span>
    </RouterLink>
  </article>
</template>

<style scoped lang="scss">
.novel-card {
  position: relative;
  min-width: 0;
}

.novel-card__main {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  color: inherit;
  text-decoration: none;
}

.novel-card__coverbox {
  position: relative;
  display: block;
  overflow: hidden;
  border-radius: 8px;
  background: var(--color-bg, #f5f6f7);
  box-shadow: var(--color-card-shadow);
}

.novel-card__cover {
  display: block;
  width: 100%;
  height: auto;
  aspect-ratio: 5 / 7;
  border-radius: 8px;
  transition: transform 0.18s ease;
}

@media (hover: hover) {
  .novel-card__main:hover .novel-card__cover {
    transform: scale(1.04);
  }
}

.novel-card__status {
  position: absolute;
  top: 0;
  right: 0;
  padding: 2px 7px;
  font-size: 10px;
  font-weight: 600;
  line-height: 1.5;
  color: #fff;
  background: rgb(15 23 42 / 42%);
  border-bottom-left-radius: 8px;
  backdrop-filter: blur(2px);
}

.novel-card__status--done {
  background: rgb(16 185 129 / 62%);
}

.novel-card__title {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 2.6em;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.3;
  color: var(--color-text, #1e293b);
  word-break: break-all;
}

.novel-card__sub {
  overflow: hidden;
  font-size: 11px;
  color: var(--color-text-secondary, #475569);
  text-overflow: ellipsis;
  white-space: nowrap;

  &--progress {
    font-weight: 600;
    color: var(--accent, #2c3d56);
  }
}

.novel-card__meta {
  overflow: hidden;
  font-size: 10.5px;
  color: var(--color-text-muted, #94a3b8);
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media screen and (min-width: 769px) {
  .novel-card__title {
    font-size: 13.5px;
  }

  .novel-card__sub {
    font-size: 11.5px;
  }

  .novel-card__meta {
    font-size: 11px;
  }
}
</style>
