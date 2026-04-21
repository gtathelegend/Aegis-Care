import { useEffect, useState, useMemo } from 'react'
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
  const { activeAddress, transactionSigner } = useWallet()
  const [profile, setProfile] = useState<PatientProfile | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const algorand = useMemo(() => getAlgorandClientFromViteEnvironment(), [])
  const mapperId = useMemo(() => Number(import.meta.env.VITE_WALLET_MAPPER_APP_ID || 0), [])

  useEffect(() => {
    if (!activeAddress || mapperId === 0) return

    const fetchProfile = async () => {
      try {
        setLoading(true)
        const contract = new WalletMapperClient({ appId: BigInt(mapperId), algorand })
        const result = await contract.getShortIdFromWallet({
          args: { wallet: activeAddress },
          sender: activeAddress,
        })

        const shortIdBytes = result.return as Uint8Array
        const shortId = String.fromCharCode(...Array.from(shortIdBytes)).replace(/\0/g, '')

        if (shortId) {
          setProfile({
            shortId,
            walletAddress: activeAddress,
            name: 'Patient Name',
          })
        }
      } catch (err: any) {
        console.warn('Profile not found:', err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchProfile()
  }, [activeAddress, mapperId, algorand])

  const registerShortId = async (shortId: string) => {
    if (!activeAddress || !transactionSigner) {
      setError('Wallet not connected')
      return false
    }

    try {
      setLoading(true)
      setError(null)

      const shortIdBytes = new Uint8Array(6)
      const encoded = new TextEncoder().encode(shortId)
      shortIdBytes.set(encoded.slice(0, 6))

      const contract = new WalletMapperClient({ appId: BigInt(mapperId), algorand })
      await contract.send.registerShortId({
        args: { shortId: shortIdBytes },
        sender: activeAddress,
        signer: transactionSigner,
      })

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
