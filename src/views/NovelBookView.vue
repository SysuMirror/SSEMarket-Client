<script lang="ts" setup>
import type { NovelChapterItem, NovelCommentItem, NovelDetail } from '@/api/novel/types'
import { Icon } from '@iconify/vue'
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  createNovelComment,
  deleteNovel,
  getNovelChapters,
  getNovelComments,
  getNovelDetail,
  rewardNovelAuthor,
  toggleShelf,
  updateNovel,
  uploadNovelImage,
} from '@/api/novel'
import { showMsg } from '@/components/MessageBox'
import NovelCommentCard from '@/components/novel/NovelCommentCard.vue'
import NovelCover from '@/components/novel/NovelCover.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import { useUserStore } from '@/store/userStore'
import { novelReadPath, novelWritePath } from '@/utils/novelRoute'
import { formatCount, formatNovelTime, formatWordCount } from '@/utils/novelText'
import { setTitle } from '@/utils/title'

defineOptions({ name: 'NovelBookView' })

const route = useRoute()
const router = useRouter()
const { userInfo } = useUserStore()

const novel = ref<NovelDetail | null>(null)
const chapters = ref<NovelChapterItem[]>([])
const chapterTotal = ref(0)
const reviews = ref<NovelCommentItem[]>([])
const reviewTotal = ref(0)
const reviewDraft = ref('')
const reviewBusy = ref(false)
const introExpanded = ref(false)
const shelfBusy = ref(false)
const loading = ref(true)

/** 作者换封面 */
const coverInput = ref<HTMLInputElement | null>(null)
const coverBusy = ref(false)

const chapterBusy = ref(false)

/** 读者打赏 */
const rewardOpen = ref(false)
const rewardBusy = ref(false)
const rewardPoints = ref(10)

const chapterLimit = 50
const reviewLimit = 20

const novelID = computed(() => Number(route.params.id) || 0)

const firstChapter = computed(() => chapters.value[0]?.chapterID ?? 0)
const entryChapter = computed(() =>
  novel.value?.progressChapterID || novel.value?.latestChapterID || firstChapter.value,
)
const hasProgress = computed(() =>
  Boolean(novel.value && novel.value.progressPercent > 0 && novel.value.progressPercent < 100),
)
const introLong = computed(() => (novel.value?.intro.length ?? 0) > 120)

async function refreshDetail() {
  const detail = await getNovelDetail(novelID.value)
  if (!detail) {
    showMsg('小说不存在或已被删除')
    router.replace('/novel')
    return
  }
  novel.value = detail
  setTitle(detail.title)
}

async function loadChapters() {
  const result = await getNovelChapters(novelID.value, chapterLimit, 0)
  chapters.value = result.chapters
  chapterTotal.value = result.total
}

/** 章节数不设上限，目录分页往下翻，别让前 50 章成为事实上的上限。 */
async function loadMoreChapters() {
  if (chapterBusy.value || chapters.value.length >= chapterTotal.value)
    return
  chapterBusy.value = true
  const result = await getNovelChapters(novelID.value, chapterLimit, chapters.value.length)
  chapters.value = chapters.value.length === 0
    ? result.chapters
    : [...chapters.value, ...result.chapters]
  chapterTotal.value = result.total
  chapterBusy.value = false
}

async function loadReviews() {
  const result = await getNovelComments({
    novelID: novelID.value,
    targetType: 'book',
    limit: reviewLimit,
    offset: 0,
  })
  reviews.value = result.comments
  reviewTotal.value = result.total
}

async function onToggleShelf() {
  if (!novel.value || shelfBusy.value)
    return
  shelfBusy.value = true
  const result = await toggleShelf(novel.value.novelID)
  shelfBusy.value = false
  if (!result) {
    showMsg('操作失败，请稍后重试')
    return
  }
  novel.value.onShelf = result.onShelf
  novel.value.shelfNum += result.onShelf ? 1 : -1
  showMsg(result.msg)
}

async function submitReview() {
  if (!novel.value || reviewBusy.value)
    return
  const content = reviewDraft.value.trim()
  if (!content) {
    showMsg('先写点内容')
    return
  }
  reviewBusy.value = true
  const result = await createNovelComment({ novelID: novel.value.novelID, targetType: 'book', content })
  reviewBusy.value = false
  if (!result.comment) {
    showMsg(result.msg || '发布失败，请稍后重试')
    return
  }
  reviewDraft.value = ''
  reviews.value.unshift(result.comment)
  reviewTotal.value += 1
  novel.value.commentNum += 1
}

function onReviewLiked(c: NovelCommentItem) {
  c.isLiked = !c.isLiked
  c.likeNum += c.isLiked ? 1 : -1
}

// ---------------------------------------------------------------------------
// 打赏作者：扣自己等量经验，作者收到积分（同一本书每人每天最多一次）
// ---------------------------------------------------------------------------

const REWARD_PRESETS = [10, 50, 100]

function pickReward(points: number) {
  rewardPoints.value = points
}

async function onReward() {
  if (!novel.value || rewardBusy.value)
    return
  const points = Math.floor(Number(rewardPoints.value))
  if (!Number.isFinite(points) || points < 10 || points > 1000) {
    showMsg('打赏积分要在 10 到 1000 之间')
    return
  }
  rewardBusy.value = true
  const result = await rewardNovelAuthor(novel.value.novelID, points)
  rewardBusy.value = false
  if (!result) {
    showMsg('打赏失败，请稍后重试')
    return
  }
  if (result.points <= 0) {
    showMsg(result.msg)
    return
  }
  rewardOpen.value = false
  showMsg(`已打赏 ${result.points} 积分 · 扣 ${result.cost} 经验 · 剩余 ${result.experience} 经验`)
}

function pickCover() {
  coverInput.value?.click()
}

async function onCoverFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!novel.value || !file || coverBusy.value)
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
  if (!url) {
    coverBusy.value = false
    showMsg('封面上传失败，请稍后重试')
    return
  }
  const result = await updateNovel(novel.value.novelID, { coverURL: url })
  coverBusy.value = false
  if (!result.ok) {
    showMsg(result.msg)
    return
  }
  novel.value.coverURL = url
  showMsg(result.msg)
}

async function onDeleteNovel() {
  if (!novel.value)
    return
  if (!window.confirm(`确定删除《${novel.value.title}》？所有章节与评论都会一并删除。`))
    return
  const ok = await deleteNovel(novel.value.novelID)
  if (!ok) {
    showMsg('删除失败')
    return
  }
  showMsg('已删除')
  router.replace('/novel')
}

onMounted(async () => {
  loading.value = true
  await refreshDetail()
  if (novel.value) {
    await Promise.all([loadChapters(), loadReviews()])
  }
  loading.value = false
})
</script>

<template>
  <div v-if="novel" class="novel-zone novel-book">
    <header class="novel-book__head">
      <NovelCover class="novel-book__cover" :title="novel.title" :cover-url="novel.coverURL" />
      <div class="novel-book__head-body">
        <h1 class="novel-book__title">
          {{ novel.title }}
        </h1>
        <div class="novel-book__author">
          <UserAvatar
            :src="novel.authorAvatar"
            :user-id="novel.authorID"
            :user-name="novel.authorName"
            :user-score="novel.authorScore"
            :user-identity="novel.authorIdentity"
            no-profile-link
            size="compact"
          />
          <RouterLink
            v-if="novel.authorID > 0"
            class="novel-book__author-link"
            :to="`/user/${novel.authorID}`"
          >
            {{ novel.authorName || '佚名' }}
          </RouterLink>
          <span v-else class="novel-book__author-name">{{ novel.authorName || '佚名' }}</span>
          <span class="novel-book__badge" :class="{ 'novel-book__badge--done': novel.status === 'completed' }">
            {{ novel.status === 'completed' ? '已完结' : '连载中' }}
          </span>
        </div>
        <p class="novel-book__stats">
          <span>{{ novel.chapterNum }}章</span>
          <span class="novel-book__dot">·</span>
          <span>{{ formatWordCount(novel.wordNum) }}</span>
          <span class="novel-book__dot">·</span>
          <span>{{ formatCount(novel.readNum) }}人在读</span>
          <span class="novel-book__dot">·</span>
          <span>{{ formatCount(novel.shelfNum) }}收藏</span>
          <span class="novel-book__dot">·</span>
          <span>{{ formatCount(novel.commentNum) }}评论</span>
        </p>
        <p v-if="novel.latestChapterTitle" class="novel-book__latest">
          最新 {{ novel.latestChapterTitle }}
          <span v-if="novel.latestChapterAt"> · {{ formatNovelTime(novel.latestChapterAt) }}</span>
        </p>
      </div>
    </header>

    <div class="novel-book__actions">
      <RouterLink
        v-if="entryChapter > 0"
        class="novel-book__btn novel-book__btn--primary"
        :to="novelReadPath(entryChapter)"
      >
        <Icon icon="tabler:book" width="16" height="16" aria-hidden="true" />
        {{ hasProgress ? `继续阅读（${novel.progressChapterNum}章 ${novel.progressPercent.toFixed(0)}%）` : '开始阅读' }}
      </RouterLink>
      <button
        type="button"
        class="novel-book__btn"
        :class="{ 'novel-book__btn--on': novel.onShelf }"
        :disabled="shelfBusy"
        @click="onToggleShelf"
      >
        <Icon :icon="novel.onShelf ? 'tabler:bookmark-filled' : 'tabler:bookmark'" width="16" height="16" aria-hidden="true" />
        {{ novel.onShelf ? '已在书架' : '加入书架' }}
      </button>
      <button
        v-if="!novel.isAuthor"
        type="button"
        class="novel-book__btn"
        :class="{ 'novel-book__btn--on': rewardOpen }"
        @click="rewardOpen = !rewardOpen"
      >
        <Icon icon="tabler:coin" width="16" height="16" aria-hidden="true" />
        打赏作者
      </button>
      <RouterLink
        v-if="novel.isAuthor"
        class="novel-book__btn"
        :to="novelWritePath(novel.novelID)"
      >
        <Icon icon="tabler:pencil" width="16" height="16" aria-hidden="true" />
        发布新章
      </RouterLink>
      <button
        v-if="novel.isAuthor"
        type="button"
        class="novel-book__btn"
        :disabled="coverBusy"
        @click="pickCover"
      >
        <Icon icon="tabler:photo" width="16" height="16" aria-hidden="true" />
        {{ coverBusy ? '上传中…' : '换封面' }}
      </button>
      <button v-if="novel.isAuthor" type="button" class="novel-book__btn novel-book__btn--danger" @click="onDeleteNovel">
        <Icon icon="tabler:trash" width="16" height="16" aria-hidden="true" />
        删除
      </button>
      <input
        ref="coverInput"
        type="file"
        accept="image/*"
        class="novel-book__cover-input"
        @change="onCoverFile"
      >
    </div>

    <Transition name="novel-book-reward">
      <div v-if="rewardOpen && !novel.isAuthor" class="novel-book__reward">
        <span class="novel-book__reward-label">
          打赏扣自己等量经验，作者收到积分；同一本书每人每天最多一次（10–1000 积分）
        </span>
        <div class="novel-book__reward-row">
          <button
            v-for="p in REWARD_PRESETS"
            :key="p"
            type="button"
            class="novel-book__reward-chip"
            :class="{ 'novel-book__reward-chip--on': rewardPoints === p }"
            @click="pickReward(p)"
          >
            {{ p }}
          </button>
          <input
            v-model.number="rewardPoints"
            class="novel-book__reward-input"
            type="number"
            min="10"
            max="1000"
            step="10"
          >
          <button type="button" class="novel-book__reward-submit" :disabled="rewardBusy" @click="onReward">
            {{ rewardBusy ? '打赏中…' : '确认打赏' }}
          </button>
        </div>
      </div>
    </Transition>

    <section v-if="novel.intro" class="novel-book__intro-wrap">
      <h2 class="novel-book__section">
        简介
      </h2>
      <p class="novel-book__intro" :class="{ 'novel-book__intro--clamped': introLong && !introExpanded }">
        {{ novel.intro }}
      </p>
      <button v-if="introLong" type="button" class="novel-book__expand" @click="introExpanded = !introExpanded">
        {{ introExpanded ? '收起' : '展开全部' }}
      </button>
    </section>

    <section class="novel-book__toc">
      <h2 class="novel-book__section">
        目录
        <span class="novel-book__section-n">{{ chapterTotal }} 章</span>
      </h2>
      <ul v-if="chapters.length > 0" class="novel-book__toc-list">
        <li v-for="c in chapters" :key="c.chapterID">
          <RouterLink class="novel-book__toc-item" :to="novelReadPath(c.chapterID)">
            <span class="novel-book__toc-num">{{ c.chapterNum }}</span>
            <span class="novel-book__toc-title">{{ c.title }}</span>
            <span class="novel-book__toc-meta">
              <span v-if="c.commentNum > 0">{{ c.commentNum }}评</span>
              <span>{{ formatWordCount(c.wordNum) }}</span>
            </span>
          </RouterLink>
        </li>
      </ul>
      <p v-else class="novel-book__empty">
        还没有章节
      </p>

      <button
        v-if="chapters.length > 0 && chapters.length < chapterTotal"
        type="button"
        class="novel-book__toc-more"
        :disabled="chapterBusy"
        @click="loadMoreChapters"
      >
        {{ chapterBusy ? '加载中…' : `显示更多章节（还有 ${chapterTotal - chapters.length} 章）` }}
      </button>
    </section>

    <section class="novel-book__reviews">
      <h2 class="novel-book__section">
        书评
        <span class="novel-book__section-n">{{ reviewTotal }}</span>
      </h2>

      <div class="novel-book__review-form">
        <textarea
          v-model="reviewDraft"
          class="novel-book__review-input"
          rows="3"
          maxlength="500"
          placeholder="写下你对这本书的评价（最多 500 字）"
        />
        <button
          type="button"
          class="novel-book__review-submit"
          :disabled="reviewBusy"
          @click="submitReview"
        >
          {{ reviewBusy ? '发送中…' : '发布书评' }}
        </button>
      </div>

      <ul v-if="reviews.length > 0" class="novel-book__review-list">
        <NovelCommentCard
          v-for="c in reviews"
          :key="c.commentID"
          :comment="c"
          :deletable="c.authorID === userInfo.userID"
          @like-change="onReviewLiked(c)"
          @deleted="reviewTotal -= 1; novel!.commentNum -= 1"
        />
      </ul>
      <p v-else class="novel-book__empty">
        还没有书评，来说两句
      </p>
    </section>
  </div>

  <div v-else class="novel-book__loading">
    {{ loading ? '加载中…' : '小说不存在' }}
  </div>
</template>

<style scoped lang="scss">
.novel-book {
  width: 100%;
  max-width: 720px;
  min-width: 0;
  margin: 0 auto;
  padding: 8px 10px 24px;
  box-sizing: border-box;
  overflow-x: hidden;
}

.novel-book__head {
  display: flex;
  gap: 12px;
  padding: 12px;
  background: var(--color-card, #fff);
  border-radius: var(--radius-lg, 8px);
  box-shadow: var(--color-card-shadow);
}

.novel-book__cover {
  flex: 0 0 auto;
  width: 84px;
  height: 118px;
  border-radius: 5px;
  background: var(--color-bg, #f5f6f7);
}

.novel-book__cover-input {
  display: none;
}

.novel-book__head-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.novel-book__title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--color-text, #1e293b);
  word-break: break-word;
}

.novel-book__author {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.novel-book__author-link,
.novel-book__author-name {
  font-size: 13px;
  color: var(--color-text-secondary, #475569);
  text-decoration: none;
}

.novel-book__author-link:hover {
  color: var(--accent, #2c3d56);
}

.novel-book__badge {
  padding: 2px 7px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  background: var(--accent-soft, rgba(44, 61, 86, 0.08));
  color: var(--accent, #2c3d56);

  &--done {
    background: rgba(15, 118, 110, 0.1);
    color: #0f766e;
  }
}

.novel-book__stats,
.novel-book__latest {
  margin: 0;
  font-size: 11px;
  color: var(--color-text-muted, #94a3b8);
}

.novel-book__latest {
  color: var(--color-text-secondary, #475569);
}

.novel-book__dot {
  margin: 0 3px;
  opacity: 0.6;
}

.novel-book__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.novel-book__btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 9px 14px;
  border: 1px solid var(--color-border, rgba(71, 85, 105, 0.12));
  border-radius: 9px;
  background: var(--color-card, #fff);
  color: var(--color-text, #1e293b);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;

  &--primary {
    border-color: var(--accent, #2c3d56);
    background: var(--accent, #2c3d56);
    color: #fff;
  }

  &--on {
    border-color: var(--accent, #2c3d56);
    color: var(--accent, #2c3d56);
    background: var(--accent-soft, rgba(44, 61, 86, 0.08));
  }

  &--danger {
    color: #b91c1c;
    border-color: rgba(185, 28, 28, 0.25);
  }

  &:disabled {
    opacity: 0.55;
    cursor: default;
  }
}

/* ---------------- 打赏面板 ---------------- */

.novel-book__reward {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
  padding: 10px 12px;
  border: 1px solid var(--color-border, rgba(71, 85, 105, 0.12));
  border-radius: 10px;
  background: var(--accent-soft, rgba(44, 61, 86, 0.06));
}

.novel-book__reward-label {
  font-size: 11px;
  line-height: 1.5;
  color: var(--color-text-muted, #94a3b8);
}

.novel-book__reward-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.novel-book__reward-chip {
  min-width: 44px;
  padding: 7px 10px;
  border: 1px solid var(--color-border, rgba(71, 85, 105, 0.16));
  border-radius: 8px;
  background: var(--color-card, #fff);
  color: var(--color-text-secondary, #475569);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;

  &--on {
    border-color: var(--accent, #2c3d56);
    background: var(--accent, #2c3d56);
    color: #fff;
  }
}

.novel-book__reward-input {
  width: 92px;
  padding: 7px 10px;
  border: 1px solid var(--color-border, rgba(71, 85, 105, 0.16));
  border-radius: 8px;
  background: var(--color-card, #fff);
  font-size: 12px;
  color: var(--color-text, #1e293b);

  &:focus {
    outline: none;
    border-color: var(--accent, #2c3d56);
  }
}

.novel-book__reward-submit {
  margin-left: auto;
  padding: 8px 14px;
  border: none;
  border-radius: 8px;
  background: var(--accent, #2c3d56);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;

  &:disabled {
    opacity: 0.55;
    cursor: default;
  }
}

.novel-book-reward-enter-active,
.novel-book-reward-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}

.novel-book-reward-enter-from,
.novel-book-reward-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

.novel-book__section {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin: 16px 0 8px;
  font-size: 14px;
  font-weight: 700;
  color: var(--color-text, #1e293b);
}

.novel-book__section-n {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-muted, #94a3b8);
}

.novel-book__intro {
  margin: 0;
  font-size: 13px;
  line-height: 1.7;
  color: var(--color-text-secondary, #475569);
  white-space: pre-wrap;
  word-break: break-word;

  &--clamped {
    display: -webkit-box;
    -webkit-line-clamp: 4;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
}

.novel-book__expand {
  margin-top: 4px;
  padding: 0;
  border: none;
  background: none;
  color: var(--accent, #2c3d56);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.novel-book__toc-list {
  list-style: none;
  margin: 0;
  padding: 0;
  background: var(--color-card, #fff);
  border-radius: var(--radius-lg, 8px);
  box-shadow: var(--color-card-shadow);
  overflow: hidden;
}

/* 章节数不设上限：目录往下翻 */
.novel-book__toc-more {
  width: 100%;
  margin-top: 8px;
  padding: 9px;
  border: 1px dashed var(--color-border, rgba(71, 85, 105, 0.2));
  border-radius: 9px;
  background: transparent;
  color: var(--accent, #2c3d56);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;

  &:disabled {
    opacity: 0.55;
    cursor: default;
  }
}

.novel-book__toc-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--color-border, rgba(71, 85, 105, 0.08));
  color: inherit;
  text-decoration: none;

  &:last-child {
    border-bottom: none;
  }

  &:active {
    background: var(--color-hover, rgba(44, 61, 86, 0.06));
  }
}

.novel-book__toc-num {
  flex: 0 0 auto;
  min-width: 22px;
  font-size: 12px;
  font-weight: 700;
  color: var(--color-text-muted, #94a3b8);
  text-align: right;
}

.novel-book__toc-title {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  color: var(--color-text, #1e293b);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.novel-book__toc-meta {
  flex: 0 0 auto;
  display: flex;
  gap: 6px;
  font-size: 11px;
  color: var(--color-text-muted, #94a3b8);
}

.novel-book__review-form {
  padding: 10px;
  margin-bottom: 8px;
  background: var(--color-card, #fff);
  border-radius: var(--radius-lg, 8px);
  box-shadow: var(--color-card-shadow);
}

.novel-book__review-input {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid var(--color-border, rgba(71, 85, 105, 0.12));
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 13px;
  font-family: inherit;
  resize: vertical;
  background: var(--color-bg, #f5f6f7);
  color: var(--color-text, #1e293b);

  &:focus {
    outline: none;
    border-color: var(--accent, #2c3d56);
  }
}

.novel-book__review-submit {
  margin-top: 6px;
  padding: 7px 14px;
  border: none;
  border-radius: 8px;
  background: var(--accent, #2c3d56);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;

  &:disabled {
    opacity: 0.55;
    cursor: default;
  }
}

.novel-book__review-list {
  list-style: none;
  margin: 0;
  padding: 0 10px;
  background: var(--color-card, #fff);
  border-radius: var(--radius-lg, 8px);
  box-shadow: var(--color-card-shadow);
}

.novel-book__empty {
  padding: 14px;
  margin: 0;
  text-align: center;
  font-size: 12px;
  color: var(--color-text-muted, #94a3b8);
  background: var(--color-card, #fff);
  border-radius: var(--radius-lg, 8px);
}

.novel-book__loading {
  padding: 32px;
  text-align: center;
  font-size: 13px;
  color: var(--color-text-muted, #94a3b8);
}
</style>
