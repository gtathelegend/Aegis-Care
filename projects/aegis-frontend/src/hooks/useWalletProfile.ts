import { useEffect, useState } from 'react'
import { useWallet } from '@txnlab/use-wallet-react'
import { getAlgorandClientFromViteEnvironment } from '../utils/network/getAlgoClientConfigs'
import { WalletMapperClient } from '../contracts/WalletMapperClient'

export interface PatientProfile {
  shortId: string
  walletAddress: string
  name: string
  dateOfBirth?: string
  bloodType?: string
  allergies?: string[]
  emergencyContact?: {
    name: string
    phone: string
    relation: string
  }
}

export function useWalletProfile() {
  const { activeAddress, signer } = useWallet()
  const [profile, setProfile] = useState<PatientProfile | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch patient profile
  useEffect(() => {
    if (!activeAddress) return

    const fetchProfile = async () => {
      try {
        setLoading(true)
        const algodClient = await getAlgorandClientFromViteEnvironment()
        const contract = new WalletMapperClient({
          client: algodClient,
          sender: { addr: activeAddress, signer: undefined as any },
        })

        // Get short ID from wallet
        const shortId = await contract.getShortIdFromWallet({ wallet: activeAddress })

        if (shortId) {
          // In production, fetch full profile from IPFS via patient registry
          setProfile({
            shortId,
            walletAddress: activeAddress,
            name: 'Patient Name', // Would fetch from IPFS
          })
        }
      } catch (err: any) {
        console.warn('Profile not found:', err.message)
        // Profile may not exist yet — that's okay
      } finally {
        setLoading(false)
      }
    }

    fetchProfile()
  }, [activeAddress, signer])

  // Register new short ID
  const registerShortId = async (shortId: string) => {
    if (!activeAddress || !signer) {
      setError('Wallet not connected')
      return false
    }

    try {
      setLoading(true)
      setError(null)

      const algodClient = await getAlgorandClientFromViteEnvironment()
      const contract = new WalletMapperClient({
        client: algodClient,
        sender: { addr: activeAddress, signer },
      })

      await contract.registerShortId({ short_id: shortId })

      setProfile({
        shortId,
        walletAddress: activeAddress,
        name: 'Patient Name',
      })

      return true
    } catch (err: any) {
      setError(err.message || 'Failed to register short ID')
      console.error('Error registering short ID:', err)
      return false
    } finally {
      setLoading(false)
    }
  }

  // Get shareable profile URL with QR
  const getShareableUrl = () => {
    if (!profile) return null
    return `${window.location.origin}/share/${profile.shortId}?wallet=${profile.walletAddress}`
  }

  return {
    profile,
    loading,
    error,
    registerShortId,
    getShareableUrl,
  }
}
