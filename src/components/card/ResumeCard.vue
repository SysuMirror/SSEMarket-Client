<script setup lang="ts">
import type { ResumeItem } from '@/api/resume/types'
import { Icon } from '@iconify/vue'
import { computed } from 'vue'

const props = defineProps<{
  resume: ResumeItem
}>()

const emit = defineEmits<{
  viewDetail: [resume: ResumeItem]
}>()

const fileIcon = computed(() => {
  const ext = props.resume.fileExt?.toLowerCase()
  if (ext === 'pdf')
    return 'tabler:file-type-pdf'
  if (ext === 'doc' || ext === 'docx')
    return 'tabler:file-type-doc'
  if (ext === 'jpg' || ext === 'jpeg' || ext === 'png' || ext === 'webp' || ext === 'gif')
    return 'tabler:photo'
  return 'tabler:file-cv'
})

const fileSizeText = computed(() => {
  const kb = props.resume.fileSize / 1024
  if (kb < 1024)
    return `${kb.toFixed(1)} KB`
  return `${(kb / 1024).toFixed(2)} MB`
})

function viewDetail() {
  emit('viewDetail', props.resume)
}
</script>

<template>
  <article class="resume-card" @click="viewDetail">
    <div class="resume-card__icon-wrap">
      <Icon :icon="fileIcon" class="resume-card__icon" width="32" height="32" aria-hidden="true" />
    </div>
    <div class="resume-card__body">
      <h3 class="resume-card__title">
        {{ resume.title }}
        <span v-if="resume.isAnonymous" class="resume-card__badge">匿名</span>
      </h3>
      <p v-if="resume.description" class="resume-card__desc">
        {{ resume.description }}
      </p>
      <div class="resume-card__meta">
        <span>{{ resume.uploader }}</span>
        <span class="resume-card__dot">·</span>
        <span>{{ fileSizeText }}</span>
        <span class="resume-card__dot">·</span>
        <span>{{ resume.downloadNum }} 次下载</span>
      </div>
      <div class="resume-card__footer">
        <span class="resume-card__type">{{ resume.fileExt?.toUpperCase() || '文件' }}</span>
        <span class="resume-card__time">{{ resume.createdAt }}</span>
      </div>
    </div>
  </article>
</template>

<style scoped lang="scss">
.resume-card {
  display: flex;
  gap: 0.85rem;
  padding: 1rem 1.1rem;
  border-radius: 14px;
  border: 1px solid var(--chat-border);
  background: var(--chat-bg-elevated);
  color: var(--chat-text);
  cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;

  &:hover {
    border-color: var(--chat-accent);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
  }
}

.resume-card__icon-wrap {
  flex-shrink: 0;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  background: var(--chat-bg);
}

.resume-card__icon {
  color: var(--chat-accent);
}

.resume-card__body {
  flex: 1;
  min-width: 0;
}

.resume-card__title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.35;
  display: flex;
  align-items: center;
  gap: 0.35rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.resume-card__badge {
  flex-shrink: 0;
  font-size: 0.65rem;
  font-weight: 500;
  padding: 0.1rem 0.35rem;
  border-radius: 4px;
  background: var(--chat-bg);
  color: var(--chat-text-secondary);
  border: 1px solid var(--chat-border);
}

.resume-card__desc {
  margin: 0.35rem 0 0;
  font-size: 0.8125rem;
  color: var(--chat-text-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.resume-card__meta {
  margin-top: 0.5rem;
  font-size: 0.75rem;
  color: var(--chat-text-secondary);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.2rem;
}

.resume-card__dot {
  opacity: 0.6;
}

.resume-card__footer {
  margin-top: 0.45rem;
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  font-size: 0.72rem;
  color: var(--chat-text-secondary);
}

.resume-card__type {
  font-weight: 600;
  letter-spacing: 0.02em;
}
</style>
