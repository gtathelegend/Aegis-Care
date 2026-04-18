/**
 * RBAC Authorization Check for File Decryption
 *
 * Verifies whether a given wallet address is authorized to decrypt
 * a patient's medical records before any decryption occurs.
 */

import { ConsentManagerClient } from '../contracts/ConsentManagerClient'
import { calcConsentBox } from './boxUtils'

export interface AuthCheckResult {
  authorized: boolean
  reason: string
  method: 'owner' | 'consent' | 'denied'
}

/**
 * Checks whether `walletAddress` is authorized to decrypt records for `patientAddress`.
 *
 * Authorization hierarchy:
 *  1. Patient themselves → always authorized
 *  2. Active consent exists in ConsentManager → authorized
 *  3. Otherwise → denied
 *
 * @param walletAddress   The wallet attempting to decrypt
 * @param patientAddress  The patient whose data is being accessed
 * @param algorand        AlgorandClient instance
 * @param consentAppId    ConsentManager application ID
 * @param signer          Transaction signer for read-only ABI calls
 */
export async function checkDecryptionAuth(
  walletAddress: string,
  patientAddress: string,
  algorand: any,
  consentAppId: number,
  signer: any
): Promise<AuthCheckResult> {
  // 1. Owner check — patient can always decrypt their own data
  if (walletAddress === patientAddress) {
    return {
      authorized: true,
      reason: 'You are the data owner (patient).',
      method: 'owner',
    }
  }

  // 2. Consent check — look for an active consent entry in ConsentManager
  if (consentAppId > 0) {
    try {
      const client = new ConsentManagerClient({
        appId: BigInt(consentAppId),
        algorand,
      })

      const consentBox = calcConsentBox(patientAddress)
      const result = await client.send.getPatientConsents({
        args: { patient: patientAddress },
        sender: walletAddress,
        signer,
        boxReferences: [{ appId: BigInt(consentAppId), name: consentBox }],
      })

      const consents = result.return || []
      const activeConsent = consents.find(
        (c: any) => c[1] === walletAddress && c[7] === true
      )

      if (activeConsent) {
        return {
          authorized: true,
          reason: 'Active consent found — authorized by patient.',
          method: 'consent',
        }
      }
    } catch (e: any) {
      console.warn('[authCheck] Consent lookup failed:', e.message)
    }
  }

  // 3. Denied
  return {
    authorized: false,
    reason: 'ACCESS_DENIED: You are not the patient and no active consent exists. Request patient consent first.',
    method: 'denied',
  }
}
