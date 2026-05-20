<script setup lang="ts">
import type { ResumeItem } from '@/api/resume/types'
import { Icon } from '@iconify/vue'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getResumes } from '@/api/resume/getResumes'
import ResumeCard from '@/components/card/ResumeCard.vue'
defineOptions({ name: 'ResumeView' })

const router = useRouter()
const route = useRoute()

const isLoading = ref(true)
const resumes = ref<ResumeItem[]>([])
const searchKeyword = ref('')
const tab = ref<'home' | 'my'>('home')

const isMyTab = computed(() => tab.value === 'my' || route.path === '/resume/my')

async function loadResumes() {
  isLoading.value = true
  const sort = isMyTab.value ? 'my' : 'home'
  resumes.value = await getResumes(sort, searchKeyword.value.trim())
  isLoading.value = false
}

function switchTab(next: 'home' | 'my') {
  tab.value = next
  if (next === 'my')
    router.replace('/resume/my')
  else
    router.replace('/resume')
}

function goUpload() {
  router.push('/resume/upload')
}

function goDetail(resume: ResumeItem) {
  router.push(`/resume/${resume.resumeID}`)
}

onMounted(() => {
  if (route.path === '/resume/my')
    tab.value = 'my'
  loadResumes()
})

watch(() => route.path, (path) => {
  tab.value = path === '/resume/my' ? 'my' : 'home'
  loadResumes()
})
</script>

<template>
  <div class="resume-page">
    <header class="resume-page__head">
      <Icon icon="tabler:file-cv" class="resume-page__head-icon" width="22" height="22" aria-hidden="true" />
      <div>
        <h1 class="resume-page__title">
          简历专区
        </h1>
        <p class="resume-page__subtitle">
          上传与分享简历，支持 PDF、Word、图片格式
        </p>
      </div>
    </header>

    <div class="resume-page__toolbar">
      <div class="resume-page__tabs">
        <button
          type="button"
          class="resume-page__tab"
          :class="{ 'resume-page__tab--active': !isMyTab }"
          @click="switchTab('home')"
        >
          全部简历
        </button>
        <button
          type="button"
          class="resume-page__tab"
          :class="{ 'resume-page__tab--active': isMyTab }"
          @click="switchTab('my')"
        >
          我的简历
        </button>
      </div>
      <div class="resume-page__actions">
        <form class="resume-page__search" @submit.prevent="loadResumes">
          <input
            v-model="searchKeyword"
            type="search"
            class="resume-page__search-input"
            placeholder="搜索标题、简介或文件名"
          >
          <button type="submit" class="resume-page__search-btn">
            搜索
          </button>
        </form>
        <button type="button" class="resume-page__upload-btn" @click="goUpload">
          <Icon icon="tabler:upload" width="18" height="18" aria-hidden="true" />
          上传简历
        </button>
      </div>
    </div>

    <div v-if="isLoading" class="resume-page__state">
      加载中…
    </div>
    <div v-else-if="resumes.length === 0" class="resume-page__state">
      {{ isMyTab ? '你还没有上传简历' : '暂无简历，快来上传第一份吧' }}
    </div>
    <div v-else class="resume-page__list">
      <ResumeCard
        v-for="item in resumes"
        :key="item.resumeID"
        :resume="item"
        @view-detail="goDetail"
      />
    </div>

  </div>
</template>

<style scoped lang="scss">
.resume-page {
  width: 100%;
  max-width: 720px;
  margin: 0 auto;
  padding: 0 14px 5rem;
  box-sizing: border-box;
  color: var(--chat-text);
}

.resume-page__head {
  display: flex;
  align-items: flex-start;
  gap: 0.65rem;
  margin-bottom: 1rem;
}

.resume-page__head-icon {
  color: var(--chat-accent);
  flex-shrink: 0;
  margin-top: 2px;
}

.resume-page__title {
  margin: 0;
  font-size: 1.35rem;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.resume-page__subtitle {
  margin: 0.3rem 0 0;
  font-size: 0.875rem;
  color: var(--chat-text-secondary);
}

.resume-page__toolbar {
  margin-bottom: 1rem;
}

.resume-page__tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.resume-page__tab {
  padding: 0.4rem 0.9rem;
  border-radius: 999px;
  border: 1px solid var(--chat-border);
  background: var(--chat-bg);
  color: var(--chat-text-secondary);
  font-size: 0.875rem;
  cursor: pointer;

  &--active {
    border-color: var(--chat-accent);
    color: var(--chat-accent);
    background: var(--chat-bg-elevated);
  }
}

.resume-page__actions {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.resume-page__search {
  display: flex;
  gap: 0.5rem;
}

.resume-page__upload-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  padding: 0.55rem 1rem;
  border-radius: 10px;
  border: none;
  background: var(--chat-accent);
  color: #fff;
  font-size: 0.875rem;
  cursor: pointer;
  align-self: flex-start;
}

.resume-page__search-input {
  flex: 1;
  padding: 0.5rem 0.75rem;
  border-radius: 10px;
  border: 1px solid var(--chat-border);
  background: var(--chat-bg-elevated);
  color: var(--chat-text);
  font-size: 0.875rem;
}

.resume-page__search-btn {
  padding: 0.5rem 1rem;
  border-radius: 10px;
  border: none;
  background: var(--chat-accent);
  color: #fff;
  font-size: 0.875rem;
  cursor: pointer;
}

.resume-page__list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.resume-page__state {
  text-align: center;
  padding: 2.5rem 1rem;
  color: var(--chat-text-secondary);
  font-size: 0.9rem;
}
</style>
