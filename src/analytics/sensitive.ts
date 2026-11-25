import type { Emission, EncryptedContentChunk } from './vendor/@evia/browser-sdk/index.js'
import {
  drainEncryptedContent,
  drainEvia,
  getContentEncryptionConfig,
  trackEncryptedContentChunks,
  waitForContentEncryptionConfig,
} from './evia'

const DEFAULT_PADDED_BLOCK_BYTES = 600
const REPLAY_PADDED_BLOCK_BYTES = 4096
const MAX_CHUNKS = 32
const ALGORITHM = 'A256GCM+RSA-OAEP-256'
const AAD_VERSION = 'evia-content-v1'
const encoder = new TextEncoder()
let publicKeyPromise: Promise<CryptoKey | null> | null = null
let publicKeyCacheID = ''

export interface GenericSensitiveContentInput {
  contentType: string
  streamId: string
  itemId: string
  actorType: string
  content: string
  status?: string
  durationMs?: number
  paddedBlockBytes?: 600 | 4096
}

export interface SensitiveContentInput {
  conversationId: string
  messageId: string
  role: 'user' | 'assistant'
  content: string
  responseStatus?: 'done' | 'error' | 'stopped'
  durationMs?: number
}

function decodeBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=')
  const binary = atob(padded)
  return Uint8Array.from(binary, char => char.charCodeAt(0))
}

function encodeBase64Url(value: ArrayBuffer): string {
  const bytes = new Uint8Array(value)
  let binary = ''
  for (const byte of bytes)
    binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function encryptionMaterial(remote = getContentEncryptionConfig()): { keyId: string, jwk: JsonWebKey, projectId: string, environment: string } | null {
  if (remote) {
    return {
      keyId: remote.key_id,
      jwk: remote.public_jwk as JsonWebKey,
      projectId: remote.project_id,
      environment: remote.environment,
    }
  }
  // Development fallback while older Evia deployments do not advertise a key.
  const keyId = import.meta.env.VITE_EVIA_CONTENT_KEY_ID ?? ''
  const encoded = import.meta.env.VITE_EVIA_CONTENT_PUBLIC_JWK_B64 ?? ''
  if (!keyId || !encoded)
    return null
  try {
    const projectId = import.meta.env.VITE_EVIA_PROJECT_ID ?? ''
    const environment = import.meta.env.VITE_EVIA_ENV ?? 'development'
    if (!projectId)
      return null
    return {
      keyId,
      jwk: JSON.parse(new TextDecoder().decode(decodeBase64Url(encoded))) as JsonWebKey,
      projectId,
      environment,
    }
  }
  catch {
    return null
  }
}

function publicKey(material: { keyId: string, jwk: JsonWebKey }): Promise<CryptoKey | null> {
  if (publicKeyPromise && publicKeyCacheID === material.keyId)
    return publicKeyPromise
  publicKeyCacheID = material.keyId
  publicKeyPromise = crypto.subtle.importKey(
    'jwk',
    material.jwk,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt'],
  ).catch((error) => {
    console.warn('[evia] 内容加密公钥无效', error)
    return null
  })
  return publicKeyPromise
}

function paddedBlock(chunk: Uint8Array, blockBytes: 600 | 4096): Uint8Array {
  if (chunk.length > blockBytes - 2)
    throw new Error('content chunk exceeds padded block')
  const block = new Uint8Array(blockBytes)
  new DataView(block.buffer).setUint16(0, chunk.length, false)
  block.set(chunk, 2)
  crypto.getRandomValues(block.subarray(2 + chunk.length))
  return block
}

function contentAAD(input: {
  projectId: string
  environment: string
  keyId: string
  contentType: string
  streamId: string
  itemId: string
  actorType: string
  chunkIndex: number
  chunkCount: number
  contentLength: number
  truncated: boolean
  responseStatus: string
  durationMs: number
}): Uint8Array {
  return encoder.encode([
    AAD_VERSION,
    input.projectId,
    input.environment,
    input.keyId,
    input.contentType,
    input.streamId,
    input.itemId,
    input.actorType,
    input.chunkIndex,
    input.chunkCount,
    input.contentLength,
    input.truncated ? 1 : 0,
    input.responseStatus,
    input.durationMs,
  ].join('|'))
}

function splitContent(content: string, blockBytes: 600 | 4096): { chunks: Uint8Array[], totalBytes: number, truncated: boolean } {
  const contentBytesPerChunk = blockBytes - 2
  const totalBytes = encoder.encode(content).length
  const chunks: Uint8Array[] = []
  let current = ''
  let currentBytes = 0
  let acceptedBytes = 0
  let truncated = false
  for (const char of content) {
    const bytes = encoder.encode(char)
    if (acceptedBytes + bytes.length > contentBytesPerChunk * MAX_CHUNKS) {
      truncated = true
      break
    }
    if (current && currentBytes + bytes.length > contentBytesPerChunk) {
      chunks.push(encoder.encode(current))
      current = ''
      currentBytes = 0
    }
    current += char
    currentBytes += bytes.length
    acceptedBytes += bytes.length
  }
  if (current)
    chunks.push(encoder.encode(current))
  return { chunks, totalBytes, truncated: truncated || acceptedBytes < totalBytes }
}

/**
 * Encrypts one sensitive message before it reaches Evia. The AES key is random
 * per message and wrapped with the configured RSA-OAEP public key; private keys
 * never enter the browser. Every chunk is independently decryptable and carries
 * no plaintext. Returns false when encryption is not configured or fails — the
 * caller must not fall back to plaintext.
 */
export async function enqueueGenericSensitiveContent(input: GenericSensitiveContentInput): Promise<readonly Emission[] | null> {
  // The SDK is dynamically imported; on a throttled first load the module and
  // signed config can legitimately take longer than the old five-second wait.
  // Keep waiting within a fixed bound rather than permanently disabling replay
  // before configuration eventually arrives.
  const remote = getContentEncryptionConfig() ?? await waitForContentEncryptionConfig(30_000)
  const material = encryptionMaterial(remote)
  if (!material || !input.content) {
    console.warn('[evia] 密文内容缺少公钥配置或正文')
    return null
  }
  const keyId = material.keyId
  const rsaKey = await publicKey(material)
  if (!rsaKey) {
    console.warn('[evia] 密文内容公钥不可用')
    return null
  }
  try {
    const blockBytes = input.paddedBlockBytes ?? DEFAULT_PADDED_BLOCK_BYTES
    if (blockBytes !== DEFAULT_PADDED_BLOCK_BYTES && blockBytes !== REPLAY_PADDED_BLOCK_BYTES)
      throw new Error('unsupported content padding block')
    const padding = blockBytes === REPLAY_PADDED_BLOCK_BYTES
      ? 'fixed-4096-v2' as const
      : 'fixed-600-v1' as const
    const split = splitContent(input.content, blockBytes)
    if (split.chunks.length === 0) {
      console.warn('[evia] 密文内容分片为空')
      return null
    }
    const aesKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt'])
    const rawAesKey = await crypto.subtle.exportKey('raw', aesKey)
    const wrappedKey = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, rsaKey, rawAesKey)
    const wrappedKeyText = encodeBase64Url(wrappedKey)
    const chunkCount = split.chunks.length
    const contentType = input.contentType.slice(0, 64)
    const streamId = input.streamId.slice(0, 128)
    const itemId = input.itemId.slice(0, 128)
    const actorType = input.actorType.slice(0, 32)
    const responseStatus = input.status?.slice(0, 32) ?? ''
    const durationMs = input.durationMs === undefined
      ? 0
      : Math.min(Math.max(Math.round(input.durationMs), 0), 3_600_000)
    const encryptedChunks: EncryptedContentChunk[] = []
    for (let index = 0; index < chunkCount; index++) {
      const nonce = crypto.getRandomValues(new Uint8Array(12))
      const aad = contentAAD({
        projectId: material.projectId,
        environment: material.environment,
        keyId,
        contentType,
        streamId,
        itemId,
        actorType,
        chunkIndex: index,
        chunkCount,
        contentLength: split.totalBytes,
        truncated: split.truncated,
        responseStatus,
        durationMs,
      })
      const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: nonce, additionalData: aad },
        aesKey,
        paddedBlock(split.chunks[index]!, blockBytes),
      )
      const encrypted: EncryptedContentChunk = {
        contentType,
        streamId,
        itemId,
        actorType,
        chunkIndex: index,
        chunkCount,
        ciphertext: encodeBase64Url(ciphertext),
        nonce: encodeBase64Url(nonce.buffer),
        wrappedKey: wrappedKeyText,
        keyId: keyId.slice(0, 64),
        alg: ALGORITHM as 'A256GCM+RSA-OAEP-256',
        aadVersion: AAD_VERSION as 'evia-content-v1',
        padding,
        contentLength: split.totalBytes,
        truncated: split.truncated,
        ...(responseStatus ? { status: responseStatus } : {}),
        ...(durationMs > 0 ? { durationMs } : {}),
      }
      encryptedChunks.push(encrypted)
    }
    let emissions = trackEncryptedContentChunks(encryptedChunks)
    if (!emissions) {
      await drainEvia()
      emissions = trackEncryptedContentChunks(encryptedChunks)
    }
    return emissions
  }
  catch (error) {
    console.warn('[evia] 敏感内容加密失败，已拒绝明文降级', error)
    return null
  }
}

export async function trackGenericSensitiveContent(input: GenericSensitiveContentInput): Promise<boolean> {
  const deliveries = await enqueueGenericSensitiveContent(input)
  if (!deliveries)
    return false
  const delivery = drainEncryptedContent(deliveries, {
    timeoutMs: 5 * 60_000,
    maxRounds: 1024,
  })
  if (!delivery)
    return false
  return (await delivery).status === 'accepted'
}

export function trackSensitiveContent(input: SensitiveContentInput): Promise<boolean> {
  return trackGenericSensitiveContent({
    contentType: 'ai_chat_message',
    streamId: input.conversationId,
    itemId: input.messageId,
    actorType: input.role,
    content: input.content,
    status: input.responseStatus,
    durationMs: input.durationMs,
  })
}
