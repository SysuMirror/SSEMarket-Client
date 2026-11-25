import type { ClientOptions, Properties, PublicConfig } from './types.js';
export declare class EviaSDKError extends Error {
    readonly code: string;
    constructor(code: string);
}
export declare const uuidPattern: RegExp;
export declare const customEventPattern: RegExp;
export declare const byteLength: (text: string) => number;
export declare const isRecord: (value: unknown) => value is Record<string, unknown>;
export declare function requireText(value: unknown, max: number, nonempty?: boolean): asserts value is string;
export declare function copyProperties(input: Properties): Properties;
export declare function boundedInteger(value: number | undefined, fallback: number, min: number, max: number): number;
export declare function validateOptions(options: ClientOptions): string;
export declare function validateConfig(value: unknown, projectId: string, environment: string): PublicConfig;
