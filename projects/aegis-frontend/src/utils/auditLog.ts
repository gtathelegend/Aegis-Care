import axios from 'axios'

const INDEXER_PORT = import.meta.env.VITE_INDEXER_PORT
const INDEXER_BASE = import.meta.env.VITE_INDEXER_SERVER || 'https://testnet-idx.algonode.cloud'
const INDEXER_URL = INDEXER_PORT ? `${INDEXER_BASE}:${INDEXER_PORT}` : INDEXER_BASE
const AUDIT_APP_ID = Number(import.meta.env.VITE_AUDIT_LOG_APP_ID || 0)

// ARC-4 Method Selectors for AuditLog
const SELECTORS: Record<string, string> = {
  '2bfc2d75': 'Consent Granted',
  '009c58f0': 'Consent Revoked',
  'c7bdb470': 'Data Accessed',
  '25f2c316': 'Access Requested',
  'cdc74e43': 'Erasure Requested',
  '6253a476': 'Prescription Added',
  'e00f0afb': 'Medication Dispensed'
}

export interface AuditLogEntry {
  id: string
  type: string
  provider: string
  timestamp: number
  purpose: string
  txId: string
}

/**
 * Fetches and parses audit logs for a specific address from the Algorand Indexer.
 */
export async function fetchAuditLogs(address: string): Promise<AuditLogEntry[]> {
  if (!address || AUDIT_APP_ID === 0) return []

  try {
    // Fetch transactions for the active address where AuditLog app was called
    const response = await axios.get(`${INDEXER_URL}/v2/accounts/${address}/transactions`, {
      params: {
        'application-id': AUDIT_APP_ID,
        'limit': 20
      }
    })

    const txns = response.data.transactions || []
    const logs: AuditLogEntry[] = []

    for (const tx of txns) {
      const appArgs = tx['application-transaction']?.['application-args'] || []
      if (appArgs.length === 0) continue

      // Convert base64 selector to hex
      const selectorHex = Buffer.from(appArgs[0], 'base64').toString('hex').slice(0, 8)
      const type = SELECTORS[selectorHex] || 'Unknown Action'

      // Basic parsing of arguments (Simplified)
      // Arg 1: Principal (Address), Arg 2: Fiduciary (Address), Arg 3: Purpose (String)
      let provider = 'N/A'
      let purpose = 'General System Action'

      try {
          if (appArgs.length >= 2) {
             const providerRaw = Buffer.from(appArgs[1], 'base64')
             if (providerRaw.length === 32) {
                // In ARC-4, addresses are 32-byte public keys
                // We'll just show the prefix for the log
                provider = providerRaw.toString('hex').slice(0, 8).toUpperCase()
             }
          }
          if (appArgs.length >= 3) {
             const purposeRaw = Buffer.from(appArgs[2], 'base64')
             // Strings in ARC-4 have a 2-byte length prefix
             purpose = purposeRaw.slice(2).toString('utf-8')
          }
      } catch (e) {
          console.debug('Log parsing error', e)
      }

      logs.push({
        id: tx.id,
        type,
        provider: provider !== 'N/A' ? `ID: ${provider}` : 'Ojasraksha Protocol',
        timestamp: tx['round-time'] * 1000,
        purpose,
        txId: tx.id
      })
    }

    return logs
  } catch (err) {
    console.error('Failed to fetch audit logs:', err)
    return []
  }
}
