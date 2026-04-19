import { useState } from 'react'
import { useWallet } from '@txnlab/use-wallet-react'
import { getAlgorandClientFromViteEnvironment } from '../utils/network/getAlgoClientConfigs'
import { MedicalRecordsClient } from '../contracts/MedicalRecordsClient'
import { uploadEncryptedFile } from '../utils/ipfs'
import { encryptData } from '../utils/crypto'

export interface UploadRecordParams {
  file: File
  patientAddress: string
  recordType: 'lab' | 'imaging' | 'prescription' | 'discharge' | 'vaccination' | 'vitals'
  title: string
  billAmount?: number
}

export function useUploadRecord() {
  const { activeAddress, signer } = useWallet()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const uploadRecord = async (params: UploadRecordParams) => {
    if (!activeAddress || !signer) {
      setError('Wallet not connected')
      return null
    }

    try {
      setLoading(true)
      setError(null)

      // Read file as ArrayBuffer
      const fileBuffer = await params.file.arrayBuffer()

      // Encrypt file data
      const encrypted = await encryptData(new Uint8Array(fileBuffer))

      // Upload encrypted file to Pinata
      const cid = await uploadEncryptedFile(
        new Blob([encrypted.ciphertext]),
        {
          iv: encrypted.iv,
          authTag: encrypted.authTag,
          algorithm: 'AES-256-GCM',
          size: params.file.size,
          name: params.title,
        },
        `${params.title}_${Date.now()}`
      )

      // Call contract to add record
      const algodClient = await getAlgorandClientFromViteEnvironment()
      const contract = new MedicalRecordsClient({
        client: algodClient,
        sender: { addr: activeAddress, signer },
      })

      await contract.addRecord({
        patient: params.patientAddress,
        provider: activeAddress,
        cid,
        previous_cid: '',
        record_type: params.recordType,
        title: params.title,
        bill_amount: params.billAmount || 0,
      })

      setLoading(false)
      return { success: true, cid }
    } catch (err: any) {
      const errMsg = err.message || 'Failed to upload record'
      setError(errMsg)
      console.error('Error uploading record:', err)
      return null
    }
  }

  return { uploadRecord, loading, error }
}
