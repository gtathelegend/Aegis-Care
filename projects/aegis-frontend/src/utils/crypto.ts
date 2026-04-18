/**
 * AES-256-GCM Encryption Engine
 * Supports both text strings (legacy) and binary files.
 *
 * Key derivation: PBKDF2 with SHA-256, 100 000 iterations.
 * The "secret" for file ops is typically the patient's wallet address.
 */

// ─── Constants ──────────────────────────────────────────────────────
const ALGORITHM = 'AES-GCM'
const IV_LENGTH = 12       // 96-bit IV — GCM standard
const AUTH_TAG_LENGTH = 16 // 128-bit tag appended by WebCrypto
const PBKDF2_ITERATIONS = 100_000
const STATIC_SALT = new TextEncoder().encode('ojasraksha-dpdp-v1') // deterministic salt for POC

// ─── Types ──────────────────────────────────────────────────────────
export interface EncryptionMetadata {
  iv: string          // hex-encoded 12 bytes
  authTag: string     // hex-encoded 16 bytes
  algorithm: 'AES-256-GCM'
  originalName: string
  mimeType: string
  size: number        // original file size in bytes
}

export interface EncryptedFileResult {
  encryptedBlob: Blob
  metadata: EncryptionMetadata
}

// ─── Helpers ────────────────────────────────────────────────────────
function toHex(buf: Uint8Array): string {
  return Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('')
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16)
  }
  return bytes
}

// ─── Key Derivation ─────────────────────────────────────────────────
/**
 * Derives a 256-bit AES key from a secret string using PBKDF2.
 * Deterministic for a given secret (allows patient wallet-based derivation).
 */
async function deriveKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    'PBKDF2',
    false,
    ['deriveKey']
  )

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: STATIC_SALT,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: ALGORITHM, length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

/**
 * Legacy key derivation (SHA-256 hash) — kept for backward compat
 * with already-encrypted text records on chain.
 */
async function deriveKeyLegacy(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.digest('SHA-256', enc.encode(secret) as BufferSource)

  return crypto.subtle.importKey(
    'raw',
    keyMaterial,
    ALGORITHM,
    false,
    ['encrypt', 'decrypt']
  )
}

// ─── FILE Encryption / Decryption ───────────────────────────────────

/**
 * Encrypts a File object using AES-256-GCM.
 *
 * @param file     The raw file from <input type="file">
 * @param secret   The encryption secret (e.g. patient wallet address)
 * @returns        An encrypted Blob + metadata required for decryption
 */
export async function encryptFile(file: File, secret: string): Promise<EncryptedFileResult> {
  if (!secret) throw new Error('ENCRYPTION_KEY_MISSING: No encryption secret provided.')

  const key = await deriveKey(secret)
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))

  // Read file into ArrayBuffer
  const plainBuffer = await file.arrayBuffer()

  // Encrypt — WebCrypto appends the 16-byte authTag to the ciphertext
  const cipherBuffer = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv, tagLength: AUTH_TAG_LENGTH * 8 },
    key,
    plainBuffer
  )

  const cipherBytes = new Uint8Array(cipherBuffer)

  // Separate ciphertext and authTag
  const ciphertext = cipherBytes.slice(0, cipherBytes.length - AUTH_TAG_LENGTH)
  const authTag = cipherBytes.slice(cipherBytes.length - AUTH_TAG_LENGTH)

  // Build the encrypted blob (just the raw ciphertext — authTag is in metadata)
  const encryptedBlob = new Blob([ciphertext], { type: 'application/octet-stream' })

  const metadata: EncryptionMetadata = {
    iv: toHex(iv),
    authTag: toHex(authTag),
    algorithm: 'AES-256-GCM',
    originalName: file.name,
    mimeType: file.type || 'application/octet-stream',
    size: file.size,
  }

  return { encryptedBlob, metadata }
}

/**
 * Decrypts an encrypted file buffer back to the original Blob.
 *
 * @param encryptedData  The raw encrypted bytes (WITHOUT authTag)
 * @param metadata       The EncryptionMetadata saved alongside the CID
 * @param secret         The decryption secret (must match encryption secret)
 * @returns              The original file as a Blob with correct MIME type
 */
export async function decryptFile(
  encryptedData: ArrayBuffer,
  metadata: EncryptionMetadata,
  secret: string
): Promise<Blob> {
  if (!secret) throw new Error('DECRYPTION_KEY_MISSING: No decryption secret provided.')

  const key = await deriveKey(secret)
  const ivRaw = fromHex(metadata.iv)
  const iv = new ArrayBuffer(ivRaw.length)
  new Uint8Array(iv).set(ivRaw)
  const authTag = fromHex(metadata.authTag)

  // Re-assemble ciphertext + authTag (WebCrypto expects them concatenated)
  const cipherBytes = new Uint8Array(encryptedData)
  const combinedBuf = new ArrayBuffer(cipherBytes.length + authTag.length)
  const combinedView = new Uint8Array(combinedBuf)
  combinedView.set(cipherBytes)
  combinedView.set(authTag, cipherBytes.length)

  try {
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv, tagLength: AUTH_TAG_LENGTH * 8 },
      key,
      combinedBuf
    )
    return new Blob([decryptedBuffer], { type: metadata.mimeType })
  } catch (err) {
    // DOMException from WebCrypto when authTag doesn't match
    throw new Error('DECRYPTION_FAILED: File may be tampered or wrong key used. Authentication tag verification failed.')
  }
}

// ─── TEXT Encryption / Decryption (Legacy — backward compatible) ────

const LEGACY_BLOCK_SIZE = 16

/**
 * Encrypts a string of text. Returns a base64 string combining IV + Ciphertext.
 * LEGACY — kept for backward compatibility with existing on-chain records.
 */
export async function encryptData(text: string, secret: string): Promise<string> {
  const key = await deriveKeyLegacy(secret)
  const iv = crypto.getRandomValues(new Uint8Array(LEGACY_BLOCK_SIZE))
  const enc = new TextEncoder()

  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    enc.encode(text).buffer as ArrayBuffer
  )

  const ciphertextBytes = new Uint8Array(ciphertextBuffer)
  const combined = new Uint8Array(iv.length + ciphertextBytes.length)
  combined.set(iv)
  combined.set(ciphertextBytes, iv.length)

  return btoa(String.fromCharCode(...combined))
}

/**
 * Decrypts a base64 encoded string containing the IV + Ciphertext.
 * LEGACY — kept for backward compatibility with existing on-chain records.
 */
export async function decryptData(base64Encrypted: string, secret: string): Promise<string> {
  const key = await deriveKeyLegacy(secret)

  const combinedStr = atob(base64Encrypted)
  const combined = new Uint8Array(combinedStr.length)
  for (let i = 0; i < combinedStr.length; i++) {
    combined[i] = combinedStr.charCodeAt(i)
  }

  const iv = combined.slice(0, LEGACY_BLOCK_SIZE)
  const ciphertext = combined.slice(LEGACY_BLOCK_SIZE)

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv },
    key,
    ciphertext
  )

  const dec = new TextDecoder()
  return dec.decode(decryptedBuffer)
}
