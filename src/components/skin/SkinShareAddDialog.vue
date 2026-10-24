<script setup lang="ts">
import type { UserSkin } from '@/api/skin/userSkin'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { addUserSkinByToken, fetchSharedSkin } from '@/api/skin/userSkin'
import { showMsg } from '@/components/MessageBox'
import { useUserStore } from '@/store/userStore'

/**
 * 分享链接落地浮窗：
 * 链接形如 /new/?addSkin=<token>，打开后询问是否把皮肤加入当前账号的皮肤库。
 * 未登录时先引导登录，登录后带着同一链接回到这里继续。
 */
const route = useRoute()
const router = useRouter()
const { isLogin } = useUserStore()

const open = ref(false)
const loading = ref(false)
const adding = ref(false)
const added = ref(false)
const errorMsg = ref('')
const skin = ref<UserSkin | null>(null)
let loadedToken = ''

const token = computed(() => {
  const raw = route.query.addSkin
  return typeof raw === 'string' ? raw.trim() : ''
})

const alreadyInLibrary = computed(() => !!skin.value?.inLibrary || added.value)

function stripQuery() {
  const query = { ...route.query }
  delete query.addSkin
  void router.replace({ query })
}

function close() {
  if (adding.value)
    return
  open.value = false
  skin.value = null
  errorMsg.value = ''
  added.value = false
  loadedToken = ''
  stripQuery()
}

async function loadShared(tokenValue: string) {
  loading.value = true
  errorMsg.value = ''
  added.value = false
  skin.value = null
  try {
    const result = await fetchSharedSkin(tokenValue)
    if (!result) {
      errorMsg.value = '链接无效，或作者已经将这套皮肤设为私密/删除。'
      open.value = true
      return
    }
    skin.value = result
    open.value = true
  }
  finally {
    loading.value = false
  }
}

function onAdd() {
  if (!skin.value || adding.value)
    return
  if (!isLogin.value) {
    // 先清掉当前页 addSkin，登录成功后由 redirect 带回同一个分享链接。
    const tokenValue = skin.value.shareToken || token.value
    close()
    void router.push({ path: '/auth/login', query: { redirect: `/?addSkin=${encodeURIComponent(tokenValue)}` } })
    return
  }
  adding.value = true
  addUserSkinByToken(skin.value.shareToken || token.value)
    .then((result) => {
      if (!result.ok) {
        showMsg(result.msg || '添加皮肤失败')
        return
      }
      added.value = true
      if (skin.value)
        skin.value.inLibrary = true
      showMsg('已添加到你的皮肤库')
    })
    .finally(() => {
      adding.value = false
    })
}

function goLibrary() {
  close()
  void router.push('/options')
}

function checkQuery() {
  const t = token.value
  // 登录页本身不弹窗，避免盖住表单；登录成功后 redirect 会带 addSkin 回到首页再弹。
  if (t && !isLogin.value && route.path.startsWith('/auth')) {
    open.value = false
    return
  }
  if (!t) {
    if (open.value)
      close()
    return
  }
  if (t === loadedToken && open.value)
    return
  loadedToken = t
  void loadShared(t)
}

onMounted(checkQuery)
watch(token, checkQuery)
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="skin-add-mask" @click.self="close">
      <section class="skin-add" role="dialog" aria-modal="true" aria-label="添加自定义皮肤">
        <header class="skin-add__head">
          <div>
            <h2 class="skin-add__title">
              收到一套自定义皮肤
            </h2>
            <p class="skin-add__hint">
              添加后可以在「设置 → 外观」里切换使用。
            </p>
          </div>
          <button type="button" class="skin-add__close" aria-label="关闭" @click="close">
            ×
          </button>
        </header>

        <div v-if="loading" class="skin-add__empty">
          正在读取皮肤…
        </div>
        <div v-else-if="errorMsg" class="skin-add__empty">
          {{ errorMsg }}
        </div>
        <div v-else-if="skin" class="skin-add__body">
          <img class="skin-add__cover" :src="skin.desktopUrl" :alt="skin.name" loading="lazy">
          <div class="skin-add__meta">
            <div class="skin-add__copy">
              <strong>{{ skin.name }}</strong>
              <span>来自 {{ skin.ownerName || '集市用户' }}</span>
            </div>
            <img class="skin-add__mobile" :src="skin.mobileUrl" alt="手机端预览" loading="lazy">
          </div>
          <p class="skin-add__note">
            这是 {{ skin.ownerName || '集市用户' }} 公开分享的皮肤；添加只是放进你的皮肤库，不会自动切换。
          </p>
        </div>

        <footer class="skin-add__foot">
          <button type="button" class="skin-add__btn" @click="close">
            {{ added || alreadyInLibrary ? '关闭' : '暂不添加' }}
          </button>
          <button
            v-if="skin && !alreadyInLibrary"
            type="button"
            class="skin-add__btn skin-add__btn--primary"
            :disabled="adding || loading"
            @click="onAdd"
          >
            {{ !isLogin ? '登录后添加' : (adding ? '添加中…' : '添加到皮肤库') }}
          </button>
          <button
            v-else-if="alreadyInLibrary"
            type="button"
            class="skin-add__btn skin-add__btn--primary"
            @click="goLibrary"
          >
            去设置中使用
          </button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<style scoped lang="scss">
.skin-add-mask {
  position: fixed;
  inset: 0;
  z-index: 6500;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(15, 23, 42, 0.52);
}

.skin-add {
  width: 100%;
  max-width: 440px;
  max-height: min(88vh, 680px);
  display: flex;
  flex-direction: column;
  border-radius: 16px;
  background: var(--color-card, #fff);
  box-shadow: 0 18px 50px rgba(15, 23, 42, 0.3);
  overflow: hidden;
}

.skin-add__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 18px 12px;
  border-bottom: 1px solid var(--color-border, rgba(71, 85, 105, 0.12));
}

.skin-add__title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--color-text);
}

.skin-add__hint {
  margin: 4px 0 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--color-text-muted);
}

.skin-add__close {
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

.skin-add__body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 14px 18px;
}

.skin-add__cover {
  display: block;
  width: 100%;
  aspect-ratio: 16 / 9;
  object-fit: cover;
  border-radius: 12px;
  background: var(--color-border);
}

.skin-add__meta {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-top: 12px;
}

.skin-add__copy {
  flex: 1;
  min-width: 0;

  strong {
    display: block;
    font-size: 15px;
    color: var(--color-text);
    word-break: break-word;
  }

  span {
    display: block;
    margin-top: 3px;
    font-size: 12px;
    color: var(--color-text-muted);
  }
}

.skin-add__mobile {
  flex-shrink: 0;
  width: 54px;
  height: 96px;
  object-fit: cover;
  border-radius: 8px;
  background: var(--color-border);
}

.skin-add__note {
  margin: 12px 0 0;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--accent-soft);
  font-size: 12px;
  line-height: 1.55;
  color: var(--color-text-secondary, #475569);
}

.skin-add__empty {
  padding: 28px 18px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--color-text-muted);
  text-align: center;
}

.skin-add__foot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 12px 18px 16px;
  border-top: 1px solid var(--color-border, rgba(71, 85, 105, 0.12));
}

.skin-add__btn {
  padding: 8px 18px;
  border: 1px solid var(--color-border-strong, rgba(71, 85, 105, 0.2));
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

@media screen and (max-width: 480px) {
  .skin-add-mask {
    align-items: flex-end;
    padding: 10px;
  }

  .skin-add {
    border-radius: 16px 16px 12px 12px;
  }
}
</style>
