import type { PublicConfig } from './types.js';
export declare function verifyConfigSignature(config: PublicConfig, expectedKeyID?: string, publicJWK?: Readonly<Record<string, unknown>>): Promise<void>;
