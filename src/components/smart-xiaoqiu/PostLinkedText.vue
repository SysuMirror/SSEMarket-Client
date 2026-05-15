<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'

const props = defineProps<{
  text: string
}>()

const router = useRouter()

type Chunk = { type: 'text' | 'link'; value: string }

const parts = computed<Chunk[]>(() => {
  const s = props.text
  const re = /post:\/\/(\d+)/gi
  const chunks: Chunk[] = []
  let last = 0
  for (const m of s.matchAll(re)) {
    if (m.index !== undefined && m.index > last)
      chunks.push({ type: 'text', value: s.slice(last, m.index) })
    chunks.push({ type: 'link', value: m[1] })
    last = (m.index ?? 0) + m[0].length
  }
  if (last < s.length)
    chunks.push({ type: 'text', value: s.slice(last) })
  if (chunks.length === 0)
    chunks.push({ type: 'text', value: s })
  return chunks
})

function openPost(id: string) {
  router.push({ name: 'Postdetail', params: { id } })
}
</script>

<template>
  <span class="linked">
    <template v-for="(c, i) in parts" :key="i">
      <button
        v-if="c.type === 'link'"
        type="button"
        class="post-link"
        @click="openPost(c.value)"
      >
        帖子 #{{ c.value }}
      </button>
      <span v-else>{{ c.value }}</span>
    </template>
  </span>
</template>

<style scoped>
.linked {
  white-space: pre-wrap;
}

.post-link {
  display: inline;
  margin: 0 2px;
  padding: 0 6px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--chat-bg-main);
  color: var(--color-title-selected, #00a4af);
  font: inherit;
  cursor: pointer;
  vertical-align: baseline;
}

.post-link:hover {
  text-decoration: underline;
}
</style>
