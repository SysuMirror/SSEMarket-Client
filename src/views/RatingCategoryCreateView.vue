<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { createRatingCategory } from '@/api/rating'
import { showMsg } from '@/components/MessageBox'

defineOptions({ name: 'RatingCategoryCreateView' })

const router = useRouter()
const name = ref('')
const description = ref('')
const syncFeedPost = ref(true)
const submitting = ref(false)

async function submit() {
  const n = name.value.trim()
  if (!n) {
    showMsg('请输入分区名称')
    return
  }
  submitting.value = true
  const cat = await createRatingCategory(n, description.value.trim(), syncFeedPost.value)
  submitting.value = false
  if (!cat) {
    showMsg('创建失败，名称可能已存在')
    return
  }
  showMsg(syncFeedPost.value ? '分区已创建，并已同步发帖到主页' : '分区已创建')
  router.replace({ path: '/rating', query: { category: String(cat.categoryID) } })
}
</script>

<template>
  <div class="rating-cat-create">
    <header class="rating-cat-create__head">
      <button type="button" class="rating-cat-create__back" aria-label="返回" @click="router.back()">
        <Icon icon="tabler:arrow-left" width="18" height="18" />
      </button>
      <h1>创建打分分区</h1>
    </header>

    <section class="rating-cat-create__card">
      <label class="rating-cat-create__field">
        <span>分区名称</span>
        <input v-model="name" type="text" maxlength="30" placeholder="如：食堂餐饮、高数课程">
      </label>
      <label class="rating-cat-create__field">
        <span>简介（可选）</span>
        <input v-model="description" type="text" maxlength="200" placeholder="简要说明该分区收录哪些评分">
      </label>

      <div class="rating-cat-create__sync">
        <button
          type="button"
          class="rating-cat-create__sync-btn"
          :class="{ 'rating-cat-create__sync-btn--on': syncFeedPost }"
          :aria-pressed="syncFeedPost"
          @click="syncFeedPost = !syncFeedPost"
        >
          <Icon :icon="syncFeedPost ? 'tabler:check' : 'tabler:square'" width="16" height="16" aria-hidden="true" />
          同步发帖到主页
        </button>
        <p class="rating-cat-create__sync-hint">
          开启后将以「新增分区-名称」为题在主页发帖，正文含打分专区链接；关闭则仅创建分区。
        </p>
      </div>

      <p class="rating-cat-create__hint">
        创建后可在该分区下发布评分帖；搜索分区名可找到该分区全部内容。
      </p>
    </section>

    <button type="button" class="rating-cat-create__submit" :disabled="submitting" @click="submit">
      {{ submitting ? '创建中…' : '创建分区' }}
    </button>
  </div>
</template>

<style scoped lang="scss">
.rating-cat-create {
  max-width: 720px;
  margin: 0 auto;
  padding: 10px 12px 24px;
}

.rating-cat-create__head {
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

.rating-cat-create__back {
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

.rating-cat-create__card {
  padding: 12px;
  border: 1px solid var(--hp-border, #e8eaed);
  border-radius: 10px;
  background: var(--hp-card, #fff);
}

.rating-cat-create__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 10px;

  span {
    font-size: 12px;
    font-weight: 600;
    color: var(--hp-muted, #8a9199);
  }

  input {
    padding: 9px 11px;
    border: 1px solid var(--hp-border, #e8eaed);
    border-radius: 8px;
    font-size: 14px;
  }
}

.rating-cat-create__sync {
  margin-bottom: 8px;
}

.rating-cat-create__sync-btn {
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
  white-space: nowrap;

  &--on {
    border-color: var(--chat-accent);
    background: var(--chat-accent-soft, #fff5eb);
    color: var(--chat-accent);
  }
}

.rating-cat-create__sync-hint {
  margin: 6px 0 0;
  font-size: 11px;
  line-height: 1.45;
  color: var(--hp-muted, #8a9199);
}

.rating-cat-create__hint {
  margin: 0;
  font-size: 11px;
  color: var(--hp-muted, #8a9199);
  line-height: 1.45;
}

.rating-cat-create__submit {
  width: 100%;
  margin-top: 12px;
  padding: 11px;
  border: none;
  border-radius: 10px;
  background: var(--chat-accent);
  color: var(--chat-unread-text);
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
}
</style>
