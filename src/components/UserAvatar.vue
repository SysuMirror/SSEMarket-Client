<script setup lang="ts">
import { computed, ref, useSlots, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { getAllInfo } from '@/api/info/getInfo'
import { levelClassHandler, levelNameHandler } from '@/utils/level'
import UserIdentityIcon from './UserIdentityIcon.vue'

const props = withDefaults(
  defineProps<{
    src: string
    userId?: number
    userIdentity?: string
    userName?: string
    userScore?: number
    /** 为 true 时不渲染内置个人主页链接（由外层 RouterLink 包裹时使用，避免 a 嵌套 a） */
    noProfileLink?: boolean
    /** 用户手机号，用于当 userId 无效时尝试通过手机号获取用户信息并跳转 */
    userPhone?: string
  }>(),
  { userId: 0, userIdentity: '', userName: '', userScore: 0, noProfileLink: false, userPhone: undefined },
)

const slots = useSlots()
const router = useRouter()
const hasReplySlot = computed(() => typeof slots.reply === 'function')
const defaultAvatar = `${import.meta.env.BASE_URL}default-avatar.svg`

const displaySrc = ref(defaultAvatar)

const resolvedUserId = computed(() => {
  const n = Number(props.userId)
  return Number.isFinite(n) && n > 0 ? n : 0
})

const profileLinkTo = computed(() => ({
  name: 'UserProfile' as const,
  params: { id: String(resolvedUserId.value) },
}))

/** 内置跳转：有 userId 且未要求外层独占链接时，使用 RouterLink（与帖子正文区 RouterLink 一致） */
const useInternalProfileLink = computed(
  () => !props.noProfileLink && resolvedUserId.value > 0,
)

/** 是否有手机号但 userId 无效，需要通过手机号解析 */
const needsPhoneResolution = computed(
  () => !props.noProfileLink && resolvedUserId.value <= 0 && props.userPhone,
)

const phoneResolutionCache = new Map<string, number>()

watch(
  () => props.src,
  (s) => {
    displaySrc.value = (s && s.trim()) ? s : defaultAvatar
  },
  { immediate: true },
)

function onAvatarError() {
  if (displaySrc.value !== defaultAvatar)
    displaySrc.value = defaultAvatar
}

async function handleAvatarClickWithPhoneResolution() {
  if (!props.userPhone)
    return

  const phone = props.userPhone.trim()
  if (!phone)
    return

  if (phoneResolutionCache.has(phone)) {
    const cachedId = phoneResolutionCache.get(phone)!
    if (cachedId > 0) {
      router.push({ name: 'UserProfile', params: { id: String(cachedId) } })
    }
    return
  }

  try {
    const userInfo = await getAllInfo(phone)
    if (userInfo.userID > 0) {
      phoneResolutionCache.set(phone, userInfo.userID)
      router.push({ name: 'UserProfile', params: { id: String(userInfo.userID) } })
    }
  }
  catch (e) {
    console.error('Failed to resolve user by phone:', e)
    phoneResolutionCache.set(phone, -1)
  }
}
</script>

<template>
  <div class="user" :class="{ 'user--has-reply': hasReplySlot }">
    <component
      :is="useInternalProfileLink ? RouterLink : 'div'"
      v-bind="useInternalProfileLink ? { to: profileLinkTo } : {}"
      class="user__cluster"
      :class="{ 'user__cluster--link': useInternalProfileLink || needsPhoneResolution }"
      @click="needsPhoneResolution ? handleAvatarClickWithPhoneResolution() : undefined"
    >
      <div class="user-avatar">
        <img
          class="user-avatar-img"
          :src="displaySrc"
          loading="lazy"
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
        >{{ levelNameHandler(props.userScore) }}
        </span>
        <span class="user-name w-fit whitespace-nowrap text-5">{{ props.userName
        }}</span>
      </div>
    </component>
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
  height: var(--userImage);

  &--has-reply {
    height: auto;
    min-height: var(--userImage);
  }
}

.user__cluster {
  display: flex;
  flex-direction: row;
  align-items: center;
  box-sizing: border-box;
  flex: 0 1 auto;
  width: fit-content;
  max-width: 100%;
  min-width: 0;
  height: var(--userImage);
  min-height: var(--userImage);
  text-decoration: none;
  color: inherit;
  -webkit-tap-highlight-color: transparent;

  &--link {
    cursor: pointer;
  }

  .user-name {
    color: var(--color-user-text);
  }

  .user-avatar {
    position: relative;
    flex-shrink: 0;
    width: 3.4rem;
    height: 3.4rem;

    .user-avatar-img {
      width: var(--userImage);
      height: var(--userImage);
      border-radius: 50%;
      background: #fff;
    }
  }
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
  content: '祖师爷';
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
