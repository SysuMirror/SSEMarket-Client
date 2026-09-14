<script setup lang="ts">
import type { AssistPostData } from '@/api/assist'
import { Icon } from '@iconify/vue'
import { computed, nextTick, ref, watch } from 'vue'
import { fetchAssistFollowup } from '@/api/assist'
import MarkdownContainer from '@/components/MarkdownContainer.vue'

const props = defineProps<{
  data: AssistPostData
  postId: number
}>()

// ---- 整卡折叠:默认仅展示头部 + 3 行摘要,展开后显示全文/引用/追问/反馈 ----
const expanded = ref(false)
const overflows = ref(false)
const bodyRef = ref<HTMLElement | null>(null)

function measure() {
  overflows.value = false
  nextTick(() => {
    requestAnimationFrame(() => {
      const el = bodyRef.value
      if (el)
        overflows.value = el.scrollHeight > el.clientHeight + 4
    })
  })
}

watch(() => props.data.answer, measure, { immediate: true })

// ---- 追加上下文 ----
const showFollowUp = ref(false)
const followUpQuestion = ref('')
const followUpLoading = ref(false)
const followUps = ref<Array<{ question: string, answer: string }>>([])
const followUpError = ref('')

// ---- 反馈:点赞/点踩已移除,如需恢复参考 git 历史 ----

// ---- 去重:LLM 回答已自带"相关帖子"清单时不重复渲染引用列表 ----
const answerHasRefList = computed(() => /相关帖子/.test(props.data.answer))

// ---- 来源标签 ----
const sourceLabel: Record<string, { icon: string, text: string }> = {
  local: { icon: 'tabler:database', text: '站内讨论' },
  web: { icon: 'tabler:world', text: '站外搜索' },
  mixed: { icon: 'tabler:layers-intersect', text: '综合来源' },
}
const srcInfo = sourceLabel[props.data.sources_type] || sourceLabel.local

async function handleFollowUp() {
  const q = followUpQuestion.value.trim()
  if (!q || followUpLoading.value)
    return
  followUpLoading.value = true
  followUpError.value = ''

  const history = followUps.value.flatMap(fu => [
    { role: 'user' as const, content: fu.question },
    { role: 'assistant' as const, content: fu.answer },
  ])

  const answer = await fetchAssistFollowup(props.postId, q, history)
  if (answer) {
    followUps.value.push({ question: q, answer })
    followUpQuestion.value = ''
  }
  else {
    followUpError.value = '追问失败，请稍后再试'
  }
  followUpLoading.value = false
}

</script>

<template>
  <section class="ai-card" aria-label="AI 智能应答">
    <header class="ai-card__head">
      <span class="ai-card__badge">
        <Icon icon="tabler:sparkles" width="15" height="15" aria-hidden="true" />
        AI 分析
      </span>
      <span class="ai-card__source">
        <Icon :icon="srcInfo.icon" width="12" height="12" aria-hidden="true" />
        {{ srcInfo.text }}
      </span>
    </header>

    <div ref="bodyRef" class="ai-card__body" :class="{ 'ai-card__body--clamped': !expanded }">
      <MarkdownContainer
        :markdown-content="data.answer"
        variant="chat"
        open-links-in-new-tab
      />
      <div v-if="!expanded" class="ai-card__fade" aria-hidden="true" />
    </div>

    <!-- 展开态:引用来源 -->
    <ul v-if="expanded && data.references.length > 0 && !answerHasRefList" class="ai-card__refs">
      <li v-for="(ref, i) in data.references" :key="ref.postID" class="ai-card__ref">
        <a
          :href="ref.url"
          target="_blank"
          rel="noopener noreferrer"
          class="ai-card__ref-link"
        >
          <span class="ai-card__ref-index">[{{ i + 1 }}]</span>
          <span class="ai-card__ref-title">{{ ref.title }}</span>
        </a>
      </li>
    </ul>

    <!-- 展开态:追问 -->
    <div v-if="expanded" class="ai-card__followups">
      <div v-for="(fu, i) in followUps" :key="i" class="ai-card__fu">
        <div class="ai-card__fu-q">
          <Icon icon="tabler:user" width="14" height="14" aria-hidden="true" />
          <span>{{ fu.question }}</span>
        </div>
        <div class="ai-card__fu-a">
          <Icon icon="tabler:sparkles" width="14" height="14" aria-hidden="true" />
          <MarkdownContainer :markdown-content="fu.answer" variant="chat" open-links-in-new-tab />
        </div>
      </div>

      <div v-if="showFollowUp" class="ai-card__compose">
        <textarea
          v-model="followUpQuestion"
          class="ai-card__input"
          placeholder="输入你的追问…"
          rows="2"
          @keydown.ctrl.enter="handleFollowUp"
        />
        <div class="ai-card__compose-actions">
          <span v-if="followUpError" class="ai-card__error">{{ followUpError }}</span>
          <button
            type="button"
            class="ai-card__send"
            :disabled="followUpLoading || !followUpQuestion.trim()"
            @click="handleFollowUp"
          >
            {{ followUpLoading ? '思考中…' : '发送' }}
          </button>
        </div>
      </div>

      <button
        v-if="!showFollowUp"
        type="button"
        class="ai-card__ghost-btn"
        @click="showFollowUp = true"
      >
        <Icon icon="tabler:message-circle" width="14" height="14" aria-hidden="true" />
        追问 AI
      </button>
    </div>

    <footer class="ai-card__foot">
      <!-- 点赞/点踩已移除(2026-09-08, 秋),恢复时参考 git 历史中的 handleFeedback/ai-card__fb -->
      <span class="ai-card__disclaimer">内容由 AI 生成，仅供参考</span>

      <button
        v-if="expanded || overflows"
        type="button"
        class="ai-card__toggle"
        @click="expanded = !expanded"
      >
        {{ expanded ? '收起' : '展开全部' }}
        <Icon :icon="expanded ? 'tabler:chevron-up' : 'tabler:chevron-down'" width="14" height="14" aria-hidden="true" />
      </button>
    </footer>
  </section>
</template>

<style scoped lang="scss">
.ai-card {
  margin: 12px 0 16px;
  overflow: hidden;
  font-size: 14px;
  color: var(--color-text);
  background: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md, 10px);
  box-shadow: var(--color-card-shadow, 0 1px 3px rgba(0, 0, 0, 0.04));
}

.ai-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px 8px;
}

.ai-card__badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 13px;
  font-weight: 600;
  color: var(--accent);
}

.ai-card__source {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 500;
  color: var(--color-text-secondary);
  background: var(--accent-soft, rgba(44, 61, 86, 0.06));
  border-radius: 999px;
}

/* 正文:markdown 渲染,与站内排版一致 */
.ai-card__body {
  position: relative;
  padding: 0 14px;
  font-size: 14px;
  line-height: 1.65;

  :deep(.markdown-body) {
    background: transparent;
    padding: 0;
    margin: 0;
    font-size: 14px;
    color: var(--color-text);

    p { margin-bottom: 0.5em; }
    p:last-child { margin-bottom: 0; }
    code { font-size: 13px; }
    pre { background: var(--color-bg); }
  }
}

.ai-card__body--clamped {
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}

.ai-card__fade {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 28px;
  pointer-events: none;
  background: linear-gradient(transparent, var(--color-card));
}

/* 引用 */
.ai-card__refs {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 14px 0;
  margin: 6px 0 0;
  list-style: none;
  border-top: 1px dashed var(--color-border);
}

.ai-card__ref-link {
  display: inline-flex;
  gap: 5px;
  min-width: 0;
  font-size: 13px;
  color: var(--color-link, var(--accent));
  text-decoration: none;

  &:hover { text-decoration: underline; text-underline-offset: 2px; }
}

.ai-card__ref-index { flex-shrink: 0; color: var(--color-text-muted); }
.ai-card__ref-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 追问 */
.ai-card__followups {
  padding: 8px 14px 0;
}

.ai-card__fu {
  padding: 6px 10px;
  margin-bottom: 8px;
  background: var(--color-bg);
  border-radius: var(--radius-sm, 6px);
}

.ai-card__fu-q,
.ai-card__fu-a {
  display: flex;
  gap: 6px;
  align-items: flex-start;
  font-size: 13px;
  line-height: 1.55;
}

.ai-card__fu-q {
  margin-bottom: 3px;
  font-weight: 500;

  :deep(svg) { flex-shrink: 0; margin-top: 3px; color: var(--color-text-muted); }
}

.ai-card__fu-a {
  color: var(--color-text-secondary);

  :deep(svg) { flex-shrink: 0; margin-top: 3px; color: var(--accent); }
}

.ai-card__compose { margin-top: 8px; }

.ai-card__input {
  box-sizing: border-box;
  width: 100%;
  min-height: 52px;
  padding: 8px 10px;
  font-family: inherit;
  font-size: 13px;
  line-height: 1.5;
  color: var(--color-text);
  resize: vertical;
  background: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm, 6px);

  &:focus {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 2px var(--accent-soft, rgba(44, 61, 86, 0.1));
  }
}

.ai-card__compose-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-top: 6px;
}

.ai-card__error {
  font-size: 12px;
  color: #dc2626;
}

.ai-card__send {
  padding: 5px 16px;
  margin-left: auto;
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  color: #fff;
  cursor: pointer;
  background: var(--accent);
  border: none;
  border-radius: 999px;

  &:hover:not(:disabled) { opacity: 0.9; }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
}

.ai-card__ghost-btn {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  padding: 5px 12px;
  margin-top: 2px;
  font-family: inherit;
  font-size: 13px;
  color: var(--accent);
  cursor: pointer;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 999px;

  &:hover { background: var(--accent-soft, rgba(44, 61, 86, 0.06)); }
}

/* 底栏 */
.ai-card__foot {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
  padding: 8px 14px 10px;
  margin-top: 6px;
}

/* 反馈按钮样式已随点赞/点踩移除(2026-09-08, 秋) */

.ai-card__disclaimer {
  font-size: 11px;
  color: var(--color-text-muted);
}

.ai-card__toggle {
  display: inline-flex;
  gap: 2px;
  align-items: center;
  padding: 4px 12px;
  font-family: inherit;
  font-size: 12px;
  font-weight: 500;
  color: var(--accent);
  cursor: pointer;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 999px;

  &:hover { background: var(--accent-soft, rgba(44, 61, 86, 0.06)); }
}
</style>
