<script setup lang="ts">
import type { Notice } from '@/api/notice/notice'
import { Icon } from '@iconify/vue'
import { computed, nextTick, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getNotices, readNotice } from '@/api/notice/notice'
import { showMsg } from '@/components/MessageBox'
import UserAvatar from '@/components/UserAvatar.vue'
import { useNoticeStore } from '@/store/noticeStore'
import { strHandler } from '@/utils/strHandler'

const router = useRouter()
const { noticeNum, refreshNoticeNum } = useNoticeStore()

/** true：未读，false：已读 */
const readPage = ref(true)
const noticesRead = ref<Notice[]>([])
const noticesUnread = ref<Notice[]>([])

const activeList = computed(() => (readPage.value ? noticesUnread.value : noticesRead.value))
const unreadCount = computed(() => noticesUnread.value.length)

async function readComment(noticeID: number) {
  const res = await readNotice(noticeID)
  if (res.status === 'success') {
    getNoticesFunc()
    await refreshNoticeNum()
  }
}

async function readAll() {
  const promises = noticesUnread.value.map(notice => readNotice(notice.noticeID))
  try {
    await Promise.all(promises)
    await refreshNoticeNum()
    showMsg('已全部标记为已读')
    nextTick(getNoticesFunc)
  }
  catch (error) {
    showMsg('一键已读失败')
    console.error('一键已读失败:', error)
  }
}

async function changeToPost(postID: number, noticeID: number) {
  await readComment(noticeID)
  setTimeout(() => {
    router.push(`/postdetail/${postID}`)
  }, 500)
}

async function getNoticesFunc() {
  const read = await getNotices(0, noticeNum.readTotalNum, 1)
  const unread = await getNotices(0, noticeNum.unreadTotalNum, 0)
  if ('noticeList' in read) {
    noticesRead.value = read.noticeList.filter(item => item.postID !== 0)
  }
  else {
    noticesRead.value = []
  }
  if ('noticeList' in unread) {
    noticesUnread.value = unread.noticeList
  }
  else {
    noticesUnread.value = []
  }
}

onMounted(async () => {
  if (!noticeNum.readTotalNum || !noticeNum.unreadTotalNum) {
    await refreshNoticeNum()
  }
  await getNoticesFunc()
})
</script>

<template>
  <div class="notice-panel">
    <div class="notice-panel__toolbar">
      <div class="notice-panel__tabs" role="tablist" aria-label="通知分类">
        <button
          type="button"
          role="tab"
          class="notice-panel__tab"
          :class="{ 'notice-panel__tab--active': readPage }"
          :aria-selected="readPage"
          @click="readPage = true"
        >
          未读
          <span v-if="unreadCount > 0" class="notice-panel__tab-count">{{ unreadCount > 99 ? '99+' : unreadCount }}</span>
        </button>
        <button
          type="button"
          role="tab"
          class="notice-panel__tab"
          :class="{ 'notice-panel__tab--active': !readPage }"
          :aria-selected="!readPage"
          @click="readPage = false"
        >
          已读
        </button>
      </div>
      <button
        v-if="readPage"
        type="button"
        class="notice-panel__mark-all"
        :disabled="noticesUnread.length === 0"
        @click="readAll"
      >
        <Icon icon="tabler:checks" width="18" height="18" aria-hidden="true" />
        {{ noticesUnread.length === 0 ? '暂无未读' : '全部已读' }}
      </button>
    </div>

    <div class="lite-scrollbar notice-panel__list">
      <template v-if="activeList.length">
        <article
          v-for="notice in activeList"
          :key="notice.noticeID"
          class="notice-card"
          :class="{ 'notice-card--unread': readPage }"
        >
          <div class="notice-card__avatar-wrap">
            <UserAvatar :src="notice.senderAvatar" :user-id="notice.senderID ?? 0" />
          </div>
          <div class="notice-card__body">
            <div class="notice-card__meta">
              <span class="notice-card__sender">{{ notice.senderName }}</span>
              <time class="notice-card__time" :datetime="notice.time">{{ strHandler('time', notice.time) }}</time>
            </div>
            <p class="notice-card__content">
              {{ notice.content }}
            </p>
            <div v-if="notice.type" class="notice-card__type">
              {{ notice.type }}
            </div>
            <div class="notice-card__actions">
              <template v-if="readPage">
                <button
                  type="button"
                  class="notice-btn notice-btn--ghost"
                  @click="readComment(notice.noticeID)"
                >
                  <Icon icon="tabler:circle-check" width="16" height="16" aria-hidden="true" />
                  标为已读
                </button>
                <button
                  type="button"
                  class="notice-btn notice-btn--primary"
                  :disabled="notice.postID === 0"
                  @click="changeToPost(notice.postID, notice.noticeID)"
                >
                  <Icon icon="tabler:article" width="16" height="16" aria-hidden="true" />
                  {{ notice.postID === 0 ? '原帖已删除' : '查看原帖' }}
                </button>
              </template>
              <template v-else>
                <button
                  type="button"
                  class="notice-btn notice-btn--primary"
                  :disabled="notice.postID === 0"
                  @click="changeToPost(notice.postID, notice.noticeID)"
                >
                  <Icon icon="tabler:article" width="16" height="16" aria-hidden="true" />
                  {{ notice.postID === 0 ? '原帖已删除' : '查看原帖' }}
                </button>
              </template>
            </div>
          </div>
        </article>
      </template>
      <div v-else class="notice-empty">
        <Icon
          :icon="readPage ? 'tabler:bell-off' : 'tabler:inbox'"
          class="notice-empty__icon"
          width="48"
          height="48"
          aria-hidden="true"
        />
        <p class="notice-empty__title">
          {{ readPage ? '暂无未读通知' : '暂无已读记录' }}
        </p>
        <p class="notice-empty__hint">
          {{ readPage ? '有新回复时会出现在这里' : '已读通知会保存在此列表' }}
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.notice-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  color: var(--chat-text);
}

.notice-panel__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-shrink: 0;
  padding: 0 14px 12px;
}

.notice-panel__tabs {
  display: inline-flex;
  padding: 4px;
  background: var(--chat-bg-main);
  border: 1px solid var(--chat-border);
  border-radius: 14px;
  gap: 2px;
}

.notice-panel__tab {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 16px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: var(--chat-text-secondary);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  font-family: inherit;
  transition:
    background 0.15s ease,
    color 0.15s ease;

  &--active {
    background: var(--chat-bg-highlight);
    color: var(--chat-text);
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
  }

  &:not(&--active):hover {
    color: var(--chat-text);
  }
}

.notice-panel__tab-count {
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  font-size: 11px;
  font-weight: 600;
  line-height: 20px;
  text-align: center;
  color: var(--chat-unread-text);
  background: var(--chat-unread-bg);
  border-radius: 999px;
}

.notice-panel__mark-all {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border: 1px solid var(--chat-border-strong);
  border-radius: 12px;
  background: var(--chat-bg-highlight);
  color: var(--chat-text-secondary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  font-family: inherit;
  transition:
    border-color 0.15s ease,
    color 0.15s ease,
    background 0.15s ease;

  &:hover:not(:disabled) {
    border-color: var(--chat-accent);
    color: var(--chat-accent);
    background: var(--chat-accent-soft);
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
}

.notice-panel__list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 0 14px 14px;
}

.notice-card {
  display: flex;
  gap: 12px;
  padding: 14px 14px 12px;
  background: var(--chat-bg-highlight);
  border: 1px solid var(--chat-border);
  border-radius: 16px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  transition: border-color 0.15s ease;
  flex-shrink: 0;

  &--unread {
    border-color: var(--chat-bubble-border-self);
    background: var(--chat-bg-elevated);
  }

  &:hover {
    border-color: var(--chat-border-strong);
  }
}

.notice-card__avatar-wrap {
  flex-shrink: 0;
  width: 48px;
  height: 48px;

  :deep(.user) {
    width: 48px;
    height: 48px;
    align-items: center;
  }

  :deep(.user-avatar) {
    width: 48px;
    height: 48px;
  }

  :deep(.user-avatar-img) {
    width: 48px !important;
    height: 48px !important;
  }
}

.notice-card__body {
  min-width: 0;
  flex: 1;
}

.notice-card__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}

.notice-card__sender {
  font-size: 15px;
  font-weight: 600;
  color: var(--chat-text);
}

.notice-card__time {
  font-size: 12px;
  color: var(--chat-text-tips);
  white-space: nowrap;
}

.notice-card__content {
  margin: 0 0 8px;
  font-size: 15px;
  line-height: 1.5;
  color: var(--chat-text-secondary);
  word-break: break-word;
  white-space: pre-wrap;
}

.notice-card__type {
  font-size: 11px;
  color: var(--chat-text-tips);
  margin-bottom: 10px;
}

.notice-card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.notice-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  font-family: inherit;
  border: 1px solid transparent;
  transition:
    background 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease,
    opacity 0.15s ease;

  &--ghost {
    background: var(--chat-bg-main);
    border-color: var(--chat-border);
    color: var(--chat-text-secondary);

    &:hover {
      border-color: var(--chat-border-strong);
      color: var(--chat-text);
    }
  }

  &--primary {
    background: var(--chat-accent);
    border-color: var(--chat-accent);
    color: #fff;

    &:hover:not(:disabled) {
      filter: brightness(1.05);
    }

    &:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
  }
}

.notice-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1.5rem;
  text-align: center;
  background: var(--chat-bg-main);
  border: 1px dashed var(--chat-border);
  border-radius: 16px;
  flex: 1;
}

.notice-empty__icon {
  color: var(--chat-text-tips);
  opacity: 0.5;
  margin-bottom: 12px;
}

.notice-empty__title {
  margin: 0 0 6px;
  font-size: 16px;
  font-weight: 600;
  color: var(--chat-text);
}

.notice-empty__hint {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--chat-text-secondary);
  max-width: 260px;
}

@media screen and (max-width: 480px) {
  .notice-panel__toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .notice-panel__tabs {
    width: 100%;
    justify-content: stretch;
  }

  .notice-panel__tab {
    flex: 1;
  }

  .notice-panel__mark-all {
    justify-content: center;
  }

  .notice-card__actions {
    flex-direction: column;
  }

  .notice-btn {
    width: 100%;
  }
}
</style>
