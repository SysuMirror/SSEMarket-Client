<script setup lang="ts">
import { computed, ref, useSlots, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useWornBadge } from '@/composables/useWornBadge'
import { defaultAvatarFor } from '@/utils/defaultAvatar'
import { levelClassHandler, titleNameHandler } from '@/utils/level'
import UserIdentityIcon from './UserIdentityIcon.vue'

const props = withDefaults(
  defineProps<{
    src: string
    userId?: number
    userIdentity?: string
    userName?: string
    userScore?: number
    /** Lv8 用户自定义称号;空=未自定义(显示 userName) */
    userTitle?: string
    /** 为 true 时不渲染内置个人主页链接（由外层 RouterLink 包裹时使用，避免 a 嵌套 a） */
    noProfileLink?: boolean
    /** @deprecated 已废弃，个人主页跳转仅依赖 userId */
    userPhone?: string
    /** compact：评论区等窄场景，缩小头像与字号 */
    size?: 'default' | 'compact'
  }>(),
  { userId: 0, userIdentity: '', userName: '', userScore: 0, userTitle: '', noProfileLink: false, userPhone: undefined, size: 'default' },
)

const slots = useSlots()
const router = useRouter()
const hasReplySlot = computed(() => typeof slots.reply === 'function')
const displaySrc = ref('')

const resolvedUserId = computed(() => {
  const n = Number(props.userId)
  return Number.isFinite(n) && n > 0 ? n : 0
})

const defaultAvatar = computed(() => defaultAvatarFor(resolvedUserId.value))

const levelText = computed(() => titleNameHandler(props.userScore ?? 0, props.userTitle, props.userName))

/** 对外挂载的勋章（帖子/评论等昵称旁只挂 1 枚，由用户在自己的主页设置）。 */
const wornBadge = useWornBadge(resolvedUserId)
const wornBadgeBroken = ref(false)
watch(
  () => wornBadge.value?.imageURL,
  () => {
    wornBadgeBroken.value = false
  },
)

// Lv8 倒影文字经 CSS 变量注入,JSON.stringify 负责加引号并转义
const level8Style = computed(() => {
  if ((props.userScore ?? 0) < 5000)
    return undefined
  return { '--lv8-text': JSON.stringify(levelText.value) }
})

const profileNavigable = computed(
  () => !props.noProfileLink && resolvedUserId.value > 0,
)

watch(
  () => props.src,
  (s) => {
    displaySrc.value = (s && s.trim()) ? s : defaultAvatar.value
  },
  { immediate: true },
)

function onAvatarError() {
  if (displaySrc.value !== defaultAvatar.value)
    displaySrc.value = defaultAvatar.value
}

async function goToProfile() {
  if (!profileNavigable.value)
    return

  await router.push({
    name: 'UserProfile',
    params: { id: String(resolvedUserId.value) },
  })
}

function onProfileClick(event: MouseEvent) {
  if (!profileNavigable.value)
    return
  event.preventDefault()
  event.stopPropagation()
  void goToProfile()
}

function onProfileKeydown(event: KeyboardEvent) {
  if (!profileNavigable.value)
    return
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    event.stopPropagation()
    void goToProfile()
  }
}
</script>

<template>
  <div class="user" :class="{ 'user--has-reply': hasReplySlot, 'user--compact': props.size === 'compact' }">
    <div
      class="user__cluster"
      :class="{ 'user__cluster--link': profileNavigable }"
      :role="profileNavigable ? 'link' : undefined"
      :tabindex="profileNavigable ? 0 : undefined"
      @click="onProfileClick"
      @keydown="onProfileKeydown"
    >
      <div class="user-avatar">
        <img
          class="user-avatar-img"
          :src="displaySrc"
          loading="lazy" decoding="async"
          :alt="resolvedUserId > 0 ? String(resolvedUserId) : '头像'"
          @error="onAvatarError"
        >
        <UserIdentityIcon :identity="props.userIdentity" />
      </div>
      <div
        v-if="props.userName"
        class="user-meta"
      >
        <span
          v-if="props.userScore"
          class="user-level w-fit whitespace-nowrap text-3"
          :class="levelClassHandler(props.userScore)"
          :style="level8Style"
        >{{ levelText }}
        </span>
        <span class="user-name-row">
          <span class="user-name w-fit whitespace-nowrap text-5">{{ props.userName }}</span>
          <img
            v-if="wornBadge && !wornBadgeBroken"
            class="user-worn-badge"
            :src="wornBadge.imageURL"
            :alt="wornBadge.name"
            :title="wornBadge.name"
            loading="lazy" decoding="async"
            @error="wornBadgeBroken = true"
          >
        </span>
      </div>
    </div>
    <div v-if="hasReplySlot" class="user__reply">
      <slot name="reply" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.user {
  --userImage: 50px;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  box-sizing: border-box;
  font-size: 1.2rem;
  font-weight: bold;
  height: auto;
  min-height: var(--userImage);

  &--has-reply {
    height: auto;
    min-height: var(--userImage);
  }

  &--compact {
    --userImage: 40px;
    width: auto;
    height: auto;
    min-height: var(--userImage);
    font-size: 1rem;

    .user-name {
      font-size: 0.9375rem;
      line-height: 1.25;
    }

    .user-level {
      font-size: 0.6875rem;
      line-height: 1.2;
      overflow: hidden;

      /* 评论区紧凑布局：Lv7/Lv8 倒影会与下方内容重叠 */
      &.level-7::before,
      &.level-8::before {
        display: none;
        content: none;
      }
    }
  }
}

.user__cluster {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  box-sizing: border-box;
  flex: 0 1 auto;
  width: fit-content;
  max-width: 100%;
  min-width: 0;
  min-height: var(--userImage);
  text-decoration: none;
  color: inherit;
  -webkit-tap-highlight-color: transparent;

  &--link {
    cursor: pointer;
    outline: none;

    &:hover,
    &:active,
    &:focus-visible {
      background: transparent;
    }

    &:focus-visible {
      box-shadow: 0 0 0 2px var(--chat-accent-soft, rgba(44, 61, 86, 0.2));
      border-radius: 8px;
    }
  }

  .user-name {
    display: inline-block;
    max-width: 100%;
    text-overflow: ellipsis;
    white-space: nowrap;
    overflow: hidden;
    min-width: 0;

    color: var(--color-user-text);
  }

  /* 昵称 + 对外挂载勋章：勋章固定大小，昵称过长时只省略昵称。 */
  .user-name-row {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
    max-width: 100%;
  }

  .user-avatar {
    position: relative;
    flex-shrink: 0;
    width: var(--userImage);
    height: var(--userImage);
    display: flex;
    align-items: center;
    justify-content: center;

    .user-avatar-img {
      display: block;
      width: 100%;
      height: 100%;
      border-radius: 50%;
      object-fit: cover;
      background: #fff;
      filter: none;
    }

    color-scheme: only light;
  }
}

:global(body.dark-mode) .user-avatar .user-avatar-img {
  filter: none !important;
}

.user--compact .user__cluster {
  align-items: center;
  gap: 0;
}

.user-worn-badge {
  flex: 0 0 auto;
  width: 18px;
  height: 18px;
  object-fit: contain;
  filter: drop-shadow(0 1px 1px rgba(30, 51, 92, 0.22));
  user-select: none;
  pointer-events: none;
}

.user--compact .user-worn-badge {
  width: 16px;
  height: 16px;
}

.user--compact .user-meta {
  margin-left: 8px;
  justify-content: center;
}

.user__reply {
  width: 100%;
  max-width: 100%;
  font-size: 0.8125rem;
  font-weight: 600;
  line-height: 1.35;
  color: var(--chat-text-secondary, #64748b);
  padding-left: 0;
  box-sizing: border-box;
}

.user-meta {
  position: relative;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  margin-left: 0.25rem;
  height: 100%;
  min-width: 0;
  max-width: 100%;
  flex: 0 1 auto;
  text-align: left;
}

.user-level {
  position: relative;
  flex-shrink: 0;
  line-height: 1.15;
  margin-bottom: 1px;
}

.level-undefined {
  text-shadow:
    0.2em 0.2em var(--color-level-undefined-box-shadow),
    -0.2em -0.2em var(--color-level-undefined-box-shadow);
}
.level-0 {
  color: #18b5ca;
}
.level-1 {
  color: #378814;
}
.level-2 {
  color: #d74a4a;
}
.level-3 {
  color: rgb(240, 133, 39);
}
.level-4 {
  background: linear-gradient(45deg, #ff7d7d, #ff5a99, #e376e5, #9a7ef8);
  color: transparent;
  background-clip: text;
  background-size: 300% 300%;
  animation: change-color 5s ease infinite;
}
.level-5 {
  background: linear-gradient(45deg, #ff7d7d, #ff5a99, #e376e5, #9a7ef8);
  background-size: 300% 300%;
  color: transparent;
  background-clip: text;
  animation: change-color 5s ease infinite;
}
.level-6 {
  background: linear-gradient(45deg, #ff7d7d, #ff5a99, #e376e5, #9a7ef8);
  background-size: 300% 300%;
  color: transparent;
  background-clip: text;
  animation: change-color 5s ease infinite;
}
.level-6::before {
  content: 'Lv6 专家';
  position: absolute;
  transform: rotateX(180deg);
  transform-origin: bottom;
  line-height: 32px;
  background: linear-gradient(0deg, #9a7ef8 0, transparent 80%);
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
  opacity: 0.5;
}
.level-7 {
  background: linear-gradient(45deg, #ff7d7d, #ff5a99, #e376e5, #9a7ef8);
  color: transparent;
  background-clip: text;
  -webkit-background-clip: text;
  animation: change-color 5s ease infinite;
  background-size: 300% 300%;
}
.level-7::before {
  content: 'Lv7 大神';
  transform: rotateX(180deg);
  position: absolute;
  transform-origin: bottom;
  line-height: 32px;
  background: linear-gradient(
    45deg,
    #ff7d7d3e,
    #ff5a993e,
    #e376e53e,
    #9a7ef83e,
    transparent,
    #9a7ef73e,
    #e376e53e,
    #ff5a993e,
    #ff7d7d3e
  );
  background-size: 300% 300%;
  color: transparent;
  background-clip: text;
  animation: change-color 5s ease infinite;
  opacity: 0.5;
}
.level-8 {
  text-shadow:
    2px 2px 4px rgba(0, 0, 0, 0.3),
    -2px -2px 4px rgba(255, 255, 255, 0.3);
}
.level-8::before {
  content: var(--lv8-text, 'Lv8');
  transform: rotateX(160deg) skew(10deg);
  position: absolute;
  transform-origin: bottom;
  line-height: 32px;
  background: linear-gradient(
    45deg,
    #ff7d7d,
    #ff5a99,
    #e376e5,
    #9a7ef8,
    transparent,
    #9a7ef8,
    #e376e5,
    #ff5a99,
    #ff7d7d
  );
  background-size: 300% 300%;
  color: transparent;
  background-clip: text;
  -webkit-background-clip: text;
  animation: change-color 5s ease infinite;
  opacity: 0.25;
}

@keyframes change-color {
  0% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
}
</style>
