export type Environment = 'development' | 'staging' | 'production';
export type Scalar = string | number | boolean;
export type Properties = Readonly<Record<string, Scalar | readonly Scalar[]>>;
export interface PublicConfig {
    format: 'evia.public-config.v1';
    project_id: string;
    environment: Environment;
    release_revision: number;
    events: readonly {
        event_key: string;
        schema_version: number;
        schema: Readonly<Record<string, unknown>>;
    }[];
    content_encryption?: Readonly<{
        key_id: string;
        alg: 'RSA-OAEP-256';
        public_jwk: Readonly<Record<string, unknown>>;
    }>;
    telemetry_token?: string;
    telemetry_expires_at?: string;
    config_signature?: Readonly<{
        key_id: string;
        alg: 'Ed25519';
        digest_sha256: string;
        signature: string;
    }>;
}
export interface StoragePort {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
}
/** Injectable browser scroll surface, also used for deterministic tests. */
export interface ScrollHost {
    /** Subscribe to scroll activity; returns an unsubscribe function. */
    subscribe(listener: () => void): () => void;
    /** Current vertical scroll position as a ratio in [0, 1]. */
    ratio(): number;
}
/** One sanitized click sample for the coordinate heatmap. */
export interface HeatmapClick {
    xRatio: number;
    yRatio: number;
    viewportWidth: number;
    viewportHeight: number;
    /** Structural path only: tags/roles/nth-of-type, never text or input value. */
    elementPath: string;
    elementIndex?: number;
}
/** Injectable browser click surface, also used for deterministic tests. */
export interface HeatmapHost {
    subscribe(listener: (sample: HeatmapClick) => void): () => void;
}
export interface Clock {
    now(): number;
    setTimeout(callback: () => void, delay: number): ReturnType<typeof setTimeout>;
    clearTimeout(timer: ReturnType<typeof setTimeout>): void;
}
export interface ClientOptions {
    endpoint: string;
    writeKey: string;
    projectId: string;
    environment: Environment;
    fetch?: typeof globalThis.fetch;
    /** null disables persistence; failures fall back to memory. */
    storage?: StoragePort | null;
    /**
     * Opt-in durable mirror of the bounded event queue onto the storage port, so
     * queued events survive a page reload or same-context navigation. Defaults to
     * false, which keeps the historical memory-only queue byte-identical.
     * Redelivery after reload stays at-least-once: rehydrated events keep their
     * original event_id and the collector deduplicates stable source/event IDs.
     */
    persistQueue?: boolean;
    /**
     * Opt-in cross-document session continuity. When enabled the session scope
     * (session id, tab id, sequence and last activity) is mirrored onto a
     * tab-scoped storage port, so a reload or hard navigation within the same
     * tab continues the same session instead of starting a new one. Closing the
     * tab or opening a new one still starts a fresh session, and reset()
     * discards the persisted scope. Defaults to false so the per-document
     * session scope stays byte-identical.
     */
    persistSession?: boolean;
    /**
     * Tab-scoped storage port used by persistSession; the browser sessionStorage
     * is used by default. Passing null disables the port, so enabling
     * persistSession without a usable port fails closed at construction instead
     * of silently losing continuity.
     */
    sessionStorage?: StoragePort | null;
    /**
     * Optional out-of-band trust anchor for Ed25519 public-config signatures.
     * When configured, unsigned/mismatched/tampered configs fail closed.
     */
    configSigningKeyId?: string;
    configSigningPublicJWK?: Readonly<Record<string, unknown>>;
    /** Injectable browser capabilities, also useful for deterministic tests. */
    clock?: Clock;
    randomUUID?: () => string;
    lifecycle?: boolean;
    /**
     * Opt-in automatic sys.page_view collection. When enabled the client emits one
     * reserved page-view event for the initial load and after every navigate()/reset()
     * that produces a new page_view_id. Defaults to false so existing behavior is unchanged.
     */
    autoPageViews?: boolean;
    /**
     * Opt-in automatic sys.identity_link collection. When enabled each successful
     * identify(uid) enqueues one reserved identity-link event (empty properties) whose
     * identity carries both the new uid and the anonymous id; no credentials are collected.
     * Defaults to false so existing behavior is unchanged.
     */
    autoIdentityLink?: boolean;
    /**
     * Opt-in automatic sys.session_end collection. When enabled the client records a
     * reserved session-end event before an observed session ends: logout on reset(),
     * account_switch when identify() changes the uid, and idle when the inactivity timeout
     * rotates the session. Defaults to false so existing behavior is unchanged.
     */
    autoSessionEnd?: boolean;
    /**
     * Opt-in automatic sys.page_scroll collection. Scroll activity is coalesced into one
     * event when scrolling stops, capped at 12 events per minute. Defaults to false.
     */
    autoPageScrolls?: boolean;
    /** Injectable scroll surface; a window/document adapter is used by default in a browser. */
    scrollHost?: ScrollHost;
    /** Debounce window used to decide that scrolling has stopped, in milliseconds. */
    scrollIdleMs?: number;
    /**
     * Opt-in automatic sys.heatmap_click collection. It records normalized viewport
     * coordinates and a sanitized structural element path; text, input values, ids,
     * classes and arbitrary attributes are never collected. Capped at 120/minute.
     */
    autoHeatmapClicks?: boolean;
    /** Injectable click surface; a document capture listener is used by default. */
    heatmapHost?: HeatmapHost;
    configTtlMs?: number;
    requestTimeoutMs?: number;
    flushIntervalMs?: number;
    retryBaseMs?: number;
    maxAttempts?: number;
    maxAgeMs?: number;
    maxQueueEvents?: number;
    maxQueueBytes?: number;
    maxBatchEvents?: number;
    maxBatchBytes?: number;
    sessionTimeoutMs?: number;
}
export interface NavigationLink {
    readonly navigationId: string;
    readonly sourcePageViewId: string;
}
export interface PageOptions {
    routeName?: string;
    routeTemplate?: string;
    sourceModule?: string;
    navigationType?: 'initial' | 'push' | 'replace' | 'pop' | 'restore';
    link?: NavigationLink;
}
export interface EventOptions {
    operationId?: string;
    navigation?: NavigationLink;
}
export interface EventOutcome {
    eventId: string;
    /** accepted means a durable queue acknowledgement, not stored/queryable. */
    status: 'accepted' | 'rejected' | 'dropped' | 'uncertain';
    attempts: number;
    receiptId?: string;
    code?: string;
    retryable?: boolean;
}
export interface Emission {
    readonly eventId: string;
    readonly result: Promise<EventOutcome>;
}
export interface DrainUntilSettledOptions {
    /**
     * Maximum wall-clock time spent driving this drain call. Defaults to the
     * client's maxAgeMs and is bounded to 55 minutes. Reaching the timeout does
     * not cancel or remove queued events; normal delivery may continue.
     */
    timeoutMs?: number;
    /**
     * Maximum number of bounded flush turns. Each turn retains flush()'s existing
     * limit of four collection batches. Defaults to 1024 and is capped at 4096.
     */
    maxRounds?: number;
    /**
     * Cancels only this caller's wait. Shared requests and queued events are not
     * aborted, so another caller or the normal scheduler can continue delivery.
     */
    signal?: AbortSignal;
}
export type DrainUntilSettledReason = 'settled' | 'deadline' | 'max_rounds' | 'aborted';
export interface DrainUntilSettledResult {
    /** accepted is returned only when every provided emission settled accepted. */
    readonly status: 'accepted' | 'incomplete';
    readonly reason: DrainUntilSettledReason;
    readonly rounds: number;
    /** Settled outcomes, in the same relative order as the provided emissions. */
    readonly outcomes: readonly EventOutcome[];
    /** Only provided emissions that had not settled when the bounded drain stopped. */
    readonly pendingEventIds: readonly string[];
}
export type OperationErrorCategory = 'validation' | 'network' | 'timeout' | 'http' | 'business';
/**
 * Structured, sanitized description of a terminal logical-operation failure.
 * Raw exceptions and request bodies are intentionally not accepted, so the SDK
 * never collects credentials or arbitrary payloads in sys.operation_failed.
 */
export interface EncryptedContentChunk {
    contentType: string;
    streamId: string;
    itemId: string;
    actorType: string;
    chunkIndex: number;
    chunkCount: number;
    ciphertext: string;
    nonce: string;
    wrappedKey: string;
    keyId: string;
    alg: 'A256GCM+RSA-OAEP-256';
    aadVersion: 'evia-content-v1';
    padding: 'fixed-600-v1' | 'fixed-4096-v2';
    contentLength: number;
    truncated: boolean;
    status?: string;
    durationMs?: number;
}
export interface OperationFailure {
    operation: string;
    errorCategory: OperationErrorCategory;
    retryable: boolean;
    errorCode?: string;
}
export type SessionEndReason = 'logout' | 'account_switch' | 'idle';
export interface FlushResult {
    pending: number;
}
export interface EventContext {
    session_id: string;
    tab_id: string;
    sequence: number;
    page_view_id: string;
    navigation_id: string;
    navigation_type: NonNullable<PageOptions['navigationType']>;
    source_page_view_id?: string;
    previous_page_view_id?: string;
    operation_id?: string;
    route_name?: string;
    route_template?: string;
    source_module?: string;
}
export interface Envelope {
    event_id: string;
    event_key: string;
    schema_version: number;
    release_revision: number;
    occurred_at: string;
    identity: {
        anonymous_id: string;
        uid?: string;
    };
    context: EventContext;
    sdk: {
        name: 'evia-browser';
        version: '0.1.0';
    };
    properties: Properties;
}
export interface BrowserClient {
    init(): Promise<PublicConfig>;
    refreshConfig(): Promise<PublicConfig>;
    emit(eventKey: string, properties?: Properties, options?: EventOptions): Emission;
    emitEncryptedContentChunk(chunk: EncryptedContentChunk): Emission;
    /** Atomically admits a non-empty list within the existing queue event/byte bounds. */
    emitEncryptedContentChunks(chunks: readonly EncryptedContentChunk[]): readonly Emission[];
    /** Repeatedly drives bounded flush turns and reports only the provided emissions. */
    drainUntilSettled(emissions: readonly Emission[], options?: DrainUntilSettledOptions): Promise<DrainUntilSettledResult>;
    reportOperationFailure(failure: OperationFailure): Emission;
    identify(uid: string): void;
    reset(): void;
    beginNavigation(): NavigationLink;
    navigate(options?: PageOptions): Readonly<Omit<EventContext, 'sequence'>>;
    flush(options?: {
        keepalive?: boolean;
    }): Promise<FlushResult>;
    disable(): void;
    enable(): Promise<PublicConfig>;
    destroy(): void;
    readonly pending: number;
}
