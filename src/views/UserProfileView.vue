<script setup lang="ts">
import type { AllInfo } from '@/api/info/getInfo'
import { Icon } from '@iconify/vue'
import { onBeforeMount, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getInfoById } from '@/api/info/getInfo'
import { showMsg } from '@/components/MessageBox'
import UserAvatar from '@/components/UserAvatar.vue'
import { useUserStore } from '@/store/userStore'

const router = useRouter()

const user = ref<AllInfo>()
const { userInfo } = useUserStore()

onBeforeMount(() => {
  const { id } = useRoute().params
  getInfoById(Number(id))
    .then((res) => {
      user.value = res
    })
    .catch((error) => {
      if (error.response) {
        const res = error.response
        showMsg(`请求无效：${res.msg} (${res.code})`)
      }
      else {
        showMsg('请求无效')
      }
    })
})

function navigateChat() {
  if (user.value && user.value.userID > 0) {
    router.push({ name: 'Chat', query: { user: user.value.userID } })
  }
}
</script>

<template>
  <div v-if="user" class="profile-page">
    <header class="profile-page__head">
      <Icon icon="tabler:user-circle" class="profile-page__head-icon" width="22" height="22" aria-hidden="true" />
      <div>
        <h1 class="profile-page__title">
          个人主页
        </h1>
        <p class="profile-page__subtitle">
          查看资料与发起私信
        </p>
      </div>
    </header>

    <section class="profile-hero">
      <div class="profile-hero__avatar-block">
        <UserAvatar
          :src="user.avatarURL"
          :user-name="user.name"
          :user-score="user.score"
        />
      </div>
      <button
        v-if="userInfo.userID !== user.userID"
        type="button"
        class="profile-dm"
        @click="navigateChat"
      >
        <Icon icon="tabler:message-circle" width="18" height="18" aria-hidden="true" />
        发私信
      </button>
    </section>

    <section class="profile-card">
      <h2 class="profile-card__label">
        <Icon icon="tabler:blockquote" width="18" height="18" aria-hidden="true" />
        个人简介
      </h2>
      <p class="profile-card__body">
        {{ user.intro || '暂无个人简介' }}
      </p>
    </section>
  </div>
</template>

<style scoped lang="scss">
.profile-page {
  width: 100%;
  max-width: 640px;
  margin: 0 auto;
  padding: 0 14px 1.5rem;
  box-sizing: border-box;
  color: var(--chat-text);
}

.profile-page__head {
  display: flex;
  align-items: flex-start;
  gap: 0.65rem;
  margin-bottom: 1.1rem;
}

.profile-page__head-icon {
  color: var(--chat-accent);
  flex-shrink: 0;
  margin-top: 2px;
}

.profile-page__title {
  margin: 0;
  font-size: 1.35rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--chat-text);
}

.profile-page__subtitle {
  margin: 0.3rem 0 0;
  font-size: 0.875rem;
  color: var(--chat-text-secondary);
}

.profile-hero {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 1rem;
  padding: 1.1rem 1rem;
  margin-bottom: 0.75rem;
  background: var(--chat-bg-highlight);
  border: 1px solid var(--chat-border);
  border-radius: 16px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}

.profile-hero__avatar-block {
  width: 100%;

  :deep(.user) {
    width: 100%;
    justify-content: flex-start;
    align-items: center;
    min-height: 4.5rem;
  }

  :deep(.user-avatar) {
    width: 4.5rem;
    height: 4.5rem;
  }

  :deep(.user-avatar-img) {
    --userImage: 4.5rem;
    width: 4.5rem !important;
    height: 4.5rem !important;
  }
}

.profile-dm {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  align-self: flex-start;
  padding: 10px 18px;
  border: none;
  border-radius: 12px;
  background: var(--chat-accent);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  text-transform: none;
  letter-spacing: 0;
  font-family: inherit;
  transition: filter 0.15s ease, transform 0.12s ease;
  -webkit-tap-highlight-color: transparent;

  &:hover {
    filter: brightness(1.05);
  }

  &:active {
    transform: scale(0.98);
  }
}

.profile-card {
  padding: 1rem 1.1rem;
  background: var(--chat-bg-highlight);
  border: 1px solid var(--chat-border);
  border-radius: 16px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}

.profile-card__label {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 0.65rem;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--chat-text-secondary);
}

.profile-card__body {
  margin: 0;
  font-size: 15px;
  line-height: 1.65;
  color: var(--chat-text);
  word-break: break-word;
  white-space: pre-wrap;
}
</style>
