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
  rateNovel,
  toggleShelf,
  updateNovel,
  uploadNovelImage,
} from '@/api/novel'
import CoinThrowButton from '@/components/CoinThrowButton.vue'
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

/** 读者评分（1–5 星，每人每本一条，可改） */
const ratingOpen = ref(false)
const ratingBusy = ref(false)
const ratingHover = ref(0)

const chapterLimit = 50
const reviewLimit = 20

/** 书评排序 / 搜索 / 分页 */
const reviewOrder = ref<'latest' | 'likes'>('latest')
const reviewKeywordInput = ref('')
const reviewKeyword = ref('')
const reviewBusyMore = ref(false)

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
    keyword: reviewKeyword.value,
    order: reviewOrder.value,
    limit: reviewLimit,
    offset: 0,
  })
  reviews.value = result.comments
  reviewTotal.value = result.total
}

/** 书评分页：往后追加，按 commentID 去重防翻页间隙的数据变动造成重复 */
async function loadMoreReviews() {
  if (reviewBusyMore.value || reviews.value.length >= reviewTotal.value)
    return
  reviewBusyMore.value = true
  try {
    const result = await getNovelComments({
      novelID: novelID.value,
      targetType: 'book',
      keyword: reviewKeyword.value,
      order: reviewOrder.value,
      limit: reviewLimit,
      offset: reviews.value.length,
    })
    const seen = new Set(reviews.value.map(c => c.commentID))
    for (const c of result.comments) {
      if (!seen.has(c.commentID))
        reviews.value.push(c)
    }
    reviewTotal.value = result.total
  }
  finally {
    reviewBusyMore.value = false
  }
}

function setReviewOrder(order: 'latest' | 'likes') {
  if (reviewOrder.value === order)
    return
  reviewOrder.value = order
  void loadReviews()
}

function searchReviews() {
  reviewKeyword.value = reviewKeywordInput.value.trim()
  void loadReviews()
}

function clearReviewSearch() {
  reviewKeywordInput.value = ''
  if (reviewKeyword.value) {
    reviewKeyword.value = ''
    void loadReviews()
  }
}

/** 删除书评：从列表里移除这一条，再减计数 */
function onReviewDeleted(commentID: number) {
  reviews.value = reviews.value.filter(c => c.commentID !== commentID)
  reviewTotal.value = Math.max(reviewTotal.value - 1, 0)
  if (novel.value)
    novel.value.commentNum = Math.max(novel.value.commentNum - 1, 0)
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
  // 重新拉列表而不是本地 unshift：排序/搜索态下新评论的位置与总数由后端说了算
  novel.value.commentNum += 1
  void loadReviews()
}

function onReviewLiked(c: NovelCommentItem) {
  c.isLiked = !c.isLiked
  c.likeNum += c.isLiked ? 1 : -1
}

// ---------------------------------------------------------------------------
// 评分：1–5 星，每人每本一条，可改。作者首次收到该读者的评分时 +1 币；
// 评分不给读者任何币或经验（币与积分是两条独立的线）。
// ---------------------------------------------------------------------------

async function onRate(score: number) {
  if (!novel.value || ratingBusy.value)
    return
  ratingBusy.value = true
  const result = await rateNovel(novel.value.novelID, score)
  ratingBusy.value = false
  if (!result || result.score <= 0) {
    showMsg(result?.msg || '评分失败，请稍后重试')
    return
  }
  novel.value.myRating = result.score
  novel.value.ratingCount = result.ratingCount
  novel.value.ratingAvg = result.ratingAvg
  ratingOpen.value = false
  // 评分会自动附带一条书评（星级 + 当时阅读时长）：刷新评论区让它立刻可见
  if (result.commentCreated)
    novel.value.commentNum += 1
  void loadReviews()
  if (result.coins > 0)
    showMsg(`已评 ${result.score} 星 · 作者 +${result.coins} 币`)
  else
    showMsg(result.changed ? `已改评为 ${result.score} 星` : `已评 ${result.score} 星`)
}

function pickCover() {
  coverInput.value?.click()
}

/** 分布条宽度：占全部评分人数的百分比（0–100，做个 4% 的最低可见宽度） */
function ratingBarPercent(n: number): number {
  if (novel.value == null || novel.value.ratingCount <= 0 || n <= 0)
    return 0
  return Math.max((n / novel.value.ratingCount) * 100, 4)
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
          <span class="novel-book__dot">·</span>
          <span>{{ formatCount(novel.coinNum) }}币</span>
          <template v-if="novel.ratingCount > 0">
            <span class="novel-book__dot">·</span>
            <span>{{ novel.ratingAvg.toFixed(1) }}分（{{ novel.ratingCount }}人评）</span>
          </template>
        </p>
        <p v-if="novel.latestChapterTitle" class="novel-book__latest">
          最新 {{ novel.latestChapterTitle }}
          <span v-if="novel.latestChapterAt"> · {{ formatNovelTime(novel.latestChapterAt) }}</span>
        </p>
      </div>
    </header>

    <!-- 评分概览：均分 + 星级 + 各星级人数分布条 -->
    <section v-if="novel.ratingCount > 0" class="novel-book__rating-summary">
      <div class="novel-book__rating-score">
        <b>{{ novel.ratingAvg.toFixed(1) }}</b>
        <span class="novel-book__rating-stars" aria-hidden="true">
          <Icon
            v-for="s in 5"
            :key="s"
            icon="tabler:star-filled"
            width="13"
            height="13"
            :class="{ 'novel-book__rating-star-off': s > Math.round(novel.ratingAvg) }"
          />
        </span>
        <span class="novel-book__rating-count">{{ novel.ratingCount }}人评</span>
      </div>
      <div class="novel-book__rating-bars">
        <div
          v-for="(n, i) in novel.ratingBars"
          :key="i"
          class="novel-book__rating-bar-row"
        >
          <span class="novel-book__rating-bar-label">{{ 5 - i }}星</span>
          <span class="novel-book__rating-bar-track">
            <span
              class="novel-book__rating-bar-fill"
              :style="{ width: `${ratingBarPercent(n)}%` }"
            />
          </span>
          <span class="novel-book__rating-bar-n">{{ n }}</span>
        </div>
      </div>
    </section>

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
      <CoinThrowButton
        v-if="!novel.isAuthor"
        target-type="novel"
        :target-i-d="novel.novelID"
        :my-coins="novel.myCoins"
        :coin-num="novel.coinNum"
        target-label="小说"
        variant="prominent"
        class="novel-book__coin"
      />
      <button
        v-if="!novel.isAuthor"
        type="button"
        class="novel-book__btn"
        :class="{ 'novel-book__btn--on': ratingOpen }"
        @click="ratingOpen = !ratingOpen"
      >
        <Icon icon="tabler:star" width="16" height="16" aria-hidden="true" />
        {{ novel.myRating > 0 ? `已评 ${novel.myRating} 星` : '给书评分' }}
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
      <div v-if="ratingOpen && !novel.isAuthor" class="novel-book__reward">
        <span class="novel-book__reward-label">
          1–5 星，每人每本一条、可以改；作者首次收到你的评分时 +1 币，评分不花你的币也不给经验；
          评分会自动附一条书评（星级 + 当时在这本书的阅读时长），在评论区可见
        </span>
        <div class="novel-book__reward-row novel-book__rating-row">
          <button
            v-for="s in 5"
            :key="s"
            type="button"
            class="novel-book__rating-star"
            :class="{ 'novel-book__rating-star--on': s <= (ratingHover || novel.myRating) }"
            :disabled="ratingBusy"
            @mouseenter="ratingHover = s"
            @mouseleave="ratingHover = 0"
            @click="onRate(s)"
          >
            <Icon icon="tabler:star-filled" width="22" height="22" aria-hidden="true" />
          </button>
          <span class="novel-book__rating-hint">
            {{ ratingBusy ? '提交中…' : (novel.myRating > 0 ? `当前 ${novel.myRating} 星` : '点击星星评分') }}
          </span>
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

      <!-- 排序 + 搜索 -->
      <div class="novel-book__review-tools">
        <div class="novel-book__review-sort" role="tablist" aria-label="书评排序">
          <button
            type="button"
            :class="{ 'novel-book__review-sort-on': reviewOrder === 'latest' }"
            @click="setReviewOrder('latest')"
          >
            最新
          </button>
          <button
            type="button"
            :class="{ 'novel-book__review-sort-on': reviewOrder === 'likes' }"
            @click="setReviewOrder('likes')"
          >
            最多点赞
          </button>
        </div>
        <div class="novel-book__review-search">
          <Icon icon="tabler:search" width="14" height="14" aria-hidden="true" />
          <input
            v-model="reviewKeywordInput"
            type="search"
            placeholder="搜索书评内容"
            aria-label="搜索书评"
            @keyup.enter="searchReviews"
          >
          <button
            v-if="reviewKeyword"
            type="button"
            class="novel-book__review-search-clear"
            aria-label="清除搜索"
            @click="clearReviewSearch"
          >
            <Icon icon="tabler:x" width="13" height="13" aria-hidden="true" />
          </button>
          <button type="button" class="novel-book__review-search-go" @click="searchReviews">
            搜索
          </button>
        </div>
      </div>

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
          @deleted="onReviewDeleted"
        />
      </ul>
      <p v-else class="novel-book__empty">
        {{ reviewKeyword ? `没有找到包含「${reviewKeyword}」的书评` : '还没有书评，来说两句' }}
      </p>

      <button
        v-if="reviews.length > 0 && reviews.length < reviewTotal"
        type="button"
        class="novel-book__toc-more"
        :disabled="reviewBusyMore"
        @click="loadMoreReviews"
      >
        {{ reviewBusyMore ? '加载中…' : `加载更多书评（还有 ${reviewTotal - reviews.length} 条）` }}
      </button>
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

/* 投币钮混在书详情操作行里：高度与相邻按钮对齐，配色跟本页的 accent（不是评论区蓝）。
   选择器带一层 __actions 是为了压过组件自身的 prominent 样式。 */
.novel-book__actions .novel-book__coin {
  min-height: 38px;
  padding: 9px 14px;
  border-radius: 9px;
  color: var(--accent, #2c3d56);
  border-color: var(--accent, #2c3d56);

  &.coin-throw--thrown {
    background: var(--accent-soft, rgba(44, 61, 86, 0.08));
  }
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

.novel-book__rating-row {
  gap: 2px;
}

.novel-book__rating-star {
  padding: 2px;
  border: none;
  background: transparent;
  color: var(--color-border, rgba(71, 85, 105, 0.3));
  cursor: pointer;
  transition:
    color 0.1s ease,
    transform 0.1s ease;

  &--on {
    color: #f59e0b;
  }

  &:hover:not(:disabled) {
    transform: scale(1.12);
  }

  &:disabled {
    opacity: 0.55;
    cursor: default;
  }
}

.novel-book__rating-hint {
  margin-left: 8px;
  font-size: 12px;
  color: var(--color-text-secondary, #475569);
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

/* ---------------------------------------------------------------------------
   评分概览：左边均分 + 星 + 人数，右边 5→1 星分布条
   --------------------------------------------------------------------------- */
.novel-book__rating-summary {
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 12px 14px;
  margin-top: 12px;
  background: var(--color-card, #fff);
  border-radius: var(--radius-lg, 8px);
  box-shadow: var(--color-card-shadow);
}

.novel-book__rating-score {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;

  b {
    font-size: 30px;
    line-height: 1.1;
    color: #b45309;
    font-variant-numeric: tabular-nums;
  }
}

.novel-book__rating-stars {
  display: inline-flex;
  gap: 1px;
  color: #f59e0b;
}

.novel-book__rating-star-off {
  color: var(--color-border, rgba(71, 85, 105, 0.25));
}

.novel-book__rating-count {
  font-size: 11px;
  color: var(--color-text-muted, #94a3b8);
}

.novel-book__rating-bars {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.novel-book__rating-bar-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: var(--color-text-secondary, #475569);
}

.novel-book__rating-bar-label {
  flex-shrink: 0;
  width: 22px;
  text-align: right;
}

.novel-book__rating-bar-track {
  flex: 1;
  height: 7px;
  overflow: hidden;
  background: var(--color-bg, #eef1f4);
  border-radius: 999px;
}

.novel-book__rating-bar-fill {
  display: block;
  height: 100%;
  background: #f59e0b;
  border-radius: 999px;
  transition: width 0.3s ease;
}

.novel-book__rating-bar-n {
  flex-shrink: 0;
  min-width: 20px;
  color: var(--color-text-muted, #94a3b8);
  font-variant-numeric: tabular-nums;
}

/* ---------------------------------------------------------------------------
   书评工具栏：排序 pills + 搜索框
   --------------------------------------------------------------------------- */
.novel-book__review-tools {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.novel-book__review-sort {
  display: inline-flex;
  padding: 2px;
  background: var(--color-card, #fff);
  border-radius: 999px;
  box-shadow: var(--color-card-shadow);

  button {
    padding: 4px 12px;
    border: none;
    border-radius: 999px;
    background: transparent;
    color: var(--color-text-secondary, #475569);
    font-size: 12px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    transition:
      background 0.15s ease,
      color 0.15s ease;
  }
}

.novel-book__review-sort-on {
  background: var(--accent, #2c3d56) !important;
  color: #fff !important;
}

.novel-book__review-search {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 0 1 240px;
  padding: 5px 6px 5px 10px;
  background: var(--color-card, #fff);
  border: 1px solid var(--color-border, rgba(71, 85, 105, 0.14));
  border-radius: 999px;
  color: var(--color-text-muted, #94a3b8);

  &:focus-within {
    border-color: var(--accent, #2c3d56);
  }

  input {
    flex: 1;
    min-width: 0;
    border: none;
    outline: none;
    background: transparent;
    font-size: 12px;
    font-family: inherit;
    color: var(--color-text, #1e293b);

    &::-webkit-search-cancel-button {
      display: none;
    }
  }
}

.novel-book__review-search-clear {
  display: inline-flex;
  padding: 2px;
  border: none;
  border-radius: 50%;
  background: var(--color-bg, #eef1f4);
  color: var(--color-text-secondary, #475569);
  cursor: pointer;
}

.novel-book__review-search-go {
  flex-shrink: 0;
  padding: 3px 10px;
  border: none;
  border-radius: 999px;
  background: var(--accent, #2c3d56);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
}
</style>
