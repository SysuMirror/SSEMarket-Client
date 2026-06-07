<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useRouter } from 'vue-router'
import { CONTENT_PARTITIONS } from '@/constants/partitions'

const router = useRouter()
const partitions = CONTENT_PARTITIONS

function sendPartition(p: string) {
  router.push(`/partition/${encodeURIComponent(p)}`)
}
</script>

<template>
  <div class="picker">
    <h2 class="picker__title">
      选择分区
    </h2>
    <div class="picker__grid">
      <article
        v-for="p in partitions"
        :key="p.key"
        class="picker-card"
      >
        <div
          class="picker-card__media"
          :class="`picker-card__media--${p.key}`"
        >
          <Icon
            :icon="p.icon"
            class="picker-card__icon"
            width="32"
            height="32"
            aria-hidden="true"
          />
        </div>
        <div class="picker-card__body">
          <h3 class="picker-card__name">
            {{ p.name }}
          </h3>
          <p class="picker-card__desc">
            {{ p.description }}
          </p>
          <button
            type="button"
            class="picker-card__btn"
            @click="sendPartition(p.name)"
          >
            进入分区
          </button>
        </div>
      </article>
    </div>
  </div>
</template>

<style scoped lang="scss">
.picker {
  width: 100%;
  max-width: 720px;
  margin: 0 auto;
  padding: 6px 10px 12px;
  box-sizing: border-box;
  color: var(--chat-text, var(--color-text));
}

.picker__title {
  margin: 0 0 8px;
  font-size: 1.05rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--chat-text, var(--color-text));
}

.picker__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  width: 100%;
}

@media screen and (min-width: 520px) {
  .picker__grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media screen and (min-width: 840px) {
  .picker__grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

.picker-card {
  display: flex;
  flex-direction: column;
  min-width: 0;
  border-radius: 12px;
  overflow: hidden;
  background: var(--chat-bg-highlight, #fff);
  border: 1px solid var(--chat-border, #e2e8f0);
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05);
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;

  &:hover {
    border-color: var(--chat-border-strong, #cbd5e1);
    box-shadow: 0 2px 8px rgba(15, 23, 42, 0.07);
  }
}

.picker-card__media {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  aspect-ratio: 5 / 3;
  max-height: 88px;
  background: var(--chat-bg-main, #f1f5f9);
}

.picker-card__icon {
  flex-shrink: 0;
  opacity: 0.95;
}

.picker-card__media--study {
  background: rgba(13, 148, 136, 0.1);
  .picker-card__icon { color: #0d9488; }
}
.picker-card__media--daily-life {
  background: rgba(219, 39, 119, 0.1);
  .picker-card__icon { color: #db2777; }
}
.picker-card__media--club {
  background: rgba(139, 92, 246, 0.1);
  .picker-card__icon { color: #8b5cf6; }
}
.picker-card__media--internship {
  background: rgba(29, 78, 216, 0.1);
  .picker-card__icon { color: #1d4ed8; }
}
.picker-card__media--materials {
  background: rgba(202, 138, 4, 0.1);
  .picker-card__icon { color: #ca8a04; }
}
.picker-card__media--dormitory {
  background: rgba(5, 150, 105, 0.1);
  .picker-card__icon { color: #059669; }
}
.picker-card__media--tech {
  background: rgba(37, 99, 235, 0.1);
  .picker-card__icon { color: #2563eb; }
}
.picker-card__media--course {
  background: rgba(234, 88, 12, 0.1);
  .picker-card__icon { color: #ea580c; }
}
.picker-card__media--team-up {
  background: rgba(249, 115, 22, 0.1);
  .picker-card__icon { color: #f97316; }
}
.picker-card__media--misc {
  background: rgba(120, 113, 108, 0.1);
  .picker-card__icon { color: #78716c; }
}

.picker-card__body {
  padding: 8px 10px 10px;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.picker-card__name {
  margin: 0 0 4px;
  font-size: 0.875rem;
  font-weight: 600;
  line-height: 1.3;
  color: var(--chat-text, var(--color-text));
}

.picker-card__desc {
  margin: 0 0 8px;
  font-size: 11px;
  line-height: 1.35;
  color: var(--chat-text-secondary, #64748b);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  flex: 1;
}

.picker-card__btn {
  align-self: flex-start;
  margin-top: auto;
  padding: 5px 10px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.2;
  color: #fff;
  background: var(--chat-accent, #2c3d56);
  border: none;
  border-radius: 8px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition:
    filter 0.12s ease,
    transform 0.12s ease;

  &:hover {
    filter: brightness(1.05);
  }

  &:active {
    transform: scale(0.98);
  }
}

body.dark-mode .picker-card {
  background: var(--chat-bg-highlight, #1e293b);
  border-color: var(--chat-border, #334155);
}

body.dark-mode .picker-card__desc {
  color: var(--chat-text-secondary, #94a3b8);
}

body.dark-mode .picker-card__media--study .picker-card__icon { color: #5eead4; }
body.dark-mode .picker-card__media--daily-life .picker-card__icon { color: #f9a8d4; }
body.dark-mode .picker-card__media--club .picker-card__icon { color: #c4b5fd; }
body.dark-mode .picker-card__media--internship .picker-card__icon { color: #93c5fd; }
body.dark-mode .picker-card__media--materials .picker-card__icon { color: #fcd34d; }
body.dark-mode .picker-card__media--dormitory .picker-card__icon { color: #34d399; }
body.dark-mode .picker-card__media--tech .picker-card__icon { color: #93c5fd; }
body.dark-mode .picker-card__media--course .picker-card__icon { color: #fdba74; }
body.dark-mode .picker-card__media--team-up .picker-card__icon { color: #fdba74; }
body.dark-mode .picker-card__media--misc .picker-card__icon { color: #a8a29e; }
</style>
