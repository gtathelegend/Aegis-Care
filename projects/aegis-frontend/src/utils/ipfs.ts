/**
 * Pinata IPFS Integration — Encrypted File Upload + Fetch
 *
 * Supports:
 * - Legacy text upload (backward compat)
 * - Binary encrypted file upload with metadata header
 * - Retry logic with exponential backoff
 * - File size validation
 */

import type { EncryptionMetadata } from './crypto'

const PINATA_JWT = import.meta.env.VITE_PINATA_JWT as string
const PINATA_GATEWAY = 'https://gateway.pinata.cloud/ipfs/'
const PUBLIC_GATEWAY = 'https://ipfs.io/ipfs/'
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
const MAX_RETRIES = 3
const RETRY_BASE_DELAY_MS = 1000

// ─── Helpers ────────────────────────────────────────────────────────

async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  retries = MAX_RETRIES
): Promise<T> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (err: any) {
      if (attempt === retries) {
        throw new Error(`IPFS_${label.toUpperCase()}_FAILED: ${err.message} (after ${retries} attempts)`)
      }
      const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1)
      console.warn(`[IPFS] ${label} attempt ${attempt} failed, retrying in ${delay}ms...`, err.message)
      await new Promise(r => setTimeout(r, delay))
    }
  }
  throw new Error('IPFS_UNREACHABLE')
}

// ─── Bundle Format ──────────────────────────────────────────────────
/**
 * Bundle format (.enc):
 *   [4 bytes: metadata length (uint32 big-endian)]
 *   [N bytes: JSON metadata]
 *   [remaining: encrypted file data]
 */

function bundleEncryptedFile(encryptedBlob: Blob, metadata: EncryptionMetadata): Blob {
  const metaJson = JSON.stringify(metadata)
  const metaBytes = new TextEncoder().encode(metaJson)
  const lengthBuf = new ArrayBuffer(4)
  new DataView(lengthBuf).setUint32(0, metaBytes.length, false) // big-endian

  return new Blob(
    [new Uint8Array(lengthBuf), metaBytes, encryptedBlob],
    { type: 'application/octet-stream' }
  )
}

async function unbundleEncryptedFile(
  data: ArrayBuffer
): Promise<{ metadata: EncryptionMetadata; encryptedData: ArrayBuffer }> {
  if (data.byteLength < 4) {
    throw new Error('IPFS_PARSE_ERROR: File too small to contain valid encrypted bundle.')
  }

  const view = new DataView(data)
  const metaLength = view.getUint32(0, false) // big-endian

  if (metaLength <= 0 || metaLength > 10_000) {
    throw new Error('IPFS_PARSE_ERROR: Invalid metadata header length.')
  }

  if (data.byteLength < 4 + metaLength) {
    throw new Error('IPFS_PARSE_ERROR: File is truncated.')
  }

  const metaBytes = new Uint8Array(data, 4, metaLength)
  const metaJson = new TextDecoder().decode(metaBytes)

  let metadata: EncryptionMetadata
  try {
    metadata = JSON.parse(metaJson)
  } catch {
    throw new Error('IPFS_PARSE_ERROR: Metadata JSON is corrupted.')
  }

  if (!metadata.iv || !metadata.authTag || !metadata.algorithm) {
    throw new Error('IPFS_PARSE_ERROR: Metadata is missing required encryption fields.')
  }

  const encryptedData = data.slice(4 + metaLength)
  return { metadata, encryptedData }
}

// ─── Encrypted File Upload ──────────────────────────────────────────

/**
 * Uploads an encrypted file bundle to Pinata IPFS.
 *
 * @param encryptedBlob  The encrypted file data (ciphertext without authTag)
 * @param metadata       Encryption metadata (iv, authTag, original file info)
 * @param name           Human-readable name for Pinata
 * @returns              IPFS CID
 */
export async function uploadEncryptedFile(
  encryptedBlob: Blob,
  metadata: EncryptionMetadata,
  name = 'Aegis_EncryptedReport'
): Promise<string> {
  if (!PINATA_JWT) {
    throw new Error('IPFS_CONFIG_ERROR: Pinata JWT is not configured. Check VITE_PINATA_JWT in .env')
  }

  // Size validation (on the original file size, not encrypted — they're similar)
  if (metadata.size > MAX_FILE_SIZE) {
    throw new Error(`FILE_TOO_LARGE: Maximum file size is ${MAX_FILE_SIZE / 1024 / 1024}MB. Your file is ${(metadata.size / 1024 / 1024).toFixed(1)}MB.`)
  }

  // Bundle into single .enc file
  const bundle = bundleEncryptedFile(encryptedBlob, metadata)

  return withRetry(async () => {
    const formData = new FormData()
    formData.append('file', bundle, `${name}.enc`)
    formData.append('pinataMetadata', JSON.stringify({ name: `${name}_encrypted` }))
    formData.append('pinataOptions', JSON.stringify({ cidVersion: 1 }))

    const res = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: { Authorization: `Bearer ${PINATA_JWT}` },
      body: formData,
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`HTTP ${res.status}: ${errText}`)
    }

    const data = await res.json()
    return data.IpfsHash as string
  }, 'UPLOAD')
}

/**
 * Fetches an encrypted file bundle from IPFS and parses it.
 *
 * @param cid  The IPFS CID
 * @returns    The encrypted data buffer and encryption metadata
 */
export async function fetchEncryptedFile(
  cid: string
): Promise<{ encryptedData: ArrayBuffer; metadata: EncryptionMetadata }> {
  if (!cid) throw new Error('IPFS_FETCH_ERROR: No CID provided.')

  const rawData = await withRetry(async () => {
    // Try Pinata gateway first (faster with JWT), fall back to public
    let res: Response
    try {
      res = await fetch(`${PINATA_GATEWAY}${cid}`, {
        signal: AbortSignal.timeout(30_000),
      })
    } catch {
      res = await fetch(`${PUBLIC_GATEWAY}${cid}`, {
        signal: AbortSignal.timeout(30_000),
      })
    }

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} fetching CID: ${cid}`)
    }

    return res.arrayBuffer()
  }, 'FETCH')

  return unbundleEncryptedFile(rawData)
}

// ─── Legacy Text Upload / Fetch (backward compatible) ───────────────

/**
 * Uploads a text string to IPFS via Pinata.
 * Returns the IPFS CID (Content Identifier).
 */
export async function uploadToIPFS(content: string, name = 'Aegis_Record'): Promise<string> {
  if (!PINATA_JWT) {
    throw new Error('Pinata JWT is not configured in the environment.')
  }

  const blob = new Blob([content], { type: 'text/plain' })
  const formData = new FormData()
  formData.append('file', blob, name)
  formData.append('pinataMetadata', JSON.stringify({ name }))
  formData.append('pinataOptions', JSON.stringify({ cidVersion: 1 }))

  const res = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
    method: 'POST',
    headers: { Authorization: `Bearer ${PINATA_JWT}` },
    body: formData,
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`IPFS Upload Failed: ${err}`)
  }

  const data = await res.json()
  return data.IpfsHash
}

/**
 * Fetches content from IPFS using a public gateway.
 */
export async function fetchFromIPFS(cid: string): Promise<string> {
  const res = await fetch(`${PUBLIC_GATEWAY}${cid}`)
  if (!res.ok) {
    throw new Error(`Failed to fetch IPFS CID: ${cid}`)
  }
  return res.text()
}
