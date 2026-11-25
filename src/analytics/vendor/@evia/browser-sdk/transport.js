import { EviaSDKError, isRecord, uuidPattern } from './validation.js';
export const defaultClock = {
    now: () => Date.now(),
    setTimeout: (callback, delay) => setTimeout(callback, delay),
    clearTimeout: (timer) => clearTimeout(timer),
};
export class Transport {
    fetcher;
    clock;
    timeout;
    controllers = new Set();
    constructor(fetcher, clock, timeout) {
        this.fetcher = fetcher;
        this.clock = clock;
        this.timeout = timeout;
    }
    abort() {
        for (const controller of this.controllers)
            controller.abort();
    }
    async request(url, init, consume) {
        const controller = new AbortController();
        this.controllers.add(controller);
        let timer;
        let onAbort = () => { };
        const cancelled = new Promise((_, reject) => {
            onAbort = () => reject(new EviaSDKError('REQUEST_ABORTED'));
            controller.signal.addEventListener('abort', onAbort, { once: true });
            timer = this.clock.setTimeout(() => {
                reject(new EviaSDKError('REQUEST_TIMEOUT'));
                controller.abort();
            }, this.timeout);
        });
        try {
            const operation = this.fetcher(url, {
                ...init,
                credentials: 'omit',
                cache: 'no-store',
                redirect: 'error',
                referrerPolicy: 'no-referrer',
                signal: controller.signal,
            }).then(consume);
            return await Promise.race([operation, cancelled]);
        }
        finally {
            if (timer !== undefined)
                this.clock.clearTimeout(timer);
            controller.signal.removeEventListener('abort', onAbort);
            this.controllers.delete(controller);
        }
    }
}
export async function readJSON(response, limit) {
    if (Number(response.headers.get('Content-Length')) > limit) {
        void response.body?.cancel().catch(() => { });
        throw new EviaSDKError('RESPONSE_TOO_LARGE');
    }
    if (!response.body)
        throw new EviaSDKError('INVALID_RESPONSE');
    const reader = response.body.getReader();
    const chunks = [];
    let total = 0;
    try {
        while (true) {
            const chunk = await reader.read();
            if (chunk.done)
                break;
            total += chunk.value.byteLength;
            if (total > limit)
                throw new EviaSDKError('RESPONSE_TOO_LARGE');
            chunks.push(chunk.value);
        }
    }
    catch (error) {
        void reader.cancel().catch(() => { });
        throw error;
    }
    finally {
        reader.releaseLock();
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
    }
    try {
        return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    }
    catch {
        throw new EviaSDKError('INVALID_RESPONSE');
    }
}
export function validateReceipt(value, batchId, eventIds) {
    if (!isRecord(value) ||
        value.batch_id !== batchId ||
        typeof value.receipt_id !== 'string' ||
        !uuidPattern.test(value.receipt_id) ||
        !Array.isArray(value.results) ||
        value.results.length !== eventIds.length)
        throw new EviaSDKError('INVALID_RECEIPT');
    const indexes = new Set();
    for (const result of value.results) {
        if (!isRecord(result) ||
            !Number.isSafeInteger(result.index) ||
            Number(result.index) < 0 ||
            Number(result.index) >= eventIds.length ||
            indexes.has(Number(result.index)))
            throw new EviaSDKError('INVALID_RECEIPT');
        indexes.add(Number(result.index));
        if (result.event_id !== undefined && result.event_id !== eventIds[Number(result.index)])
            throw new EviaSDKError('INVALID_RECEIPT');
        if (result.status === 'accepted') {
            if (result.event_id !== eventIds[Number(result.index)] || result.error !== undefined)
                throw new EviaSDKError('INVALID_RECEIPT');
        }
        else if (result.status === 'rejected') {
            if (!isRecord(result.error) ||
                typeof result.error.code !== 'string' ||
                result.error.code.length > 128 ||
                !/^[A-Z][A-Z0-9_]+$/.test(result.error.code) ||
                typeof result.error.retryable !== 'boolean')
                throw new EviaSDKError('INVALID_RECEIPT');
        }
        else
            throw new EviaSDKError('INVALID_RECEIPT');
    }
    return value;
}
export function retryAfter(response, now) {
    const header = response.headers.get('Retry-After');
    if (!header || header.length > 128)
        return;
    if (/^\d+$/.test(header))
        return Math.min(Number(header) * 1000, 24 * 60 * 60 * 1000);
    const timestamp = Date.parse(header);
    if (Number.isFinite(timestamp))
        return Math.min(Math.max(0, timestamp - now), 24 * 60 * 60 * 1000);
}
