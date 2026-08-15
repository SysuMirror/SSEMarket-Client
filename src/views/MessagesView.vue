<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import NoticePanel from '@/components/messages/NoticePanel.vue'
import ChatView from '@/views/ChatView.vue'
import { useChat } from '@/composables/useChat'
import { useNoticeStore } from '@/store/noticeStore'

defineOptions({ name: 'MessagesView' })

type MessageTab = 'notice' | 'chat'

const route = useRoute()
const router = useRouter()
const { noticeNum } = useNoticeStore()
const { chatNum } = useChat()

const activeTab = computed<MessageTab>(() => (
  route.query.tab === 'chat' ? 'chat' : 'notice'
))

const unreadNotice = computed(() => noticeNum.unreadTotalNum || 0)
const unreadChat = computed(() => chatNum.value || 0)
const totalUnread = computed(() => unreadNotice.value + unreadChat.value)

function switchTab(tab: MessageTab) {
  if (activeTab.value === tab)
    return
  const query: Record<string, string> = { tab }
  if (tab === 'chat' && route.query.user)
    query.user = String(route.query.user)
  router.replace({ path: '/messages', query })
}

watch(
  () => route.query.tab,
  (tab) => {
    if (tab && tab !== 'notice' && tab !== 'chat')
      router.replace({ path: '/messages', query: { tab: 'notice' } })
  },
  { immediate: true },
)
</script>

<template>
  <div class="msg-hub">
    <header class="msg-hub__head">
      <div class="msg-hub__head-row">
        <div class="msg-hub__title-row">
          <Icon icon="tabler:messages" class="msg-hub__title-icon" width="24" height="24" aria-hidden="true" />
          <div class="msg-hub__title-text">
            <h1 class="msg-hub__title">
              消息
            </h1>
            <p class="msg-hub__subtitle">
              互动通知与私信
            </p>
          </div>
          <span v-if="totalUnread > 0" class="msg-hub__total-badge">
            {{ totalUnread > 99 ? '99+' : totalUnread }}
          </span>
        </div>

        <div class="msg-hub__tabs" role="tablist" aria-label="消息类型">
        <button
          type="button"
          role="tab"
          class="msg-hub__tab"
          :class="{ 'msg-hub__tab--active': activeTab === 'notice' }"
          :aria-selected="activeTab === 'notice'"
          @click="switchTab('notice')"
        >
          <Icon icon="tabler:bell" width="18" height="18" aria-hidden="true" />
          <span>互动通知</span>
          <span v-if="unreadNotice > 0" class="msg-hub__tab-badge">{{ unreadNotice > 99 ? '99+' : unreadNotice }}</span>
        </button>
        <button
          type="button"
          role="tab"
          class="msg-hub__tab"
          :class="{ 'msg-hub__tab--active': activeTab === 'chat' }"
          :aria-selected="activeTab === 'chat'"
          @click="switchTab('chat')"
        >
          <Icon icon="tabler:message-circle" width="18" height="18" aria-hidden="true" />
          <span>私信</span>
          <span v-if="unreadChat > 0" class="msg-hub__tab-badge">{{ unreadChat > 99 ? '99+' : unreadChat }}</span>
        </button>
        </div>
      </div>
    </header>

    <div class="msg-hub__body">
      <div v-show="activeTab === 'notice'" class="msg-hub__panel msg-hub__panel--notice">
        <NoticePanel />
      </div>
      <div v-show="activeTab === 'chat'" class="msg-hub__panel msg-hub__panel--chat">
        <ChatView embedded />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.msg-hub {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  height: 100%;
  min-height: 0;
  color: var(--chat-text);
  box-sizing: border-box;
}

.msg-hub__head {
  flex-shrink: 0;
  padding: 8px 12px 10px;
  border-bottom: 1px solid var(--chat-border);
  background: var(--chat-bg-highlight);
}

.msg-hub__head-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.msg-hub__title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.msg-hub__title-icon {
  flex-shrink: 0;
  color: var(--chat-accent);
}

.msg-hub__title-text {
  flex: 1;
  min-width: 0;
}

.msg-hub__title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.25;
}

.msg-hub__subtitle {
  margin: 4px 0 0;
  font-size: 0.8125rem;
  color: var(--chat-text-secondary);
}

.msg-hub__total-badge {
  flex-shrink: 0;
  min-width: 22px;
  height: 22px;
  padding: 0 7px;
  font-size: 12px;
  font-weight: 700;
  line-height: 22px;
  text-align: center;
  color: #fff;
  background: #ef4444;
  border-radius: 999px;
}

.msg-hub__tabs {
  display: flex;
  flex-shrink: 0;
  gap: 6px;
}

.msg-hub__tab {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 8px 12px;
  white-space: nowrap;
  border: 1px solid var(--chat-border);
  border-radius: 12px;
  background: var(--chat-bg-main);
  color: var(--chat-text-secondary);
  font-size: 14px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition:
    background 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease,
    box-shadow 0.15s ease;

  &--active {
    background: var(--chat-bg-elevated);
    border-color: var(--chat-accent);
    color: var(--chat-accent);
    box-shadow: 0 1px 3px rgba(0, 120, 212, 0.12);
  }

  &:not(&--active):hover {
    border-color: var(--chat-border-strong);
    color: var(--chat-text);
  }
}

.msg-hub__tab-badge {
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  font-size: 11px;
  font-weight: 700;
  line-height: 18px;
  text-align: center;
  color: var(--chat-unread-text);
  background: var(--chat-unread-bg);
  border-radius: 999px;
}

.msg-hub__body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.msg-hub__panel {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.msg-hub__panel--notice {
  background: var(--chat-bg-main);
}

.msg-hub__panel--chat {
  background: var(--chat-bg-main);
}

@media screen and (min-width: 769px) {
  .msg-hub__head {
    padding: 12px 16px 12px;
    border-radius: 16px 16px 0 0;
    border: 1px solid var(--chat-border);
    border-bottom: none;
  }

  .msg-hub__body {
    border: 1px solid var(--chat-border);
    border-top: none;
    border-radius: 0 0 16px 16px;
    background: var(--chat-bg-highlight);
  }
}

@media screen and (max-width: 768px) {
  .msg-hub {
    max-width: none;
  }

  .msg-hub__head {
    padding: 6px 10px 8px;
  }

  .msg-hub__head-row {
    gap: 8px;
  }

  .msg-hub__subtitle {
    display: none;
  }

  .msg-hub__tab {
    padding: 7px 10px;
  }

  .msg-hub__tab span:not(.msg-hub__tab-badge) {
    font-size: 13px;
  }
}
</style>
