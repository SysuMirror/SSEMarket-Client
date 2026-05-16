<script lang="ts" setup>
const { noSave = false } = defineProps<{
  noSave?: boolean
  isSaved?: boolean
  isSelf: boolean
}>()
const emits = defineEmits(['userAction'])
function handleSave() {
  emits('userAction', 'save')
}
function handleDelete() {
  emits('userAction', 'delete')
}
</script>

<template>
  <div class="user-buttons">
    <button
      v-if="!noSave"
      type="button"
      class="user-buttons__save"
      :class="{ 'user-buttons__save--saved': isSaved }"
      :aria-label="isSaved ? '取消收藏' : '收藏'"
      :aria-pressed="!!isSaved"
      @click.stop.prevent="handleSave"
    >
      <svg
        v-if="isSaved"
        class="user-buttons__save-icon"
        viewBox="0 0 16 16"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          d="M2 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v13.5a.5.5 0 0 1-.777.416L8 13.036l-5.223 2.88A.5.5 0 0 1 2 15.5V2z"
        />
      </svg>
      <svg
        v-else
        class="user-buttons__save-icon"
        viewBox="0 0 16 16"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          d="M2 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v13.5a.5.5 0 0 1-.777.416L8 13.036l-5.223 2.88A.5.5 0 0 1 2 15.5V2zm2-1a1 1 0 0 0-1 1v12.566l4.723-2.482a.5.5 0 0 1 .554 0L13 14.566V2a1 1 0 0 0-1-1H4z"
        />
      </svg>
      <span class="user-buttons__save-label">{{ isSaved ? '已收藏' : '收藏' }}</span>
    </button>

    <button
      v-if="isSelf"
      type="button"
      class="user-buttons__delete"
      aria-label="删除"
      @click.stop.prevent="handleDelete"
    >
      删除
    </button>
  </div>
</template>

<style lang="scss" scoped>
.user-buttons {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 8px;
}

.user-buttons__save {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-height: 34px;
  padding: 5px 12px 5px 10px;
  border-radius: 8px;
  border: 1px solid var(--chat-border);
  background: var(--chat-bg-highlight);
  color: var(--chat-accent);
  font-size: 12px;
  font-weight: 600;
  font-family: inherit;
  letter-spacing: 0;
  text-transform: none;
  cursor: pointer;
  transition:
    background 0.2s ease,
    border-color 0.2s ease,
    color 0.2s ease,
    box-shadow 0.2s ease;

  &:hover {
    border-color: var(--chat-accent);
    background: var(--chat-accent-soft);
  }

  &--saved {
    border-color: var(--chat-accent);
    background: var(--chat-accent);
    color: #fff;

    &:hover {
      opacity: 0.92;
      background: var(--chat-accent);
      border-color: var(--chat-accent);
      color: #fff;
    }
  }
}

.user-buttons__save-icon {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
}

.user-buttons__save-label {
  line-height: 1;
  white-space: nowrap;
}

@media screen and (max-width: 420px) {
  .user-buttons__save-label {
    display: none;
  }

  .user-buttons__save {
    width: 34px;
    min-width: 34px;
    padding: 5px;
  }
}
</style>
