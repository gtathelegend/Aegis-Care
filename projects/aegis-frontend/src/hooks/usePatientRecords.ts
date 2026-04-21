import { useEffect, useState, useMemo } from 'react'
import { useWallet } from '@txnlab/use-wallet-react'
import { getAlgorandClientFromViteEnvironment } from '../utils/network/getAlgoClientConfigs'
import { MedicalRecordsClient } from '../contracts/MedicalRecordsClient'
import type { MedicalRecord } from '../lib/mockdb'

export function usePatientRecords(patientAddress?: string) {
  const { activeAddress } = useWallet()
  const [records, setRecords] = useState<MedicalRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const algorand = useMemo(() => getAlgorandClientFromViteEnvironment(), [])
  const appId = useMemo(() => Number(import.meta.env.VITE_MEDICAL_RECORDS_APP_ID || 0), [])

  useEffect(() => {
    if (!activeAddress || !patientAddress || appId === 0) return

    const fetchRecords = async () => {
      try {
        setLoading(true)
        setError(null)

        const contract = new MedicalRecordsClient({ appId: BigInt(appId), algorand })
        const result = await contract.getPatientRecords({
          args: { patient: patientAddress },
          sender: activeAddress,
        })

        setRecords((result.return as any) || [])
      } catch (err: any) {
        setError(err.message || 'Failed to fetch records')
        console.error('Error fetching patient records:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchRecords()
  }, [activeAddress, patientAddress, appId, algorand])

  return { records, loading, error }
}
