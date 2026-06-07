<!-- eslint-disable vue/html-self-closing -->
<script setup lang="ts">
import type { Tag } from '@/api/info/getTeacher'

import { Icon } from '@iconify/vue'
import { onMounted, onUnmounted, ref, useTemplateRef } from 'vue'
import { useRouter } from 'vue-router'
import { sendPost } from '@/api/editPostAndComment/editPost'

import { getTeachers } from '@/api/info/getTeacher'
import MarkdownEditor from '@/components/MarkdownEditor.vue'
import { showMsg } from '@/components/MessageBox'
import { useDraft } from '@/composables/useDraft'
import { POST_PARTITION_OPTIONS } from '@/constants/partitions'
import { isPostContentTooLong, POST_CONTENT_MAX_RUNES } from '@/constants/contentLimits'
import { useUserStore } from '@/store/userStore'

const router = useRouter()
const { userInfo } = useUserStore()
const { current, drafts, addDraft, selectDraft, deleteDraft, updateDraft, syncDrafts } = useDraft()
const partitions = ref([...POST_PARTITION_OPTIONS])
const postContent = ref('')
const title = useTemplateRef('title')
const partition = ref('主页')

const teachers = ref<Tag[]>([])
const teacher = ref('')

const draftsOpen = ref(false)
const submitting = ref(false)

let autoSaveTimer: number | null = null

async function loadDraft(id: number) {
  selectDraft(id)
  if (title.value)
    title.value.value = current.title
  postContent.value = current.content
}

async function removeDraft(id: number) {
  if (!id)
    return
  await deleteDraft(id)
  showMsg('草稿已删除')
}

async function saveDraft() {
  const draftTitle = title.value?.value || ''
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
  const draftTitle = title.value?.value || ''
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
  if (title.value)
    title.value.value = ''
  postContent.value = ''
}

async function submitPost() {
  if (!title.value || submitting.value)
    return
  let postTitle = title.value.value
  const content = postContent.value
  const postPartition = partition.value

  postTitle = postTitle.replace(/(^\s*)|(\s*$)/g, '')

  if (!postTitle || !content) {
    showMsg('请填写完整信息')
    return
  }
  if (isPostContentTooLong(content)) {
    showMsg(`正文最多 ${POST_CONTENT_MAX_RUNES} 字`)
    return
  }
  submitting.value = true
  try {
    const res = await sendPost(
      content,
      postPartition,
      '',
      teacher.value,
      postTitle,
      userInfo.phone,
    )
    if (!res || typeof res.msg !== 'string') {
      showMsg('发帖失败，请检查网络后重试')
      return
    }
    showMsg(res.msg)
    router.push('/')
  }
  finally {
    submitting.value = false
  }
}

onMounted(async () => {
  if (window.innerWidth >= 769)
    draftsOpen.value = true

  const data = await getTeachers()
  teachers.value = data

  await syncDrafts()

  if (drafts.length > 0) {
    const latestDraft = drafts[drafts.length - 1]
    if (latestDraft.id !== undefined) {
      selectDraft(latestDraft.id)
      if (title.value)
        title.value.value = latestDraft.title
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
  <div class="post-page">
    <div class="post-page__layout">
      <!-- 主编辑区 -->
      <article class="post-page__card" aria-label="发帖内容">
        <header class="post-page__header">
          <div class="post-page__header-text">
            <h1 class="post-page__heading">
              发帖
            </h1>
            <p class="post-page__desc">
              支持 Markdown · 图片可粘贴或从工具栏插入
            </p>
          </div>
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

        <div class="post-page__form">
          <label class="post-page__field post-page__field--title">
            <span class="post-page__field-label">标题</span>
            <input
              ref="title"
              type="text"
              class="post-page__control"
              placeholder="写一个吸引人的标题（最多 30 字）"
              maxlength="30"
            >
          </label>

          <div class="post-page__field-row">
            <label class="post-page__field">
              <span class="post-page__field-label">分区</span>
              <select v-model="partition" class="post-page__control">
                <option
                  v-for="(p, index) in partitions"
                  :key="index"
                  :value="p"
                >
                  {{ p }}
                </option>
              </select>
            </label>
            <label
              v-if="partition === '课程专区'"
              class="post-page__field"
            >
              <span class="post-page__field-label">课程标签</span>
              <select v-model="teacher" class="post-page__control">
                <option
                  v-for="t in teachers"
                  :key="t.TagID"
                  :value="t.Name"
                >
                  {{ t.Name }}
                </option>
              </select>
            </label>
          </div>
        </div>

        <div class="post-page__editor">
          <MarkdownEditor
            v-model="postContent"
            fill
            placeholder="在这里写下正文…"
          />
        </div>
      </article>

      <!-- 草稿箱 -->
      <aside class="post-page__drafts" aria-label="草稿箱">
        <div
          class="post-page__drafts-card"
          :class="{ 'post-page__drafts-card--open': draftsOpen }"
        >
          <button
            type="button"
            class="post-page__drafts-toggle"
            :aria-expanded="draftsOpen"
            aria-controls="post-drafts-body"
            @click="draftsOpen = !draftsOpen"
          >
            <span class="post-page__drafts-toggle-label">
              <Icon icon="tabler:file-text" width="18" height="18" aria-hidden="true" />
              草稿箱
            </span>
            <span class="post-page__drafts-badge">{{ drafts.length }}</span>
            <Icon
              icon="tabler:chevron-down"
              class="post-page__drafts-chevron"
              width="18"
              height="18"
              aria-hidden="true"
            />
          </button>

          <div id="post-drafts-body" class="post-page__drafts-body">
            <p class="post-page__drafts-hint">
              手动保存后，每 20 秒自动保存
            </p>
            <div class="post-page__drafts-actions">
              <button type="button" class="post-page__draft-btn" @click="discardDraft">
                清空
              </button>
              <button type="button" class="post-page__draft-btn" @click="autoSaveDraft">
                更新
              </button>
              <button type="button" class="post-page__draft-btn post-page__draft-btn--primary" @click="saveDraft">
                保存
              </button>
            </div>

            <div v-if="drafts.length === 0" class="post-page__drafts-empty">
              暂无草稿
            </div>
            <ul v-else class="post-page__draft-list">
              <li
                v-for="draft in drafts"
                :key="draft.id"
                class="post-page__draft-item"
                :class="{ 'post-page__draft-item--active': draft.id === current.id }"
              >
                <button
                  type="button"
                  class="post-page__draft-load"
                  @click="loadDraft(draft.id!)"
                >
                  <span class="post-page__draft-name">{{ draft.title || '无标题' }}</span>
                  <span class="post-page__draft-snippet">
                    {{ draft.content.slice(0, 48) }}{{ draft.content.length > 48 ? '…' : '' }}
                  </span>
                </button>
                <button
                  type="button"
                  class="post-page__draft-remove"
                  aria-label="删除草稿"
                  @click.stop="removeDraft(draft.id!)"
                >
                  <Icon icon="tabler:trash" width="16" height="16" aria-hidden="true" />
                </button>
              </li>
            </ul>
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped lang="scss">
.post-page {
  --post-radius: 14px;
  --post-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);

  width: 100%;
  max-width: 1080px;
  height: 100%;
  min-height: 0;
  flex: 1 1 auto;
  margin: 0 auto;
  padding: 12px 16px 16px;
  box-sizing: border-box;
  color: var(--chat-text);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.post-page__layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 288px;
  gap: 16px;
  flex: 1 1 auto;
  min-height: 0;
  align-items: stretch;
}

/* 主卡片 */
.post-page__card {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  background: var(--chat-bg-highlight);
  border: 1px solid var(--chat-border);
  border-radius: var(--post-radius);
  box-shadow: var(--post-shadow);
  overflow: hidden;
}

.post-page__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 18px 12px;
  border-bottom: 1px solid var(--chat-border);
  flex-shrink: 0;
}

.post-page__header-text {
  min-width: 0;
}

.post-page__heading {
  margin: 0;
  font-size: 1.375rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.25;
}

.post-page__desc {
  margin: 4px 0 0;
  font-size: 0.8125rem;
  color: var(--chat-text-secondary);
}

.post-page__submit {
  flex-shrink: 0;
  min-height: 42px;
  padding: 0 24px;
  font-size: 0.9375rem;
  font-weight: 600;
  font-family: inherit;
  line-height: 1;
  color: #fff;
  background: var(--chat-accent);
  border: none;
  border-radius: 999px;
  cursor: pointer;
  transition: opacity 0.15s ease, transform 0.15s ease;

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

.post-page__form {
  padding: 14px 18px 0;
  flex-shrink: 0;
}

.post-page__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;

  &--title {
    margin-bottom: 12px;
  }
}

.post-page__field-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 4px;
}

.post-page__field-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--chat-text-tips);
  letter-spacing: 0.04em;
}

.post-page__control {
  width: 100%;
  min-height: 44px;
  padding: 10px 14px;
  font-size: 0.9375rem;
  font-family: inherit;
  color: var(--chat-text);
  background: var(--chat-bg-main);
  border: 1px solid var(--chat-border);
  border-radius: 10px;
  box-sizing: border-box;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;

  &:focus {
    outline: none;
    border-color: var(--chat-accent);
    box-shadow: 0 0 0 2px var(--chat-accent-soft);
  }
}

.post-page__editor {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 12px 14px 14px;
}

/* 草稿箱 */
.post-page__drafts {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.post-page__drafts-card {
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1 1 auto;
  background: var(--chat-bg-highlight);
  border: 1px solid var(--chat-border);
  border-radius: var(--post-radius);
  box-shadow: var(--post-shadow);
  overflow: hidden;
}

.post-page__drafts-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 14px 16px;
  font-family: inherit;
  color: var(--chat-text);
  background: var(--chat-bg-highlight);
  border: none;
  border-bottom: 1px solid transparent;
  cursor: pointer;
  flex-shrink: 0;
  -webkit-tap-highlight-color: transparent;
}

.post-page__drafts-toggle-label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  font-size: 0.9375rem;
  font-weight: 600;
  text-align: left;
}

.post-page__drafts-badge {
  font-size: 0.75rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  padding: 2px 8px;
  color: var(--chat-text-secondary);
  background: var(--chat-bg-main);
  border-radius: 999px;
}

.post-page__drafts-chevron {
  flex-shrink: 0;
  color: var(--chat-text-tips);
  transition: transform 0.22s ease;
}

.post-page__drafts-body {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  padding: 0 14px 14px;
  overflow: hidden;
}

.post-page__drafts-hint {
  margin: 0 0 10px;
  padding-top: 12px;
  font-size: 0.75rem;
  line-height: 1.45;
  color: var(--chat-text-secondary);
}

.post-page__drafts-actions {
  display: flex;
  gap: 6px;
  margin-bottom: 12px;
  flex-shrink: 0;
}

.post-page__draft-btn {
  flex: 1;
  min-height: 36px;
  padding: 0 8px;
  font-size: 0.8125rem;
  font-weight: 500;
  font-family: inherit;
  color: var(--chat-text-secondary);
  background: var(--chat-bg-main);
  border: 1px solid var(--chat-border);
  border-radius: 8px;
  cursor: pointer;

  &--primary {
    color: #fff;
    background: var(--chat-accent);
    border-color: var(--chat-accent);
    font-weight: 600;
  }
}

.post-page__drafts-empty {
  padding: 24px 0;
  text-align: center;
  font-size: 0.875rem;
  color: var(--chat-text-tips);
}

.post-page__draft-list {
  list-style: none;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  flex: 1 1 auto;
  min-height: 0;
  scrollbar-width: thin;
  scrollbar-color: rgba(0, 0, 0, 0.22) transparent;
}

.post-page__draft-item {
  display: flex;
  align-items: stretch;
  gap: 4px;
  margin-bottom: 8px;
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

.post-page__draft-load {
  flex: 1;
  min-width: 0;
  padding: 10px 12px;
  text-align: left;
  background: none;
  border: none;
  cursor: pointer;
  font-family: inherit;
}

.post-page__draft-name {
  display: block;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--chat-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.post-page__draft-snippet {
  display: block;
  margin-top: 3px;
  font-size: 0.75rem;
  line-height: 1.35;
  color: var(--chat-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.post-page__draft-remove {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  color: #dc2626;
  background: none;
  border: none;
  border-left: 1px solid var(--chat-border);
  cursor: pointer;
}

/* —— 桌面端 —— */
@media screen and (min-width: 769px) {
  .post-page__drafts-toggle {
    cursor: default;
    pointer-events: none;
  }

  .post-page__drafts-chevron {
    display: none;
  }

  .post-page__drafts-card--open .post-page__drafts-toggle,
  .post-page__drafts-toggle {
    border-bottom-color: var(--chat-border);
  }

  .post-page__field-row:has(.post-page__field:only-child) {
    grid-template-columns: 1fr;
  }
}

/* —— 移动端 —— */
@media screen and (max-width: 768px) {
  .post-page {
    padding: 10px 12px calc(8px + env(safe-area-inset-bottom, 0px));
    overflow-y: auto;
  }

  .post-page__layout {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-height: min-content;
  }

  .post-page__card {
    flex: 1 1 auto;
    min-height: 0;
  }

  .post-page__header {
    padding: 14px 14px 10px;
  }

  .post-page__heading {
    font-size: 1.2rem;
  }

  .post-page__form {
    padding: 12px 14px 0;
  }

  .post-page__field-row {
    grid-template-columns: 1fr;
  }

  .post-page__editor {
    min-height: clamp(240px, 42dvh, 520px);
    padding: 10px 12px 12px;
  }

  .post-page__submit {
    min-height: 38px;
    padding: 0 18px;
    font-size: 0.875rem;
  }

  .post-page__drafts {
    flex-shrink: 0;
  }

  .post-page__drafts-card:not(.post-page__drafts-card--open) .post-page__drafts-body {
    display: none;
  }

  .post-page__drafts-card:not(.post-page__drafts-card--open) .post-page__drafts-toggle {
    border-bottom: none;
  }

  .post-page__drafts-card--open .post-page__drafts-chevron {
    transform: rotate(180deg);
  }

  .post-page__drafts-card--open .post-page__drafts-body {
    max-height: min(36dvh, 300px);
  }

  .post-page__draft-list {
    max-height: min(28dvh, 220px);
  }
}
</style>
