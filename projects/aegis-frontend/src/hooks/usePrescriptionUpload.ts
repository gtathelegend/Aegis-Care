import { useState, useCallback, useMemo } from 'react'
import { useWallet } from '@txnlab/use-wallet-react'
import { MedicalRecordsClient } from '../contracts/MedicalRecords'
import { getAlgorandClientFromViteEnvironment } from '../utils/network/getAlgoClientConfigs'
import { uploadToIPFS } from '../utils/ipfs'
import { useSnackbar } from 'notistack'

export interface PrescriptionUploadParams {
  patientAddress: string
  patientName: string
  medication: string
  dosage: string
  instructions: string
  notes?: string
  providerName: string
}

export interface PrescriptionUploadState {
  uploading: boolean
  error: string | null
  success: boolean
  txId: string | null
  cid: string | null
  uploadPrescription: (params: PrescriptionUploadParams) => Promise<void>
  reset: () => void
}

export const usePrescriptionUpload = (): PrescriptionUploadState => {
  const { activeAddress, transactionSigner } = useWallet()
  const { enqueueSnackbar } = useSnackbar()

  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [txId, setTxId] = useState<string | null>(null)
  const [cid, setCid] = useState<string | null>(null)

  const algorand = useMemo(() => getAlgorandClientFromViteEnvironment(), [])
  const medicalAppId = useMemo(() => Number(import.meta.env.VITE_MEDICAL_RECORDS_APP_ID || 0), [])

  const uploadPrescription = useCallback(
    async (params: PrescriptionUploadParams) => {
      if (!activeAddress) {
        setError('Wallet not connected')
        enqueueSnackbar('Please connect your wallet first', { variant: 'error' })
        return
      }

      if (medicalAppId === 0) {
        setError('Medical Records contract not configured')
        enqueueSnackbar('Contract configuration error — check VITE_MEDICAL_RECORDS_APP_ID', { variant: 'error' })
        return
      }

      setUploading(true)
      setError(null)
      setSuccess(false)

      try {
        const prescriptionData = {
          type: 'prescription',
          patient: params.patientAddress,
          patientName: params.patientName,
          medication: params.medication,
          dosage: params.dosage,
          instructions: params.instructions,
          notes: params.notes || '',
          provider: params.providerName,
          timestamp: new Date().toISOString(),
        }

        const uploadedCid = await uploadToIPFS(
          JSON.stringify(prescriptionData, null, 2),
          `Prescription_${params.patientName}_${Date.now()}`
        )
        setCid(uploadedCid)

        const medicalClient = new MedicalRecordsClient({
          appId: BigInt(medicalAppId),
          algorand,
        })

        const result = await medicalClient.send.addPrescription({
          args: {
            patient: params.patientAddress,
            patientName: params.patientName,
            cid: uploadedCid,
          },
          sender: activeAddress,
          signer: transactionSigner,
          populateAppCallResources: true,
        })

        const confirmedTxId = result.txIds?.[0] ?? null
        setTxId(confirmedTxId)
        setSuccess(true)
        enqueueSnackbar(
          `Prescription uploaded! CID: ${uploadedCid.slice(0, 8)}... TX: ${confirmedTxId?.slice(0, 8) ?? 'n/a'}`,
          { variant: 'success' }
        )
      } catch (err: any) {
        const errorMessage = err.message || 'Failed to upload prescription'
        setError(errorMessage)
        enqueueSnackbar(errorMessage, { variant: 'error' })
        console.error('[usePrescriptionUpload] Error:', err)
      } finally {
        setUploading(false)
      }
    },
    [activeAddress, medicalAppId, algorand, enqueueSnackbar]
  )

  const reset = useCallback(() => {
    setError(null)
    setSuccess(false)
    setTxId(null)
    setCid(null)
  }, [])

  return {
    uploading,
    error,
    success,
    txId,
    cid,
    uploadPrescription,
    reset,
  }
}
