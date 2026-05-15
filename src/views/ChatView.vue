<script setup lang="ts">
import type { ChatMessageItem, RelevantUser } from '@/composables/useChat'
import { Icon } from '@iconify/vue'
import { computed, nextTick, onMounted, onUnmounted, ref, useTemplateRef, watch } from 'vue'
import { useRoute } from 'vue-router'
import { getInfoById } from '@/api/info/getInfo'
import { showMsg } from '@/components/MessageBox'
import UserAvatar from '@/components/UserAvatar.vue'
import { useChat } from '@/composables/useChat'
import { useUserStore } from '@/store/userStore'

export interface MessageCreation {
  senderUserID: number
  targetUserID: number
  content: string
}

export interface Message extends MessageCreation {
  chatMsgID: number
  createdAt: string
}

const route = useRoute()
const { userInfo } = useUserStore()
const { on, off, contacts, chatHistory, sendChatMessage, selectContact: selectChatContact, addContact, current } = useChat()

const draft = ref('')
type Contact = RelevantUser & Partial<{ ban: string, phone: string, punishnum: number, intro: string, unRead: number, emailpush: boolean }>

const historyDiv = useTemplateRef<HTMLDivElement>('historyDiv')

const isMobile = ref(false)
const mobilePane = ref<'list' | 'thread'>('list')

function updateIsMobile() {
  isMobile.value = window.innerWidth <= 768
}

const showContactAside = computed(() => !isMobile.value || mobilePane.value === 'list')
const showChatSection = computed(() => !isMobile.value || mobilePane.value === 'thread')

watch(isMobile, (m) => {
  if (!m) {
    mobilePane.value = 'list'
    return
  }
  if (current.userID)
    mobilePane.value = 'thread'
})

watch(
  () => current.userID,
  (id) => {
    if (isMobile.value && id)
      mobilePane.value = 'thread'
  },
)

function onNewMessage(data: ChatMessageItem) {
  if (data.senderUserID === current.userID) {
    const el = historyDiv.value
    if (!el)
      return
    scrollHistory()
  }
}

function onMessageAck(data: { code: number, msg: string }) {
  if (data.code === 0) {
    toastError(`请求失败：${data.msg} (${data.code})`)
    console.error(data)
  }
}

function toastError(content: string) {
  console.error(content)
  showMsg(`内部错误：${content}`)
}

function handleDraftKeyDown(event: KeyboardEvent) {
  if (event.key === 'Enter' && event.ctrlKey) {
    sendMessage()
    event.stopPropagation()
  }
}

function backToContacts() {
  mobilePane.value = 'list'
}

function selectContact(sel: Contact) {
  draft.value = ''

  selectChatContact(sel).then(() => {
    scrollHistory()
    if (isMobile.value)
      mobilePane.value = 'thread'
  }).catch((error) => {
    toastError(`联系人切换失败：${error.message}`)
    console.error(error)
  })
}

function scrollHistory() {
  nextTick(() => {
    const el = historyDiv.value
    if (!el)
      return
    historyDiv.value.scrollTop = historyDiv.value.scrollHeight
  })
}

function sendMessage() {
  if (draft.value === '') {
    return
  }

  if (!sendChatMessage(draft.value)) {
    toastError('消息发送失败（服务器未连接）')
  }

  draft.value = ''
  scrollHistory()
}

function toggleAnonymousMode() {
  showMsg('匿名聊天功能未开放，敬请期待！')
}

function getTimeShow(idx: number) {
  if (idx === 0) {
    const date = new Date(chatHistory[0].createdAt)
    const str = date.toLocaleString()
    return str.substring(0, str.length - 3)
  }

  const prev = new Date(chatHistory[idx - 1].createdAt)
  const date = new Date(chatHistory[idx].createdAt)
  if (!checkSameDay(prev, date)) {
    if (prev.getFullYear() === date.getFullYear()) {
      const str = date.toLocaleString()
      return str.substring(5, str.length - 3)
    }
    const str = date.toLocaleString()
    return str.substring(0, str.length - 3)
  }
  if (date.getTime() - prev.getTime() > 300000) {
    const str = date.toLocaleTimeString()
    return str.substring(0, str.length - 3)
  }
  return null
}

function checkSameDay(x: Date, y: Date) {
  return (
    x.getFullYear() === y.getFullYear()
    && x.getMonth() === y.getMonth()
    && x.getDate() === y.getDate()
  )
}

onMounted(() => {
  updateIsMobile()
  window.addEventListener('resize', updateIsMobile)

  on('NewMessage', onNewMessage)
  on('MessageAck', onMessageAck)
  const reqId = route.query.user
  if (!reqId) {
    if (current.userID) {
      selectContact(current)
    }
    return
  }
  if (Number(reqId) === userInfo.userID) {
    toastError('不能给自己发消息哦！')
  }
  getInfoById(Number(reqId))
    .then((res) => {
      const contact = {
        ...res,
        unRead: 0,
        identity: '',
      }
      addContact(contact)
      return contact
    })
    .then((contact) => {
      selectContact(contact)
    })
    .catch((error) => {
      if (error.response) {
        const res = error.response
        toastError(`请求无效：${res.msg} (${res.code})`)
        console.error(res)
      }
    })
})

onUnmounted(() => {
  window.removeEventListener('resize', updateIsMobile)
  off('NewMessage', onNewMessage)
  off('MessageAck', onMessageAck)
})
</script>

<template>
  <div
    class="chat-page"
    :class="{
      'chat-page--mobile-list': isMobile && mobilePane === 'list',
      'chat-page--mobile-thread': isMobile && mobilePane === 'thread',
    }"
  >
    <aside v-show="showContactAside" class="contact-aside">
      <div class="contact-aside__head">
        <Icon icon="tabler:message-circle" class="contact-aside__head-icon" aria-hidden="true" />
        <span class="contact-aside__title">消息</span>
      </div>
      <div class="contact-aside__scroll lite-scrollbar">
        <div
          v-for="entry in contacts"
          :key="entry.userID"
          class="contact-row"
          :class="{ 'contact-row--active': current.userID === entry.userID }"
          role="button"
          tabindex="0"
          @click="selectContact(entry)"
          @keydown.enter.prevent="selectContact(entry)"
        >
          <div class="contact-row__avatar-wrap">
            <UserAvatar class="contact-row__avatar" :src="entry.avatarURL" :alt="entry.name" />
            <span v-if="entry.unRead" class="contact-row__badge">{{ entry.unRead > 99 ? '99+' : entry.unRead }}</span>
          </div>
          <div class="contact-row__meta">
            <div class="contact-row__name">
              {{ entry.name }}
            </div>
            <div class="contact-row__preview">
              {{ entry.intro }}
            </div>
          </div>
        </div>
        <div v-if="!contacts.length" class="contact-empty">
          暂无会话
        </div>
      </div>
    </aside>

    <section v-show="showChatSection" class="chat-thread">
      <template v-if="current.userID">
        <header class="thread-head">
          <button
            v-if="isMobile"
            type="button"
            class="thread-head__back"
            aria-label="返回会话列表"
            @click="backToContacts"
          >
            <Icon icon="tabler:chevron-left" width="22" height="22" />
          </button>
          <UserAvatar class="thread-head__avatar" :src="current.avatarURL" :alt="current.name" />
          <div class="thread-head__text">
            <div class="thread-head__name">
              {{ current.name }}
            </div>
            <div v-if="current.intro" class="thread-head__sub">
              {{ current.intro }}
            </div>
          </div>
        </header>

        <div ref="historyDiv" class="thread-body lite-scrollbar">
          <div v-for="(entry, i) in chatHistory" :key="entry.chatMsgID" class="thread-msg-group">
            <div v-if="getTimeShow(i)" class="thread-time">
              {{ getTimeShow(i) }}
            </div>
            <div
              class="thread-bubble-row"
              :class="{ 'thread-bubble-row--self': entry.senderUserID === userInfo.userID }"
            >
              <UserAvatar
                v-if="entry.senderUserID !== userInfo.userID"
                class="thread-bubble-row__avatar"
                :src="current.avatarURL"
                :alt="current.name"
              />
              <UserAvatar
                v-else
                class="thread-bubble-row__avatar"
                :src="userInfo.avatarURL"
                :alt="userInfo.name"
              />
              <div class="thread-bubble-stack">
                <div class="thread-bubble-sender">
                  {{ entry.isAnonymous ? '匿名用户' : (entry.senderUserID === userInfo.userID ? userInfo.name : current.name) }}
                  <span v-if="entry.isAnonymous" class="thread-anon" aria-hidden="true">· 匿名</span>
                </div>
                <div
                  class="thread-bubble"
                  :class="entry.senderUserID === userInfo.userID ? 'thread-bubble--self' : 'thread-bubble--peer'"
                >
                  {{ entry.content }}
                </div>
              </div>
            </div>
          </div>
          <div v-if="!chatHistory.length" class="thread-empty">
            还没有消息，发条私信打个招呼吧
          </div>
        </div>

        <footer class="thread-composer">
          <button
            type="button"
            class="thread-composer__hint"
            title="匿名聊天功能未开放"
            @click="toggleAnonymousMode"
          >
            <Icon icon="tabler:mask" width="18" height="18" />
            <span>匿名（即将开放）</span>
          </button>
          <div class="thread-composer__bar">
            <textarea
              v-model="draft"
              class="thread-composer__input lite-scrollbar"
              placeholder="发消息…"
              rows="1"
              maxlength="8000"
              @keydown="handleDraftKeyDown"
            />
            <button
              type="button"
              class="thread-composer__send"
              :disabled="!draft.trim()"
              aria-label="发送"
              @click="sendMessage"
            >
              <Icon icon="tabler:send-2" width="20" height="20" />
            </button>
          </div>
        </footer>
      </template>
      <div v-else class="thread-placeholder">
        <Icon icon="tabler:message-dots" width="48" height="48" class="thread-placeholder__icon" aria-hidden="true" />
        <p class="thread-placeholder__title">
          选择聊天对象
        </p>
        <p class="thread-placeholder__desc">
          在左侧列表中选择一个联系人开始对话
        </p>
      </div>
    </section>
  </div>
</template>

<style scoped lang="scss">
.chat-page {
  display: flex;
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  gap: 0.75rem;
  padding: 0 12px 1rem;
  min-height: calc(90dvh - 100px);
  align-items: stretch;
  box-sizing: border-box;
}

@media screen and (min-width: 769px) {
  .chat-page {
    flex-direction: row;
    gap: 1rem;
    padding: 0 16px 1.25rem;
  }
}

.chat-page--mobile-list .chat-thread,
.chat-page--mobile-thread .contact-aside {
  display: none;
}

.contact-aside {
  display: flex;
  flex-direction: column;
  background: var(--chat-bg-highlight);
  border: 1px solid var(--chat-border);
  border-radius: 16px;
  overflow: hidden;
  min-height: 0;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}

@media screen and (min-width: 769px) {
  .contact-aside {
    width: min(300px, 32%);
    flex-shrink: 0;
    max-height: calc(90dvh - 100px);
  }
}

@media screen and (max-width: 768px) {
  .chat-page--mobile-list .contact-aside {
    width: 100%;
    max-height: calc(100dvh - 140px);
    border-radius: 0;
    border-left: none;
    border-right: none;
  }

  .chat-page--mobile-thread .chat-thread {
    display: flex;
  }
}

.contact-aside__head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 14px 16px;
  font-weight: 600;
  font-size: 1.05rem;
  letter-spacing: 0.02em;
  color: var(--chat-text);
  border-bottom: 1px solid var(--chat-border);
  background: var(--chat-bg-elevated);
}

.contact-aside__head-icon {
  color: var(--chat-accent);
  flex-shrink: 0;
}

.contact-aside__title {
  flex: 1;
}

.contact-aside__scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.contact-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  cursor: pointer;
  border-bottom: 1px solid var(--chat-border);
  transition: background 0.15s ease;
  -webkit-tap-highlight-color: transparent;

  &:active {
    background: var(--chat-bg-main);
  }
}

.contact-row--active {
  background: var(--chat-accent-soft);
}

.contact-row__avatar-wrap {
  position: relative;
  flex-shrink: 0;
}

.contact-row__avatar {
  width: 48px;
  min-width: 48px;
  height: 48px;
  border-radius: 50%;
  aspect-ratio: 1;
}

.contact-row__badge {
  position: absolute;
  top: -2px;
  right: -4px;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  font-size: 11px;
  font-weight: 600;
  line-height: 18px;
  text-align: center;
  color: var(--chat-unread-text);
  background: var(--chat-unread-bg);
  border-radius: 999px;
  box-shadow: 0 0 0 2px var(--chat-bg-highlight);
}

.contact-row__meta {
  min-width: 0;
  flex: 1;
}

.contact-row__name {
  font-size: 15px;
  font-weight: 600;
  color: var(--chat-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.contact-row__preview {
  margin-top: 2px;
  font-size: 13px;
  color: var(--chat-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.contact-empty {
  padding: 2rem 1rem;
  text-align: center;
  font-size: 14px;
  color: var(--chat-text-tips);
}

.chat-thread {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  background: var(--chat-bg-highlight);
  border: 1px solid var(--chat-border);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}

@media screen and (max-width: 768px) {
  .chat-page--mobile-thread .chat-thread {
    width: 100%;
    max-height: calc(100dvh - 140px);
    border-radius: 0;
    border-left: none;
    border-right: none;
  }
}

@media screen and (min-width: 769px) {
  .chat-thread {
    max-height: calc(90dvh - 100px);
  }
}

.thread-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px 10px 8px;
  border-bottom: 1px solid var(--chat-border);
  background: var(--chat-bg-elevated);
  flex-shrink: 0;
}

.thread-head__back {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  margin: 0;
  padding: 0;
  border: none;
  border-radius: 12px;
  background: transparent;
  color: var(--chat-accent);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;

  &:active {
    background: var(--chat-accent-soft);
  }
}

.thread-head__avatar {
  width: 40px;
  min-width: 40px;
  height: 40px;
  border-radius: 50%;
}

.thread-head__text {
  min-width: 0;
  flex: 1;
}

.thread-head__name {
  font-size: 16px;
  font-weight: 600;
  color: var(--chat-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.thread-head__sub {
  margin-top: 2px;
  font-size: 12px;
  color: var(--chat-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.thread-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 12px 14px 16px;
  background: var(--chat-bg-main);
}

.thread-msg-group {
  margin-bottom: 4px;
}

.thread-time {
  display: block;
  width: fit-content;
  max-width: 90%;
  margin: 12px auto 8px;
  font-size: 12px;
  text-align: center;
  color: var(--chat-text-tips);
  padding: 4px 12px;
  border-radius: 999px;
  background: var(--chat-bg-highlight);
  border: 1px solid var(--chat-border);
}

.thread-bubble-row {
  display: flex;
  flex-direction: row;
  align-items: flex-end;
  gap: 8px;
  max-width: 100%;
  margin-bottom: 10px;
}

.thread-bubble-row--self {
  flex-direction: row-reverse;
}

.thread-bubble-row__avatar {
  width: 36px;
  min-width: 36px;
  height: 36px;
  border-radius: 50%;
  flex-shrink: 0;
}

.thread-bubble-stack {
  display: flex;
  flex-direction: column;
  max-width: min(78%, 420px);
  min-width: 0;
}

.thread-bubble-row--self .thread-bubble-stack {
  align-items: flex-end;
}

.thread-bubble-sender {
  font-size: 11px;
  color: var(--chat-text-tips);
  margin: 0 4px 4px;
  padding: 0 2px;
}

.thread-bubble {
  padding: 10px 14px;
  font-size: 15px;
  line-height: 1.45;
  word-break: break-word;
  border-radius: 18px;
}

.thread-bubble--peer {
  background: var(--chat-bubble-peer);
  color: var(--chat-text);
  border: 1px solid var(--chat-bubble-border-peer);
  border-bottom-left-radius: 6px;
}

.thread-bubble--self {
  background: var(--chat-bubble-self);
  color: var(--chat-text);
  border: 1px solid var(--chat-bubble-border-self);
  border-bottom-right-radius: 6px;
}

.thread-bubble-row--self .thread-bubble-sender {
  text-align: right;
}

.thread-anon {
  opacity: 0.85;
}

.thread-empty {
  text-align: center;
  padding: 3rem 1.5rem;
  font-size: 14px;
  color: var(--chat-text-secondary);
  line-height: 1.6;
}

.thread-composer {
  flex-shrink: 0;
  padding: 10px 12px 14px;
  background: var(--chat-bg-elevated);
  border-top: 1px solid var(--chat-border);
}

.thread-composer__hint {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 8px 2px;
  padding: 0;
  border: none;
  background: none;
  font-size: 12px;
  color: var(--chat-text-tips);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;

  &:hover {
    color: var(--chat-text-secondary);
  }
}

.thread-composer__bar {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  padding: 6px 6px 6px 12px;
  border-radius: 22px;
  border: 1px solid var(--chat-border-strong);
  background: var(--chat-bg-main);
}

.thread-composer__input {
  flex: 1;
  min-height: 40px;
  max-height: 120px;
  resize: none;
  border: none;
  outline: none;
  background: transparent;
  font-size: 15px;
  line-height: 1.4;
  font-family: inherit;
  color: var(--chat-text);
  padding: 10px 0;

  &::placeholder {
    color: var(--chat-text-tips);
  }
}

.thread-composer__send {
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  margin: 0;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 50%;
  background: var(--chat-accent);
  color: #fff;
  cursor: pointer;
  transition:
    opacity 0.15s ease,
    transform 0.12s ease;
  -webkit-tap-highlight-color: transparent;

  &:disabled {
    opacity: 0.35;
    cursor: not-allowed;
    transform: none;
  }

  &:not(:disabled):active {
    transform: scale(0.96);
  }
}

.thread-placeholder {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem 1.5rem;
  text-align: center;
  background: var(--chat-bg-main);
  color: var(--chat-text-secondary);
}

.thread-placeholder__icon {
  opacity: 0.35;
  margin-bottom: 12px;
}

.thread-placeholder__title {
  font-size: 17px;
  font-weight: 600;
  color: var(--chat-text);
  margin-bottom: 6px;
}

.thread-placeholder__desc {
  font-size: 14px;
  line-height: 1.5;
  max-width: 280px;
}

@media screen and (max-width: 768px) {
  .thread-placeholder {
    display: none;
  }
}

.lite-scrollbar {
  overflow: auto;

  &::-webkit-scrollbar {
    width: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background-color: var(--chat-border-strong);
    border-radius: 4px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }
}
</style>
