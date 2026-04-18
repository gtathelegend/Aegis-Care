import React, { useState, useMemo } from 'react'
import { useWallet } from '@txnlab/use-wallet-react'
import { useNavigate } from 'react-router-dom'
import { useRole, ADMIN_WALLET } from '../hooks/useRole'
import { getAlgorandClientFromViteEnvironment } from '../utils/network/getAlgoClientConfigs'
import { HealthcareRbacClient } from '../contracts/HealthcareRBACClient'
import { useSnackbar } from 'notistack'
import { MedicalRecordsClient } from '../contracts/MedicalRecordsClient'
import { DataFiduciaryRegistryClient } from '../contracts/DataFiduciaryRegistryClient'
import * as algokit from '@algorandfoundation/algokit-utils'
import { QueueManagerClient } from '../contracts/QueueManagerClient'
import { calcQueueRequestBox, calcFiduciaryBox, calcRoleBox } from '../utils/boxUtils'
import {
  ShieldCheck,
  ShieldX,
  UserCog,
  Building2,
  Stethoscope,
  FlaskConical,
  Pill,
  Shield,
  ClipboardList,
  Search,
  Loader2,
  ArrowLeft,
  CheckCircle2,
  Settings,
  LogOut,
  Fingerprint,
  ExternalLink,
  Activity
} from 'lucide-react'
import { fetchAuditLogs, AuditLogEntry } from '../utils/auditLog'
import { useEffect } from 'react'

const ROLE_OPTIONS = [
  { label: 'Hospital', value: 1, icon: Building2, color: 'teal' },
  { label: 'Doctor', value: 2, icon: Stethoscope, color: 'violet' },
  { label: 'Lab', value: 4, icon: FlaskConical, color: 'amber' },
  { label: 'Pharmacy', value: 8, icon: Pill, color: 'pink' },
  { label: 'Insurance', value: 16, icon: Shield, color: 'indigo' },
  { label: 'Auditor', value: 32, icon: ClipboardList, color: 'slate' },
] as const

const COLOR_MAP: Record<string, string> = {
  teal: 'from-teal-500 to-emerald-500',
  violet: 'from-violet-500 to-purple-500',
  amber: 'from-amber-500 to-orange-500',
  pink: 'from-pink-500 to-rose-500',
  indigo: 'from-indigo-500 to-blue-600',
  slate: 'from-slate-500 to-gray-600',
}

const AccessDenied: React.FC = () => {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="vercel-card max-w-md w-full text-center py-12">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-red-50 border border-red-100 rounded-2xl mb-6 mx-auto">
          <ShieldX size={32} className="text-red-500" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-3 tracking-tight">Access Denied</h1>
        <p className="text-gray-500 text-sm leading-relaxed mb-8 px-4">
          You are not authorized to access Admin controls. This area is restricted to the system administrator wallet only.
        </p>
        <div className="flex flex-col gap-3">
          <button onClick={() => navigate('/patient')} className="stripe-button-primary w-full py-3">
            Go to Dashboard
          </button>
          <button onClick={() => navigate(-1)} className="stripe-button-outline w-full py-3">
            <ArrowLeft size={16} /> Go Back
          </button>
        </div>
      </div>
    </div>
  )
}

interface RoleAssignmentResult {
  wallet: string
  roleMask: number
  roleLabels: string[]
  txId?: string
  error?: string
}

const AdminDashboard: React.FC = () => {
  const { activeAddress, transactionSigner, wallets } = useWallet()
  const { isAdmin, loading: roleLoading } = useRole()
  const navigate = useNavigate()
  const { enqueueSnackbar } = useSnackbar()
  const algorand = useMemo(() => getAlgorandClientFromViteEnvironment(), [])

  const RBAC_APP_ID = useMemo(() => Number(import.meta.env.VITE_HEALTHCARE_RBAC_APP_ID || 0), [])
  const MEDICAL_APP_ID = useMemo(() => Number(import.meta.env.VITE_MEDICAL_RECORDS_APP_ID || 0), [])
  const AUDIT_LOG_APP_ID = useMemo(() => Number(import.meta.env.VITE_AUDIT_LOG_APP_ID || import.meta.env.VITE_AUDITLOG_APP_ID || 0), [])
  const FID_REG_APP_ID = useMemo(() => Number(import.meta.env.VITE_DATA_FIDUCIARY_REGISTRY_APP_ID || 0), [])
  const QUEUE_APP_ID = useMemo(() => Number(import.meta.env.VITE_QUEUE_MANAGER_APP_ID || 0), [])

  const [activeTab, setActiveTab] = useState<'rbac' | 'fiduciary' | 'queue'>('rbac')

  const [targetWallet, setTargetWallet] = useState('')
  const [selectedRoles, setSelectedRoles] = useState<number[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [currentRoleMask, setCurrentRoleMask] = useState<number | null>(null)
  const [result, setResult] = useState<RoleAssignmentResult | null>(null)
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([])
  const [medicalAuditAppId, setMedicalAuditAppId] = useState<number | null>(null)
  const [isBootstrapping, setIsBootstrapping] = useState(false)

  useEffect(() => {
    if (activeAddress) {
      fetchAuditLogs(activeAddress).then(setAuditLogs)
      // Check bootstrap status
      if (MEDICAL_APP_ID > 0) {
        const medical = new MedicalRecordsClient({ appId: BigInt(MEDICAL_APP_ID), algorand })
        medical.appClient.getGlobalState().then(state => {
          if (state.audit_app) {
             setMedicalAuditAppId(Number(state.audit_app.value))
          }
        }).catch(err => console.error("Failed to fetch medical global state:", err))
      }
      
      const interval = setInterval(() => {
        fetchAuditLogs(activeAddress).then(setAuditLogs)
      }, 30000)
      return () => clearInterval(interval)
    }
    return undefined
  }, [activeAddress, MEDICAL_APP_ID, algorand])

  const handleDisconnect = () => {
    wallets.forEach(w => w.disconnect())
    window.location.replace('/')
  }

  if (roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Verifying Access…</p>
        </div>
      </div>
    )
  }

  if (!activeAddress || !isAdmin) {
    return <AccessDenied />
  }

  const toggleRole = (value: number) => {
    setSelectedRoles(prev =>
      prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
    )
  }

  const computedMask = selectedRoles.reduce((acc, val) => acc | val, 0)

  const handleLookup = async () => {
    if (!targetWallet.trim() || RBAC_APP_ID === 0) return
    setLookupLoading(true)
    setCurrentRoleMask(null)
    setSelectedRoles([])
    try {
      const rbac = new HealthcareRbacClient({ 
        appId: BigInt(RBAC_APP_ID), 
        algorand 
      })

      const response = await rbac.getRole({ 
        args: { wallet: targetWallet.trim() },
        sender: activeAddress 
      })
      const mask = Number(response)
      setCurrentRoleMask(mask)
      const existing = ROLE_OPTIONS.filter(r => mask & r.value).map(r => r.value)
      setSelectedRoles(existing)
    } catch (e: any) {
      setCurrentRoleMask(0)
      enqueueSnackbar('No role found for this address.', { variant: 'info' })
    } finally {
      setLookupLoading(false)
    }
  }

  const handleAssignRole = async () => {
    if (RBAC_APP_ID === 0 || !import.meta.env.VITE_HEALTHCARE_RBAC_APP_ID || import.meta.env.VITE_HEALTHCARE_RBAC_APP_ID === 'YOUR_DEPLOYED_APP_ID') {
        enqueueSnackbar('RBAC App ID not found in system environment.', { variant: 'error' })
        return
    }

    if (!targetWallet.trim() || computedMask === 0 || !transactionSigner) return
    
    setIsSubmitting(true)
    setResult(null)
    
    try {
      algorand.setSigner(activeAddress, transactionSigner)
      const rbac = new HealthcareRbacClient({ 
        appId: BigInt(RBAC_APP_ID), 
        algorand 
      })

      const walletAddress = targetWallet.trim()
      
      // Check target wallet balance
      let needsFunding = false
      try {
        const accountInfo = await algorand.account.getInformation(walletAddress)
        const balance = accountInfo.balance.microAlgos
        // If balance < 0.2 ALGO, we fund it with 3 ALGO for MBR and startup gas
        if (balance < 200_000n) {
          needsFunding = true
        }
      } catch (e) {
        // If account not found, it definitely needs funding
        needsFunding = true
      }

      // Check Admin balance if funding is needed
      if (needsFunding) {
        try {
          const adminInfo = await algorand.account.getInformation(activeAddress)
          if (adminInfo.balance.microAlgos < 3_100_000n) {
            enqueueSnackbar(`Your admin wallet (${activeAddress.slice(0,6)}) has insufficient funds to provide the 3 ALGO stipend.`, { variant: 'warning' })
          }
        } catch (e) {
           // Admin info should be available if they are logged in and transacting
        }
      }

      let txResult: any
      try {
          if (needsFunding) {
            enqueueSnackbar(`Account ${walletAddress.slice(0, 6)} is uninitialized. Bundling 3 ALGO funding from ${activeAddress.slice(0,6)}.`, { variant: 'info' })
            
            const composer = algorand.newGroup()
            
            // 1. Payment for MBR (3 ALGO)
            composer.addPayment({
              sender: activeAddress,
              receiver: walletAddress,
              amount: algokit.microAlgos(3_000_000),
            })

            // 2. RBAC Registration
            const box = calcRoleBox(walletAddress)
            if (currentRoleMask !== null && currentRoleMask > 0) {
              composer.addAppCallMethodCall(await rbac.params.updateRole({
                args: { user: walletAddress, role: computedMask },
                sender: activeAddress,
                boxReferences: [{ appId: BigInt(RBAC_APP_ID), name: box }]
              }))
            } else {
              composer.addAppCallMethodCall(await rbac.params.registerRole({
                args: { user: walletAddress, role: computedMask },
                sender: activeAddress,
                boxReferences: [{ appId: BigInt(RBAC_APP_ID), name: box }]
              }))
            }

            txResult = await composer.send()
          } else {
            const box = calcRoleBox(walletAddress)
            if (currentRoleMask !== null && currentRoleMask > 0) {
              txResult = await rbac.send.updateRole({
                args: { user: walletAddress, role: computedMask },
                sender: activeAddress,
                boxReferences: [{ appId: BigInt(RBAC_APP_ID), name: box }]
              })
            } else {
              txResult = await rbac.send.registerRole({
                args: { user: walletAddress, role: computedMask },
                sender: activeAddress,
                boxReferences: [{ appId: BigInt(RBAC_APP_ID), name: box }]
              })
            }
          }
          
          const roleLabels = ROLE_OPTIONS.filter(r => computedMask & r.value).map(r => r.label)
          setResult({
            wallet: walletAddress,
            roleMask: computedMask,
            roleLabels,
            txId: txResult?.txId,
          })
          setCurrentRoleMask(computedMask)
          enqueueSnackbar('RBAC identity mapped successfully', { variant: 'success' })

      } catch (txErr: any) {
          console.error('[AdminDashboard] Transaction failed:', txErr)
          enqueueSnackbar('Role assignment failed — contact protocol team.', { variant: 'error' })
          setResult({ wallet: targetWallet, roleMask: computedMask, roleLabels: [], error: 'Transaction failed.' })
      }

    } catch (e: any) {
      console.error('[AdminDashboard] Global failure:', e)
      enqueueSnackbar('Fatal error during role assignment.', { variant: 'error' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleBootstrapMedical = async () => {
    if (MEDICAL_APP_ID === 0 || AUDIT_LOG_APP_ID === 0 || !transactionSigner) return
    setIsBootstrapping(true)
    try {
       const medical = new MedicalRecordsClient({ appId: BigInt(MEDICAL_APP_ID), algorand })
       await medical.send.bootstrap({
           args: { auditAppId: BigInt(AUDIT_LOG_APP_ID) },
           sender: activeAddress,
           signer: transactionSigner
       })
       setMedicalAuditAppId(AUDIT_LOG_APP_ID)
       enqueueSnackbar('MedicalRecords contract bootstrapped with AuditLog successfully.', { variant: 'success' })
    } catch (e: any) {
       console.error('[AdminDashboard] Bootstrap failed:', e)
       enqueueSnackbar(`Bootstrap failed: ${e.message}`, { variant: 'error' })
    } finally {
       setIsBootstrapping(false)
    }
  }

  const handleFiduciaryAction = async (fiduciary: string, action: 'approve' | 'suspend' | 'revoke') => {
    if (FID_REG_APP_ID === 0 || !transactionSigner) return
    setIsSubmitting(true)
    try {
        const client = new DataFiduciaryRegistryClient({ appId: BigInt(FID_REG_APP_ID), algorand })
        const box = calcFiduciaryBox(fiduciary)
        
        // Auto-fund if approving a new fiduciary
        if (action === 'approve') {
          try {
            const info = await algorand.account.getInformation(fiduciary)
            if (info.balance.microAlgos < 200_000n) {
              enqueueSnackbar('Fiduciary account uninitialized. Bundling 3 ALGO funding.', { variant: 'info' })
              await algorand.send.payment({ sender: activeAddress, receiver: fiduciary, amount: algokit.microAlgos(3_000_000) })
            }
          } catch (e) {
             enqueueSnackbar('Fiduciary account uninitialized. Bundling 3 ALGO funding.', { variant: 'info' })
             await algorand.send.payment({ sender: activeAddress, receiver: fiduciary, amount: algokit.microAlgos(3_000_000) })
          }
        }
        
        if (action === 'approve') await client.send.approveFiduciary({ args: { fiduciary }, sender: activeAddress, signer: transactionSigner, boxReferences: [{ appId: BigInt(FID_REG_APP_ID), name: box }] })
        if (action === 'suspend') await client.send.suspendFiduciary({ args: { fiduciary }, sender: activeAddress, signer: transactionSigner, boxReferences: [{ appId: BigInt(FID_REG_APP_ID), name: box }] })
        if (action === 'revoke') await client.send.revokeFiduciary({ args: { fiduciary }, sender: activeAddress, signer: transactionSigner, boxReferences: [{ appId: BigInt(FID_REG_APP_ID), name: box }] })
        
        enqueueSnackbar(`Fiduciary ${action}d successfully.`, { variant: 'success' })
    } catch (e: any) {
        enqueueSnackbar(`Action failed: ${e.message}`, { variant: 'error' })
    } finally {
        setIsSubmitting(false)
    }
  }

  const handleQueueOverride = async (requestId: bigint, action: 'approve' | 'reject') => {
    if (QUEUE_APP_ID === 0 || !transactionSigner) return
    setIsSubmitting(true)
    try {
        const client = new QueueManagerClient({ appId: BigInt(QUEUE_APP_ID), algorand })
        const box = calcQueueRequestBox(requestId)
        
        if (action === 'approve') await client.send.approveRequest({ args: { requestId }, sender: activeAddress, signer: transactionSigner, boxReferences: [{ appId: BigInt(QUEUE_APP_ID), name: box }] })
        if (action === 'reject') await client.send.rejectRequest({ args: { requestId }, sender: activeAddress, signer: transactionSigner, boxReferences: [{ appId: BigInt(QUEUE_APP_ID), name: box }] })
        
        enqueueSnackbar(`Queue request ${action}ed successfully.`, { variant: 'success' })
    } catch (e: any) {
        enqueueSnackbar(`Override failed: ${e.message}`, { variant: 'error' })
    } finally {
        setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50/60 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-[350px] bg-gradient-to-br from-red-50 via-orange-50 to-transparent -z-10" />
      
      <header className="flex items-center justify-between px-8 py-5 border-b border-gray-100 bg-white/60 backdrop-blur-sm sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-600 to-rose-500 flex items-center justify-center text-white shadow-md">
            <ShieldCheck size={16} />
          </div>
          <div>
            <span className="font-bold text-gray-900 text-base tracking-tight">Admin Control Panel</span>
            <span className="ml-2 text-[10px] font-bold text-red-600 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full uppercase tracking-wider">
              Secure
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-full shadow-sm">
            <span className="font-mono text-xs font-semibold text-gray-600">
              {activeAddress.slice(0, 6)}...{activeAddress.slice(-4)}
            </span>
          </div>
          <button onClick={() => navigate('/patient')} className="text-sm text-gray-400 hover:text-gray-700 font-semibold flex items-center gap-1.5 transition-colors">
            <ArrowLeft size={15} /> Exit Panel
          </button>
          <button onClick={handleDisconnect} className="text-sm text-gray-400 hover:text-red-500 font-semibold flex items-center gap-1.5 transition-colors">
            <LogOut size={15} /> Disconnect
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <div className="mb-10 animate-fade-in-scale">
          <div className="inline-flex items-center gap-2 bg-red-50 text-red-600 text-xs font-bold px-3 py-1.5 rounded-full border border-red-100 mb-4">
            <Settings size={12} /> RBAC Management
          </div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight mb-2">Role Assignment</h1>
          <p className="text-gray-500 text-sm leading-relaxed max-w-lg">
            Map wallet addresses to system roles using the HealthcareRBAC on-chain contract. 
            Roles are stored as a bitmask — a wallet can hold multiple roles simultaneously.
          </p>
        </div>

        <div className="flex gap-4 mb-8">
            <button onClick={() => setActiveTab('rbac')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors ${activeTab === 'rbac' ? 'bg-red-500 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>RBAC</button>
            <button onClick={() => setActiveTab('fiduciary')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors ${activeTab === 'fiduciary' ? 'bg-red-500 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>Fiduciaries</button>
            <button onClick={() => setActiveTab('queue')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors ${activeTab === 'queue' ? 'bg-red-500 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>Global Queue</button>
        </div>

        {activeTab === 'rbac' && (
          <>
            <div className="vercel-card mb-8 animate-fade-in-scale">
              <h2 className="text-sm font-bold text-gray-700 mb-4 uppercase tracking-wider flex items-center gap-2">
                <UserCog size={15} className="text-gray-400" /> Role Bitmask Reference
              </h2>
              <div className="grid grid-cols-3 gap-3">
                {ROLE_OPTIONS.map(({ label, value, icon: Icon, color }) => (
                  <div key={value} className="flex items-center gap-2.5 p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${COLOR_MAP[color]} flex items-center justify-center text-white`}>
                      <Icon size={13} />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800 text-xs">{label}</p>
                      <p className="text-gray-400 text-[10px] font-mono">bit {value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="vercel-card animate-fade-in-scale">
              <h2 className="text-sm font-bold text-gray-700 mb-6 uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck size={15} className="text-gray-400" /> Assign System Roles
              </h2>

              <div className="mb-5">
                <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">Target Wallet Address</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={targetWallet}
                    onChange={e => setTargetWallet(e.target.value)}
                    placeholder="Enter wallet address…"
                    className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-mono text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all shadow-inner"
                  />
                  <button
                    onClick={handleLookup}
                    disabled={!targetWallet.trim() || lookupLoading}
                    className="stripe-button-outline px-5 rounded-xl disabled:opacity-50"
                  >
                    {lookupLoading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
                    Lookup
                  </button>
                </div>
                {currentRoleMask !== null && (
                  <p className="text-[11px] text-gray-400 mt-2 font-mono">
                    Current on-chain mask: <strong className="text-gray-700">{currentRoleMask}</strong>
                    {currentRoleMask === 0 ? ' (none)' : ` → ${ROLE_OPTIONS.filter(r => currentRoleMask & r.value).map(r => r.label).join(', ')}`}
                  </p>
                )}
              </div>

              <div className="mb-6">
                <label className="block text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wider">Select Roles</label>
                <div className="grid grid-cols-3 gap-2.5">
                  {ROLE_OPTIONS.map(({ label, value, icon: Icon, color }) => {
                    const active = selectedRoles.includes(value)
                    return (
                      <button
                        key={value}
                        onClick={() => toggleRole(value)}
                        className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 font-semibold text-xs transition-all duration-200
                          ${active ? 'border-red-500 bg-red-50 text-red-700 shadow-sm' : 'border-gray-100 bg-white text-gray-600 hover:bg-gray-50 hover:border-gray-200'}`}
                      >
                        <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${COLOR_MAP[color]} flex items-center justify-center text-white`}>
                          <Icon size={15} />
                        </div>
                        <span>{label}</span>
                        {active && <CheckCircle2 size={12} className="absolute top-2 right-2 text-red-500" />}
                      </button>
                    )
                  })}
                </div>
              </div>

              <button
                onClick={handleAssignRole}
                disabled={isSubmitting || !targetWallet.trim() || computedMask === 0}
                className="stripe-button-primary w-full py-4 text-sm font-black uppercase tracking-widest disabled:opacity-50 shadow-lg shadow-red-500/10 active:scale-95 transition-transform"
              >
                {(isSubmitting) ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" /> PROCESSING...
                  </span>
                ) : (
                  (currentRoleMask && currentRoleMask > 0) ? 'Update On-Chain Identity' : 'Register On-Chain Identity'
                )}
              </button>
            </div>
          </>
        )}

        {activeTab === 'fiduciary' && (
            <div className="vercel-card animate-fade-in-scale">
                <h2 className="text-sm font-bold text-gray-700 mb-6 uppercase tracking-wider flex items-center gap-2">
                    <Building2 size={15} className="text-gray-400" /> Fiduciary Management
                </h2>
                <div className="mb-6">
                    <input 
                        type="text" 
                        placeholder="Fiduciary Wallet to Manage" 
                        value={targetWallet}
                        onChange={e => setTargetWallet(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-mono mb-4"
                    />
                    <div className="grid grid-cols-3 gap-3">
                        <button onClick={() => handleFiduciaryAction(targetWallet, 'approve')} className="bg-emerald-600 text-white p-3 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-emerald-700 transition-colors">Approve</button>
                        <button onClick={() => handleFiduciaryAction(targetWallet, 'suspend')} className="bg-amber-600 text-white p-3 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-amber-700 transition-colors">Suspend</button>
                        <button onClick={() => handleFiduciaryAction(targetWallet, 'revoke')} className="bg-red-600 text-white p-3 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-red-700 transition-colors">Revoke</button>
                    </div>
                </div>
            </div>
        )}

        {activeTab === 'queue' && (
            <div className="vercel-card animate-fade-in-scale">
                <h2 className="text-sm font-bold text-gray-700 mb-6 uppercase tracking-wider flex items-center gap-2">
                    <Settings size={15} className="text-gray-400" /> Global Override Queue
                </h2>
                <div className="mb-6 space-y-4">
                    <div className="p-4 bg-red-50 border border-red-100 rounded-xl">
                        <p className="text-[10px] font-black text-red-600 uppercase mb-2">Policy Warning</p>
                        <p className="text-xs text-gray-600 mb-4">Admin overrides are meant for critical emergency response (DPDP Section 7 Clause 2). All overrides are logged with an immutable Emergency flag.</p>
                        <div className="flex gap-2">
                            <input 
                                type="number" 
                                placeholder="Request ID" 
                                id="override_id"
                                className="bg-white border p-2 rounded w-24 text-sm"
                            />
                            <button onClick={() => {
                                const id = (document.getElementById('override_id') as HTMLInputElement).value
                                handleQueueOverride(BigInt(id), 'approve')
                            }} className="bg-red-600 text-white px-4 rounded text-xs font-bold">Override Approval</button>
                        </div>
                    </div>
                </div>
            </div>
        )}



        {/* System Integrity & Bootstrap Section */}
        <div className="vercel-card mt-8 animate-fade-in-scale">
            <h2 className="text-sm font-bold text-gray-700 mb-6 uppercase tracking-wider flex items-center gap-2">
                <Settings size={15} className="text-gray-400" /> System Integrity & Bootstrap
            </h2>
            
            <div className="p-4 rounded-xl border border-gray-100 bg-gray-50 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-[11px] font-bold text-gray-900 uppercase tracking-wider">Medical Records Linkage</p>
                        <p className="text-[10px] text-gray-500">AuditLog Dependency Status</p>
                    </div>
                    {medicalAuditAppId !== null && medicalAuditAppId > 0 ? (
                        <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 border border-emerald-100 rounded-full">
                            <CheckCircle2 size={12} className="text-emerald-500" />
                            <span className="text-[10px] font-black text-emerald-600 uppercase">Synchronized (App: {medicalAuditAppId})</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 px-3 py-1 bg-amber-50 border border-amber-100 rounded-full">
                            <Activity size={12} className="text-amber-500" />
                            <span className="text-[10px] font-black text-amber-600 uppercase">Uninitialized</span>
                        </div>
                    )}
                </div>

                <div className="text-xs text-gray-500 leading-relaxed border-t border-gray-100 pt-4">
                    The MedicalRecords contract requires an explicit linkage to the global AuditLog contract to anchor cryptographic access footprints. 
                    If uninitialized, uploads will still succeed but footprints will not be indexed.
                </div>

                <button 
                   onClick={handleBootstrapMedical}
                   disabled={isBootstrapping || (medicalAuditAppId !== null && medicalAuditAppId === AUDIT_LOG_APP_ID)}
                   className="stripe-button-outline w-full py-3 text-[10px] font-black uppercase tracking-widest disabled:opacity-40"
                >
                   {isBootstrapping ? <Loader2 size={14} className="animate-spin" /> : <Settings size={14} />}
                   {medicalAuditAppId !== null && medicalAuditAppId > 0 ? 'Remap Audit Dependency' : 'Bootstrap Protocol Linkage'}
                </button>
            </div>
        </div>

        {result && (
          <div className={`mt-6 vercel-card animate-fade-in-scale ${result.error ? 'border-red-100 bg-red-50/30' : 'border-emerald-100 bg-emerald-50/30'}`}>
            <p className={`font-black uppercase tracking-widest text-[10px] mb-2 ${result.error ? 'text-red-500' : 'text-emerald-500'}`}>
              {result.error ? 'Security Protocol Failure' : 'On-Chain Sync Successful'}
            </p>
            <p className="text-xs text-gray-600 font-mono break-all leading-relaxed">
              {result.error || `TX Hash: ${result.txId}`}
            </p>
          </div>
        )}

        {/* Audit Log Section */}
        <div className="vercel-card mt-8 animate-fade-in-scale">
            <div className="flex items-center gap-2 mb-6 border-b border-gray-100 pb-4">
                <Fingerprint size={18} className="text-red-500" />
                <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Recent Admin Activity</h2>
            </div>
            {auditLogs.length > 0 ? (
                <div className="flex flex-col gap-3 overflow-y-auto max-h-[400px] pr-2">
                    {auditLogs.map((log) => (
                        <div key={log.id} className="p-3 bg-gray-50 border border-gray-100 rounded-xl flex flex-col gap-1 hover:border-gray-200 transition-colors">
                            <div className="flex justify-between items-center text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                <span className="text-red-600">{log.type}</span>
                                <span className="text-gray-500">{new Date(log.timestamp).toLocaleString()}</span>
                            </div>
                            <div className="text-[10px] font-bold text-gray-800">{log.provider}</div>
                            <p className="font-mono text-[9px] text-gray-400 break-all leading-tight">
                                "{log.purpose}"
                            </p>
                            <a 
                                href={`https://testnet.explorer.perawallet.app/tx/${log.txId}`} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-[8px] text-red-500 hover:underline mt-1 flex items-center gap-1"
                            >
                                <ExternalLink size={8} /> View on Explorer
                            </a>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                    <Activity size={28} className="text-gray-200 mb-3" />
                    <h3 className="text-gray-800 text-sm font-semibold mb-1">No Footprints</h3>
                    <p className="text-xs text-gray-400">No cryptographic actions detected for your admin node.</p>
                </div>
            )}
        </div>
      </main>
    </div>
  )
}

export default AdminDashboard
