import { computed, onMounted, onUnmounted, ref, watch, type Ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { fetchHotQueries } from '@/api/ragSearch'

const isSmartSearchMode = ref(false)
const hotQueries = ref<string[]>([])
const hotQueryIndex = ref(0)
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
  }, 2200)
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

  const searchPlaceholder = computed(() => hotQueries.value[hotQueryIndex.value] || '搜索...')
  const searchModeButtonText = computed(() => isSmartSearchMode.value ? '切换普通检索' : '切换智能检索')

  function buildSearchQuery(value: string) {
    if (isSmartSearchMode.value)
      return { sinfo: value, smart: '1' }

    if (route.path === '/partition/课程交流'
      || route.path === `/partition/${encodeURIComponent('课程交流')}`
      || route?.query?.partition === '课程交流'
      || route?.query?.partition === encodeURIComponent('课程交流')) {
      return { sinfo: value, partition: '课程交流' }
    }

    return { sinfo: value }
  }

  function search() {
    const el = inputRef.value
    const value = el?.value?.trim() || ''
    if (!el || !value)
      return
    if (value === '年度报告') {
      router.push('/annual2025')
      el.value = ''
      return
    }
    router.push({
      name: 'Search',
      query: buildSearchQuery(value),
    })
    el.value = ''
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

  onMounted(() => {
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
    searchPlaceholder,
    toggleSearchMode,
  }
}
