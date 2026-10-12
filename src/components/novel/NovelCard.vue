<script setup lang="ts">
import type { NovelItem } from '@/api/novel/types'
import { Icon } from '@iconify/vue'
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import CoinThrowButton from '@/components/CoinThrowButton.vue'
import NovelCover from '@/components/novel/NovelCover.vue'
import { useUserStore } from '@/store/userStore'
import { novelBookPath, novelReadPath } from '@/utils/novelRoute'
import { formatCount, formatNovelTime, formatWordCount } from '@/utils/novelText'

defineOptions({ name: 'NovelCard' })

const { novel } = defineProps<{
  novel: NovelItem
}>()

const { userInfo } = useUserStore()
const continueChapter = computed(() => novel.progressChapterID || novel.latestChapterID)
const showProgress = computed(() => novel.progressPercent > 0 && novel.progressPercent < 100)
const isSelf = computed(() => novel.authorID > 0 && novel.authorID === userInfo.userID)
</script>

<template>
  <article class="novel-card">
    <RouterLink class="novel-card__main" :to="novelBookPath(novel.novelID)">
      <NovelCover class="novel-card__cover" :title="novel.title" :cover-url="novel.coverURL" />
      <div class="novel-card__body">
        <h3 class="novel-card__title">
          {{ novel.title }}
        </h3>
        <p class="novel-card__meta">
          <span>{{ novel.authorName || '佚名' }}</span>
          <span v-if="novel.category" class="novel-card__dot">·</span>
          <span v-if="novel.category">{{ novel.category }}</span>
          <span class="novel-card__dot">·</span>
          <span>{{ novel.status === 'completed' ? '完结' : '连载' }}</span>
        </p>
        <p class="novel-card__intro">
          {{ novel.intro || '暂无简介' }}
        </p>
        <p class="novel-card__stats">
          <span>{{ novel.chapterNum }}章</span>
          <span class="novel-card__dot">·</span>
          <span>{{ formatWordCount(novel.wordNum) }}</span>
          <span class="novel-card__dot">·</span>
          <span>{{ formatCount(novel.readNum) }}人在读</span>
          <span class="novel-card__dot">·</span>
          <span>{{ formatCount(novel.coinNum) }}币</span>
          <template v-if="novel.ratingCount > 0">
            <span class="novel-card__dot">·</span>
            <span>{{ novel.ratingAvg.toFixed(1) }}分</span>
          </template>
          <template v-if="novel.latestChapterAt">
            <span class="novel-card__dot">·</span>
            <span>{{ formatNovelTime(novel.latestChapterAt) }}更新</span>
          </template>
        </p>
        <p v-if="showProgress" class="novel-card__progress">
          读到 {{ novel.progressChapterNum }}章 · {{ novel.progressPercent.toFixed(0) }}%
        </p>
      </div>
    </RouterLink>
    <div class="novel-card__side">
      <RouterLink
        v-if="continueChapter > 0"
        class="novel-card__read"
        :to="novelReadPath(continueChapter)"
      >
        <Icon :icon="showProgress ? 'tabler:player-play' : 'tabler:book'" width="15" height="15" aria-hidden="true" />
        <span>{{ showProgress ? '继续阅读' : '开始阅读' }}</span>
      </RouterLink>
      <CoinThrowButton
        target-type="novel"
        :target-i-d="novel.novelID"
        :my-coins="novel.myCoins"
        :coin-num="novel.coinNum"
        :self="isSelf"
        variant="muted"
      />
    </div>
  </article>
</template>

<style scoped lang="scss">
.novel-card {
  display: flex;
  align-items: stretch;
  background: var(--color-card, #fff);
  border-radius: var(--radius-lg, 8px);
  box-shadow: var(--color-card-shadow);
  overflow: hidden;
  transition: box-shadow 0.15s ease;

  &:hover {
    box-shadow: var(--color-card-hover-shadow);
  }
}

.novel-card__main {
  flex: 1;
  min-width: 0;
  display: flex;
  gap: 10px;
  padding: 10px;
  color: inherit;
  text-decoration: none;
}

.novel-card__cover {
  flex: 0 0 auto;
  width: 56px;
  height: 78px;
  object-fit: cover;
  border-radius: 4px;
  background: var(--color-bg, #f5f6f7);
}

.novel-card__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.novel-card__title {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: var(--color-text, #1e293b);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.novel-card__meta {
  margin: 0;
  font-size: 12px;
  color: var(--color-text-secondary, #475569);
}

.novel-card__intro {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--color-text-muted, #94a3b8);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.novel-card__stats,
.novel-card__progress {
  margin: 0;
  font-size: 11px;
  color: var(--color-text-muted, #94a3b8);
}

.novel-card__progress {
  color: var(--accent, #2c3d56);
  font-weight: 600;
}

.novel-card__dot {
  margin: 0 3px;
  opacity: 0.6;
}

.novel-card__side {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: center;
  gap: 6px;
  padding: 8px 8px 8px 0;
}

.novel-card__read {
  flex: 0 0 auto;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 0 12px;
  font-size: 11px;
  font-weight: 600;
  color: var(--accent, #2c3d56);
  background: var(--accent-soft, rgba(44, 61, 86, 0.08));
  text-decoration: none;
  white-space: nowrap;

  &:active {
    opacity: 0.7;
  }
}

@media screen and (max-width: 360px) {
  .novel-card__read span {
    display: none;
  }

  .novel-card__read {
    padding: 0 10px;
  }
}
</style>
