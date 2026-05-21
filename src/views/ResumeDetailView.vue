<script setup lang="ts">
import type { ResumeItem } from '@/api/resume/types'
import { Icon } from '@iconify/vue'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { deleteResume } from '@/api/resume/deleteResume'
import { downloadResume } from '@/api/resume/downloadResume'
import { getResumeDetail } from '@/api/resume/getResumeDetail'
import { updateResume } from '@/api/resume/updateResume'
import { isResumeImageExt, isWeChatBrowser } from '@/api/resume/previewResume'
import ResumeImagePreview from '@/components/ResumeImagePreview.vue'
import ResumePdfPreview from '@/components/ResumePdfPreview.vue'
import { showMsg } from '@/components/MessageBox'

defineOptions({ name: 'ResumeDetailView' })

const route = useRoute()
const router = useRouter()

const resume = ref<ResumeItem | null>(null)
const isLoading = ref(true)
const isDownloading = ref(false)
const isDeleting = ref(false)
const isEditing = ref(false)
const isSaving = ref(false)
const editTitle = ref('')
const editDescription = ref('')
const previewActive = ref(false)

const resumeID = computed(() => Number(route.params.id))
const isOwner = computed(() => !!resume.value?.isOwner)
const canPreview = computed(() => !!resume.value?.canPreview)
const isPdf = computed(() => resume.value?.fileExt?.toLowerCase() === 'pdf')
const isImage = computed(() => isResumeImageExt(resume.value?.fileExt))
const inWeChat = isWeChatBrowser()

const fileIcon = computed(() => {
  const ext = resume.value?.fileExt?.toLowerCase()
  if (ext === 'pdf')
    return 'tabler:file-type-pdf'
  if (ext === 'doc' || ext === 'docx')
    return 'tabler:file-type-doc'
  if (isResumeImageExt(ext))
    return 'tabler:photo'
  return 'tabler:file-cv'
})

const fileSizeText = computed(() => {
  if (!resume.value)
    return ''
  const kb = resume.value.fileSize / 1024
  if (kb < 1024)
    return `${kb.toFixed(1)} KB`
  return `${(kb / 1024).toFixed(2)} MB`
})

const fileTypeLabel = computed(() => {
  const ext = resume.value?.fileExt?.toUpperCase()
  if (ext === 'PDF')
    return 'PDF'
  if (ext === 'DOC' || ext === 'DOCX')
    return 'Word'
  if (ext === 'JPG' || ext === 'JPEG')
    return '图片'
  if (ext === 'PNG' || ext === 'WEBP' || ext === 'GIF')
    return '图片'
  return ext || '文件'
})

const previewIdleHint = computed(() => {
  if (isPdf.value)
    return '点击「预览」查看 PDF'
  if (isImage.value)
    return '点击「预览」查看图片'
  return '点击「预览」查看'
})

async function fetchDetail() {
  isLoading.value = true
  previewActive.value = false
  isEditing.value = false
  resume.value = await getResumeDetail(resumeID.value)
  isLoading.value = false
  if (!resume.value)
    showMsg('简历不存在或已删除')
}

function startEdit() {
  if (!resume.value || !isOwner.value)
    return
  editTitle.value = resume.value.title
  editDescription.value = resume.value.description || ''
  isEditing.value = true
}

function cancelEdit() {
  isEditing.value = false
}

async function handleSaveEdit() {
  if (!resume.value || isSaving.value)
    return
  const title = editTitle.value.trim()
  if (!title) {
    showMsg('请填写标题')
    return
  }
  isSaving.value = true
  try {
    const updated = await updateResume(
      resume.value.resumeID,
      title,
      editDescription.value.trim(),
    )
    if (!updated) {
      showMsg('保存失败')
      return
    }
    resume.value = updated
    isEditing.value = false
    showMsg('已保存')
  }
  finally {
    isSaving.value = false
  }
}

function startPreview() {
  if (!resume.value?.canPreview)
    return
  previewActive.value = true
}

async function handleDownload() {
  if (!resume.value || isDownloading.value)
    return
  if (!window.confirm('确定要下载这份简历吗？'))
    return
  isDownloading.value = true
  try {
    const data = await downloadResume(resume.value.resumeID)
    if (!data?.downloadURL) {
      showMsg('获取下载链接失败')
      return
    }
    if (inWeChat) {
      window.location.href = data.downloadURL
    }
    else {
      const link = document.createElement('a')
      link.href = data.downloadURL
      link.target = '_blank'
      link.rel = 'noopener noreferrer'
      link.download = data.fileName || '简历'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
    if (resume.value)
      resume.value.downloadNum += 1
  }
  finally {
    isDownloading.value = false
  }
}

async function handleDelete() {
  if (!resume.value || !isOwner.value || isDeleting.value)
    return
  if (!window.confirm('确定删除这份简历吗？'))
    return
  isDeleting.value = true
  try {
    const ok = await deleteResume(resume.value.resumeID)
    if (ok) {
      showMsg('已删除')
      router.push('/resume/my')
    }
    else {
      showMsg('删除失败')
    }
  }
  finally {
    isDeleting.value = false
  }
}

function goBack() {
  router.back()
}

onMounted(fetchDetail)
watch(() => route.params.id, () => {
  if (route.name === 'ResumeDetail')
    fetchDetail()
})
</script>

<template>
  <div class="fr">
    <header class="fr__nav">
      <button type="button" class="fr__nav-back" aria-label="返回" @click="goBack">
        <Icon icon="tabler:chevron-left" width="20" height="20" />
      </button>
      <h1 class="fr__nav-title">
        简历详情
      </h1>
    </header>

    <div v-if="isLoading" class="fr__state-card">
      <div class="fr__state">
        <div class="fr__spinner" />
        <p class="fr__state-text">
          加载中…
        </p>
      </div>
    </div>

    <div v-else-if="!resume" class="fr__state-card">
      <div class="fr__state">
        <div class="fr__state-icon-wrap">
          <Icon icon="tabler:file-off" width="32" height="32" />
        </div>
        <p class="fr__state-title">
          简历不存在或已删除
        </p>
        <p class="fr__state-desc">
          可能已被删除，或你没有访问权限
        </p>
        <button type="button" class="fr__btn fr__btn--secondary fr__btn--state" @click="goBack">
          返回列表
        </button>
      </div>
    </div>

    <div v-else class="fr__layout">
      <!-- 信息 + 操作：单卡片 -->
      <aside class="fr__panel">
        <div class="fr__hero">
          <div class="fr__file-icon" :class="`fr__file-icon--${resume.fileExt || 'file'}`">
            <Icon :icon="fileIcon" width="26" height="26" />
          </div>
          <div class="fr__hero-body">
            <template v-if="isEditing">
              <div class="fr__edit">
                <label class="fr__edit-field">
                  <span class="fr__edit-label">标题</span>
                  <input
                    v-model="editTitle"
                    type="text"
                    class="fr__edit-input"
                    maxlength="50"
                    placeholder="简历标题"
                  >
                </label>
                <label class="fr__edit-field">
                  <span class="fr__edit-label">简介</span>
                  <textarea
                    v-model="editDescription"
                    class="fr__edit-textarea"
                    rows="3"
                    maxlength="500"
                    placeholder="可选：方向、经历摘要等"
                  />
                </label>
                <div class="fr__edit-actions">
                  <button
                    type="button"
                    class="fr__btn fr__btn--primary"
                    :disabled="isSaving"
                    @click="handleSaveEdit"
                  >
                    <Icon icon="tabler:device-floppy" width="17" height="17" />
                    <span>{{ isSaving ? '保存中…' : '保存' }}</span>
                  </button>
                  <button
                    type="button"
                    class="fr__btn fr__btn--secondary"
                    :disabled="isSaving"
                    @click="cancelEdit"
                  >
                    取消
                  </button>
                </div>
              </div>
            </template>
            <template v-else>
              <h2 class="fr__title">
                {{ resume.title }}
              </h2>
              <div class="fr__chips">
                <span v-if="resume.isAnonymous" class="fr__chip">匿名</span>
                <span class="fr__chip fr__chip--muted">{{ fileTypeLabel }}</span>
                <span v-if="canPreview" class="fr__chip fr__chip--ok">可预览</span>
              </div>
            </template>
          </div>
        </div>

        <p v-if="!isEditing && resume.description" class="fr__desc">
          {{ resume.description }}
        </p>
        <p v-else-if="!isEditing && !resume.description" class="fr__desc fr__desc--empty">
          暂无简介
        </p>

        <div class="fr__stats">
          <div class="fr__stat">
            <span class="fr__stat-label">上传者</span>
            <span class="fr__stat-value">{{ resume.uploader }}</span>
          </div>
          <div class="fr__stat">
            <span class="fr__stat-label">大小</span>
            <span class="fr__stat-value">{{ fileSizeText }}</span>
          </div>
          <div class="fr__stat">
            <span class="fr__stat-label">浏览</span>
            <span class="fr__stat-value">{{ resume.viewNum }} 次</span>
          </div>
          <div class="fr__stat">
            <span class="fr__stat-label">下载</span>
            <span class="fr__stat-value">{{ resume.downloadNum }} 次</span>
          </div>
          <div class="fr__stat">
            <span class="fr__stat-label">时间</span>
            <span class="fr__stat-value">{{ resume.createdAt }}</span>
          </div>
        </div>

        <div v-if="!isEditing" class="fr__actions">
          <button
            v-if="canPreview"
            type="button"
            class="fr__btn fr__btn--secondary"
            @click="startPreview"
          >
            <Icon icon="tabler:eye" width="17" height="17" />
            <span>{{ previewActive ? '刷新预览' : '预览' }}</span>
          </button>
          <button
            type="button"
            class="fr__btn fr__btn--primary"
            :disabled="isDownloading"
            @click="handleDownload"
          >
            <Icon icon="tabler:download" width="17" height="17" />
            <span>{{ isDownloading ? '…' : '下载' }}</span>
          </button>
          <button
            v-if="isOwner"
            type="button"
            class="fr__btn fr__btn--secondary"
            @click="startEdit"
          >
            <Icon icon="tabler:edit" width="17" height="17" />
            <span>编辑</span>
          </button>
          <button
            v-if="isOwner"
            type="button"
            class="fr__btn fr__btn--ghost"
            :disabled="isDeleting"
            @click="handleDelete"
          >
            <Icon icon="tabler:trash" width="17" height="17" />
            <span>{{ isDeleting ? '…' : '删除' }}</span>
          </button>
        </div>
      </aside>

      <!-- 预览主区 -->
      <main class="fr__preview">
        <div v-if="canPreview" class="fr__preview-body">
          <div v-if="!previewActive" class="fr__preview-empty">
            <Icon icon="tabler:file-search" width="32" height="32" />
            <p>{{ previewIdleHint }}</p>
            <span v-if="inWeChat">页内展示，不会自动下载</span>
          </div>
          <ResumePdfPreview v-else-if="isPdf" :resumeID="resume.resumeID" />
          <ResumeImagePreview v-else-if="isImage" :resumeID="resume.resumeID" />
        </div>
        <div v-else class="fr__preview-empty fr__preview-empty--doc">
          <Icon icon="tabler:file-type-doc" width="32" height="32" />
          <p>该格式请下载后本地打开</p>
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped lang="scss">
/* Fluent + Apple HIG：分组单卡、清晰层级、无悬浮操作条 */
.fr {
  --fr-font: -apple-system, BlinkMacSystemFont, 'Segoe UI Variable', 'Segoe UI', 'PingFang SC', sans-serif;
  --fr-accent: #0078d4;
  --fr-accent-h: #106ebe;
  --fr-ok: #107c10;
  --fr-danger: #d13438;
  --fr-surface: var(--chat-bg-elevated, #fff);
  --fr-stroke: var(--chat-border, rgba(0, 0, 0, 0.08));
  --fr-text: var(--chat-text, #1d1d1f);
  --fr-muted: var(--chat-text-secondary, #6e6e73);
  --fr-radius: 12px;
  --fr-gap: 20px;

  max-width: 1040px;
  margin: 0 auto;
  padding: 0 16px 28px;
  font-family: var(--fr-font);
  font-size: 14px;
  line-height: 1.4;
  color: var(--fr-text);
  -webkit-font-smoothing: antialiased;
}

.fr__nav {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 0 12px;
}

.fr__nav-back {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  margin-left: -8px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--fr-accent);
  cursor: pointer;

  &:active {
    background: rgba(0, 0, 0, 0.06);
  }
}

.fr__nav-title {
  margin: 0;
  font-size: 17px;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.fr__layout {
  display: grid;
  grid-template-columns: minmax(0, 320px) minmax(0, 1fr);
  gap: var(--fr-gap);
  align-items: start;
}

/* 左侧单卡：摘要 + 元数据 + 操作 */
.fr__panel {
  background: var(--fr-surface);
  border: 1px solid var(--fr-stroke);
  border-radius: var(--fr-radius);
  padding: 16px 18px 18px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.fr__hero {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.fr__file-icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 10px;
  background: rgba(0, 120, 212, 0.1);
  color: var(--fr-accent);

  &--pdf {
    background: rgba(209, 52, 56, 0.1);
    color: #d13438;
  }

  &--jpg,
  &--jpeg,
  &--png,
  &--webp,
  &--gif {
    background: rgba(13, 148, 136, 0.12);
    color: #0d9488;
  }
}

.fr__hero-body {
  min-width: 0;
  flex: 1;
}

.fr__title {
  margin: 0 0 6px;
  font-size: 18px;
  font-weight: 600;
  line-height: 1.25;
  letter-spacing: -0.02em;
  word-break: break-word;
}

.fr__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.fr__chip {
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 600;
  line-height: 16px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.06);
  color: var(--fr-muted);

  &--muted {
    background: rgba(0, 120, 212, 0.1);
    color: var(--fr-accent);
  }

  &--ok {
    background: rgba(16, 124, 16, 0.1);
    color: var(--fr-ok);
  }
}

.fr__desc {
  margin: 12px 0 0;
  padding-top: 12px;
  border-top: 1px solid var(--fr-stroke);
  font-size: 14px;
  line-height: 1.5;
  color: var(--fr-muted);

  &--empty {
    font-style: italic;
    opacity: 0.75;
  }
}

.fr__edit {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
}

.fr__edit-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.fr__edit-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--fr-muted);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.fr__edit-input,
.fr__edit-textarea {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--fr-stroke);
  border-radius: 8px;
  background: var(--fr-surface);
  color: var(--fr-text);
  font-family: inherit;
  font-size: 14px;
  box-sizing: border-box;

  &:focus {
    outline: none;
    border-color: var(--fr-accent);
    box-shadow: 0 0 0 2px rgba(0, 120, 212, 0.15);
  }
}

.fr__edit-textarea {
  resize: vertical;
  min-height: 72px;
  line-height: 1.45;
}

.fr__edit-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 4px;
}

.fr__stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px 16px;
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid var(--fr-stroke);
}

.fr__stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;

  &--wide {
    grid-column: 1 / -1;
  }
}

.fr__stat-label {
  font-size: 11px;
  font-weight: 500;
  color: var(--fr-muted);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.fr__stat-value {
  font-size: 14px;
  color: var(--fr-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  &--mono {
    font-size: 13px;
    color: var(--fr-muted);
    white-space: normal;
    word-break: break-all;
  }
}

.fr__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--fr-stroke);
}

.fr__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 36px;
  padding: 0 14px;
  border: none;
  border-radius: 8px;
  font-family: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s ease, background 0.15s ease;

  &--primary {
    flex: 1;
    min-width: 88px;
    background: var(--fr-accent);
    color: #fff;

    &:hover:not(:disabled) {
      background: var(--fr-accent-h);
    }
  }

  &--secondary {
    flex: 1;
    min-width: 72px;
    background: rgba(0, 120, 212, 0.1);
    color: var(--fr-accent);

    &:hover:not(:disabled) {
      background: rgba(0, 120, 212, 0.16);
    }
  }

  &--ghost {
    background: transparent;
    color: var(--fr-danger);

    &:hover:not(:disabled) {
      background: rgba(209, 52, 56, 0.08);
    }
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
}

/* 预览区 */
.fr__preview {
  min-width: 0;
  background: var(--fr-surface);
  border: 1px solid var(--fr-stroke);
  border-radius: var(--fr-radius);
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.fr__preview-body {
  min-height: min(70vh, 560px);
  display: flex;
  flex-direction: column;
}

.fr__preview-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 40px 24px;
  color: var(--fr-muted);
  text-align: center;

  p {
    margin: 4px 0 0;
    font-size: 15px;
    font-weight: 500;
    color: var(--fr-text);
  }

  span {
    font-size: 12px;
  }

  &--doc p {
    font-weight: 400;
    color: var(--fr-muted);
  }
}

.fr__state-card {
  display: flex;
  justify-content: center;
  padding: 8px 0 24px;
}

.fr__state {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  max-width: 360px;
  padding: 28px 24px 24px;
  text-align: center;
  background: var(--fr-surface);
  border: 1px solid var(--fr-stroke);
  border-radius: var(--fr-radius);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.fr__state-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  margin-bottom: 4px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.04);
  color: var(--fr-muted);
}

.fr__state-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--fr-text);
}

.fr__state-desc {
  margin: 6px 0 0;
  font-size: 13px;
  line-height: 1.45;
  color: var(--fr-muted);
}

.fr__state-text {
  margin: 10px 0 0;
  font-size: 14px;
  color: var(--fr-muted);
}

.fr__btn--state {
  margin-top: 18px;
  min-width: 120px;
}

.fr__spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--fr-stroke);
  border-top-color: var(--fr-accent);
  border-radius: 50%;
  animation: fr-spin 0.65s linear infinite;
}

@keyframes fr-spin {
  to {
    transform: rotate(360deg);
  }
}

/* 手机：单列，操作不 sticky */
@media (max-width: 768px) {
  .fr {
    padding: 0 12px 20px;
  }

  .fr__layout {
    grid-template-columns: 1fr;
    gap: 14px;
  }

  .fr__panel {
    padding: 14px 16px 16px;
  }

  .fr__title {
    font-size: 17px;
  }

  .fr__preview-body {
    min-height: min(52vh, 420px);
  }

  .fr__actions .fr__btn--primary,
  .fr__actions .fr__btn--secondary {
    flex: 1 1 calc(50% - 4px);
  }

  .fr__actions .fr__btn--ghost {
    flex: 1 1 100%;
    justify-content: center;
  }
}

@media (min-width: 769px) {
  .fr__nav-back:hover {
    background: rgba(0, 0, 0, 0.05);
  }
}

:global(body.dark-mode) .fr {
  --fr-accent: #4ba0e8;
  --fr-accent-h: #62abf0;
  --fr-ok: #54b054;
}
</style>
