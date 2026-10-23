<script setup lang="ts">
import { computed } from 'vue'

/**
 * 程序员节皮肤专属侧边栏图标。
 *
 * 设计语言对齐 public/skins/programmers-day-2026/stickers：
 * - 每个图标是一张圆角小卡片（贴纸同款底），浅色底 + 蓝色描边；
 * - 少量粉色/琥珀色点缀，模仿贴纸里的腮红、星星。
 *
 * 「小秋」是独立角色，保持原图标，不在此组件内。
 * 只在皮肤生效时由 PwaPcHeader 渲染；关掉皮肤后回退原有图标，互不影响。
 */
const props = defineProps<{
  name:
    | 'home'
    | 'post'
    | 'partitions'
    | 'course'
    | 'feedback'
    | 'shop'
    | 'music'
    | 'rating'
    | 'novel'
    | 'save'
    | 'history'
    | 'messages'
    | 'resume'
}>()

interface TileColors {
  bg: string
  ink: string
  accent: string
}

const TILES: Record<typeof props.name, TileColors> = {
  home: { bg: '#e7f0ff', ink: '#2f5bb8', accent: '#ff9db5' },
  post: { bg: '#eaf3ff', ink: '#3d6fd6', accent: '#ffd166' },
  partitions: { bg: '#eef4ff', ink: '#3d6fd6', accent: '#7aa7ff' },
  course: { bg: '#e6f7f4', ink: '#0d9488', accent: '#ffd166' },
  feedback: { bg: '#f0ecff', ink: '#6b5bd6', accent: '#ff9db5' },
  shop: { bg: '#fff1e6', ink: '#d97706', accent: '#ff9db5' },
  music: { bg: '#eef2ff', ink: '#4f6bd8', accent: '#7aa7ff' },
  rating: { bg: '#fff7e0', ink: '#d99a06', accent: '#ffd166' },
  novel: { bg: '#e9f3ff', ink: '#2f5bb8', accent: '#ff9db5' },
  save: { bg: '#ffeef4', ink: '#d6538a', accent: '#ff9db5' },
  history: { bg: '#eef1f6', ink: '#5b6b85', accent: '#9cbcff' },
  messages: { bg: '#e7f0ff', ink: '#2563eb', accent: '#ff9db5' },
  resume: { bg: '#e6f7f4', ink: '#0d9488', accent: '#ffd166' },
}

const tile = computed(() => TILES[props.name])
</script>

<template>
  <svg
    class="skin-nav-icon"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <rect x="0.75" y="0.75" width="22.5" height="22.5" rx="6.5" :fill="tile.bg" />
    <rect x="1.25" y="1.25" width="21.5" height="21.5" rx="6" :stroke="tile.ink" stroke-opacity="0.16" />

    <g :stroke="tile.ink" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <!-- 首页：圆角小屋 + 门 + 粉色心形烟囱 -->
      <template v-if="name === 'home'">
        <path d="M6 11.3 12 6l6 5.3V18a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1z" />
        <path d="M10 19v-4.2h4V19" />
        <path d="M17.6 6.2c.6-.55 1.5-.15 1.5.6 0 .6-.75 1.1-1.5 1.7-.75-.6-1.5-1.1-1.5-1.7 0-.75.9-1.15 1.5-.6z" :fill="tile.accent" stroke="none" />
      </template>

      <!-- 发帖：便签 + 铅笔 + 星星 -->
      <template v-else-if="name === 'post'">
        <rect x="5.2" y="4.8" width="9.4" height="12.2" rx="2" />
        <path d="M7.8 8.4h4M7.8 11.3h2.8" />
        <path d="m12.9 17 5.2-5.2 1.5 1.5-5.2 5.2-2.2.6z" :fill="tile.accent" :stroke="tile.ink" stroke-width="1.4" />
        <path d="M19.3 4.2l.35 1 1 .35-1 .35-.35 1-.35-1-1-.35 1-.35z" :fill="tile.accent" stroke="none" />
      </template>

      <!-- 分区：四宫格，其中一格用主题蓝填充 -->
      <template v-else-if="name === 'partitions'">
        <rect x="5" y="5" width="5.6" height="5.6" rx="1.7" />
        <rect x="13.4" y="5" width="5.6" height="5.6" rx="1.7" :fill="tile.accent" :stroke="tile.ink" />
        <rect x="5" y="13.4" width="5.6" height="5.6" rx="1.7" />
        <rect x="13.4" y="13.4" width="5.6" height="5.6" rx="1.7" />
      </template>

      <!-- 课程专区：翻开的书 + 书签 -->
      <template v-else-if="name === 'course'">
        <path d="M12 7.8C10.4 6.7 8.4 6.2 6 6.4v10.9c2.4-.2 4.4.3 6 1.4 1.6-1.1 3.6-1.6 6-1.4V6.4c-2.4-.2-4.4.3-6 1.4z" />
        <path d="M12 7.8v10.9" />
        <path d="M15.4 6.9v4.4l1.3-.9 1.3.9V7.2" :fill="tile.accent" stroke-width="1.3" />
      </template>

      <!-- 反馈：对话气泡 + 感叹号 -->
      <template v-else-if="name === 'feedback'">
        <path d="M6.2 6.2h11.6a1.8 1.8 0 0 1 1.8 1.8v6.1a1.8 1.8 0 0 1-1.8 1.8h-5.6L8 19v-3.1H6.2a1.8 1.8 0 0 1-1.8-1.8V8a1.8 1.8 0 0 1 1.8-1.8z" />
        <path d="M12 9v3.2" stroke-width="1.9" />
        <circle cx="12" cy="14.6" r=".95" :fill="tile.accent" stroke="none" />
      </template>

      <!-- 闲置：购物袋 + 提手 -->
      <template v-else-if="name === 'shop'">
        <path d="M6.8 9.2h10.4l-.9 8.6a1.6 1.6 0 0 1-1.6 1.4H9.3a1.6 1.6 0 0 1-1.6-1.4z" />
        <path d="M9.2 9.2V7.4a2.8 2.8 0 0 1 5.6 0v1.8" />
        <circle cx="12" cy="13.4" r="1.15" :fill="tile.accent" stroke="none" />
      </template>

      <!-- 音乐：双连音符 -->
      <template v-else-if="name === 'music'">
        <path d="M10 16.8V7.6l6.8-1.4v8.6" />
        <circle cx="8" cy="16.8" r="2" />
        <circle cx="14.8" cy="14.8" r="2" />
        <path d="M10 10.2 16.8 8.8" />
        <path d="M18.6 4.6l.3.85.85.3-.85.3-.3.85-.3-.85-.85-.3.85-.3z" :fill="tile.accent" stroke="none" />
      </template>

      <!-- 打分：星星 -->
      <template v-else-if="name === 'rating'">
        <path d="M12 5.9 13.7 9.4l3.8.55-2.75 2.7.65 3.8L12 14.65 8.6 16.45l.65-3.8-2.75-2.7 3.8-.55z" :fill="tile.accent" :stroke="tile.ink" />
      </template>

      <!-- 小说：翻开的书 + 书签丝带 -->
      <template v-else-if="name === 'novel'">
        <path d="M12 7.6C10.5 6.6 8.6 6.1 6.2 6.3v10.9c2.4-.2 4.3.3 5.8 1.3 1.5-1 3.4-1.5 5.8-1.3V6.3c-2.4-.2-4.3.3-5.8 1.3z" />
        <path d="M12 7.6v10.9" />
        <path d="M14.8 6.8v4.2l1.2-.8 1.2.8V7.1" :fill="tile.accent" stroke-width="1.3" />
      </template>

      <!-- 收藏：书签 + 粉心 -->
      <template v-else-if="name === 'save'">
        <path d="M8 5.4h8a1.6 1.6 0 0 1 1.6 1.6v11.8L12 15.6l-5.6 3.2V7A1.6 1.6 0 0 1 8 5.4z" />
        <path d="M12.1 8.6c.5-.5 1.4-.15 1.4.55 0 .55-.7 1-1.4 1.55-.7-.55-1.4-1-1.4-1.55 0-.7.9-1.05 1.4-.55z" :fill="tile.accent" stroke="none" />
      </template>

      <!-- 历史：时钟 + 回拨箭头 -->
      <template v-else-if="name === 'history'">
        <path d="M5.4 10.4A6.8 6.8 0 1 1 12 18.8" />
        <path d="M5.3 6.7v3.7h3.7" />
        <path d="M12 9.2V12l2.2 1.4" />
        <circle cx="18.6" cy="5.8" r="1.25" :fill="tile.accent" stroke="none" />
      </template>

      <!-- 消息：对话气泡 + 三个点 -->
      <template v-else-if="name === 'messages'">
        <path d="M6 6h12a1.8 1.8 0 0 1 1.8 1.8v6a1.8 1.8 0 0 1-1.8 1.8h-6.4L8 18.6v-3H6a1.8 1.8 0 0 1-1.8-1.8v-6A1.8 1.8 0 0 1 6 6z" />
        <circle cx="9" cy="10.9" r=".95" :fill="tile.ink" stroke="none" />
        <circle cx="12" cy="10.9" r=".95" :fill="tile.ink" stroke="none" />
        <circle cx="15" cy="10.9" r=".95" :fill="tile.accent" stroke="none" />
      </template>

      <!-- 简历专区：文档 + 人物头像 -->
      <template v-else-if="name === 'resume'">
        <rect x="6.2" y="4.6" width="11.6" height="14.8" rx="2" />
        <circle cx="12" cy="9.6" r="2.1" />
        <path d="M9 16c.5-1.8 1.6-2.7 3-2.7s2.5.9 3 2.7" />
        <path d="M16.8 4.2l.3.85.85.3-.85.3-.3.85-.3-.85-.85-.3.85-.3z" :fill="tile.accent" stroke="none" />
      </template>
    </g>
  </svg>
</template>

<style scoped lang="scss">
.skin-nav-icon {
  display: block;
  flex: 0 0 auto;
  width: 24px;
  height: 24px;
  border-radius: 7px;
  overflow: hidden;
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}


</style>
