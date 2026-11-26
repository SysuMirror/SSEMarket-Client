<script setup lang="ts">
import type { UserSkin } from '@/api/skin/userSkin'
import { computed, onMounted, ref, watch } from 'vue'
import { uploadPhoto } from '@/api/editPostAndComment/utils'
import {
  addUserSkin,
  buildSkinShareURL,
  createUserSkin,
  deleteUserSkin,
  fetchMySkins,
  removeUserSkin,
  searchUserSkins,
  setUserSkinVisibility,
} from '@/api/skin/userSkin'
import { confirmDialog } from '@/components/ConfirmDialog'
import LoadingSpinner from '@/components/LoadingSpinner.vue'
import { showMsg } from '@/components/MessageBox'
import { useSkin } from '@/composables/useSkin'
import { useUserStore } from '@/store/userStore'
import { compressImageFile, isRasterImageType } from '@/utils/compressImage'
import { isRemoteImageURL } from '@/utils/imageSource'

/**
 * 用户自定义皮肤库。
 *
 * - 桌面/手机两张图分别上传，都成功后创建一套皮肤（默认私密）；
 * - 我的皮肤库可切换使用、公开/私密、复制添加链接、删除；
 * - 发现页可搜索公开皮肤并添加到自己的皮肤库。
 *
 * 图片走图床 uploadPhotos；皮肤只保存绝对 http(s) 地址。
 */

const { userInfo, isLogin } = useUserStore()
const {
  customSkinActive,
  activeCustomSkin,
  applyUserSkin,
  clearUserSkin,
} = useSkin()

const skins = ref<UserSkin[]>([])
const loading = ref(false)
const saving = ref(false)

const draftName = ref('')
const draftDesktopUrl = ref('')
const draftMobileUrl = ref('')
const uploadingDesktop = ref(false)
const uploadingMobile = ref(false)

const searchOpen = ref(false)
const searchKeyword = ref('')
const searchResults = ref<UserSkin[]>([])
const searching = ref(false)
const searchDone = ref(false)

const busySkinID = ref(0)

const canCreate = computed(() =>
  !!draftName.value.trim()
  && !!draftDesktopUrl.value
  && !!draftMobileUrl.value
  && !saving.value
  && !uploadingDesktop.value
  && !uploadingMobile.value,
)

function isActive(skin: UserSkin): boolean {
  return customSkinActive.value && activeCustomSkin.value?.skinID === skin.skinID
}

async function loadLibrary() {
  if (!isLogin.value)
    return
  loading.value = true
  try {
    skins.value = await fetchMySkins()
  }
  finally {
    loading.value = false
  }
}

onMounted(() => {
  void loadLibrary()
})

watch(
  () => userInfo.userID,
  (id) => {
    if (id > 0)
      void loadLibrary()
    else
      skins.value = []
  },
)

async function uploadImage(file: File, target: 'desktop' | 'mobile') {
  // 防重复触发：上传中再次点同一位置直接忽略
  if (target === 'desktop' ? uploadingDesktop.value : uploadingMobile.value)
    return
  if (!isRasterImageType(file.type)) {
    showMsg('仅支持 JPG / PNG / GIF / WebP / HEIC 图片')
    return
  }
  if (file.size > 15 * 1024 * 1024) {
    showMsg('图片不能超过 15MB')
    return
  }
  if (target === 'desktop')
    uploadingDesktop.value = true
  else
    uploadingMobile.value = true
  try {
    // 先压到最长边 1920、WebP：图床经本机 frp 隧道，体积越小上传越快。
    const prepared = await compressImageFile(file, { maxEdge: 1920, quality: 0.85 })
    const data = await uploadPhoto(prepared)
    const url = (data?.fileURL || '').trim()
    if (!isRemoteImageURL(url)) {
      showMsg('上传成功但未拿到有效的图床地址，请重试')
      return
    }
    if (target === 'desktop')
      draftDesktopUrl.value = url
    else
      draftMobileUrl.value = url
  }
  catch (e) {
    console.error('[custom-skin] upload failed', e)
    showMsg('上传失败，请稍后重试')
  }
  finally {
    if (target === 'desktop')
      uploadingDesktop.value = false
    else
      uploadingMobile.value = false
  }
}

function onPickFile(event: Event, target: 'desktop' | 'mobile') {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file)
    void uploadImage(file, target)
}

async function createSkin() {
  if (!canCreate.value)
    return
  saving.value = true
  try {
    const result = await createUserSkin({
      name: draftName.value.trim(),
      description: '',
      desktopUrl: draftDesktopUrl.value,
      mobileUrl: draftMobileUrl.value,
    })
    if (!result.ok || !result.skin) {
      showMsg(result.msg || '创建皮肤失败')
      return
    }
    const created = result.skin
    draftName.value = ''
    draftDesktopUrl.value = ''
    draftMobileUrl.value = ''
    await loadLibrary()
    await applySkin(created)
    showMsg('自定义皮肤已创建并启用')
  }
  finally {
    saving.value = false
  }
}

async function applySkin(skin: UserSkin) {
  if (isActive(skin))
    return
  const result = await applyUserSkin({
    skinID: skin.skinID,
    name: skin.name,
    desktopUrl: skin.desktopUrl,
    mobileUrl: skin.mobileUrl,
    ownerName: skin.ownerName,
  })
  if (!result.ok)
    showMsg(result.msg || '切换皮肤失败')
  else
    void import('@/analytics/evia').then(({ trackEvia }) => trackEvia('skin_applied', { skin_id: Number(skin.skinID) || 0, is_public: Boolean(skin.isPublic) }))
}

async function togglePublic(skin: UserSkin) {
  if (busySkinID.value)
    return
  busySkinID.value = skin.skinID
  try {
    const result = await setUserSkinVisibility(skin.skinID, !skin.isPublic)
    if (!result.ok || !result.skin) {
      showMsg(result.msg || '更新失败')
      return
    }
    skin.isPublic = result.skin.isPublic
    skin.shareToken = result.skin.shareToken
    showMsg(skin.isPublic ? '已公开，可复制添加链接分享' : '已设为私密')
  }
  finally {
    busySkinID.value = 0
  }
}

async function copyShareLink(skin: UserSkin) {
  if (!skin.isPublic) {
    showMsg('请先把皮肤设为公开，再分享添加链接')
    return
  }
  if (!skin.shareToken) {
    showMsg('暂未生成分享链接，请稍后重试')
    return
  }
  const url = buildSkinShareURL(skin.shareToken)
  try {
    await navigator.clipboard.writeText(url)
    void import('@/analytics/evia').then(({ trackEvia }) => trackEvia('skin_shared', { skin_id: Number(skin.skinID) || 0 }))
    showMsg('添加链接已复制，发给朋友即可')
  }
  catch {
    window.prompt('复制下面的添加链接：', url)
  }
}

async function removeSkin(skin: UserSkin) {
  const ok = await confirmDialog({
    message: `删除「${skin.name}」？使用这套皮肤的其他用户会回到默认背景，此操作不可恢复。`,
    confirmText: '删除',
    danger: true,
  })
  if (!ok)
    return
  if (isActive(skin))
    await clearUserSkin()
  const result = await deleteUserSkin(skin.skinID)
  if (!result.ok) {
    showMsg(result.msg || '删除失败')
    return
  }
  showMsg('皮肤已删除')
  await loadLibrary()
}

async function removeFromShelf(skin: UserSkin) {
  const ok = await confirmDialog({
    message: `把「${skin.name}」移出你的皮肤库？作者的原皮肤不会删除。`,
    confirmText: '移出',
  })
  if (!ok)
    return
  if (isActive(skin))
    await clearUserSkin()
  const result = await removeUserSkin(skin.skinID)
  if (!result.ok) {
    showMsg(result.msg || '移除失败')
    return
  }
  showMsg('已移出皮肤库')
  await loadLibrary()
}

async function runSearch() {
  searching.value = true
  searchDone.value = false
  try {
    searchResults.value = await searchUserSkins(searchKeyword.value.trim(), 24)
    searchDone.value = true
  }
  finally {
    searching.value = false
  }
}

function toggleSearch() {
  searchOpen.value = !searchOpen.value
  if (searchOpen.value && !searchDone.value)
    void runSearch()
}

async function addFromSearch(skin: UserSkin) {
  if (busySkinID.value)
    return
  busySkinID.value = skin.skinID
  try {
    const result = await addUserSkin(skin.skinID)
    if (!result.ok) {
      showMsg(result.msg || '添加失败')
      return
    }
    skin.inLibrary = true
    showMsg('已添加到你的皮肤库')
    await loadLibrary()
  }
  finally {
    busySkinID.value = 0
  }
}
</script>

<template>
  <section class="cs">
    <header class="cs__head">
      <div>
        <h3 class="cs__title">
          我的自定义皮肤
        </h3>
        <p class="cs__hint">
          电脑端和手机端分别上传；上传后默认私密，公开后才能被搜索或通过链接添加。
        </p>
      </div>
      <button type="button" class="cs__discover" @click="toggleSearch">
        {{ searchOpen ? '收起发现' : '发现皮肤' }}
      </button>
    </header>

    <div v-if="searchOpen" class="cs__search-panel">
      <form class="cs__search-form" @submit.prevent="runSearch">
        <input v-model="searchKeyword" type="search" placeholder="搜索皮肤名 / 作者名" maxlength="30">
        <button type="submit" :disabled="searching">
          {{ searching ? '搜索中…' : '搜索' }}
        </button>
      </form>
      <p v-if="searching" class="cs__search-empty">
        正在搜索公开皮肤…
      </p>
      <p v-else-if="searchDone && !searchResults.length" class="cs__search-empty">
        没有找到公开皮肤，换个关键词试试。
      </p>
      <div v-else class="cs__results">
        <article v-for="skin in searchResults" :key="`search-${skin.skinID}`" class="cs__result">
          <img :src="skin.desktopUrl" alt="" loading="lazy" decoding="async">
          <div class="cs__result-copy">
            <strong>{{ skin.name }}</strong>
            <span>{{ skin.ownerName || '集市用户' }}</span>
          </div>
          <button
            v-if="skin.isOwner"
            type="button"
            class="cs__mini-btn"
            disabled
          >
            自己的
          </button>
          <button
            v-else-if="skin.inLibrary"
            type="button"
            class="cs__mini-btn"
            disabled
          >
            已添加
          </button>
          <button
            v-else
            type="button"
            class="cs__mini-btn cs__mini-btn--primary"
            :disabled="busySkinID === skin.skinID"
            @click="addFromSearch(skin)"
          >
            添加
          </button>
        </article>
      </div>
    </div>

    <div class="cs__upload">
      <input
        v-model="draftName"
        class="cs__name-input"
        type="text"
        maxlength="30"
        placeholder="给这套皮肤起个名字（1-30 字）"
      >
      <div class="cs__slots">
        <div class="cs__slot">
          <div class="cs__slot-preview">
            <img v-if="draftDesktopUrl" :src="draftDesktopUrl" alt="电脑端预览" loading="lazy" decoding="async">
            <span v-else>电脑端横图<br>建议 16:9</span>
          </div>
          <label class="cs__upload-btn" :class="{ 'cs__upload-btn--busy': uploadingDesktop }">
            <input type="file" accept="image/jpeg,image/png,image/gif,image/webp" :disabled="uploadingDesktop" @change="onPickFile($event, 'desktop')">
            <span><LoadingSpinner v-if="uploadingDesktop" :size="14" style="margin-right: 5px;" />{{ uploadingDesktop ? '上传中…' : (draftDesktopUrl ? '更换电脑图' : '上传电脑图') }}</span>
          </label>
        </div>
        <div class="cs__slot">
          <div class="cs__slot-preview cs__slot-preview--mobile">
            <img v-if="draftMobileUrl" :src="draftMobileUrl" alt="手机端预览" loading="lazy" decoding="async">
            <span v-else>手机端竖图<br>建议 9:16</span>
          </div>
          <label class="cs__upload-btn" :class="{ 'cs__upload-btn--busy': uploadingMobile }">
            <input type="file" accept="image/jpeg,image/png,image/gif,image/webp" :disabled="uploadingMobile" @change="onPickFile($event, 'mobile')">
            <span><LoadingSpinner v-if="uploadingMobile" :size="14" style="margin-right: 5px;" />{{ uploadingMobile ? '上传中…' : (draftMobileUrl ? '更换手机图' : '上传手机图') }}</span>
          </label>
        </div>
      </div>
      <button
        type="button"
        class="cs__create"
        :disabled="!canCreate"
        @click="createSkin"
      >
        {{ saving ? '创建中…' : '创建并启用这套皮肤' }}
      </button>
    </div>

    <p v-if="loading" class="cs__empty">
      正在读取皮肤库…
    </p>
    <p v-else-if="!skins.length" class="cs__empty">
      还没有自定义皮肤，上传电脑图和手机图就能创建第一套。
    </p>
    <div v-else class="cs__grid">
      <article
        v-for="skin in skins"
        :key="skin.skinID"
        class="cs__card"
        :class="{ 'cs__card--active': isActive(skin) }"
      >
        <button type="button" class="cs__preview" @click="applySkin(skin)">
          <img :src="skin.desktopUrl" :alt="skin.name" loading="lazy" decoding="async">
          <span v-if="isActive(skin)" class="cs__active-badge">使用中</span>
        </button>
        <div class="cs__meta">
          <strong>{{ skin.name }}</strong>
          <span class="cs__owner">{{ skin.isOwner ? '我上传的' : `来自 ${skin.ownerName || '集市用户'}` }}</span>
          <span class="cs__badge" :class="skin.isPublic ? 'cs__badge--public' : 'cs__badge--private'">
            {{ skin.isPublic ? '公开' : '私密' }}
          </span>
        </div>
        <div class="cs__actions">
          <button type="button" class="cs__mini-btn" @click="applySkin(skin)">
            {{ isActive(skin) ? '使用中' : '使用' }}
          </button>
          <template v-if="skin.isOwner">
            <button
              type="button"
              class="cs__mini-btn"
              :disabled="busySkinID === skin.skinID"
              @click="togglePublic(skin)"
            >
              {{ skin.isPublic ? '设为私密' : '公开' }}
            </button>
            <button
              type="button"
              class="cs__mini-btn"
              :disabled="!skin.isPublic"
              @click="copyShareLink(skin)"
            >
              复制添加链接
            </button>
            <button type="button" class="cs__mini-btn cs__mini-btn--danger" @click="removeSkin(skin)">
              删除
            </button>
          </template>
          <button v-else type="button" class="cs__mini-btn cs__mini-btn--danger" @click="removeFromShelf(skin)">
            移出皮肤库
          </button>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped lang="scss">
.cs {
  padding: 14px 16px 16px;
  border-top: 1px solid var(--color-border);
}

.cs__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.cs__title {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: var(--color-text);
}

.cs__hint {
  margin: 4px 0 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--color-text-muted);
}

.cs__discover {
  flex-shrink: 0;
  padding: 4px 12px;
  border: 1px solid var(--color-border-strong, rgba(71, 85, 105, 0.24));
  border-radius: 999px;
  background: transparent;
  color: var(--color-text-secondary, #475569);
  font-size: 12px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;

  &:hover {
    border-color: var(--accent);
    color: var(--accent);
  }
}

.cs__search-panel {
  margin-top: 12px;
  padding: 10px;
  border-radius: 10px;
  background: var(--color-bg, #f5f6f7);
}

.cs__search-form {
  display: flex;
  gap: 8px;

  input {
    flex: 1;
    min-width: 0;
    height: 34px;
    padding: 0 10px;
    border: 1px solid var(--color-border-strong, rgba(71, 85, 105, 0.24));
    border-radius: 8px;
    background: var(--color-card, #fff);
    color: var(--color-text);
    font-size: 13px;
    font-family: inherit;
    outline: none;

    &:focus {
      border-color: var(--accent);
    }
  }

  button {
    flex-shrink: 0;
    padding: 0 14px;
    border: none;
    border-radius: 8px;
    background: var(--accent);
    color: #fff;
    font-size: 13px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;

    &:disabled {
      opacity: 0.6;
      cursor: default;
    }
  }
}

.cs__search-empty {
  margin: 10px 2px 2px;
  font-size: 12px;
  color: var(--color-text-muted);
}

.cs__results {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 10px;
  max-height: 240px;
  overflow-y: auto;
}

.cs__result {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px;
  border-radius: 8px;
  background: var(--color-card, #fff);

  img {
    width: 72px;
    height: 44px;
    object-fit: cover;
    border-radius: 6px;
    flex-shrink: 0;
    background: var(--color-border);
  }
}

.cs__result-copy {
  flex: 1;
  min-width: 0;

  strong {
    display: block;
    font-size: 13px;
    color: var(--color-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  span {
    display: block;
    margin-top: 2px;
    font-size: 11px;
    color: var(--color-text-muted);
  }
}

.cs__upload {
  margin-top: 14px;
  padding: 12px;
  border: 1px dashed var(--color-border-strong, rgba(71, 85, 105, 0.24));
  border-radius: 12px;
  background: color-mix(in srgb, var(--accent) 4%, transparent);
}

.cs__name-input {
  width: 100%;
  height: 36px;
  padding: 0 10px;
  border: 1px solid var(--color-border-strong, rgba(71, 85, 105, 0.24));
  border-radius: 8px;
  background: var(--color-card, #fff);
  color: var(--color-text);
  font-size: 13px;
  font-family: inherit;
  outline: none;
  box-sizing: border-box;

  &:focus {
    border-color: var(--accent);
  }
}

.cs__slots {
  display: grid;
  grid-template-columns: 1.35fr 1fr;
  gap: 10px;
  margin-top: 10px;
}

.cs__slot {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.cs__slot-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 92px;
  border-radius: 8px;
  background: var(--color-border, rgba(71, 85, 105, 0.12));
  color: var(--color-text-muted);
  font-size: 11px;
  line-height: 1.5;
  text-align: center;
  overflow: hidden;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  &--mobile img {
    object-fit: contain;
  }
}

.cs__upload-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 30px;
  border: 1px solid var(--color-border-strong, rgba(71, 85, 105, 0.24));
  border-radius: 7px;
  background: var(--color-card, #fff);
  color: var(--color-text-secondary, #475569);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;

  &:hover {
    border-color: var(--accent);
    color: var(--accent);
  }

  &--busy {
    opacity: 0.7;
    cursor: progress;
  }

  input {
    display: none;
  }
}

.cs__create {
  width: 100%;
  height: 36px;
  margin-top: 10px;
  border: none;
  border-radius: 9px;
  background: var(--accent);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;

  &:disabled {
    opacity: 0.5;
    cursor: default;
  }
}

.cs__empty {
  margin: 14px 0 2px;
  font-size: 12px;
  color: var(--color-text-muted);
  text-align: center;
}

.cs__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 10px;
  margin-top: 14px;
}

.cs__card {
  border: 1.5px solid var(--color-border, rgba(71, 85, 105, 0.14));
  border-radius: 12px;
  background: var(--color-card, #fff);
  overflow: hidden;

  &--active {
    border-color: var(--accent);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent) 30%, transparent);
  }
}

.cs__preview {
  position: relative;
  display: block;
  width: 100%;
  aspect-ratio: 16 / 9;
  padding: 0;
  border: none;
  background: var(--color-border);
  cursor: pointer;
  overflow: hidden;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
}

.cs__active-badge {
  position: absolute;
  top: 6px;
  left: 6px;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--accent);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
}

.cs__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
  padding: 8px 10px 4px;

  strong {
    min-width: 0;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 13px;
    color: var(--color-text);
  }
}

.cs__owner {
  font-size: 11px;
  color: var(--color-text-muted);
}

.cs__badge {
  padding: 1px 7px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 600;

  &--public {
    background: color-mix(in srgb, #10b981 14%, transparent);
    color: #047857;
  }

  &--private {
    background: var(--color-border, rgba(71, 85, 105, 0.12));
    color: var(--color-text-muted);
  }
}

.cs__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  padding: 4px 10px 10px;
}

.cs__mini-btn {
  padding: 3px 9px;
  border: 1px solid var(--color-border-strong, rgba(71, 85, 105, 0.24));
  border-radius: 999px;
  background: transparent;
  color: var(--color-text-secondary, #475569);
  font-size: 11px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;

  &:hover:not(:disabled) {
    border-color: var(--accent);
    color: var(--accent);
  }

  &:disabled {
    opacity: 0.5;
    cursor: default;
  }

  &--primary {
    border-color: var(--accent);
    background: var(--accent);
    color: #fff;
  }

  &--danger:hover:not(:disabled) {
    border-color: #ef4444;
    color: #ef4444;
  }
}

@media screen and (max-width: 560px) {
  .cs__slots {
    grid-template-columns: 1fr 1fr;
  }

  .cs__slot-preview {
    height: 78px;
  }

  .cs__grid {
    grid-template-columns: 1fr;
  }
}
</style>
