<!-- eslint-disable vue/html-self-closing -->
<script setup lang="ts">
import type { Tag } from '@/api/info/getTeacher'

import type { LotteryMode, LotteryPrizeInput } from '@/api/lottery/lottery'
import { Icon } from '@iconify/vue'
import { computed, onMounted, onUnmounted, ref, useTemplateRef } from 'vue'
import { useRouter } from 'vue-router'

import { fetchAssistMatch } from '@/api/assist'
import { sendPost } from '@/api/editPostAndComment/editPost'
import { getTeachers } from '@/api/info/getTeacher'

import { createLotteryPost } from '@/api/lottery/lottery'
import LotteryConfigPanel from '@/components/LotteryConfigPanel.vue'
import MarkdownEditor from '@/components/MarkdownEditor.vue'
import { showMsg } from '@/components/MessageBox'
import MusicPickerDialog from '@/components/music/MusicPickerDialog.vue'
import { useDraft } from '@/composables/useDraft'
import { isPostContentTooLong, POST_CONTENT_MAX_RUNES } from '@/constants/contentLimits'
import { POST_PARTITION_OPTIONS } from '@/constants/partitions'
import { useUserStore } from '@/store/userStore'

const router = useRouter()
const { userInfo } = useUserStore()
const { current, drafts, addDraft, selectDraft, deleteDraft, updateDraft, syncDrafts } = useDraft()
const partitions = ref([...POST_PARTITION_OPTIONS])
const postContent = ref('')
// 标题改为受控 v-model（驱动文档式标题行的字数提示）
const postTitle = ref('')
const partition = ref('主页')

const teachers = ref<Tag[]>([])
const teacher = ref('')

const draftsOpen = ref(false)
const musicPickerVisible = ref(false)
const editorRef = useTemplateRef<InstanceType<typeof MarkdownEditor>>('editorRef')

function onInsertMusic(musicID: number) {
  editorRef.value?.insertAtCursor(`

::music ${musicID}::

`)
}
const submitting = ref(false)
const postPrivate = ref(false)
const postAnonymous = ref(false)
// 同时置顶 1 小时(仅有置顶权限的用户生效,后端校验)
const postPinned = ref(false)

type PostKind = 'normal' | 'lottery'
const postKind = ref<PostKind>('normal')
const lotteryOpen = ref(true)
const lotteryMode = ref<LotteryMode>('random')
const lotteryDrawAt = ref('')
const lotteryPrizes = ref<LotteryPrizeInput[]>([
  { name: '', quantity: 1, wishKeyword: '' },
])

const titleCount = computed(() => postTitle.value.length)

let autoSaveTimer: number | null = null

function validateLotteryConfig(): string | null {
  if (!lotteryDrawAt.value)
    return '请设置开奖时间'
  const drawTime = Date.parse(lotteryDrawAt.value)
  if (!Number.isFinite(drawTime) || drawTime <= Date.now())
    return '开奖时间须晚于当前时间'
  for (const p of lotteryPrizes.value) {
    if (!p.name.trim())
      return '请填写奖品名称'
    if (!p.quantity || p.quantity < 1)
      return '奖品数量须大于 0'
    if (lotteryMode.value === 'wish' && !p.wishKeyword?.trim())
      return '许愿模式须为每个奖品设置关键词'
  }
  return null
}

async function loadDraft(id: number) {
  selectDraft(id)
  postTitle.value = current.title
  postContent.value = current.content
}

async function removeDraft(id: number) {
  if (!id)
    return
  await deleteDraft(id)
  showMsg('草稿已删除')
}

async function saveDraft() {
  const draftTitle = postTitle.value
  const draftContent = postContent.value

  if (!draftTitle && !draftContent) {
    showMsg('请输入标题或内容')
    return
  }

  const newDraftId = await addDraft({ title: draftTitle, content: draftContent }) as unknown as number
  selectDraft(newDraftId)
  showMsg('草稿已保存')
}

function autoSaveDraft() {
  if (!current.id)
    return Promise.resolve(false)
  const draftTitle = postTitle.value
  const draftContent = postContent.value

  if (draftTitle || draftContent) {
    return updateDraft({ id: current.id, title: draftTitle, content: draftContent })
      .then(() => true)
  }
  return Promise.resolve(false)
}

function discardDraft() {
  current.content = ''
  current.title = ''
  current.id = 0
  postTitle.value = ''
  postContent.value = ''
}

async function submitPost() {
  if (submitting.value)
    return
  const title = postTitle.value.replace(/(^\s*)|(\s*$)/g, '')
  const content = postContent.value
  const postPartition = partition.value

  if (!title || !content) {
    showMsg('请填写完整信息')
    return
  }
  if (isPostContentTooLong(content)) {
    showMsg(`正文最多 ${POST_CONTENT_MAX_RUNES} 字`)
    return
  }
  if (postKind.value === 'lottery') {
    const err = validateLotteryConfig()
    if (err) {
      showMsg(err)
      return
    }
  }

  submitting.value = true
  try {
    if (postKind.value === 'lottery') {
      const drawAt = `${lotteryDrawAt.value.replace('T', ' ')}:00`
      const { ok, msg, postID } = await createLotteryPost({
        title,
        content,
        partition: postPartition,
        userTelephone: userInfo.phone,
        mode: lotteryMode.value,
        drawAt,
        prizes: lotteryPrizes.value.map(p => ({
          name: p.name.trim(),
          quantity: p.quantity,
          wishKeyword: lotteryMode.value === 'wish' ? p.wishKeyword?.trim() : '',
        })),
        isPrivate: postPrivate.value,
      })
      showMsg(msg)
      if (ok) {
        if (postID)
          router.push(`/postdetail/${postID}`)
        else
          router.push('/')
      }
      return
    }

    const res = await sendPost(
      content,
      postPartition,
      '',
      teacher.value,
      title,
      userInfo.phone,
      postPrivate.value,
      postAnonymous.value,
      postPinned.value,
    )
    if (!res || typeof res.msg !== 'string') {
      showMsg('发帖失败，请检查网络后重试')
      return
    }
    // 发帖自动生成 AI 解读:静默预生成落库,不阻塞跳转(2026-09-08)
    const newPostID = Number((res.data as { postID?: number } | null)?.postID ?? 0)
    if (newPostID > 0) {
      fetchAssistMatch(
        { partition: postPartition, title, content, postID: newPostID },
        AbortSignal.timeout(45_000),
      ).catch(() => {})
    }
    showMsg(res.msg)
    router.push('/')
  }
  finally {
    submitting.value = false
  }
}

onMounted(async () => {
  const data = await getTeachers()
  teachers.value = data

  await syncDrafts()

  if (drafts.length > 0) {
    const latestDraft = drafts[drafts.length - 1]
    if (latestDraft.id !== undefined) {
      selectDraft(latestDraft.id)
      postTitle.value = latestDraft.title
      postContent.value = latestDraft.content
    }
  }

  autoSaveTimer = window.setInterval(() => {
    autoSaveDraft()
      .then((saved) => {
        if (saved)
          showMsg('草稿已自动保存')
      })
  }, 20000)
})

onUnmounted(() => {
  if (autoSaveTimer)
    clearInterval(autoSaveTimer)
})
</script>

<template>
  <!-- 布局参照 Discourse 2026 composer 重设计：元数据一行、标题文档化、编辑器占满剩余高度；
       抽奖配置限高内滚，杜绝桌面端内容被裁却无滚动条的问题 -->
  <div class="post-page">
    <article class="post-page__card" aria-label="发帖内容">
      <!-- 顶部操作条：标题 / 草稿下拉 / 帖子类型 / 发送 -->
      <header class="post-page__topbar">
        <h1 class="post-page__heading">
          发帖
        </h1>

        <button
          type="button"
          class="post-page__drafts-trigger"
          :class="{ 'post-page__drafts-trigger--active': draftsOpen }"
          :aria-expanded="draftsOpen"
          aria-haspopup="true"
          @click="draftsOpen = !draftsOpen"
        >
          <Icon icon="tabler:file-text" width="16" height="16" aria-hidden="true" />
          <span class="post-page__drafts-text">草稿</span>
          <span class="post-page__drafts-badge">{{ drafts.length }}</span>
          <Icon icon="tabler:chevron-down" width="14" height="14" aria-hidden="true" class="post-page__drafts-caret" />
        </button>

        <div class="post-page__topbar-spacer" />

        <div class="post-page__kind" role="tablist" aria-label="帖子类型">
          <button
            type="button"
            class="post-page__kind-btn"
            :class="{ 'post-page__kind-btn--active': postKind === 'normal' }"
            role="tab"
            :aria-selected="postKind === 'normal'"
            @click="postKind = 'normal'"
          >
            普通帖
          </button>
          <button
            type="button"
            class="post-page__kind-btn"
            :class="{ 'post-page__kind-btn--active': postKind === 'lottery' }"
            role="tab"
            :aria-selected="postKind === 'lottery'"
            @click="postKind = 'lottery'"
          >
            抽奖帖
          </button>
        </div>

        <button
          type="button"
          class="post-page__ghost"
          title="保存草稿（此后每 20 秒自动保存）"
          @click="saveDraft"
        >
          <Icon icon="tabler:device-floppy" width="16" height="16" aria-hidden="true" />
          <span class="post-page__ghost-text">存草稿</span>
        </button>

        <button
          type="button"
          class="post-page__submit"
          :class="{ 'post-page__submit--busy': submitting }"
          :disabled="submitting"
          @click="submitPost"
        >
          {{ submitting ? '发送中…' : '发送' }}
        </button>
      </header>

      <!-- 草稿下拉面板 -->
      <Transition name="draftdrop" :duration="200">
        <div v-if="draftsOpen" class="post-page__draftdrop-mask" @click="draftsOpen = false">
          <div class="post-page__draftdrop" role="menu" aria-label="草稿箱" @click.stop>
            <div class="post-page__draftdrop-head">
              <span>草稿箱 · 手动保存后每 20 秒自动保存</span>
              <button type="button" class="post-page__draftdrop-act" @click="discardDraft">
                清空当前
              </button>
              <button type="button" class="post-page__draftdrop-act post-page__draftdrop-act--primary" @click="saveDraft">
                保存
              </button>
            </div>
            <div v-if="drafts.length === 0" class="post-page__draftdrop-empty">
              暂无草稿
            </div>
            <ul v-else class="post-page__draftdrop-list">
              <li
                v-for="draft in drafts"
                :key="draft.id"
                class="post-page__draftdrop-item"
                :class="{ 'post-page__draftdrop-item--active': draft.id === current.id }"
              >
                <button
                  type="button"
                  class="post-page__draftdrop-load"
                  @click="loadDraft(draft.id!); draftsOpen = false"
                >
                  <span class="post-page__draftdrop-name">{{ draft.title || '无标题' }}</span>
                  <span class="post-page__draftdrop-snippet">
                    {{ draft.content.slice(0, 48) }}{{ draft.content.length > 48 ? '…' : '' }}
                  </span>
                </button>
                <button
                  type="button"
                  class="post-page__draftdrop-remove"
                  aria-label="删除草稿"
                  @click.stop="removeDraft(draft.id!)"
                >
                  <Icon icon="tabler:trash" width="15" height="15" aria-hidden="true" />
                </button>
              </li>
            </ul>
          </div>
        </div>
      </Transition>

      <!-- 元数据一行：分区 / 课程标签 / 选项 chips -->
      <div class="post-page__meta">
        <select v-model="partition" class="post-page__select" aria-label="分区">
          <option v-for="(p, index) in partitions" :key="index" :value="p">
            {{ p }}
          </option>
        </select>

        <select v-if="partition === '课程专区'" v-model="teacher" class="post-page__select" aria-label="课程标签">
          <option v-for="t in teachers" :key="t.TagID" :value="t.Name">
            {{ t.Name }}
          </option>
        </select>

        <button
          type="button"
          class="post-page__chip"
          :class="{ 'post-page__chip--on': postPrivate }"
          :aria-pressed="postPrivate"
          title="发帖后也可在帖子卡片上修改"
          @click="postPrivate = !postPrivate"
        >
          <Icon icon="tabler:lock" width="14" height="14" aria-hidden="true" />
          <span class="post-page__chip-full">仅自己可见</span>
          <span class="post-page__chip-short">私密</span>
        </button>

        <button
          type="button"
          class="post-page__chip"
          :class="{ 'post-page__chip--on': postAnonymous }"
          :aria-pressed="postAnonymous"
          title="隐藏我的昵称、头像与等级"
          @click="postAnonymous = !postAnonymous"
        >
          <Icon icon="tabler:user-secret" width="14" height="14" aria-hidden="true" />
          匿名
        </button>

        <button
          v-if="partition === '主页'"
          type="button"
          class="post-page__chip"
          :class="{ 'post-page__chip--on': postPinned }"
          :aria-pressed="postPinned"
          title="同时置顶 1 小时（每人仅 1 个置顶帖，全站共 5 个名额）"
          @click="postPinned = !postPinned"
        >
          <Icon icon="tabler:pinned" width="14" height="14" aria-hidden="true" />
          <span class="post-page__chip-full">置顶 1 小时</span>
          <span class="post-page__chip-short">置顶</span>
        </button>
      </div>

      <!-- 抽奖配置（限高内滚，不再挤压编辑器） -->
      <div v-if="postKind === 'lottery'" class="post-page__lottery">
        <LotteryConfigPanel
          v-model:mode="lotteryMode"
          v-model:draw-at="lotteryDrawAt"
          v-model:prizes="lotteryPrizes"
          v-model:open="lotteryOpen"
        />
      </div>

      <!-- 文档式标题 -->
      <div class="post-page__title" aria-label="标题">
        <input
          v-model="postTitle"
          type="text"
          class="post-page__title-input"
          placeholder="写一个吸引人的标题…"
          maxlength="30"
        >
        <span class="post-page__title-count" :class="{ 'post-page__title-count--max': titleCount >= 30 }">
          {{ titleCount }}/30
        </span>
      </div>

      <!-- 正文编辑器：占满剩余全部高度 -->
      <div class="post-page__editor">
        <MarkdownEditor
          ref="editorRef"
          v-model="postContent"
          fill
          music-enabled
          placeholder="在这里写下正文…支持 Markdown，图片可粘贴或从工具栏插入"
          :submit-busy="submitting"
          @send="submitPost"
          @insert-music="musicPickerVisible = true"
        />
      </div>
    </article>

    <MusicPickerDialog v-model="musicPickerVisible" @insert="onInsertMusic" />
  </div>
</template>

<style scoped lang="scss">
.post-page {
  --post-radius: 14px;
  --post-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);

  width: 100%;
  max-width: 920px;
  height: 100%;
  min-height: 0;
  flex: 1 1 auto;
  margin: 0 auto;
  padding: 12px 16px 16px;
  box-sizing: border-box;
  color: var(--chat-text);
  display: flex;
  flex-direction: column;
  /* 兜底：极端高度下（抽奖配置拉满奖品）页面本身可滚，绝不裁切内容 */
  overflow-y: auto;
  overscroll-behavior: contain;
}

.post-page__card {
  position: relative;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  flex: 1 1 auto;
  background: var(--chat-bg-highlight);
  border: 1px solid var(--chat-border);
  border-radius: var(--post-radius);
  box-shadow: var(--post-shadow);
  overflow: hidden;
}

/* —— 顶部操作条 —— */
.post-page__topbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--chat-border);
  flex-shrink: 0;
}

.post-page__heading {
  margin: 0;
  font-size: 1.0625rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  white-space: nowrap;
}

.post-page__topbar-spacer {
  flex: 1 1 auto;
}

.post-page__drafts-trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 32px;
  padding: 0 10px;
  font-size: 0.8125rem;
  font-weight: 500;
  font-family: inherit;
  color: var(--chat-text-secondary);
  background: var(--chat-bg-main);
  border: 1px solid var(--chat-border);
  border-radius: 8px;
  cursor: pointer;

  &:hover {
    color: var(--chat-text);
    border-color: var(--chat-accent);
  }

  &--active {
    color: var(--chat-accent);
    border-color: var(--chat-accent);
    background: var(--chat-accent-soft, transparent);
  }
}

.post-page__drafts-badge {
  font-size: 0.6875rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  min-width: 16px;
  padding: 1px 5px;
  border-radius: 999px;
  color: #fff;
  background: var(--chat-text-tips);
}

.post-page__drafts-trigger--active .post-page__drafts-badge {
  background: var(--chat-accent);
}

.post-page__drafts-caret {
  transition: transform 0.18s ease;
}

.post-page__drafts-trigger--active .post-page__drafts-caret {
  transform: rotate(180deg);
}

.post-page__kind {
  display: inline-flex;
  gap: 2px;
  padding: 2px;
  border: 1px solid var(--chat-border);
  border-radius: 8px;
  background: var(--chat-bg-main);
  flex-shrink: 0;
}

.post-page__kind-btn {
  padding: 5px 12px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--chat-text-secondary);
  font-size: 0.8125rem;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  transition:
    background 0.15s,
    color 0.15s;

  &--active {
    background: var(--chat-bg-highlight);
    color: var(--chat-text);
    font-weight: 600;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
  }
}

.post-page__ghost {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 32px;
  padding: 0 12px;
  flex-shrink: 0;
  font-size: 0.8125rem;
  font-weight: 500;
  font-family: inherit;
  color: var(--chat-text-secondary);
  background: transparent;
  border: 1px solid var(--chat-border);
  border-radius: 8px;
  cursor: pointer;

  &:hover {
    color: var(--chat-text);
    border-color: var(--chat-accent);
  }
}

.post-page__submit {
  flex-shrink: 0;
  min-height: 32px;
  padding: 0 18px;
  font-size: 0.875rem;
  font-weight: 600;
  font-family: inherit;
  line-height: 1;
  color: #fff;
  background: var(--chat-accent);
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;

  &:hover:not(:disabled) {
    opacity: 0.92;
  }

  &:active:not(:disabled) {
    transform: scale(0.98);
  }

  &:disabled,
  &--busy {
    opacity: 0.65;
    cursor: wait;
  }
}

/* —— 草稿下拉 —— */
.post-page__draftdrop-mask {
  position: absolute;
  inset: 0;
  z-index: 30;
}

.post-page__draftdrop {
  position: absolute;
  top: 50px;
  left: 14px;
  width: min(360px, calc(100% - 28px));
  max-height: min(56vh, 460px);
  display: flex;
  flex-direction: column;
  background: var(--chat-bg-highlight);
  border: 1px solid var(--chat-border);
  border-radius: 12px;
  box-shadow: 0 12px 36px rgba(2, 6, 23, 0.16);
  overflow: hidden;
}

.post-page__draftdrop-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  font-size: 0.75rem;
  color: var(--chat-text-secondary);
  border-bottom: 1px solid var(--chat-border);
  flex-shrink: 0;

  > span:first-child {
    flex: 1;
    min-width: 0;
  }
}

.post-page__draftdrop-act {
  padding: 4px 10px;
  font-size: 0.75rem;
  font-family: inherit;
  color: var(--chat-text-secondary);
  background: var(--chat-bg-main);
  border: 1px solid var(--chat-border);
  border-radius: 6px;
  cursor: pointer;

  &:hover {
    color: var(--chat-text);
  }

  &--primary {
    color: var(--chat-accent);
    border-color: var(--chat-accent);

    &:hover {
      color: var(--chat-accent);
      opacity: 0.85;
    }
  }
}

.post-page__draftdrop-empty {
  padding: 28px 0;
  text-align: center;
  font-size: 0.8125rem;
  color: var(--chat-text-tips);
}

.post-page__draftdrop-list {
  list-style: none;
  margin: 0;
  padding: 8px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(0, 0, 0, 0.22) transparent;
}

.post-page__draftdrop-item {
  display: flex;
  align-items: stretch;
  gap: 4px;
  margin-bottom: 6px;
  border: 1px solid var(--chat-border);
  border-radius: 10px;
  overflow: hidden;
  background: var(--chat-bg-main);

  &--active {
    border-color: var(--chat-accent);
    box-shadow: 0 0 0 1px var(--chat-accent-soft);
  }

  &:last-child {
    margin-bottom: 0;
  }
}

.post-page__draftdrop-load {
  flex: 1;
  min-width: 0;
  padding: 9px 11px;
  text-align: left;
  background: none;
  border: none;
  cursor: pointer;
  font-family: inherit;
}

.post-page__draftdrop-name {
  display: block;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--chat-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.post-page__draftdrop-snippet {
  display: block;
  margin-top: 2px;
  font-size: 0.75rem;
  line-height: 1.35;
  color: var(--chat-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.post-page__draftdrop-remove {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  color: #dc2626;
  background: none;
  border: none;
  border-left: 1px solid var(--chat-border);
  cursor: pointer;
}

/* —— 元数据一行 —— */
.post-page__meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--chat-border);
  flex-shrink: 0;
}

.post-page__select {
  min-height: 32px;
  max-width: 180px;
  padding: 4px 26px 4px 10px;
  font-size: 0.8125rem;
  font-family: inherit;
  color: var(--chat-text);
  background: var(--chat-bg-main);
  border: 1px solid var(--chat-border);
  border-radius: 8px;
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 8px center;

  &:focus {
    outline: none;
    border-color: var(--chat-accent);
    box-shadow: 0 0 0 2px var(--chat-accent-soft);
  }
}

.post-page__chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 32px;
  padding: 0 11px;
  font-size: 0.8125rem;
  font-weight: 500;
  font-family: inherit;
  color: var(--chat-text-secondary);
  background: var(--chat-bg-main);
  border: 1px solid var(--chat-border);
  border-radius: 999px;
  cursor: pointer;
  transition:
    color 0.15s,
    border-color 0.15s,
    background 0.15s;

  &:hover {
    color: var(--chat-text);
  }

  &--on {
    color: var(--chat-accent);
    border-color: var(--chat-accent);
    background: var(--chat-accent-soft, transparent);
    font-weight: 600;
  }
}

/* —— 抽奖配置：限高内滚 —— */
.post-page__lottery {
  flex-shrink: 0;
  max-height: min(42vh, 400px);
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: rgba(0, 0, 0, 0.22) transparent;
  border-bottom: 1px solid var(--chat-border);
}

/* —— 文档式标题 —— */
.post-page__title {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px 10px;
  border-bottom: 1px solid var(--chat-border);
  flex-shrink: 0;
}

.post-page__title-input {
  flex: 1;
  min-width: 0;
  padding: 4px 0;
  font-size: 1.1875rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  font-family: inherit;
  color: var(--chat-text);
  background: transparent;
  border: none;

  &::placeholder {
    color: var(--chat-text-tips);
    font-weight: 500;
  }

  &:focus {
    outline: none;
  }
}

.post-page__title-count {
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
  color: var(--chat-text-tips);

  &--max {
    color: #dc2626;
    font-weight: 600;
  }
}

/* —— 编辑器占满剩余 —— */
.post-page__editor {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 10px 12px 12px;
}

/* —— 过渡 —— */
.draftdrop-enter-active,
.draftdrop-leave-active {
  transition: opacity 0.18s ease;
}

.draftdrop-enter-active .post-page__draftdrop,
.draftdrop-leave-active .post-page__draftdrop {
  transition: transform 0.18s ease;
}

.draftdrop-enter-from,
.draftdrop-leave-to {
  opacity: 0;

  .post-page__draftdrop {
    transform: translateY(-6px);
  }
}

/* —— 移动端 —— */
@media screen and (max-width: 768px) {
  .post-page {
    padding: 8px 10px calc(10px + env(safe-area-inset-bottom, 0px));
  }

  /* 卡片随内容生长、至少撑满视口：超长时由 .post-page 滚动（.content 在移动端是 overflow:hidden） */
  .post-page__card {
    flex: 0 0 auto;
    min-height: 100%;
  }

  /* 顶栏单行紧凑：藏标题、图标化按钮，绝不换行 */
  .post-page__topbar {
    flex-wrap: nowrap;
    gap: 6px;
    padding: 8px 10px;
  }

  .post-page__heading {
    display: none;
  }

  .post-page__drafts-text {
    display: none;
  }

  .post-page__drafts-trigger {
    padding: 0 8px;
    flex-shrink: 0;
  }

  .post-page__kind {
    flex-shrink: 0;
  }

  .post-page__kind-btn {
    padding: 5px 10px;
  }

  .post-page__ghost {
    padding: 0 9px;
  }

  .post-page__ghost-text {
    display: none;
  }

  .post-page__submit {
    padding: 0 14px;
    flex-shrink: 0;
  }

  .post-page__meta {
    padding: 8px 10px;
    gap: 6px;
    flex-wrap: nowrap;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .post-page__meta::-webkit-scrollbar {
    display: none;
  }

  .post-page__chip {
    flex-shrink: 0;
  }

  .post-page__chip-full {
    display: none;
  }

  .post-page__select {
    max-width: 128px;
    flex-shrink: 0;
  }

  .post-page__draftdrop {
    top: 46px;
    left: 10px;
    width: calc(100% - 20px);
  }

  .post-page__title {
    padding: 10px 12px 8px;
  }

  .post-page__title-input {
    font-size: 1.0625rem;
  }

  .post-page__editor {
    min-height: clamp(240px, 46dvh, 560px);
    padding: 8px 8px 10px;
  }
}
</style>
