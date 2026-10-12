<script setup lang="ts">
defineProps<{
  avatarSrc: string
  name: string
  uid: number
  phone: string
  levelLabel: string
  levelClass: string
  expPercent: number
  score: number
  expTarget: number
  nextLevelLabel: string
  /** 站内币余额；undefined = 后端没给（不显示） */
  coins?: number
}>()
defineEmits<{
  uploadAvatar: [event: Event]
  editProfile: []
  avatarError: []
}>()
</script>

<template>
  <section class="settings-hero">
    <div class="settings-hero__card">
      <div class="settings-hero__main">
        <label class="settings-hero__avatar-wrap" title="点击更换头像">
          <img
            class="settings-hero__avatar"
            :src="avatarSrc"
            alt="头像"
            loading="lazy"
            @error="$emit('avatarError')"
          >
          <span class="settings-hero__avatar-badge" aria-hidden="true">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
              <path d="M9 4h6l1 2h3v14H5V6h3l1-2z" stroke="currentColor" stroke-width="2" stroke-linejoin="round" />
              <circle cx="12" cy="13" r="3" stroke="currentColor" stroke-width="2" />
            </svg>
          </span>
          <input
            type="file"
            accept="image/*"
            class="settings-hero__file-input"
            @change="$emit('uploadAvatar', $event)"
          >
        </label>
        <div class="settings-hero__info">
          <p class="settings-hero__name">
            {{ name || '未设置昵称' }}
          </p>
          <p class="settings-hero__meta">
            UID {{ uid || '—' }} · {{ phone || '—' }}
          </p>
          <div class="settings-hero__level-row">
            <span class="settings-hero__level-badge" :class="levelClass">{{ levelLabel }}</span>
            <span class="settings-hero__exp-text">{{ score }} / {{ expTarget }} 经验</span>
            <span v-if="coins !== undefined" class="settings-hero__coins">{{ coins }} 币</span>
            <span class="settings-hero__next-level">{{ nextLevelLabel }}</span>
          </div>
          <div
            class="settings-hero__progress"
            role="progressbar"
            :aria-valuenow="expPercent"
            aria-valuemin="0"
            aria-valuemax="100"
          >
            <div class="settings-hero__progress-fill" :style="{ width: `${expPercent}%` }" />
          </div>
        </div>
      </div>
      <button type="button" class="settings-hero__edit-btn" @click="$emit('editProfile')">
        编辑资料
      </button>
    </div>
  </section>
</template>

<style scoped lang="scss">
.settings-hero {
  position: relative;

  &__card {
    position: relative;
    padding: 16px;
    background: var(--color-card);
    border-radius: var(--radius-lg);
    box-shadow: var(--color-card-shadow);
  }

  &__main {
    display: flex;
    gap: 14px;
    align-items: flex-start;
  }

  &__avatar-wrap {
    position: relative;
    flex-shrink: 0;
    width: 60px;
    height: 60px;
    border-radius: 0;
    overflow: hidden;
    cursor: pointer;
    border: 2px solid var(--color-card);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  &__avatar {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    background: var(--accent);
  }

  &__avatar-badge {
    position: absolute;
    bottom: -2px;
    right: -2px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--color-card);
    border: 1px solid var(--color-border);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-text-secondary);
  }

  &__file-input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    cursor: pointer;
    font-size: 0;
  }

  &__info {
    flex: 1;
    min-width: 0;
  }

  &__name {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--color-text);
    word-break: break-word;
  }

  &__meta {
    margin: 4px 0 0;
    font-size: 12px;
    color: var(--color-text-muted);
  }

  &__level-row {
    margin-top: 8px;
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }

  &__level-badge {
    display: inline-flex;
    align-items: center;
    padding: 2px 8px;
    border-radius: var(--radius-full);
    font-size: 11px;
    font-weight: 500;
    background: var(--accent-soft);
    color: var(--accent);
  }

  &__exp-text {
    font-size: 11px;
    color: var(--color-text-muted);
    font-variant-numeric: tabular-nums;
  }

  &__next-level {
    font-size: 11px;
    color: var(--color-text-muted);
  }

  &__coins {
    display: inline-flex;
    align-items: center;
    padding: 2px 8px;
    border-radius: var(--radius-full);
    font-size: 11px;
    font-weight: 600;
    color: #b45309;
    background: rgba(180, 83, 9, 0.1);
    font-variant-numeric: tabular-nums;
  }

  &__progress {
    margin-top: 6px;
    height: 4px;
    background: var(--color-button-bg-secondary);
    border-radius: var(--radius-full);
    overflow: hidden;
  }

  &__progress-fill {
    height: 100%;
    background: var(--accent);
    border-radius: var(--radius-full);
    transition: width 0.35s ease;
  }

  &__edit-btn {
    margin-top: 14px;
    width: 100%;
    padding: 9px 12px;
    background: var(--color-button-bg-secondary);
    border: none;
    border-radius: var(--radius-md);
    font-size: 13px;
    font-weight: 500;
    color: var(--color-text);
    cursor: pointer;
    transition: background 0.15s ease;

    &:hover {
      background: var(--color-hover);
    }
  }
}
</style>
