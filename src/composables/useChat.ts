import { reactive, ref } from 'vue'
import { getChatHistory, getChatNotice, leaveChatView, recallChatMessage } from '@/api/chat/chat'
import { getInfoById } from '@/api/info/getInfo'
import { useUserStore } from '@/store/userStore'
import {
  ANONYMOUS_DISPLAY_NAME,
  buildDisplayFields,
  conversationKey,
  previewText,
  RECALL_LIST_PREVIEW,
} from '@/utils/chatAnonymous'
import { useEventBus } from './useEventBus'
import { useWebSocket } from './useWebsocket'

export interface RelevantUser {
  userID: number
  email: string
  name: string
  avatarURL: string
  identity: string
  score: number
  unRead: number
  lastMessageAt?: string
  lastMessagePreview?: string
  threadAnonymous?: boolean
  peerMasked?: boolean
  displayName?: string
  displayAvatar?: string
  conversationKey?: string
}

export interface ChatMessageItem {
  chatMsgID: number
  targetUserID: number
  senderUserID: number
  content: string
  unread: number
  createdAt: string
  isAnonymous?: boolean
  threadAnonymous?: boolean
  isRecalled?: boolean
  pending?: boolean
}

export type Contact = RelevantUser & Partial<{ ban: string, phone: string, punishnum: number, intro: string, unRead: number, emailpush: boolean }>

function parseContactTime(at?: string) {
  if (!at)
    return 0
  const t = new Date(at).getTime()
  return Number.isNaN(t) ? 0 : t
}

function sortContactsByLastMessage() {
  contacts.sort((a, b) => parseContactTime(b.lastMessageAt) - parseContactTime(a.lastMessageAt))
}

function findContactIndex(userID: number, threadAnonymous: boolean) {
  const key = conversationKey(userID, threadAnonymous)
  return contacts.findIndex(c => c.conversationKey === key || (c.userID === userID && Boolean(c.threadAnonymous) === threadAnonymous))
}

function normalizeServerContact(user: RelevantUser): Contact {
  const threadAnonymous = Boolean(user.threadAnonymous)
  const peerMasked = Boolean(user.peerMasked)
  return {
    ...user,
    threadAnonymous,
    peerMasked,
    conversationKey: user.conversationKey || conversationKey(user.userID, threadAnonymous),
    displayName: user.displayName || user.name,
    displayAvatar: user.displayAvatar ?? user.avatarURL,
    name: user.displayName || user.name,
    avatarURL: user.displayAvatar ?? user.avatarURL,
    email: peerMasked ? '' : user.email,
    identity: peerMasked ? '' : user.identity,
    unRead: user.unRead ?? 0,
  }
}

function normalizeKnownContact(user: RelevantUser, threadAnonymous: boolean): Contact {
  const contact: Contact = {
    ...user,
    threadAnonymous,
    peerMasked: false,
    unRead: user.unRead ?? 0,
    identity: user.identity ?? '',
  }
  buildDisplayFields(contact, user.name, user.avatarURL, threadAnonymous, false)
  return contact
}

function touchContactMessage(userID: number, threadAnonymous: boolean, preview: string, at?: string) {
  const idx = findContactIndex(userID, threadAnonymous)
  if (idx === -1)
    return
  const contact = contacts[idx]
  contact.lastMessagePreview = preview
  contact.lastMessageAt = at ?? new Date().toISOString()
  if (idx > 0) {
    contacts.splice(idx, 1)
    contacts.unshift(contact)
  }
  else {
    sortContactsByLastMessage()
  }
}

function anonymousIncomingContact(senderUserID: number, preview: string, at: string): Contact {
  const contact: Contact = {
    userID: senderUserID,
    email: '',
    name: ANONYMOUS_DISPLAY_NAME,
    avatarURL: '',
    identity: '',
    score: 0,
    unRead: 1,
    threadAnonymous: true,
    peerMasked: true,
    lastMessagePreview: preview,
    lastMessageAt: at,
  }
  buildDisplayFields(contact, ANONYMOUS_DISPLAY_NAME, '', true, true)
  return contact
}

function isSameConversation(peerId: number, threadAnonymous: boolean) {
  return current.userID === peerId && Boolean(current.threadAnonymous) === threadAnonymous
}

interface ChatEventMap {
  RelevantUsers: {
    relevantUsers: RelevantUser[]
  }
  NewMessage: ChatMessageItem
  MessageAck: { code: number, msg: string }
  MessageRecalled: ChatMessageItem
}

interface ChatMessage {
  Beat: { userID: number, beat: number }
  NewMessage: {
    senderUserID: number
    targetUserID: number
    content: string
    isAnonymous?: boolean
    threadAnonymous?: boolean
  }
}

function isRelevantUsers(event: any): event is ChatEventMap['RelevantUsers'] {
  return 'relevantUsers' in event
}

function isNewMessage(event: any): event is ChatMessageItem {
  return event && event.type !== 'recall' && 'chatMsgID' in event && 'targetUserID' in event && 'senderUserID' in event && 'content' in event && !event.type
}

function isRecallPush(event: any): event is { type: 'recall', recall: ChatMessageItem } {
  return event?.type === 'recall' && event?.recall && 'chatMsgID' in event.recall
}

function isMessageAck(event: any): event is ChatEventMap['MessageAck'] {
  return 'code' in event && 'msg' in event
}

const api = {} as {
  connect: () => void
  disconnect: () => void
  sendChatMessage: (content: string) => boolean
  recallMessage: (chatMsgID: number) => Promise<boolean>
  on: <K extends keyof ChatEventMap>(event: K, handler: (data: ChatEventMap[K]) => void) => void
  off: <K extends keyof ChatEventMap>(event: K, handler: (data: ChatEventMap[K]) => void) => void
  selectContact: (contact: Contact) => Promise<void>
  addContact: (contact: RelevantUser, options?: { threadAnonymous?: boolean }) => void
  updateChatNum: () => void
  leaveCurrentView: () => Promise<void>
  setAnonymousMode: (anonymous: boolean) => void
}

let isInit = false
const { userInfo, token } = useUserStore()
const contacts = reactive<Contact[]>([])
const current = reactive<Contact>({
  userID: 0,
  email: '',
  name: '',
  avatarURL: '',
  identity: '',
  score: 0,
  unRead: 0,
  threadAnonymous: false,
  peerMasked: false,
  conversationKey: '',
})
const chatHistory = reactive<ChatMessageItem[]>([])
const chatNum = ref(0)
const isAnonymousMode = ref(false)

function syncSendModeFromContact(contact: Contact) {
  // 发起方在匿名通道持续匿名；接收方回复时不隐藏身份
  isAnonymousMode.value = Boolean(contact.threadAnonymous) && !contact.peerMasked
}

function applyRecalledMessage(data: ChatMessageItem) {
  const idx = chatHistory.findIndex(m => m.chatMsgID === data.chatMsgID)
  if (idx !== -1) {
    chatHistory[idx].isRecalled = true
    chatHistory[idx].content = ''
  }

  const peerId = data.senderUserID === userInfo.userID ? data.targetUserID : data.senderUserID
  const threadAnonymous = Boolean(data.threadAnonymous)
  const last = chatHistory[chatHistory.length - 1]
  if (last && (last.chatMsgID === data.chatMsgID || last.isRecalled)) {
    touchContactMessage(
      peerId,
      threadAnonymous,
      last.isRecalled ? RECALL_LIST_PREVIEW : previewText(last.content, Boolean(last.isAnonymous), Boolean(last.isRecalled)),
      last.createdAt,
    )
  }
}

function applySentMessageEcho(data: ChatMessageItem) {
  for (let i = chatHistory.length - 1; i >= 0; i--) {
    const m = chatHistory[i]
    if (m.senderUserID === userInfo.userID && m.pending) {
      m.chatMsgID = data.chatMsgID
      m.createdAt = data.createdAt
      m.isAnonymous = data.isAnonymous
      m.threadAnonymous = data.threadAnonymous
      m.pending = false
      return
    }
  }
  chatHistory.push({ ...data, unread: 0 })
}

export function useChat() {
  const init = () => {
    if (isInit)
      return

    isInit = true
    // 用当前来源作 base，使 IP 直连与域名访问都能正确解析 WebSocket 地址
    const wsURL = new URL('/websocket/auth/chat', window.location.origin)
    wsURL.searchParams.append('token', token.value)
    wsURL.protocol = wsURL.protocol.replace('http', 'ws')
    const { connect: connectWebSocket, sendWebSocketMessage, on: listenWebSocket, disconnect: disconnectWebSocket } = useWebSocket<ChatEventMap, ChatMessage>(wsURL, {
      keepAliveOptions: {
        interval: 30000,
        fn: (sendWebSocketMessage) => {
          sendWebSocketMessage({ userID: userInfo.userID, beat: 1 })
        },
      },
    })
    const { emit, on, off, cleanup } = useEventBus<ChatEventMap>()
    const sendMessage = sendWebSocketMessage

    const sendChatMessage = (content: string) => {
      if (current.userID === 0)
        return false

      const threadAnonymous = Boolean(current.threadAnonymous)
      const hideIdentity = threadAnonymous && isAnonymousMode.value
      const message = {
        senderUserID: userInfo.userID,
        targetUserID: current.userID,
        content,
        isAnonymous: hideIdentity,
        threadAnonymous,
      }
      const result = sendMessage(message)

      if (result) {
        const createdAt = new Date().toISOString()
        chatHistory.push({
          ...message,
          createdAt,
          chatMsgID: 0,
          unread: 0,
          pending: true,
        })
        touchContactMessage(
          current.userID,
          threadAnonymous,
          previewText(content, hideIdentity),
          createdAt,
        )
      }

      return result
    }

    const recallMessage = async (chatMsgID: number) => {
      const res = await recallChatMessage(chatMsgID)
      if (!res || res.code !== 200) {
        return false
      }
      const msg = res.data?.message as ChatMessageItem | undefined
      if (msg)
        applyRecalledMessage(msg)
      return true
    }

    const updateChatNum = () => {
      getChatNotice(userInfo.userID)
        .then((resp) => {
          if (resp?.code === 200)
            chatNum.value = resp.data.noticeNum
        })
        .catch(() => {
          chatNum.value = 0
        })
    }

    const refreshCurrentView = async () => {
      if (current.userID === 0)
        return
      const threadAnonymous = Boolean(current.threadAnonymous)
      const res = await getChatHistory(userInfo.userID, current.userID, threadAnonymous)
      if (res?.code === 200) {
        chatHistory.splice(0, chatHistory.length, ...res.data.chatHistoryList)
        const last = chatHistory[chatHistory.length - 1]
        if (last) {
          touchContactMessage(
            current.userID,
            threadAnonymous,
            previewText(last.content, Boolean(last.isAnonymous), Boolean(last.isRecalled)),
            last.createdAt,
          )
        }
      }
      updateChatNum()
    }

    const leaveCurrentView = () => {
      if (current.userID === 0)
        return Promise.resolve()
      return leaveChatView(userInfo.userID, current.userID, Boolean(current.threadAnonymous))
    }

    const handleIncomingPeerMessage = (data: ChatMessageItem) => {
      const threadAnonymous = Boolean(data.threadAnonymous)
      const preview = previewText(data.content, Boolean(data.isAnonymous))
      const idx = findContactIndex(data.senderUserID, threadAnonymous)

      if (idx === -1) {
        if (threadAnonymous && data.isAnonymous) {
          contacts.unshift(anonymousIncomingContact(data.senderUserID, preview, data.createdAt))
          sortContactsByLastMessage()
          return
        }
        getInfoById(data.senderUserID).then((res) => {
          const contact = normalizeKnownContact({
            ...res,
            unRead: 1,
            identity: '',
            lastMessagePreview: preview,
            lastMessageAt: data.createdAt,
          }, threadAnonymous)
          if (threadAnonymous && data.isAnonymous) {
            contact.peerMasked = true
            buildDisplayFields(contact, res.name, res.avatarURL, true, true)
          }
          contacts.unshift(contact)
          sortContactsByLastMessage()
        })
        return
      }

      const contact = contacts[idx]
      contact.unRead = (contact.unRead || 0) + 1
      touchContactMessage(data.senderUserID, threadAnonymous, preview, data.createdAt)
      if (threadAnonymous && data.isAnonymous) {
        contact.peerMasked = true
        buildDisplayFields(contact, contact.name, contact.avatarURL, true, true)
        if (isSameConversation(data.senderUserID, threadAnonymous))
          Object.assign(current, contact)
      }
    }

    const handleSocketMessage = <K extends keyof ChatEventMap>(data: ChatEventMap[K]) => {
      if (isRecallPush(data)) {
        applyRecalledMessage(data.recall)
        emit('MessageRecalled', data.recall)
        return
      }

      if (isNewMessage(data)) {
        if (data.senderUserID === userInfo.userID) {
          applySentMessageEcho(data)
          return
        }

        if (data.targetUserID !== userInfo.userID)
          return

        emit('NewMessage', data)
        updateChatNum()

        const threadAnonymous = Boolean(data.threadAnonymous)
        if (isSameConversation(data.senderUserID, threadAnonymous)) {
          chatHistory.push(data)
          touchContactMessage(
            current.userID,
            threadAnonymous,
            previewText(data.content, Boolean(data.isAnonymous)),
            data.createdAt,
          )
          return
        }

        handleIncomingPeerMessage(data)
      }

      if (isRelevantUsers(data)) {
        const seen = new Set<string>()
        const users = data.relevantUsers.reduce<RelevantUser[]>((acc, u) => {
          const key = u.conversationKey || conversationKey(u.userID, Boolean(u.threadAnonymous))
          if (seen.has(key))
            return acc
          acc.push({ ...u, conversationKey: key })
          seen.add(key)
          return acc
        }, [])
        contacts.splice(0, contacts.length, ...users.map(u => normalizeServerContact(u)))
        sortContactsByLastMessage()
      }

      if (isMessageAck(data)) {
        if (data.code === 0) {
          for (let i = chatHistory.length - 1; i >= 0; i--) {
            if (chatHistory[i].pending && chatHistory[i].senderUserID === userInfo.userID) {
              chatHistory.splice(i, 1)
              break
            }
          }
        }
        emit('MessageAck', data)
      }
    }

    listenWebSocket('Message', (data) => {
      handleSocketMessage(data)
    })

    listenWebSocket('Open', () => {
      updateChatNum()
      void refreshCurrentView()
    })

    const connect = () => {
      connectWebSocket()
      updateChatNum()
    }

    const addContact = (contact: RelevantUser, options?: { threadAnonymous?: boolean }) => {
      const threadAnonymous = options?.threadAnonymous ?? false
      const normalized = normalizeKnownContact(contact, threadAnonymous)
      if (findContactIndex(normalized.userID, threadAnonymous) === -1) {
        contacts.unshift(normalized)
        sortContactsByLastMessage()
      }
    }

    const selectContact = async (contact: Contact) => {
      const threadAnonymous = Boolean(contact.threadAnonymous)
      if (isSameConversation(contact.userID, threadAnonymous))
        return Promise.resolve()

      if (current.userID !== 0) {
        await leaveCurrentView().catch(() => {})
      }

      let idx = findContactIndex(contact.userID, threadAnonymous)
      if (idx === -1) {
        addContact(contact, { threadAnonymous })
        idx = findContactIndex(contact.userID, threadAnonymous)
      }
      if (idx === -1)
        return Promise.reject(new Error('Contact not found'))

      contacts[idx].unRead = 0
      Object.assign(current, contacts[idx])
      syncSendModeFromContact(current)
      chatHistory.splice(0, chatHistory.length)

      const res = await getChatHistory(userInfo.userID, current.userID, threadAnonymous)
      if (res?.code === 200) {
        chatHistory.splice(0, chatHistory.length, ...res.data.chatHistoryList)
        const last = chatHistory[chatHistory.length - 1]
        if (last) {
          touchContactMessage(
            current.userID,
            threadAnonymous,
            previewText(last.content, Boolean(last.isAnonymous), Boolean(last.isRecalled)),
            last.createdAt,
          )
        }
      }
      updateChatNum()
    }

    const setAnonymousMode = (anonymous: boolean) => {
      isAnonymousMode.value = anonymous
    }

    Object.assign(api, {
      connect,
      disconnect() {
        cleanup()
        disconnectWebSocket()
      },
      sendChatMessage,
      recallMessage,
      on,
      off,
      addContact,
      selectContact,
      updateChatNum,
      setAnonymousMode,
      leaveCurrentView,
    })
  }

  init()

  return {
    ...api,
    contacts,
    chatHistory,
    current,
    chatNum,
    isAnonymousMode,
  }
}
