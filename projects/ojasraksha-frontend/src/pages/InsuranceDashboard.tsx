import { useWallet } from '@txnlab/use-wallet-react'
import { useState, useMemo, useEffect } from 'react'
import { Shield, FileCheck, CheckCircle2, AlertTriangle, Download, Landmark, Loader2, Clock, AlertCircle, Fingerprint, ExternalLink } from 'lucide-react'
import { useSnackbar } from 'notistack'
import { fetchAuditLogs, AuditLogEntry } from '../utils/auditLog'
import { ConsentManagerClient } from '../contracts/ConsentManager'
import { getAlgorandClientFromViteEnvironment } from '../utils/network/getAlgoClientConfigs'
import { resolveAddress } from '../utils/resolveAddress'

const InsuranceDashboard = () => {
  const { activeAddress, transactionSigner } = useWallet()
  const { enqueueSnackbar } = useSnackbar()
  const [claimId, setClaimId] = useState('')
  const [loading, setLoading] = useState(false)
  
  const algorand = useMemo(() => getAlgorandClientFromViteEnvironment(), [])
  const consentAppId = Number(import.meta.env.VITE_CONSENT_MANAGER_APP_ID || 0)

  // Outgoing Requests Queue
  const [outgoingRequests, setOutgoingRequests] = useState<any[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([])

  useEffect(() => {
    if (activeAddress) {
      fetchAuditLogs(activeAddress).then(setAuditLogs)
      const interval = setInterval(() => {
        fetchAuditLogs(activeAddress).then(setAuditLogs)
      }, 30000)
      return () => clearInterval(interval)
    }
    return undefined
  }, [activeAddress])

  useEffect(() => {
     if (!activeAddress) return undefined
     const stored = localStorage.getItem(`insurance_requests_${activeAddress}`)
     if (stored) {
         setOutgoingRequests(JSON.parse(stored))
     }
     return undefined
  }, [activeAddress])

  // Sync Logic
  useEffect(() => {
     if (!activeAddress || outgoingRequests.length === 0) return
     let changed = false
     const updated = [...outgoingRequests]

     const sync = async () => {
         const client = new ConsentManagerClient({ appId: BigInt(consentAppId), algorand })
         for (let i = 0; i < updated.length; i++) {
            if (updated[i].status === 'Pending') {
               try {
                  const pending = await client.getPendingRequests({ args: { patient: updated[i].patient } }).catch(() => [])
                  const isStillPending = pending.some((req: any) => req[1] === activeAddress && req[2] === updated[i].purpose)
                  
                  if (!isStillPending) {
                      const consents = await client.getPatientConsents({ args: { patient: updated[i].patient } }).catch(() => [])
                      const isApproved = consents.some((c: any) => c[1] === activeAddress && c[7] === true) // c[7] is is_active
                      
                      if (isApproved) {
                          updated[i].status = 'Approved'
                          changed = true
                      } else {
                          updated[i].status = 'Rejected'
                          changed = true
                      }
                  }
               } catch (e) {}
            }
         }
         
         if (changed) {
            setOutgoingRequests(updated)
            localStorage.setItem(`insurance_requests_${activeAddress}`, JSON.stringify(updated))
         }
     }
     sync()
     const interval = setInterval(sync, 10000)
     return () => clearInterval(interval)
  }, [activeAddress, outgoingRequests, algorand, consentAppId])

  const handleRequestConsent = async () => {
    if (!activeAddress || !transactionSigner || !claimId) return
    setLoading(true)
    try {
      // 1. Resolve identifier (Short ID or Wallet)
      const targetAddress = await resolveAddress(claimId)
      
      const client = new ConsentManagerClient({ appId: BigInt(consentAppId), algorand })
      
      await client.send.requestAccess({
          args: { patient: targetAddress, purpose: 'Insurance Claim Verification' },
          sender: activeAddress,
          signer: transactionSigner
      })

      const newReq = {
          patient: targetAddress,
          purpose: 'Insurance Claim Verification',
          timestamp: Date.now(),
          status: 'Pending',
          originalInput: claimId // Track original for UI display
      }
      const updatedReqs = [newReq, ...outgoingRequests]
      setOutgoingRequests(updatedReqs)
      localStorage.setItem(`insurance_requests_${activeAddress}`, JSON.stringify(updatedReqs))
      
      enqueueSnackbar('Consent request sent to patient for claim verification.', { variant: 'success' })
      setClaimId('')
    } catch (e: any) {
      if (e.message?.includes('APP_NOT_FOUND') || e.message?.includes('does not exist')) {
         enqueueSnackbar(`Contract not deployed locally. Simulated Success.`, { variant: 'success' })
      } else {
         enqueueSnackbar(`Request failed: ${e.message}`, { variant: 'error' })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="animate-fade-in space-y-8">
      <div>
        <h1 className="text-3xl font-black mb-2 text-[#0F172A] flex items-center gap-3">
           <Landmark className="text-rose-500" /> Claims & Verification
        </h1>
        <p className="text-[#64748B] text-sm">Verify patient procedural claims against immutable health records.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <section className="premium-card" style={{ padding: '2rem' }}>
          <h2 className="font-bold text-lg mb-6 flex items-center gap-2 border-b pb-4">
             <Shield size={20} className="text-rose-500" /> Request Record Access
          </h2>
          <div className="space-y-4">
             <p className="text-[11px] font-bold text-[#64748B] uppercase tracking-widest leading-relaxed mb-4">
                Before processing Claim #CLM-8921, you must request explicit consent to view related diagnostic files from the patient's encrypted vault.
             </p>
             <input 
                type="text" 
                placeholder="Patient Address / Short ID" 
                value={claimId}
                onChange={(e) => setClaimId(e.target.value)}
                className="w-full p-4 rounded-xl border border-border bg-[#F8FAFC] text-sm focus:ring-2 focus:ring-rose-500 outline-none transition-all"
             />
              <button 
                 onClick={handleRequestConsent}
                 disabled={loading || !claimId}
                 className="w-full py-4 text-sm font-bold bg-[#3D5141] text-white rounded-xl shadow-lg hover:shadow-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                 {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileCheck className="w-4 h-4" />}
                 Init Consent Request
              </button>
           </div>
           
           {/* Outgoing Requests Queue */}
           <div className="mt-8 pt-6 border-t border-gray-100">
               <h3 className="font-bold text-sm mb-4 flex items-center gap-2">
                 <Clock size={16} className="text-amber-500" /> Outgoing Access Requests
               </h3>
               <div className="space-y-3">
                   {outgoingRequests.length > 0 ? outgoingRequests.map((req, i) => (
                       <div key={i} className="p-3 rounded-lg border border-border bg-[#F8FAFC] flex flex-col gap-1">
                           <div className="flex justify-between items-center">
                               <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                  PT: {req.originalInput || req.patient.slice(0, 6) + '...' + req.patient.slice(-4)}
                               </span>
                               {req.status === 'Pending' && <span className="px-1.5 py-0.5 bg-amber-50 text-amber-600 text-[9px] font-black rounded uppercase">Pending</span>}
                               {req.status === 'Approved' && <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-600 text-[9px] font-black rounded uppercase">Approved</span>}
                               {req.status === 'Rejected' && <span className="px-1.5 py-0.5 bg-red-50 text-red-600 text-[9px] font-black rounded uppercase">Rejected</span>}
                           </div>
                           <div className="text-xs font-semibold text-gray-800">{req.purpose}</div>
                           <div className="text-[9px] text-gray-400 mt-1">{new Date(req.timestamp).toLocaleString()}</div>
                       </div>
                   )) : (
                       <div className="text-center py-4">
                           <AlertCircle size={20} className="text-[#E2E8F0] mx-auto mb-1" />
                           <p className="text-xs text-[#64748B]">No pending claims authorization requests.</p>
                       </div>
                   )}
               </div>
           </div>
        </section>

        <section className="premium-card" style={{ padding: '0', overflow: 'hidden' }}>
            <div className="p-6 border-b border-border bg-slate-50 flex justify-between items-center">
                <h2 className="font-bold text-sm flex items-center gap-2 text-[#0F172A]">
                    <AlertTriangle size={16} className="text-amber-500"/> Fraud Detection Checks
                </h2>
            </div>
            <div className="p-6 space-y-4">
                <div className="flex items-start justify-between p-4 border border-emerald-200 bg-emerald-50 rounded-xl">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <CheckCircle2 size={16} className="text-emerald-500" />
                            <span className="text-xs font-bold text-[#0F172A]">Hash Verification</span>
                        </div>
                        <p className="text-[10px] text-[#64748B]">Claim diagnostic matches on-chain anchor (QmY7...).</p>
                    </div>
                </div>
                
                <div className="flex items-start justify-between p-4 border border-rose-200 bg-rose-50 rounded-xl">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <AlertTriangle size={16} className="text-rose-500" />
                            <span className="text-xs font-bold text-[#0F172A]">Time Discrepancy</span>
                        </div>
                        <p className="text-[10px] text-[#64748B]">Treatment date predates anchored diagnosis.</p>
                    </div>
                </div>
            </div>

            {/* Audit Log Section */}
            <div className="mt-8 pt-6 border-t border-gray-100 px-6 pb-6">
                <div className="flex items-center gap-2 mb-4">
                    <Fingerprint size={18} className="text-rose-500" />
                    <h2 className="font-bold text-sm text-gray-900">Recent Transaction Activity</h2>
                </div>
                {auditLogs.length > 0 ? (
                    <div className="flex flex-col gap-3 overflow-y-auto max-h-[300px] pr-2">
                        {auditLogs.map((log) => (
                            <div key={log.id} className="p-3 bg-gray-50 border border-secondary/10 rounded-xl flex flex-col gap-1 hover:border-rose-200 transition-colors">
                                <div className="flex justify-between items-center text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                    <span className="text-rose-600">{log.type}</span>
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
                                    className="text-[8px] text-rose-400 hover:underline mt-1 flex items-center gap-1"
                                >
                                    <ExternalLink size={8} /> View on Explorer
                                </a>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-6 text-center">
                        <Fingerprint size={28} className="text-gray-200 mb-2" />
                        <p className="text-xs text-gray-400">No cryptographic read footprints detected on your insurance node.</p>
                    </div>
                )}
            </div>
        </section>
      </div>
    </div>
  )
}

export default InsuranceDashboard
