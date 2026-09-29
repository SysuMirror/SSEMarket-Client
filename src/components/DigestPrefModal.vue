<script lang="ts" setup>
import { ref } from 'vue'
import { saveDigestPref } from '@/api/digestPref'
import type { DigestPrefData } from '@/api/digestPref'
import { showMsg } from '@/components/MessageBox'

const props = defineProps<{ data: DigestPrefData | null }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const saving = ref(false)
const mode = ref<'default' | 'prefer'>(props.data?.mode === 'prefer' ? 'prefer' : 'default')
const text = ref(props.data?.text || '')
const meta = ref({
  updated_at: props.data?.updated_at || '',
  updated_by: props.data?.updated_by || '',
})

async function onSave() {
  if (mode.value === 'prefer' && !text.value.trim()) {
    showMsg('倾向内容不能为空')
    return
  }
  saving.value = true
  const err = await saveDigestPref(mode.value, text.value.trim())
  saving.value = false
  if (err) {
    showMsg(err)
    return
  }
  showMsg('已保存，下一次日报生成（每日 09:15）生效')
  emit('close')
}
</script>

<template>
  <div class="dpref-mask" @click.self="emit('close')">
    <div class="dpref-box">
      <div class="dpref-head">
        <span>调整日报倾向</span>
        <button class="dpref-x" type="button" @click="emit('close')">
          ✕
        </button>
      </div>
      <p v-if="meta.updated_by" class="dpref-meta">
        当前生效：最后由 {{ meta.updated_by }} 于 {{ meta.updated_at }} 修改
      </p>
      <p v-else class="dpref-meta">
        当前生效：默认模式（尚未设置过倾向）
      </p>
      <label class="dpref-opt">
        <input v-model="mode" type="radio" value="default">
        默认模式（按既有标准挑最高价值文章）
      </label>
      <label class="dpref-opt">
        <input v-model="mode" type="radio" value="prefer">
        倾向模式（优先考虑下方倾向内容）
      </label>
      <textarea
        v-model="text"
        :disabled="mode !== 'prefer'"
        maxlength="200"
        rows="5"
        placeholder="例：jev 相关内容优先"
      />
      <div class="dpref-counter">
        {{ text.length }}/200
      </div>
      <button class="dpref-save" type="button" :disabled="saving" @click="onSave">
        {{ saving ? '保存中…' : '保存' }}
      </button>
      <p class="dpref-hint">
        ⓘ 倾向只是加分项：倾向话题当天没有高质量文章时，日报仍会选其他最高价值的一篇。
      </p>
    </div>
  </div>
</template>

<style scoped>
.dpref-mask {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.5);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}
.dpref-box {
  background: var(--color-card, #fff);
  color: var(--chat-text, #1e293b);
  border-radius: 14px;
  max-width: 460px;
  width: 100%;
  padding: 22px 24px;
  box-sizing: border-box;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);
}
.dpref-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 17px;
  font-weight: 600;
  margin-bottom: 10px;
}
.dpref-x {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: 0;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  color: var(--chat-text-tips, #94a3b8);
}
.dpref-x:hover {
  background: var(--chat-accent-soft, rgba(44, 61, 86, 0.08));
}
.dpref-meta {
  color: var(--chat-text-tips, #94a3b8);
  font-size: 12px;
  margin: 0 0 14px;
}
.dpref-opt {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 0 8px;
  padding: 10px 12px;
  border: 1px solid var(--chat-border-strong, rgba(71, 85, 105, 0.18));
  border-radius: 10px;
  cursor: pointer;
  font-size: 14px;
  transition:
    background 0.15s ease,
    border-color 0.15s ease;
}
.dpref-opt:hover {
  background: var(--chat-accent-soft, rgba(44, 61, 86, 0.08));
}
.dpref-opt:has(input:checked) {
  border-color: var(--chat-accent);
  background: var(--chat-accent-soft, rgba(44, 61, 86, 0.08));
}
.dpref-opt input {
  accent-color: var(--chat-accent);
  margin: 0;
  flex: 0 0 auto;
}
textarea {
  width: 100%;
  box-sizing: border-box;
  margin-top: 12px;
  border: 1px solid var(--chat-border-strong, rgba(71, 85, 105, 0.18));
  border-radius: 10px;
  padding: 12px;
  font-size: 14px;
  font-family: inherit;
  line-height: 1.6;
  resize: vertical;
  background: transparent;
  color: var(--chat-text, #1e293b);
}
textarea:focus {
  outline: none;
  border-color: var(--chat-accent);
}
textarea:disabled {
  opacity: 0.55;
  background: var(--chat-accent-soft, rgba(44, 61, 86, 0.08));
  cursor: not-allowed;
}
.dpref-counter {
  text-align: right;
  color: var(--chat-text-tips, #94a3b8);
  font-size: 12px;
  margin: 6px 0 16px;
}
.dpref-save {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 38px;
  padding: 8px 30px;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.04em;
  font-family: inherit;
  color: var(--chat-unread-text, #fff);
  background: var(--chat-accent);
  border: 1px solid var(--chat-accent);
  border-radius: 8px;
  box-shadow: 0 2px 6px rgba(44, 61, 86, 0.22);
  cursor: pointer;
  transition:
    filter 0.15s ease,
    box-shadow 0.15s ease;
}
.dpref-save:hover:not(:disabled),
.dpref-save:focus-visible {
  filter: brightness(1.08);
  box-shadow: 0 3px 10px rgba(44, 61, 86, 0.28);
}
.dpref-save:disabled {
  opacity: 0.55;
  cursor: default;
}
body.dark-mode .dpref-save {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
}
body.dark-mode .dpref-save:hover:not(:disabled),
body.dark-mode .dpref-save:focus-visible {
  filter: brightness(1.06);
}
.dpref-hint {
  color: var(--chat-text-tips, #94a3b8);
  font-size: 12px;
  line-height: 1.6;
  margin: 14px 0 0;
  padding-top: 12px;
  border-top: 1px solid var(--chat-border, rgba(71, 85, 105, 0.12));
}
</style>
