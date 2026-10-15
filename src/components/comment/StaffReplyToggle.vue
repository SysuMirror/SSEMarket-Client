<script setup lang="ts">
import type { StaffAlias } from '@/api/staff/staff'

/**
 * 「以职位身份回复」开关（开发人员匿名 @）。
 *
 * 仅当后端确认「当前用户在本帖线程内被 @ 过、且有对应职位」时 aliases 才非空——
 * 普通用户拿到的是空数组，组件整体不渲染，评论区与原来完全一样。
 * modelValue = 选中的职位小号 userID（0 = 以本人身份回复）。
 */
const { aliases, modelValue } = defineProps<{
  aliases: StaffAlias[]
  modelValue: number
}>()

const emit = defineEmits<{
  'update:modelValue': [userID: number]
}>()

function pick(a: StaffAlias) {
  emit('update:modelValue', modelValue === a.userID ? 0 : a.userID)
}
</script>

<template>
  <div v-if="aliases.length > 0" class="staff-reply" role="group" aria-label="以职位身份回复">
    <span class="staff-reply__label">以职位身份回复</span>
    <div class="staff-reply__options">
      <button
        v-for="a in aliases"
        :key="a.aliasID"
        type="button"
        class="staff-reply__chip"
        :class="{ 'staff-reply__chip--active': modelValue === a.userID }"
        :aria-pressed="modelValue === a.userID"
        @click="pick(a)"
      >
        @{{ a.alias }}
        <span class="staff-reply__chip-title">{{ a.title }}</span>
      </button>
    </div>
    <span class="staff-reply__hint">
      {{ modelValue > 0 ? '将以职位主页（满级、称号=职位）对外显示' : '默认以本人身份回复' }}
    </span>
  </div>
</template>

<style scoped lang="scss">
.staff-reply {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
  margin-bottom: 6px;
  padding: 6px 10px;
  border: 1px dashed var(--chat-border-strong);
  border-radius: 8px;
  background: var(--chat-accent-soft);
}

.staff-reply__label {
  font-size: 12px;
  font-weight: 600;
  color: var(--chat-text-secondary);
}

.staff-reply__options {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.staff-reply__chip {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  padding: 4px 10px;
  border: 1px solid var(--chat-border);
  border-radius: 999px;
  background: var(--chat-bg-main);
  color: var(--chat-text-secondary);
  font-family: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition:
    background 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease;

  &:hover {
    border-color: var(--chat-accent);
    color: var(--chat-accent);
  }

  &--active {
    border-color: var(--chat-accent);
    background: var(--chat-accent);
    color: var(--chat-bg-highlight);

    .staff-reply__chip-title {
      color: var(--chat-bg-highlight);
      opacity: 0.85;
    }
  }
}

.staff-reply__chip-title {
  font-weight: 400;
  font-size: 11px;
  opacity: 0.75;
}

.staff-reply__hint {
  flex: 1 1 100%;
  font-size: 11px;
  color: var(--chat-text-tips);
  line-height: 1.4;
}

@media screen and (max-width: 768px) {
  .staff-reply__hint {
    flex-basis: 100%;
  }
}
</style>
