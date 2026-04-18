import { useWallet } from '@txnlab/use-wallet-react'
import { useState, useMemo, useEffect } from 'react'
import { getAlgorandClientFromViteEnvironment } from '../utils/network/getAlgoClientConfigs'
import { microAlgos } from '@algorandfoundation/algokit-utils'
import { fetchAuditLogs, AuditLogEntry } from '../utils/auditLog'
import { resolveAddress } from '../utils/resolveAddress'
import { MedicalRecordsClient } from '../contracts/MedicalRecordsClient'
import { uploadToIPFS } from '../utils/ipfs'
import { encryptData, decryptData } from '../utils/crypto'
import { ConsentManagerClient } from '../contracts/ConsentManagerClient'
import { QueueManagerClient } from '../contracts/QueueManagerClient'
import { useSnackbar } from 'notistack'
import { Fingerprint, ExternalLink, ShieldCheck, Database, Loader2, Plus, Users, Clock, AlertCircle, FileText, Activity, Search, User, Stethoscope, Lock, Pill, Eye, Globe } from 'lucide-react'
import { calcMedicalRecordBox, calcConsentBox, calcAccessRequestBox, calcPrescriptionQueueBox } from '../utils/boxUtils'
import FileViewer from '../components/FileViewer'

const DoctorDashboard = () => {
  const { activeAddress, transactionSigner } = useWallet()
  const { enqueueSnackbar } = useSnackbar()
  const [patientId, setPatientId] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'requests' | 'patients'>('requests')

  // Real Records State
  const [authorizedPatients, setAuthorizedPatients] = useState<any[]>([])
  const [patientDataLoading, setPatientDataLoading] = useState(false)

  // Upload Modal State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [selectedPatient, setSelectedPatient] = useState<string | null>(null)
  const [prescText, setPrescText] = useState('')
  const [isUploading, setIsUploading] = useState(false)

  const algorand = useMemo(() => getAlgorandClientFromViteEnvironment(), [])
  const consentAppId = Number(import.meta.env.VITE_CONSENT_MANAGER_APP_ID || 0)
  const recordsAppId = Number(import.meta.env.VITE_MEDICAL_RECORDS_APP_ID || 0)
  const queueAppId = Number(import.meta.env.VITE_QUEUE_MANAGER_APP_ID || 0)
  const [isEmergency, setIsEmergency] = useState(false)
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([])

  // Vault Viewer State
  const [viewingRecord, setViewingRecord] = useState<{ cid: string; patientAddress: string; recordType: string } | null>(null)

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

  // Outgoing Requests Queue (stored locally and synced with blockchain state)
  const [outgoingRequests, setOutgoingRequests] = useState<any[]>([])

  useEffect(() => {
     if (!activeAddress) return
     const stored = localStorage.getItem(`doctor_requests_${activeAddress}`)
     if (stored) {
         setOutgoingRequests(JSON.parse(stored))
     }
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
                  const pendingResult = await client.send.getPendingRequests({
                      args: { patient: updated[i].patient },
                      sender: activeAddress,
                      signer: transactionSigner,
                      boxReferences: [{ appId: BigInt(consentAppId), name: calcAccessRequestBox(updated[i].patient) }]
                  })
                  const pending = pendingResult.return || []
                  const isStillPending = pending.some((req: any) => req[1] === activeAddress && req[2] === updated[i].purpose)

                  if (!isStillPending) {
                      const consentsResult = await client.send.getPatientConsents({
                          args: { patient: updated[i].patient },
                          sender: activeAddress,
                          signer: transactionSigner,
                          boxReferences: [{ appId: BigInt(consentAppId), name: calcConsentBox(updated[i].patient) }]
                      })
                      const consents = consentsResult.return || []
                      const isApproved = consents.some((c: any) => c[1] === activeAddress && c[7] === true)

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
            localStorage.setItem(`doctor_requests_${activeAddress}`, JSON.stringify(updated))
         }
     }
     sync()
     const interval = setInterval(sync, 10000)
     return () => clearInterval(interval)
  }, [activeAddress, outgoingRequests, algorand, consentAppId, transactionSigner])

  const handleRequestAccess = async () => {
    if (!activeAddress || !transactionSigner || !patientId) return
    setLoading(true)
    try {
      const targetAddress = await resolveAddress(patientId)

      const client = new QueueManagerClient({ appId: BigInt(queueAppId), algorand })

      await client.send.submitRequest({
          args: {
              target: targetAddress,
              purpose: isEmergency ? 'EMERGENCY: Physician Override' : 'Physician Consultation',
              isEmergency: isEmergency
          },
          sender: activeAddress,
          signer: transactionSigner,
      })

      const newReq = {
          patient: targetAddress,
          originalInput: patientId,
          purpose: isEmergency ? 'EMERGENCY: Physician Override' : 'Physician Consultation',
          timestamp: Date.now(),
          status: 'Pending',
          type: isEmergency ? 'Emergency' : 'Normal'
      }
      const updatedReqs = [newReq, ...outgoingRequests]
      setOutgoingRequests(updatedReqs)
      localStorage.setItem(`doctor_requests_${activeAddress}`, JSON.stringify(updatedReqs))

      enqueueSnackbar(`Access request for ${patientId} securely anchored.`, { variant: 'success' })
      setPatientId('')
    } catch (e: any) {
      enqueueSnackbar(`Request failed: ${e.message}`, { variant: 'error' })
    } finally {
      setLoading(false)
    }
  }

  // Fetch data for authorized patients
  useEffect(() => {
    if (!activeAddress || outgoingRequests.length === 0) return

    const fetchAuthorizedData = async () => {
        const consentClient = new ConsentManagerClient({ appId: BigInt(consentAppId), algorand })
        const recordsClient = new MedicalRecordsClient({ appId: BigInt(recordsAppId), algorand })

        const authList: any[] = []

        for (const req of outgoingRequests) {
            try {
                 const consentBox = calcConsentBox(req.patient)
                 const consentsResult = await consentClient.send.getPatientConsents({
                     args: { patient: req.patient },
                     sender: activeAddress,
                     signer: transactionSigner,
                     boxReferences: [{ appId: BigInt(consentAppId), name: consentBox }]
                 })
                 const consents = consentsResult.return || []
                 const activeConsent = consents.find((c: any) => c[1] === activeAddress && c[7] === true)

                 if (activeConsent) {
                     const recordBox = calcMedicalRecordBox(req.patient)
                     const recordsResult = await recordsClient.send.getPatientRecords({
                         args: { patient: req.patient },
                         sender: activeAddress,
                         signer: transactionSigner,
                         boxReferences: [{ appId: BigInt(recordsAppId), name: recordBox }]
                     })
                     const records = recordsResult.return || []
                     authList.push({
                         address: req.patient,
                         shortId: req.originalInput.length === 6 ? req.originalInput : 'Verified',
                         records: records,
                         scope: activeConsent[4],
                         expiry: Number(activeConsent[6])
                     })
                 }
            } catch (e) {
                console.warn('Error fetching data for patient', req.patient, e)
            }
        }
        setAuthorizedPatients(authList)
    }

    fetchAuthorizedData()
  }, [activeAddress, outgoingRequests, algorand, consentAppId, recordsAppId])

  const handleUploadPrescription = async () => {
    if (!selectedPatient) { enqueueSnackbar('Please resolve a patient ID first.', { variant: 'warning' }); return }
    if (!prescText || !activeAddress || !transactionSigner) return
    setIsUploading(true)
    try {
        const encrypted = await encryptData(prescText, selectedPatient)
        const cid = await uploadToIPFS(encrypted)

        const client = new MedicalRecordsClient({ appId: BigInt(recordsAppId), algorand })
        const recordBox = calcMedicalRecordBox(selectedPatient)

        const state = await client.appClient.getGlobalState()
        const queueLength = typeof state.queue_length === 'bigint'
            ? state.queue_length
            : (state.queue_length as any)?.value || 0n

        console.log(`[Doctor] Using Prescription Index: ${queueLength.toString()}`)
        const pqBox = calcPrescriptionQueueBox(queueLength)

        await client.send.addPrescription({
            args: {
                patient: selectedPatient,
                patientName: `Patient_${selectedPatient.slice(0, 4)}`,
                cid: cid
            },
            sender: activeAddress,
            signer: transactionSigner,
            boxReferences: [
                { appId: BigInt(recordsAppId), name: recordBox },
                { appId: BigInt(recordsAppId), name: pqBox }
            ],
            extraFee: microAlgos(1000)
        })

        enqueueSnackbar('Prescription uploaded and anchored to IPFS.', { variant: 'success' })
        setIsUploadModalOpen(false)
        setPrescText('')
    } catch (e: any) {
        enqueueSnackbar(`Upload failed: ${e.message}`, { variant: 'error' })
    } finally {
        setIsUploading(false)
    }
  }

  return (
    <div className="animate-fade-in space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black mb-2 text-[#0F172A] flex items-center gap-3">
             <Stethoscope className="text-blue-500" /> Physician Portal
          </h1>
          <p className="text-[#64748B] text-sm">Request and view verified patient telemetry and clinical records.</p>
        </div>
        <button
          onClick={() => {
            setSelectedPatient(null)
            setIsUploadModalOpen(true)
          }}
          className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm shadow-lg hover:bg-blue-700 transition-all flex items-center gap-2"
        >
          <Plus size={18} /> Issue New Prescription
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="premium-card p-6" style={{ padding: '1.5rem' }}>
              <div className="flex items-center gap-3 mb-2 text-blue-600">
                  <Users size={18} />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#64748B]">Monitored Patients</span>
              </div>
              <div className="text-4xl font-black text-[#0F172A]">{outgoingRequests.length}</div>
          </div>
          <div className="premium-card p-6" style={{ padding: '1.5rem' }}>
              <div className="flex items-center gap-3 mb-2 text-emerald-600">
                  <ShieldCheck size={18} />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#64748B]">Active Consents</span>
              </div>
              <div className="text-4xl font-black text-[#0F172A]">{authorizedPatients.length}</div>
          </div>
           <div className="premium-card p-6" style={{ padding: '1.5rem' }}>
              <div className="flex items-center gap-3 mb-2 text-indigo-500">
                  <Pill size={18} />
                   <span className="text-[10px] font-bold uppercase tracking-widest text-[#64748B]">Prescriptions Issued</span>
              </div>
              <div className="text-4xl font-black text-[#0F172A]">
                  {auditLogs.filter((l: AuditLogEntry) => l.type.toLowerCase().includes('prescription')).length}
              </div>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section className="premium-card" style={{ padding: '2rem' }}>
          <h2 className="font-bold text-lg mb-6 flex items-center gap-2 border-b pb-4">
             <Pill size={20} className="text-blue-500" /> Direct Prescription Issuance
          </h2>
          <div className="space-y-4">
             <p className="text-xs text-[#64748B]">Resolve a Patient ID immediately to issue a DPDP-compliant prescription.</p>
             <div className="flex gap-2 items-center">
                <input
                   type="text"
                   placeholder="Patient Short ID or Wallet"
                   value={patientId}
                   onChange={(e) => setPatientId(e.target.value)}
                   className="flex-1 p-4 rounded-xl border border-border bg-[#F8FAFC] text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                />
                <label className="flex items-center gap-2 cursor-pointer bg-red-50 p-4 rounded-xl border border-red-100">
                    <input
                        type="checkbox"
                        checked={isEmergency}
                        onChange={(e) => setIsEmergency(e.target.checked)}
                        className="w-4 h-4 text-red-600 rounded"
                    />
                    <span className="text-[10px] font-black text-red-600 uppercase">Emergency</span>
                </label>
             </div>
             <div className="grid grid-cols-2 gap-3">
                <button
                    onClick={handleRequestAccess}
                    disabled={loading || !patientId}
                    className="py-4 text-[10px] font-black uppercase text-[#64748B] bg-white border border-gray-100 rounded-xl hover:bg-gray-50 flex items-center justify-center gap-2"
                >
                    {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                    Request Access
                </button>
                <button
                    onClick={async () => {
                        setLoading(true)
                        try {
                            const addr = await resolveAddress(patientId)
                            setSelectedPatient(addr)
                            setIsUploadModalOpen(true)
                        } catch (e: any) {
                            enqueueSnackbar('Invalid Patient ID', { variant: 'error' })
                        } finally {
                            setLoading(false)
                        }
                    }}
                    disabled={loading || !patientId}
                    className="py-4 text-[10px] font-black uppercase text-white bg-blue-600 rounded-xl shadow-md hover:bg-blue-700 flex items-center justify-center gap-2"
                >
                    <Plus className="w-3 h-3" /> Issue Presc.
                </button>
             </div>
          </div>
        </section>

        <section className="premium-card" style={{ padding: '2rem' }}>
          <div className="flex justify-between items-center border-b pb-4 mb-6">
             <h2 className="font-bold text-lg flex items-center gap-2">
                <FileText size={20} className="text-blue-500" /> Authorized Records
             </h2>
             <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-bold uppercase tracking-widest">End-to-End Encrypted</span>
          </div>

          <div className="space-y-4">
              {authorizedPatients.length > 0 ? (
                  authorizedPatients.map((p, i) => (
                      <div key={i} className="p-4 rounded-xl border border-border bg-white hover:border-blue-200 transition-colors cursor-pointer group">
                        <div className="flex justify-between items-start mb-2">
                           <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                                 <User size={14} className="text-[#64748B]" />
                              </div>
                              <div>
                                 <div className="text-xs font-bold">{p.shortId}</div>
                                 <div className="text-[9px] text-[#64748B] font-mono">{p.address.slice(0, 12)}...</div>
                              </div>
                           </div>
                           <div className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded uppercase tracking-tighter">DATA FETCHABLE</div>
                        </div>
                        <p className="text-[10px] text-[#64748B] mb-3 border-t pt-3 flex justify-between">
                            <span>Status: {p.scope} Access</span>
                            <span>Exp: {new Date(p.expiry * 1000).toLocaleDateString()}</span>
                        </p>

                        {/* Records List with Decrypt Buttons */}
                        {p.records.length > 0 && (
                          <div className="space-y-2 mb-3">
                            {p.records.map((rec: any, ri: number) => (
                              <div key={ri} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg border border-gray-100 text-xs">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded text-[9px] uppercase">{rec[5]}</span>
                                  <span className="font-mono text-gray-400 text-[9px]">
                                    <Globe size={9} className="inline mr-0.5" />
                                    {String(rec[3]).slice(0, 12)}...
                                  </span>
                                </div>
                                <button
                                  onClick={() => setViewingRecord({ cid: rec[3], patientAddress: p.address, recordType: rec[5] })}
                                  className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white rounded text-[9px] font-bold hover:bg-blue-700 transition-colors"
                                >
                                  <Eye size={10} /> Decrypt
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                         <div className="flex gap-2">
                           <button
                            onClick={() => {
                                if (p.records.length > 0) {
                                  setViewingRecord({ cid: p.records[0][3], patientAddress: p.address, recordType: p.records[0][4] })
                                } else {
                                  enqueueSnackbar('No records to view in this vault.', { variant: 'info' })
                                }
                            }}
                            className="flex-1 py-3 bg-[#F8FAFC] text-[10px] font-bold text-[#0F172A] rounded-lg border group-hover:bg-blue-50 transition-colors flex items-center justify-center gap-1"
                           >
                                <Eye size={12} /> View Vault ({p.records.length})
                           </button>
                           <button
                            onClick={() => {
                                setSelectedPatient(p.address)
                                setIsUploadModalOpen(true)
                            }}
                            className="flex-[1.5] py-3 bg-blue-600 text-[10px] font-black text-white rounded-lg shadow-md hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 uppercase"
                           >
                               <Plus size={12} /> Issue Presc.
                           </button>
                        </div>
                     </div>
                  ))
              ) : (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                      <Lock size={32} className="text-[#E2E8F0] mb-3" />
                      <h3 className="text-[#0F172A] text-sm font-semibold mb-1">No Active Consent</h3>
                      <p className="text-[10px] text-[#64748B] max-w-[200px]">Request access to a patient to see their live records here.</p>
                  </div>
              )}
          </div>
        </section>
      </div>

      {/* Outgoing Requests Queue */}
      <section className="premium-card" style={{ padding: '2rem' }}>
          <div className="flex justify-between items-center border-b pb-4 mb-6">
             <h2 className="font-bold text-lg flex items-center gap-2">
                <Clock size={20} className="text-blue-500" /> Outgoing Access Requests
             </h2>
          </div>

          {outgoingRequests.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {outgoingRequests.map((req, i) => (
                      <div key={i} className="p-4 rounded-xl border border-border bg-white flex flex-col gap-2">
                          <div className="flex justify-between items-start">
                             <div className="text-sm font-bold text-gray-900 border-b pb-1 mb-1">
                                Patient: {req.patient.slice(0, 10)}...
                             </div>
                             {req.status === 'Pending' && <span className="px-2 py-0.5 bg-amber-50 text-amber-600 text-[10px] font-bold rounded uppercase tracking-widest">Pending</span>}
                             {req.status === 'Approved' && <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[10px] font-bold rounded uppercase tracking-widest">Approved</span>}
                             {req.status === 'Rejected' && <span className="px-2 py-0.5 bg-red-50 text-red-600 text-[10px] font-bold rounded uppercase tracking-widest">Rejected</span>}
                          </div>
                          <div className="text-xs font-semibold text-gray-600 mt-1">Purpose: {req.purpose}</div>
                          <div className="text-[10px] text-gray-400 mt-2">{new Date(req.timestamp).toLocaleString()}</div>
                      </div>
                  ))}
              </div>
          ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                  <AlertCircle size={32} className="text-[#E2E8F0] mb-3" />
                  <h3 className="text-[#0F172A] text-sm font-semibold mb-1">No Outgoing Requests</h3>
                  <p className="text-xs text-[#64748B]">You haven't requested any patient records yet.</p>
              </div>
          )}
      </section>

      {/* Audit Log Section */}
      <section className="premium-card" style={{ padding: '2rem' }}>
          <div className="flex justify-between items-center border-b pb-4 mb-6">
             <h2 className="font-bold text-lg flex items-center gap-2 text-gray-900">
                <Fingerprint size={20} className="text-blue-500" /> Recent Transaction Activity
             </h2>
             <span className="text-[10px] font-black text-blue-300 uppercase tracking-widest border border-blue-100 px-2 py-0.5 rounded-full bg-blue-50/50">Blockchain Verified</span>
          </div>

          {auditLogs.length > 0 ? (
              <div className="space-y-3">
                  {auditLogs.map((log: AuditLogEntry) => (
                      <div key={log.id} className="p-4 rounded-xl border border-gray-100 bg-[#F8FAFC] hover:bg-white transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-full bg-white border border-gray-100 flex items-center justify-center text-blue-500 shadow-sm">
                                  <Activity size={18} />
                              </div>
                              <div>
                                  <div className="text-sm font-bold text-gray-900 uppercase tracking-tight">{log.type}</div>
                                  <div className="text-[10px] text-gray-400 font-mono font-bold uppercase">{log.provider}</div>
                              </div>
                          </div>

                          <div className="flex-1">
                              <p className="text-xs text-gray-600 italic">"{log.purpose}"</p>
                          </div>

                          <div className="flex items-center gap-6">
                              <div className="text-right">
                                  <div className="text-[10px] font-black text-gray-400">{new Date(log.timestamp).toLocaleDateString()}</div>
                                  <div className="text-[10px] text-gray-300">{new Date(log.timestamp).toLocaleTimeString()}</div>
                              </div>
                              <a
                                  href={`https://testnet.explorer.perawallet.app/tx/${log.txId}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-2 hover:bg-blue-50 rounded-lg text-blue-400 transition-colors"
                                  title="View on Explorer"
                              >
                                  <ExternalLink size={16} />
                              </a>
                          </div>
                      </div>
                  ))}
              </div>
          ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                  <Fingerprint size={32} className="text-[#E2E8F0] mb-3" />
                  <h3 className="text-[#0F172A] text-sm font-semibold mb-1">No Traceable Activity</h3>
                  <p className="text-xs text-[#64748B]">Your on-chain audit footprint is currently a clean state.</p>
              </div>
          )}
      </section>

      {/* Upload Modal */}
      {isUploadModalOpen && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-fade-in-scale">
                   <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-blue-50/30">
                       <div className="flex items-center gap-3">
                           <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white">
                               <Pill size={20} />
                           </div>
                           <div>
                               <h3 className="font-bold text-gray-900">Issue Digital Prescription</h3>
                               <p className="text-[10px] text-gray-500 font-medium">Patient Identifier: {selectedPatient || 'Awaiting Selection'}</p>
                           </div>
                       </div>
                       <button onClick={() => setIsUploadModalOpen(false)} className="text-gray-400 hover:text-gray-600">&times;</button>
                   </div>
                  <div className="p-6 space-y-4">
                      {!selectedPatient && (
                        <div>
                          <label className="block text-[10px] font-black uppercase text-gray-400 tracking-widest mb-2">Patient Short ID or Wallet</label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              placeholder="e.g. 903AKQ or full wallet address"
                              value={patientId}
                              onChange={(e) => setPatientId(e.target.value)}
                              className="flex-1 p-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                            <button
                              onClick={async () => {
                                try {
                                  const addr = await resolveAddress(patientId)
                                  setSelectedPatient(addr)
                                } catch {
                                  enqueueSnackbar('Invalid Patient ID', { variant: 'error' })
                                }
                              }}
                              className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700"
                            >
                              Resolve
                            </button>
                          </div>
                        </div>
                      )}
                      <label className="block text-[10px] font-black uppercase text-gray-400 tracking-widest">Prescription / Diagnostic Data</label>
                      <textarea
                        value={prescText}
                        onChange={(e) => setPrescText(e.target.value)}
                        placeholder="Enter medication details, dosage, or clinical observations..."
                        className="w-full h-40 p-4 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none transition-all font-mono"
                      />
                      <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl flex items-center gap-3">
                          <Lock size={16} className="text-emerald-600 shrink-0" />
                          <p className="text-[10px] text-emerald-700 font-medium leading-tight">
                              This data will be encrypted using the patient's public identifier before being anchored to Pinata IPFS.
                          </p>
                      </div>
                  </div>
                  <div className="p-6 bg-gray-50 flex gap-3">
                      <button
                        onClick={() => setIsUploadModalOpen(false)}
                        className="flex-1 py-3 text-xs font-bold text-gray-500 bg-white border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors"
                      >
                          Cancel
                      </button>
                      <button
                        onClick={handleUploadPrescription}
                        disabled={isUploading || !prescText}
                        className="flex-[2] py-3 text-xs font-black text-white bg-[#0F172A] rounded-xl shadow-lg hover:shadow-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 tracking-widest uppercase"
                      >
                          {isUploading ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                          Transmit to Ledger
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* FileViewer Modal */}
      {viewingRecord && (
        <FileViewer
          cid={viewingRecord.cid}
          patientAddress={viewingRecord.patientAddress}
          recordType={viewingRecord.recordType}
          onClose={() => setViewingRecord(null)}
        />
      )}
    </div>
  )
}

export default DoctorDashboard
