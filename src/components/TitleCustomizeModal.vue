<script setup lang="ts">
import type { Ref } from 'vue'
import { computed, inject, onBeforeUnmount, onMounted, ref } from 'vue'
import { setCustomTitle } from '@/api/info/updateInfo'
import { showMsg } from './MessageBox'

const emit = defineEmits<{ saved: [title: string] }>()

const MAX_LEN = 12
const title = ref('')
const submitting = ref(false)
const isPC = inject('isPC', ref(false)) as Ref<boolean>

const trimmed = computed(() => title.value.trim())
const len = computed(() => [...trimmed.value].length)

// 强制弹窗:拦截 Esc 等按键冒泡,仅提供「确定称号」一个出口
function onKeydown(e: KeyboardEvent) {
  e.stopPropagation()
}

async function submit() {
  if (submitting.value)
    return
  const t = trimmed.value
  if (!t || [...t].length > MAX_LEN) {
    showMsg(`称号需为 1~${MAX_LEN} 个字符`)
    return
  }
  submitting.value = true
  try {
    const res = await setCustomTitle(t)
    if (res?.code === 200) {
      emit('saved', t)
    }
    else {
      showMsg(res?.msg || '保存失败，请重试')
    }
  }
  catch {
    showMsg('保存失败，请重试')
  }
  finally {
    submitting.value = false
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown, true))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown, true))
</script>

<template>
  <Teleport to="body">
    <div class="title-modal-mask">
      <div class="title-modal-box" role="dialog" aria-modal="true" aria-label="自定义称号">
        <div class="title-modal-glow" aria-hidden="true" />
        <div class="title-modal-medal" aria-hidden="true">
          <span>Lv8</span>
        </div>
        <h2 class="title-modal-head">
          恭喜达成最高等级
        </h2>
        <p class="title-modal-meta">
          集市感谢你留下的每一条足迹。<br>
          取一个专属称号，让它代替用户名展示给所有人。
        </p>
        <div class="title-modal-field">
          <input
            v-model="title"
            class="title-modal-input"
            type="text"
            maxlength="12"
            placeholder="你的专属称号"
            autocomplete="off"
            :autofocus="isPC"
            @keydown.enter="submit"
          >
          <span class="title-modal-count" :class="{ 'title-modal-count--full': len >= MAX_LEN }">{{ len }}<i>/</i>{{ MAX_LEN }}</span>
        </div>
        <button
          type="button"
          class="title-modal-btn"
          :disabled="submitting || len === 0"
          @click="submit"
        >
          {{ submitting ? '保存中…' : '确定称号' }}
        </button>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.title-modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(10, 16, 30, 0.55);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  animation: title-mask-in 0.28s ease both;
}

@keyframes title-mask-in {
  from {
    opacity: 0;
  }
}

.title-modal-box {
  position: relative;
  width: 100%;
  max-width: 400px;
  box-sizing: border-box;
  padding: 34px 30px 28px;
  text-align: center;
  border-radius: 20px;
  border: 1px solid transparent;
  background:
    linear-gradient(var(--color-card, #fff), var(--color-card, #fff)) padding-box,
    linear-gradient(135deg, #ff7d7d, #ff5a99, #e376e5, #9a7ef8, #ff7d7d) border-box;
  background-clip: padding-box, border-box;
  box-shadow:
    0 24px 64px rgba(10, 16, 30, 0.35),
    0 4px 16px rgba(154, 126, 248, 0.16);
  animation: title-box-in 0.34s cubic-bezier(0.2, 0.9, 0.3, 1.2) both;
  overflow: hidden;
}

@keyframes title-box-in {
  from {
    opacity: 0;
    transform: scale(0.92) translateY(14px);
  }
}

/* 顶部弥散光,营造"荣耀时刻"氛围 */
.title-modal-glow {
  position: absolute;
  top: -70px;
  left: 50%;
  width: 340px;
  height: 180px;
  transform: translateX(-50%);
  background: radial-gradient(
    ellipse at center,
    rgba(255, 122, 178, 0.22),
    rgba(154, 126, 248, 0.14) 45%,
    transparent 72%
  );
  pointer-events: none;
}

.title-modal-medal {
  position: relative;
  width: 68px;
  height: 68px;
  margin: 0 auto 14px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: linear-gradient(135deg, #ff7d7d, #ff5a99, #e376e5, #9a7ef8);
  background-size: 300% 300%;
  animation:
    medal-float 3.2s ease-in-out infinite,
    change-color 6s ease infinite;
  box-shadow:
    0 10px 26px rgba(255, 90, 153, 0.42),
    0 0 0 7px rgba(255, 122, 178, 0.14);
}

.title-modal-medal span {
  color: #fff;
  font-size: 17px;
  font-weight: 800;
  letter-spacing: 0.5px;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.18);
}

@keyframes medal-float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-5px);
  }
}

@keyframes change-color {
  0% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
}

.title-modal-head {
  position: relative;
  font-size: 21px;
  font-weight: 800;
  margin: 0 0 10px;
  color: var(--chat-text, #1e293b);
  letter-spacing: 0.5px;
}

.title-modal-meta {
  position: relative;
  font-size: 13px;
  line-height: 1.8;
  color: var(--chat-text-tips, #94a3b8);
  margin: 0 0 22px;
}

.title-modal-field {
  position: relative;
  margin-bottom: 24px;
}

.title-modal-input {
  width: 100%;
  box-sizing: border-box;
  border: none;
  outline: none;
  padding: 8px 4px 12px;
  font-size: 20px;
  font-weight: 700;
  text-align: center;
  color: var(--chat-text, #1e293b);
  background: linear-gradient(90deg, #ff7d7d, #ff5a99, #e376e5, #9a7ef8) bottom / 100% 2px no-repeat;
  border-radius: 0;
  caret-color: #ff5a99;
  transition: filter 0.2s ease;
}

.title-modal-input::placeholder {
  color: var(--chat-text-tips, #94a3b8);
  opacity: 0.55;
  font-weight: 500;
}

.title-modal-input:focus {
  filter: drop-shadow(0 1px 6px rgba(255, 90, 153, 0.35));
}

.title-modal-count {
  position: absolute;
  right: 2px;
  bottom: -18px;
  font-size: 11px;
  color: var(--chat-text-tips, #94a3b8);
}

.title-modal-count i {
  font-style: normal;
  opacity: 0.5;
  margin: 0 1px;
}

.title-modal-count--full {
  color: #ff5a99;
}

.title-modal-btn {
  width: 100%;
  padding: 12px 0;
  border: 0;
  border-radius: 12px;
  background: linear-gradient(45deg, #ff7d7d, #ff5a99, #e376e5, #9a7ef8);
  background-size: 300% 300%;
  animation: change-color 6s ease infinite;
  color: #fff;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 2px;
  cursor: pointer;
  box-shadow: 0 6px 18px rgba(255, 90, 153, 0.35);
  transition:
    transform 0.15s ease,
    box-shadow 0.15s ease,
    opacity 0.15s ease;
}

.title-modal-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 10px 24px rgba(255, 90, 153, 0.45);
}

.title-modal-btn:active:not(:disabled) {
  transform: translateY(0);
}

.title-modal-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  box-shadow: none;
}

@media (max-width: 480px) {
  .title-modal-box {
    padding: 28px 22px 22px;
    border-radius: 16px;
  }

  .title-modal-head {
    font-size: 19px;
  }

  .title-modal-meta br {
    display: none;
  }
}
</style>
