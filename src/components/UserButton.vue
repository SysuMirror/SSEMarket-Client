<script lang="ts" setup>
import { Icon } from '@iconify/vue'

const { noSave = false, compact = false, isPrivate = false, showPrivacy = true, canPin = false, isPinned = false } = defineProps<{
  noSave?: boolean
  isSaved?: boolean
  isSelf: boolean
  isPrivate?: boolean
  showPrivacy?: boolean
  /** 评论区等场景：更小按钮 */
  compact?: boolean
  /** 是否显示置顶按钮（仅自己帖+主页分区+有权限） */
  canPin?: boolean
  /** 当前是否已置顶 */
  isPinned?: boolean
}>()
const emits = defineEmits(['userAction'])
function handleSave() {
  emits('userAction', 'save')
}
function handleDelete() {
  emits('userAction', 'delete')
}
function handlePrivacy() {
  emits('userAction', 'privacy')
}
function handlePin() {
  emits('userAction', isPinned ? 'unpin' : 'pin')
}
</script>

<template>
  <div class="user-buttons" :class="{ 'user-buttons--compact': compact }">
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
      v-if="canPin"
      type="button"
      class="user-buttons__pin"
      :class="{ 'user-buttons__pin--active': isPinned }"
      :aria-label="isPinned ? '取消置顶' : '置顶 1 小时'"
      :aria-pressed="!!isPinned"
      @click.stop.prevent="handlePin"
    >
      <Icon
        icon="tabler:pinned-filled"
        width="14"
        height="14"
        class="user-buttons__pin-icon"
        aria-hidden="true"
      />
      <span class="user-buttons__pin-label">{{ isPinned ? '取消置顶' : '置顶' }}</span>
    </button>

    <button
      v-if="isSelf && showPrivacy"
      type="button"
      class="user-buttons__privacy"
      :class="{ 'user-buttons__privacy--private': isPrivate }"
      :aria-label="isPrivate ? '取消仅自己可见' : '设为仅自己可见'"
      :aria-pressed="!!isPrivate"
      @click.stop.prevent="handlePrivacy"
    >
      <svg
        class="user-buttons__privacy-icon"
        viewBox="0 0 16 16"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          v-if="isPrivate"
          d="M4 7V5a4 4 0 0 1 8 0v2h.5A1.5 1.5 0 0 1 14 8.5v5A1.5 1.5 0 0 1 12.5 15h-9A1.5 1.5 0 0 1 2 13.5v-5A1.5 1.5 0 0 1 3.5 7H4zm1 0h6V5a3 3 0 0 0-6 0v2z"
        />
        <path
          v-else
          d="M11 7V5a3 3 0 0 0-5.83-1 .5.5 0 0 1-.94-.34A4 4 0 0 1 12 5v2h.5A1.5 1.5 0 0 1 14 8.5v5A1.5 1.5 0 0 1 12.5 15h-9A1.5 1.5 0 0 1 2 13.5v-5A1.5 1.5 0 0 1 3.5 7H11z"
        />
      </svg>
      <span class="user-buttons__privacy-label">{{ isPrivate ? '仅自己可见' : '设为私密' }}</span>
    </button>

    <button
      v-if="isSelf"
      type="button"
      class="user-buttons__delete"
      aria-label="删除"
      @click.stop.prevent="handleDelete"
    >
      <span class="user-buttons__delete-label">删除</span>
    </button>
  </div>
</template>

<style lang="scss" scoped>
.user-buttons {
  display: flex;
  flex-shrink: 0;
  flex-wrap: nowrap;
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

.user-buttons__delete {
  flex-shrink: 0;
  white-space: nowrap;
}

.user-buttons__delete-label {
  line-height: 1;
  white-space: nowrap;
}

.user-buttons__pin {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 34px;
  padding: 5px 12px;
  border-radius: 8px;
  border: 1px solid var(--chat-border);
  background: var(--chat-bg-highlight);
  color: var(--chat-text-secondary);
  font-size: 12px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition:
    background 0.2s ease,
    border-color 0.2s ease,
    color 0.2s ease;

  &:hover {
    border-color: var(--chat-accent);
    color: var(--chat-accent);
  }

  &--active {
    border-color: var(--chat-accent);
    background: var(--chat-accent-soft);
    color: var(--chat-accent);
  }
}

.user-buttons__pin-icon {
  flex-shrink: 0;
}

.user-buttons__pin-label {
  line-height: 1;
  white-space: nowrap;
}

.user-buttons__privacy {
  flex-shrink: 0;
  white-space: nowrap;
  min-height: 34px;
  padding: 5px 12px;
  border-radius: 8px;
  border: 1px solid var(--chat-border);
  background: var(--chat-bg-highlight);
  color: var(--chat-text-secondary);
  font-size: 12px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition:
    background 0.2s ease,
    border-color 0.2s ease,
    color 0.2s ease;

  &:hover {
    border-color: var(--chat-accent);
    color: var(--chat-accent);
  }

  &--private {
    border-color: var(--chat-accent);
    background: var(--chat-accent-soft);
    color: var(--chat-accent);
  }
}

.user-buttons__privacy-label {
  line-height: 1;
  white-space: nowrap;
}

.user-buttons__privacy-icon {
  display: none;
  flex-shrink: 0;
  width: 16px;
  height: 16px;
}

.user-buttons--compact {
  gap: 5px;

  .user-buttons__save {
    min-height: 28px;
    padding: 2px 8px;
    font-size: 11px;
    border-radius: 6px;
  }

  .user-buttons__save-icon {
    width: 14px;
    height: 14px;
  }

  .user-buttons__privacy-icon {
    width: 14px;
    height: 14px;
  }

  .user-buttons__delete,
  .user-buttons__privacy,
  .user-buttons__pin {
    min-width: auto;
    min-height: 28px;
    padding: 2px 8px !important;
    font-size: 11px !important;
    border-radius: 6px !important;
  }
}

@media screen and (max-width: 420px) {
  .user-buttons__save-label {
    display: none;
  }

  .user-buttons__privacy-label {
    display: none;
  }

  .user-buttons__pin-label {
    display: none;
  }

  .user-buttons__privacy-icon {
    display: block;
  }

  .user-buttons__privacy {
    width: 34px;
    min-width: 34px;
    padding: 5px !important;
    justify-content: center;
  }

  .user-buttons__save {
    width: 34px;
    min-width: 34px;
    padding: 5px;
  }

  .user-buttons--compact .user-buttons__save {
    width: 26px;
    min-width: 26px;
    padding: 3px;
  }

  .user-buttons__pin {
    width: 34px;
    min-width: 34px;
    padding: 5px !important;
    justify-content: center;
  }
}
</style>
