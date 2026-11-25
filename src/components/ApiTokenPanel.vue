<script setup lang="ts">
import type { APITokenItem, APITokenScope } from '@/api/info/apiToken'
import { Icon } from '@iconify/vue'
import { computed, onMounted, ref } from 'vue'
import {
  createAPIToken,
  deleteAPIToken,
  listAPITokens,
  listAPITokenScopes,
  revokeAPIToken,
} from '@/api/info/apiToken'
import { confirmDialog } from '@/components/ConfirmDialog'
import { showMsg } from '@/components/MessageBox'

const scopes = ref<APITokenScope[]>([])
const tokens = ref<APITokenItem[]>([])
const loading = ref(false)
const submitting = ref(false)

// 创建表单
const newName = ref('')
const newScopes = ref<string[]>([])
const justCreatedToken = ref<string | null>(null) // 明文 token 仅展示一次
const justCreatedName = ref<string>('')

// 是否展示明文 token 的弹层
const showCreatedModal = ref(false)

// 是否展示帮助说明弹层
const showHelpModal = ref(false)

const hasNewName = computed(() => newName.value.trim().length > 0)
const hasNewScope = computed(() => newScopes.value.length > 0)
const canSubmit = computed(() => hasNewName.value && hasNewScope.value && !submitting.value)

async function loadScopes() {
  const list = await listAPITokenScopes()
  scopes.value = list || []
}

async function loadTokens() {
  loading.value = true
  try {
    const page = await listAPITokens(1, 50)
    if (page)
      tokens.value = page.records || []
  }
  catch (e: any) {
    showMsg(e?.message || '加载 token 列表失败')
  }
  finally {
    loading.value = false
  }
}

async function reloadAll() {
  await Promise.all([loadScopes(), loadTokens()])
}

function toggleScope(name: string) {
  const idx = newScopes.value.indexOf(name)
  if (idx >= 0)
    newScopes.value.splice(idx, 1)
  else
    newScopes.value.push(name)
}

async function handleCreate() {
  const name = newName.value.trim()
  if (!name) {
    showMsg('请填写 token 名称')
    return
  }
  if (newScopes.value.length === 0) {
    showMsg('至少选择一个权限范围')
    return
  }
  submitting.value = true
  try {
    const result = await createAPIToken(name, [...newScopes.value])
    if (!result)
      return
    justCreatedToken.value = result.token
    justCreatedName.value = result.name
    showCreatedModal.value = true
    // 重置表单
    newName.value = ''
    newScopes.value = []
    await loadTokens()
  }
  catch (e: any) {
    showMsg(e?.message || '创建失败')
  }
  finally {
    submitting.value = false
  }
}

async function handleRevoke(item: APITokenItem) {
  if (!await confirmDialog({
    title: '吊销 token',
    message: `确定吊销 token「${item.name}」吗？此操作不可恢复。`,
    confirmText: '吊销',
    danger: true,
  }))
    return
  try {
    const ok = await revokeAPIToken(item.token_id)
    if (ok) {
      showMsg('已吊销')
      await loadTokens()
    }
  }
  catch (e: any) {
    showMsg(e?.message || '吊销失败')
  }
}

async function handleDelete(item: APITokenItem) {
  if (!await confirmDialog({
    title: '删除记录',
    message: `确定彻底删除已吊销的 token「${item.name}」吗？删除后该记录将不再显示。`,
    confirmText: '删除',
    danger: true,
  }))
    return
  try {
    const ok = await deleteAPIToken(item.token_id)
    if (ok) {
      showMsg('已删除')
      await loadTokens()
    }
  }
  catch (e: any) {
    showMsg(e?.message || '删除失败')
  }
}

async function copyToken() {
  if (!justCreatedToken.value)
    return
  try {
    await navigator.clipboard.writeText(justCreatedToken.value)
    showMsg('已复制到剪贴板')
  }
  catch {
    showMsg('复制失败，请手动选择文本复制')
  }
}

function closeCreatedModal() {
  showCreatedModal.value = false
  justCreatedToken.value = null
  justCreatedName.value = ''
}

function scopesOf(item: APITokenItem): string[] {
  if (!item.scopes)
    return []
  return item.scopes.split(',').map(s => s.trim()).filter(Boolean)
}

function scopeDescription(name: string): string {
  const found = scopes.value.find(s => s.name === name)
  return found?.description || name
}

function formatTime(s: string | null): string {
  if (!s)
    return '从未使用'
  try {
    const d = new Date(s)
    if (Number.isNaN(d.getTime()))
      return s
    return d.toLocaleString('zh-CN', { hour12: false })
  }
  catch {
    return s
  }
}

onMounted(() => {
  void reloadAll()
})
</script>

<template>
  <section class="pat-panel" aria-label="个人访问令牌">
    <header class="pat-panel__head">
      <div class="pat-panel__title-row">
        <Icon icon="tabler:key" class="pat-panel__title-icon" width="20" height="20" aria-hidden="true" />
        <h2 class="pat-panel__title">
          个人访问令牌（PAT）
        </h2>
        <button
          type="button"
          class="pat-help-btn"
          aria-label="查看调用说明"
          @click="showHelpModal = true"
        >
          <Icon icon="tabler:help-circle" width="18" height="18" aria-hidden="true" />
        </button>
      </div>
      <p class="pat-panel__subtitle">
        用于 MCP 等对外调用。明文 token 仅在创建时显示一次，请立即复制保存。
      </p>
    </header>

    <!-- 创建表单 -->
    <div class="pat-create">
      <label class="pat-field">
        <span class="pat-field__label">名称</span>
        <input
          v-model="newName"
          type="text"
          class="pat-input"
          placeholder="如 Claude Desktop"
          maxlength="64"
        >
      </label>

      <div class="pat-field">
        <span class="pat-field__label">权限范围（多选）</span>
        <div class="pat-scope-list">
          <button
            v-for="s in scopes"
            :key="s.name"
            type="button"
            class="pat-scope-chip"
            :class="{ 'pat-scope-chip--on': newScopes.includes(s.name) }"
            @click="toggleScope(s.name)"
          >
            <Icon
              :icon="newScopes.includes(s.name) ? 'tabler:check' : 'tabler:plus'"
              width="14"
              height="14"
              aria-hidden="true"
            />
            <span class="pat-scope-chip__name">{{ s.name }}</span>
            <span class="pat-scope-chip__desc">{{ s.description }}</span>
          </button>
          <p v-if="scopes.length === 0 && !loading" class="pat-empty-hint">
            暂无可用 scope，请稍后再试
          </p>
        </div>
      </div>

      <button
        type="button"
        class="pat-btn pat-btn--primary"
        :disabled="!canSubmit"
        @click="handleCreate"
      >
        <Icon icon="tabler:plus" width="18" height="18" aria-hidden="true" />
        创建 token
      </button>
    </div>

    <!-- 已有 token 列表 -->
    <div class="pat-list">
      <p class="pat-overline">
        已有 token（{{ tokens.length }}）
      </p>

      <p v-if="loading && tokens.length === 0" class="pat-empty-hint">
        加载中…
      </p>
      <p v-else-if="!loading && tokens.length === 0" class="pat-empty-hint">
        暂无 token
      </p>

      <article
        v-for="t in tokens"
        :key="t.token_id"
        class="pat-item"
        :class="{ 'pat-item--inactive': !t.is_active }"
      >
        <div class="pat-item__head">
          <div class="pat-item__name-wrap">
            <span class="pat-item__name">{{ t.name }}</span>
            <span v-if="!t.is_active" class="pat-item__badge pat-item__badge--muted">已吊销</span>
            <span v-else class="pat-item__badge pat-item__badge--ok">活跃</span>
          </div>
          <span class="pat-item__prefix">{{ t.prefix }}…</span>
        </div>
        <div class="pat-item__scopes">
          <span
            v-for="sc in scopesOf(t)"
            :key="sc"
            class="pat-item__scope"
            :title="scopeDescription(sc)"
          >
            {{ sc }}
          </span>
        </div>
        <div class="pat-item__meta">
          <span class="pat-item__meta-item">
            <Icon icon="tabler:clock" width="13" height="13" aria-hidden="true" />
            创建：{{ formatTime(t.created_at) }}
          </span>
          <span class="pat-item__meta-item">
            <Icon icon="tabler:activity" width="13" height="13" aria-hidden="true" />
            最近使用：{{ formatTime(t.last_used_at) }}
          </span>
        </div>
        <button
          v-if="t.is_active"
          type="button"
          class="pat-btn pat-btn--danger pat-btn--small"
          @click="handleRevoke(t)"
        >
          <Icon icon="tabler:trash" width="15" height="15" aria-hidden="true" />
          吊销
        </button>
        <button
          v-else
          type="button"
          class="pat-btn pat-btn--small pat-btn--ghost"
          @click="handleDelete(t)"
        >
          <Icon icon="tabler:trash-x" width="15" height="15" aria-hidden="true" />
          删除记录
        </button>
      </article>
    </div>

    <!-- 创建成功弹层 -->
    <div
      v-if="showCreatedModal"
      class="pat-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pat-modal-title"
      @click.self="closeCreatedModal"
    >
      <div class="pat-modal__box">
        <header class="pat-modal__head">
          <div class="pat-modal__title-row">
            <Icon icon="tabler:circle-check" width="22" height="22" aria-hidden="true" />
            <h3 id="pat-modal-title" class="pat-modal__title">
              token「{{ justCreatedName }}」已创建
            </h3>
          </div>
          <button type="button" class="pat-modal__close" aria-label="关闭" @click="closeCreatedModal">
            <Icon icon="tabler:x" width="18" height="18" aria-hidden="true" />
          </button>
        </header>
        <p class="pat-modal__warn">
          明文 token 仅此一次显示，关闭后无法再次查看。请立即复制保存。
        </p>
        <div class="pat-modal__token-box">
          <code class="pat-modal__token" data-evia-mask>{{ justCreatedToken }}</code>
          <button type="button" class="pat-btn pat-btn--small pat-btn--secondary" @click="copyToken">
            <Icon icon="tabler:copy" width="15" height="15" aria-hidden="true" />
            复制
          </button>
        </div>
        <div class="pat-modal__footer">
          <button type="button" class="pat-btn pat-btn--primary" @click="closeCreatedModal">
            我已保存
          </button>
        </div>
      </div>
    </div>

    <!-- 帮助说明弹层 -->
    <div
      v-if="showHelpModal"
      class="pat-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pat-help-title"
      @click.self="showHelpModal = false"
    >
      <div class="pat-modal__box pat-modal__box--wide">
        <header class="pat-modal__head">
          <div class="pat-modal__title-row">
            <Icon icon="tabler:help-circle" width="22" height="22" aria-hidden="true" />
            <h3 id="pat-help-title" class="pat-modal__title">
              PAT 调用说明
            </h3>
          </div>
          <button type="button" class="pat-modal__close" aria-label="关闭" @click="showHelpModal = false">
            <Icon icon="tabler:x" width="18" height="18" aria-hidden="true" />
          </button>
        </header>

        <div class="pat-help">
          <section class="pat-help__section">
            <h4 class="pat-help__h4">
              什么是 PAT
            </h4>
            <p class="pat-help__p">
              PAT（Personal Access Token）是你的个人访问令牌。第三方应用（如 Claude Desktop、Cursor、自研脚本）可凭借它通过 MCP 协议调用 SSE_MARKET 智能体的能力，无需登录态。明文 token 仅在创建时显示一次，服务端只存 SHA-256 哈希。
            </p>
          </section>

          <section class="pat-help__section">
            <h4 class="pat-help__h4">
              MCP 接入地址
            </h4>
            <div class="pat-help__code-row">
              <code class="pat-help__code">POST https://ssemarket.cn/api/v1/agent/mcp</code>
            </div>
            <p class="pat-help__p">
              请求头携带 <code class="pat-help__inline-code">Authorization: Bearer &lt;你的 PAT&gt;</code>。协议为 MCP 2025-06-18 Streamable HTTP 单点模式，支持 <code class="pat-help__inline-code">initialize</code> / <code class="pat-help__inline-code">tools/list</code> / <code class="pat-help__inline-code">tools/call</code> / <code class="pat-help__inline-code">ping</code> 方法。
            </p>
          </section>

          <section class="pat-help__section">
            <h4 class="pat-help__h4">
              两种使用方式
            </h4>
            <p class="pat-help__p">
              <strong>方式一：MCP 客户端（推荐，无需知道字段）</strong><br>
              在 Claude Desktop、Cursor、Cherry Studio 等支持 MCP 的客户端里配置好 PAT 后，<strong>你完全不需要知道字段名</strong>。客户端会自动拉取工具列表和参数格式，LLM 会把你的自然语言翻译成正确的工具调用。你只需这样对话：
            </p>
            <ul class="pat-help__ul">
              <li>"帮我发个帖子，标题是'xxx'，内容是'xxx'，分区是'二手交易'"</li>
              <li>"搜一下关于高数的帖子"</li>
              <li>"最近有什么新帖子？"</li>
              <li>"小秋，帮我看看这个论坛里大家对线性代数课程的评价"</li>
            </ul>
            <p class="pat-help__p">
              <strong>方式二：直接调用 API（适合写脚本）</strong><br>
              如果你写脚本或集成到自己的应用，需要按 JSON-RPC 2.0 协议手动构造请求。下方有完整的参数说明和 curl 示例。
            </p>
          </section>

          <section class="pat-help__section">
            <h4 class="pat-help__h4">
              工具参数详解
            </h4>

            <div class="pat-help__tool-block">
              <div class="pat-help__tool-header">
                <span class="pat-help__tool">agent.chat</span>
                <span class="pat-help__scope">scope: agent:chat</span>
              </div>
              <p class="pat-help__tool-desc">
                小秋通用对话：凭 PAT 直接与智能体对话，具备完整的小秋能力（发帖、搜索、RAG、知识库等），但无会话记忆，每次调用独立。
              </p>
              <table class="pat-help__table">
                <thead>
                  <tr><th>参数</th><th>类型</th><th>必填</th><th>说明</th></tr>
                </thead>
                <tbody>
                  <tr><td>query</td><td>string</td><td>是</td><td>用户的问题或指令（1-8192 字）</td></tr>
                </tbody>
              </table>
            </div>

            <div class="pat-help__tool-block">
              <div class="pat-help__tool-header">
                <span class="pat-help__tool">forum.post_search</span>
                <span class="pat-help__scope">scope: forum:read</span>
              </div>
              <p class="pat-help__tool-desc">
                按关键词检索论坛帖子（标题 + 正文匹配）。
              </p>
              <table class="pat-help__table">
                <thead>
                  <tr><th>参数</th><th>类型</th><th>必填</th><th>说明</th></tr>
                </thead>
                <tbody>
                  <tr><td>keyword</td><td>string</td><td>是</td><td>检索关键词（至少 1 字）</td></tr>
                  <tr><td>limit</td><td>integer</td><td>否</td><td>返回行数上限，1-50，默认 50</td></tr>
                </tbody>
              </table>
            </div>

            <div class="pat-help__tool-block">
              <div class="pat-help__tool-header">
                <span class="pat-help__tool">forum.comment_search</span>
                <span class="pat-help__scope">scope: forum:read</span>
              </div>
              <p class="pat-help__tool-desc">
                按关键词检索评论与评论回复。
              </p>
              <table class="pat-help__table">
                <thead>
                  <tr><th>参数</th><th>类型</th><th>必填</th><th>说明</th></tr>
                </thead>
                <tbody>
                  <tr><td>keyword</td><td>string</td><td>是</td><td>评论关键词（至少 1 字）</td></tr>
                  <tr><td>limit</td><td>integer</td><td>否</td><td>返回行数上限，1-50，默认 50</td></tr>
                </tbody>
              </table>
            </div>

            <div class="pat-help__tool-block">
              <div class="pat-help__tool-header">
                <span class="pat-help__tool">forum.latest_posts</span>
                <span class="pat-help__scope">scope: forum:read</span>
              </div>
              <p class="pat-help__tool-desc">
                获取最新 N 条论坛帖子（按发帖时间倒序）。
              </p>
              <table class="pat-help__table">
                <thead>
                  <tr><th>参数</th><th>类型</th><th>必填</th><th>说明</th></tr>
                </thead>
                <tbody>
                  <tr><td>limit</td><td>integer</td><td>否</td><td>返回行数上限，1-50，默认 50</td></tr>
                </tbody>
              </table>
            </div>

            <div class="pat-help__tool-block">
              <div class="pat-help__tool-header">
                <span class="pat-help__tool">forum.post_create</span>
                <span class="pat-help__scope">scope: forum:write</span>
              </div>
              <p class="pat-help__tool-desc">
                以 PAT 持有者身份在论坛发帖。受封禁状态、分区等业务规则约束。
              </p>
              <table class="pat-help__table">
                <thead>
                  <tr><th>参数</th><th>类型</th><th>必填</th><th>说明</th></tr>
                </thead>
                <tbody>
                  <tr><td>title</td><td>string</td><td>是</td><td>帖子标题（1-30 字）</td></tr>
                  <tr><td>content</td><td>string</td><td>是</td><td>帖子正文（1-10000 字）</td></tr>
                  <tr><td>partition</td><td>string</td><td>是</td><td>分区名称（如"二手交易"、"校园生活"；<strong>不能为"课程交流"</strong>）</td></tr>
                  <tr><td>tags</td><td>string[]</td><td>否</td><td>标签列表，如 ["二手","教材"]</td></tr>
                  <tr><td>photos</td><td>string</td><td>否</td><td>图片 URL 的 JSON 数组字符串，如 '["https://.../1.jpg"]'</td></tr>
                  <tr><td>is_private</td><td>boolean</td><td>否</td><td>是否仅自己可见，默认 false</td></tr>
                </tbody>
              </table>
            </div>
          </section>

          <section class="pat-help__section">
            <h4 class="pat-help__h4">
              自然语言对话示例（MCP 客户端）
            </h4>
            <p class="pat-help__p">
              配置好客户端后，直接这样对话，LLM 会自动调用对应工具并填充参数：
            </p>
            <pre class="pat-help__pre">你：帮我发个帖子到"二手交易"分区，标题"出一本高数"，
    内容"九成新，50 元出，联系 QQ：xxx"

小秋：（自动调用 forum.post_create）
→ 已为你发布帖子，链接：https://ssemarket.cn/post/12345

你：最近有什么新帖子？

小秋：（自动调用 forum.latest_posts）
→ 最新 10 条帖子：1. xxx  2. xxx ...

你：搜一下"高数"相关的帖子

小秋：（自动调用 forum.post_search, keyword="高数"）
→ 找到 3 条相关帖子：...</pre>
          </section>

          <section class="pat-help__section">
            <h4 class="pat-help__h4">
              直接 API 调用示例（curl）
            </h4>
            <p class="pat-help__p">
              第一步：初始化会话（只需一次）
            </p>
            <pre class="pat-help__pre">curl -X POST https://ssemarket.cn/api/v1/agent/mcp \
  -H "Authorization: Bearer sk_xq_xxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"my-script","version":"1.0"}}}'}</pre>
            <p class="pat-help__p">
              第二步：调用工具（以发帖为例）
            </p>
            <pre class="pat-help__pre">curl -X POST https://ssemarket.cn/api/v1/agent/mcp \
  -H "Authorization: Bearer sk_xq_xxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "forum.post_create",
      "arguments": {
        "title": "出一本高数",
        "content": "九成新，50 元出",
        "partition": "二手交易",
        "tags": ["二手", "教材"],
        "is_private": false
      }
    }
  }'</pre>
          </section>

          <section class="pat-help__section">
            <h4 class="pat-help__h4">
              客户端配置示例（Claude Desktop）
            </h4>
            <pre class="pat-help__pre">{
  "mcpServers": {
    "sse-smart-qiu": {
      "url": "https://ssemarket.cn/api/v1/agent/mcp",
      "headers": {
        "Authorization": "Bearer sk_xq_xxxxxxxx"
      }
    }
  }
}</pre>
          </section>

          <section class="pat-help__section">
            <h4 class="pat-help__h4">
              安全建议
            </h4>
            <ul class="pat-help__ul">
              <li>token 一旦创建无法再次查看明文，请立即复制保存到密码管理器。</li>
              <li>为不同应用创建独立 token，并只勾选所需最小 scope。</li>
              <li>token 泄露请立即吊销，重新创建。</li>
              <li>调用时会回写最近使用时间，便于审计。</li>
            </ul>
          </section>
        </div>

        <div class="pat-modal__footer">
          <button type="button" class="pat-btn pat-btn--primary" @click="showHelpModal = false">
            知道了
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.pat-panel {
  background: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 20px;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.05);
  padding: 18px;
  margin-bottom: 12px;
}

.pat-panel__head {
  margin-bottom: 14px;
}

.pat-panel__title-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.pat-panel__title-icon {
  color: var(--accent);
  flex-shrink: 0;
}

.pat-panel__title {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 600;
  color: var(--color-text);
}

.pat-panel__subtitle {
  margin: 0.35rem 0 0;
  font-size: 0.825rem;
  color: var(--color-text-muted);
  line-height: 1.5;
}

.pat-create {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 14px;
  background: var(--color-bg);
  border: 1px dashed var(--color-border);
  border-radius: 14px;
  margin-bottom: 16px;
}

.pat-field {
  display: block;
}

.pat-field__label {
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-secondary);
}

.pat-input {
  width: 100%;
  box-sizing: border-box;
  padding: 11px 14px;
  font-size: 15px;
  font-family: inherit;
  color: var(--color-text);
  background: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  outline: none;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;

  &::placeholder {
    color: var(--color-text-muted);
  }

  &:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-soft);
  }
}

.pat-scope-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.pat-scope-chip {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  border-radius: 12px;
  border: 1px solid var(--color-border);
  background: var(--color-card);
  color: var(--color-text-secondary);
  font-family: inherit;
  font-size: 13px;
  cursor: pointer;
  text-align: left;
  transition:
    border-color 0.15s ease,
    background 0.15s ease,
    color 0.15s ease;
  -webkit-tap-highlight-color: transparent;

  &__name {
    font-weight: 600;
    color: var(--color-text);
    flex-shrink: 0;
  }

  &__desc {
    color: var(--color-text-muted);
    font-size: 12px;
    line-height: 1.4;
  }

  &--on {
    border-color: var(--accent);
    background: var(--accent-soft);
    color: var(--accent);
  }

  &--on .pat-scope-chip__name {
    color: var(--accent);
  }

  &:hover {
    border-color: var(--accent);
  }
}

.pat-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 11px 18px;
  border-radius: 14px;
  font-size: 15px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  border: 1px solid transparent;
  transition:
    background 0.15s ease,
    border-color 0.15s ease,
    filter 0.15s ease,
    transform 0.12s ease;
  -webkit-tap-highlight-color: transparent;

  &--primary {
    background: var(--accent);
    border-color: var(--accent);
    color: #fff;

    &:hover:not(:disabled) {
      filter: brightness(1.05);
    }

    &:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }
  }

  &--secondary {
    background: var(--color-bg);
    border-color: var(--color-border-strong);
    color: var(--accent);

    &:hover {
      background: var(--accent-soft);
      border-color: var(--accent);
    }
  }

  &--danger {
    background: var(--color-card);
    border-color: rgba(239, 68, 68, 0.35);
    color: #ef4444;

    &:hover {
      background: rgba(239, 68, 68, 0.06);
      border-color: rgba(239, 68, 68, 0.55);
    }
  }

  &--small {
    padding: 7px 12px;
    font-size: 13px;
    border-radius: 10px;
  }
}

.pat-overline {
  margin: 0 0 10px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.06em;
  color: var(--color-text-muted);
}

.pat-empty-hint {
  margin: 8px 0;
  font-size: 13px;
  color: var(--color-text-muted);
}

.pat-item {
  padding: 14px;
  border: 1px solid var(--color-border);
  border-radius: 14px;
  background: var(--color-bg);
  margin-bottom: 10px;

  &--inactive {
    opacity: 0.6;
  }

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 8px;
    flex-wrap: wrap;
  }

  &__name-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  &__name {
    font-size: 15px;
    font-weight: 600;
    color: var(--color-text);
    word-break: break-word;
  }

  &__badge {
    display: inline-flex;
    align-items: center;
    padding: 2px 8px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 600;

    &--ok {
      background: rgba(34, 197, 94, 0.12);
      color: #22c55e;
    }

    &--muted {
      background: var(--color-card);
      color: var(--color-text-muted);
      border: 1px solid var(--color-border);
    }
  }

  &__prefix {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 12px;
    color: var(--color-text-muted);
    background: var(--color-card);
    padding: 3px 8px;
    border-radius: 8px;
    border: 1px solid var(--color-border);
  }

  &__scopes {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 8px;
  }

  &__scope {
    display: inline-flex;
    align-items: center;
    padding: 3px 9px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 500;
    background: var(--accent-soft);
    color: var(--accent);
    border: 1px solid transparent;
  }

  &__meta {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 14px;
    font-size: 12px;
    color: var(--color-text-muted);
    margin-bottom: 10px;
  }

  &__meta-item {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
}

.pat-modal {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 16px;
  box-sizing: border-box;

  &__box {
    background: var(--color-card);
    border-radius: 18px;
    box-shadow: 0 10px 40px rgba(15, 23, 42, 0.2);
    max-width: 560px;
    width: 100%;
    padding: 20px;
    box-sizing: border-box;

    &--wide {
      max-width: 640px;
      max-height: 88vh;
      overflow-y: auto;
    }
  }

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }

  &__title-row {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #22c55e;
  }

  &__title {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--color-text);
  }

  &__close {
    background: transparent;
    border: none;
    color: var(--color-text-muted);
    cursor: pointer;
    padding: 4px;
    border-radius: 8px;

    &:hover {
      background: var(--color-bg);
      color: var(--color-text);
    }
  }

  &__warn {
    margin: 0 0 12px;
    font-size: 13px;
    color: #f59e0b;
    line-height: 1.5;
  }

  &__token-box {
    display: flex;
    gap: 8px;
    align-items: stretch;
    margin-bottom: 14px;
  }

  &__token {
    flex: 1;
    min-width: 0;
    padding: 12px;
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: 12px;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 13px;
    color: var(--color-text);
    word-break: break-all;
    overflow-x: auto;
  }

  &__footer {
    display: flex;
    justify-content: flex-end;
  }
}

.pat-help-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  transition:
    background 0.15s ease,
    color 0.15s ease;
  -webkit-tap-highlight-color: transparent;

  &:hover {
    background: var(--accent-soft);
    color: var(--accent);
  }
}

.pat-help {
  &__section {
    margin-bottom: 16px;

    &:last-child {
      margin-bottom: 0;
    }
  }

  &__h4 {
    margin: 0 0 8px;
    font-size: 14px;
    font-weight: 600;
    color: var(--color-text);
  }

  &__p {
    margin: 0;
    font-size: 13px;
    line-height: 1.6;
    color: var(--color-text-secondary);
  }

  &__ul {
    margin: 0;
    padding-left: 18px;
    font-size: 13px;
    line-height: 1.6;
    color: var(--color-text-secondary);

    li {
      margin-bottom: 8px;
    }
  }

  &__code-row {
    margin-bottom: 8px;
  }

  &__code {
    display: block;
    padding: 10px 12px;
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: 10px;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 12px;
    color: var(--color-text);
    word-break: break-all;
  }

  &__inline-code {
    padding: 1px 6px;
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 12px;
    color: var(--accent);
  }

  &__pre {
    margin: 0;
    padding: 12px;
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: 10px;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 12px;
    line-height: 1.5;
    color: var(--color-text);
    overflow-x: auto;
    white-space: pre;
  }

  &__tool {
    display: inline-block;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 13px;
    font-weight: 600;
    color: var(--accent);
  }

  &__scope {
    display: inline-block;
    margin-left: 8px;
    padding: 1px 8px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 500;
    background: var(--accent-soft);
    color: var(--accent);
  }

  &__tool-desc {
    margin: 4px 0 0;
    font-size: 12px;
    line-height: 1.5;
    color: var(--color-text-muted);
  }

  &__tool-block {
    margin-bottom: 14px;
    padding: 12px;
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: 10px;

    &:last-child {
      margin-bottom: 0;
    }
  }

  &__tool-header {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px;
    margin-bottom: 6px;
  }

  &__table {
    width: 100%;
    margin-top: 8px;
    border-collapse: collapse;
    font-size: 12px;

    th,
    td {
      padding: 6px 8px;
      border: 1px solid var(--color-border);
      text-align: left;
      vertical-align: top;
    }

    th {
      background: var(--color-card);
      font-weight: 600;
      color: var(--color-text);
      white-space: nowrap;
    }

    td {
      color: var(--color-text-secondary);

      &:first-child {
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        color: var(--accent);
        white-space: nowrap;
      }

      &:nth-child(2),
      &:nth-child(3) {
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        white-space: nowrap;
      }
    }

    strong {
      color: var(--accent);
    }
  }
}
</style>
