<script setup lang="ts">
import { onUnmounted, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/store/userStore'

const route = useRoute()
const router = useRouter()

const { isLogin } = useUserStore()

const stop = watchEffect(() => {
  if (isLogin.value) {
    const query = route.query
    if (!query || !('redirect' in query)) {
      router.push('/')
    }
    let redirect = query.redirect as string || '/'
    const otherParams = new URLSearchParams()
    for (const key in query) {
      if (key === 'redirect')
        continue
      const value = query[key] as string
      otherParams.append(key, value)
    }
    if (otherParams.toString()) {
      const separator = redirect.includes('?') ? '&' : '?'
      redirect += separator + otherParams.toString()
    }
    router.push(redirect)
  }
},
)
onUnmounted(() => {
  stop()
})
</script>

<template>
  <div class="auth-shell">
    <div class="auth-shell__inner">
      <router-view />
    </div>
  </div>
</template>

<style scoped lang="scss">
/* 顶对齐 + 安全区：避免 flex 垂直居中 + 100vh 在移动浏览器里把底部按钮顶到工具栏/主页条后方且无法滚动到位 */
.auth-shell {
  min-height: 100vh;
  min-height: 100dvh;
  min-height: 100svh;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: max(1.25rem, env(safe-area-inset-top, 0px)) 1rem max(2rem, calc(env(safe-area-inset-bottom, 0px) + 1.5rem));
  background:
    radial-gradient(120% 85% at 50% -25%, var(--chat-accent-soft), transparent 52%),
    linear-gradient(165deg, var(--chat-bg-elevated) 0%, var(--chat-bg-main) 38%, var(--chat-bg-main) 100%);
  box-sizing: border-box;
}

.auth-shell__inner {
  width: 100%;
  max-width: 28rem;
  flex-shrink: 0;
}
</style>
