import { drainEncryptedContent, drainEvia, isEviaConsentEnabled, onEviaConsentChange, trackEvia } from './evia'
import { enqueueGenericSensitiveContent } from './sensitive'

const FORMAT = 'evia.session-replay.v1'
const PROTOCOL_VERSION = 2
const FLUSH_MS = 3000
// Stay below the 32 encrypted-chunk/item contract after the segment envelope;
// the SDK's native outcome-scoped drain now safely spans multiple HTTP batches.
const ITEM_DATA_LIMIT = 16000
const DEFAULT_SESSION_BUDGET = 2 * 1024 * 1024
const MAX_SNAPSHOT_CHARS = 4 * 1024 * 1024
const MAX_INLINE_STYLE_CHARS = 1024 * 1024
const MAX_EMBEDDED_SURFACES = 16
const MAX_SURFACE_HTML_CHARS = 256 * 1024
const MAX_SURFACE_TOTAL_CHARS = 1024 * 1024
const USED_BYTES_KEY = 'evia:replay:used:v1'
const RESERVED_BYTES_KEY = 'evia:replay:reserved:v1'
const PENDING_BYTES_KEY = 'evia:replay:pending:v1'
const LARGEST_REJECTED_PAYLOAD_KEY = 'evia:replay:largest-rejected:v1'
const DOCUMENT_SEQ_KEY = 'evia:replay:document-seq:v1'
const REPLAY_NODE_ATTRIBUTE = 'data-evia-rid'
const MASK = '••••'

interface ReplaySurface {
  node_id: number
  kind: 'open_shadow_root' | 'same_origin_iframe' | 'cross_origin_iframe' | 'canvas' | 'media'
  html?: string
  html_truncated?: boolean
  width?: number
  height?: number
  media_kind?: 'audio' | 'video'
  current_time_ms?: number
  duration_ms?: number
  paused?: boolean
  muted?: boolean
  ready_state?: number
  content_omitted?: true
}

interface ReplayRecord {
  seq: number
  type: string
  at: number
  data: Record<string, unknown>
}

interface ReplayEnvelope {
  format: typeof FORMAT
  protocol_version: typeof PROTOCOL_VERSION
  payload_id: string
  document_id: string
  document_seq: number
  payload_seq: number
  time_origin_ms: number
  route: string
  created_at: string
  capture_scope: 'sanitized-dom-surfaces-v2'
  mask_version: 1
  payload: Record<string, unknown>
}

let enabled = false
let streamId = ''
let documentId = ''
let documentSeq = 0
let payloadSeq = 0
let recordSeq = 0
let nextNodeId = 1
const nodeIds = new WeakMap<Node, number>()
let startedAt = 0
let usedBytes = 0
let pendingBytes = 0
let budgetBytes = DEFAULT_SESSION_BUDGET
let records: ReplayRecord[] = []
let observer: MutationObserver | null = null
let flushTimer: number | null = null
let deliveryFlight: Promise<void> = Promise.resolve()
let currentRoute = ''
let lastScrollAt = 0
let snapshotTimer: number | null = null

function nodeID(node: Node): number {
  const current = nodeIds.get(node)
  if (current !== undefined)
    return current
  const created = nextNodeId++
  nodeIds.set(node, created)
  return created
}

function elapsed(): number {
  return Math.max(0, Math.round(performance.now()))
}

function annotateClone(original: Node, clone: Node): void {
  if (original instanceof Element && clone instanceof Element)
    clone.setAttribute(REPLAY_NODE_ATTRIBUTE, String(nodeID(original)))
  const originalChildren = Array.from(original.childNodes)
  const cloneChildren = Array.from(clone.childNodes)
  for (let index = 0; index < Math.min(originalChildren.length, cloneChildren.length); index++) {
    const source = originalChildren[index]!
    const target = cloneChildren[index]!
    if (source instanceof Element && target instanceof Element) {
      annotateClone(source, target)
      continue
    }
    const marker = clone.ownerDocument?.createComment(`evia-rid:${nodeID(source)}`)
    if (marker)
      target.parentNode?.insertBefore(marker, target)
    if (source.nodeType === Node.COMMENT_NODE)
      target.textContent = ''
  }
}

function ratio(value: number, max: number): number {
  if (!Number.isFinite(value) || max <= 0)
    return 0
  return Math.round(Math.max(0, Math.min(1, value / max)) * 10000) / 10000
}

function structuralPath(node: Node | null): string {
  let element = node instanceof Element ? node : node?.parentElement
  const parts: string[] = []
  for (let depth = 0; element && depth < 5; depth++) {
    const tag = element.localName.toLowerCase()
    const siblings = element.parentElement
      ? Array.from(element.parentElement.children).filter(candidate => candidate.localName === element!.localName)
      : [element]
    parts.unshift(`${tag}:nth-of-type(${Math.max(0, siblings.indexOf(element)) + 1})`)
    element = element.parentElement
    if (element?.localName === 'body') {
      parts.unshift('body:nth-of-type(1)')
      break
    }
  }
  return parts.join('>').slice(0, 256)
}

function isMasked(element: Element | null): boolean {
  let current = element
  while (current) {
    if (current.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[data-evia-mask],.evia-mask'))
      return true
    const root = current.getRootNode()
    current = root instanceof ShadowRoot ? root.host : null
  }
  return false
}

function inlineDocumentStyles(clone: Element): void {
  const head = clone.querySelector('head')
  if (!head)
    return
  let css = ''
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules)) {
        if (css.length + rule.cssText.length + 1 > MAX_INLINE_STYLE_CHARS)
          break
        css += `${rule.cssText}\n`
      }
    }
    catch {
      // Cross-origin stylesheets are not readable and remain blocked in playback.
    }
    if (css.length >= MAX_INLINE_STYLE_CHARS)
      break
  }
  if (!css)
    return
  const style = clone.ownerDocument.createElement('style')
  style.textContent = css
  head.append(style)
}

function sanitizeElement(root: Element): string {
  const clone = root.cloneNode(true) as Element
  annotateClone(root, clone)
  if (root === document.documentElement)
    inlineDocumentStyles(clone)
  clone.querySelectorAll('script,noscript,iframe,object,embed').forEach(node => node.remove())
  const all = [clone, ...Array.from(clone.querySelectorAll('*'))]
  for (const element of all) {
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase()
      if (name.startsWith('on') || name.startsWith('aria-') || name === 'nonce' || name === 'value' || name === 'srcdoc'
        || name.includes('token') || name.includes('authorization') || name.includes('cookie')
        || (name.startsWith('data-') && name !== 'data-evia-mask' && name !== REPLAY_NODE_ATTRIBUTE && name !== 'data-v-app' && !/^data-v-[a-f0-9]{8}$/.test(name)))
        element.removeAttribute(attribute.name)
      else if (name === 'style')
        element.setAttribute(name, attribute.value.replace(/url\([^)]*\)/gi, 'url()').slice(0, 2000))
      else if ((name === 'href' || name === 'src') && attribute.value) {
        try {
          const value = new URL(attribute.value, location.href)
          value.search = ''
          value.hash = ''
          element.setAttribute(attribute.name, value.href.slice(0, 512))
        }
        catch {
          element.removeAttribute(attribute.name)
        }
      }
    }
    if (element.matches('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[data-evia-mask],.evia-mask'))
      element.textContent = MASK
  }
  const html = clone.outerHTML
  if (html.length > MAX_SNAPSHOT_CHARS)
    throw new Error('replay snapshot exceeds complete markup limit')
  return html
}

function sanitizeAddedNode(node: Node): { rootId: number, html: string } {
  if (node instanceof Element)
    return { rootId: nodeID(node), html: sanitizeElement(node) }
  const container = document.createElement('div')
  const marker = document.createComment(`evia-rid:${nodeID(node)}`)
  container.append(marker)
  if (isMasked(node.parentElement))
    container.append(document.createTextNode(MASK))
  else if (node.nodeType === Node.TEXT_NODE)
    container.append(document.createTextNode(node.textContent || ''))
  else
    container.append(document.createComment(''))
  return { rootId: nodeID(node), html: container.innerHTML }
}

export function captureReplaySurfaces(): ReplaySurface[] {
  const surfaces: ReplaySurface[] = []
  let capturedHTMLCharacters = 0
  const appendHTML = (surface: ReplaySurface, html: string): void => {
    if (html.length > MAX_SURFACE_HTML_CHARS || capturedHTMLCharacters + html.length > MAX_SURFACE_TOTAL_CHARS) {
      surface.html_truncated = true
      return
    }
    surface.html = html
    capturedHTMLCharacters += html.length
  }
  const visit = (root: Document | ShadowRoot): void => {
    if (surfaces.length >= MAX_EMBEDDED_SURFACES)
      return
    for (const element of Array.from(root.querySelectorAll('*'))) {
      if (surfaces.length >= MAX_EMBEDDED_SURFACES)
        return
      if (element.shadowRoot?.mode === 'open') {
        const wrapper = document.createElement('div')
        for (const child of Array.from(element.shadowRoot.childNodes))
          wrapper.append(child.cloneNode(true))
        const surface: ReplaySurface = { node_id: nodeID(element), kind: 'open_shadow_root' }
        try {
          appendHTML(surface, sanitizeElement(wrapper))
        }
        catch {
          surface.html_truncated = true
        }
        surfaces.push(surface)
        visit(element.shadowRoot)
      }
      if (element instanceof HTMLIFrameElement) {
        const surface: ReplaySurface = { node_id: nodeID(element), kind: 'cross_origin_iframe', content_omitted: true }
        try {
          const frameRoot = element.contentDocument?.documentElement
          if (frameRoot) {
            surface.kind = 'same_origin_iframe'
            delete surface.content_omitted
            try {
              appendHTML(surface, sanitizeElement(frameRoot))
            }
            catch {
              surface.html_truncated = true
            }
          }
        }
        catch {
          // Cross-origin frame content remains inaccessible and is explicitly omitted.
        }
        surfaces.push(surface)
      }
      else if (element instanceof HTMLCanvasElement) {
        surfaces.push({
          node_id: nodeID(element),
          kind: 'canvas',
          width: Math.max(0, Math.min(16_384, element.width)),
          height: Math.max(0, Math.min(16_384, element.height)),
          content_omitted: true,
        })
      }
      else if (element instanceof HTMLMediaElement) {
        const duration = Number.isFinite(element.duration) ? Math.max(0, element.duration) : 0
        surfaces.push({
          node_id: nodeID(element),
          kind: 'media',
          media_kind: element instanceof HTMLVideoElement ? 'video' : 'audio',
          current_time_ms: Math.min(24 * 60 * 60_000, Math.max(0, Math.round(element.currentTime * 1000))),
          duration_ms: Math.min(24 * 60 * 60_000, Math.round(duration * 1000)),
          paused: element.paused,
          muted: element.muted,
          ready_state: element.readyState,
          content_omitted: true,
        })
      }
    }
  }
  visit(document)
  return surfaces
}

async function gzipBase64(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value)
  if (typeof CompressionStream === 'undefined') {
    let binary = ''
    for (const byte of bytes)
      binary += String.fromCharCode(byte)
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
  }
  const writer = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'))
  const compressed = new Uint8Array(await new Response(writer).arrayBuffer())
  let binary = ''
  for (const byte of compressed)
    binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function persistBudgetCheckpoint(): void {
  try {
    sessionStorage.setItem(USED_BYTES_KEY, String(usedBytes))
    // Delivery is serialized, so there is no separate admitted-but-not-enqueued
    // reservation. Pending counts encoded characters currently owned by the SDK.
    sessionStorage.setItem(RESERVED_BYTES_KEY, '0')
    sessionStorage.setItem(PENDING_BYTES_KEY, String(pendingBytes))
  }
  catch {
    // In-memory accounting still prevents an unbounded current document.
  }
}

function recordRejectedPayload(characters: number): void {
  try {
    const previous = Number(sessionStorage.getItem(LARGEST_REJECTED_PAYLOAD_KEY) ?? '0')
    const largest = Number.isSafeInteger(previous) && previous >= 0 ? Math.max(previous, characters) : characters
    sessionStorage.setItem(LARGEST_REJECTED_PAYLOAD_KEY, String(largest))
  }
  catch {
    // The hard in-memory budget remains authoritative when storage is unavailable.
  }
}

function commitAcceptedBudget(characters: number): void {
  if (!Number.isSafeInteger(characters) || characters < 1)
    return
  usedBytes += characters
  pendingBytes = Math.max(0, pendingBytes - characters)
  persistBudgetCheckpoint()
}

function rememberItem(itemId: string): void {
  try {
    const key = 'evia:replay:items:v1'
    const current = JSON.parse(sessionStorage.getItem(key) || '[]') as string[]
    current.push(itemId)
    sessionStorage.setItem(key, JSON.stringify(current.slice(-200)))
  }
  catch {
    // Replay delivery is authoritative; local evidence index is best-effort.
  }
}

async function emitPayload(contentType: string, envelope: ReplayEnvelope): Promise<void> {
  if (!enabled)
    return
  const raw = JSON.stringify(envelope)
  const encoded = await gzipBase64(raw)
  if (usedBytes + pendingBytes + encoded.length > budgetBytes) {
    recordRejectedPayload(encoded.length)
    persistBudgetCheckpoint()
    enabled = false
    trackEvia('replay_stopped', { reason: 'budget_exceeded', used_bytes: Math.min(usedBytes, 100_000_000) })
    return
  }
  pendingBytes += encoded.length
  persistBudgetCheckpoint()
  const count = Math.max(1, Math.ceil(encoded.length / ITEM_DATA_LIMIT))
  const groupId = envelope.payload_id
  const segments = Array.from({ length: count }, (_, index) => ({
    itemId: crypto.randomUUID(),
    input: {
      contentType,
      streamId,
      actorType: 'browser',
      content: JSON.stringify({
        format: FORMAT,
        encoding: typeof CompressionStream === 'undefined' ? 'base64url' : 'gzip-base64url',
        group_id: groupId,
        segment_index: index,
        segment_count: count,
        data: encoded.slice(index * ITEM_DATA_LIMIT, (index + 1) * ITEM_DATA_LIMIT),
      }),
      status: 'done',
      durationMs: Date.now() - startedAt,
      paddedBlockBytes: 4096 as const,
    },
  }))
  // Three 16k items expand to at most 12 fixed-4096 encrypted events, retaining
  // ample room under the 200-event / 256 KiB queue ceilings. Each item is atomically
  // admitted by the SDK, so queue pressure cannot leave a hidden chunk prefix.
  for (let offset = 0; offset < segments.length; offset += 3) {
    const group = segments.slice(offset, offset + 3)
    let queued = await Promise.all(group.map(segment => enqueueGenericSensitiveContent({
      ...segment.input,
      itemId: segment.itemId,
    })))
    if (queued.some(deliveries => deliveries === null)) {
      await drainEvia()
      queued = await Promise.all(group.map((segment, index) => queued[index] ?? enqueueGenericSensitiveContent({
        ...segment.input,
        itemId: segment.itemId,
      })))
    }
    if (queued.some(deliveries => deliveries === null))
      throw new Error('replay encrypted queue unavailable')
    const emissions = queued.flatMap(deliveries => deliveries!)
    const delivery = drainEncryptedContent(emissions, {
      timeoutMs: 10 * 60_000,
      maxRounds: 1024,
    })
    if (!delivery)
      throw new Error('replay encrypted delivery was unavailable')
    const result = await delivery
    if (result.status !== 'accepted') {
      const terminal = result.outcomes.reduce<Record<string, number>>((counts, outcome) => {
        counts[outcome.status] = (counts[outcome.status] ?? 0) + 1
        return counts
      }, {})
      throw new Error(`replay encrypted delivery incomplete: reason=${result.reason} pending=${result.pendingEventIds.length} outcomes=${JSON.stringify(terminal)}`)
    }
    for (const segment of group) {
      const payload = JSON.parse(segment.input.content) as { data?: unknown }
      if (typeof payload.data === 'string')
        commitAcceptedBudget(payload.data.length)
      rememberItem(segment.itemId)
    }
  }
}

function enqueuePayload(contentType: string, payload: Record<string, unknown>, route = currentRoute): Promise<void> {
  const capturedAt = Date.now()
  const envelope: ReplayEnvelope = {
    format: FORMAT,
    protocol_version: PROTOCOL_VERSION,
    payload_id: crypto.randomUUID(),
    document_id: documentId,
    document_seq: documentSeq,
    payload_seq: ++payloadSeq,
    time_origin_ms: Math.round(performance.timeOrigin),
    route: route.slice(0, 128),
    created_at: new Date(capturedAt).toISOString(),
    capture_scope: 'sanitized-dom-surfaces-v2',
    mask_version: 1,
    payload,
  }
  deliveryFlight = deliveryFlight
    .then(() => emitPayload(contentType, envelope))
    .catch((error) => {
      enabled = false
      trackEvia('replay_stopped', { reason: 'delivery_failed', used_bytes: Math.min(usedBytes, 100_000_000) })
      console.warn('[evia] 回放密文交付失败，已停止当前会话录制', error instanceof Error ? error.message : 'unknown')
    })
  return deliveryFlight
}

function flushMutations(): Promise<void> {
  if (!enabled || records.length === 0)
    return deliveryFlight
  const pending = records
  records = []
  return enqueuePayload('session_replay_mutations', {
    kind: 'mutations',
    first_seq: pending[0]!.seq,
    last_seq: pending[pending.length - 1]!.seq,
    records: pending,
  })
}

function queue(type: string, data: Record<string, unknown>): void {
  if (!enabled)
    return
  records.push({ seq: ++recordSeq, type, at: elapsed(), data })
  if (records.length >= 100)
    void flushMutations()
}

export function recordReplayNavigation(route: string): void {
  const fromRoute = currentRoute
  const capturedRoute = route.slice(0, 128)
  if (!enabled) {
    currentRoute = capturedRoute
    return
  }
  void flushMutations()
  currentRoute = capturedRoute
  const navigationId = crypto.randomUUID()
  queue('navigation', { navigation_id: navigationId, from_route: fromRoute, route: capturedRoute })
  if (snapshotTimer !== null)
    clearTimeout(snapshotTimer)
  snapshotTimer = window.setTimeout(() => {
    snapshotTimer = null
    void flushMutations()
    try {
      void enqueuePayload('session_replay_snapshot', {
        kind: 'snapshot',
        reason: fromRoute ? 'navigation' : 'initial',
        navigation_id: navigationId,
        base_seq: recordSeq,
        at: elapsed(),
        viewport: { width: innerWidth, height: innerHeight },
        scroll: { x: scrollX, y: scrollY },
        html: sanitizeElement(document.documentElement),
        surface_capture_version: 1,
        surface_state_exact: false,
        surfaces: captureReplaySurfaces(),
      }, capturedRoute)
    }
    catch {
      enabled = false
    }
  }, 2000)
}

let consentSubscribed = false
let detachListeners: (() => void) | null = null

export function stopSessionReplay(): void {
  enabled = false
  records.length = 0
  if (snapshotTimer !== null) {
    clearTimeout(snapshotTimer)
    snapshotTimer = null
  }
  if (flushTimer !== null) {
    clearInterval(flushTimer)
    flushTimer = null
  }
  observer?.disconnect()
  observer = null
  detachListeners?.()
  detachListeners = null
}

function ensureConsentSubscription(): void {
  if (consentSubscribed)
    return
  consentSubscribed = true
  onEviaConsentChange((allowed) => {
    if (!allowed) {
      stopSessionReplay()
    }
    else {
      initSessionReplay()
      if (enabled && currentRoute)
        recordReplayNavigation(currentRoute)
    }
  })
}

export function initSessionReplay(): void {
  ensureConsentSubscription()
  if (enabled || !isEviaConsentEnabled() || typeof window === 'undefined' || typeof document === 'undefined')
    return
  const sampleRate = Number(import.meta.env.VITE_EVIA_REPLAY_SAMPLE_RATE ?? '0')
  if (!Number.isFinite(sampleRate) || sampleRate <= 0)
    return
  const boundedRate = Math.min(1, sampleRate)
  try {
    const sampledKey = 'evia:replay:sampled:v1'
    const stored = sessionStorage.getItem(sampledKey)
    const sampled = stored === null ? Math.random() < boundedRate : stored === '1'
    if (stored === null)
      sessionStorage.setItem(sampledKey, sampled ? '1' : '0')
    if (!sampled)
      return
    streamId = sessionStorage.getItem('evia:replay:stream:v1') || crypto.randomUUID()
    sessionStorage.setItem('evia:replay:stream:v1', streamId)
    const priorDocumentSeq = Number(sessionStorage.getItem(DOCUMENT_SEQ_KEY) ?? '0')
    documentSeq = Number.isSafeInteger(priorDocumentSeq) && priorDocumentSeq >= 0 ? priorDocumentSeq + 1 : 1
    sessionStorage.setItem(DOCUMENT_SEQ_KEY, String(documentSeq))
    documentId = crypto.randomUUID()
    const persistedBytes = Number(sessionStorage.getItem(USED_BYTES_KEY) ?? '0')
    usedBytes = Number.isSafeInteger(persistedBytes) && persistedBytes >= 0 ? persistedBytes : 0
  }
  catch {
    return
  }
  const configuredBudget = Number(import.meta.env.VITE_EVIA_REPLAY_MAX_BYTES ?? DEFAULT_SESSION_BUDGET)
  budgetBytes = Number.isFinite(configuredBudget)
    ? Math.min(8 * 1024 * 1024, Math.max(64 * 1024, Math.round(configuredBudget)))
    : DEFAULT_SESSION_BUDGET
  pendingBytes = 0
  persistBudgetCheckpoint()
  if (usedBytes >= budgetBytes)
    return
  enabled = true
  startedAt = Date.now()
  observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'characterData') {
        if (isMasked(mutation.target.parentElement))
          continue
        const text = mutation.target.textContent || ''
        if (text.length > 64 * 1024) {
          enabled = false
          continue
        }
        queue('text', { node_id: nodeID(mutation.target), text })
      }
      else if (mutation.type === 'attributes' && mutation.target instanceof Element) {
        if (isMasked(mutation.target))
          continue
        const name = mutation.attributeName || ''
        if (name === 'class' || name === 'style' || name === 'hidden') {
          const raw = mutation.target.getAttribute(name)
          const value = name === 'style' && raw !== null ? raw.replace(/url\([^)]*\)/gi, 'url()').slice(0, 2000) : raw
          queue('attribute', { node_id: nodeID(mutation.target), namespace: mutation.attributeNamespace, name, value })
        }
      }
      else if (mutation.type === 'childList' && !isMasked(mutation.target instanceof Element ? mutation.target : mutation.target.parentElement)) {
        try {
          const added = Array.from(mutation.addedNodes).map(sanitizeAddedNode)
          queue('children', {
            parent_id: nodeID(mutation.target),
            removed_ids: Array.from(mutation.removedNodes).map(nodeID),
            added: added.length > 0
              ? { root_ids: added.map(item => item.rootId), html: added.map(item => item.html).join('') }
              : null,
            before_id: mutation.nextSibling ? nodeID(mutation.nextSibling) : null,
          })
        }
        catch {
          enabled = false
        }
      }
    }
  })
  observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeOldValue: true })
  const onClick = (event: MouseEvent) => {
    const target = event.target instanceof Node ? event.target : null
    queue('click', {
      target_id: target ? nodeID(target) : null,
      x: ratio(event.clientX, innerWidth),
      y: ratio(event.clientY, innerHeight),
      path: structuralPath(target),
    })
  }
  const onScroll = () => {
    const now = Date.now()
    if (now - lastScrollAt < 250)
      return
    lastScrollAt = now
    queue('scroll', { x: scrollX, y: scrollY })
  }
  const onResize = () => queue('resize', { width: innerWidth, height: innerHeight })
  const onVisibilityChange = () => {
    if (document.visibilityState === 'hidden')
      void flushMutations()
  }
  const onPageHide = () => {
    void flushMutations()
    stopSessionReplay()
  }
  document.addEventListener('click', onClick, true)
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onResize)
  document.addEventListener('visibilitychange', onVisibilityChange)
  window.addEventListener('pagehide', onPageHide, { once: true })
  detachListeners = () => {
    document.removeEventListener('click', onClick, true)
    window.removeEventListener('scroll', onScroll)
    window.removeEventListener('resize', onResize)
    document.removeEventListener('visibilitychange', onVisibilityChange)
    window.removeEventListener('pagehide', onPageHide)
  }
  flushTimer = window.setInterval(() => void flushMutations(), FLUSH_MS)
}
