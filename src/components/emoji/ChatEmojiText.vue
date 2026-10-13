<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { emojiSrc, getCachedEmoji, resolveEmojiIDs } from '@/composables/useEmoji'
import { collectEmojiIDs, parseEmojiSegments } from '@/utils/emojiToken'

/**
 * 聊天气泡正文渲染器：文本照旧，[emoji:<id>] token 渲染成表情图片。
 * 长按（触摸或鼠标按住 ≥550ms）一张表情 → emit addEmoji，由外层加进表情包。
 */

const props = defineProps<{
  content: string
}>()

const emit = defineEmits<{
  (e: 'addEmoji', emojiID: number): void
}>()

const segments = computed(() => parseEmojiSegments(props.content))

const pressTimers = new Map<number, ReturnType<typeof setTimeout>>()
const justAdded = ref(0)

function cancelPress(emojiID: number) {
  const timer = pressTimers.get(emojiID)
  if (timer)
    clearTimeout(timer)
  pressTimers.delete(emojiID)
}

function startPress(emojiID: number) {
  cancelPress(emojiID)
  pressTimers.set(emojiID, setTimeout(() => {
    pressTimers.delete(emojiID)
    justAdded.value = emojiID
    emit('addEmoji', emojiID)
  }, 550))
}

watch(
  () => props.content,
  (content) => {
    const ids = collectEmojiIDs(content)
    if (ids.length > 0)
      void resolveEmojiIDs(ids)
  },
  { immediate: true },
)

onUnmounted(() => {
  for (const timer of pressTimers.values())
    clearTimeout(timer)
  pressTimers.clear()
})
</script>

<template>
  <span class="chat-emoji-text">
    <template v-for="(segment, i) in segments" :key="i">
      <img
        v-if="segment.type === 'emoji' && getCachedEmoji(segment.emojiID!)"
        class="chat-emoji-text__img"
        :class="{ 'chat-emoji-text__img--added': justAdded === segment.emojiID }"
        :src="emojiSrc(getCachedEmoji(segment.emojiID!)!)"
        :alt="getCachedEmoji(segment.emojiID!)!.name"
        :title="`${getCachedEmoji(segment.emojiID!)!.name}（长按加入我的表情）`"
        draggable="false"
        loading="lazy"
        @pointerdown="startPress(segment.emojiID!)"
        @pointerup="cancelPress(segment.emojiID!)"
        @pointerleave="cancelPress(segment.emojiID!)"
        @pointercancel="cancelPress(segment.emojiID!)"
        @contextmenu.prevent
      >
      <span v-else-if="segment.type === 'emoji'" class="chat-emoji-text__fallback">[表情]</span>
      <template v-else>{{ segment.text }}</template>
    </template>
  </span>
</template>

<style scoped>
.chat-emoji-text {
  display: inline;
}

.chat-emoji-text__img {
  display: inline-block;
  max-width: 120px;
  max-height: 120px;
  vertical-align: middle;
  border-radius: 6px;
  cursor: pointer;
  touch-action: manipulation;
  -webkit-user-select: none;
  user-select: none;
  transition: transform 0.15s ease;
}

.chat-emoji-text__img--added {
  animation: chat-emoji-added 0.6s ease;
}

.chat-emoji-text__fallback {
  opacity: 0.6;
}

@keyframes chat-emoji-added {
  0% {
    transform: scale(1);
  }

  40% {
    transform: scale(1.15);
  }

  100% {
    transform: scale(1);
  }
}
</style>
