<script setup lang="ts">
import type { EmojiItem } from '@/api/emoji/emoji'
import type { ChatMessageItem, RelevantUser } from '@/composables/useChat'
import { Icon } from '@iconify/vue'
import { computed, nextTick, onMounted, onUnmounted, ref, useTemplateRef, watch } from 'vue'
import { useRoute } from 'vue-router'
import { getInfoById } from '@/api/info/getInfo'
import ChatEmojiText from '@/components/emoji/ChatEmojiText.vue'
import EmojiPanel from '@/components/emoji/EmojiPanel.vue'
import { showMsg } from '@/components/MessageBox'
import UserAvatar from '@/components/UserAvatar.vue'
import { useChat } from '@/composables/useChat'
import { useEmoji } from '@/composables/useEmoji'
import { useUserStore } from '@/store/userStore'
import {
  ANONYMOUS_DISPLAY_NAME,
  bubbleSenderLabel,
  canRecallMessage,
  contactDisplayAvatar,
  contactDisplayName,
  contactProfileBlocked,
  recalledBubbleText,
} from '@/utils/chatAnonymous'
import { defaultAvatarFor } from '@/utils/defaultAvatar'
import { formatEmojiToken } from '@/utils/emojiToken'

export interface MessageCreation {
  senderUserID: number
  targetUserID: number
  content: string
}

export interface Message extends MessageCreation {
  chatMsgID: number
  createdAt: string
}

const { embedded = false } = defineProps<{
  /** 嵌入消息中心时隐藏侧栏标题并铺满父容器 */
  embedded?: boolean
}>()

const route = useRoute()
const { userInfo } = useUserStore()
const { on, off, contacts, chatHistory, sendChatMessage, recallMessage, selectContact: selectChatContact, addContact, current, isAnonymousMode, setAnonymousMode, leaveCurrentView } = useChat()

const draft = ref('')
const showEmojiPanel = ref(false)
const draftInput = useTemplateRef<HTMLTextAreaElement>('draftInput')
const { addEmojiToPersonalPack } = useEmoji()
type Contact = RelevantUser & Partial<{ ban: string, phone: string, punishnum: number, intro: string, unRead: number, emailpush: boolean }>

/** 点表情：输入框为空就直接发（微信式），有文字就把 token 插到光标处。 */
function handlePickEmoji(emoji: EmojiItem) {
  const token = formatEmojiToken(emoji.emojiID)
  if (draft.value.trim() === '') {
    if (!sendChatMessage(token))
      toastError('表情发送失败（服务器未连接）')
    scrollHistory()
    return
  }
  const el = draftInput.value
  const pos = el?.selectionStart ?? draft.value.length
  draft.value = draft.value.slice(0, pos) + token + draft.value.slice(pos)
  nextTick(() => {
    if (!el)
      return
    el.focus()
    el.setSelectionRange(pos + token.length, pos + token.length)
  })
}

/** 长按聊天里的表情 → 加进个人表情组「我的表情」。 */
async function handleAddEmoji(emojiID: number) {
  const result = await addEmojiToPersonalPack(emojiID)
  showMsg(result.ok ? '已加入「我的表情」' : result.msg, result.ok ? 'success' : 'error')
}

const historyDiv = useTemplateRef<HTMLDivElement>('historyDiv')
const isMobile = ref(false)
const keyboardInset = ref(0)
const mobilePane = ref<'list' | 'thread'>('list')

function updateIsMobile() {
  isMobile.value = window.innerWidth <= 768
}

function syncKeyboardInset() {
  if (!isMobile.value || mobilePane.value !== 'thread') {
    keyboardInset.value = 0
    return
  }
  const vv = window.visualViewport
  if (!vv) {
    keyboardInset.value = 0
    return
  }
  keyboardInset.value = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
}

function onVisualViewportChange() {
  syncKeyboardInset()
  scrollHistory()
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

function openContact(sel: Contact) {
  selectContact(sel)
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
  if (current.threadAnonymous) {
    setAnonymousMode(!isAnonymousMode.value)
    return
  }
  startAnonymousThread()
}

function startAnonymousThread() {
  if (!current.userID)
    return
  const existing = contacts.find(c => c.userID === current.userID && c.threadAnonymous)
  if (existing) {
    selectContact(existing)
    return
  }
  addContact({ ...current }, { threadAnonymous: true })
  const created = contacts.find(c => c.userID === current.userID && c.threadAnonymous)
  if (created)
    selectContact(created)
}

function messageShowsAnonymous(entry: ChatMessageItem) {
  return Boolean(entry.isAnonymous) && !entry.isRecalled
}

async function handleRecall(entry: ChatMessageItem) {
  if (!canRecallMessage(entry, userInfo.userID))
    return
  const ok = await recallMessage(entry.chatMsgID)
  if (!ok)
    showMsg('撤回失败，请稍后重试')
}

function senderLabel(entry: ChatMessageItem) {
  return bubbleSenderLabel(
    entry,
    userInfo.userID,
    userInfo.name,
    contactDisplayName(current),
  )
}

function avatarForMessage(entry: ChatMessageItem) {
  if (messageShowsAnonymous(entry)) {
    return { src: defaultAvatarFor(0), userId: 0, alt: ANONYMOUS_DISPLAY_NAME }
  }
  if (entry.senderUserID === userInfo.userID) {
    return { src: userInfo.avatarURL, userId: userInfo.userID, alt: userInfo.name }
  }
  return {
    src: contactDisplayAvatar(current),
    userId: contactProfileBlocked(current) ? 0 : current.userID,
    alt: contactDisplayName(current),
  }
}

function threadHeadSub() {
  if (current.threadAnonymous && isAnonymousMode.value)
    return '匿名通道 · 你的消息将隐藏身份'
  if (current.threadAnonymous && current.peerMasked)
    return '匿名通道 · 对方身份已隐藏'
  if (current.threadAnonymous)
    return '匿名通道'
  return current.intro || ''
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
  window.visualViewport?.addEventListener('resize', onVisualViewportChange)
  window.visualViewport?.addEventListener('scroll', onVisualViewportChange)
  syncKeyboardInset()

  on('NewMessage', onNewMessage)
  on('MessageAck', onMessageAck)
  const reqId = route.query.user
  const openAnonymous = route.query.anonymous === '1'
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
      addContact(contact, { threadAnonymous: openAnonymous })
      const toOpen = contacts.find(c => c.userID === contact.userID && Boolean(c.threadAnonymous) === openAnonymous)
      if (toOpen)
        selectContact(toOpen)
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
  window.visualViewport?.removeEventListener('resize', onVisualViewportChange)
  window.visualViewport?.removeEventListener('scroll', onVisualViewportChange)
  off('NewMessage', onNewMessage)
  off('MessageAck', onMessageAck)
  void leaveCurrentView()
})

watch([isMobile, mobilePane], () => {
  syncKeyboardInset()
})
</script>

<template>
  <div
    class="chat-page"
    :class="{
      'chat-page--embedded': embedded,
      'chat-page--mobile-list': isMobile && mobilePane === 'list',
      'chat-page--mobile-thread': isMobile && mobilePane === 'thread',
    }"
    :style="{ '--chat-kb-inset': `${keyboardInset}px` }"
  >
    <aside v-show="showContactAside" class="contact-aside">
      <div v-if="!embedded" class="contact-aside__head">
        <Icon icon="tabler:message-circle" class="contact-aside__head-icon" aria-hidden="true" />
        <span class="contact-aside__title">私信</span>
      </div>
      <div class="lite-scrollbar contact-aside__scroll">
        <div
          v-for="entry in contacts"
          :key="entry.conversationKey || entry.userID"
          class="contact-row"
          :class="{
            'contact-row--active': current.conversationKey === entry.conversationKey || (current.userID === entry.userID && Boolean(current.threadAnonymous) === Boolean(entry.threadAnonymous)),
            'contact-row--masked': entry.peerMasked,
          }"
          role="button"
          tabindex="0"
          @click="openContact(entry)"
          @keydown.enter.prevent="openContact(entry)"
        >
          <div class="contact-row__avatar-wrap" :class="{ 'contact-row__avatar-wrap--anon': entry.peerMasked }">
            <UserAvatar
              class="contact-row__avatar"
              :src="contactDisplayAvatar(entry)"
              :user-id="contactProfileBlocked(entry) ? 0 : entry.userID"
              :alt="contactDisplayName(entry)"
              :no-profile-link="contactProfileBlocked(entry)"
            />
            <span v-if="entry.unRead" class="contact-row__badge">{{ entry.unRead > 99 ? '99+' : entry.unRead }}</span>
          </div>
          <div class="contact-row__meta">
            <div class="contact-row__name">
              {{ contactDisplayName(entry) }}
            </div>
            <div class="contact-row__preview">
              {{ entry.lastMessagePreview || entry.intro }}
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
          <UserAvatar
            class="thread-head__avatar"
            :src="contactDisplayAvatar(current)"
            :user-id="contactProfileBlocked(current) ? 0 : current.userID"
            :alt="contactDisplayName(current)"
            :no-profile-link="contactProfileBlocked(current)"
          />
          <div class="thread-head__text">
            <div class="thread-head__name">
              {{ contactDisplayName(current) }}
            </div>
            <div v-if="threadHeadSub()" class="thread-head__sub">
              {{ threadHeadSub() }}
            </div>
          </div>
        </header>

        <div ref="historyDiv" class="lite-scrollbar thread-body">
          <div v-for="(entry, i) in chatHistory" :key="entry.chatMsgID || `pending-${i}-${entry.createdAt}`" class="thread-msg-group">
            <div v-if="getTimeShow(i)" class="thread-time">
              {{ getTimeShow(i) }}
            </div>
            <div v-if="entry.isRecalled" class="thread-recalled">
              {{ recalledBubbleText(userInfo.userID, entry.senderUserID) }}
            </div>
            <div
              v-else
              class="thread-bubble-row"
              :class="{ 'thread-bubble-row--self': entry.senderUserID === userInfo.userID }"
            >
              <UserAvatar
                class="thread-bubble-row__avatar"
                :src="avatarForMessage(entry).src"
                :user-id="avatarForMessage(entry).userId"
                :alt="avatarForMessage(entry).alt"
                no-profile-link
              />
              <div class="thread-bubble-stack">
                <div class="thread-bubble-sender">
                  {{ senderLabel(entry) }}
                  <span v-if="messageShowsAnonymous(entry)" class="thread-anon" aria-hidden="true">· 匿名</span>
                  <button
                    v-if="canRecallMessage(entry, userInfo.userID)"
                    type="button"
                    class="thread-recall-btn"
                    @click="handleRecall(entry)"
                  >
                    撤回
                  </button>
                </div>
                <div
                  class="thread-bubble"
                  :class="[
                    entry.senderUserID === userInfo.userID ? 'thread-bubble--self' : 'thread-bubble--peer',
                    { 'thread-bubble--anon': messageShowsAnonymous(entry) },
                  ]"
                >
                  <ChatEmojiText :content="entry.content" @add-emoji="handleAddEmoji" />
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
            :class="{ 'thread-composer__hint--active': current.threadAnonymous && isAnonymousMode }"
            :title="current.threadAnonymous ? (isAnonymousMode ? '关闭本条匿名发送' : '开启本条匿名发送') : '与此人发起匿名会话'"
            @click="toggleAnonymousMode"
          >
            <Icon icon="tabler:mask" width="18" height="18" />
            <span v-if="current.threadAnonymous">{{ isAnonymousMode ? '匿名发送已开启' : '匿名发送已关闭' }}</span>
            <span v-else>发起匿名会话</span>
          </button>
          <EmojiPanel v-if="showEmojiPanel" @pick="handlePickEmoji" />
          <div class="thread-composer__bar">
            <button
              type="button"
              class="thread-composer__emoji"
              :class="{ 'thread-composer__emoji--active': showEmojiPanel }"
              aria-label="表情包"
              title="表情包"
              @click="showEmojiPanel = !showEmojiPanel"
            >
              <Icon icon="tabler:emoji" width="20" height="20" />
            </button>
            <textarea
              ref="draftInput"
              v-model="draft"
              class="lite-scrollbar thread-composer__input"
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
          {{ embedded ? '在会话列表中选择联系人开始对话' : '在左侧列表中选择一个联系人开始对话' }}
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
  align-items: stretch;
  box-sizing: border-box;
  flex: 1 1 0;
  min-height: 0;
  height: 100%;

  &--embedded {
    max-width: none;
    margin: 0;
    padding: 0;
    gap: 0;
  }
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

  .chat-page--embedded .contact-aside {
    max-height: none;
    height: 100%;
    border-radius: 0;
    border-top: none;
    border-bottom: none;
  }

  .chat-page--embedded .chat-thread {
    border-radius: 0;
    border-top: none;
    border-bottom: none;
  }
}

@media screen and (max-width: 768px) {
  .chat-page,
  .chat-page--embedded {
    padding: 0;
    gap: 0;
    max-width: none;
  }

  .chat-page--mobile-list .contact-aside {
    width: 100%;
    flex: 1 1 0;
    max-height: none;
    height: 100%;
    border-radius: 0;
    border-left: none;
    border-right: none;
  }

  .chat-page--mobile-thread .chat-thread {
    display: flex;
    flex: 1 1 0;
    width: 100%;
    max-height: none;
    height: 100%;
    border-radius: 0;
    border-left: none;
    border-right: none;
  }

  .chat-page--mobile-thread .thread-composer {
    padding-bottom: calc(10px + env(safe-area-inset-bottom, 0px) + var(--chat-kb-inset, 0px));
  }

  .chat-page--mobile-thread .thread-body {
    padding-bottom: calc(12px + var(--chat-kb-inset, 0px));
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

.chat-page--embedded .contact-aside__scroll {
  padding-top: 4px;
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

.contact-row--masked .contact-row__name {
  color: var(--chat-text-secondary);
}

.contact-row__avatar-wrap--anon {
  .contact-row__avatar {
    opacity: 0.88;
  }
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

.thread-bubble--anon {
  border-style: dashed;
}

.thread-bubble-row--self .thread-bubble-sender {
  text-align: right;
}

.thread-anon {
  opacity: 0.85;
}

.thread-recalled {
  margin: 8px auto;
  width: fit-content;
  max-width: 90%;
  padding: 6px 14px;
  font-size: 12px;
  color: var(--chat-text-tips);
  background: var(--chat-bg-highlight);
  border: 1px dashed var(--chat-border);
  border-radius: 999px;
  text-align: center;
}

.thread-recall-btn {
  margin-left: 8px;
  padding: 0 4px;
  border: none;
  background: none;
  font-size: 11px;
  color: var(--chat-accent);
  cursor: pointer;
  font-family: inherit;

  &:hover {
    text-decoration: underline;
  }
}

.thread-bubble-row--self .thread-recall-btn {
  margin-left: 0;
  margin-right: 8px;
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
  padding: 4px 10px;
  border: 1px solid transparent;
  border-radius: 999px;
  background: none;
  font-size: 12px;
  color: var(--chat-text-tips);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;

  &:hover {
    color: var(--chat-text-secondary);
  }
}

.thread-composer__hint--active {
  color: var(--chat-accent);
  background: var(--chat-accent-soft);
  border-color: var(--chat-accent);
}

.thread-composer .emoji-panel {
  margin: 0 2px 10px;
}

.thread-composer__emoji {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  margin: 2px 0;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 50%;
  background: none;
  color: var(--chat-text-secondary);
  cursor: pointer;
  transition:
    color 0.15s ease,
    background 0.15s ease;
  -webkit-tap-highlight-color: transparent;

  &:hover {
    color: var(--chat-accent);
  }
}

.thread-composer__emoji--active {
  color: var(--chat-accent);
  background: var(--chat-accent-soft);
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
