<script setup lang="ts">
import type { PublicVideo } from '@/types/video'
import { Icon } from '@iconify/vue'
import { computed, onMounted, ref } from 'vue'
import { getVideos } from '@/api/video/getVideos'
import VideoCard from '@/components/video/VideoCard.vue'

defineOptions({
  name: 'VideoView',
})

const PAGE_SIZE = 12

const videos = ref<PublicVideo[]>([])
const total = ref(0)
const page = ref(1)
const keyword = ref('')
const searchInput = ref('')
const isLoading = ref(true)
const error = ref('')

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)))

async function loadVideos() {
  isLoading.value = true
  error.value = ''
  try {
    const data = await getVideos({
      page: page.value,
      pageSize: PAGE_SIZE,
      keyword: keyword.value,
    })
    videos.value = data.list
    total.value = data.total
  }
  catch (err) {
    error.value = err instanceof Error ? err.message : '视频加载失败'
  }
  finally {
    isLoading.value = false
  }
}

function search() {
  keyword.value = searchInput.value.trim()
  page.value = 1
  loadVideos()
}

function changePage(next: number) {
  if (next < 1 || next > totalPages.value || next === page.value)
    return
  page.value = next
  loadVideos()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

onMounted(loadVideos)
</script>

<template>
  <div class="video-view">
    <div class="page-head">
      <div>
        <h1>视频</h1>
        <p>共 {{ total }} 个视频</p>
      </div>
      <form class="search" @submit.prevent="search">
        <input v-model="searchInput" type="search" placeholder="搜索视频" aria-label="搜索视频">
        <button type="submit" aria-label="搜索">
          <Icon icon="tabler:search" width="18" height="18" />
        </button>
      </form>
    </div>

    <div v-if="isLoading" class="state" aria-live="polite">
      加载中…
    </div>
    <div v-else-if="error" class="state state--error" aria-live="assertive">
      <p>{{ error }}</p>
      <button type="button" @click="loadVideos">
        重试
      </button>
    </div>
    <div v-else-if="videos.length === 0" class="state">
      <p>暂无视频</p>
    </div>
    <template v-else>
      <div class="video-grid">
        <VideoCard v-for="video in videos" :key="video.videoID" :video="video" />
      </div>
      <nav v-if="totalPages > 1" class="pagination" aria-label="视频分页">
        <button type="button" :disabled="page === 1" @click="changePage(page - 1)">
          上一页
        </button>
        <span>{{ page }} / {{ totalPages }}</span>
        <button type="button" :disabled="page === totalPages" @click="changePage(page + 1)">
          下一页
        </button>
      </nav>
    </template>
  </div>
</template>

<style scoped>
.video-view {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px 20px 40px;
}

.page-head {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 24px;
}

.page-head h1 {
  margin: 0;
  color: #0f172a;
  font-size: 26px;
  line-height: 1.2;
}

.page-head p {
  margin: 6px 0 0;
  color: #64748b;
  font-size: 13px;
}

.search {
  display: flex;
  align-items: center;
  min-width: 220px;
  overflow: hidden;
  border: 1px solid #d7dee8;
  border-radius: 6px;
  background: #fff;
}

.search input {
  min-width: 0;
  flex: 1;
  padding: 8px 10px;
  border: 0;
  outline: none;
  font-size: 14px;
}

.search button {
  display: grid;
  place-items: center;
  width: 36px;
  height: 34px;
  color: #334155;
  border: 0;
  background: transparent;
}

.video-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 18px;
}

.state {
  display: grid;
  place-items: center;
  min-height: 280px;
  color: #64748b;
  border: 1px dashed #d7dee8;
  border-radius: 8px;
}

.state--error p {
  margin: 0 0 12px;
}

.state button {
  padding: 7px 14px;
  color: #fff;
  border: 0;
  border-radius: 5px;
  background: #0f766e;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-top: 28px;
  color: #475569;
}

.pagination button {
  min-width: 70px;
  padding: 7px 12px;
  color: #1e293b;
  cursor: pointer;
  border: 1px solid #d7dee8;
  border-radius: 5px;
  background: #fff;
}

.pagination button:disabled {
  color: #94a3b8;
  cursor: not-allowed;
  background: #f8fafc;
}

@media (min-width: 640px) {
  .video-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 1024px) {
  .video-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .video-view {
    padding: 18px 14px 34px;
  }

  .page-head {
    align-items: stretch;
    flex-direction: column;
    gap: 14px;
  }

  .search {
    min-width: 0;
  }
}
</style>
