<script setup lang="ts">
import type { VoteSearchPost } from '@/api/vote/vote'
import { Icon } from '@iconify/vue'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { checkUserVoted, searchPostsByTitle, submitVote } from '@/api/vote/vote'
import { showMsg } from '@/components/MessageBox'
import { useUserStore } from '@/store/userStore'

const route = useRoute()
const router = useRouter()
const { userInfo } = useUserStore()

const keyword = ref('')
const searchResults = ref<VoteSearchPost[]>([])
const selectedPost = ref<VoteSearchPost | null>(null)
const searching = ref(false)
const submitting = ref(false)
const alreadyVoted = ref(false)

const canVote = computed(() => !!selectedPost.value && !alreadyVoted.value && !submitting.value)

let searchTimer: ReturnType<typeof setTimeout> | null = null
let skipSearch = false

async function doSearch() {
  const kw = keyword.value.trim()
  if (!kw) {
    searchResults.value = []
    return
  }
  searching.value = true
  try {
    searchResults.value = await searchPostsByTitle(kw, userInfo.phone)
  }
  catch (e) {
    console.error(e)
    showMsg('搜索失败')
  }
  finally {
    searching.value = false
  }
}

watch(keyword, () => {
  if (skipSearch)
    return
  if (selectedPost.value && keyword.value === selectedPost.value.title)
    return
  selectedPost.value = null
  alreadyVoted.value = false
  if (searchTimer)
    clearTimeout(searchTimer)
  searchTimer = setTimeout(doSearch, 300)
})

async function selectPost(post: VoteSearchPost) {
  selectedPost.value = post
  skipSearch = true
  keyword.value = post.title
  searchResults.value = []
  skipSearch = false
  alreadyVoted.value = await checkUserVoted(post.postID, userInfo.phone)
}

async function handleVote() {
  if (!selectedPost.value || alreadyVoted.value)
    return
  submitting.value = true
  try {
    const { ok, msg } = await submitVote(selectedPost.value.postID, userInfo.phone)
    showMsg(msg)
    if (ok)
      alreadyVoted.value = true
  }
  catch (e) {
    console.error(e)
    showMsg('投票失败')
  }
  finally {
    submitting.value = false
  }
}

function applyTitleFromQuery() {
  const title = (route.query.title as string)?.trim()
  if (!title)
    return
  skipSearch = true
  keyword.value = title
  skipSearch = false
  doSearch()
}

onMounted(() => {
  applyTitleFromQuery()
})
</script>

<template>
  <div class="vote-page">
    <header class="vote-page__head">
      <button type="button" class="vote-page__back" aria-label="返回" @click="router.back()">
        <Icon icon="tabler:arrow-left" width="22" height="22" />
      </button>
      <div class="vote-page__title-row">
        <Icon icon="tabler:ballot" class="vote-page__title-icon" width="22" height="22" aria-hidden="true" />
        <h1 class="vote-page__title">
          投票
        </h1>
      </div>
      <p class="vote-page__subtitle">
        输入标题关键字搜索帖子，选中后投票（每帖仅可投一票）
      </p>
    </header>

    <div class="vote-page__search">
      <input
        v-model="keyword"
        type="search"
        class="vote-page__input"
        placeholder="输入标题关键字…"
        autocomplete="off"
      >
      <p v-if="searching" class="vote-page__hint">
        搜索中…
      </p>
    </div>

    <ul v-if="searchResults.length > 0 && !selectedPost" class="vote-page__results">
      <li
        v-for="post in searchResults"
        :key="post.postID"
        class="vote-page__result-item"
        @click="selectPost(post)"
      >
        <span class="vote-page__result-title">{{ post.title }}</span>
        <span class="vote-page__result-meta">{{ post.partition }} · {{ post.voteCount }} 票</span>
      </li>
    </ul>

    <div v-if="selectedPost" class="vote-page__selected">
      <p class="vote-page__selected-label">
        已选帖子
      </p>
      <p class="vote-page__selected-title">
        {{ selectedPost.title }}
      </p>
      <p v-if="alreadyVoted" class="vote-page__voted-tip">
        您已为该帖投过票
      </p>
      <button
        type="button"
        class="vote-page__submit"
        :disabled="!canVote"
        @click="handleVote"
      >
        {{ submitting ? '提交中…' : alreadyVoted ? '已投票' : '确认投票' }}
      </button>
    </div>

    <RouterLink to="/ranking" class="vote-page__link-rank">
      查看排行榜 →
    </RouterLink>
  </div>
</template>

<style scoped lang="scss">
.vote-page {
  width: 100%;
  max-width: 720px;
  margin: 0 auto;
  padding: 12px 12px 1.5rem;
  box-sizing: border-box;
  color: var(--chat-text);
  background: var(--chat-bg-elevated);
  border: 1px solid var(--chat-border);
  border-radius: 18px;
}

.vote-page__head {
  margin-bottom: 1rem;
  position: relative;
}

.vote-page__back {
  position: absolute;
  left: 0;
  top: 0;
  padding: 4px;
  border: none;
  background: transparent;
  color: var(--chat-text-secondary);
  cursor: pointer;
  border-radius: 8px;

  &:hover {
    color: var(--chat-accent);
    background: rgba(59, 130, 246, 0.1);
  }
}

.vote-page__title-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding-left: 2rem;
}

.vote-page__title-icon {
  color: var(--chat-accent);
}

.vote-page__title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
}

.vote-page__subtitle {
  margin: 0.35rem 0 0;
  padding-left: 2rem;
  font-size: 0.8125rem;
  color: var(--chat-text-secondary);
}

.vote-page__input {
  width: 100%;
  padding: 10px 12px;
  font-size: 1rem;
  border: 1px solid var(--chat-border);
  border-radius: 10px;
  background: var(--chat-bg);
  color: var(--chat-text);
  box-sizing: border-box;

  &:focus {
    outline: none;
    border-color: var(--chat-accent);
  }
}

.vote-page__hint {
  margin: 8px 0 0;
  font-size: 0.8125rem;
  color: var(--chat-text-secondary);
}

.vote-page__results {
  list-style: none;
  margin: 12px 0 0;
  padding: 0;
  border: 1px solid var(--chat-border);
  border-radius: 10px;
  overflow: hidden;
}

.vote-page__result-item {
  padding: 12px 14px;
  cursor: pointer;
  border-bottom: 1px solid var(--chat-border);
  transition: background 0.15s ease;

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: rgba(59, 130, 246, 0.08);
  }
}

.vote-page__result-title {
  display: block;
  font-weight: 500;
}

.vote-page__result-meta {
  display: block;
  margin-top: 4px;
  font-size: 0.75rem;
  color: var(--chat-text-secondary);
}

.vote-page__selected {
  margin-top: 1rem;
  padding: 14px;
  border-radius: 10px;
  background: rgba(59, 130, 246, 0.06);
  border: 1px solid var(--chat-border);
}

.vote-page__selected-label {
  margin: 0;
  font-size: 0.75rem;
  color: var(--chat-text-secondary);
}

.vote-page__selected-title {
  margin: 6px 0 12px;
  font-size: 1.0625rem;
  font-weight: 600;
}

.vote-page__voted-tip {
  margin: 0 0 10px;
  font-size: 0.875rem;
  color: #ea580c;
}

.vote-page__submit {
  width: 100%;
  padding: 11px;
  font-size: 1rem;
  font-weight: 600;
  color: #fff;
  background: var(--chat-accent);
  border: none;
  border-radius: 10px;
  cursor: pointer;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.vote-page__link-rank {
  display: inline-block;
  margin-top: 1.25rem;
  font-size: 0.875rem;
  color: var(--chat-accent);
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
}
</style>
