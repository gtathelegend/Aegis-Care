import { useState, useEffect, useCallback, useMemo } from 'react'
import { useWallet } from '@txnlab/use-wallet-react'
import { MedicalRecordsClient } from '../contracts/MedicalRecords'
import { QueueManagerClient } from '../contracts/QueueManager'
import { getAlgorandClientFromViteEnvironment } from '../utils/network/getAlgoClientConfigs'
import { fetchFromIPFS } from '../utils/ipfs'
import type { MedicalRecord, Patient } from '../lib/mockdb'
import { getPatientById } from '../lib/mockdb'

export interface MedicalRecordsHookState {
  records: MedicalRecord[]
  prescriptions: MedicalRecord[]
  allRecords: MedicalRecord[]
  requestQueue: any[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export const useMedicalRecords = (patientAddress: string | null, patient?: Patient): MedicalRecordsHookState => {
  const { activeAddress } = useWallet()
  const [records, setRecords] = useState<MedicalRecord[]>([])
  const [prescriptions, setPrescriptions] = useState<MedicalRecord[]>([])
  const [allRecords, setAllRecords] = useState<MedicalRecord[]>([])
  const [requestQueue, setRequestQueue] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const algorand = useMemo(() => getAlgorandClientFromViteEnvironment(), [])
  const medicalAppId = useMemo(() => Number(import.meta.env.VITE_MEDICAL_RECORDS_APP_ID || 0), [])
  const queueAppId = useMemo(() => Number(import.meta.env.VITE_QUEUE_MANAGER_APP_ID || 0), [])

  const fetchMedicalRecords = useCallback(async () => {
    if (!patientAddress) {
      setLoading(false)
      setError(null)
      setAllRecords([])
      setPrescriptions([])
      setRecords([])
      return
    }

    if (medicalAppId === 0) {
      setLoading(false)
      setError('MedicalRecords contract not configured. Check VITE_MEDICAL_RECORDS_APP_ID')
      setAllRecords([])
      setPrescriptions([])
      setRecords([])
      return
    }

    setLoading(true)
    setError(null)

    try {
      const medicalClient = new MedicalRecordsClient({
        appId: BigInt(medicalAppId),
        algorand,
      })

      console.debug('[useMedicalRecords] Fetching for patient:', patientAddress.slice(0, 6) + '...')

      // Fetch patient records from blockchain
      const contractRecords = await medicalClient.getPatientRecords({
        args: { patient: patientAddress },
        sender: activeAddress || patientAddress,
      })

      console.debug('[useMedicalRecords] Received records:', contractRecords?.length || 0)

      const enrichedRecords: MedicalRecord[] = []

      // Process contract records
      if (Array.isArray(contractRecords)) {
        for (const record of contractRecords) {
          try {
            const [id, patientAddr, providerAddr, cid, _, recordType, timestamp, billAmount] = record as any

            // Determine record type
            const typeStr = typeof recordType === 'string' ? recordType : ''
            let type: MedicalRecord['type'] = 'lab'
            if (typeStr.toLowerCase().includes('prescription')) type = 'prescription'
            else if (typeStr.toLowerCase().includes('imaging') || typeStr.toLowerCase().includes('scan')) type = 'imaging'
            else if (typeStr.toLowerCase().includes('discharge')) type = 'discharge'
            else if (typeStr.toLowerCase().includes('vaccin')) type = 'vaccination'
            else if (typeStr.toLowerCase().includes('vital')) type = 'vitals'

            const medRecord: MedicalRecord = {
              id: id?.toString() || Math.random().toString(),
              patientId: patient?.id || 'p1',
              type,
              title: `${type.charAt(0).toUpperCase() + type.slice(1)} Record #${id}`,
              description: `Record stored on IPFS: ${cid}`,
              uploadedBy: providerAddr === patientAddr ? patient?.name || 'Patient' : `${providerAddr.slice(0, 6)}...`,
              uploadedByRole: providerAddr === patientAddr ? 'Patient' : 'Provider',
              hospital: 'Algorand Network',
              date: new Date(Number(timestamp) * 1000).toLocaleDateString(),
              ipfsHash: cid,
              txHash: `0x${Math.random().toString(16).slice(2)}`,
              blockHeight: 29000000,
              encrypted: true,
              size: '12 KB',
              tags: [type],
              color: type === 'prescription' ? 'sky' : type === 'imaging' ? 'coral' : 'lime',
            }

            enrichedRecords.push(medRecord)
          } catch (err) {
            console.debug('[useMedicalRecords] Failed to enrich record:', err)
          }
        }
      }

      console.debug('[useMedicalRecords] Enriched records count:', enrichedRecords.length)
      setAllRecords(enrichedRecords)
      setPrescriptions(enrichedRecords.filter((r) => r.type === 'prescription'))
      setRecords(enrichedRecords.filter((r) => r.type !== 'prescription'))
    } catch (err: any) {
      console.error('[useMedicalRecords] Fetch failed:', {
        error: err.message,
        code: err.code,
        appId: medicalAppId,
        patient: patientAddress?.slice(0, 6),
      })
      const errorMsg = err.message?.includes('not found')
        ? 'Patient has no records yet'
        : err.message?.includes('app')
        ? 'Contract not found - verify VITE_MEDICAL_RECORDS_APP_ID'
        : err.message || 'Failed to fetch medical records'
      setError(errorMsg)
    } finally {
      setLoading(false)
    }
  }, [patientAddress, medicalAppId, algorand, activeAddress, patient])

  const fetchRequestQueue = useCallback(async () => {
    if (!patientAddress || queueAppId === 0) return

    try {
      const queueClient = new QueueManagerClient({
        appId: BigInt(queueAppId),
        algorand,
      })

      const queue = await queueClient.getPatientQueue({
        args: { patient: patientAddress },
        sender: activeAddress || patientAddress,
      })

      setRequestQueue(queue || [])
    } catch (err) {
      console.debug('[useMedicalRecords] Queue fetch failed:', err)
    }
  }, [patientAddress, queueAppId, algorand, activeAddress])

  const refetch = useCallback(async () => {
    await Promise.all([fetchMedicalRecords(), fetchRequestQueue()])
  }, [fetchMedicalRecords, fetchRequestQueue])

  useEffect(() => {
    refetch()
  }, [refetch])

  return {
    records,
    prescriptions,
    allRecords,
    requestQueue,
    loading,
    error,
    refetch,
  }
}
