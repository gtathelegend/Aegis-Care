import { useState, useEffect, useCallback, useMemo } from 'react'
import { useWallet } from '@txnlab/use-wallet-react'
import { WalletMapperClient } from '../contracts/WalletMapper'
import { HealthcareRbacClient } from '../contracts/HealthcareRBAC'
import algosdk from 'algosdk'
import { getAlgorandClientFromViteEnvironment } from '../utils/network/getAlgoClientConfigs'

export type UserRole = 'patient' | 'hospital' | 'doctor' | 'lab' | 'pharmacy' | 'insurance' | 'auditor' | 'admin' | 'unknown'

const ROLE_BITS: Record<number, UserRole> = {
  1: 'hospital',
  2: 'doctor',
  4: 'lab',
  8: 'pharmacy',
  16: 'insurance',
  32: 'auditor',
}

export const ADMIN_WALLET = 'ZB4FKAVJU6E3ANTCSPPA5PSSIA35XUUA4O2GASDKZVDLUNZ4DMPLYJMVKM'

export const useRole = () => {
  const { activeAddress } = useWallet()

  const [role, setRole] = useState<UserRole>('unknown')
  const [roles, setRoles] = useState<UserRole[]>([])
  const [shortId, setShortId] = useState<string>('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [isVerified, setIsVerified] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Benificiary Proxy State
  const [proxyAddress, setProxyAddress] = useState<string | null>(sessionStorage.getItem('ojasraksha_proxy_addr'))
  const [proxyShortId, setProxyShortId] = useState<string | null>(sessionStorage.getItem('ojasraksha_proxy_id'))

  const enableProxy = useCallback((ownerAddress: string, ownerIdentifier: string) => {
      sessionStorage.setItem('ojasraksha_proxy_addr', ownerAddress)
      sessionStorage.setItem('ojasraksha_proxy_id', ownerIdentifier)
      setProxyAddress(ownerAddress)
      setProxyShortId(ownerIdentifier)
  }, [])

  const disableProxy = useCallback(() => {
      sessionStorage.removeItem('ojasraksha_proxy_addr')
      sessionStorage.removeItem('ojasraksha_proxy_id')
      setProxyAddress(null)
      setProxyShortId(null)
  }, [])


  const algorand = useMemo(() => getAlgorandClientFromViteEnvironment(), [])

  // Robustly load App IDs from env
  const mapperId = useMemo(() => Number(import.meta.env.VITE_WALLET_MAPPER_APP_ID || 0), [])
  const rbacId = useMemo(() => Number(import.meta.env.VITE_HEALTHCARE_RBAC_APP_ID || 0), [])

  const fetchIdentity = useCallback(async () => {
    if (!activeAddress) {
      setLoading(false)
      setError(null)
      setShortId('')
      setRole('unknown')
      setRoles([])
      setIsAdmin(false)
      setIsVerified(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      if (mapperId === 0) {
        throw new Error('SYSTEM_ERROR: WalletMapper ID missing.')
      }

      const walletIsAdmin = activeAddress === ADMIN_WALLET
      setIsAdmin(walletIsAdmin)

      // 1. Resolve Identity via WalletMapper Box Query 
      //    (Direct box fetch to bypass simulation assert logic eval traces)
      let resolvedShortId = ''
      try {
        const boxName = new Uint8Array([...new TextEncoder().encode('adr_'), ...algosdk.decodeAddress(activeAddress).publicKey])
        const boxResponse = await algorand.client.algod.getApplicationBoxByName(mapperId, boxName).do()
        if (boxResponse && boxResponse.value) {
           resolvedShortId = String.fromCharCode(...Array.from(boxResponse.value)).trim().replace(/\0/g, '')
           setShortId(resolvedShortId)
        }
      } catch (e: any) {
        console.debug('[useRole] Identity unresolved (Box empty). Proceeding as unregistered.')
      }

      // 2. Resolve Roles via HealthcareRBAC
      const detectedRoles: UserRole[] = ['patient']

      if (rbacId > 0) {
        try {
          const rbac = new HealthcareRbacClient({ 
            appId: BigInt(rbacId), 
            algorand 
          })

          const roleMask = await rbac.getRole({ 
            args: { wallet: activeAddress },
            sender: activeAddress 
          })

          if (roleMask > 0) {
            Object.entries(ROLE_BITS).forEach(([bit, roleName]) => {
              if (roleMask & Number(bit)) {
                detectedRoles.push(roleName as UserRole)
                setIsVerified(true)
              }
            })
          }
        } catch (e: any) {
          console.debug('[useRole] RBAC entry search failed.')
        }
      }

      // 3. Admin logic override
      if (walletIsAdmin) {
        if (!detectedRoles.includes('admin')) {
          detectedRoles.push('admin')
        }
        setIsVerified(true)
      }

      setRoles(detectedRoles)
      const primaryRole = walletIsAdmin ? 'admin' : (detectedRoles.find(r => r !== 'patient') ?? 'patient')
      setRole(primaryRole)

    } catch (err: any) {
      console.error('[useRole] Critical resolution failure:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [activeAddress, mapperId, rbacId, algorand])

  useEffect(() => {
    fetchIdentity()
  }, [activeAddress, fetchIdentity])

  return { 
    role, 
    roles, 
    shortId, 
    isAdmin, 
    isVerified, 
    loading, 
    error, 
    refresh: fetchIdentity,
    proxyAddress,
    proxyShortId,
    enableProxy,
    disableProxy,
    isProxyActive: !!proxyAddress
  }
}
