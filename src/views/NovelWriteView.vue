<script lang="ts" setup>
import type { NovelItem } from '@/api/novel/types'
import { Icon } from '@iconify/vue'
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { createNovel, createNovelChapter, getMyNovels, getNovelDetail } from '@/api/novel'
import { showMsg } from '@/components/MessageBox'
import { novelBookPath } from '@/utils/novelRoute'
import { formatWordCount } from '@/utils/novelText'

defineOptions({ name: 'NovelWriteView' })

const route = useRoute()
const router = useRouter()

const myNovels = ref<NovelItem[]>([])
const mode = ref<'create' | 'chapter'>('chapter')
const busy = ref(false)

const title = ref('')
const category = ref('')
const intro = ref('')
const coverURL = ref('')
const status = ref('serializing')

const selectedNovelID = ref(0)
const chapterTitle = ref('')
const chapterContent = ref('')
const authorNote = ref('')

const selectedNovel = computed(() =>
  myNovels.value.find(n => n.novelID === selectedNovelID.value) ?? null,
)

const previewParagraphs = computed(() =>
  chapterContent.value.split(/\r\n?|\n/).map(s => s.trim()).filter(s => s !== ''),
)
const previewWords = computed(() =>
  previewParagraphs.value.reduce((sum, p) => sum + p.replace(/\s/g, '').length, 0),
)

async function loadMine() {
  const result = await getMyNovels({ limit: 50 })
  myNovels.value = result.novels
  if (selectedNovelID.value === 0 && myNovels.value.length > 0)
    selectedNovelID.value = myNovels.value[0].novelID
}

async function submitCreate() {
  if (busy.value)
    return
  const name = title.value.trim()
  if (name.length < 2) {
    showMsg('书名至少 2 个字')
    return
  }
  busy.value = true
  const id = await createNovel({
    title: name,
    category: category.value.trim(),
    intro: intro.value.trim(),
    coverURL: coverURL.value.trim(),
    status: status.value,
  })
  busy.value = false
  if (!id) {
    showMsg('创建失败，请稍后重试')
    return
  }
  showMsg('书已创建，可以发布第一章了')
  title.value = ''
  intro.value = ''
  category.value = ''
  coverURL.value = ''
  await loadMine()
  selectedNovelID.value = id
  mode.value = 'chapter'
  router.replace(novelBookPath(id))
}

async function submitChapter() {
  if (busy.value)
    return
  if (!selectedNovelID.value) {
    showMsg('先选择一本书')
    return
  }
  const name = chapterTitle.value.trim()
  if (!name) {
    showMsg('章节标题不能为空')
    return
  }
  if (!chapterContent.value.trim()) {
    showMsg('正文不能为空')
    return
  }
  busy.value = true
  const chapter = await createNovelChapter({
    novelID: selectedNovelID.value,
    title: name,
    content: chapterContent.value,
    authorNote: authorNote.value.trim(),
  })
  busy.value = false
  if (!chapter) {
    showMsg('发布失败，请检查字数上限或作者权限')
    return
  }
  showMsg(`已发布第 ${chapter.chapterNum} 章`)
  chapterTitle.value = ''
  chapterContent.value = ''
  authorNote.value = ''
  await loadMine()
  router.replace(novelBookPath(selectedNovelID.value))
}

onMounted(async () => {
  const queryNovel = Number(route.query.novel)
  if (Number.isFinite(queryNovel) && queryNovel > 0) {
    selectedNovelID.value = queryNovel
    mode.value = 'chapter'
    const detail = await getNovelDetail(queryNovel)
    if (detail && !detail.isAuthor)
      showMsg('只有作者本人能在这本书下发布章节')
  }
  await loadMine()
})
</script>

<template>
  <div class="novel-zone novel-write">
    <header class="novel-write__top">
      <div class="novel-write__brand">
        <Icon icon="tabler:pencil" width="20" height="20" aria-hidden="true" />
        <span class="novel-write__brand-title">写书</span>
      </div>
      <div class="novel-write__tabs">
        <button
          type="button"
          class="novel-write__tab"
          :class="{ 'novel-write__tab--on': mode === 'chapter' }"
          @click="mode = 'chapter'"
        >
          发布章节
        </button>
        <button
          type="button"
          class="novel-write__tab"
          :class="{ 'novel-write__tab--on': mode === 'create' }"
          @click="mode = 'create'"
        >
          新建书
        </button>
      </div>
    </header>

    <section v-if="mode === 'create'" class="novel-write__card">
      <label class="novel-write__field">
        <span>书名（必填，2–60 字）</span>
        <input v-model="title" type="text" maxlength="60" placeholder="例如：晚自习后的银河">
      </label>
      <label class="novel-write__field">
        <span>分类（可选，最多 20 字）</span>
        <input v-model="category" type="text" maxlength="20" placeholder="例如：校园">
      </label>
      <label class="novel-write__field">
        <span>封面图链接（可选）</span>
        <input v-model="coverURL" type="url" maxlength="500" placeholder="https://…">
      </label>
      <label class="novel-write__field">
        <span>简介（可选，最多 1000 字）</span>
        <textarea v-model="intro" rows="4" maxlength="1000" />
      </label>
      <label class="novel-write__field">
        <span>状态</span>
        <select v-model="status">
          <option value="serializing">连载中</option>
          <option value="completed">已完结</option>
        </select>
      </label>
      <button type="button" class="novel-write__submit" :disabled="busy" @click="submitCreate">
        {{ busy ? '创建中…' : '创建书籍' }}
      </button>
    </section>

    <section v-else class="novel-write__card">
      <label class="novel-write__field">
        <span>发布到</span>
        <select v-model.number="selectedNovelID">
          <option :value="0" disabled>选择一本书</option>
          <option v-for="n in myNovels" :key="n.novelID" :value="n.novelID">
            {{ n.title }}（{{ n.chapterNum }}章 · {{ formatWordCount(n.wordNum) }}）
          </option>
        </select>
      </label>
      <p v-if="myNovels.length === 0" class="novel-write__hint">
        你还没有自己的书，先切到「新建书」建一本
      </p>
      <RouterLink v-if="selectedNovel" class="novel-write__booklink" :to="novelBookPath(selectedNovel.novelID)">
        查看《{{ selectedNovel.title }}》
      </RouterLink>

      <label class="novel-write__field">
        <span>
          章节标题（必填，最多 100 字）
        </span>
        <input v-model="chapterTitle" type="text" maxlength="100" placeholder="例如：01 停电的晚自习">
      </label>
      <label class="novel-write__field">
        <span>
          正文（必填，最多 5 万字；一个空行分隔一个段落）
          <em>{{ previewParagraphs.length }}段 · {{ formatWordCount(previewWords) }}</em>
        </span>
        <textarea v-model="chapterContent" rows="14" maxlength="50000" placeholder="第一段&#10;&#10;第二段" />
      </label>
      <label class="novel-write__field">
        <span>作者有话说（可选，最多 1000 字）</span>
        <textarea v-model="authorNote" rows="3" maxlength="1000" placeholder="写在章节末尾，读者会在「作者有话说」里看到" />
      </label>
      <button
        type="button"
        class="novel-write__submit"
        :disabled="busy || selectedNovelID === 0"
        @click="submitChapter"
      >
        {{ busy ? '发布中…' : '发布章节' }}
      </button>
    </section>
  </div>
</template>

<style scoped lang="scss">
.novel-write {
  width: 100%;
  max-width: 720px;
  min-width: 0;
  margin: 0 auto;
  padding: 8px 10px 24px;
  box-sizing: border-box;
  overflow-x: hidden;
}

.novel-write__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
}

.novel-write__brand {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--accent, #2c3d56);
  font-weight: 800;
  font-size: 14px;
}

.novel-write__tabs {
  display: flex;
  gap: 4px;
}

.novel-write__tab {
  padding: 6px 12px;
  border: 1px solid var(--color-border, rgba(71, 85, 105, 0.12));
  border-radius: 8px;
  background: var(--color-card, #fff);
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary, #475569);
  cursor: pointer;

  &--on {
    border-color: var(--accent, #2c3d56);
    background: var(--accent, #2c3d56);
    color: #fff;
  }
}

.novel-write__card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
  background: var(--color-card, #fff);
  border-radius: var(--radius-lg, 8px);
  box-shadow: var(--color-card-shadow);
}

.novel-write__field {
  display: flex;
  flex-direction: column;
  gap: 5px;

  span {
    font-size: 12px;
    font-weight: 600;
    color: var(--color-text-secondary, #475569);
  }

  em {
    font-style: normal;
    font-weight: 500;
    color: var(--color-text-muted, #94a3b8);
  }

  input,
  select,
  textarea {
    width: 100%;
    box-sizing: border-box;
    padding: 8px 10px;
    border: 1px solid var(--color-border, rgba(71, 85, 105, 0.12));
    border-radius: 8px;
    background: var(--color-bg, #f5f6f7);
    font-size: 13px;
    font-family: inherit;
    color: var(--color-text, #1e293b);

    &:focus {
      outline: none;
      border-color: var(--accent, #2c3d56);
    }
  }

  textarea {
    resize: vertical;
    line-height: 1.7;
  }
}

.novel-write__hint {
  margin: 0;
  font-size: 12px;
  color: var(--color-text-muted, #94a3b8);
}

.novel-write__booklink {
  font-size: 12px;
  color: var(--accent, #2c3d56);
  text-decoration: none;
}

.novel-write__submit {
  align-self: flex-start;
  padding: 9px 18px;
  border: none;
  border-radius: 9px;
  background: var(--accent, #2c3d56);
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;

  &:disabled {
    opacity: 0.5;
    cursor: default;
  }
}
</style>
