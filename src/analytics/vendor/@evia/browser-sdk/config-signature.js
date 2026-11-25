import { EviaSDKError } from './validation.js';
function canonical(value) {
    if (value === null || typeof value === 'string' || typeof value === 'boolean')
        return JSON.stringify(value);
    if (typeof value === 'number') {
        if (!Number.isFinite(value))
            throw new EviaSDKError('INVALID_CONFIG_SIGNATURE');
        return JSON.stringify(value);
    }
    if (Array.isArray(value))
        return `[${value.map(canonical).join(',')}]`;
    if (typeof value === 'object') {
        const record = value;
        const keys = Object.keys(record)
            .filter((key) => record[key] !== undefined)
            .sort();
        return `{${keys.map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(',')}}`;
    }
    throw new EviaSDKError('INVALID_CONFIG_SIGNATURE');
}
function base64URL(value) {
    const padded = value
        .replace(/-/g, '+')
        .replace(/_/g, '/')
        .padEnd(Math.ceil(value.length / 4) * 4, '=');
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++)
        bytes[index] = binary.charCodeAt(index);
    return bytes.buffer;
}
function hex(bytes) {
    return [...new Uint8Array(bytes)].map((value) => value.toString(16).padStart(2, '0')).join('');
}
export async function verifyConfigSignature(config, expectedKeyID, publicJWK) {
    if (!expectedKeyID && !publicJWK)
        return;
    if (!expectedKeyID || !publicJWK || !config.config_signature)
        throw new EviaSDKError('INVALID_CONFIG_SIGNATURE');
    const signature = config.config_signature;
    if (signature.key_id !== expectedKeyID ||
        signature.alg !== 'Ed25519' ||
        publicJWK.kty !== 'OKP' ||
        publicJWK.crv !== 'Ed25519' ||
        typeof publicJWK.x !== 'string' ||
        publicJWK.d !== undefined)
        throw new EviaSDKError('INVALID_CONFIG_SIGNATURE');
    const unsigned = { ...config };
    delete unsigned.config_signature;
    const digest = hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical(unsigned))));
    if (digest !== signature.digest_sha256)
        throw new EviaSDKError('INVALID_CONFIG_SIGNATURE');
    let key;
    try {
        key = await crypto.subtle.importKey('jwk', publicJWK, { name: 'Ed25519' }, false, ['verify']);
    }
    catch {
        throw new EviaSDKError('INVALID_CONFIG_SIGNATURE');
    }
    const valid = await crypto.subtle.verify({ name: 'Ed25519' }, key, base64URL(signature.signature), new TextEncoder().encode(digest));
    if (!valid)
        throw new EviaSDKError('INVALID_CONFIG_SIGNATURE');
}
