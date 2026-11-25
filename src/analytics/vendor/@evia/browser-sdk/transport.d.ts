import type { Clock } from './types.js';
export declare const defaultClock: Clock;
export declare class Transport {
    private readonly fetcher;
    private readonly clock;
    private readonly timeout;
    private readonly controllers;
    constructor(fetcher: typeof fetch, clock: Clock, timeout: number);
    abort(): void;
    request<T>(url: string, init: RequestInit, consume: (response: Response) => Promise<T>): Promise<T>;
}
export declare function readJSON(response: Response, limit: number): Promise<unknown>;
export interface ReceiptResult {
    index: number;
    event_id?: string;
    status: 'accepted' | 'rejected';
    error?: {
        code: string;
        retryable: boolean;
    };
}
export interface Receipt {
    receipt_id: string;
    results: ReceiptResult[];
}
export declare function validateReceipt(value: unknown, batchId: string, eventIds: readonly string[]): Receipt;
export declare function retryAfter(response: Response, now: number): number | undefined;
