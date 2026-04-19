import { useState, useMemo } from 'react'
import { useWallet } from '@txnlab/use-wallet-react'
import { getAlgorandClientFromViteEnvironment } from '../utils/network/getAlgoClientConfigs'
import { MedicalRecordsClient } from '../contracts/MedicalRecords'
import { uploadEncryptedFile } from '../utils/ipfs'
import { encryptFile } from '../utils/crypto'

export interface UploadRecordParams {
  file: File
  patientAddress: string
  recordType: 'lab' | 'imaging' | 'prescription' | 'discharge' | 'vaccination' | 'vitals'
  title: string
  billAmount?: number
}

export function useUploadRecord() {
  const { activeAddress, transactionSigner } = useWallet()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const algorand = useMemo(() => getAlgorandClientFromViteEnvironment(), [])
  const medicalAppId = useMemo(() => Number(import.meta.env.VITE_MEDICAL_RECORDS_APP_ID || 0), [])

  const uploadRecord = async (params: UploadRecordParams) => {
    if (!activeAddress) {
      setError('Wallet not connected')
      return null
    }

    if (medicalAppId === 0) {
      setError('Medical Records contract not configured. Check VITE_MEDICAL_RECORDS_APP_ID')
      return null
    }

    try {
      setLoading(true)
      setError(null)

      // Encrypt file using patient address as secret
      const { encryptedBlob, metadata } = await encryptFile(params.file, params.patientAddress)

      // Upload encrypted bundle to IPFS
      const cid = await uploadEncryptedFile(
        encryptedBlob,
        metadata,
        `${params.title}_${Date.now()}`
      )

      // Call smart contract — AlgoKit v9 auto-resolves box references via simulation
      const medicalClient = new MedicalRecordsClient({
        appId: BigInt(medicalAppId),
        algorand,
      })

      const result = await medicalClient.send.addRecord({
        args: {
          patient: params.patientAddress,
          cid,
          previousCid: '',
          recordType: params.recordType,
          billAmount: BigInt(params.billAmount || 0),
        },
        sender: activeAddress,
        signer: transactionSigner,
        populateAppCallResources: true,
      })

      setLoading(false)
      return { success: true, cid, txId: result.txIds?.[0] ?? null }
    } catch (err: any) {
      const errMsg = err.message || 'Failed to upload record'
      setError(errMsg)
      console.error('[useUploadRecord] Error:', err)
      setLoading(false)
      return null
    }
  }

  return { uploadRecord, loading, error }
}
