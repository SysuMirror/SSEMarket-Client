<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { onMounted, ref } from 'vue'
import { requestFunc } from '@/api/req'
import { CONTENT_PARTITIONS } from '@/constants/partitions'

/** 常用入口项：前 8 项为内置固定入口，接口返回的动态应用追加其后；link 为外链 */
interface CommonEntry {
  key: string
  label: string
  icon: string
  to?: string
  href?: string
  colorBg?: string
  colorFg?: string
}

/** 内置固定入口：始终展示，不依赖接口 */
const fallbackEntries: CommonEntry[] = [
  { key: 'ranking', label: '排行榜', icon: 'tabler:trophy', to: '/ranking' },
  { key: 'xiaoqiu', label: '小秋', icon: 'tabler:sparkles', to: '/smart-xiaoqiu' },
  { key: 'rating', label: '打分', icon: 'tabler:star', to: '/rating' },
  { key: 'resume', label: '简历', icon: 'tabler:file-cv', to: '/resume' },
  { key: 'shop', label: '商城', icon: 'tabler:shopping-bag', to: '/shop' },
  { key: 'iwiki', label: 'iWiki', icon: 'tabler:book-2', href: 'https://ssemarket.cn/iwiki/' },
  { key: 'course', label: '课程专区', icon: 'tabler:book', to: '/course' },
  { key: 'xuerenhui', label: '学人汇', icon: 'tabler:external-link', href: 'https://scholarhub.top/' },
]

const commonEntries = ref<CommonEntry[]>(fallbackEntries)

/** 接口返回的工作台应用 */
interface WorkbenchAppItem {
  appID: number
  name: string
  icon: string
  targetType: 'route' | 'link'
  target: string
  colorBg?: string
  colorFg?: string
}

async function loadWorkbenchApps() {
  try {
    const res = await requestFunc('/auth/workbench/apps', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    }, false)
    if (!res || !res.ok)
      return
    const list = (await res.json()) as WorkbenchAppItem[]
    if (!Array.isArray(list) || list.length === 0)
      return
    // 默认 8 项始终在前，接口返回的动态应用追加在后（按 name 去重）
    const builtin = fallbackEntries.map(e => e.label)
    const dynamic = list
      .filter(app => !builtin.includes(app.name))
      .map(app => ({
        key: `app-${app.appID}`,
        label: app.name,
        icon: app.icon,
        to: app.targetType === 'route' ? app.target : undefined,
        href: app.targetType === 'link' ? app.target : undefined,
        colorBg: app.colorBg || undefined,
        colorFg: app.colorFg || undefined,
      }))
    commonEntries.value = [...fallbackEntries, ...dynamic]
  }
  catch {
    // 静默回退到内置列表
  }
}

onMounted(loadWorkbenchApps)

const partitions = CONTENT_PARTITIONS

function entryStyle(entry: CommonEntry) {
  const style: Record<string, string> = {}
  if (entry.colorBg)
    style['--cell-bg'] = entry.colorBg
  if (entry.colorFg)
    style['--cell-fg'] = entry.colorFg
  return style
}
</script>

<template>
  <div class="workbench">
    <!-- 顶部藏青色头部：app 风格 -->
    <header class="workbench__header">
      <h1 class="workbench__title">
        工作台
      </h1>
      <p class="workbench__subtitle">
        后续集市会扩展更多生态，目前大部分平台还在内测阶段
      </p>
    </header>

    <main class="workbench__body">
      <section class="workbench__section">
        <h2 class="workbench__section-title">
          常用
        </h2>
        <div class="workbench__grid">
          <a
            v-for="entry in commonEntries"
            :key="entry.key"
            class="wb-cell"
            :class="entry.colorBg ? '' : `wb-cell--${entry.key}`"
            :style="entryStyle(entry)"
            :href="entry.href"
            :target="entry.href ? '_blank' : undefined"
            :rel="entry.href ? 'noopener noreferrer' : undefined"
          >
            <span v-if="entry.to" class="wb-cell__router-wrap">
              <RouterLink :to="entry.to" class="wb-cell__link">
                <span class="wb-cell__icon-wrap">
                  <Icon :icon="entry.icon" class="wb-cell__icon" width="24" height="24" aria-hidden="true" />
                </span>
                <span class="wb-cell__label">{{ entry.label }}</span>
              </RouterLink>
            </span>
            <span v-else class="wb-cell__link">
              <span class="wb-cell__icon-wrap">
                <Icon :icon="entry.icon" class="wb-cell__icon" width="24" height="24" aria-hidden="true" />
              </span>
              <span class="wb-cell__label">{{ entry.label }}</span>
            </span>
          </a>
        </div>
      </section>

      <section class="workbench__section">
        <h2 class="workbench__section-title">
          全部分区
        </h2>
        <div class="workbench__grid">
          <RouterLink
            v-for="p in partitions"
            :key="p.key"
            class="wb-cell"
            :class="`wb-cell--${p.key}`"
            :to="`/partition/${encodeURIComponent(p.name)}`"
          >
            <span class="wb-cell__link">
              <span class="wb-cell__icon-wrap">
                <Icon :icon="p.icon" class="wb-cell__icon" width="24" height="24" aria-hidden="true" />
              </span>
              <span class="wb-cell__label">{{ p.name }}</span>
            </span>
          </RouterLink>
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped lang="scss">
/* 去AI味设计原则：
   - 单一强调色（藏青 --chat-accent），其余全部中性灰
   - 饱和度 < 80%，禁用紫蓝/多色渐变
   - 单一灰色家族（slate 冷灰）
   - 有色阴影（与背景色调匹配）
   - 圆角分层：图标 10px / 卡片 14px */

.workbench {
  width: 100%;
  max-width: 720px;
  margin: 0 auto;
  box-sizing: border-box;
  color: var(--chat-text, #1e293b);
  padding-bottom: env(safe-area-inset-bottom, 0);
  --wb-accent: var(--chat-accent, #2c3d56);
  --wb-bg: #f6f7f9;
  --wb-card: #ffffff;
  --wb-icon-bg: #f1f3f6;
  --wb-icon-fg: #475569;
  --wb-border: #e8ebf0;
  --wb-shadow: 0 1px 2px rgba(71, 85, 105, 0.04), 0 2px 8px rgba(71, 85, 105, 0.04);
}

/* 头部：浅色背景 + 藏青标题，不再用渐变 */
.workbench__header {
  padding: 22px 18px 14px;
  background: var(--wb-bg);
}

.workbench__title {
  margin: 0 0 4px;
  font-size: 1.3rem;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--wb-accent);
}

.workbench__subtitle {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: #94a3b8;
}

.workbench__body {
  padding: 4px 12px 24px;
  background: var(--wb-bg);
}

.workbench__section {
  margin-top: 12px;
  padding: 16px 14px 18px;
  background: var(--wb-card);
  border-radius: 14px;
  box-shadow: var(--wb-shadow);
}

.workbench__section-title {
  margin: 0 0 14px;
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.02em;
  color: #94a3b8;
}

.workbench__grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 18px 8px;
}

.wb-cell {
  display: block;
  text-decoration: none;
  color: inherit;
  -webkit-tap-highlight-color: transparent;
  transition: transform 0.1s ease;

  &:active {
    transform: scale(0.94);
  }
}

.wb-cell__router-wrap {
  display: block;
  width: 100%;
}

.wb-cell__link {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 7px;
  text-decoration: none;
  color: inherit;
}

/* Pastel 粉彩：每个图标低饱和粉彩底 + 深色图标，无渐变。
   参考 iOS 系统设置 / Notion 图标风格，饱和度 60-75%。 */
.wb-cell__icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 10px;
  margin: 0 auto;
  background: var(--cell-bg, var(--wb-icon-bg));
  transition: background 0.15s ease;
}

.wb-cell__icon {
  flex-shrink: 0;
  color: var(--cell-fg, var(--wb-icon-fg));
}

.wb-cell__label {
  font-size: 12px;
  font-weight: 500;
  line-height: 1.2;
  text-align: center;
  color: var(--chat-text, #1e293b);
}

/* 常用入口配色（Tailwind 100 底 / 700 图标） */
.wb-cell--ranking {
  --cell-bg: #fef3c7;
  --cell-fg: #b45309;
}
.wb-cell--xiaoqiu {
  --cell-bg: #e0f2fe;
  --cell-fg: #0369a1;
}
.wb-cell--rating {
  --cell-bg: #fef9c3;
  --cell-fg: #a16207;
}
.wb-cell--resume {
  --cell-bg: #ccfbf1;
  --cell-fg: #0f766e;
}
.wb-cell--shop {
  --cell-bg: #d1fae5;
  --cell-fg: #047857;
}
.wb-cell--iwiki {
  --cell-bg: #e0e7ff;
  --cell-fg: #4338ca;
}
.wb-cell--course {
  --cell-bg: #ffedd5;
  --cell-fg: #c2410c;
}

/* 全部分区配色 */
.wb-cell--study {
  --cell-bg: #cffafe;
  --cell-fg: #0e7490;
}
.wb-cell--daily-life {
  --cell-bg: #fce7f3;
  --cell-fg: #be185d;
}
.wb-cell--club {
  --cell-bg: #ede9fe;
  --cell-fg: #6d28d9;
}
.wb-cell--internship {
  --cell-bg: #dbeafe;
  --cell-fg: #1d4ed8;
}
.wb-cell--materials {
  --cell-bg: #fef9c3;
  --cell-fg: #a16207;
}
.wb-cell--dormitory {
  --cell-bg: #fef3c7;
  --cell-fg: #b45309;
}
.wb-cell--tech {
  --cell-bg: #e0e7ff;
  --cell-fg: #4338ca;
}
.wb-cell--team-up {
  --cell-bg: #ffe4e6;
  --cell-fg: #be123c;
}
.wb-cell--misc {
  --cell-bg: #f1f5f9;
  --cell-fg: #475569;
}

/* 深色模式：提高饱和度保持视觉权重（Apple HIG 原则），800 底 / 200 图标 */
body.dark-mode .workbench {
  --wb-bg: #0f172a;
  --wb-card: #1e293b;
  --wb-icon-bg: #334155;
  --wb-icon-fg: #cbd5e1;
  --wb-border: #334155;
  --wb-shadow: 0 1px 2px rgba(0, 0, 0, 0.3), 0 2px 8px rgba(0, 0, 0, 0.25);
  color: #e2e8f0;
}

body.dark-mode .workbench__title {
  color: var(--wb-accent, #5989b8);
}

body.dark-mode .workbench__subtitle,
body.dark-mode .workbench__section-title {
  color: #64748b;
}

body.dark-mode .wb-cell__label {
  color: #e2e8f0;
}

body.dark-mode .wb-cell--ranking {
  --cell-bg: #78350f;
  --cell-fg: #fde68a;
}
body.dark-mode .wb-cell--xiaoqiu {
  --cell-bg: #075985;
  --cell-fg: #bae6fd;
}
body.dark-mode .wb-cell--rating {
  --cell-bg: #713f12;
  --cell-fg: #fef08a;
}
body.dark-mode .wb-cell--resume {
  --cell-bg: #115e59;
  --cell-fg: #99f6e4;
}
body.dark-mode .wb-cell--shop {
  --cell-bg: #065f46;
  --cell-fg: #a7f3d0;
}
body.dark-mode .wb-cell--iwiki {
  --cell-bg: #3730a3;
  --cell-fg: #c7d2fe;
}
body.dark-mode .wb-cell--course {
  --cell-bg: #9a3412;
  --cell-fg: #fed7aa;
}
body.dark-mode .wb-cell--study {
  --cell-bg: #155e75;
  --cell-fg: #a5f3fc;
}
body.dark-mode .wb-cell--daily-life {
  --cell-bg: #9d174d;
  --cell-fg: #fbcfe8;
}
body.dark-mode .wb-cell--club {
  --cell-bg: #5b21b6;
  --cell-fg: #ddd6fe;
}
body.dark-mode .wb-cell--internship {
  --cell-bg: #1e40af;
  --cell-fg: #bfdbfe;
}
body.dark-mode .wb-cell--materials {
  --cell-bg: #713f12;
  --cell-fg: #fef08a;
}
body.dark-mode .wb-cell--dormitory {
  --cell-bg: #78350f;
  --cell-fg: #fde68a;
}
body.dark-mode .wb-cell--tech {
  --cell-bg: #3730a3;
  --cell-fg: #c7d2fe;
}
body.dark-mode .wb-cell--team-up {
  --cell-bg: #9f1239;
  --cell-fg: #fecdd3;
}
body.dark-mode .wb-cell--misc {
  --cell-bg: #334155;
  --cell-fg: #cbd5e1;
}
</style>
