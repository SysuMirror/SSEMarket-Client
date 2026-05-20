<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { ref, useTemplateRef } from 'vue'
import { useRouter } from 'vue-router'
import { uploadResume } from '@/api/resume/uploadResume'
import { showMsg } from '@/components/MessageBox'

defineOptions({ name: 'ResumeUploadView' })

const router = useRouter()
const fileInput = useTemplateRef<HTMLInputElement>('fileInput')

const title = ref('')
const description = ref('')
const isAnonymous = ref(false)
const selectedFile = ref<File | null>(null)
const isSubmitting = ref(false)

const allowedExt = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png', '.webp', '.gif']

function triggerFileInput() {
  fileInput.value?.click()
}

function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file)
    return

  const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
  if (!allowedExt.includes(ext)) {
    showMsg('仅支持 PDF、Word、JPG、PNG、WebP、GIF 格式')
    input.value = ''
    return
  }
  if (file.size > 10 * 1024 * 1024) {
    showMsg('文件不能超过 10MB')
    input.value = ''
    return
  }
  selectedFile.value = file
}

function validate(): boolean {
  if (!title.value.trim()) {
    showMsg('请填写简历标题')
    return false
  }
  if (!selectedFile.value) {
    showMsg('请选择要上传的文件')
    return false
  }
  return true
}

async function submit() {
  if (isSubmitting.value || !validate())
    return

  isSubmitting.value = true
  try {
    const result = await uploadResume(
      selectedFile.value!,
      title.value.trim(),
      description.value.trim(),
      isAnonymous.value,
    )
    showMsg(result.msg || '上传成功')
    router.push(`/resume/${result.data.resumeID}`)
  }
  catch (e) {
    showMsg(e instanceof Error ? e.message : '上传失败')
  }
  finally {
    isSubmitting.value = false
  }
}

function goBack() {
  router.push('/resume')
}
</script>

<template>
  <div class="resume-upload-page">
    <header class="resume-upload-page__head">
      <button type="button" class="resume-upload-page__back" @click="goBack">
        <Icon icon="tabler:arrow-left" width="20" height="20" />
      </button>
      <h1 class="resume-upload-page__title">
        上传简历
      </h1>
    </header>

    <form class="resume-upload-page__form" @submit.prevent="submit">
      <label class="resume-upload-page__field">
        <span class="resume-upload-page__label">标题 <em>*</em></span>
        <input v-model="title" type="text" maxlength="50" placeholder="例如：2025 前端实习简历">
      </label>

      <label class="resume-upload-page__field">
        <span class="resume-upload-page__label">简介</span>
        <textarea v-model="description" rows="3" maxlength="500" placeholder="可选：方向、经历摘要等" />
      </label>

      <label class="resume-upload-page__field resume-upload-page__field--row">
        <input v-model="isAnonymous" type="checkbox">
        <span>匿名展示（他人看不到你的用户名）</span>
      </label>

      <div class="resume-upload-page__field">
        <span class="resume-upload-page__label">简历文件 <em>*</em></span>
        <input
          ref="fileInput"
          type="file"
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.gif,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png,image/webp,image/gif"
          class="resume-upload-page__file-input"
          @change="handleFileChange"
        >
        <button type="button" class="resume-upload-page__file-btn" @click="triggerFileInput">
          <Icon icon="tabler:paperclip" width="18" height="18" />
          {{ selectedFile ? selectedFile.name : '选择 PDF / Word / 图片' }}
        </button>
        <p class="resume-upload-page__hint">
          支持 PDF、Word、JPG、PNG、WebP、GIF，单文件不超过 10MB，每人最多 5 份
        </p>
      </div>

      <button type="submit" class="resume-upload-page__submit" :disabled="isSubmitting">
        {{ isSubmitting ? '上传中…' : '确认上传' }}
      </button>
    </form>
  </div>
</template>

<style scoped lang="scss">
.resume-upload-page {
  max-width: 520px;
  margin: 0 auto;
  padding: 0 14px 2rem;
  color: var(--chat-text);
}

.resume-upload-page__head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1.25rem;
}

.resume-upload-page__back {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1px solid var(--chat-border);
  border-radius: 10px;
  background: var(--chat-bg-elevated);
  color: var(--chat-text);
  cursor: pointer;
}

.resume-upload-page__title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
}

.resume-upload-page__form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.resume-upload-page__field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;

  input[type='text'],
  textarea {
    padding: 0.55rem 0.75rem;
    border-radius: 10px;
    border: 1px solid var(--chat-border);
    background: var(--chat-bg-elevated);
    color: var(--chat-text);
    font-size: 0.9rem;
    resize: vertical;
  }

  &--row {
    flex-direction: row;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
  }
}

.resume-upload-page__label em {
  color: #e11;
  font-style: normal;
}

.resume-upload-page__file-input {
  display: none;
}

.resume-upload-page__file-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.55rem 0.9rem;
  border-radius: 10px;
  border: 1px dashed var(--chat-border);
  background: var(--chat-bg);
  color: var(--chat-text);
  font-size: 0.875rem;
  cursor: pointer;
  text-align: left;
  word-break: break-all;
}

.resume-upload-page__hint {
  margin: 0;
  font-size: 0.75rem;
  color: var(--chat-text-secondary);
}

.resume-upload-page__submit {
  margin-top: 0.5rem;
  padding: 0.65rem;
  border: none;
  border-radius: 10px;
  background: var(--chat-accent);
  color: #fff;
  font-size: 1rem;
  cursor: pointer;

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}
</style>
