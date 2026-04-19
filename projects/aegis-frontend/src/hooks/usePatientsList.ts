import { useState, useEffect, useCallback, useMemo } from 'react'
import { getAlgorandClientFromViteEnvironment } from '../utils/network/getAlgoClientConfigs'
import { patients } from '../lib/mockdb'

export interface PatientWithRecordCount {
  id: string
  name: string
  shortId: string
  walletAddress: string
  recordCount: number
  lastAccess: string
}

export interface PatientsListState {
  patients: PatientWithRecordCount[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export const usePatientsList = (): PatientsListState => {
  const [patientsList, setPatientsList] = useState<PatientWithRecordCount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const algorand = useMemo(() => getAlgorandClientFromViteEnvironment(), [])

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // For now, return mock patient list with counts
      // In production, this would query the blockchain for all accessible patients
      const enrichedPatients: PatientWithRecordCount[] = patients.map((p) => ({
        id: p.id,
        name: p.name,
        shortId: p.shortId,
        walletAddress: p.walletAddress,
        recordCount: Math.floor(Math.random() * 20) + 1,
        lastAccess: new Date(Date.now() - Math.random() * 86400000).toLocaleDateString(),
      }))

      setPatientsList(enrichedPatients)
    } catch (err: any) {
      console.error('[usePatientsList] Fetch failed:', err)
      setError(err.message || 'Failed to fetch patients list')
    } finally {
      setLoading(false)
    }
  }, [algorand])

  useEffect(() => {
    refetch()
  }, [refetch])

  return {
    patients: patientsList,
    loading,
    error,
    refetch,
  }
}
