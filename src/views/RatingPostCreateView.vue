<script setup lang="ts">
import type { RatingCategory } from '@/api/rating/types'
import { Icon } from '@iconify/vue'
import { onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { createRatingPost, getRatingCategories } from '@/api/rating'
import MarkdownEditor from '@/components/MarkdownEditor.vue'
import { showMsg } from '@/components/MessageBox'

defineOptions({ name: 'RatingPostCreateView' })

const route = useRoute()
const router = useRouter()
const categories = ref<RatingCategory[]>([])
const categoryID = ref(0)
const title = ref('')
const content = ref('')
const submitting = ref(false)

async function loadCategories() {
  categories.value = await getRatingCategories()
  if (categories.value.length === 0) {
    categoryID.value = 0
    return
  }
  const fromQuery = Number(route.query.category)
  const hit = categories.value.find(c => c.categoryID === fromQuery)
  const other = categories.value.find(c => c.name === '其他')
  categoryID.value = hit?.categoryID ?? other?.categoryID ?? categories.value[0].categoryID
}

async function submitPost() {
  if (!categoryID.value) {
    showMsg('请选择分区')
    return
  }
  if (!title.value.trim()) {
    showMsg('请填写标题')
    return
  }
  submitting.value = true
  const id = await createRatingPost({
    categoryID: categoryID.value,
    title: title.value.trim(),
    content: content.value.trim(),
  })
  submitting.value = false
  if (!id) {
    showMsg('发布失败')
    return
  }
  showMsg('发布成功')
  router.push(`/rating/${id}`)
}

onMounted(loadCategories)
watch(() => route.query.category, loadCategories)
</script>

<template>
  <div class="rating-create-page">
    <header class="rating-create-page__head">
      <button type="button" class="rating-create-page__back" aria-label="返回" @click="router.back()">
        <Icon icon="tabler:arrow-left" width="18" height="18" />
      </button>
      <h1>发布评分</h1>
    </header>

    <section class="rating-create-page__card">
      <label class="rating-create-page__field">
        <span>所属分区</span>
        <select v-model.number="categoryID" class="rating-create-page__select">
          <option v-for="c in categories" :key="c.categoryID" :value="c.categoryID">
            {{ c.name }}
          </option>
        </select>
      </label>

      <label class="rating-create-page__field">
        <span>标题</span>
        <input v-model="title" type="text" placeholder="例如：东区食堂二楼" maxlength="50">
      </label>

      <label class="rating-create-page__field rating-create-page__field--editor">
        <span>说明（可选）</span>
        <MarkdownEditor
          v-model="content"
          fill
          placeholder="补充说明、评分理由等（可选）"
        />
      </label>
    </section>

    <button type="button" class="rating-create-page__submit" :disabled="submitting" @click="submitPost">
      {{ submitting ? '发布中…' : '发布' }}
    </button>
  </div>
</template>

<style scoped lang="scss">
.rating-create-page {
  max-width: 720px;
  margin: 0 auto;
  padding: 10px 12px 24px;
}

.rating-create-page__head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;

  h1 {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 800;
  }
}

.rating-create-page__back {
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

.rating-create-page__card {
  padding: 12px;
  border: 1px solid var(--hp-border, #e8eaed);
  border-radius: 10px;
  background: var(--hp-card, #fff);
}

.rating-create-page__field {
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
  select {
    padding: 9px 11px;
    border: 1px solid var(--hp-border, #e8eaed);
    border-radius: 8px;
    font-size: 14px;
  }
}

.rating-create-page__submit {
  width: 100%;
  margin-top: 12px;
  padding: 11px;
  border: none;
  border-radius: 10px;
  background: var(--chat-accent);
  color: var(--chat-unread-text);
  font-weight: 700;
  cursor: pointer;
}
</style>
