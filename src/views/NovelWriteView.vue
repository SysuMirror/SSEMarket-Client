<script lang="ts" setup>
import type { NovelItem } from '@/api/novel/types'
import { Icon } from '@iconify/vue'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { createNovel, createNovelChapter, getMyNovels, getNovelDetail, uploadNovelImage } from '@/api/novel'
import { showMsg } from '@/components/MessageBox'
import NovelCover from '@/components/novel/NovelCover.vue'
import { novelBookPath, novelReadPath } from '@/utils/novelRoute'
import { formatWordCount, novelContentWordCount, novelParagraphImage, splitNovelParagraphs } from '@/utils/novelText'

defineOptions({ name: 'NovelWriteView' })

const route = useRoute()

const CONTENT_MAX = 50000
const DRAFT_PREFIX = 'novel-write-draft:v1:'
/** 正文配图大小上限（图床 /auth/uploadPhotos 侧没有显式限制，这里自己拦） */
const IMAGE_MAX_BYTES = 5 * 1024 * 1024

interface DraftState {
  title: string
  content: string
  authorNote: string
}

const myNovels = ref<NovelItem[]>([])
const mode = ref<'create' | 'chapter'>('chapter')
const busy = ref(false)

/** 新建书 */
const title = ref('')
const category = ref('')
const intro = ref('')
const coverURL = ref('')
const status = ref('serializing')
const coverInput = ref<HTMLInputElement | null>(null)
const coverBusy = ref(false)

/** 发布章节 */
const selectedNovelID = ref(0)
const chapterTitle = ref('')
const chapterContent = ref('')
const authorNote = ref('')
const contentEl = ref<HTMLTextAreaElement | null>(null)
const draftSavedAt = ref(0)
const published = ref<{ chapterID: number, chapterNum: number, novelID: number } | null>(null)

/** 正文配图 */
const imageInput = ref<HTMLInputElement | null>(null)
const imageBusy = ref(false)
const previewMode = ref(false)

const selectedNovel = computed(() =>
  myNovels.value.find(n => n.novelID === selectedNovelID.value) ?? null,
)

/** 分段 / 字数口径与后端完全一致：换行即分段，空白不计字数，图片段落不计字数。 */
const previewParagraphs = computed(() => splitNovelParagraphs(chapterContent.value))
const previewWords = computed(() => novelContentWordCount(chapterContent.value))
/** 预览渲染：图片段落识别口径与后端 domain.NovelParagraphImage 一致。 */
const previewRender = computed(() => previewParagraphs.value.map((text, index) => ({
  index,
  text,
  imageURL: novelParagraphImage(text),
})))
const previewImageCount = computed(() => previewRender.value.filter(p => p.imageURL !== '').length)
const overLimit = computed(() => previewWords.value > CONTENT_MAX)
const progressPct = computed(() => Math.min(100, Math.round((previewWords.value / CONTENT_MAX) * 100)))
const draftLabel = computed(() => {
  if (!draftSavedAt.value)
    return ''
  const d = new Date(draftSavedAt.value)
  return `草稿已保存 ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
})

// ---------------------------------------------------------------------------
// 草稿自动保存：按书隔离，刷新 / 切书都不丢稿
// ---------------------------------------------------------------------------

function draftKey(id: number) {
  return `${DRAFT_PREFIX}${id}`
}

function draftEmpty(): boolean {
  return !chapterTitle.value.trim() && !chapterContent.value.trim() && !authorNote.value.trim()
}

function writeDraft(id: number) {
  if (!id)
    return
  try {
    if (draftEmpty()) {
      localStorage.removeItem(draftKey(id))
      draftSavedAt.value = 0
      return
    }
    localStorage.setItem(draftKey(id), JSON.stringify({
      title: chapterTitle.value,
      content: chapterContent.value,
      authorNote: authorNote.value,
    } satisfies DraftState))
    draftSavedAt.value = Date.now()
  }
  catch {
    // 隐私模式下 localStorage 可能不可用，忽略
  }
}

function loadDraft(id: number): DraftState | null {
  try {
    const raw = localStorage.getItem(draftKey(id))
    if (!raw)
      return null
    const d = JSON.parse(raw) as Partial<DraftState>
    return { title: d.title ?? '', content: d.content ?? '', authorNote: d.authorNote ?? '' }
  }
  catch {
    return null
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null
function scheduleSaveDraft() {
  if (!selectedNovelID.value)
    return
  if (saveTimer)
    clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveTimer = null
    writeDraft(selectedNovelID.value)
  }, 800)
}

function flushSaveDraft() {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  writeDraft(selectedNovelID.value)
}

function applyDraft(id: number) {
  const d = id ? loadDraft(id) : null
  chapterTitle.value = d?.title ?? ''
  chapterContent.value = d?.content ?? ''
  authorNote.value = d?.authorNote ?? ''
  draftSavedAt.value = d && !draftEmpty() ? Date.now() : 0
  void nextTick(autoGrow)
}

watch([chapterTitle, chapterContent, authorNote], scheduleSaveDraft)

watch(selectedNovelID, (next, prev) => {
  if (prev && prev !== next) {
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = null
    }
    writeDraft(prev)
  }
  published.value = null
  applyDraft(next)
})

function clearDraft() {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  try {
    localStorage.removeItem(draftKey(selectedNovelID.value))
  }
  catch {
    // ignore
  }
  draftSavedAt.value = 0
}

// ---------------------------------------------------------------------------
// 正文输入框随内容长高
// ---------------------------------------------------------------------------

function autoGrow() {
  const el = contentEl.value
  if (!el)
    return
  el.style.height = 'auto'
  el.style.height = `${Math.min(Math.max(el.scrollHeight + 4, 260), 1200)}px`
}

// ---------------------------------------------------------------------------
// 封面上传（新建书 / 之后可在书籍页换）
// ---------------------------------------------------------------------------

function pickCover() {
  coverInput.value?.click()
}

async function onCoverFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || coverBusy.value)
    return
  if (!file.type.startsWith('image/')) {
    showMsg('请选择图片文件')
    return
  }
  if (file.size > 5 * 1024 * 1024) {
    showMsg('封面图片最大 5MB')
    return
  }
  coverBusy.value = true
  const url = await uploadNovelImage(file)
  coverBusy.value = false
  if (!url) {
    showMsg('封面上传失败，请稍后重试')
    return
  }
  coverURL.value = url
  showMsg('封面已上传')
}

function removeCover() {
  coverURL.value = ''
}

// ---------------------------------------------------------------------------
// 正文配图：上传后在光标处插入「独占一段」的图片
// ---------------------------------------------------------------------------

/**
 * 图片默认成单独一段：前后各补一个空行（正文里就是上下两个换行符），
 * 分段规则丢弃空白行，所以这一行天然就是一个独立段落，阅读页会整段渲染成图片。
 * 想挪位置就把 `![](url)` 这一行整体剪切到别处，或删掉重写。
 */
function insertImageParagraph(url: string) {
  const marker = `![](${url})`
  const text = chapterContent.value
  const el = contentEl.value
  const at = el ? el.selectionStart : text.length
  // \s 已覆盖全角空格 U+3000，与后端 TrimSpace 口径一致
  const head = text.slice(0, at).replace(/\s+$/, '')
  const tail = text.slice(at).replace(/^\s+/, '')
  const next = head ? `${head}\n\n${marker}\n\n${tail}` : `${marker}\n\n${tail}`
  chapterContent.value = next
  // 光标停在图片段之后，方便接着写下一段
  const caret = (head ? head.length + 2 : 0) + marker.length + 2
  void nextTick(() => {
    const box = contentEl.value
    if (!box)
      return
    box.focus()
    box.setSelectionRange(caret, caret)
    autoGrow()
  })
  showMsg('图片已插入为独立一段，可把这一行剪切到别处调整位置')
}

function pickImage() {
  if (previewMode.value) {
    showMsg('先切回「继续编辑」再插图')
    return
  }
  imageInput.value?.click()
}

async function onImageFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || imageBusy.value)
    return
  if (!file.type.startsWith('image/')) {
    showMsg('请选择图片文件')
    return
  }
  if (file.size > IMAGE_MAX_BYTES) {
    showMsg(`正文图片最大 ${Math.floor(IMAGE_MAX_BYTES / 1024 / 1024)}MB`)
    return
  }
  imageBusy.value = true
  const url = await uploadNovelImage(file)
  imageBusy.value = false
  if (!url) {
    showMsg('图片上传失败，请稍后重试')
    return
  }
  insertImageParagraph(url)
}

// ---------------------------------------------------------------------------
// 提交
// ---------------------------------------------------------------------------

async function loadMine() {
  const result = await getMyNovels({ limit: 50 })
  myNovels.value = result.novels
  if (selectedNovelID.value === 0 && myNovels.value.length > 0)
    selectedNovelID.value = myNovels.value[0].novelID
}

function selectBook(id: number) {
  if (selectedNovelID.value === id)
    return
  selectedNovelID.value = id
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
  mode.value = 'chapter'
  selectedNovelID.value = id
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
  if (overLimit.value) {
    showMsg(`正文最多 ${CONTENT_MAX} 字，当前 ${previewWords.value} 字`)
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
  clearDraft()
  chapterTitle.value = ''
  chapterContent.value = ''
  authorNote.value = ''
  published.value = { chapterID: chapter.chapterID, chapterNum: chapter.chapterNum, novelID: selectedNovelID.value }
  await loadMine()
}

onMounted(async () => {
  const queryNovel = Number(route.query.novel)
  if (Number.isFinite(queryNovel) && queryNovel > 0) {
    mode.value = 'chapter'
    const detail = await getNovelDetail(queryNovel)
    if (detail && !detail.isAuthor)
      showMsg('只有作者本人能在这本书下发布章节')
    selectedNovelID.value = queryNovel
  }
  await loadMine()
  applyDraft(selectedNovelID.value)
})

onUnmounted(() => {
  flushSaveDraft()
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

    <!-- 新建书 -->
    <section v-if="mode === 'create'" class="novel-write__card">
      <div class="novel-write__cover-row">
        <NovelCover class="novel-write__cover" :title="title || '新书'" :cover-url="coverURL" />
        <div class="novel-write__cover-actions">
          <span class="novel-write__field-label">封面（可选，也可创建后在书籍页更换）</span>
          <div class="novel-write__cover-btns">
            <button type="button" class="novel-write__ghost-btn" :disabled="coverBusy" @click="pickCover">
              <Icon icon="tabler:upload" width="14" height="14" aria-hidden="true" />
              {{ coverBusy ? '上传中…' : coverURL ? '更换封面' : '上传封面' }}
            </button>
            <button v-if="coverURL" type="button" class="novel-write__ghost-btn novel-write__ghost-btn--muted" @click="removeCover">
              移除
            </button>
          </div>
          <p class="novel-write__hint">
            不上传则用书名自动生成封面；图片最大 5MB
          </p>
        </div>
        <input ref="coverInput" type="file" accept="image/*" class="novel-write__file" @change="onCoverFile">
      </div>

      <label class="novel-write__field">
        <span>书名（必填，2–60 字）</span>
        <input v-model="title" type="text" maxlength="60" placeholder="例如：晚自习后的银河">
      </label>
      <label class="novel-write__field">
        <span>分类（可选，最多 20 字）</span>
        <input v-model="category" type="text" maxlength="20" placeholder="例如：校园">
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

    <!-- 发布章节 -->
    <section v-else class="novel-write__card">
      <div class="novel-write__field">
        <span class="novel-write__field-label">发布到</span>
        <div v-if="myNovels.length > 0" class="novel-write__books">
          <button
            v-for="n in myNovels"
            :key="n.novelID"
            type="button"
            class="novel-write__book"
            :class="{ 'novel-write__book--on': n.novelID === selectedNovelID }"
            @click="selectBook(n.novelID)"
          >
            <NovelCover class="novel-write__book-cover" :title="n.title" :cover-url="n.coverURL" />
            <span class="novel-write__book-title">{{ n.title }}</span>
            <span class="novel-write__book-meta">{{ n.chapterNum }}章 · {{ formatWordCount(n.wordNum) }}</span>
          </button>
          <button type="button" class="novel-write__book novel-write__book--new" @click="mode = 'create'">
            <Icon icon="tabler:plus" width="18" height="18" aria-hidden="true" />
            <span class="novel-write__book-title">新建书</span>
          </button>
        </div>
        <p v-else class="novel-write__hint">
          你还没有自己的书，先建一本再回来写
        </p>
        <RouterLink v-if="selectedNovel" class="novel-write__booklink" :to="novelBookPath(selectedNovel.novelID)">
          查看《{{ selectedNovel.title }}》
        </RouterLink>
      </div>

      <Transition name="novel-write-published">
        <div v-if="published" class="novel-write__published">
          <Icon icon="tabler:circle-check" width="16" height="16" aria-hidden="true" />
          <span>已发布第 {{ published.chapterNum }} 章</span>
          <RouterLink :to="novelReadPath(published.chapterID)">
            阅读本章
          </RouterLink>
          <RouterLink :to="novelBookPath(published.novelID)">
            书籍页
          </RouterLink>
          <button type="button" @click="published = null">
            继续写
          </button>
        </div>
      </Transition>

      <label class="novel-write__field">
        <span>章节标题（必填，最多 100 字）</span>
        <input v-model="chapterTitle" type="text" maxlength="100" placeholder="例如：01 停电的晚自习">
      </label>

      <div class="novel-write__field">
        <span class="novel-write__field-label novel-write__field-label--row">
          <span>正文（必填，最多 5 万字）</span>
          <em>
            {{ previewParagraphs.length }}段 · {{ formatWordCount(previewWords) }}
            <template v-if="previewImageCount > 0"> · {{ previewImageCount }}图</template>
          </em>
        </span>

        <div class="novel-write__tools">
          <button
            type="button"
            class="novel-write__tool"
            :disabled="imageBusy || previewMode"
            title="上传一张图片，插入为独立一段"
            @click="pickImage"
          >
            <Icon icon="tabler:photo" width="14" height="14" aria-hidden="true" />
            {{ imageBusy ? '上传中…' : '插入图片' }}
          </button>
          <button type="button" class="novel-write__tool" @click="previewMode = !previewMode">
            <Icon :icon="previewMode ? 'tabler:pencil' : 'tabler:eye'" width="14" height="14" aria-hidden="true" />
            {{ previewMode ? '继续编辑' : '预览' }}
          </button>
          <span class="novel-write__tools-hint">
            {{ previewMode ? '预览按阅读页口径渲染，图片独占一段' : '图片默认独占一段，可剪切那一行挪位置' }}
          </span>
        </div>

        <textarea
          v-if="!previewMode"
          ref="contentEl"
          v-model="chapterContent"
          class="novel-write__content"
          rows="14"
          maxlength="50000"
          placeholder="第一段&#10;第二段&#10;&#10;（换行即分段，与阅读页 / 段评编号一致）"
          @input="autoGrow"
        />
        <div v-else class="novel-write__preview">
          <p
            v-for="p in previewRender"
            :key="p.index"
            class="novel-write__preview-para"
            :class="{ 'novel-write__preview-para--image': p.imageURL !== '' }"
          >
            <img
              v-if="p.imageURL"
              class="novel-write__preview-img"
              :src="p.imageURL"
              :alt="`第 ${p.index + 1} 段配图`"
              loading="lazy"
            >
            <template v-else>
              {{ p.text }}
            </template>
          </p>
          <p v-if="previewRender.length === 0" class="novel-write__preview-empty">
            还没有正文，切回「继续编辑」写点东西
          </p>
        </div>
        <input ref="imageInput" type="file" accept="image/*" class="novel-write__file" @change="onImageFile">

        <div class="novel-write__meter" :class="{ 'novel-write__meter--over': overLimit }">
          <span class="novel-write__meter-bar" :style="{ width: `${progressPct}%` }" />
        </div>
        <p class="novel-write__hint">
          换行即分段：每一行正文就是一个段落，段评按这个编号；空行只用于视觉分组，不产生段落。
          图片写成 <code>![](图片地址)</code> 单独一行，不计入字数。
          <template v-if="overLimit">
            <strong class="novel-write__over">
              已超出 {{ previewWords - CONTENT_MAX }} 字，请删减后再发布。
            </strong>
          </template>
        </p>
      </div>

      <details class="novel-write__note">
        <summary>作者有话说（可选，最多 1000 字）</summary>
        <textarea v-model="authorNote" rows="3" maxlength="1000" placeholder="写在章节末尾，读者会在「作者有话说」里看到" />
      </details>

      <div class="novel-write__bar">
        <span class="novel-write__bar-stat">
          <template v-if="draftLabel">{{ draftLabel }}</template>
          <template v-else-if="selectedNovelID">边写边自动存草稿</template>
        </span>
        <button
          type="button"
          class="novel-write__submit"
          :disabled="busy || selectedNovelID === 0 || overLimit"
          @click="submitChapter"
        >
          {{ busy ? '发布中…' : '发布章节' }}
        </button>
      </div>
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

  > span {
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

.novel-write__field-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary, #475569);
}

.novel-write__field-label--row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

/* ---------------- 封面上传 ---------------- */

.novel-write__cover-row {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.novel-write__cover {
  flex: 0 0 auto;
  width: 76px;
  height: 106px;
  border-radius: 5px;
  background: var(--color-bg, #f5f6f7);
}

.novel-write__cover-actions {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.novel-write__cover-btns {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.novel-write__ghost-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 7px 12px;
  border: 1px solid var(--color-border, rgba(71, 85, 105, 0.12));
  border-radius: 8px;
  background: var(--color-card, #fff);
  color: var(--accent, #2c3d56);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;

  &--muted {
    color: var(--color-text-muted, #94a3b8);
  }

  &:disabled {
    opacity: 0.55;
    cursor: default;
  }
}

.novel-write__file {
  display: none;
}

/* ---------------- 选书 ---------------- */

.novel-write__books {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 2px 2px 8px;
  -webkit-overflow-scrolling: touch;
}

.novel-write__book {
  flex: 0 0 auto;
  width: 92px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 6px;
  border: 1px solid var(--color-border, rgba(71, 85, 105, 0.12));
  border-radius: 10px;
  background: var(--color-card, #fff);
  color: inherit;
  font: inherit;
  cursor: pointer;
  text-align: center;

  &--on {
    border-color: var(--accent, #2c3d56);
    background: var(--accent-soft, rgba(44, 61, 86, 0.08));
    box-shadow: 0 0 0 1px var(--accent, #2c3d56) inset;
  }

  &--new {
    justify-content: center;
    min-height: 132px;
    color: var(--accent, #2c3d56);
    border-style: dashed;
  }
}

.novel-write__book-cover {
  width: 52px;
  height: 72px;
  border-radius: 4px;
}

.novel-write__book-title {
  max-width: 100%;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text, #1e293b);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.novel-write__book-meta {
  font-size: 10px;
  color: var(--color-text-muted, #94a3b8);
}

.novel-write__booklink {
  align-self: flex-start;
  font-size: 12px;
  color: var(--accent, #2c3d56);
  text-decoration: none;
}

/* ---------------- 发布成功 ---------------- */

.novel-write__published {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 9px 12px;
  border-radius: 9px;
  background: rgba(15, 118, 110, 0.1);
  color: #0f766e;
  font-size: 12px;
  font-weight: 600;

  a,
  button {
    color: #0f766e;
    font-weight: 700;
    text-decoration: underline;
    background: none;
    border: none;
    padding: 0;
    font-size: 12px;
    cursor: pointer;
  }
}

.novel-write-published-enter-active,
.novel-write-published-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.novel-write-published-enter-from,
.novel-write-published-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

/* ---------------- 正文与字数 ---------------- */

.novel-write__content {
  min-height: 260px;
}

/* ---------------- 正文工具条（插图 / 预览） ---------------- */

.novel-write__tools {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 6px;
}

.novel-write__tool {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 11px;
  border: 1px solid var(--color-border, rgba(71, 85, 105, 0.12));
  border-radius: 8px;
  background: var(--color-bg, #f5f6f7);
  color: var(--accent, #2c3d56);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;

  &:hover {
    border-color: var(--accent, #2c3d56);
  }

  &:disabled {
    opacity: 0.55;
    cursor: default;
  }
}

.novel-write__tools-hint {
  flex: 1;
  min-width: 120px;
  font-size: 11px;
  color: var(--color-text-muted, #94a3b8);
}

/* ---------------- 渲染式预览（与阅读页口径一致） ---------------- */

.novel-write__preview {
  min-height: 260px;
  padding: 12px 14px;
  border: 1px solid var(--color-border, rgba(71, 85, 105, 0.12));
  border-radius: 8px;
  background: var(--color-card, #fff);
  font-size: 14px;
  line-height: 1.9;
  color: var(--color-text, #1e293b);
  overflow-x: hidden;
}

.novel-write__preview-para {
  margin: 0 0 12px;
  text-indent: 2em;
  word-break: break-word;
}

.novel-write__preview-para--image {
  margin: 16px 0 18px;
  text-indent: 0;
  text-align: center;
}

.novel-write__preview-img {
  display: block;
  max-width: 100%;
  height: auto;
  margin: 0 auto;
  border-radius: 10px;
  background: var(--color-bg, #f5f6f7);
}

.novel-write__preview-empty {
  margin: 0;
  text-align: center;
  font-size: 12px;
  color: var(--color-text-muted, #94a3b8);
}

.novel-write__meter {
  height: 4px;
  border-radius: 999px;
  background: var(--color-border, rgba(71, 85, 105, 0.12));
  overflow: hidden;

  &--over {
    background: rgba(185, 28, 28, 0.18);
  }
}

.novel-write__meter-bar {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: var(--accent, #2c3d56);
  transition: width 0.2s ease;

  .novel-write__meter--over & {
    background: #b91c1c;
  }
}

.novel-write__hint {
  margin: 0;
  font-size: 11px;
  line-height: 1.6;
  color: var(--color-text-muted, #94a3b8);

  code {
    padding: 1px 4px;
    border-radius: 4px;
    background: var(--color-bg, #f5f6f7);
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 10.5px;
  }
}

.novel-write__over {
  color: #b91c1c;
}

.novel-write__note {
  border: 1px solid var(--color-border, rgba(71, 85, 105, 0.12));
  border-radius: 9px;
  padding: 8px 12px;
  background: var(--color-bg, #f5f6f7);

  summary {
    font-size: 12px;
    font-weight: 600;
    color: var(--color-text-secondary, #475569);
    cursor: pointer;
  }

  textarea {
    width: 100%;
    box-sizing: border-box;
    margin-top: 8px;
    padding: 8px 10px;
    border: 1px solid var(--color-border, rgba(71, 85, 105, 0.12));
    border-radius: 8px;
    background: var(--color-card, #fff);
    font-size: 13px;
    font-family: inherit;
    line-height: 1.7;
    resize: vertical;
    color: var(--color-text, #1e293b);

    &:focus {
      outline: none;
      border-color: var(--accent, #2c3d56);
    }
  }
}

/* ---------------- 底部操作条 ---------------- */

.novel-write__bar {
  position: sticky;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 2px 2px;
  background: var(--color-card, #fff);
  border-top: 1px solid var(--color-border, rgba(71, 85, 105, 0.08));
}

.novel-write__bar-stat {
  font-size: 11px;
  color: var(--color-text-muted, #94a3b8);
}

.novel-write__submit {
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
