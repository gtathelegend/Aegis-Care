import { useEffect, useState } from 'react'
import { useWallet } from '@txnlab/use-wallet-react'
import { getAlgorandClientFromViteEnvironment } from '../utils/network/getAlgoClientConfigs'
import { MedicalRecordsClient } from '../contracts/MedicalRecordsClient'
import type { MedicalRecord } from '../lib/mockdb'

export function usePatientRecords(patientAddress?: string) {
  const { activeAddress } = useWallet()
  const [records, setRecords] = useState<MedicalRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!activeAddress || !patientAddress) return

    const fetchRecords = async () => {
      try {
        setLoading(true)
        setError(null)

        const algodClient = await getAlgorandClientFromViteEnvironment()
        const contract = new MedicalRecordsClient({
          client: algodClient,
          sender: { addr: activeAddress, signer: undefined as any },
        })

        // This would call the contract's get_patient_records method
        // For now, mock data integration — replace with actual contract call
        const contractRecords = await contract.getPatientRecords({ patient: patientAddress })

        // Transform contract records to match MedicalRecord type
        // This is placeholder — actual structure depends on contract return type
        setRecords(contractRecords as any || [])
      } catch (err: any) {
        setError(err.message || 'Failed to fetch records')
        console.error('Error fetching patient records:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchRecords()
  }, [activeAddress, patientAddress])

  return { records, loading, error }
}
