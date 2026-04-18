import { useWallet } from '@txnlab/use-wallet-react'
import { useState, useMemo, useEffect, useCallback } from 'react'
import { Pill, QrCode, Search, FileCheck, CheckCircle2, AlertCircle, Database, Loader2, Clock, Fingerprint, ExternalLink, ShieldAlert, Lock, Unlock, ShoppingBag, Eye } from 'lucide-react'
import { useSnackbar } from 'notistack'
import { fetchAuditLogs, AuditLogEntry } from '../utils/auditLog'
import { ConsentManagerClient } from '../contracts/ConsentManagerClient'
import { MedicalRecordsClient } from '../contracts/MedicalRecordsClient'
import { QueueManagerClient } from '../contracts/QueueManagerClient'
import { getAlgorandClientFromViteEnvironment } from '../utils/network/getAlgoClientConfigs'
import { fetchFromIPFS } from '../utils/ipfs'
import { decryptData } from '../utils/crypto'
import { resolveAddress } from '../utils/resolveAddress'
import { calcMedicalRecordBox, calcConsentBox, calcAccessRequestBox, calcPrescriptionQueueBox } from '../utils/boxUtils'

const PharmacyDashboard = () => {
  const { activeAddress, transactionSigner } = useWallet()
  const { enqueueSnackbar } = useSnackbar()
  const [loading, setLoading] = useState(false)
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([])
  
  // Real Workflow State
  const [queue, setQueue] = useState<any[]>([])
  const [decryptedPrescs, setDecryptedPrescs] = useState<Record<string, string>>({})
  const [processingId, setProcessingId] = useState<string | null>(null)

  const algorand = useMemo(() => getAlgorandClientFromViteEnvironment(), [])
  const consentAppId = Number(import.meta.env.VITE_CONSENT_MANAGER_APP_ID || 0)
  const medicalAppId = Number(import.meta.env.VITE_MEDICAL_RECORDS_APP_ID || 0)
  const queueAppId = Number(import.meta.env.VITE_QUEUE_MANAGER_APP_ID || 0)

  const fetchQueue = useCallback(async () => {
    if (!activeAddress) return
    try {
      const medicalClient = new MedicalRecordsClient({ appId: BigInt(medicalAppId), algorand })
      
      // 1. Get queue length with flexible unwrapping
      const state = await medicalClient.appClient.getGlobalState()
      const queueLength = typeof state.queue_length === 'bigint' 
        ? state.queue_length 
        : (state.queue_length as any)?.value || 0n
      
      console.log(`[Pharmacy] Global Queue Length detected: ${queueLength.toString()}`)
      
      if (queueLength === 0n) {
        setQueue([])
        return
      }

      // 2. Prepare box references for the queue items (pq_0, pq_1, ...)
      const boxRefs = []
      for (let i = 0n; i < queueLength; i++) {
        boxRefs.push({ appId: BigInt(medicalAppId), name: calcPrescriptionQueueBox(i) })
      }

      const pendingResult = await medicalClient.send.getPendingPrescriptions({ 
        args: [],
        sender: activeAddress as string,
        signer: transactionSigner,
        boxReferences: boxRefs
      })
      
      const pendingQueue = pendingResult.return || []
      console.log(`[Pharmacy] Fetched ${pendingQueue.length} pending prescriptions.`)
      setQueue([...pendingQueue].reverse()) // Show newest first
    } catch (e: any) {
      console.error("[Pharmacy] Critical Queue Fetch Error", e)
      enqueueSnackbar(`Queue Sync Error: ${e.message}`, { variant: 'error' })
      setQueue([])
    }
  }, [activeAddress, medicalAppId, algorand])

  useEffect(() => {
    if (!activeAddress) return undefined
    
    fetchQueue()
    fetchAuditLogs(activeAddress).then(setAuditLogs)
    const interval = setInterval(() => {
      fetchQueue()
      fetchAuditLogs(activeAddress).then(setAuditLogs)
    }, 20000)
    
    return () => clearInterval(interval)
  }, [activeAddress, fetchQueue])

  const handleRequestAccess = async (patientAddr: string) => {
    if (!activeAddress || !transactionSigner) return
    setLoading(true)
    try {
      const queueClient = new QueueManagerClient({ appId: BigInt(queueAppId), algorand })
      
      await queueClient.send.submitRequest({
          args: { target: patientAddr, purpose: 'Dispense medication', isEmergency: false },
          sender: activeAddress,
          signer: transactionSigner,
      })
      
      enqueueSnackbar(`Access requested for prescription fulfillment.`, { variant: 'info' })
      fetchQueue()
    } catch (e: any) {
      enqueueSnackbar(`Request failed: ${e.message}`, { variant: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const handleDecrypt = async (recordId: bigint, patientAddr: string, cid: string) => {
    setProcessingId(recordId.toString())
    try {
      const consentClient = new ConsentManagerClient({ appId: BigInt(consentAppId), algorand })
      const consentBox = calcConsentBox(patientAddr)
      
      // 1. Verify Consent On-Chain
      // We check for 'Dispense medication' purpose specifically
      const consentsResult = await consentClient.send.getPatientConsents({ 
        args: { patient: patientAddr },
        sender: activeAddress as string,
        signer: transactionSigner,
        boxReferences: [{ appId: BigInt(consentAppId), name: consentBox }]
      })
      
      const consents = consentsResult.return || []
      
      // Find active consent for this pharmacy
      const hasConsent = consents.some((c: any) => 
        c[1] === activeAddress && 
        c[7] === true && 
        (c[2] === 'Dispense medication' || c[4] === 'All')
      )

      if (!hasConsent) {
        enqueueSnackbar('Access Denied: Patient has not approved consent yet.', { variant: 'error' })
        return
      }

      // 2. Fetch and Decrypt
      const encryptedData = await fetchFromIPFS(cid)
      const decrypted = await decryptData(encryptedData, patientAddr)
      
      setDecryptedPrescs(prev => ({ ...prev, [recordId.toString()]: decrypted }))
      enqueueSnackbar('Prescription decrypted successfully.', { variant: 'success' })
    } catch (e: any) {
      enqueueSnackbar(`Decryption failed: ${e.message}`, { variant: 'error' })
    } finally {
      setProcessingId(null)
    }
  }

  const handleDispense = async (recordId: bigint) => {
    if (!activeAddress || !transactionSigner) return
    setLoading(true)
    try {
      const medicalClient = new MedicalRecordsClient({ appId: BigInt(medicalAppId), algorand })
      
      // Since it marks as dispensed, it needs to update the pq_ box and potentially the pr_ box
      // We need to find which pq index this record_id corresponds to.
      // For this POC, we'll assume the user is clicking on a currently visible item.
      
      // We also need the patient address to update the record history
      const item = queue.find(q => q[0] === recordId)
      if (!item) return

      const patientAddr = item[1]
      const recordBox = calcMedicalRecordBox(patientAddr)
      
      // We also need to provide ALL pq_ boxes because the contract loops through them
      const state = await medicalClient.appClient.getGlobalState()
      const length = Number(state.queue_length?.value || 0n)
      const boxRefs = [{ appId: BigInt(medicalAppId), name: recordBox }]
      for (let i = 0; i < length; i++) {
         boxRefs.push({ appId: BigInt(medicalAppId), name: calcPrescriptionQueueBox(BigInt(i)) })
      }

      await medicalClient.send.markPrescriptionDispensed({
        args: { recordId, billAmount: 0n },
        sender: activeAddress,
        signer: transactionSigner,
        boxReferences: boxRefs
      })

      enqueueSnackbar(`Medication dispensed and record updated.`, { variant: 'success' })
      fetchQueue()
    } catch (e: any) {
      enqueueSnackbar(`Dispense failed: ${e.message}`, { variant: 'error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="animate-fade-in space-y-8">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-black mb-2 text-[#0F172A] flex items-center gap-3">
             <Pill className="text-emerald-500" /> Pharmaceutical Fulfillment
          </h1>
          <p className="text-[#64748B] text-sm">DPDP-Compliant secure prescription queue and dispensation.</p>
        </div>
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-100 px-4 py-2 rounded-2xl">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-black uppercase text-emerald-700 tracking-widest">Pharmacy Node Online</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <section className="lg:col-span-2 space-y-6">
           <div className="premium-card" style={{ padding: '2rem' }}>
              <div className="flex items-center justify-between mb-6 border-b pb-4">
                  <h2 className="font-bold text-lg flex items-center gap-2">
                    <ShoppingBag size={20} className="text-emerald-500" /> Global Prescription Queue
                  </h2>
                  <button onClick={fetchQueue} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                     <Clock size={16} className="text-[#64748B]" />
                  </button>
              </div>

              <div className="space-y-4">
                  {queue.length > 0 ? (
                      queue.map((item, idx) => {
                          const recordId = item[0]
                          const patientAddr = item[1]
                          const patientName = item[2]
                          const cid = item[3]
                          const isDispensed = item[4]
                          const isDecrypted = !!decryptedPrescs[recordId.toString()]

                          return (
                            <div key={recordId.toString()} className={`p-5 rounded-2xl border transition-all ${isDispensed ? 'bg-slate-50 border-slate-100 opacity-60' : 'bg-white border-border hover:border-emerald-200'}`}>
                                <div className="flex flex-col md:flex-row justify-between gap-4">
                                    <div className="flex gap-4">
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${isDispensed ? 'bg-slate-200' : 'bg-emerald-50'}`}>
                                            <Pill size={20} className={isDispensed ? 'text-slate-400' : 'text-emerald-500'} />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-bold text-[#0F172A]">{patientName}</h3>
                                                <span className="text-[10px] font-mono text-[#64748B]">{patientAddr.slice(0, 8)}...</span>
                                            </div>
                                            <p className="text-[10px] text-[#64748B] font-medium uppercase tracking-widest mt-1">ID: #{recordId.toString()} • CID: {cid.slice(0, 8)}...</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {isDispensed ? (
                                            <span className="px-3 py-1 bg-slate-100 text-slate-500 text-[10px] font-black rounded-full uppercase">Fulfilled</span>
                                        ) : !isDecrypted ? (
                                            <>
                                                <button 
                                                    onClick={() => handleRequestAccess(patientAddr)}
                                                    disabled={loading}
                                                    className="px-4 py-2 bg-slate-100 text-[#0F172A] text-[10px] font-bold rounded-xl hover:bg-emerald-50 transition-colors flex items-center gap-2"
                                                >
                                                    <Lock size={12} /> Request Access
                                                </button>
                                                <button 
                                                    onClick={() => handleDecrypt(recordId, patientAddr, cid)}
                                                    disabled={processingId === recordId.toString()}
                                                    className="px-4 py-2 bg-[#0F172A] text-white text-[10px] font-bold rounded-xl hover:bg-emerald-600 transition-colors flex items-center gap-2"
                                                >
                                                    {processingId === recordId.toString() ? <Loader2 size={12} className="animate-spin" /> : <Unlock size={12} />}
                                                    Verify & Decrypt
                                                </button>
                                            </>
                                        ) : (
                                            <button 
                                                onClick={() => handleDispense(recordId)}
                                                disabled={loading}
                                                className="px-6 py-2 bg-emerald-600 text-white text-[10px] font-black rounded-xl shadow-lg hover:shadow-emerald-200 transition-all uppercase tracking-widest flex items-center gap-2"
                                            >
                                                <ShoppingBag size={12} /> Dispense Medication
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {isDecrypted && (
                                    <div className="mt-4 p-4 bg-emerald-50/50 border border-emerald-100 rounded-xl animate-fade-in">
                                        <div className="flex items-center gap-2 mb-2 text-emerald-700">
                                            <Eye size={14} />
                                            <span className="text-[10px] font-black uppercase tracking-widest">Secret Prescription Content</span>
                                        </div>
                                        <div className="text-sm font-mono text-emerald-900 bg-white/70 p-3 rounded-lg border border-emerald-100">
                                            {decryptedPrescs[recordId.toString()]}
                                        </div>
                                    </div>
                                )}
                            </div>
                          )
                      })
                  ) : (
                      <div className="text-center py-16 opacity-40">
                          <Database size={48} className="mx-auto mb-4" />
                          <p className="font-bold text-sm">Pharmacy Queue Empty</p>
                          <p className="text-[10px] mt-1">Pending prescriptions will appear here in real-time.</p>
                      </div>
                  )}
              </div>
           </div>
        </section>

        <section className="space-y-6">
            <div className="premium-card p-8" style={{ padding: '2rem' }}>
                <div className="flex items-center gap-3 mb-6 border-b pb-4">
                  <Fingerprint size={20} className="text-emerald-500" />
                  <h3 className="font-bold text-md text-gray-900">Audit Trace</h3>
                </div>
                
                {auditLogs.length > 0 ? (
                    <div className="flex flex-col gap-3 overflow-y-auto max-h-[400px] pr-2">
                        {auditLogs.map((log) => (
                            <div key={log.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex flex-col gap-1 hover:border-emerald-100 transition-colors group">
                                <div className="flex justify-between items-center text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                                    <span className="text-emerald-600">{log.type}</span>
                                    <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                                </div>
                                <div className="text-[10px] font-bold text-slate-800">{log.provider}</div>
                                <p className="font-mono text-[9px] text-slate-400 break-all leading-tight">
                                    "{log.purpose}"
                                </p>
                                <a 
                                    href={`https://testnet.explorer.perawallet.app/tx/${log.txId}`} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-[8px] text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity mt-1 flex items-center gap-1"
                                >
                                    <ExternalLink size={8} /> Explorer Link
                                </a>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-6 text-center opacity-30">
                        <Fingerprint size={28} className="mb-2" />
                        <p className="text-[10px] font-bold uppercase tracking-widest">No Activity Records</p>
                    </div>
                )}
            </div>

            <div className="premium-card p-6 bg-[#0F172A] text-white" style={{ padding: '1.5rem' }}>
                 <div className="flex items-center gap-3 mb-4 text-emerald-400">
                    <ShieldAlert size={18} />
                    <span className="text-[10px] font-black uppercase tracking-widest">DPDP Compliance Mode</span>
                 </div>
                 <p className="text-[10px] text-slate-400 leading-relaxed">
                    This node is strictly enforcing purpose-based access. Decryption is only possible if active consent for "Dispense medication" is found on the Algorand blockchain.
                 </p>
            </div>
        </section>
      </div>
    </div>
  )
}

export default PharmacyDashboard
