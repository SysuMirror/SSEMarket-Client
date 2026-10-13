<script setup lang="ts">
defineProps<{
  open: boolean
}>()
const emit = defineEmits<{
  close: []
}>()

const groups = [
  {
    title: '发布',
    items: [
      '发帖 +10 / 篇',
      '一级评论 +5 / 条(你在任何帖子下发出的评论)',
      '二级评论 +5 / 条(你回复别人的评论)',
    ],
  },
  {
    title: '被互动',
    items: [
      '收到点赞 +1 / 个(你的帖子或评论被赞)',
      '帖子被收藏 +3 / 次',
      '帖子被投票 +3 / 票',
      '帖子被他人评论 +2 / 条',
      '你的评论被他人回复 +2 / 条',
    ],
  },
  {
    title: '浏览加成',
    items: [
      '每帖 经验 = 浏览量 × 0.01(向上取整)',
    ],
  },
  {
    title: '投币加成',
    items: [
      '投 1 硬币 + 10 经验',
    ],
  },
]
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="exp-rules-mask"
      @click.self="emit('close')"
    >
      <div
        class="exp-rules-box"
        role="dialog"
        aria-modal="true"
        aria-labelledby="exp-rules-heading"
      >
        <div class="exp-rules-head">
          <h2 id="exp-rules-heading" class="exp-rules-title">
            经验规则
          </h2>
          <button
            type="button"
            class="exp-rules-close"
            aria-label="关闭"
            @click="emit('close')"
          >
            ×
          </button>
        </div>
        <p class="exp-rules-note">
          经验不是实时累加:服务器每小时全量重算一次(启动时也会先算一轮)。
        </p>
        <section
          v-for="g in groups"
          :key="g.title"
          class="exp-rules-group"
        >
          <h3 class="exp-rules-group-title">
            {{ g.title }}
          </h3>
          <ul class="exp-rules-list">
            <li v-for="item in g.items" :key="item">
              {{ item }}
            </li>
          </ul>
        </section>
        <p class="exp-rules-foot">
          等级共 9 级(Lv0~Lv8),满级 5000 经验,达成后可自定义专属称号。
        </p>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.exp-rules-mask {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.5);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  animation: exp-rules-mask-in 0.2s ease both;
}

@keyframes exp-rules-mask-in {
  from {
    opacity: 0;
  }
}

.exp-rules-box {
  position: relative;
  width: 100%;
  max-width: 420px;
  max-height: min(80vh, 640px);
  overflow-y: auto;
  box-sizing: border-box;
  padding: 20px 22px;
  border-radius: var(--radius-lg);
  background: var(--color-card);
  color: var(--color-text);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);
  animation: exp-rules-box-in 0.24s ease-out both;
}

@keyframes exp-rules-box-in {
  from {
    opacity: 0;
    transform: translateY(8px) scale(0.97);
  }
}

.exp-rules-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.exp-rules-title {
  font-size: 16px;
  font-weight: 700;
  margin: 0;
}

.exp-rules-close {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: 0;
  border-radius: var(--radius-md);
  font-size: 18px;
  line-height: 1;
  color: var(--color-text-muted);
  cursor: pointer;
}

.exp-rules-close:hover {
  background: var(--color-hover);
  color: var(--color-text);
}

.exp-rules-note {
  font-size: 12px;
  line-height: 1.7;
  color: var(--color-text-secondary);
  margin: 0 0 14px;
}

.exp-rules-group {
  margin-bottom: 12px;
}

.exp-rules-group-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--accent);
  margin: 0 0 6px;
}

.exp-rules-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.exp-rules-list li {
  font-size: 13px;
  line-height: 1.8;
  color: var(--color-text);
}

.exp-rules-list li::before {
  content: '·';
  margin-right: 6px;
  color: var(--color-text-muted);
}

.exp-rules-foot {
  font-size: 12px;
  color: var(--color-text-muted);
  border-top: 1px solid var(--color-border);
  padding-top: 10px;
  margin: 14px 0 0;
}

@media (prefers-reduced-motion: reduce) {
  .exp-rules-mask,
  .exp-rules-box {
    animation: none;
  }
}
</style>
