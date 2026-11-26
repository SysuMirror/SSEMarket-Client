<script setup lang="ts">
import type { PostDraftPayload, TimelinePostDraft } from '@/composables/useOpsAgentStream'
import { computed, ref } from 'vue'
import { trackEvia } from '@/analytics/evia'
import { submitDraft, uploadDraftImage } from '@/api/post/draft'
import LoadingSpinner from '@/components/LoadingSpinner.vue'
import { showMsg } from '@/components/MessageBox'
import { POST_PARTITION_OPTIONS } from '@/constants/partitions'

const props = defineProps<{
  item: TimelinePostDraft
}>()

const emit = defineEmits<{
  (e: 'update', item: TimelinePostDraft): void
}>()

const type = ref<'post' | 'product'>(props.item.draft.type)
const title = ref(props.item.draft.title)
const content = ref(props.item.draft.content)
const partition = ref(props.item.draft.partition || '')
const tagsInput = ref((props.item.draft.tags || []).join(', '))
const price = ref<number>(props.item.draft.price || 0) // 元（与主站 Price 字段一致）
const isAnonymous = ref(props.item.draft.is_anonymous ?? false)
const isPrivate = ref(props.item.draft.is_private ?? false)
const photos = ref<string[]>([])
const photoFiles = ref<File[]>([])
const submitting = ref(false)
// 逐张传图进度：按钮显示「传图 i/N」，失败张数会中止发帖
const uploadingPhotoCount = ref(0)
const errorMsg = ref('')
const successUrl = ref('')

const photoInput = ref<HTMLInputElement | null>(null)

const isProduct = computed(() => type.value === 'product')
const isDone = computed(() => props.item.status === 'success')

// 正文里的 markdown 配图实时提取成正经缩略图（2026-11-01 手机端"满屏裸 URL 很丑"）：
// 草稿卡只读预览、发帖时仍随正文原样带走，点开看大图
const contentImages = computed(() => {
  const urls: string[] = []
  const re = /!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(content.value))) {
    if (!urls.includes(m[1]))
      urls.push(m[1])
  }
  return urls
})

function openImage(url: string) {
  window.open(url, '_blank', 'noopener')
}

function patch(partial: Partial<TimelinePostDraft>) {
  emit('update', { ...props.item, ...partial })
}

function buildDraft(): PostDraftPayload {
  const tags = tagsInput.value
    .split(',')
    .map(s => s.trim())
    .filter(s => s.length > 0)
  return {
    type: type.value,
    title: title.value.trim(),
    content: content.value,
    partition: isProduct.value ? undefined : partition.value.trim(),
    tags: isProduct.value ? undefined : tags,
    price: isProduct.value ? Math.round(price.value) : undefined,
    is_anonymous: isProduct.value ? isAnonymous.value : undefined,
    is_private: isProduct.value ? undefined : isPrivate.value,
  }
}

function onPhotosSelected(e: Event) {
  const input = e.target as HTMLInputElement
  if (!input.files)
    return
  const files = Array.from(input.files)
  photoFiles.value = [...photoFiles.value, ...files]
  for (const f of files) {
    const url = URL.createObjectURL(f)
    photos.value = [...photos.value, url]
  }
  input.value = ''
}

function removePhoto(idx: number) {
  photos.value = photos.value.filter((_, i) => i !== idx)
  photoFiles.value = photoFiles.value.filter((_, i) => i !== idx)
}

async function handleConfirm() {
  if (submitting.value)
    return
  if (!title.value.trim()) {
    errorMsg.value = '标题不能为空'
    return
  }
  if (!content.value.trim()) {
    errorMsg.value = '正文不能为空'
    return
  }
  if (!isProduct.value && !partition.value.trim()) {
    errorMsg.value = '分区不能为空'
    return
  }
  if (isProduct.value && (!price.value || price.value <= 0)) {
    errorMsg.value = '价格必须大于 0'
    return
  }

  submitting.value = true
  errorMsg.value = ''
  patch({ status: 'submitting', error: undefined })

  try {
    const uploadedUrls: string[] = []
    let failedCount = 0
    for (let i = 0; i < photoFiles.value.length; ++i) {
      uploadingPhotoCount.value = i + 1
      const url = await uploadDraftImage(photoFiles.value[i])
      if (url)
        uploadedUrls.push(url)
      else
        failedCount += 1
    }
    // 图片上传失败不再静默丢弃：中止发帖并明确告知，让用户重试
    if (failedCount > 0) {
      errorMsg.value = `有 ${failedCount} 张图片上传失败，已取消发帖，请重新提交`
      patch({ status: 'error', error: errorMsg.value })
      return
    }

    const result = await submitDraft(buildDraft(), uploadedUrls)
    if (result.ok) {
      successUrl.value = result.url || ''
      trackEvia('ai_draft_interacted', {
        draft_type: type.value,
        action: 'published',
      })
      patch({
        status: 'success',
        result: {
          post_id: result.postId,
          product_id: result.productId,
          url: result.url,
        },
      })
      showMsg('发帖成功')
    }
    else {
      errorMsg.value = result.error || '发帖失败'
      patch({ status: 'error', error: result.error })
    }
  }
  catch (e) {
    errorMsg.value = (e as Error).message
    patch({ status: 'error', error: errorMsg.value })
  }
  finally {
    submitting.value = false
    uploadingPhotoCount.value = 0
  }
}

function handleCancel() {
  trackEvia('ai_draft_interacted', {
    draft_type: type.value,
    action: 'dismissed',
  })
  patch({ status: 'error', error: '已取消' })
}
</script>

<template>
  <div class="draft-card" :class="[`draft-card--${type}`, `draft-card--${props.item.status}`]">
    <header class="draft-card__head">
      <span class="draft-card__badge">{{ isProduct ? '商城商品' : '普通帖子' }}</span>
      <span class="draft-card__title">发帖草稿</span>
      <span v-if="props.item.status === 'submitting'" class="draft-card__status"><LoadingSpinner :size="13" style="margin-right: 4px;" />{{ photoFiles.length ? `传图 ${uploadingPhotoCount}/${photoFiles.length}…` : '提交中…' }}</span>
      <span v-else-if="props.item.status === 'success'" class="draft-card__status draft-card__status--ok">已发布</span>
      <span v-else-if="props.item.status === 'error'" class="draft-card__status draft-card__status--err">失败</span>
    </header>

    <div v-if="!isDone" class="draft-card__body">
      <div class="draft-field">
        <label class="draft-field__label">类型</label>
        <select v-model="type" class="draft-field__input" :disabled="submitting">
          <option value="post">
            普通帖子
          </option>
          <option value="product">
            商城商品
          </option>
        </select>
      </div>

      <div class="draft-field">
        <label class="draft-field__label">标题</label>
        <input
          v-model="title"
          type="text"
          class="draft-field__input"
          :maxlength="30"
          :disabled="submitting"
          placeholder="标题（1-30 字）"
        >
      </div>

      <div class="draft-field">
        <label class="draft-field__label">正文</label>
        <textarea
          v-model="content"
          class="draft-field__input draft-field__input--textarea"
          :maxlength="10000"
          :disabled="submitting"
          rows="5"
          placeholder="正文（1-10000 字）"
        />
        <div v-if="contentImages.length" class="draft-content-imgs">
          <span class="draft-content-imgs__hint">正文配图 {{ contentImages.length }} 张</span>
          <div class="draft-content-imgs__row">
            <img
              v-for="u in contentImages"
              :key="u"
              :src="u"
              alt=""
              loading="lazy"
              @click="openImage(u)"
            >
          </div>
        </div>
      </div>

      <template v-if="!isProduct">
        <div class="draft-field">
          <label class="draft-field__label">分区</label>
          <select v-model="partition" class="draft-field__input" :disabled="submitting">
            <option value="" disabled>
              请选择分区
            </option>
            <option v-for="p in POST_PARTITION_OPTIONS" :key="p" :value="p">
              {{ p }}
            </option>
          </select>
        </div>

        <div class="draft-field">
          <label class="draft-field__label">标签</label>
          <input
            v-model="tagsInput"
            type="text"
            class="draft-field__input"
            :disabled="submitting"
            placeholder="多个标签用英文逗号分隔"
          >
        </div>

        <label class="draft-checkbox">
          <input v-model="isPrivate" type="checkbox" :disabled="submitting">
          <span>仅自己可见</span>
        </label>
      </template>

      <template v-else>
        <div class="draft-field">
          <label class="draft-field__label">价格（元）</label>
          <input
            v-model.number="price"
            type="number"
            min="0.01"
            step="0.01"
            class="draft-field__input"
            :disabled="submitting"
            placeholder="如 50.00"
          >
        </div>

        <label class="draft-checkbox">
          <input v-model="isAnonymous" type="checkbox" :disabled="submitting">
          <span>匿名发布</span>
        </label>
      </template>

      <div class="draft-field">
        <label class="draft-field__label">图片</label>
        <div class="draft-photos">
          <div v-for="(url, i) in photos" :key="i" class="draft-photo">
            <img :src="url" alt="">
            <button v-if="!submitting" type="button" class="draft-photo__remove" @click="removePhoto(i)">
              ×
            </button>
          </div>
          <button
            v-if="!submitting"
            type="button"
            class="draft-photo__add"
            @click="photoInput?.click()"
          >
            + 上传
          </button>
          <input
            ref="photoInput"
            type="file"
            accept="image/*"
            multiple
            hidden
            @change="onPhotosSelected"
          >
        </div>
      </div>

      <p v-if="errorMsg" class="draft-card__error">
        {{ errorMsg }}
      </p>

      <div class="draft-card__actions">
        <button type="button" class="draft-btn draft-btn--cancel" :disabled="submitting" @click="handleCancel">
          取消
        </button>
        <button type="button" class="draft-btn draft-btn--confirm" :disabled="submitting" @click="handleConfirm">
          <LoadingSpinner v-if="submitting" :size="14" style="margin-right: 5px;" />
          {{ submitting ? '提交中…' : '确认发帖' }}
        </button>
      </div>
    </div>

    <div v-else class="draft-card__success">
      <p>已发布成功！</p>
      <RouterLink v-if="successUrl" :to="successUrl" class="draft-card__link">
        查看帖子 →
      </RouterLink>
    </div>
  </div>
</template>

<style scoped>
.draft-card {
  width: 100%;
  max-width: var(--xq-bubble-max, 640px);
  border-radius: 12px;
  border: 1px solid var(--xq-border, #e2e8f0);
  background: var(--xq-surface, #fff);
  overflow: hidden;
  font-size: 14px;
  color: var(--xq-text, #1e293b);
}

.draft-card__head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: var(--xq-step-bg, #f8fafc);
  border-bottom: 1px solid var(--xq-border, #e2e8f0);
}

.draft-card__badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--xq-accent-soft, #ede9fe);
  color: var(--xq-accent-deep, #6d28d9);
  font-weight: 600;
}

.draft-card--product .draft-card__badge {
  background: #fef3c7;
  color: #92400e;
}

.draft-card__title {
  font-weight: 600;
  font-size: 13px;
}

.draft-card__status {
  margin-left: auto;
  font-size: 11px;
  color: var(--xq-text-muted, #94a3b8);
}

.draft-card__status--ok {
  color: #16a34a;
}

.draft-card__status--err {
  color: #dc2626;
}

.draft-card__body {
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.draft-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.draft-field__label {
  font-size: 12px;
  color: var(--xq-text-secondary, #475569);
  font-weight: 500;
}

.draft-field__input {
  padding: 8px 10px;
  border: 1px solid var(--xq-border, #e2e8f0);
  border-radius: 8px;
  background: var(--xq-surface, #fff);
  font: inherit;
  color: inherit;
}

.draft-field__input:focus {
  outline: none;
  border-color: var(--xq-accent, #8b5cf6);
  box-shadow: 0 0 0 3px var(--xq-accent-ring, rgba(139, 92, 246, 0.15));
}

.draft-field__input--textarea {
  resize: vertical;
  min-height: 80px;
  font-family: inherit;
  overflow-wrap: anywhere;
}

.draft-content-imgs {
  margin-top: 6px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.draft-content-imgs__hint {
  font-size: 12px;
  color: var(--xq-text-muted, #94a3b8);
}

.draft-content-imgs__row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.draft-content-imgs__row img {
  width: 72px;
  height: 72px;
  object-fit: cover;
  border-radius: 8px;
  border: 1px solid var(--xq-border, #e2e8f0);
  cursor: zoom-in;
  background: #0f172a08;
}

.draft-checkbox {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  cursor: pointer;
}

.draft-photos {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.draft-photo {
  position: relative;
  width: 64px;
  height: 64px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--xq-border, #e2e8f0);
}

.draft-photo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.draft-photo__remove {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  border: none;
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
}

.draft-photo__add {
  width: 64px;
  height: 64px;
  border-radius: 8px;
  border: 1px dashed var(--xq-border, #cbd5e1);
  background: transparent;
  color: var(--xq-text-muted, #94a3b8);
  font-size: 12px;
  cursor: pointer;
}

.draft-photo__add:hover {
  border-color: var(--xq-accent, #8b5cf6);
  color: var(--xq-accent, #8b5cf6);
}

.draft-card__error {
  margin: 0;
  padding: 8px 10px;
  border-radius: 8px;
  background: #fef2f2;
  color: #b91c1c;
  font-size: 12px;
}

.draft-card__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 4px;
}

.draft-btn {
  padding: 8px 16px;
  border-radius: 8px;
  border: none;
  font: inherit;
  font-weight: 500;
  cursor: pointer;
}

.draft-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.draft-btn--cancel {
  background: transparent;
  color: var(--xq-text-secondary, #64748b);
  border: 1px solid var(--xq-border, #e2e8f0);
}

.draft-btn--confirm {
  background: var(--xq-accent, #8b5cf6);
  color: #fff;
}

.draft-btn--confirm:hover:not(:disabled) {
  background: var(--xq-accent-deep, #7c3aed);
}

.draft-card__success {
  padding: 20px 14px;
  text-align: center;
}

.draft-card__success p {
  margin: 0 0 8px;
  color: #16a34a;
  font-weight: 500;
}

.draft-card__link {
  display: inline-block;
  color: var(--xq-accent-deep, #6d28d9);
  text-decoration: none;
  font-size: 13px;
}

.draft-card__link:hover {
  text-decoration: underline;
}
</style>
