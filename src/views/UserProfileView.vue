<script setup lang="ts">
import type { Badge, MyBadges } from '@/api/badge/badge'
import type { AllInfo } from '@/api/info/getInfo'
import type { Post } from '@/types/post'
import { Icon } from '@iconify/vue'
import { computed, nextTick, onBeforeMount, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { fetchMyBadges, fetchUserBadges, saveBadgePreferences } from '@/api/badge/badge'
import { getUserProfilePostNum, getUserProfilePosts } from '@/api/browse/getUserProfilePosts'
import { uploadPhoto } from '@/api/editPostAndComment/utils'
import { getInfoById, normalizeAllInfo } from '@/api/info/getInfo'
import { saveProfileBanner } from '@/api/info/updateInfo'
import { showMsg } from '@/components/MessageBox'
import PostList from '@/components/PostList.vue'
import { primeWornBadge } from '@/composables/useWornBadge'
import { useUserStore } from '@/store/userStore'
import { compressImageFile, isRasterImageType } from '@/utils/compressImage'
import { levelClassHandler, levelExpHandler, titleNameHandler } from '@/utils/level'
import { defaultAvatarFor } from '@/utils/defaultAvatar'
import { setWindowScrollY } from '@/utils/windowScroll'

const PAGE_SIZE = 15

const router = useRouter()
const route = useRoute()

const user = ref<AllInfo>()
const { userInfo } = useUserStore()

const profilePosts = ref<Post[]>([])
const profileOffset = ref(0)
const profileHasMore = ref(true)
const profileLoading = ref(false)
const profileTotal = ref(0)

const defaultAvatar = computed(() => defaultAvatarFor(user.value?.userID))

const showPostHistory = computed(() => {
  if (!user.value?.userID)
    return false
  if (userInfo.userID === user.value.userID)
    return true
  return !user.value.hideProfilePosts
})

const avatarSrc = computed(() => {
  const u = user.value?.avatarURL?.trim()
  return u || defaultAvatar.value
})

const levelLabel = computed(() => {
  if (!user.value)
    return ''
  return titleNameHandler(user.value.score, user.value.customTitle, user.value.name)
})

const isSelf = computed(() => userInfo.userID === user.value?.userID)

// 币余额仅本人可见（后端只在本人查看时返回 coins）
const showCoins = computed(() => isSelf.value && user.value?.coins !== undefined)
const coinRulesOpen = ref(false)

// —— 主页栏板背景（主人上传/调不透明度，访客共用） ——
const bannerSettingsOpen = ref(false)
const bannerDraftUrl = ref('')
const bannerDraftOpacity = ref(100)
const bannerUploading = ref(false)
const bannerSaving = ref(false)
const bannerFileInput = ref<HTMLInputElement | null>(null)

const savedBannerUrl = computed(() => user.value?.profileBannerUrl?.trim() || '')

/** 弹窗打开时用草稿实时预览，关闭时用服务端保存值。 */
const profileBannerStyle = computed<Record<string, string>>(() => {
  const url = bannerSettingsOpen.value ? bannerDraftUrl.value.trim() : savedBannerUrl.value
  const rawOpacity = bannerSettingsOpen.value
    ? bannerDraftOpacity.value
    : (user.value?.profileBannerOpacity ?? 100)
  const opacity = Math.min(100, Math.max(0, Math.round(rawOpacity)))
  const style: Record<string, string> = { opacity: String(opacity / 100) }
  if (url)
    style.backgroundImage = `url("${url.replace(/"/g, '%22')}")`
  return style
})

function openBannerSettings() {
  bannerDraftUrl.value = savedBannerUrl.value
  bannerDraftOpacity.value = Math.min(100, Math.max(0, Math.round(user.value?.profileBannerOpacity ?? 100)))
  bannerSettingsOpen.value = true
}

function closeBannerSettings() {
  if (bannerUploading.value || bannerSaving.value)
    return
  bannerSettingsOpen.value = false
}

async function onBannerFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file)
    return
  if (!isRasterImageType(file.type)) {
    showMsg('仅支持 JPG / PNG / GIF / WebP 图片')
    input.value = ''
    return
  }
  if (file.size > 15 * 1024 * 1024) {
    showMsg('图片不能超过 15MB')
    input.value = ''
    return
  }
  bannerUploading.value = true
  try {
    // 上传前压缩，减少图床隧道传输时间。
    const prepared = await compressImageFile(file, { maxEdge: 1920, quality: 0.85 })
    const data = await uploadPhoto(prepared)
    const url = (data?.fileURL || '').trim()
    if (!/^https?:\/\//i.test(url)) {
      showMsg('上传成功但未拿到有效的图床地址，请重试')
      return
    }
    bannerDraftUrl.value = url
  }
  catch (e) {
    console.error('[profile] upload banner failed', e)
    showMsg('上传失败，请稍后重试')
  }
  finally {
    bannerUploading.value = false
    input.value = ''
  }
}

async function saveBannerSettings() {
  if (bannerSaving.value || bannerUploading.value)
    return
  bannerSaving.value = true
  try {
    const res = await saveProfileBanner(bannerDraftUrl.value.trim(), bannerDraftOpacity.value)
    if (!res.ok) {
      showMsg(res.msg || '保存失败')
      return
    }
    if (user.value) {
      user.value.profileBannerUrl = res.profileBannerUrl
      user.value.profileBannerOpacity = res.profileBannerOpacity
    }
    bannerSettingsOpen.value = false
    showMsg('主页背景已保存')
  }
  finally {
    bannerSaving.value = false
  }
}

// —— 勋章墙 ——
const myBadges = ref<MyBadges | null>(null)
const publicBadges = ref<MyBadges | null>(null)
const badgesLoading = ref(false)
const badgeManageOpen = ref(false)
const badgeSaving = ref(false)
const badgeDraftWorn = ref(0)
const badgeDraftProfile = ref<number[] | null>(null)

/** 本人：全部已获得；他人：服务端已按对方主页展示偏好过滤。 */
const ownedBadges = computed<Badge[]>(() =>
  isSelf.value
    ? (myBadges.value?.badges ?? [])
    : (publicBadges.value?.badges ?? []),
)

/** 主页勋章墙实际展示的勋章（本人也按自己的选择过滤，所见即所得）。 */
const displayedBadges = computed<Badge[]>(() => {
  const state = isSelf.value ? myBadges.value : publicBadges.value
  if (!state)
    return []
  if (!isSelf.value)
    return state.badges
  const selected = state.profileBadgeIds
  if (selected == null)
    return state.badges
  const keep = new Set(selected)
  return state.badges.filter(badge => keep.has(badge.badgeID))
})

const showBadgeWall = computed(() => isSelf.value || displayedBadges.value.length > 0)

function badgeToWorn(state: MyBadges, userID: number) {
  const badge = state.badges.find(b => b.badgeID === state.wornBadgeId)
  return badge
    ? { userID, badgeID: badge.badgeID, name: badge.name, imageURL: badge.imageURL }
    : null
}

async function loadBadges() {
  const id = user.value?.userID ?? 0
  if (id <= 0) {
    myBadges.value = null
    publicBadges.value = null
    return
  }
  badgesLoading.value = true
  try {
    if (isSelf.value) {
      myBadges.value = await fetchMyBadges()
      // 个人主页也是「对外」的一个入口：顺手刷新自己昵称旁的挂载缓存。
      if (myBadges.value)
        primeWornBadge(id, badgeToWorn(myBadges.value, id))
    }
    else {
      publicBadges.value = await fetchUserBadges(id)
    }
  }
  finally {
    badgesLoading.value = false
  }
}

function isProfileBadgeSelected(id: number): boolean {
  if (badgeDraftProfile.value === null)
    return true
  return badgeDraftProfile.value.includes(id)
}

function toggleProfileBadge(id: number) {
  if (badgeDraftProfile.value === null) {
    // 从「默认全部展示」里去掉这一枚。
    badgeDraftProfile.value = ownedBadges.value.map(b => b.badgeID).filter(x => x !== id)
    return
  }
  const next = new Set(badgeDraftProfile.value)
  if (next.has(id))
    next.delete(id)
  else
    next.add(id)
  badgeDraftProfile.value = [...next]
}

function selectAllProfileBadges() {
  badgeDraftProfile.value = null
}

function clearProfileBadges() {
  badgeDraftProfile.value = []
}

function openBadgeManager() {
  const state = myBadges.value
  badgeDraftWorn.value = state?.wornBadgeId ?? 0
  badgeDraftProfile.value = state?.profileBadgeIds == null ? null : [...state.profileBadgeIds]
  badgeManageOpen.value = true
}

function closeBadgeManager() {
  if (badgeSaving.value)
    return
  badgeManageOpen.value = false
}

async function saveBadgeSelection() {
  if (badgeSaving.value)
    return
  badgeSaving.value = true
  try {
    const res = await saveBadgePreferences({
      wornBadgeId: badgeDraftWorn.value,
      profileBadgeIds: badgeDraftProfile.value,
    })
    if (!res.ok || !res.data) {
      showMsg(res.msg || '保存失败')
      return
    }
    myBadges.value = res.data
    const id = user.value?.userID ?? 0
    primeWornBadge(id, badgeToWorn(res.data, id))
    badgeManageOpen.value = false
    showMsg('勋章展示已保存')
  }
  finally {
    badgeSaving.value = false
  }
}

watch(
  () => [user.value?.userID, isSelf.value] as const,
  () => {
    myBadges.value = null
    publicBadges.value = null
    if (badgeManageOpen.value)
      badgeManageOpen.value = false
    if (bannerSettingsOpen.value)
      bannerSettingsOpen.value = false
    void loadBadges()
  },
)

const expTarget = computed(() => {
  const s = user.value?.score ?? 0
  const n = Number.parseInt(levelExpHandler(s), 10)
  return Number.isFinite(n) && n > 0 ? n : 1
})

const expPercent = computed(() => {
  const s = user.value?.score ?? 0
  return Math.min(100, Math.round((s / expTarget.value) * 1000) / 10)
})

const postsEmpty = computed(() => {
  return (
    showPostHistory.value
    && !profileLoading.value
    && profilePosts.value.length === 0
    && !profileHasMore.value
  )
})

const postsSectionTitle = computed(() => {
  if (isSelf.value)
    return '我的动态'
  return 'TA 的动态'
})

async function fetchProfilePostTotal() {
  if (!user.value?.userID)
    return
  profileTotal.value = await getUserProfilePostNum(user.value.userID)
}

async function loadMoreProfilePosts() {
  if (!user.value?.userID || profileLoading.value || !profileHasMore.value)
    return
  if (!showPostHistory.value)
    return
  profileLoading.value = true
  const batch = await getUserProfilePosts({
    targetUserID: user.value.userID,
    limit: PAGE_SIZE,
    offset: profileOffset.value,
  })
  profilePosts.value.push(...batch)
  profileOffset.value += batch.length
  if (batch.length < PAGE_SIZE)
    profileHasMore.value = false
  else if (profileTotal.value > 0 && profilePosts.value.length >= profileTotal.value)
    profileHasMore.value = false
  profileLoading.value = false
}

async function resetAndLoadPosts() {
  profilePosts.value = []
  profileOffset.value = 0
  profileHasMore.value = true
  profileTotal.value = 0
  if (!user.value?.userID)
    return
  if (!showPostHistory.value)
    return
  await fetchProfilePostTotal()
  if (profileTotal.value === 0) {
    profileHasMore.value = false
    return
  }
  await loadMoreProfilePosts()
}

watch(
  () => [user.value?.userID, user.value?.hideProfilePosts, userInfo.userID] as const,
  () => {
    void resetAndLoadPosts()
  },
)

onBeforeMount(() => {
  const id = Number(route.params.id)
  getInfoById(id)
    .then((res) => {
      user.value = normalizeAllInfo(res)
    })
    .catch((error: { response?: { msg: string, code: number } }) => {
      if (error.response) {
        const res = error.response
        showMsg(`请求无效：${res.msg} (${res.code})`)
      }
      else {
        showMsg('请求无效')
      }
    })
})

watch(
  () => route.params.id,
  () => {
    void nextTick(() => setWindowScrollY(0))
  },
)

function navigateChat() {
  if (user.value && user.value.userID > 0) {
    router.push({ name: 'Messages', query: { tab: 'chat', user: String(user.value.userID) } })
  }
}

function onAvatarError(e: Event) {
  const el = e.target as HTMLImageElement
  if (el.src !== defaultAvatar.value)
    el.src = defaultAvatar.value
}
</script>

<template>
  <div v-if="user" class="profile-page">
    <!-- 企业微信风格：顶部藏青色色块（主人可换成图床图片并调透明度） -->
    <div class="profile-banner-wrap">
      <div class="profile-banner" :style="profileBannerStyle" />
      <button
        v-if="isSelf"
        type="button"
        class="profile-banner__edit"
        @click="openBannerSettings"
      >
        设置背景
      </button>
    </div>

    <!-- 头像 + 名称区域：半悬浮在 banner 上 -->
    <div class="profile-avatar-zone">
      <img
        class="profile-avatar-zone__img"
        :src="avatarSrc"
        :alt="user.name || '头像'"
        loading="lazy"
        @error="onAvatarError"
      >
      <h1 class="profile-avatar-zone__name">
        {{ user.name || '未命名用户' }}
      </h1>
      <div class="profile-avatar-zone__badges">
        <span class="profile-badge" :class="levelClassHandler(user.score)">{{ levelLabel }}</span>
      </div>
    </div>

    <!-- 操作栏 -->
    <div v-if="!isSelf" class="profile-actions">
      <button type="button" class="profile-actions__btn" @click="navigateChat">
        <Icon icon="tabler:message-circle" width="20" height="20" aria-hidden="true" />
        <span>发私信</span>
      </button>
    </div>

    <!-- 信息卡片：iOS 设置式分组列表 -->
    <div class="profile-group">
      <div v-if="user.intro" class="profile-row">
        <Icon icon="tabler:quote" class="profile-row__icon" width="20" height="20" aria-hidden="true" />
        <div class="profile-row__body">
          <p class="profile-row__label">
            简介
          </p>
          <p class="profile-row__value">
            {{ user.intro }}
          </p>
        </div>
      </div>

      <div class="profile-row">
        <Icon icon="tabler:trophy" class="profile-row__icon" width="20" height="20" aria-hidden="true" />
        <div class="profile-row__body">
          <p class="profile-row__label">
            经验值
          </p>
          <div class="profile-row__exp">
            <span class="profile-row__value">{{ user.score ?? 0 }} / {{ expTarget }}</span>
            <div class="profile-exp-bar">
              <div class="profile-exp-bar__fill" :style="{ width: `${expPercent}%` }" />
            </div>
          </div>
        </div>
      </div>

      <button
        v-if="showCoins"
        type="button"
        class="profile-row profile-row--clickable"
        @click="coinRulesOpen = true"
      >
        <Icon icon="tabler:coin" class="profile-row__icon" width="20" height="20" aria-hidden="true" />
        <div class="profile-row__body">
          <p class="profile-row__label">
            币
          </p>
          <p class="profile-row__value profile-row__value--coin">
            {{ user.coins }} 币 · 点击查看发放规则
          </p>
        </div>
        <Icon icon="tabler:chevron-right" class="profile-row__chevron" width="18" height="18" aria-hidden="true" />
      </button>

      <div class="profile-row">
        <Icon icon="tabler:id-badge-2" class="profile-row__icon" width="20" height="20" aria-hidden="true" />
        <div class="profile-row__body">
          <p class="profile-row__label">
            UID
          </p>
          <p class="profile-row__value">
            {{ user.userID }}
          </p>
        </div>
      </div>
    </div>

    <!-- 勋章墙 -->
    <section v-if="showBadgeWall" class="profile-badges">
      <div class="profile-badges__head">
        <h2 class="profile-badges__title">
          <Icon icon="tabler:award" width="18" height="18" aria-hidden="true" />
          勋章墙
          <span v-if="ownedBadges.length" class="profile-badges__count">{{ ownedBadges.length }}</span>
        </h2>
        <button
          v-if="isSelf"
          type="button"
          class="profile-badges__manage"
          @click="openBadgeManager"
        >
          管理
        </button>
      </div>

      <div v-if="badgesLoading && !ownedBadges.length" class="profile-badges__loading">
        加载中…
      </div>
      <div v-else-if="displayedBadges.length" class="profile-badges__grid">
        <div
          v-for="badge in displayedBadges"
          :key="badge.badgeID"
          class="profile-badges__item"
          :title="badge.description || badge.name"
        >
          <img class="profile-badges__img" :src="badge.imageURL" :alt="badge.name" loading="lazy">
          <span class="profile-badges__name">{{ badge.name }}</span>
        </div>
      </div>
      <p v-else class="profile-badges__empty">
        {{ ownedBadges.length ? '当前主页不展示勋章，点右侧「管理」调整' : (isSelf ? '还没有获得勋章' : '暂无勋章') }}
      </p>
    </section>

    <!-- 动态列表 -->
    <div v-if="showPostHistory" class="profile-posts">
      <div class="profile-posts__head">
        <h2 class="profile-posts__title">
          {{ postsSectionTitle }}
        </h2>
        <span v-if="profileTotal > 0" class="profile-posts__count">{{ profileTotal }} 条</span>
      </div>

      <div v-if="postsEmpty" class="profile-empty">
        <Icon icon="tabler:notes-off" width="36" height="36" aria-hidden="true" />
        <p>还没有帖子</p>
      </div>
      <div v-else class="profile-feed">
        <PostList
          :posts="profilePosts"
          post-type="post"
          :is-dense="true"
          :is-loading="profileLoading"
          :has-more="profileHasMore"
          @bottom="loadMoreProfilePosts"
        />
      </div>
    </div>

    <div v-else class="profile-hidden">
      <Icon icon="tabler:eye-off" width="32" height="32" aria-hidden="true" />
      <p class="profile-hidden__title">
        发帖记录已隐藏
      </p>
      <p class="profile-hidden__hint">
        该用户关闭了动态展示
      </p>
    </div>

    <!-- 主页背景设置弹窗（Teleport 到 body：否则会被 .app-main 的 stacking context 压在底栏下面） -->
    <Teleport to="body">
    <div v-if="bannerSettingsOpen" class="banner-modal-mask" @click.self="closeBannerSettings">
      <section class="banner-modal" role="dialog" aria-modal="true" aria-label="设置主页背景">
        <header class="banner-modal__head">
          <div>
            <h2 class="banner-modal__title">
              主页背景
            </h2>
            <p class="banner-modal__hint">
              上传图床上图片；拖动不透明度时上方栏板实时预览，访客看到的是同一效果。
            </p>
          </div>
          <button type="button" class="banner-modal__close" aria-label="关闭" @click="closeBannerSettings">
            ×
          </button>
        </header>

        <div class="banner-modal__body">
          <div class="banner-modal__preview" :style="profileBannerStyle">
            <span v-if="!bannerDraftUrl">默认渐变背景</span>
          </div>

          <div class="banner-modal__actions">
            <button
              type="button"
              class="banner-modal__upload"
              :class="{ 'banner-modal__upload--busy': bannerUploading }"
              :disabled="bannerUploading || bannerSaving"
              @click="bannerFileInput?.click()"
            >
              {{ bannerUploading ? '上传中…' : (bannerDraftUrl ? '更换图片' : '上传图片') }}
            </button>
            <input
              ref="bannerFileInput"
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              class="banner-modal__file"
              :disabled="bannerUploading || bannerSaving"
              @change="onBannerFileChange"
            >
            <button
              v-if="bannerDraftUrl"
              type="button"
              class="banner-modal__remove"
              :disabled="bannerUploading || bannerSaving"
              @click="bannerDraftUrl = ''"
            >
              移除图片
            </button>
          </div>

          <div class="banner-modal__opacity">
            <div class="banner-modal__opacity-head">
              <span>背景不透明度</span>
              <span class="banner-modal__opacity-value">{{ bannerDraftOpacity }}%</span>
            </div>
            <input
              v-model.number="bannerDraftOpacity"
              class="banner-modal__range"
              type="range"
              min="0"
              max="100"
              step="1"
              aria-label="主页背景不透明度"
              :disabled="bannerSaving"
            >
            <div class="banner-modal__scale">
              <span>越透明，越能看见全站背景</span>
              <span>100% 完全不透明</span>
            </div>
          </div>
          <p class="banner-modal__note">
            建议使用 16:9 或更宽的横图（JPG/PNG，≤15MB）。图片会上传到图床，以绝对地址保存。
          </p>
        </div>

        <footer class="banner-modal__foot">
          <button
            type="button"
            class="banner-modal__btn"
            :disabled="bannerUploading || bannerSaving"
            @click="closeBannerSettings"
          >
            取消
          </button>
          <button
            type="button"
            class="banner-modal__btn banner-modal__btn--primary"
            :disabled="bannerUploading || bannerSaving"
            @click="saveBannerSettings"
          >
            {{ bannerSaving ? '保存中…' : '保存' }}
          </button>
        </footer>
      </section>
    </div>
    </Teleport>

    <!-- 勋章管理弹窗 -->
    <Teleport to="body">
    <div v-if="badgeManageOpen" class="badge-modal-mask" @click.self="closeBadgeManager">
      <section class="badge-modal" role="dialog" aria-modal="true" aria-label="管理我的勋章">
        <header class="badge-modal__head">
          <div>
            <h2 class="badge-modal__title">
              我的勋章
            </h2>
            <p class="badge-modal__hint">
              对外只挂 1 枚；主页可多选，默认全部展示。
            </p>
          </div>
          <button type="button" class="badge-modal__close" aria-label="关闭" @click="closeBadgeManager">
            ×
          </button>
        </header>

        <div v-if="ownedBadges.length" class="badge-modal__body">
          <section class="badge-modal__section">
            <div class="badge-modal__section-head">
              <h3>对外展示</h3>
              <button
                type="button"
                class="badge-modal__reset"
                :class="{ 'badge-modal__reset--active': badgeDraftWorn === 0 }"
                @click="badgeDraftWorn = 0"
              >
                不挂
              </button>
            </div>
            <div class="badge-picker">
              <button
                v-for="badge in ownedBadges"
                :key="`worn-${badge.badgeID}`"
                type="button"
                class="badge-picker__item"
                :class="{ 'badge-picker__item--selected': badgeDraftWorn === badge.badgeID }"
                @click="badgeDraftWorn = badge.badgeID"
              >
                <img class="badge-picker__img" :src="badge.imageURL" :alt="badge.name" loading="lazy">
                <span class="badge-picker__name">{{ badge.name }}</span>
                <span class="badge-picker__check" aria-hidden="true">✓</span>
              </button>
            </div>
          </section>

          <section class="badge-modal__section">
            <div class="badge-modal__section-head">
              <h3>主页勋章墙</h3>
              <div class="badge-modal__bulk">
                <button
                  type="button"
                  class="badge-modal__reset"
                  :class="{ 'badge-modal__reset--active': badgeDraftProfile === null }"
                  @click="selectAllProfileBadges"
                >
                  全部
                </button>
                <button
                  type="button"
                  class="badge-modal__reset"
                  :class="{ 'badge-modal__reset--active': badgeDraftProfile !== null && badgeDraftProfile.length === 0 }"
                  @click="clearProfileBadges"
                >
                  不展示
                </button>
              </div>
            </div>
            <div class="badge-picker">
              <button
                v-for="badge in ownedBadges"
                :key="`profile-${badge.badgeID}`"
                type="button"
                class="badge-picker__item"
                :class="{ 'badge-picker__item--selected': isProfileBadgeSelected(badge.badgeID) }"
                @click="toggleProfileBadge(badge.badgeID)"
              >
                <img class="badge-picker__img" :src="badge.imageURL" :alt="badge.name" loading="lazy">
                <span class="badge-picker__name">{{ badge.name }}</span>
                <span class="badge-picker__check" aria-hidden="true">✓</span>
              </button>
            </div>
          </section>
        </div>
        <p v-else class="badge-modal__empty">
          还没有获得勋章
        </p>

        <footer class="badge-modal__foot">
          <button type="button" class="badge-modal__btn" :disabled="badgeSaving" @click="closeBadgeManager">
            取消
          </button>
          <button
            type="button"
            class="badge-modal__btn badge-modal__btn--primary"
            :disabled="badgeSaving"
            @click="saveBadgeSelection"
          >
            {{ badgeSaving ? '保存中…' : '保存' }}
          </button>
        </footer>
      </section>
    </div>
    </Teleport>

    <!-- 币发放规则弹窗 -->
    <Teleport to="body">
    <div v-if="coinRulesOpen" class="coin-rules-mask" @click.self="coinRulesOpen = false">
      <div class="coin-rules" role="dialog" aria-modal="true" aria-label="币发放规则">
        <h2 class="coin-rules__title">
          <Icon icon="tabler:coin" width="18" height="18" aria-hidden="true" />
          币发放规则
        </h2>
        <ul class="coin-rules__list">
          <li>每天进入网页 <strong>+1 币</strong>（一天一次）</li>
          <li>每天首次发帖 <strong>+1 币</strong></li>
          <li>当天阅读累计满 30 分钟 <strong>+1 币</strong></li>
          <li>当天更新写作满 4000 字 <strong>+1 币</strong></li>
          <li>收到评分：作者 <strong>+1 币</strong>（同一读者对同一本书只算一次）</li>
          <li>投币：每人对每个帖子 / 小说最多 2 币；每投 1 币自己 +10 主页经验</li>
          <li>帖子被投币：作者 <strong>+0.1 币 / 币</strong>（仅真实投币，不含旧投票折算）</li>
        </ul>
        <p class="coin-rules__note">
          币与小说的经验 / 积分是两条独立的线，不能互相兑换。
        </p>
        <div class="coin-rules__actions">
          <RouterLink class="coin-rules__link" to="/coin" @click="coinRulesOpen = false">
            去币中心看流水
          </RouterLink>
          <button type="button" class="coin-rules__close" @click="coinRulesOpen = false">
            关闭
          </button>
        </div>
      </div>
    </div>
    </Teleport>
  </div>
</template>

<style scoped lang="scss">
.profile-page {
  width: 100%;
  max-width: 720px;
  margin: 0 auto;
  padding: 0 0 2rem;
  box-sizing: border-box;
  min-height: 100%;
  color: var(--color-text);
  background: var(--color-bg);
}

/* —— 顶部 banner：默认藏青渐变，主人可换成图床图片并调透明度 —— */
.profile-banner-wrap {
  position: relative;
  flex-shrink: 0;
}

.profile-banner {
  width: 100%;
  height: 120px;
  background: linear-gradient(135deg, var(--accent) 0%, #1e293b 100%);
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  transition: opacity 0.2s ease;
}

.profile-banner__edit {
  position: absolute;
  top: 10px;
  right: 12px;
  z-index: 2;
  padding: 5px 12px;
  border: 1px solid rgba(255, 255, 255, 0.55);
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.38);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;

  &:hover {
    background: rgba(15, 23, 42, 0.55);
    border-color: #fff;
  }
}

/* —— 主页背景设置弹窗 —— */
.banner-modal-mask {
  position: fixed;
  inset: 0;
  z-index: 7000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(15, 23, 42, 0.5);
}

.banner-modal {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 480px;
  max-height: 88vh;
  border-radius: 16px;
  background: var(--color-card, #fff);
  box-shadow: 0 18px 50px rgba(15, 23, 42, 0.28);
  overflow: hidden;
}

.banner-modal__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 18px 12px;
  border-bottom: 1px solid var(--color-border, rgba(71, 85, 105, 0.12));
}

.banner-modal__title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--color-text);
}

.banner-modal__hint {
  margin: 4px 0 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--color-text-muted);
}

.banner-modal__close {
  flex-shrink: 0;
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--color-text-muted);
  font-size: 22px;
  line-height: 1;
  font-family: inherit;
  cursor: pointer;

  &:hover {
    background: var(--color-border, rgba(71, 85, 105, 0.12));
    color: var(--color-text);
  }
}

.banner-modal__body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 14px 18px;
}

.banner-modal__preview {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 96px;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--accent) 0%, #1e293b 100%);
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  color: rgba(255, 255, 255, 0.85);
  font-size: 12px;
  overflow: hidden;
  transition: opacity 0.15s ease;
}

.banner-modal__actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
}

.banner-modal__upload {
  display: inline-flex;
  font-family: inherit;
  align-items: center;
  justify-content: center;
  padding: 7px 16px;
  border: 1px solid var(--accent);
  border-radius: 9px;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease;

  &:hover {
    background: color-mix(in srgb, var(--accent) 16%, transparent);
  }

  &--busy {
    opacity: 0.65;
    pointer-events: none;
  }
}

.banner-modal__file {
  /* 不用 display:none：部分 iOS 会拒绝 programmatic click 隐藏的 file input */
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  overflow: hidden;
  pointer-events: none;
}

.banner-modal__remove {
  padding: 7px 14px;
  border: 1px solid var(--color-border, rgba(71, 85, 105, 0.2));
  border-radius: 9px;
  background: transparent;
  color: var(--color-text-secondary, #475569);
  font-size: 13px;
  font-family: inherit;
  cursor: pointer;

  &:hover {
    border-color: var(--color-error, #ef4444);
    color: var(--color-error, #ef4444);
  }
}

.banner-modal__opacity {
  margin-top: 16px;
}

.banner-modal__opacity-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
}

.banner-modal__opacity-value {
  color: var(--accent);
  font-variant-numeric: tabular-nums;
}

.banner-modal__range {
  width: 100%;
  margin: 10px 0 2px;
  accent-color: var(--accent);
  cursor: pointer;
}

.banner-modal__scale {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 11px;
  color: var(--color-text-muted);
}

.banner-modal__note {
  margin: 12px 0 0;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--accent-soft);
  font-size: 12px;
  line-height: 1.55;
  color: var(--color-text-secondary, #475569);
}

.banner-modal__foot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 12px 18px 16px;
  border-top: 1px solid var(--color-border, rgba(71, 85, 105, 0.12));
}

.banner-modal__btn {
  padding: 8px 18px;
  border: 1px solid var(--color-border, rgba(71, 85, 105, 0.16));
  border-radius: 9px;
  background: transparent;
  color: var(--color-text-secondary, #475569);
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;

  &:disabled {
    opacity: 0.55;
    cursor: default;
  }

  &--primary {
    border-color: var(--accent);
    background: var(--accent);
    color: #fff;

    &:not(:disabled):hover {
      background: var(--accent-hover);
      border-color: var(--accent-hover);
    }
  }
}

/* —— 头像区域 —— */
.profile-avatar-zone {
  /* banner 现在自带 position:relative，头像区必须抬到它上面，
     否则负 margin 上移的头像上半部分会被栏板盖住。 */
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: -48px;
  padding: 0 16px;
}

.profile-avatar-zone__img {
  width: 96px;
  height: 96px;
  border-radius: 50%;
  object-fit: cover;
  border: 4px solid var(--color-card, #fff);
  background: var(--color-bg);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.profile-avatar-zone__name {
  margin: 12px 0 6px;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--color-text);
  text-align: center;
  word-break: break-word;
}

.profile-avatar-zone__badges {
  display: flex;
  gap: 6px;
}

.profile-badge {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: var(--radius-full, 999px);
  font-size: 12px;
  font-weight: 500;
  background: var(--accent-soft);
  color: var(--accent);
}

/* —— 勋章墙 —— */
.profile-badges {
  margin: 0 12px 12px;
  padding: 14px 16px 16px;
  border-radius: var(--radius-lg, 8px);
  background: var(--color-card, #fff);
  box-shadow: var(--color-card-shadow);
}

.profile-badges__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.profile-badges__title {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: var(--color-text);
}

.profile-badges__count {
  padding: 1px 7px;
  border-radius: var(--radius-full, 999px);
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 11px;
  font-weight: 600;
}

.profile-badges__manage {
  padding: 4px 12px;
  border: 1px solid var(--color-border, rgba(71, 85, 105, 0.16));
  border-radius: var(--radius-full, 999px);
  background: transparent;
  color: var(--color-text-secondary, #475569);
  font-size: 12px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;

  &:hover {
    border-color: var(--accent);
    background: var(--accent-soft);
    color: var(--accent);
  }
}

.profile-badges__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(84px, 1fr));
  gap: 10px 8px;
  margin-top: 12px;
}

.profile-badges__item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  padding: 8px 4px 6px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--accent) 5%, transparent);
  text-align: center;
}

.profile-badges__img {
  width: 64px;
  height: 64px;
  object-fit: contain;
  filter: drop-shadow(0 3px 5px rgba(30, 51, 92, 0.16));
}

.profile-badges__name {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: 11px;
  line-height: 1.35;
  color: var(--color-text-secondary, #475569);
  word-break: break-word;
}

.profile-badges__empty,
.profile-badges__loading {
  margin: 12px 0 0;
  padding: 10px 0 2px;
  font-size: 13px;
  color: var(--color-text-muted);
  text-align: center;
}

/* —— 勋章管理弹窗 —— */
.badge-modal-mask {
  position: fixed;
  inset: 0;
  /* 移动端底部导航 z-index 2000；弹窗必须盖在它上面，否则保存按钮点不到。 */
  z-index: 7000;
  width: 100%;
  height: 100vh;
  height: 100dvh;
  max-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(15, 23, 42, 0.5);
  overflow-y: auto;
  overscroll-behavior: contain;
}

.badge-modal {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 540px;
  max-height: min(84vh, 720px);
  max-height: min(84dvh, 720px);
  border-radius: 16px;
  background: var(--color-card, #fff);
  box-shadow: 0 18px 50px rgba(15, 23, 42, 0.28);
  overflow: hidden;
}

.badge-modal__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 18px 12px;
  border-bottom: 1px solid var(--color-border, rgba(71, 85, 105, 0.12));
}

.badge-modal__title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--color-text);
}

.badge-modal__hint {
  margin: 4px 0 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--color-text-muted);
}

.badge-modal__close {
  flex-shrink: 0;
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--color-text-muted);
  font-size: 22px;
  line-height: 1;
  font-family: inherit;
  cursor: pointer;

  &:hover {
    background: var(--color-border, rgba(71, 85, 105, 0.12));
    color: var(--color-text);
  }
}

.badge-modal__body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
  padding: 14px 18px;
}

.badge-modal__section + .badge-modal__section {
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px dashed var(--color-border, rgba(71, 85, 105, 0.16));
}

.badge-modal__section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;

  h3 {
    margin: 0;
    font-size: 13px;
    font-weight: 700;
    color: var(--color-text);
  }
}

.badge-modal__bulk {
  display: flex;
  gap: 6px;
}

.badge-modal__reset {
  padding: 3px 10px;
  border: 1px solid var(--color-border, rgba(71, 85, 105, 0.16));
  border-radius: var(--radius-full, 999px);
  background: transparent;
  color: var(--color-text-secondary, #475569);
  font-size: 11px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;

  &:hover {
    border-color: var(--accent);
    color: var(--accent);
  }

  &--active {
    border-color: var(--accent);
    background: var(--accent-soft);
    color: var(--accent);
  }
}

.badge-picker {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
  gap: 8px;
}

.badge-picker__item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 6px 7px;
  border: 1.5px solid var(--color-border, rgba(71, 85, 105, 0.16));
  border-radius: 10px;
  background: transparent;
  color: inherit;
  font-family: inherit;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease, transform 0.15s ease;

  &:hover {
    border-color: color-mix(in srgb, var(--accent) 55%, transparent);
    background: var(--accent-soft);
  }

  &:active {
    transform: scale(0.98);
  }

  &--selected {
    border-color: var(--accent);
    background: var(--accent-soft);
  }
}

.badge-picker__img {
  width: 48px;
  height: 48px;
  object-fit: contain;
}

.badge-picker__name {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: 11px;
  line-height: 1.3;
  color: var(--color-text-secondary, #475569);
  text-align: center;
  word-break: break-word;
}

.badge-picker__check {
  position: absolute;
  top: 5px;
  right: 5px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--accent);
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  opacity: 0;
  transform: scale(0.7);
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.badge-picker__item--selected .badge-picker__check {
  opacity: 1;
  transform: scale(1);
}

.badge-modal__empty {
  margin: 0;
  padding: 28px 18px;
  font-size: 13px;
  color: var(--color-text-muted);
  text-align: center;
}

.badge-modal__foot {
  flex-shrink: 0;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 12px 18px calc(16px + env(safe-area-inset-bottom, 0px));
  border-top: 1px solid var(--color-border, rgba(71, 85, 105, 0.12));
}

.badge-modal__btn {
  padding: 8px 18px;
  border: 1px solid var(--color-border, rgba(71, 85, 105, 0.16));
  border-radius: 9px;
  background: transparent;
  color: var(--color-text-secondary, #475569);
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;

  &:disabled {
    opacity: 0.55;
    cursor: default;
  }

  &--primary {
    border-color: var(--accent);
    background: var(--accent);
    color: #fff;

    &:not(:disabled):hover {
      background: var(--accent-hover);
      border-color: var(--accent-hover);
    }
  }
}

/* —— 操作栏 —— */
.profile-actions {
  display: flex;
  justify-content: center;
  gap: 12px;
  padding: 16px;
}

.profile-actions__btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 24px;
  border-radius: var(--radius-md, 8px);
  border: none;
  background: var(--accent);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  transition: background 0.15s ease;
  -webkit-tap-highlight-color: transparent;

  &:hover {
    background: var(--accent-hover);
  }

  &:active {
    transform: scale(0.98);
  }
}

/* —— iOS 设置式分组列表 —— */
.profile-group {
  background: var(--color-card, #fff);
  border-radius: var(--radius-lg, 8px);
  box-shadow: var(--color-card-shadow);
  margin: 0 12px 12px;
  overflow: hidden;
}

.profile-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--color-border);

  &:last-child {
    border-bottom: none;
  }
}

.profile-row__icon {
  flex-shrink: 0;
  color: var(--color-text-muted);
  margin-top: 2px;
}

.profile-row__body {
  min-width: 0;
  flex: 1;
}

.profile-row__label {
  margin: 0 0 2px;
  font-size: 12px;
  color: var(--color-text-muted);
  line-height: 1.4;
}

.profile-row__value {
  margin: 0;
  font-size: 14px;
  color: var(--color-text);
  line-height: 1.5;
  word-break: break-word;
  white-space: pre-wrap;
}

.profile-row__exp {
  display: flex;
  align-items: center;
  gap: 10px;
}

.profile-exp-bar {
  flex: 1;
  height: 6px;
  border-radius: 3px;
  background: var(--color-border);
  overflow: hidden;
}

.profile-exp-bar__fill {
  height: 100%;
  border-radius: 3px;
  background: var(--accent);
  transition: width 0.3s ease;
}

/* —— 币行（可点击弹规则） —— */
.profile-row--clickable {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  width: 100%;
  padding: 14px 16px;
  border: none;
  border-bottom: 1px solid var(--color-border);
  background: transparent;
  font: inherit;
  text-align: left;
  cursor: pointer;
  font-family: inherit;
  -webkit-tap-highlight-color: transparent;

  &:hover {
    background: var(--accent-soft, rgba(44, 61, 86, 0.05));
  }
}

.profile-row__value--coin {
  color: #b45309;
  font-weight: 600;
}

.profile-row__chevron {
  flex-shrink: 0;
  color: var(--color-text-muted);
  margin-top: 2px;
}

/* —— 币规则弹窗 —— */
.coin-rules-mask {
  position: fixed;
  inset: 0;
  z-index: 7000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(15, 23, 42, 0.45);
}

.coin-rules {
  width: 100%;
  max-width: 420px;
  padding: 16px;
  border-radius: var(--radius-lg, 8px);
  background: var(--color-card, #fff);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.18);
}

.coin-rules__title {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 10px;
  font-size: 15px;
  font-weight: 800;
  color: var(--color-text, #1e293b);
}

.coin-rules__list {
  margin: 0;
  padding: 0 0 0 18px;
  font-size: 13px;
  line-height: 1.9;
  color: var(--color-text, #1e293b);

  strong {
    color: #b45309;
  }
}

.coin-rules__note {
  margin: 10px 0 0;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--accent-soft, rgba(44, 61, 86, 0.08));
  font-size: 12px;
  line-height: 1.6;
  color: var(--color-text-secondary, #475569);
}

.coin-rules__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 12px;
}

.coin-rules__link {
  font-size: 13px;
  font-weight: 700;
  color: var(--accent);
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
}

.coin-rules__close {
  padding: 7px 18px;
  border: 1px solid var(--color-border, rgba(71, 85, 105, 0.12));
  border-radius: var(--radius-md, 8px);
  background: var(--color-card, #fff);
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-secondary, #475569);
  cursor: pointer;
  font-family: inherit;

  &:hover {
    background: var(--accent-soft, rgba(44, 61, 86, 0.05));
  }
}

/* —— 动态列表 —— */
.profile-posts {
  padding: 0 12px;
}

.profile-posts__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding: 4px 4px 8px;
}

.profile-posts__title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text);
}

.profile-posts__count {
  font-size: 13px;
  color: var(--color-text-muted);
}

.profile-feed {
  :deep(.mx-a) {
    margin-left: 0 !important;
    margin-right: 0 !important;
    width: 100% !important;
    max-width: 100% !important;
  }

  :deep(.my-2) {
    margin-top: 6px !important;
    margin-bottom: 6px !important;
  }

  :deep(.my-2:first-child) {
    margin-top: 0 !important;
  }

  :deep(.bottomDiv) {
    padding: 12px 0 6px;
    font-size: 13px;
    color: var(--color-text-muted);
  }
}

.profile-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 2.5rem 1rem;
  color: var(--color-text-muted);

  p {
    margin: 0;
    font-size: 14px;
  }
}

/* —— 隐藏动态 —— */
.profile-hidden {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 2.5rem 1.5rem;
  margin: 0 12px;
  background: var(--color-card, #fff);
  border-radius: var(--radius-lg, 8px);
  box-shadow: var(--color-card-shadow);
  color: var(--color-text-muted);

  .profile-hidden__title {
    margin: 8px 0 4px;
    font-size: 15px;
    font-weight: 600;
    color: var(--color-text);
  }

  .profile-hidden__hint {
    margin: 0;
    font-size: 13px;
    color: var(--color-text-muted);
  }
}

@media screen and (max-width: 480px) {
  .profile-banner {
    height: 100px;
  }

  .profile-avatar-zone__img {
    width: 80px;
    height: 80px;
  }

  .profile-avatar-zone__name {
    font-size: 1.125rem;
  }

  .profile-badges {
    padding: 12px 12px 14px;
  }

  .profile-badges__grid {
    grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
    gap: 8px 6px;
  }

  .profile-badges__img {
    width: 56px;
    height: 56px;
  }

  .profile-banner__edit {
    top: 8px;
    right: 10px;
    padding: 4px 10px;
    font-size: 11px;
  }

  .badge-modal-mask,
  .banner-modal-mask {
    align-items: flex-end;
    padding: 10px;
  }

  .badge-modal,
  .banner-modal {
    max-height: calc(100dvh - 20px);
    border-radius: 16px 16px 12px 12px;
  }

  .badge-picker {
    grid-template-columns: repeat(auto-fill, minmax(82px, 1fr));
  }
}
</style>
