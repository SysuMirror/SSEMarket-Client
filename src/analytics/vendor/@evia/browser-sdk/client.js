import { boundedInteger, byteLength, copyProperties, customEventPattern, EviaSDKError, requireText, uuidPattern, validateConfig, validateOptions, } from './validation.js';
import { defaultClock, readJSON, retryAfter, Transport, validateReceipt } from './transport.js';
import { verifyConfigSignature } from './config-signature.js';
// pageViewEventKey is the reserved system event used by automatic page
// collection. It is not reachable through the public custom-event emit().
const pageViewEventKey = 'sys.page_view';
// identityLinkEventKey is the reserved system event recorded after a successful
// identify(); uid and anonymous id travel in identity, never in properties.
const identityLinkEventKey = 'sys.identity_link';
// operationFailedEventKey records one sanitized terminal logical-operation failure.
const operationFailedEventKey = 'sys.operation_failed';
const operationErrorCategories = new Set(['validation', 'network', 'timeout', 'http', 'business']);
// sessionEndEventKey records the observable end of a session with a closed reason.
const sessionEndEventKey = 'sys.session_end';
const sessionEndReasons = new Set(['logout', 'account_switch', 'idle']);
// pageScrollEventKey coalesces one scroll segment after scrolling stops.
const pageScrollEventKey = 'sys.page_scroll';
const heatmapClickEventKey = 'sys.heatmap_click';
const encryptedContentEventKey = 'sys.content_chunk';
const maxScrollEventsPerMinute = 12;
const maxHeatmapClicksPerMinute = 120;
const scrollWindowMs = 60_000;
const defaultScrollIdleMs = 1000;
function clamp01(value) {
    if (!Number.isFinite(value))
        return 0;
    return Math.min(1, Math.max(0, value));
}
function round4(value) {
    return Math.round(value * 10_000) / 10_000;
}
// defaultScrollHost adapts the browser window/document; absent globals (SSR)
// yield null so collection simply does not start.
function defaultScrollHost() {
    if (typeof window === 'undefined' || typeof document === 'undefined')
        return null;
    return {
        subscribe: (listener) => {
            window.addEventListener('scroll', listener, { passive: true });
            return () => window.removeEventListener('scroll', listener);
        },
        ratio: () => {
            const doc = document.documentElement;
            const span = doc.scrollHeight - window.innerHeight;
            return span <= 0 ? 0 : clamp01(window.scrollY / span);
        },
    };
}
const clickableSelector = 'a,button,input,select,textarea,[role="button"],[role="link"],[data-evia-heatmap]';
function elementSegment(element) {
    const tag = element.localName.toLowerCase();
    const role = element.getAttribute('role');
    const safeRole = role && /^[a-z-]{1,24}$/.test(role) ? `[role=${role}]` : '';
    const siblings = element.parentElement
        ? [...element.parentElement.children].filter((candidate) => candidate.localName === element.localName)
        : [element];
    const index = Math.max(0, siblings.indexOf(element));
    return { segment: `${tag}${safeRole}:nth-of-type(${index + 1})`, index };
}
// structuralElementPath deliberately excludes text, id, class, href, input
// values and arbitrary attributes. The path is useful for grouping repeated
// clicks without collecting page content.
function structuralElementPath(element) {
    const parts = [];
    const target = element.closest(clickableSelector) ?? element;
    const targetSegment = elementSegment(target);
    let current = target;
    for (let depth = 0; current && depth < 4; depth++) {
        parts.unshift(elementSegment(current).segment);
        current = current.parentElement;
        if (current?.localName === 'body') {
            parts.unshift('body:nth-of-type(1)');
            break;
        }
    }
    return { path: parts.join('>').slice(0, 128), index: Math.min(255, targetSegment.index) };
}
function defaultHeatmapHost() {
    if (typeof window === 'undefined' || typeof document === 'undefined')
        return null;
    return {
        subscribe: (listener) => {
            const handle = (event) => {
                if (!(event.target instanceof Element))
                    return;
                const viewportWidth = Math.max(1, Math.min(65535, Math.round(window.innerWidth)));
                const viewportHeight = Math.max(1, Math.min(65535, Math.round(window.innerHeight)));
                let x = event.clientX;
                let y = event.clientY;
                // Keyboard-generated click events have no pointer coordinates; use the
                // activated element's center rather than grouping them at (0,0).
                if (event.detail === 0 && x === 0 && y === 0) {
                    const rect = event.target.getBoundingClientRect();
                    x = rect.left + rect.width / 2;
                    y = rect.top + rect.height / 2;
                }
                const structural = structuralElementPath(event.target);
                listener({
                    xRatio: round4(clamp01(x / viewportWidth)),
                    yRatio: round4(clamp01(y / viewportHeight)),
                    viewportWidth,
                    viewportHeight,
                    elementPath: structural.path,
                    elementIndex: structural.index,
                });
            };
            document.addEventListener('click', handle, true);
            return () => document.removeEventListener('click', handle, true);
        },
    };
}
// Snapshot format for the opt-in durable queue mirror. Only serializable
// entry fields are stored; the per-emission settle promise belongs to the
// originating page and cannot survive a reload.
const queueSnapshotFormat = 'evia.queue.v1';
function isPersistedQueue(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    const candidate = value;
    return candidate.format === queueSnapshotFormat && Array.isArray(candidate.entries);
}
function isPersistedEntry(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    const candidate = value;
    return (typeof candidate.eventId === 'string' &&
        uuidPattern.test(candidate.eventId) &&
        typeof candidate.draft === 'object' &&
        candidate.draft !== null &&
        typeof candidate.createdAt === 'number' &&
        Number.isFinite(candidate.createdAt) &&
        typeof candidate.bytes === 'number' &&
        candidate.bytes > 0 &&
        typeof candidate.attempts === 'number' &&
        Number.isSafeInteger(candidate.attempts) &&
        candidate.attempts >= 0 &&
        typeof candidate.ambiguous === 'boolean' &&
        (candidate.retryCode === undefined ||
            (typeof candidate.retryCode === 'string' &&
                candidate.retryCode.length <= 128 &&
                /^[A-Z][A-Z0-9_]+$/.test(candidate.retryCode))) &&
        (candidate.retryReceiptId === undefined ||
            (typeof candidate.retryReceiptId === 'string' &&
                uuidPattern.test(candidate.retryReceiptId))) &&
        (candidate.json === undefined || typeof candidate.json === 'string'));
}
function storageDefault() {
    try {
        return typeof localStorage === 'undefined' ? null : localStorage;
    }
    catch {
        return null;
    }
}
// The session scope must stay isolated per tab: a shared port would let two
// live tabs emit colliding sequences into one session and break journey
// ordering, so continuity deliberately defaults to sessionStorage.
function sessionStorageDefault() {
    try {
        return typeof sessionStorage === 'undefined' ? null : sessionStorage;
    }
    catch {
        return null;
    }
}
const sessionSnapshotFormat = 'evia.session.v1';
function isPersistedSession(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    const candidate = value;
    return (candidate.format === sessionSnapshotFormat &&
        typeof candidate.session_id === 'string' &&
        uuidPattern.test(candidate.session_id) &&
        typeof candidate.tab_id === 'string' &&
        uuidPattern.test(candidate.tab_id) &&
        typeof candidate.sequence === 'number' &&
        Number.isInteger(candidate.sequence) &&
        candidate.sequence >= 0 &&
        candidate.sequence <= Number.MAX_SAFE_INTEGER &&
        typeof candidate.last_activity === 'number' &&
        Number.isFinite(candidate.last_activity));
}
function freezeConfig(config) {
    const pending = [{ value: config, depth: 0 }];
    while (pending.length) {
        const { value, depth } = pending.pop();
        if (depth > 64)
            throw new EviaSDKError('CONFIG_TOO_DEEP');
        for (const child of Object.values(value))
            if (child !== null && typeof child === 'object')
                pending.push({ value: child, depth: depth + 1 });
        Object.freeze(value);
    }
    return config;
}
const maxFixed600CiphertextLength = 1024;
// A 4096-byte padded block plus the 16-byte GCM tag encodes to 5483
// unpadded base64url characters. The complete envelope remains capped at 8 KiB.
const maxFixed4096CiphertextLength = 5483;
function encryptedContentProperties(chunk) {
    if (chunk === null || typeof chunk !== 'object')
        throw new EviaSDKError('INVALID_ENCRYPTED_CONTENT_CHUNK');
    for (const [value, bound] of [
        [chunk.contentType, 64],
        [chunk.streamId, 128],
        [chunk.itemId, 128],
        [chunk.actorType, 32],
        [chunk.keyId, 64],
    ])
        requireText(value, bound, true);
    const encoded = /^[A-Za-z0-9_-]+$/;
    const ciphertextLimit = chunk.padding === 'fixed-600-v1'
        ? maxFixed600CiphertextLength
        : chunk.padding === 'fixed-4096-v2'
            ? maxFixed4096CiphertextLength
            : 0;
    if (!Number.isInteger(chunk.chunkIndex) ||
        !Number.isInteger(chunk.chunkCount) ||
        chunk.chunkCount < 1 ||
        chunk.chunkCount > 32 ||
        chunk.chunkIndex < 0 ||
        chunk.chunkIndex >= chunk.chunkCount ||
        ciphertextLimit === 0 ||
        !encoded.test(chunk.ciphertext) ||
        chunk.ciphertext.length > ciphertextLimit ||
        !encoded.test(chunk.nonce) ||
        chunk.nonce.length > 64 ||
        !encoded.test(chunk.wrappedKey) ||
        chunk.wrappedKey.length > 1024 ||
        chunk.alg !== 'A256GCM+RSA-OAEP-256' ||
        chunk.aadVersion !== 'evia-content-v1' ||
        !Number.isInteger(chunk.contentLength) ||
        chunk.contentLength < 1 ||
        chunk.contentLength > 1_000_000 ||
        typeof chunk.truncated !== 'boolean' ||
        (chunk.status !== undefined &&
            (typeof chunk.status !== 'string' || chunk.status.length > 32)) ||
        (chunk.durationMs !== undefined &&
            (!Number.isInteger(chunk.durationMs) || chunk.durationMs < 0 || chunk.durationMs > 3_600_000)))
        throw new EviaSDKError('INVALID_ENCRYPTED_CONTENT_CHUNK');
    const properties = {
        content_type: chunk.contentType,
        stream_id: chunk.streamId,
        item_id: chunk.itemId,
        actor_type: chunk.actorType,
        chunk_index: chunk.chunkIndex,
        chunk_count: chunk.chunkCount,
        ciphertext: chunk.ciphertext,
        nonce: chunk.nonce,
        wrapped_key: chunk.wrappedKey,
        key_id: chunk.keyId,
        alg: chunk.alg,
        aad_version: chunk.aadVersion,
        padding: chunk.padding,
        content_length: chunk.contentLength,
        truncated: chunk.truncated,
    };
    if (chunk.status)
        properties.status = chunk.status;
    if (chunk.durationMs !== undefined)
        properties.duration_ms = chunk.durationMs;
    return Object.freeze(properties);
}
export function createEviaClient(options) {
    return new Client(options);
}
class Client {
    endpoint;
    writeKey;
    projectId;
    environment;
    clock;
    transport;
    uuid;
    storage;
    storageKey;
    persistQueue;
    queueStorageKey;
    persistSession;
    sessionStorage;
    sessionStorageKey;
    configTtl;
    configSigningKeyID;
    configSigningPublicJWK;
    flushInterval;
    retryBase;
    maxAttempts;
    maxAge;
    maxQueueEvents;
    maxQueueBytes;
    maxBatchEvents;
    maxBatchBytes;
    sessionTimeout;
    autoPageViews;
    autoIdentityLink;
    autoSessionEnd;
    enabled = true;
    destroyed = false;
    generation = 0;
    config;
    configExpires = 0;
    etag;
    configFlight;
    flushFlight;
    timer;
    timerAt = Infinity;
    nextAttempt = 0;
    queue = [];
    queueBytes = 0;
    batch;
    ownedEmissions = new WeakSet();
    uid;
    anonymousId;
    tabId;
    sessionId;
    lastActivity;
    sequence = 0;
    page;
    cleanup = [];
    autoPageScrolls;
    scrollHost;
    scrollIdleMs;
    autoHeatmapClicks;
    heatmapHost;
    scrollTimer;
    scrollActive = false;
    scrollFrom = 0;
    scrollLast = 0;
    scrollTo = 0;
    scrollMax = 0;
    scrollSawUp = false;
    scrollSawDown = false;
    scrollStartedAt = 0;
    scrollEmittedAt = [];
    heatmapEmittedAt = [];
    constructor(options) {
        this.endpoint = validateOptions(options);
        this.writeKey = options.writeKey;
        this.projectId = options.projectId.toLowerCase();
        this.environment = options.environment;
        this.clock = options.clock ?? defaultClock;
        const fetcher = options.fetch ?? globalThis.fetch?.bind(globalThis);
        if (!fetcher)
            throw new EviaSDKError('FETCH_UNAVAILABLE');
        this.transport = new Transport(fetcher, this.clock, boundedInteger(options.requestTimeoutMs, 5000, 10, 30000));
        this.uuid = () => {
            const id = options.randomUUID?.() ?? globalThis.crypto?.randomUUID();
            if (!id || !uuidPattern.test(id))
                throw new EviaSDKError('SECURE_UUID_UNAVAILABLE');
            return id.toLowerCase();
        };
        this.configTtl = boundedInteger(options.configTtlMs, 30000, 1000, 60000);
        this.configSigningKeyID = options.configSigningKeyId;
        this.configSigningPublicJWK = options.configSigningPublicJWK;
        if ((this.configSigningKeyID === undefined) !== (this.configSigningPublicJWK === undefined))
            throw new EviaSDKError('INVALID_CONFIG_SIGNING_KEY');
        this.flushInterval = boundedInteger(options.flushIntervalMs, 1000, 10, 10000);
        this.retryBase = boundedInteger(options.retryBaseMs, 1000, 10, 60000);
        this.maxAttempts = boundedInteger(options.maxAttempts, 3, 1, 5);
        this.maxAge = boundedInteger(options.maxAgeMs, 5 * 60 * 1000, 1000, 55 * 60 * 1000);
        this.maxQueueEvents = boundedInteger(options.maxQueueEvents, 200, 1, 1000);
        this.maxQueueBytes = boundedInteger(options.maxQueueBytes, 256 * 1024, 8192, 1024 * 1024);
        this.maxBatchEvents = boundedInteger(options.maxBatchEvents, 20, 1, 50);
        this.maxBatchBytes = boundedInteger(options.maxBatchBytes, 60 * 1024, 10 * 1024, 60 * 1024);
        this.sessionTimeout = boundedInteger(options.sessionTimeoutMs, 30 * 60 * 1000, 60000, 24 * 60 * 60 * 1000);
        this.autoPageViews = options.autoPageViews === true;
        this.autoIdentityLink = options.autoIdentityLink === true;
        this.autoSessionEnd = options.autoSessionEnd === true;
        this.autoPageScrolls = options.autoPageScrolls === true;
        this.autoHeatmapClicks = options.autoHeatmapClicks === true;
        this.scrollIdleMs = boundedInteger(options.scrollIdleMs ?? defaultScrollIdleMs, 5000, 100, 10000);
        this.scrollHost = options.scrollHost ?? defaultScrollHost();
        this.heatmapHost = options.heatmapHost ?? defaultHeatmapHost();
        this.storage = options.storage === undefined ? storageDefault() : options.storage;
        this.storageKey = `evia:${this.projectId}:${this.environment}:${this.writeKey}:anonymous`;
        this.persistQueue = options.persistQueue === true;
        this.queueStorageKey = `evia:${this.projectId}:${this.environment}:${this.writeKey}:queue`;
        this.persistSession = options.persistSession === true;
        this.sessionStorage =
            options.sessionStorage === undefined ? sessionStorageDefault() : options.sessionStorage;
        if (this.persistSession && !this.sessionStorage)
            throw new EviaSDKError('SESSION_STORAGE_UNAVAILABLE');
        this.sessionStorageKey = `evia:${this.projectId}:${this.environment}:${this.writeKey}:session`;
        let stored = null;
        try {
            stored = this.storage?.getItem(this.storageKey) ?? null;
        }
        catch {
            /* memory fallback */
        }
        this.anonymousId = stored && uuidPattern.test(stored) ? stored : this.uuid();
        this.persistAnonymous();
        const scope = this.restoreSessionScope();
        this.tabId = scope?.tab_id ?? this.uuid();
        this.sessionId = scope?.session_id ?? this.uuid();
        this.sequence = scope?.sequence ?? 0;
        this.lastActivity = scope?.last_activity ?? this.clock.now();
        this.persistSessionState();
        this.page = this.newPage({ navigationType: 'initial' });
        if (options.lifecycle !== false &&
            typeof document !== 'undefined' &&
            typeof window !== 'undefined') {
            const hidden = () => {
                if (document.visibilityState === 'hidden')
                    void this.flush({ keepalive: true });
            };
            const pagehide = () => {
                void this.flush({ keepalive: true });
            };
            document.addEventListener('visibilitychange', hidden);
            window.addEventListener('pagehide', pagehide);
            this.cleanup.push(() => document.removeEventListener('visibilitychange', hidden), () => window.removeEventListener('pagehide', pagehide));
        }
        if (this.autoPageViews)
            this.emitAutoPageView();
        this.startScrollCollection();
        this.startHeatmapCollection();
        this.rehydrateQueue();
        if (this.persistQueue && this.queue.length) {
            // Rehydrated events outlive their emitting page; drive config resolution
            // and delivery even though no caller still holds the outcome promise.
            void this.init()
                .then(() => this.resolveQueuedEntries())
                .catch(() => { });
        }
    }
    get pending() {
        return this.queue.length;
    }
    assertEnabled() {
        if (this.destroyed)
            throw new EviaSDKError('CLIENT_DESTROYED');
        if (!this.enabled)
            throw new EviaSDKError('CLIENT_DISABLED');
    }
    persistAnonymous() {
        try {
            this.storage?.setItem(this.storageKey, this.anonymousId);
        }
        catch {
            /* memory fallback */
        }
    }
    // restoreSessionScope reloads the tab-scoped session snapshot written by a
    // previous document in this tab. The snapshot is restored verbatim — the
    // idle-timeout rotation stays lazy in touchSession(), so the first activity
    // after a long absence observes the same idle end + rotation as the live
    // in-memory path. Malformed or foreign snapshots fail soft to a fresh scope.
    restoreSessionScope() {
        if (!this.persistSession || !this.sessionStorage)
            return null;
        let raw = null;
        try {
            raw = this.sessionStorage.getItem(this.sessionStorageKey);
        }
        catch {
            return null;
        }
        if (!raw)
            return null;
        let parsed;
        try {
            parsed = JSON.parse(raw);
        }
        catch {
            return null;
        }
        return isPersistedSession(parsed) ? parsed : null;
    }
    // persistSessionState mirrors the mutable session scope onto the tab-scoped
    // port. It is write-through and fail-soft like the queue mirror: a storage
    // error degrades this reload's continuity but never breaks collection.
    persistSessionState() {
        if (!this.persistSession || !this.sessionStorage)
            return;
        try {
            const snapshot = {
                format: sessionSnapshotFormat,
                session_id: this.sessionId,
                tab_id: this.tabId,
                sequence: this.sequence,
                last_activity: this.lastActivity,
            };
            this.sessionStorage.setItem(this.sessionStorageKey, JSON.stringify(snapshot));
        }
        catch {
            /* memory fallback: continuity resumes on the next successful write */
        }
    }
    // persistQueueState mirrors the bounded in-memory queue onto the storage
    // port. It is write-through and fail-soft: any storage error keeps the
    // memory queue working instead of breaking collection.
    persistQueueState() {
        if (!this.persistQueue || !this.storage)
            return;
        try {
            const snapshot = {
                format: queueSnapshotFormat,
                entries: this.queue.map((entry) => {
                    const persisted = {
                        eventId: entry.eventId,
                        draft: entry.draft,
                        createdAt: entry.createdAt,
                        bytes: entry.bytes,
                        attempts: entry.attempts,
                        ambiguous: entry.ambiguous,
                    };
                    if (entry.retryCode !== undefined)
                        persisted.retryCode = entry.retryCode;
                    if (entry.retryReceiptId !== undefined)
                        persisted.retryReceiptId = entry.retryReceiptId;
                    if (entry.json !== undefined)
                        persisted.json = entry.json;
                    return persisted;
                }),
            };
            this.storage.setItem(this.queueStorageKey, JSON.stringify(snapshot));
        }
        catch {
            /* memory fallback: keep serving from the in-memory queue */
        }
    }
    // rehydrateQueue reloads a durable snapshot written by a previous page load.
    // Expired, malformed or over-budget entries are pruned; surviving entries
    // keep their original event_id so collector-side dedup makes redelivery safe.
    rehydrateQueue() {
        if (!this.persistQueue || !this.storage)
            return;
        let raw = null;
        try {
            raw = this.storage.getItem(this.queueStorageKey);
        }
        catch {
            return;
        }
        if (!raw)
            return;
        let snapshot;
        try {
            snapshot = JSON.parse(raw);
        }
        catch {
            return; // corrupt snapshot: fail soft and start from an empty queue
        }
        if (!isPersistedQueue(snapshot))
            return;
        const now = this.clock.now();
        for (const item of snapshot.entries) {
            if (!isPersistedEntry(item))
                continue;
            if (now - item.createdAt >= this.maxAge)
                continue;
            if (item.bytes > 8192 || this.queue.length >= this.maxQueueEvents)
                continue;
            if (this.queueBytes + item.bytes > this.maxQueueBytes)
                continue;
            this.queue.push({
                eventId: item.eventId,
                draft: item.draft,
                createdAt: item.createdAt,
                bytes: item.bytes,
                attempts: item.attempts,
                ambiguous: item.ambiguous,
                retryCode: item.retryCode,
                retryReceiptId: item.retryReceiptId,
                json: item.json,
                // The original emitter no longer exists after a reload; the outcome is
                // observable only through delivery and the collector receipt.
                settle: () => { },
            });
            this.queueBytes += item.bytes;
        }
        // Write back the pruned snapshot so rejected data is not retried forever.
        this.persistQueueState();
    }
    // resolveQueuedEntries fills the final envelope JSON for entries still
    // waiting on configuration, including those rehydrated without a ready
    // payload. Unpublished events fail closed; ready entries schedule a flush.
    resolveQueuedEntries() {
        if (!this.config)
            return;
        let changed = false;
        for (const entry of [...this.queue]) {
            if (entry.json)
                continue;
            const event = this.config.events.find((candidate) => candidate.event_key === entry.draft.event_key);
            if (!event) {
                this.finish(entry, 'rejected', 'EVENT_NOT_PUBLISHED', false);
                changed = true;
                continue;
            }
            entry.json = JSON.stringify({
                ...entry.draft,
                schema_version: event.schema_version,
                release_revision: this.config.release_revision,
            });
            changed = true;
        }
        if (changed) {
            this.persistQueueState();
            this.schedule(this.flushInterval);
        }
    }
    init() {
        return this.loadConfig(false);
    }
    refreshConfig() {
        return this.loadConfig(true);
    }
    loadConfig(force) {
        try {
            this.assertEnabled();
        }
        catch (error) {
            return Promise.reject(error);
        }
        if (this.configFlight)
            return this.configFlight;
        if (!force && this.config && this.configExpires > this.clock.now())
            return Promise.resolve(this.config);
        const generation = this.generation;
        const url = new URL(`${this.endpoint}/v1/config`);
        url.searchParams.set('write_key', this.writeKey);
        if (this.config)
            url.searchParams.set('current_release_revision', String(this.config.release_revision));
        const headers = {};
        if (this.etag)
            headers['If-None-Match'] = this.etag;
        let flight;
        flight = this.transport
            .request(url.href, { method: 'GET', headers }, async (response) => {
            if (response.status === 304 && this.config)
                return { config: this.config, etag: this.etag };
            if (response.status !== 200) {
                void response.body?.cancel().catch(() => { });
                throw new EviaSDKError(`CONFIG_HTTP_${response.status}`);
            }
            const config = validateConfig(await readJSON(response, 1024 * 1024), this.projectId, this.environment);
            await verifyConfigSignature(config, this.configSigningKeyID, this.configSigningPublicJWK);
            return {
                config: freezeConfig(config),
                etag: response.headers.get('ETag') ?? undefined,
            };
        })
            .then(({ config, etag }) => {
            if (generation !== this.generation || !this.enabled)
                throw new EviaSDKError('REQUEST_ABORTED');
            if (this.config && config.release_revision < this.config.release_revision)
                throw new EviaSDKError('CONFIG_REVISION_REGRESSION');
            this.config = config;
            this.etag = etag && /^"[a-f0-9]{64}"$/.test(etag) ? etag : undefined;
            this.configExpires = this.clock.now() + this.configTtl;
            this.resolveQueuedEntries();
            return config;
        })
            .catch((error) => {
            if (generation === this.generation)
                this.configExpires = 0;
            throw error;
        })
            .finally(() => {
            if (this.configFlight === flight)
                this.configFlight = undefined;
        });
        this.configFlight = flight;
        return flight;
    }
    emit(eventKey, properties = {}, options = {}) {
        this.assertEnabled();
        if (typeof eventKey !== 'string' || !customEventPattern.test(eventKey))
            throw new EviaSDKError('INVALID_CUSTOM_EVENT_KEY');
        return this.enqueue(eventKey, properties, options);
    }
    // emitEncryptedContentChunk is the only public path to the generic reserved
    // content envelope. Callers supply already-encrypted bytes and safe metadata;
    // the strict shape prevents arbitrary sys.* forgery or business semantics
    // from leaking into the platform event contract.
    emitEncryptedContentChunk(chunk) {
        this.assertEnabled();
        return this.enqueue(encryptedContentEventKey, encryptedContentProperties(chunk), {}, true);
    }
    // emitEncryptedContentChunks validates and reserves the complete list before
    // mutating the queue. This all-or-none admission avoids losing a suffix when a
    // high-volume producer reaches either queue bound partway through a loop.
    emitEncryptedContentChunks(chunks) {
        this.assertEnabled();
        if (!Array.isArray(chunks) || chunks.length < 1 || chunks.length > this.maxQueueEvents)
            throw new EviaSDKError('INVALID_BULK_SIZE');
        for (let index = 0; index < chunks.length; index++)
            if (!Object.prototype.hasOwnProperty.call(chunks, index))
                throw new EviaSDKError('INVALID_BULK_SIZE');
        const properties = chunks.map((chunk) => encryptedContentProperties(chunk));
        const createdAt = this.clock.now();
        const rotatesSession = createdAt - this.lastActivity >= this.sessionTimeout || createdAt < this.lastActivity;
        const automaticEntries = rotatesSession && this.autoSessionEnd ? 1 : 0;
        if (this.queue.length + properties.length + automaticEntries > this.maxQueueEvents)
            throw new EviaSDKError('QUEUE_FULL');
        if (this.sequence > Number.MAX_SAFE_INTEGER - properties.length - automaticEntries)
            throw new EviaSDKError('SEQUENCE_EXHAUSTED');
        // Reserve before touchSession(), whose optional idle session-end emission is
        // observable. UUIDs have fixed width and an idle rotation only shortens page
        // context, so this maximum-sequence envelope is a conservative byte preflight.
        let preflightBytes = automaticEntries
            ? byteLength(JSON.stringify({
                event_id: '00000000-0000-4000-8000-000000000000',
                event_key: sessionEndEventKey,
                occurred_at: new Date(createdAt).toISOString(),
                identity: {
                    anonymous_id: this.anonymousId,
                    ...(this.uid === undefined ? {} : { uid: this.uid }),
                },
                context: { ...this.page, sequence: Number.MAX_SAFE_INTEGER },
                sdk: { name: 'evia-browser', version: '0.1.0' },
                properties: { reason: 'idle' },
                schema_version: Number.MAX_SAFE_INTEGER,
                release_revision: Number.MAX_SAFE_INTEGER,
            }))
            : 0;
        for (const item of properties) {
            const bytes = byteLength(JSON.stringify({
                event_id: '00000000-0000-4000-8000-000000000000',
                event_key: encryptedContentEventKey,
                occurred_at: new Date(createdAt).toISOString(),
                identity: {
                    anonymous_id: this.anonymousId,
                    ...(this.uid === undefined ? {} : { uid: this.uid }),
                },
                context: { ...this.page, sequence: Number.MAX_SAFE_INTEGER },
                sdk: { name: 'evia-browser', version: '0.1.0' },
                properties: item,
                schema_version: Number.MAX_SAFE_INTEGER,
                release_revision: Number.MAX_SAFE_INTEGER,
            }));
            if (bytes > 8192)
                throw new EviaSDKError('EVENT_TOO_LARGE');
            preflightBytes += bytes;
        }
        if (this.queueBytes + preflightBytes > this.maxQueueBytes)
            throw new EviaSDKError('QUEUE_FULL');
        this.touchSession();
        const entries = [];
        const emissions = [];
        let addedBytes = 0;
        for (let index = 0; index < properties.length; index++) {
            const eventId = this.uuid();
            const draft = {
                event_id: eventId,
                event_key: encryptedContentEventKey,
                occurred_at: new Date(createdAt).toISOString(),
                identity: {
                    anonymous_id: this.anonymousId,
                    ...(this.uid === undefined ? {} : { uid: this.uid }),
                },
                context: { ...this.page, sequence: this.sequence + index + 1 },
                sdk: { name: 'evia-browser', version: '0.1.0' },
                properties: properties[index],
            };
            const bytes = byteLength(JSON.stringify({
                ...draft,
                schema_version: Number.MAX_SAFE_INTEGER,
                release_revision: Number.MAX_SAFE_INTEGER,
            }));
            if (bytes > 8192)
                throw new EviaSDKError('EVENT_TOO_LARGE');
            addedBytes += bytes;
            if (this.queueBytes + addedBytes > this.maxQueueBytes)
                throw new EviaSDKError('QUEUE_FULL');
            let settle;
            const result = new Promise((resolve) => {
                settle = resolve;
            });
            entries.push({
                eventId,
                draft,
                createdAt,
                bytes,
                attempts: 0,
                ambiguous: false,
                settle,
            });
            const emission = Object.freeze({ eventId, result });
            this.ownedEmissions.add(emission);
            emissions.push(emission);
        }
        this.sequence += entries.length;
        this.persistSessionState();
        this.queue.push(...entries);
        this.queueBytes += addedBytes;
        this.persistQueueState();
        this.schedule(this.maxAge);
        const generation = this.generation;
        void this.init()
            .then(() => {
            if (generation !== this.generation || !this.enabled)
                return;
            this.resolveQueuedEntries();
        })
            .catch((error) => {
            if (generation !== this.generation)
                return;
            for (const entry of entries)
                if (this.queue.includes(entry))
                    this.finish(entry, 'dropped', error instanceof EviaSDKError ? error.code : 'CONFIG_UNAVAILABLE', true);
        });
        return Object.freeze(emissions);
    }
    // reportOperationFailure enqueues one reserved sys.operation_failed event. The
    // payload is rebuilt from bounded, validated fields rather than spread from the
    // caller object, so arbitrary data, raw exceptions and request bodies can never
    // enter the event (the schema sets additionalProperties=false).
    reportOperationFailure(failure) {
        this.assertEnabled();
        if (failure === null || typeof failure !== 'object')
            throw new EviaSDKError('INVALID_OPERATION_FAILURE');
        requireText(failure.operation, 128, true);
        if (!operationErrorCategories.has(failure.errorCategory))
            throw new EviaSDKError('INVALID_ERROR_CATEGORY');
        if (typeof failure.retryable !== 'boolean')
            throw new EviaSDKError('INVALID_RETRYABLE');
        const properties = {
            operation: failure.operation,
            error_category: failure.errorCategory,
            retryable: failure.retryable,
        };
        if (failure.errorCode !== undefined) {
            requireText(failure.errorCode, 128, true);
            properties.error_code = failure.errorCode;
        }
        return this.enqueue(operationFailedEventKey, properties, {});
    }
    // enqueue builds and queues one envelope. Public callers validate the custom
    // event key in emit(); automatic collection passes the reserved sys.* key.
    enqueue(eventKey, properties, options, prepared = false) {
        this.assertEnabled();
        if (this.queue.length >= this.maxQueueEvents)
            throw new EviaSDKError('QUEUE_FULL');
        // Reserved encrypted content is rebuilt, bounded and frozen by
        // encryptedContentProperties; custom properties retain the generic 1024-char copy gate.
        const copied = prepared ? properties : copyProperties(properties);
        if (options.operationId !== undefined)
            requireText(options.operationId, 128, true);
        if (this.sequence >= Number.MAX_SAFE_INTEGER)
            throw new EviaSDKError('SEQUENCE_EXHAUSTED');
        this.touchSession();
        if (options.navigation)
            this.checkLink(options.navigation);
        const eventId = this.uuid();
        const draft = {
            event_id: eventId,
            event_key: eventKey,
            occurred_at: new Date(this.clock.now()).toISOString(),
            identity: {
                anonymous_id: this.anonymousId,
                ...(this.uid === undefined ? {} : { uid: this.uid }),
            },
            context: {
                ...this.page,
                sequence: ++this.sequence,
                ...(options.operationId === undefined ? {} : { operation_id: options.operationId }),
                ...(options.navigation ? { navigation_id: options.navigation.navigationId } : {}),
            },
            sdk: { name: 'evia-browser', version: '0.1.0' },
            properties: copied,
        };
        // The sequence has advanced past this point even if size checks reject
        // the event, so the mirror reflects the same monotonic truth as memory.
        this.persistSessionState();
        const reserved = byteLength(JSON.stringify({
            ...draft,
            schema_version: Number.MAX_SAFE_INTEGER,
            release_revision: Number.MAX_SAFE_INTEGER,
        }));
        if (reserved > 8192)
            throw new EviaSDKError('EVENT_TOO_LARGE');
        if (this.queueBytes + reserved > this.maxQueueBytes)
            throw new EviaSDKError('QUEUE_FULL');
        let settle;
        const result = new Promise((resolve) => {
            settle = resolve;
        });
        const entry = {
            eventId,
            draft,
            createdAt: this.clock.now(),
            bytes: reserved,
            attempts: 0,
            ambiguous: false,
            settle,
        };
        this.queue.push(entry);
        this.queueBytes += reserved;
        this.persistQueueState();
        this.schedule(this.maxAge);
        const generation = this.generation;
        void this.init()
            .then(() => {
            if (generation !== this.generation || !this.enabled || !this.queue.includes(entry))
                return;
            this.resolveQueuedEntries();
        })
            .catch((error) => {
            if (generation === this.generation && this.queue.includes(entry))
                this.finish(entry, 'dropped', error instanceof EviaSDKError ? error.code : 'CONFIG_UNAVAILABLE', true);
        });
        const emission = Object.freeze({ eventId, result });
        this.ownedEmissions.add(emission);
        return emission;
    }
    identify(uid) {
        this.assertEnabled();
        requireText(uid, 128, true);
        if (uid.includes('\0'))
            throw new EviaSDKError('INVALID_UID');
        // A different established uid is an account switch: close the prior account's
        // session before the identity changes, so the event keeps the old uid context.
        const switching = this.uid !== undefined && this.uid !== uid;
        if (switching)
            this.emitSessionEnd('account_switch');
        // Assign before enqueue so the identity-link envelope carries the new uid
        // together with the anonymous id, exactly as the contract fixture specifies.
        this.uid = uid;
        this.emitIdentityLink();
    }
    reset() {
        this.assertEnabled();
        this.discardScrollSegment();
        // Explicit identity clear is an observable logout of the ending session;
        // emit before rotating so the event keeps the prior session/identity context.
        this.emitSessionEnd('logout');
        this.uid = undefined;
        this.anonymousId = this.uuid();
        this.persistAnonymous();
        this.sessionId = this.uuid();
        this.lastActivity = this.clock.now();
        this.page = this.newPage({ navigationType: 'initial' });
        this.persistSessionState();
        this.emitAutoPageView();
    }
    touchSession() {
        const now = this.clock.now();
        if (now - this.lastActivity >= this.sessionTimeout || now < this.lastActivity) {
            // Refresh activity before emitting so the nested enqueue's touchSession
            // cannot re-enter this idle branch. The event is enqueued before rotation
            // so it still captures the ending session, while the outer event that
            // triggered the timeout captures the new session.
            this.lastActivity = now;
            this.emitSessionEnd('idle');
            this.sessionId = this.uuid();
            this.page = this.newPage({
                navigationType: 'initial',
                routeName: this.page.route_name,
                routeTemplate: this.page.route_template,
                sourceModule: this.page.source_module,
            });
        }
        this.lastActivity = now;
        this.persistSessionState();
    }
    checkLink(link) {
        if (!uuidPattern.test(link.navigationId) || link.sourcePageViewId !== this.page.page_view_id)
            throw new EviaSDKError('INVALID_NAVIGATION_LINK');
    }
    beginNavigation() {
        this.assertEnabled();
        this.touchSession();
        return Object.freeze({ navigationId: this.uuid(), sourcePageViewId: this.page.page_view_id });
    }
    newPage(options, previous) {
        for (const [value, bound] of [
            [options.routeName, 128],
            [options.routeTemplate, 256],
            [options.sourceModule, 64],
        ])
            if (value !== undefined)
                requireText(value, bound);
        if (options.navigationType !== undefined &&
            !['initial', 'push', 'replace', 'pop', 'restore'].includes(options.navigationType))
            throw new EviaSDKError('INVALID_NAVIGATION_TYPE');
        return Object.freeze({
            session_id: this.sessionId,
            tab_id: this.tabId,
            page_view_id: this.uuid(),
            navigation_id: options.link?.navigationId ?? this.uuid(),
            navigation_type: options.navigationType ?? 'push',
            ...(previous
                ? {
                    previous_page_view_id: previous,
                    source_page_view_id: options.link?.sourcePageViewId ?? previous,
                }
                : {}),
            ...(options.routeName === undefined ? {} : { route_name: options.routeName }),
            ...(options.routeTemplate === undefined ? {} : { route_template: options.routeTemplate }),
            ...(options.sourceModule === undefined ? {} : { source_module: options.sourceModule }),
        });
    }
    // emitSystemEvent records one reserved sys.* event with empty properties.
    // Backpressure must never break the underlying SDK action (navigation or
    // identify), so a full queue drops the automatic event; an unpublished system
    // event still fails closed via the configuration check (EVENT_NOT_PUBLISHED).
    emitSystemEvent(eventKey, enabled, properties = {}) {
        if (!enabled || this.destroyed || !this.enabled)
            return;
        try {
            this.enqueue(eventKey, properties, {});
        }
        catch (error) {
            if (error instanceof EviaSDKError && error.code === 'QUEUE_FULL')
                return;
            throw error;
        }
    }
    // emitAutoPageView records one reserved sys.page_view for the current page.
    emitAutoPageView() {
        this.emitSystemEvent(pageViewEventKey, this.autoPageViews);
    }
    // emitIdentityLink records one reserved sys.identity_link after identify().
    emitIdentityLink() {
        this.emitSystemEvent(identityLinkEventKey, this.autoIdentityLink);
    }
    // emitSessionEnd records one reserved sys.session_end with a closed reason.
    emitSessionEnd(reason) {
        if (!sessionEndReasons.has(reason))
            throw new EviaSDKError('INVALID_SESSION_END_REASON');
        this.emitSystemEvent(sessionEndEventKey, this.autoSessionEnd, { reason });
    }
    startHeatmapCollection() {
        if (!this.autoHeatmapClicks || !this.heatmapHost)
            return;
        const unsubscribe = this.heatmapHost.subscribe((sample) => {
            if (this.destroyed || !this.enabled)
                return;
            const now = this.clock.now();
            this.heatmapEmittedAt = this.heatmapEmittedAt.filter((at) => now - at < scrollWindowMs);
            if (this.heatmapEmittedAt.length >= maxHeatmapClicksPerMinute)
                return;
            if (!Number.isFinite(sample.xRatio) ||
                !Number.isFinite(sample.yRatio) ||
                !Number.isInteger(sample.viewportWidth) ||
                !Number.isInteger(sample.viewportHeight) ||
                sample.viewportWidth < 1 ||
                sample.viewportWidth > 65535 ||
                sample.viewportHeight < 1 ||
                sample.viewportHeight > 65535 ||
                typeof sample.elementPath !== 'string' ||
                sample.elementPath.length < 1 ||
                sample.elementPath.length > 128)
                return;
            this.heatmapEmittedAt.push(now);
            const properties = {
                x_ratio: round4(clamp01(sample.xRatio)),
                y_ratio: round4(clamp01(sample.yRatio)),
                viewport_width: sample.viewportWidth,
                viewport_height: sample.viewportHeight,
                element_path: sample.elementPath,
            };
            if (sample.elementIndex !== undefined &&
                Number.isInteger(sample.elementIndex) &&
                sample.elementIndex >= 0 &&
                sample.elementIndex <= 255)
                properties.element_index = sample.elementIndex;
            this.emitSystemEvent(heatmapClickEventKey, true, properties);
        });
        this.cleanup.push(unsubscribe);
    }
    startScrollCollection() {
        if (!this.autoPageScrolls || !this.scrollHost)
            return;
        const host = this.scrollHost;
        const unsubscribe = host.subscribe(() => {
            // Automatic collection is best-effort: a misbehaving scroll host must
            // never throw into the host page's event loop or break other listeners.
            try {
                this.handleScroll(host);
            }
            catch {
                /* host failure is swallowed; the SDK keeps functioning */
            }
        });
        this.cleanup.push(unsubscribe);
    }
    handleScroll(host) {
        if (this.destroyed || !this.enabled)
            return;
        const now = this.clock.now();
        const ratio = clamp01(host.ratio());
        if (!this.scrollActive) {
            this.scrollActive = true;
            this.scrollFrom = ratio;
            this.scrollLast = ratio;
            this.scrollTo = ratio;
            this.scrollMax = ratio;
            this.scrollSawUp = false;
            this.scrollSawDown = false;
            this.scrollStartedAt = now;
        }
        else {
            if (ratio > this.scrollLast)
                this.scrollSawDown = true;
            else if (ratio < this.scrollLast)
                this.scrollSawUp = true;
            this.scrollLast = ratio;
            this.scrollTo = ratio;
            if (ratio > this.scrollMax)
                this.scrollMax = ratio;
        }
        if (this.scrollTimer !== undefined)
            this.clock.clearTimeout(this.scrollTimer);
        this.scrollTimer = this.clock.setTimeout(() => this.finalizeScroll(), this.scrollIdleMs);
    }
    finalizeScroll() {
        this.scrollTimer = undefined;
        if (!this.scrollActive)
            return;
        this.scrollActive = false;
        if (this.destroyed || !this.enabled)
            return;
        // No directional movement means there is no meaningful segment to report.
        if (!this.scrollSawUp && !this.scrollSawDown)
            return;
        const now = this.clock.now();
        const cutoff = now - scrollWindowMs;
        this.scrollEmittedAt = this.scrollEmittedAt.filter((at) => at > cutoff);
        // Production is bounded at 12 coalesced segments per minute; excess is dropped.
        if (this.scrollEmittedAt.length >= maxScrollEventsPerMinute)
            return;
        this.scrollEmittedAt.push(now);
        const direction = this.scrollSawUp && this.scrollSawDown ? 'mixed' : this.scrollSawUp ? 'up' : 'down';
        this.emitSystemEvent(pageScrollEventKey, this.autoPageScrolls, {
            from_ratio: round4(this.scrollFrom),
            to_ratio: round4(this.scrollTo),
            max_ratio: round4(this.scrollMax),
            direction,
            duration_ms: Math.max(0, now - this.scrollStartedAt),
        });
    }
    // discardScrollSegment drops an in-flight segment when the page changes, so an
    // unfinished scroll is never attributed to the next page_view.
    discardScrollSegment() {
        if (this.scrollTimer !== undefined) {
            this.clock.clearTimeout(this.scrollTimer);
            this.scrollTimer = undefined;
        }
        this.scrollActive = false;
    }
    navigate(options = {}) {
        this.assertEnabled();
        this.discardScrollSegment();
        this.touchSession();
        if (options.link)
            this.checkLink(options.link);
        this.page = this.newPage(options, this.page.page_view_id);
        this.emitAutoPageView();
        return this.page;
    }
    finish(entry, status, code, retryable, receiptId) {
        const index = this.queue.indexOf(entry);
        if (index < 0)
            return;
        this.queue.splice(index, 1);
        this.queueBytes -= entry.bytes;
        this.persistQueueState();
        if (this.queue.length === 0 && this.timer !== undefined) {
            this.clock.clearTimeout(this.timer);
            this.timer = undefined;
            this.timerAt = Infinity;
        }
        entry.settle(Object.freeze({
            eventId: entry.eventId,
            status,
            attempts: entry.attempts,
            ...(code ? { code } : {}),
            ...(retryable === undefined ? {} : { retryable }),
            ...(receiptId ? { receiptId } : {}),
        }));
    }
    schedule(delay) {
        if (!this.enabled || this.destroyed || this.queue.length === 0)
            return;
        const at = this.clock.now() + Math.max(0, delay);
        if (this.timer !== undefined && this.timerAt <= at)
            return;
        if (this.timer !== undefined)
            this.clock.clearTimeout(this.timer);
        this.timerAt = at;
        this.timer = this.clock.setTimeout(() => {
            this.timer = undefined;
            this.timerAt = Infinity;
            void this.flush();
        }, Math.max(0, delay));
    }
    flush(options = {}) {
        if (!this.enabled || this.destroyed)
            return Promise.resolve({ pending: this.pending });
        if (this.flushFlight)
            return this.flushFlight;
        const generation = this.generation;
        let flight;
        flight = this.drain(generation, options.keepalive === true).finally(() => {
            if (this.flushFlight === flight)
                this.flushFlight = undefined;
            if (generation === this.generation && this.queue.length) {
                const untilExpiry = Math.min(...this.queue.map((entry) => entry.createdAt + this.maxAge - this.clock.now()));
                const untilReady = this.queue.some((entry) => entry.json)
                    ? Math.max(this.flushInterval, this.nextAttempt - this.clock.now())
                    : Infinity;
                this.schedule(Math.min(untilExpiry, untilReady));
            }
        });
        this.flushFlight = flight;
        return flight;
    }
    async drainUntilSettled(emissions, options = {}) {
        if (!Array.isArray(emissions) || emissions.length < 1 || emissions.length > 1000)
            throw new EviaSDKError('INVALID_EMISSIONS');
        const seen = new Set();
        for (const emission of emissions) {
            if (emission === null ||
                typeof emission !== 'object' ||
                !this.ownedEmissions.has(emission) ||
                !uuidPattern.test(emission.eventId) ||
                seen.has(emission.eventId) ||
                !emission.result ||
                typeof emission.result.then !== 'function')
                throw new EviaSDKError('INVALID_EMISSIONS');
            seen.add(emission.eventId);
        }
        const timeout = boundedInteger(options.timeoutMs, this.maxAge, 1, 55 * 60 * 1000);
        const maxRounds = boundedInteger(options.maxRounds, 1024, 1, 4096);
        if (options.signal !== undefined &&
            (typeof options.signal.aborted !== 'boolean' ||
                typeof options.signal.addEventListener !== 'function' ||
                typeof options.signal.removeEventListener !== 'function'))
            throw new EviaSDKError('INVALID_OPTION');
        const deadline = this.clock.now() + timeout;
        const outcomes = Array(emissions.length).fill(undefined);
        let invalidResult;
        let wakeWaiter;
        const observers = emissions.map((emission, index) => emission.result.then((outcome) => {
            if (outcome === null ||
                typeof outcome !== 'object' ||
                outcome.eventId !== emission.eventId ||
                !['accepted', 'rejected', 'dropped', 'uncertain'].includes(outcome.status) ||
                !Number.isSafeInteger(outcome.attempts) ||
                outcome.attempts < 0)
                invalidResult = new EviaSDKError('INVALID_EMISSION_RESULT');
            else
                outcomes[index] = Object.freeze({ ...outcome });
            wakeWaiter?.();
        }, (error) => {
            invalidResult =
                error instanceof Error ? error : new EviaSDKError('INVALID_EMISSION_RESULT');
            wakeWaiter?.();
        }));
        // Every observer handles both fulfillment and rejection, so none can become
        // an unhandled promise when a timeout/cancellation returns before settlement.
        void observers;
        const snapshot = (reason, rounds) => {
            const settled = outcomes.filter((outcome) => outcome !== undefined);
            const pendingEventIds = emissions
                .filter((_, index) => outcomes[index] === undefined)
                .map((emission) => emission.eventId);
            const status = pendingEventIds.length === 0 && settled.every((outcome) => outcome.status === 'accepted')
                ? 'accepted'
                : 'incomplete';
            return Object.freeze({
                status,
                reason,
                rounds,
                outcomes: Object.freeze(settled),
                pendingEventIds: Object.freeze(pendingEventIds),
            });
        };
        const runBounded = (operation) => new Promise((resolve) => {
            let done = false;
            let timer;
            const finish = (result) => {
                if (done)
                    return;
                done = true;
                if (timer !== undefined)
                    this.clock.clearTimeout(timer);
                options.signal?.removeEventListener('abort', abort);
                resolve(result);
            };
            const abort = () => finish('aborted');
            if (options.signal?.aborted) {
                finish('aborted');
                return;
            }
            options.signal?.addEventListener('abort', abort, { once: true });
            timer = this.clock.setTimeout(() => finish('deadline'), Math.max(0, deadline - this.clock.now()));
            void operation.then(() => finish('completed'), () => finish('completed'));
        });
        const waitUntil = (until) => new Promise((resolve) => {
            let done = false;
            let timer;
            const finish = (result) => {
                if (done)
                    return;
                done = true;
                wakeWaiter = undefined;
                if (timer !== undefined)
                    this.clock.clearTimeout(timer);
                options.signal?.removeEventListener('abort', abort);
                resolve(result);
            };
            const abort = () => finish('aborted');
            if (options.signal?.aborted) {
                finish('aborted');
                return;
            }
            wakeWaiter = () => finish('changed');
            options.signal?.addEventListener('abort', abort, { once: true });
            timer = this.clock.setTimeout(() => finish('timer'), Math.max(0, until - this.clock.now()));
        });
        await Promise.resolve();
        if (invalidResult)
            throw invalidResult;
        if (outcomes.every((outcome) => outcome !== undefined))
            return snapshot('settled', 0);
        if (options.signal?.aborted)
            return snapshot('aborted', 0);
        // Wait for the single-flight configuration request started by emit(). This
        // avoids consuming the round budget while envelopes are not yet sendable.
        const initialized = this.init().catch(() => undefined);
        const initialization = await runBounded(initialized);
        await Promise.resolve();
        if (invalidResult)
            throw invalidResult;
        if (initialization !== 'completed')
            return snapshot(initialization, 0);
        let rounds = 0;
        while (true) {
            if (invalidResult)
                throw invalidResult;
            if (outcomes.every((outcome) => outcome !== undefined))
                return snapshot('settled', rounds);
            if (options.signal?.aborted)
                return snapshot('aborted', rounds);
            if (this.clock.now() >= deadline)
                return snapshot('deadline', rounds);
            if (rounds >= maxRounds)
                return snapshot('max_rounds', rounds);
            rounds++;
            const turn = await runBounded(this.flush());
            await Promise.resolve();
            if (invalidResult)
                throw invalidResult;
            if (turn !== 'completed')
                return snapshot(turn, rounds);
            if (outcomes.every((outcome) => outcome !== undefined))
                return snapshot('settled', rounds);
            if (rounds >= maxRounds)
                return snapshot('max_rounds', rounds);
            const pendingIds = new Set(emissions
                .filter((_, index) => outcomes[index] === undefined)
                .map((emission) => emission.eventId));
            const hasProvidedQueueEntry = this.queue.some((entry) => pendingIds.has(entry.eventId));
            if (hasProvidedQueueEntry && this.nextAttempt <= this.clock.now())
                continue;
            const wakeAt = hasProvidedQueueEntry
                ? Math.min(deadline, this.nextAttempt || this.clock.now() + this.flushInterval)
                : deadline;
            const waited = await waitUntil(wakeAt);
            await Promise.resolve();
            if (invalidResult)
                throw invalidResult;
            if (waited === 'aborted')
                return snapshot('aborted', rounds);
            if (this.clock.now() >= deadline)
                return snapshot('deadline', rounds);
        }
    }
    makeBatch() {
        const entries = [];
        const id = this.uuid();
        const prefix = `{"protocol_version":1,"batch_id":${JSON.stringify(id)},"write_key":${JSON.stringify(this.writeKey)},"sent_at":${JSON.stringify(new Date(this.clock.now()).toISOString())},"events":[`;
        let bytes = byteLength(prefix) + 2;
        for (const entry of this.queue) {
            if (!entry.json)
                break;
            const extra = byteLength(entry.json) + (entries.length ? 1 : 0);
            if (entries.length >= this.maxBatchEvents || bytes + extra > this.maxBatchBytes)
                break;
            entries.push(entry);
            bytes += extra;
        }
        return entries.length
            ? { id, body: prefix + entries.map((entry) => entry.json).join(',') + ']}', entries }
            : undefined;
    }
    async drain(generation, keepalive) {
        // Let synchronously resolved configuration preparation finish first.
        await Promise.resolve();
        for (let round = 0; round < (keepalive ? 1 : 4); round++) {
            if (generation !== this.generation || !this.enabled)
                break;
            const now = this.clock.now();
            for (const entry of [...this.queue])
                if (now - entry.createdAt >= this.maxAge)
                    this.finish(entry, entry.ambiguous ? 'uncertain' : entry.attempts ? 'rejected' : 'dropped', 'EVENT_EXPIRED', false);
            // A persisted entry can return after the final attempt was submitted but
            // before this document observed its response. Never exceed maxAttempts on
            // reload; the pre-submission ambiguity marker keeps that result uncertain.
            for (const entry of [...this.queue])
                if (entry.attempts >= this.maxAttempts)
                    this.finish(entry, entry.ambiguous ? 'uncertain' : 'rejected', entry.retryCode ?? 'RETRY_EXHAUSTED', true, entry.retryReceiptId);
            if (this.batch?.entries.some((entry) => !this.queue.includes(entry)))
                this.batch = undefined;
            if (!this.queue.length || now < this.nextAttempt)
                break;
            const batch = this.batch ?? this.makeBatch();
            if (!batch)
                break;
            this.batch = batch;
            const ambiguityBeforeAttempt = new Map();
            for (const entry of batch.entries) {
                ambiguityBeforeAttempt.set(entry, entry.ambiguous);
                entry.attempts++;
                // If the page disappears after submission, no response can prove that
                // the collector did not accept it. A conclusive response below restores
                // the previous ambiguity before applying its own classification.
                entry.ambiguous = true;
                entry.retryCode = 'RETRY_EXHAUSTED';
                entry.retryReceiptId = undefined;
            }
            this.persistQueueState();
            try {
                const answer = await this.transport.request(`${this.endpoint}/v1/collect`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'text/plain;charset=UTF-8',
                        ...(this.config?.telemetry_token
                            ? { 'X-Evia-Telemetry': this.config.telemetry_token }
                            : {}),
                    },
                    body: batch.body,
                    // Lifecycle transitions cannot upgrade an already submitted fetch.
                    // Every bounded collection request is keepalive-capable from start.
                    keepalive: true,
                }, async (response) => {
                    const delay = retryAfter(response, this.clock.now());
                    if (response.status === 202 || response.status === 207 || response.status === 422) {
                        const receipt = validateReceipt(await readJSON(response, 64 * 1024), batch.id, batch.entries.map((entry) => entry.eventId));
                        if (response.status === 422 &&
                            receipt.results.some((result) => result.status !== 'rejected'))
                            throw new EviaSDKError('INVALID_RECEIPT');
                        return { receipt, delay };
                    }
                    void response.body?.cancel().catch(() => { });
                    return { status: response.status, delay };
                });
                if (generation !== this.generation || !this.enabled)
                    break;
                if (answer.receipt) {
                    for (const result of answer.receipt.results) {
                        const entry = batch.entries[result.index];
                        entry.ambiguous = ambiguityBeforeAttempt.get(entry);
                        if (result.status === 'accepted') {
                            this.finish(entry, 'accepted', undefined, undefined, answer.receipt.receipt_id);
                            continue;
                        }
                        entry.retryCode = result.error.code;
                        entry.retryReceiptId = answer.receipt.receipt_id;
                        if (!result.error.retryable)
                            this.finish(entry, entry.ambiguous ? 'uncertain' : 'rejected', result.error.code, false, answer.receipt.receipt_id);
                        else if (entry.attempts >= this.maxAttempts)
                            this.finish(entry, entry.ambiguous ? 'uncertain' : 'rejected', result.error.code, true, answer.receipt.receipt_id);
                    }
                    this.persistQueueState();
                    this.batch = undefined;
                    if (batch.entries.some((entry) => this.queue.includes(entry))) {
                        this.defer(batch, answer.delay);
                        break;
                    }
                    this.nextAttempt = 0;
                }
                else {
                    const status = answer.status;
                    const retryable = status === 408 ||
                        status === 425 ||
                        status === 429 ||
                        status >= 500 ||
                        (status >= 200 && status < 300);
                    const ambiguous = status !== 429 && (status === 408 || status >= 500 || (status >= 200 && status < 300));
                    for (const entry of batch.entries) {
                        entry.ambiguous = ambiguityBeforeAttempt.get(entry) || ambiguous;
                        entry.retryCode = `COLLECT_HTTP_${status}`;
                        entry.retryReceiptId = undefined;
                        if (!retryable || entry.attempts >= this.maxAttempts)
                            this.finish(entry, entry.ambiguous ? 'uncertain' : 'rejected', entry.retryCode, retryable);
                    }
                    this.persistQueueState();
                    if (!retryable || batch.entries.every((entry) => !this.queue.includes(entry)))
                        this.batch = undefined;
                    else {
                        this.defer(batch, answer.delay);
                        break;
                    }
                }
            }
            catch {
                if (generation !== this.generation || !this.enabled)
                    break;
                for (const entry of batch.entries) {
                    entry.ambiguous = true;
                    if (entry.attempts >= this.maxAttempts)
                        this.finish(entry, 'uncertain', 'RETRY_EXHAUSTED', true);
                }
                this.persistQueueState();
                if (batch.entries.every((entry) => !this.queue.includes(entry)))
                    this.batch = undefined;
                else {
                    this.defer(batch);
                    break;
                }
            }
        }
        return { pending: this.pending };
    }
    defer(batch, serverDelay) {
        const attempts = Math.max(...batch.entries.map((entry) => entry.attempts));
        this.nextAttempt =
            this.clock.now() +
                Math.max(serverDelay ?? 0, Math.min(this.retryBase * 2 ** (attempts - 1), 60000));
        const expiresIn = Math.min(...this.queue.map((entry) => entry.createdAt + this.maxAge - this.clock.now()));
        this.schedule(Math.min(this.nextAttempt - this.clock.now(), Math.max(0, expiresIn)));
    }
    disable() {
        if (this.destroyed || !this.enabled)
            return;
        this.enabled = false;
        this.generation++;
        this.configExpires = 0;
        this.configFlight = undefined;
        this.flushFlight = undefined;
        this.transport.abort();
        if (this.timer !== undefined)
            this.clock.clearTimeout(this.timer);
        this.timer = undefined;
        this.timerAt = Infinity;
        if (this.scrollTimer !== undefined)
            this.clock.clearTimeout(this.scrollTimer);
        this.scrollTimer = undefined;
        this.scrollActive = false;
        this.nextAttempt = 0;
        this.batch = undefined;
        for (const entry of [...this.queue])
            this.finish(entry, entry.attempts ? 'uncertain' : 'dropped', 'CLIENT_DISABLED', false);
    }
    enable() {
        if (this.destroyed)
            return Promise.reject(new EviaSDKError('CLIENT_DESTROYED'));
        this.enabled = true;
        return this.init();
    }
    destroy() {
        if (this.destroyed)
            return;
        this.disable();
        this.destroyed = true;
        for (const remove of this.cleanup)
            remove();
        this.cleanup.length = 0;
        this.persistSessionState();
    }
}
