import { getAlgorandClientFromViteEnvironment } from './network/getAlgoClientConfigs'
import algosdk from 'algosdk'

/**
 * Resolves a patient identifier (either a full 58-char wallet address or a 6-char Short ID)
 * to a full Algorand wallet address using the on-chain WalletMapper contract.
 * 
 * Uses direct box state lookup to avoid AppClient sender constraints.
 */
export async function resolveAddress(identifier: string): Promise<string> {
  const trimmed = identifier.trim()
  
  // 1. Check if it's already a full wallet address
  if (trimmed.length === 58) {
    // Basic validation to ensure it doesn't contain invalid characters if it's 58 chars
    try {
      algosdk.decodeAddress(trimmed)
      return trimmed
    } catch (e) {
      throw new Error('Invalid base32 wallet address provided.')
    }
  }

  // 2. Check if it's a Short ID (6 characters)
  if (trimmed.length === 6) {
    const algorand = getAlgorandClientFromViteEnvironment()
    const mapperAppId = Number(import.meta.env.VITE_WALLET_MAPPER_APP_ID || 0)
    
    try {
      // Box Name Construction (sid_ + 6 bytes)
      const encoder = new TextEncoder()
      const prefix = encoder.encode('sid_')
      const sid = encoder.encode(trimmed)
      const boxName = new Uint8Array(prefix.length + sid.length)
      boxName.set(prefix)
      boxName.set(sid, prefix.length)
      
      // Fetch box directly from algod
      const response = await algorand.client.algod.getApplicationBoxByName(mapperAppId, boxName).do()
      
      if (!response.value || response.value.length !== 32) {
         throw new Error('Malformed identity mapping on-chain.')
      }
      
      return algosdk.encodeAddress(response.value)
    } catch (e: any) {
      console.error('[resolveAddress] Short ID resolution failed:', e)
      if (e.message?.includes('404') || e.status === 404) {
        throw new Error(`Short ID "${trimmed}" is not registered on-chain.`)
      }
      throw new Error(`Failed to resolve Short ID: ${e.message}`)
    }
  }

  throw new Error('Invalid identifier: Must be a 58-char wallet address or a 6-char Short ID.')
}
