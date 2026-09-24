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
  if (err)
    showMsg(err)
  else
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
        rows="4"
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
  background: rgba(0, 0, 0, 0.45);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}
.dpref-box {
  background: #fff;
  border-radius: 12px;
  max-width: 420px;
  width: 100%;
  padding: 16px;
  box-sizing: border-box;
}
.dpref-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 8px;
}
.dpref-x {
  background: none;
  border: 0;
  font-size: 14px;
  cursor: pointer;
  color: #8b93a5;
}
.dpref-meta {
  color: #8b93a5;
  font-size: 12px;
  margin: 0 0 12px;
}
.dpref-opt {
  display: block;
  margin: 8px 0;
  cursor: pointer;
  font-size: 14px;
}
textarea {
  width: 100%;
  box-sizing: border-box;
  margin-top: 4px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 10px;
  font-size: 14px;
  resize: vertical;
}
.dpref-counter {
  text-align: right;
  color: #8b93a5;
  font-size: 12px;
  margin: 4px 0 12px;
}
.dpref-save {
  background: #2d6cdf;
  color: #fff;
  border: 0;
  border-radius: 8px;
  padding: 10px 24px;
  font-size: 14px;
  cursor: pointer;
}
.dpref-save:disabled {
  opacity: 0.5;
}
.dpref-hint {
  color: #8b93a5;
  font-size: 12px;
  margin: 12px 0 0;
}
</style>
