<script lang="ts" setup>
const { isDense, browse, comment, isLike = false, like = 0, layout = 'default', hideTime = false } = defineProps<{
  isDense?: boolean
  browse?: number
  comment?: number
  nocomment?: boolean
  isLike?: boolean
  like?: number
  time: string
  /** inline：评论卡片底部紧凑统计行 */
  layout?: 'default' | 'inline'
  /** 时间由卡片头部展示时设为 true */
  hideTime?: boolean
}>()
const emit = defineEmits(['likeChange'])

function LikeChange() {
  emit('likeChange')
}
</script>

<template>
  <div class="basic-info" :class="`basic-info--${layout}`">
    <div v-show="!isDense && !hideTime" class="basic-info__time">
      <span>{{
        new Date(time).toLocaleString('zh-CN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      }}</span>
    </div>
    <div class="basic-info__stats">
      <div class="basic-info__stats-group">
        <span v-if="browse || browse === 0" class="basic-info__stat">
          {{ browse }}
          <svg
            class="basic-info__icon"
            viewBox="0 0 16 16"
            width="1em"
            height="1em"
            focusable="false"
            role="img"
            aria-label="浏览量"
            xmlns="http://www.w3.org/2000/svg"
            fill="currentColor"
          >
            <path
              d="M10.5 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z"
            />
            <path
              d="M0 8s3-5.5 8-5.5S16 8 16 8s-3 5.5-8 5.5S0 8 0 8zm8 3.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"
            />
          </svg>
        </span>
        <span v-if="(comment || comment === 0) && !nocomment" class="basic-info__stat">
          {{ comment < 0 ? 0 : comment }}
          <svg
            class="basic-info__icon"
            viewBox="0 0 16 16"
            width="1em"
            height="1em"
            focusable="false"
            role="img"
            aria-label="评论数"
            xmlns="http://www.w3.org/2000/svg"
            fill="currentColor"
          >
            <path
              d="M16 8c0 3.866-3.582 7-8 7a9.06 9.06 0 0 1-2.347-.306c-.584.296-1.925.864-4.181 1.234-.2.032-.352-.176-.273-.362.354-.836.674-1.95.77-2.966C.744 11.37 0 9.76 0 8c0-3.866 3.582-7 8-7s8 3.134 8 7zM5 8a1 1 0 1 0-2 0 1 1 0 0 0 2 0zm4 0a1 1 0 1 0-2 0 1 1 0 0 0 2 0zm3 1a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"
            />
          </svg>
        </span>
        <span
          class="basic-info__stat basic-info__stat--like cursor-pointer *:pointer-events-none"
          :class="{ 'basic-info__stat--liked': isLike }"
          @click.prevent="LikeChange"
        >
          {{ like < 0 ? 0 : like }}
          <svg
            class="basic-info__icon"
            viewBox="0 0 16 16"
            width="1em"
            height="1em"
            focusable="false"
            role="img"
            aria-label="点赞"
            xmlns="http://www.w3.org/2000/svg"
            fill="currentColor"
          >
            <path
              d="m8 2.748-.717-.737C5.6.281 2.514.878 1.4 3.053c-.523 1.023-.641 2.5.314 4.385.92 1.815 2.834 3.989 6.286 6.357 3.452-2.368 5.365-4.542 6.286-6.357.955-1.886.838-3.362.314-4.385C13.486.878 10.4.28 8.717 2.01L8 2.748zM8 15C-7.333 4.868 3.279-3.04 7.824 1.143c.06.055.119.112.176.171a3.12 3.12 0 0 1 .176-.17C12.72-3.042 23.333 4.867 8 15z"
            />
          </svg>
        </span>
      </div>
      <div v-if="$slots['stats-trailing']" class="basic-info__stats-trailing">
        <slot name="stats-trailing" />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.basic-info__time {
  margin-bottom: 4px;

  span {
    font-size: 12px;
    color: var(--chat-text-secondary);
  }
}

.basic-info__stats {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--chat-border);
  font-size: 13px;
  font-weight: 500;
  color: var(--chat-text);
  gap: 8px;
}

.basic-info__stats-group {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: space-around;
  min-width: 0;
  gap: 12px;
}

.basic-info__stats-trailing {
  flex-shrink: 0;
  margin-left: auto;
}

.basic-info__stat {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.basic-info__icon {
  color: var(--chat-accent);
  opacity: 1;
}

.basic-info__stat--like {
  transition: color 0.2s ease;

  &.basic-info__stat--liked,
  &.basic-info__stat--liked .basic-info__icon {
    color: #e11d48;
  }
}

.basic-info--inline {
  .basic-info__time {
    margin-bottom: 6px;
  }

  .basic-info__stats {
    justify-content: space-between;
    gap: 8px;
    margin-top: 0;
    padding-top: 0;
    border-top: none;
    font-size: 14px;
    font-weight: 600;
    line-height: 1.2;
  }

  .basic-info__stats-group {
    justify-content: flex-start;
    gap: 18px;
  }

  .basic-info__stat {
    gap: 6px;
  }

  .basic-info__icon {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    opacity: 1;
  }
}
</style>
