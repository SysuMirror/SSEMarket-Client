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
import { useUserStore } from '@/store/userStore'

const router = useRouter()
const { userInfo } = useUserStore()
const { current, drafts, addDraft, selectDraft, deleteDraft, updateDraft, syncDrafts } = useDraft()
const partitions = ref([
  '主页',
  '日常吐槽',
  '打听求助',
  '学习交流',
  '院务',
  '课程专区',
  '求职招募',
  '其他',
  '打分',
])
const postContent = ref('')
const title = useTemplateRef('title')
const partition = ref('主页')

const teachers = ref<Tag[]>([])
const teacher = ref('')

const draftsOpen = ref(false)

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
  if (!title.value)
    return
  let postTitle = title.value.value
  const content = postContent.value
  const postPartition = partition.value

  postTitle = postTitle.replace(/(^\s*)|(\s*$)/g, '')

  if (!postTitle || !content) {
    showMsg('请填写完整信息')
    return
  }
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
    <div class="post-page__grid">
      <section class="post-page__compose" aria-label="发帖内容">
        <header class="post-page__head">
          <h1 class="post-page__title">
            发帖
          </h1>
          <p class="post-page__hint">
            填写标题与正文，支持 Markdown
          </p>
        </header>

        <label class="post-page__field">
          <span class="post-page__label">标题</span>
          <input
            ref="title"
            type="text"
            class="post-page__input"
            placeholder="请输入标题"
            maxlength="20"
          >
        </label>

        <div class="post-page__field-row">
          <label class="post-page__field post-page__field--grow">
            <span class="post-page__label">分区</span>
            <select v-model="partition" class="post-page__select">
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
            class="post-page__field post-page__field--grow"
          >
            <span class="post-page__label">课程标签</span>
            <select v-model="teacher" class="post-page__select">
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

        <div class="post-page__editor">
          <span class="post-page__label post-page__label--editor">正文</span>
          <div class="post-page__editor-box">
            <MarkdownEditor
              v-model="postContent"
              fill
              @send="submitPost"
            />
          </div>
        </div>
      </section>

      <aside class="post-page__aside" aria-label="草稿">
        <div
          class="post-page__drafts-sheet"
          :class="{ 'post-page__drafts-sheet--open': draftsOpen }"
        >
          <div
            id="post-drafts-expand"
            class="post-page__drafts-expand"
          >
            <div class="post-page__drafts-expand-inner">
              <p class="post-page__drafts-tip">
                手动保存一次后，每 20 秒自动保存
              </p>
              <div class="post-page__drafts-actions">
            <button type="button" class="post-page__btn" @click="discardDraft">
              不用草稿
            </button>
            <button type="button" class="post-page__btn" @click="autoSaveDraft">
              更新
            </button>
            <button type="button" class="post-page__btn post-page__btn--primary" @click="saveDraft">
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
                <span class="post-page__draft-title">{{ draft.title || '无标题' }}</span>
                <span class="post-page__draft-preview">{{ draft.content.slice(0, 40) }}{{ draft.content.length > 40 ? '…' : '' }}</span>
              </button>
              <button
                type="button"
                class="post-page__draft-delete"
                aria-label="删除草稿"
                @click.stop="removeDraft(draft.id!)"
              >
                删除
              </button>
            </li>
          </ul>
            </div>
          </div>

          <button
            type="button"
            class="post-page__drafts-handle"
            :aria-expanded="draftsOpen"
            aria-controls="post-drafts-expand"
            @click="draftsOpen = !draftsOpen"
          >
            <span class="post-page__drafts-handle-label">草稿箱</span>
            <span class="post-page__drafts-count">{{ drafts.length }}</span>
            <Icon
              icon="tabler:chevron-up"
              class="post-page__drafts-chevron"
              width="18"
              height="18"
              aria-hidden="true"
            />
          </button>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped lang="scss">
.post-page {
  width: 100%;
  max-width: 960px;
  height: 100%;
  margin: 0 auto;
  padding: 10px 14px 1.25rem;
  box-sizing: border-box;
  color: var(--chat-text);
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.post-page__grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 260px;
  gap: 16px;
  align-items: stretch;
  flex: 1 1 auto;
  min-height: 0;
}

.post-page__compose {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  min-height: min(72dvh, calc(100dvh - 11rem));
}

.post-page__head {
  flex-shrink: 0;
}

.post-page__title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--chat-text);
}

.post-page__hint {
  margin: 4px 0 0;
  font-size: 0.8125rem;
  color: var(--chat-text-secondary);
}

.post-page__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex-shrink: 0;
}

.post-page__field-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  flex-shrink: 0;
}

.post-page__field--grow {
  flex: 1 1 140px;
  min-width: 0;
}

.post-page__label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--chat-text-tips);
  letter-spacing: 0.03em;

  &--editor {
    flex-shrink: 0;
  }
}

.post-page__input,
.post-page__select {
  width: 100%;
  min-height: 40px;
  padding: 8px 12px;
  font-size: 0.9375rem;
  font-family: inherit;
  color: var(--chat-text);
  background: var(--chat-bg-highlight);
  border: 1px solid var(--chat-border);
  border-radius: 10px;
  box-sizing: border-box;
  transition: border-color 0.15s ease;

  &:focus {
    outline: none;
    border-color: var(--chat-accent);
  }
}

.post-page__editor {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 0;
}

.post-page__editor-box {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  min-height: 280px;
  padding: 10px;
  background: var(--chat-bg-highlight);
  border: 1px solid var(--chat-border);
  border-radius: 12px;
  box-sizing: border-box;
}

.post-page__aside {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

/* 草稿箱一体：底部拉手，点击后内容向上展开 */
.post-page__drafts-sheet {
  display: flex;
  flex-direction: column-reverse;
  background: var(--chat-bg-highlight);
  border: 1px solid var(--chat-border);
  border-radius: 12px;
  overflow: hidden;
  box-sizing: border-box;
}

.post-page__drafts-handle {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 12px 14px;
  font-family: inherit;
  color: var(--chat-text);
  background: var(--chat-bg-highlight);
  border: none;
  cursor: pointer;
  flex-shrink: 0;
  -webkit-tap-highlight-color: transparent;
}

.post-page__drafts-handle-label {
  flex: 1;
  text-align: left;
  font-size: 0.9375rem;
  font-weight: 600;
}

.post-page__drafts-count {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--chat-text-secondary);
  padding: 2px 8px;
  background: var(--chat-bg-main);
  border-radius: 999px;
}

.post-page__drafts-chevron {
  flex-shrink: 0;
  color: var(--chat-text-tips);
  transition: transform 0.26s cubic-bezier(0.4, 0, 0.2, 1);
}

.post-page__drafts-sheet--open .post-page__drafts-chevron {
  transform: rotate(180deg);
}

.post-page__drafts-expand {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.28s cubic-bezier(0.4, 0, 0.2, 1);
}

.post-page__drafts-sheet--open .post-page__drafts-expand {
  grid-template-rows: 1fr;
}

.post-page__drafts-expand-inner {
  overflow: hidden;
  min-height: 0;
  padding: 0 12px;
}

.post-page__drafts-sheet--open .post-page__drafts-expand-inner {
  padding: 12px 12px 4px;
  border-bottom: 1px solid var(--chat-border);
  overflow-y: auto;
  max-height: min(40dvh, 360px);
}

.post-page__drafts-tip {
  margin: 0 0 10px;
  font-size: 0.75rem;
  line-height: 1.45;
  color: var(--chat-text-secondary);
}

.post-page__drafts-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
}

.post-page__btn {
  flex: 1 1 auto;
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

  &--primary {
    color: var(--chat-bg-highlight);
    background: var(--chat-accent);
    border-color: var(--chat-accent);
    font-weight: 600;
  }
}

.post-page__drafts-empty {
  padding: 1rem 0;
  text-align: center;
  font-size: 0.875rem;
  color: var(--chat-text-tips);
}

.post-page__draft-list {
  list-style: none;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
  max-height: calc(100dvh - 14rem);
}

.post-page__draft-item {
  display: flex;
  align-items: stretch;
  gap: 6px;
  margin-bottom: 8px;
  border: 1px solid var(--chat-border);
  border-radius: 8px;
  overflow: hidden;
  background: var(--chat-bg-elevated);

  &--active {
    border-color: var(--chat-accent);
    box-shadow: 0 0 0 1px var(--chat-accent-soft);
  }
}

.post-page__draft-load {
  flex: 1;
  min-width: 0;
  padding: 8px 10px;
  text-align: left;
  background: none;
  border: none;
  cursor: pointer;
  font-family: inherit;
}

.post-page__draft-title {
  display: block;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--chat-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.post-page__draft-preview {
  display: block;
  margin-top: 2px;
  font-size: 0.75rem;
  color: var(--chat-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.post-page__draft-delete {
  flex-shrink: 0;
  white-space: nowrap;
  padding: 0 10px;
  font-size: 0.75rem;
  color: #dc2626;
  background: none;
  border: none;
  border-left: 1px solid var(--chat-border);
  cursor: pointer;
  font-family: inherit;
}

@media screen and (min-width: 769px) {
  .post-page__aside {
    position: sticky;
    top: 8px;
    align-self: start;
    max-height: calc(100dvh - 8rem);
  }

  .post-page__drafts-sheet {
    flex-direction: column;
    max-height: calc(100dvh - 8rem);
  }

  .post-page__drafts-handle {
    border-bottom: 1px solid var(--chat-border);
    cursor: default;
  }

  .post-page__drafts-chevron {
    display: none;
  }

  .post-page__drafts-expand {
    grid-template-rows: 1fr;
    flex: 1;
    min-height: 0;
  }

  .post-page__drafts-expand-inner {
    max-height: none;
    flex: 1;
    padding: 12px;
    border-bottom: none;
    overflow-y: auto;
  }

  .post-page__draft-list {
    max-height: none;
  }
}

@media screen and (max-width: 768px) {
  .post-page {
    padding: 8px 12px 1rem;
  }

  .post-page__grid {
    grid-template-columns: 1fr;
    gap: 10px;
  }

  .post-page__compose {
    min-height: 0;
  }

  .post-page__editor-box {
    min-height: min(52dvh, 420px);
  }

  .post-page__drafts-sheet--open .post-page__drafts-expand-inner {
    max-height: min(36dvh, 320px);
  }

  .post-page__draft-list {
    max-height: 24dvh;
  }

  /* 移动端：先编辑区，草稿一体面板在下方 */
  .post-page__grid {
    display: flex;
    flex-direction: column;
  }

  .post-page__aside {
    order: 2;
  }

  .post-page__compose {
    order: 1;
  }
}
</style>
