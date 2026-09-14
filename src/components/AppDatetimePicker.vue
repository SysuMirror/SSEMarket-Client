<script setup lang="ts">
import { zhCN } from 'date-fns/locale'
import { VueDatePicker } from '@vuepic/vue-datepicker'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import '@vuepic/vue-datepicker/dist/main.css'

/**
 * 全站统一的日期时间选择器（开奖时间 / 搜索时间范围等）。
 * 基于成熟库 @vuepic/vue-datepicker：混合输入（可手输可弹层日历）、明暗主题随站点。
 * 对外 modelValue 保持与原生 datetime-local 相同的字符串格式：yyyy-MM-dd'T'HH:mm
 */
const props = defineProps<{
  modelValue: string
  placeholder?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

// 暗色模式跟随 body.dark-mode（站点由 ModeButton 切换）
const bodyDark = ref(typeof document !== 'undefined' && document.body.classList.contains('dark-mode'))
const isDark = computed(() => bodyDark.value)
let observer: MutationObserver | null = null

onMounted(() => {
  observer = new MutationObserver(() => {
    bodyDark.value = document.body.classList.contains('dark-mode')
  })
  observer.observe(document.body, { attributes: true, attributeFilter: ['class'] })
})

onBeforeUnmount(() => {
  observer?.disconnect()
})
</script>

<template>
  <VueDatePicker
    :model-value="props.modelValue || null"
    model-type="yyyy-MM-dd'T'HH:mm"
    :dark="isDark"
    :placeholder="props.placeholder || '选择日期时间'"
    :enable-time-picker="true"
    :auto-apply="true"
    :clearable="true"
    :text-input="{ enterSubmit: true, tabSubmit: true, openMenu: 'open', format: 'yyyy-MM-dd HH:mm' }"
    format="yyyy-MM-dd HH:mm"
    :locale="zhCN"
    minutes-increment="5"
    month-name-type="long"
    :teleport="true"
    input-class-name="app-dp-input"
    @update:model-value="(v: string | null) => emit('update:modelValue', v ?? '')"
  />
</template>

<style>
/* 输入框与站内控件统一外观（非 scoped：库的输入框在 teleport 场景下渲染） */
.app-dp-input {
  width: 100%;
  min-height: 36px;
  padding: 6px 10px !important;
  border: 1px solid var(--chat-border) !important;
  border-radius: 8px !important;
  background: var(--chat-bg-main) !important;
  color: var(--chat-text) !important;
  font-size: 0.8125rem;
  font-family: inherit;
  font-variant-numeric: tabular-nums;
  transition:
    border-color 0.15s,
    box-shadow 0.15s;
}

.app-dp-input:focus {
  outline: none !important;
  border-color: var(--chat-accent) !important;
  box-shadow: 0 0 0 2px var(--chat-accent-soft) !important;
}

/* 弹层主题色对齐站点强调色 */
.dp__theme_light {
  --dp-primary-color: var(--chat-accent, #ec4141);
}

.dp__theme_dark {
  --dp-primary-color: var(--chat-accent, #ec4141);
}
</style>
