<script lang="ts" setup>
import { Icon } from '@iconify/vue'

/** 分区条统一用图标库，避免外链图片 404；key 用于图标语义色 */
const partitions: { name: string, icon: string, key: string }[] = [
  { name: '优质贴', icon: 'tabler:star', key: 'quality' },
  { name: '课程交流', icon: 'tabler:book', key: 'course' },
  { name: '日常吐槽', icon: 'tabler:message-circle', key: 'daily' },
  { name: '打听求助', icon: 'tabler:help-circle', key: 'help' },
  { name: '学习交流', icon: 'tabler:school', key: 'study' },
  { name: '院务', icon: 'tabler:building-community', key: 'affairs' },
  { name: '求职招募', icon: 'tabler:briefcase', key: 'jobs' },
  { name: '其他', icon: 'tabler:dots', key: 'misc' },
]
</script>

<template>
  <div class="partition-strip-wrap">
    <div class="lite-scrollbar partition-strip" role="list">
      <RouterLink
        to="/partitions"
        class="partition-chip partition-chip--all"
        role="listitem"
      >
        <span class="partition-chip__icon-wrap">
          <Icon icon="tabler:layout-grid" class="partition-chip__ico" width="18" height="18" aria-hidden="true" />
        </span>
        <span class="partition-chip__label">全部</span>
      </RouterLink>
      <RouterLink
        to="/rating"
        class="partition-chip partition-chip--rating"
        role="listitem"
      >
        <span class="partition-chip__icon-wrap">
          <Icon icon="tabler:stars" class="partition-chip__ico" width="18" height="18" aria-hidden="true" />
        </span>
        <span class="partition-chip__label">打分</span>
      </RouterLink>
      <RouterLink
        to="/shop"
        class="partition-chip partition-chip--shop"
        role="listitem"
      >
        <span class="partition-chip__icon-wrap">
          <Icon icon="tabler:shopping-bag" class="partition-chip__ico" width="18" height="18" aria-hidden="true" />
        </span>
        <span class="partition-chip__label">商城</span>
      </RouterLink>
      <RouterLink
        v-for="p in partitions"
        :key="p.name"
        :to="`/partition/${encodeURIComponent(p.name)}`"
        class="partition-chip"
        :class="`partition-chip--${p.key}`"
        role="listitem"
      >
        <span class="partition-chip__icon-wrap">
          <Icon :icon="p.icon" class="partition-chip__ico" width="18" height="18" :aria-hidden="true" />
        </span>
        <span class="partition-chip__label">{{ p.name }}</span>
      </RouterLink>
    </div>
  </div>
</template>

<style scoped lang="scss">
.partition-strip-wrap {
  width: 100%;
  max-width: 720px;
  margin: 0 auto 6px;
  padding: 0 8px;
  box-sizing: border-box;
}

.partition-strip {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  overflow-y: hidden;
  padding: 2px 0 6px;
  scroll-snap-type: x proximity;
  -webkit-overflow-scrolling: touch;

  &::-webkit-scrollbar {
    height: 4px;
  }
  &::-webkit-scrollbar-thumb {
    background: var(--chat-border-strong);
    border-radius: 4px;
  }
}

.partition-chip {
  flex: 0 0 auto;
  scroll-snap-align: start;
  display: inline-flex;
  flex-direction: row;
  align-items: center;
  gap: 6px;
  min-width: 0;
  max-width: none;
  padding: 5px 10px 5px 6px;
  border-radius: 10px;
  text-decoration: none;
  color: var(--chat-text-secondary);
  background: var(--chat-bg-highlight);
  border: 1px solid var(--chat-border);
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease,
    background 0.15s ease,
    color 0.15s ease;
  -webkit-tap-highlight-color: transparent;

  &:hover {
    border-color: var(--chat-border-strong);
    color: var(--chat-text);

    .partition-chip__ico {
      filter: brightness(1.12);
    }
  }

  &.router-link-active {
    border-color: var(--chat-accent);
    color: var(--chat-accent);
    background: var(--chat-accent-soft);
    box-shadow: 0 0 0 1px var(--chat-accent-soft);

    .partition-chip__ico {
      color: var(--chat-accent);
      filter: none;
    }
  }
}

.partition-chip--all .partition-chip__ico {
  color: #6366f1;
}
.partition-chip--rating .partition-chip__ico {
  color: #ca8a04;
}
.partition-chip--shop .partition-chip__ico {
  color: #059669;
}
.partition-chip--quality .partition-chip__ico {
  color: #ca8a04;
}
.partition-chip--course .partition-chip__ico {
  color: #2563eb;
}
.partition-chip--daily .partition-chip__ico {
  color: #db2777;
}
.partition-chip--help .partition-chip__ico {
  color: #ea580c;
}
.partition-chip--study .partition-chip__ico {
  color: #0d9488;
}
.partition-chip--affairs .partition-chip__ico {
  color: #64748b;
}
.partition-chip--jobs .partition-chip__ico {
  color: #1d4ed8;
}
.partition-chip--misc .partition-chip__ico {
  color: #78716c;
}

body.dark-mode .partition-chip--all .partition-chip__ico {
  color: #a5b4fc;
}
body.dark-mode .partition-chip--rating .partition-chip__ico,
body.dark-mode .partition-chip--quality .partition-chip__ico {
  color: #fcd34d;
}
body.dark-mode .partition-chip--shop .partition-chip__ico {
  color: #34d399;
}
body.dark-mode .partition-chip--course .partition-chip__ico {
  color: #93c5fd;
}
body.dark-mode .partition-chip--daily .partition-chip__ico {
  color: #f9a8d4;
}
body.dark-mode .partition-chip--help .partition-chip__ico {
  color: #fdba74;
}
body.dark-mode .partition-chip--study .partition-chip__ico {
  color: #5eead4;
}
body.dark-mode .partition-chip--affairs .partition-chip__ico {
  color: #cbd5e1;
}
body.dark-mode .partition-chip--jobs .partition-chip__ico {
  color: #93c5fd;
}
body.dark-mode .partition-chip--misc .partition-chip__ico {
  color: #a8a29e;
}

.partition-chip__icon-wrap {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: auto;
  height: auto;
  padding: 0;
  border: none;
  background: transparent;
  border-radius: 0;
}

.partition-chip__ico {
  flex-shrink: 0;
  color: var(--chat-text-secondary);
  opacity: 0.92;
  transition:
    color 0.15s ease,
    filter 0.15s ease;
}

.partition-chip__label {
  font-size: 12px;
  font-weight: 600;
  line-height: 1.2;
  white-space: nowrap;
  text-align: left;
}

.lite-scrollbar {
  scrollbar-width: thin;
  scrollbar-color: var(--chat-border-strong) transparent;
}
</style>
