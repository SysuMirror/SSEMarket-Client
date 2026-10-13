import type { ChatMessageItem } from '@/composables/useChat'
import { stripEmojiTokens } from './emojiToken'

/** 接收方看到的匿名会话对象名 */
export const ANONYMOUS_DISPLAY_NAME = '匿名用户'

/** 发起方看到的匿名会话标题后缀 */
export const ANONYMOUS_THREAD_SUFFIX = '·匿名'

export const RECALL_WINDOW_MS = 24 * 60 * 60 * 1000
export const RECALL_LIST_PREVIEW = '[消息已撤回]'

export function conversationKey(userID: number, threadAnonymous: boolean) {
  return threadAnonymous ? `${userID}_anon` : `${userID}_direct`
}

export function previewText(content: string, isAnonymous: boolean, isRecalled?: boolean) {
  if (isRecalled)
    return RECALL_LIST_PREVIEW
  // 表情 token 在列表预览里还原成 [表情]，与后端 buildRelevantUserJSON 口径一致。
  const text = stripEmojiTokens(content)
  if (isAnonymous)
    return `[匿名] ${text}`
  return text
}

export function recalledBubbleText(viewerUserId: number, senderUserId: number) {
  return senderUserId === viewerUserId ? '你撤回了一条消息' : '对方撤回了一条消息'
}

export function canRecallMessage(
  entry: { chatMsgID: number, senderUserID: number, createdAt: string, isRecalled?: boolean, pending?: boolean },
  viewerUserId: number,
) {
  if (entry.isRecalled)
    return false
  if (entry.senderUserID !== viewerUserId)
    return false
  if (entry.pending || entry.chatMsgID <= 0)
    return false
  const t = new Date(entry.createdAt).getTime()
  if (Number.isNaN(t))
    return false
  return Date.now() - t <= RECALL_WINDOW_MS
}

/** 气泡区：仅当发送者勾选匿名身份时隐藏昵称 */
export function bubbleSenderLabel(
  msg: ChatMessageItem,
  viewerUserId: number,
  viewerName: string,
  peerName: string,
) {
  if (msg.isAnonymous)
    return ANONYMOUS_DISPLAY_NAME
  return msg.senderUserID === viewerUserId ? viewerName : peerName
}

export interface ContactLike {
  userID: number
  name: string
  avatarURL: string
  threadAnonymous?: boolean
  peerMasked?: boolean
  displayName?: string
  displayAvatar?: string
  conversationKey?: string
}

export function contactDisplayName(contact: ContactLike): string {
  if (contact.displayName)
    return contact.displayName
  if (contact.threadAnonymous) {
    if (contact.peerMasked)
      return ANONYMOUS_DISPLAY_NAME
    return `${contact.name}${ANONYMOUS_THREAD_SUFFIX}`
  }
  return contact.name || ANONYMOUS_DISPLAY_NAME
}

export function contactDisplayAvatar(contact: ContactLike): string {
  if (contact.displayAvatar !== undefined)
    return contact.displayAvatar
  if (contact.peerMasked)
    return ''
  return contact.avatarURL ?? ''
}

export function contactProfileBlocked(contact: ContactLike): boolean {
  return Boolean(contact.peerMasked)
}

export function buildDisplayFields(
  contact: ContactLike,
  realName: string,
  realAvatar: string,
  threadAnonymous: boolean,
  peerMasked: boolean,
) {
  contact.threadAnonymous = threadAnonymous
  contact.peerMasked = peerMasked
  contact.conversationKey = conversationKey(contact.userID, threadAnonymous)
  if (threadAnonymous && peerMasked) {
    contact.displayName = ANONYMOUS_DISPLAY_NAME
    contact.displayAvatar = ''
    contact.name = ANONYMOUS_DISPLAY_NAME
    contact.avatarURL = ''
  }
  else if (threadAnonymous) {
    contact.displayName = `${realName}${ANONYMOUS_THREAD_SUFFIX}`
    contact.displayAvatar = realAvatar
    contact.name = realName
    contact.avatarURL = realAvatar
  }
  else {
    contact.displayName = realName
    contact.displayAvatar = realAvatar
    contact.name = realName
    contact.avatarURL = realAvatar
  }
}
