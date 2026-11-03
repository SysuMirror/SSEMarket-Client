import type { Ref } from 'vue'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { fetchHotQueries } from '@/api/ragSearch'

const isSmartSearchMode = ref(false)
const hotQueries = ref<string[]>([])
const hotQueryIndex = ref(0)
const searchInputValue = ref('')
let hotQueryTimer: ReturnType<typeof window.setInterval> | null = null
let mountedCount = 0

async function loadHotQueries() {
  try {
    const queries = await fetchHotQueries(8)
    hotQueries.value = queries.map(item => item.query).filter(Boolean)
    hotQueryIndex.value = 0
  }
  catch {
    hotQueries.value = []
  }
}

function startHotQueryRolling() {
  if (hotQueryTimer)
    return
  hotQueryTimer = window.setInterval(() => {
    if (hotQueries.value.length <= 1)
      return
    hotQueryIndex.value = (hotQueryIndex.value + 1) % hotQueries.value.length
  }, 3600)
}

function stopHotQueryRolling() {
  if (!hotQueryTimer)
    return
  window.clearInterval(hotQueryTimer)
  hotQueryTimer = null
}

export function useHeaderSearch(inputRef: Readonly<Ref<HTMLInputElement | null>>) {
  const route = useRoute()
  const router = useRouter()

  const searchPlaceholder = computed(() => hotQueries.value[hotQueryIndex.value] || '')
  const showRollingPlaceholder = computed(() => !searchInputValue.value.trim() && !!searchPlaceholder.value)
  const searchModeButtonText = computed(() => isSmartSearchMode.value ? '切换普通' : '切换智能')

  function currentSearchValue() {
    return searchInputValue.value.trim() || searchPlaceholder.value.trim()
  }

  function onSearchInput(event: Event) {
    searchInputValue.value = (event.target as HTMLInputElement).value
  }

  function buildSearchQuery(value: string) {
    if (isSmartSearchMode.value)
      return { sinfo: value, smart: '1' }

    if (route.path === '/course'
      || route.path === '/partition/课程专区'
      || route.path === `/partition/${encodeURIComponent('课程专区')}`
      || route?.query?.partition === '课程专区'
      || route?.query?.partition === encodeURIComponent('课程专区')) {
      return { sinfo: value, partition: '课程专区' }
    }

    return { sinfo: value }
  }

  function search() {
    const el = inputRef.value
    const value = currentSearchValue()
    if (!value)
      return
    if (el && !el.value.trim()) {
      el.value = value
      searchInputValue.value = value
    }
    if (value === '年度报告') {
      router.push('/annual2025')
      if (el)
        el.value = ''
      searchInputValue.value = ''
      return
    }
    router.push({
      name: 'Search',
      query: buildSearchQuery(value),
    })
  }

  function toggleSearchMode() {
    isSmartSearchMode.value = !isSmartSearchMode.value
    if (route.name !== 'Search' || typeof route.query.sinfo !== 'string' || !route.query.sinfo)
      return

    const query = { ...route.query }
    if (isSmartSearchMode.value)
      query.smart = '1'
    else
      delete query.smart
    router.replace({ name: 'Search', query })
  }

  watch(
    () => [route.name, route.query.smart],
    () => {
      if (route.name === 'Search')
        isSmartSearchMode.value = route.query.smart === '1'
    },
    { immediate: true },
  )

  // 回到搜索页（返回、刷新、直达链接）时，把搜索词同步回顶栏输入框，
  // 避免 URL 里还带着关键词、输入框却是空的。
  function syncSearchInput() {
    const sinfo = route.query.sinfo
    if (route.name !== 'Search' || typeof sinfo !== 'string' || !sinfo)
      return
    if (searchInputValue.value !== sinfo)
      searchInputValue.value = sinfo
    const el = inputRef.value
    if (el && document.activeElement !== el)
      el.value = sinfo
  }

  watch(() => [route.name, route.query.sinfo], syncSearchInput, { flush: 'post' })

  onMounted(() => {
    syncSearchInput()
    mountedCount += 1
    if (!hotQueries.value.length)
      void loadHotQueries()
    startHotQueryRolling()
  })

  onUnmounted(() => {
    mountedCount -= 1
    if (mountedCount <= 0) {
      mountedCount = 0
      stopHotQueryRolling()
    }
  })

  return {
    isSmartSearchMode,
    search,
    searchModeButtonText,
    searchInputValue,
    showRollingPlaceholder,
    onSearchInput,
    searchPlaceholder,
    toggleSearchMode,
  }
}
