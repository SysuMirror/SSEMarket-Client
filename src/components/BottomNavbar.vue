<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

const { noticeNum = 0, chatNum = 0 } = defineProps<{
  noticeNum?: number
  chatNum?: number
}>()

const route = useRoute()
const path = computed(() => route.path)

const isHome = computed(() => path.value === '/' || path.value === '/partition' || path.value.startsWith('/partition/'))
const isShop = computed(() => path.value.startsWith('/shop') || path.value.startsWith('/myproducts'))
const isNotice = computed(() => path.value === '/notice')
const isChat = computed(() => path.value === '/chat')
const isSmartXiaoQiu = computed(() => path.value === '/smart-xiaoqiu' || path.value.startsWith('/smart-xiaoqiu/'))
const myRoutes = ['/options', '/save', '/history', '/feedback']
const isMySection = computed(() => myRoutes.some(p => path.value === p || path.value.startsWith(`${p}/`)))

const myMenuVisible = ref(false)

function toggleMyMenu() {
  myMenuVisible.value = !myMenuVisible.value
}

function closeMyMenu() {
  myMenuVisible.value = false
}

function onDocClick(e: MouseEvent) {
  const el = e.target as Node
  const root = document.getElementById('bottomNavBar')
  if (myMenuVisible.value && root && !root.contains(el))
    myMenuVisible.value = false
}

watch(() => route.path, () => {
  myMenuVisible.value = false
})

onMounted(() => {
  document.addEventListener('click', onDocClick)
})
onUnmounted(() => {
  document.removeEventListener('click', onDocClick)
})
</script>

<template>
  <nav
    id="bottomNavBar"
    class="bottom-nav"
    role="navigation"
    aria-label="主导航"
  >
    <div class="bottom-nav__inner">
      <RouterLink
        class="bottom-nav__item"
        :class="{ 'bottom-nav__item--active': isHome }"
        to="/"
        @click="closeMyMenu"
      >
        <Icon icon="tabler:home" class="bottom-nav__icon bottom-nav__icon--home" width="24" height="24" aria-hidden="true" />
        <span class="bottom-nav__text">主页</span>
      </RouterLink>

      <RouterLink
        class="bottom-nav__item"
        :class="{ 'bottom-nav__item--active': isShop }"
        to="/shop"
        @click="closeMyMenu"
      >
        <Icon icon="tabler:shopping-bag" class="bottom-nav__icon bottom-nav__icon--shop" width="24" height="24" aria-hidden="true" />
        <span class="bottom-nav__text">商城</span>
      </RouterLink>

      <RouterLink
        class="bottom-nav__item bottom-nav__item--badge-wrap"
        :class="{ 'bottom-nav__item--active': isNotice }"
        to="/notice"
        @click="closeMyMenu"
      >
        <span class="bottom-nav__icon-slot">
          <span v-if="noticeNum > 0" class="bottom-nav__badge">{{ noticeNum > 99 ? '99+' : noticeNum }}</span>
          <Icon icon="tabler:bell" class="bottom-nav__icon bottom-nav__icon--notice" width="24" height="24" aria-hidden="true" />
        </span>
        <span class="bottom-nav__text">通知</span>
      </RouterLink>

      <RouterLink
        class="bottom-nav__item bottom-nav__item--badge-wrap"
        :class="{ 'bottom-nav__item--active': isChat }"
        to="/chat"
        @click="closeMyMenu"
      >
        <span class="bottom-nav__icon-slot">
          <span v-if="chatNum > 0" class="bottom-nav__badge">{{ chatNum > 99 ? '99+' : chatNum }}</span>
          <Icon icon="tabler:message-circle" class="bottom-nav__icon bottom-nav__icon--chat" width="24" height="24" aria-hidden="true" />
        </span>
        <span class="bottom-nav__text">私信</span>
      </RouterLink>

      <RouterLink
        class="bottom-nav__item"
        :class="{ 'bottom-nav__item--active': isSmartXiaoQiu }"
        to="/smart-xiaoqiu"
        @click="closeMyMenu"
      >
        <Icon icon="tabler:sparkles" class="bottom-nav__icon bottom-nav__icon--xiaoqiu" width="24" height="24" aria-hidden="true" />
        <span class="bottom-nav__text">智能小秋</span>
      </RouterLink>

      <div class="bottom-nav__item bottom-nav__item--my" :class="{ 'bottom-nav__item--active': isMySection }">
        <button
          type="button"
          class="bottom-nav__my-trigger"
          :aria-expanded="myMenuVisible"
          aria-haspopup="true"
          aria-label="我的菜单"
          @click.stop="toggleMyMenu"
        >
          <Icon icon="tabler:user" class="bottom-nav__icon bottom-nav__icon--user" width="24" height="24" aria-hidden="true" />
          <span class="bottom-nav__text">我的</span>
        </button>
        <Transition name="bottom-nav-drop">
          <div v-show="myMenuVisible" class="bottom-nav__dropdown" role="menu">
            <RouterLink class="bottom-nav__drop-link" role="menuitem" to="/options" @click="closeMyMenu">
              个人信息
            </RouterLink>
            <RouterLink class="bottom-nav__drop-link" role="menuitem" to="/save" @click="closeMyMenu">
              我的收藏
            </RouterLink>
            <RouterLink class="bottom-nav__drop-link" role="menuitem" to="/history" @click="closeMyMenu">
              发帖历史
            </RouterLink>
            <RouterLink class="bottom-nav__drop-link" role="menuitem" to="/feedback" @click="closeMyMenu">
              反馈
            </RouterLink>
          </div>
        </Transition>
      </div>
    </div>
  </nav>
</template>

<style scoped lang="scss">
.bottom-nav {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
  padding: 0 10px calc(10px + env(safe-area-inset-bottom, 0px));
  pointer-events: none;
}

.bottom-nav__inner {
  pointer-events: auto;
  display: flex;
  align-items: stretch;
  justify-content: space-between;
  gap: 4px;
  max-width: 520px;
  margin: 0 auto;
  padding: 8px 6px;
  background: var(--chat-bg-highlight);
  border: 1px solid var(--chat-border);
  border-radius: 20px;
  box-shadow:
    0 -4px 24px rgba(15, 23, 42, 0.06),
    0 1px 3px rgba(15, 23, 42, 0.04);
}

.bottom-nav__item {
  position: relative;
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 6px 2px;
  border-radius: 14px;
  text-decoration: none;
  font-size: 10px;
  font-weight: 500;
  line-height: 1.2;
  -webkit-tap-highlight-color: transparent;
  transition:
    background 0.18s ease,
    box-shadow 0.18s ease;

  .bottom-nav__text {
    color: var(--chat-text-secondary);
    transition:
      color 0.18s ease,
      font-weight 0.18s ease;
  }

  &:not(.bottom-nav__item--my):hover {
    background: rgba(59, 130, 246, 0.1);
    box-shadow: inset 0 0 0 1px rgba(44, 61, 86, 0.08);

    .bottom-nav__text {
      color: var(--chat-text);
      font-weight: 600;
    }
  }

  &--active:not(.bottom-nav__item--my) {
    background: linear-gradient(180deg, rgba(59, 130, 246, 0.16) 0%, rgba(44, 61, 86, 0.1) 100%);
    box-shadow: inset 0 0 0 1px rgba(44, 61, 86, 0.14);

    .bottom-nav__text {
      color: var(--chat-accent);
      font-weight: 700;
    }
  }

  &--badge-wrap {
    position: relative;
  }

  &--my {
    flex: 1;
    padding: 0;
  }
}

.bottom-nav__my-trigger {
  width: 100%;
  height: 100%;
  min-height: 52px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 6px 2px;
  border: none;
  border-radius: 14px;
  background: transparent;
  cursor: pointer;
  font: inherit;
  -webkit-tap-highlight-color: transparent;
  transition:
    background 0.18s ease,
    box-shadow 0.18s ease;

  .bottom-nav__text {
    color: var(--chat-text-secondary);
    transition:
      color 0.18s ease,
      font-weight 0.18s ease;
  }

  &:hover {
    background: rgba(59, 130, 246, 0.1);
    box-shadow: inset 0 0 0 1px rgba(44, 61, 86, 0.08);

    .bottom-nav__text {
      color: var(--chat-text);
      font-weight: 600;
    }
  }
}

.bottom-nav__item--active.bottom-nav__item--my .bottom-nav__my-trigger {
  background: linear-gradient(180deg, rgba(59, 130, 246, 0.16) 0%, rgba(44, 61, 86, 0.1) 100%);
  box-shadow: inset 0 0 0 1px rgba(44, 61, 86, 0.14);

  .bottom-nav__text {
    color: var(--chat-accent);
    font-weight: 700;
  }
}

.bottom-nav__icon {
  flex-shrink: 0;
  opacity: 0.95;
  transition: opacity 0.18s ease;
}

/* 未选中：按入口语义着色（悬停 / 选中不改变图标色） */
.bottom-nav__icon--home {
  color: #ea580c;
}
.bottom-nav__icon--shop {
  color: #059669;
}
.bottom-nav__icon--notice {
  color: #ca8a04;
}
.bottom-nav__icon--chat {
  color: #2563eb;
}
.bottom-nav__icon--xiaoqiu {
  color: #7c3aed;
}
.bottom-nav__icon--user {
  color: #475569;
}

body.dark-mode .bottom-nav__item:not(.bottom-nav__item--my):hover {
  background: rgba(96, 165, 250, 0.12);
  box-shadow: inset 0 0 0 1px rgba(148, 163, 184, 0.2);

  .bottom-nav__text {
    color: var(--chat-text);
  }
}

body.dark-mode .bottom-nav__item--active:not(.bottom-nav__item--my) {
  background: linear-gradient(180deg, rgba(96, 165, 250, 0.18) 0%, rgba(44, 61, 86, 0.35) 100%);
  box-shadow: inset 0 0 0 1px rgba(148, 163, 184, 0.28);

  .bottom-nav__text {
    color: var(--chat-accent);
  }
}

body.dark-mode .bottom-nav__my-trigger:hover {
  background: rgba(96, 165, 250, 0.12);
  box-shadow: inset 0 0 0 1px rgba(148, 163, 184, 0.2);

  .bottom-nav__text {
    color: var(--chat-text);
  }
}

body.dark-mode .bottom-nav__item--active.bottom-nav__item--my .bottom-nav__my-trigger {
  background: linear-gradient(180deg, rgba(96, 165, 250, 0.2) 0%, rgba(44, 61, 86, 0.4) 100%);
  box-shadow: inset 0 0 0 1px rgba(148, 163, 184, 0.3);

  .bottom-nav__text {
    color: var(--chat-accent);
  }
}

body.dark-mode .bottom-nav__icon--home {
  color: #fb923c;
}
body.dark-mode .bottom-nav__icon--shop {
  color: #34d399;
}
body.dark-mode .bottom-nav__icon--notice {
  color: #fbbf24;
}
body.dark-mode .bottom-nav__icon--chat {
  color: #60a5fa;
}
body.dark-mode .bottom-nav__icon--xiaoqiu {
  color: #c4b5fd;
}
body.dark-mode .bottom-nav__icon--user {
  color: #94a3b8;
}

.bottom-nav__text {
  white-space: nowrap;
}

.bottom-nav__icon-slot {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.bottom-nav__badge {
  position: absolute;
  top: -7px;
  right: -9px;
  z-index: 2;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  font-size: 10px;
  font-weight: 700;
  line-height: 16px;
  text-align: center;
  color: #ffffff;
  background: #ef4444;
  border-radius: 999px;
  box-shadow: 0 0 0 2px var(--chat-bg-highlight);
}

.bottom-nav__dropdown {
  position: absolute;
  bottom: calc(100% + 10px);
  right: 0;
  left: auto;
  min-width: 148px;
  padding: 6px;
  background: var(--chat-bg-highlight);
  border: 1px solid var(--chat-border);
  border-radius: 16px;
  box-shadow: 0 8px 28px rgba(15, 23, 42, 0.12);
}

.bottom-nav__drop-link {
  display: block;
  padding: 10px 12px;
  border-radius: 10px;
  text-align: left;
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  color: var(--chat-text);
  transition: background 0.12s ease;

  &:hover {
    background: rgba(59, 130, 246, 0.1);
  }

  &.router-link-active {
    color: var(--chat-accent);
    background: linear-gradient(180deg, rgba(59, 130, 246, 0.14) 0%, rgba(44, 61, 86, 0.08) 100%);
    box-shadow: inset 0 0 0 1px rgba(44, 61, 86, 0.12);
  }
}

body.dark-mode .bottom-nav__drop-link:hover {
  background: rgba(96, 165, 250, 0.12);
}

body.dark-mode .bottom-nav__drop-link.router-link-active {
  background: linear-gradient(180deg, rgba(96, 165, 250, 0.18) 0%, rgba(44, 61, 86, 0.28) 100%);
  box-shadow: inset 0 0 0 1px rgba(148, 163, 184, 0.22);
}

.bottom-nav-drop-enter-active,
.bottom-nav-drop-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}
.bottom-nav-drop-enter-from,
.bottom-nav-drop-leave-to {
  opacity: 0;
  transform: translateY(6px);
}

@media screen and (min-width: 768px) {
  .bottom-nav {
    position: relative;
    padding: 12px 0 calc(12px + env(safe-area-inset-bottom, 0px));
  }

  .bottom-nav__inner {
    max-width: 640px;
  }
}
</style>
