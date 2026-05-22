<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { ref, useTemplateRef } from 'vue'
import { useRouter } from 'vue-router'
import { uploadPhoto } from '@/api/editPostAndComment/utils'
import { createShopProduct } from '@/api/shop/mutations'
import { showMsg } from '@/components/MessageBox'
import { useUserStore } from '@/store/userStore'

defineOptions({ name: 'SaleView' })

const router = useRouter()
const { userInfo } = useUserStore()

const name = ref('')
const price = ref<number | ''>('')
const description = ref('')
const syncFeedPost = ref(true)
const previewUrls = ref<string[]>([])
const tempFiles = ref<File[]>([])
const submitting = ref(false)
const fileInput = useTemplateRef<HTMLInputElement>('fileInput')

function triggerFileInput() {
  fileInput.value?.click()
}

function handleFiles(event: Event) {
  const files = (event.target as HTMLInputElement).files
  if (!files)
    return
  for (const file of Array.from(files)) {
    if (!file.type.startsWith('image/'))
      continue
    if (tempFiles.value.length >= 5) {
      showMsg('最多 5 张图片')
      break
    }
    tempFiles.value.push(file)
    const reader = new FileReader()
    reader.onload = (e) => {
      if (e.target?.result)
        previewUrls.value.push(e.target.result as string)
    }
    reader.readAsDataURL(file)
  }
  if (fileInput.value)
    fileInput.value.value = ''
}

function removeImage(index: number) {
  tempFiles.value.splice(index, 1)
  previewUrls.value.splice(index, 1)
}

async function submit() {
  const title = name.value.trim()
  const desc = description.value.trim()
  const p = Number(price.value)
  if (!title) {
    showMsg('请填写商品名称')
    return
  }
  if (!Number.isFinite(p) || p <= 0) {
    showMsg('请填写有效价格')
    return
  }
  if (!desc) {
    showMsg('请填写商品描述')
    return
  }
  submitting.value = true
  try {
    const imageUrls: string[] = []
    for (const file of tempFiles.value) {
      const data = await uploadPhoto(file)
      imageUrls.push(data.fileURL)
    }
    const id = await createShopProduct(
      userInfo.userID,
      { name: title, price: p, description: desc, images: imageUrls },
      syncFeedPost.value,
    )
    if (!id) {
      showMsg('发布失败')
      return
    }
    showMsg(syncFeedPost.value ? '已发布，并已同步发帖到主页' : '商品发布成功')
    router.push(shopProductPath(id))
  }
  catch (e) {
    console.error(e)
    showMsg('发布失败')
  }
  finally {
    submitting.value = false
  }
}

function shopProductPath(id: number) {
  return `/shop/productdetail/${id}`
}
</script>

<template>
  <div class="shop-sale shop-zone">
    <header class="shop-sale__head">
      <button type="button" class="shop-sale__back" aria-label="返回" @click="router.back()">
        <Icon icon="tabler:arrow-left" width="18" height="18" />
      </button>
      <h1>发布商品</h1>
    </header>

    <section class="shop-sale__card">
      <label class="shop-sale__field">
        <span>名称（最多 30 字）</span>
        <input v-model="name" type="text" maxlength="30" placeholder="如：高等数学教材第七版">
      </label>
      <label class="shop-sale__field">
        <span>价格（元）</span>
        <input v-model.number="price" type="number" min="1" placeholder="整数价格">
      </label>

      <div class="shop-sale__field">
        <span>图片（最多 5 张）</span>
        <div class="shop-sale__images">
          <div v-for="(url, i) in previewUrls" :key="i" class="shop-sale__img-wrap">
            <img :src="url" alt="预览">
            <button type="button" class="shop-sale__img-del" @click="removeImage(i)">
              ×
            </button>
          </div>
          <button
            v-if="previewUrls.length < 5"
            type="button"
            class="shop-sale__img-add"
            @click="triggerFileInput"
          >
            <Icon icon="tabler:plus" width="20" height="20" />
          </button>
          <input
            ref="fileInput"
            type="file"
            accept="image/*"
            multiple
            hidden
            @change="handleFiles"
          >
        </div>
      </div>

      <label class="shop-sale__field">
        <span>描述</span>
        <textarea v-model="description" rows="5" maxlength="2000" placeholder="成色、交易方式、联系方式等" />
      </label>

      <div class="shop-sale__sync">
        <button
          type="button"
          class="shop-sale__sync-btn"
          :class="{ 'shop-sale__sync-btn--on': syncFeedPost }"
          :aria-pressed="syncFeedPost"
          @click="syncFeedPost = !syncFeedPost"
        >
          <Icon :icon="syncFeedPost ? 'tabler:check' : 'tabler:square'" width="16" height="16" />
          同步发帖到主页
        </button>
        <p class="shop-sale__sync-hint">
          开启后将以「新上架-名称」为题在主页发帖，正文含商品链接；关闭则仅上架商品。
        </p>
      </div>
    </section>

    <button type="button" class="shop-sale__submit" :disabled="submitting" @click="submit">
      {{ submitting ? '发布中…' : '发布商品' }}
    </button>
  </div>
</template>

<style scoped lang="scss">
.shop-sale {
  max-width: 720px;
  margin: 0 auto;
  padding: 4px 0 12px;
}

.shop-sale__head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;

  h1 {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 800;
  }
}

.shop-sale__back {
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--hp-border, #e8eaed);
  border-radius: 8px;
  background: var(--hp-card, #fff);
  cursor: pointer;
}

.shop-sale__card {
  padding: 12px;
  border: 1px solid var(--hp-border, #e8eaed);
  border-radius: 10px;
  background: var(--hp-card, #fff);
}

.shop-sale__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 10px;

  span {
    font-size: 12px;
    font-weight: 600;
    color: var(--hp-muted, #8a9199);
  }

  input,
  textarea {
    padding: 9px 11px;
    border: 1px solid var(--hp-border, #e8eaed);
    border-radius: 8px;
    font-size: 14px;
    font-family: inherit;
  }
}

.shop-sale__images {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.shop-sale__img-wrap {
  position: relative;
  width: 72px;
  height: 72px;
  border-radius: 8px;
  overflow: hidden;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.shop-sale__img-del {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 20px;
  height: 20px;
  border: none;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  cursor: pointer;
}

.shop-sale__img-add {
  width: 72px;
  height: 72px;
  border: 1px dashed var(--hp-border, #e8eaed);
  border-radius: 8px;
  background: var(--chat-bg-muted, #f4f5f7);
  color: var(--hp-muted, #8a9199);
  cursor: pointer;
}

.shop-sale__sync {
  margin-top: 4px;
}

.shop-sale__sync-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border: 1px solid var(--hp-border, #e8eaed);
  border-radius: 8px;
  background: var(--chat-bg-muted, #f4f5f7);
  font-size: 13px;
  font-weight: 600;
  color: var(--hp-muted, #8a9199);
  cursor: pointer;

  &--on {
    border-color: var(--chat-accent);
    background: var(--chat-accent-soft, #fff5eb);
    color: var(--chat-accent);
  }
}

.shop-sale__sync-hint {
  margin: 6px 0 0;
  font-size: 11px;
  line-height: 1.45;
  color: var(--hp-muted, #8a9199);
}

.shop-sale__submit {
  width: 100%;
  margin-top: 12px;
  padding: 11px;
  border: none;
  border-radius: 10px;
  background: var(--chat-accent);
  color: var(--chat-unread-text, #fff);
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
}
</style>
