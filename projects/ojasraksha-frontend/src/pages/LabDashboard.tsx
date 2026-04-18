import { useWallet } from '@txnlab/use-wallet-react'
import { useState, useMemo, useEffect, useRef } from 'react'
import {
  TestTube, Upload, PlusCircle, Activity, FileCheck, CheckCircle2,
  Loader2, Database, Clock, AlertCircle, Fingerprint, ExternalLink,
  Lock, FileText, Shield, X, AlertTriangle, Eye
} from 'lucide-react'
import { useSnackbar } from 'notistack'
import { fetchAuditLogs, AuditLogEntry } from '../utils/auditLog'
import { MedicalRecordsClient } from '../contracts/MedicalRecords'
import { ConsentManagerClient } from '../contracts/ConsentManager'
import { getAlgorandClientFromViteEnvironment } from '../utils/network/getAlgoClientConfigs'
import { microAlgos } from '@algorandfoundation/algokit-utils'
import { resolveAddress } from '../utils/resolveAddress'
import { uploadEncryptedFile, uploadToIPFS } from '../utils/ipfs'
import { encryptFile, encryptData } from '../utils/crypto'
import { calcMedicalRecordBox, calcConsentBox, calcAccessRequestBox } from '../utils/boxUtils'
import FileViewer from '../components/FileViewer'

// ─── Upload Status Types ────────────────────────────────────────────
type UploadStep = 'idle' | 'validating' | 'encrypting' | 'uploading' | 'anchoring' | 'done' | 'error'

const STEP_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  validating:  { label: 'Validating file...',           icon: Shield,       color: 'text-amber-500' },
  encrypting:  { label: 'Encrypting with AES-256-GCM...', icon: Lock,      color: 'text-violet-500' },
  uploading:   { label: 'Uploading to IPFS...',         icon: Upload,       color: 'text-blue-500' },
  anchoring:   { label: 'Anchoring to Algorand...',     icon: Database,     color: 'text-emerald-500' },
  done:        { label: 'Complete!',                    icon: CheckCircle2, color: 'text-emerald-600' },
  error:       { label: 'Upload failed',                icon: AlertTriangle, color: 'text-red-500' },
}

const ALLOWED_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'application/dicom',
  'application/octet-stream',
]
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

// ─── Step Indicator ─────────────────────────────────────────────────
function UploadStepper({ step, cid, txId, error }: {
  step: UploadStep; cid: string; txId: string; error: string
}) {
  const steps: UploadStep[] = ['validating', 'encrypting', 'uploading', 'anchoring', 'done']
  const activeIdx = steps.indexOf(step)

  if (step === 'idle') return null

  return (
    <div className="mt-6 p-5 bg-gradient-to-b from-slate-50 to-white border border-gray-100 rounded-2xl space-y-3 animate-fade-in">
      {steps.map((s, i) => {
        const cfg = STEP_CONFIG[s]
        let status: 'pending' | 'active' | 'done' = 'pending'
        if (step === 'error' && i === activeIdx) status = 'active'
        else if (i < activeIdx || step === 'done') status = 'done'
        else if (i === activeIdx) status = 'active'

        const Icon = step === 'error' && i === activeIdx ? AlertTriangle : cfg.icon
        return (
          <div key={s} className="flex items-center gap-3">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black transition-all duration-300 ${
              status === 'done'   ? 'bg-emerald-500 text-white' :
              status === 'active' ? `bg-white border-2 border-current ${step === 'error' ? 'text-red-500' : cfg.color} animate-pulse` :
                                    'bg-gray-100 text-gray-300'
            }`}>
              {status === 'done' ? <CheckCircle2 size={14} /> :
               status === 'active' ? <Icon size={14} className={step === 'error' ? 'text-red-500' : ''} /> :
               <span>{i + 1}</span>}
            </div>
            <span className={`text-sm font-medium transition-colors ${
              status === 'done'   ? 'text-emerald-600' :
              status === 'active' ? (step === 'error' ? 'text-red-600 font-bold' : 'text-gray-900 font-bold') :
                                    'text-gray-300'
            }`}>
              {step === 'error' && i === activeIdx ? 'Failed' : cfg.label}
            </span>
          </div>
        )
      })}

      {/* Results */}
      {step === 'done' && (
        <div className="mt-4 space-y-2 pt-4 border-t border-gray-100">
          {cid && (
            <div className="flex items-center gap-2 text-xs">
              <span className="font-bold text-gray-400 uppercase tracking-widest w-10">CID</span>
              <code className="flex-1 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg font-mono text-[11px] break-all">{cid}</code>
            </div>
          )}
          {txId && (
            <div className="flex items-center gap-2 text-xs">
              <span className="font-bold text-gray-400 uppercase tracking-widest w-10">TX</span>
              <a
                href={`https://testnet.explorer.perawallet.app/tx/${txId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg font-mono text-[11px] break-all hover:underline flex items-center gap-1"
              >
                {txId.slice(0, 24)}... <ExternalLink size={10} />
              </a>
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {step === 'error' && error && (
        <div className="mt-3 p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-700 font-medium">
          {error}
        </div>
      )}
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────
const LabDashboard = () => {
  const { activeAddress, transactionSigner } = useWallet()
  const { enqueueSnackbar } = useSnackbar()
  const [patientId, setPatientId] = useState('')
  const [reportType, setReportType] = useState('Blood Panel')
  const [loading, setLoading] = useState(false)
  const [recentAnchors, setRecentAnchors] = useState<any[]>([])

  // File state
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Upload stepper state
  const [uploadStep, setUploadStep] = useState<UploadStep>('idle')
  const [uploadCid, setUploadCid] = useState('')
  const [uploadTxId, setUploadTxId] = useState('')
  const [uploadError, setUploadError] = useState('')

  const algorand = useMemo(() => getAlgorandClientFromViteEnvironment(), [])
  const medicalAppId = Number(import.meta.env.VITE_MEDICAL_RECORDS_APP_ID || 0)
  const consentAppId = Number(import.meta.env.VITE_CONSENT_MANAGER_APP_ID || 0)

  // Outgoing Requests Queue
  const [requestPatientId, setRequestPatientId] = useState('')
  const [outgoingRequests, setOutgoingRequests] = useState<any[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([])

  // Modal State for Viewing Approved Data
  const [viewingCid, setViewingCid] = useState<string | null>(null)
  const [viewingPatientAddr, setViewingPatientAddr] = useState<string>('')

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
     const stored = localStorage.getItem(`lab_requests_${activeAddress}`)
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
            const req = updated[i]
            // Re-sync if pending OR if approved but CID is clearly wrong (contains spaces)
            if (req.status === 'Pending' || (req.status === 'Approved' && (!req.cid || req.cid.includes(' ')))) {
               try {
                   const accessRequestBox = calcAccessRequestBox(updated[i].patient)
                   const pendingResult = await client.send.getPendingRequests({
                       args: { patient: updated[i].patient },
                       sender: activeAddress as string,
                       signer: transactionSigner,
                       boxReferences: [{ appId: BigInt(consentAppId), name: accessRequestBox }]
                   }).catch(() => ({ return: [] }))
                   const pending = pendingResult.return || []
                   const isStillPending = pending.some((req: any) => req[1] === activeAddress && req[2] === updated[i].purpose)

                   if (!isStillPending) {
                       const consentBox = calcConsentBox(updated[i].patient)
                       const consentsResult = await client.send.getPatientConsents({
                           args: { patient: updated[i].patient },
                           sender: activeAddress as string,
                           signer: transactionSigner,
                           boxReferences: [{ appId: BigInt(consentAppId), name: consentBox }]
                       }).catch(() => ({ return: [] }))
                       const consents = consentsResult.return || []
                       const activeConsent = consents.find((c: any) => 
                           c[1] === activeAddress && 
                           c[7] === true && 
                           c[2] === req.purpose
                       )

                      if (activeConsent) {
                          updated[i].status = 'Approved'
                          updated[i].cid = activeConsent[3] // Linked CID (Index 3 in ConsentRecord)
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
            localStorage.setItem(`lab_requests_${activeAddress}`, JSON.stringify(updated))
         }
     }
     sync()
     const interval = setInterval(sync, 10000)
     return () => clearInterval(interval)
  }, [activeAddress, outgoingRequests, algorand, consentAppId])

  // ─── File Selection Handler ───────────────────────────────────────
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate type
    if (!ALLOWED_TYPES.includes(file.type) && !file.name.endsWith('.dcm')) {
      enqueueSnackbar(`Invalid file type: ${file.type || 'unknown'}. Allowed: PDF, PNG, JPEG, DICOM.`, { variant: 'error' })
      return
    }

    // Validate size
    if (file.size > MAX_FILE_SIZE) {
      enqueueSnackbar(`File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Maximum is 10MB.`, { variant: 'error' })
      return
    }

    setSelectedFile(file)
    setUploadStep('idle')
    setUploadCid('')
    setUploadTxId('')
    setUploadError('')
  }

  // ─── Request Access Handler ───────────────────────────────────────
  const handleRequestAccess = async () => {
    if (!activeAddress || !transactionSigner || !requestPatientId) return
    setLoading(true)
    try {
      const targetAddress = await resolveAddress(requestPatientId)
      const client = new ConsentManagerClient({ appId: BigInt(consentAppId), algorand })
      const accessRequestBox = calcAccessRequestBox(targetAddress)

      await client.send.requestAccess({
          args: { patient: targetAddress, purpose: `Diagnostic Lab Context: ${reportType}` },
          sender: activeAddress,
          signer: transactionSigner,
          boxReferences: [{ appId: BigInt(consentAppId), name: accessRequestBox }]
      })

      const newReq = {
          patient: targetAddress,
          originalInput: requestPatientId,
          purpose: `Diagnostic Lab Context: ${reportType}`,
          timestamp: Date.now(),
          status: 'Pending'
      }
      const updatedReqs = [newReq, ...outgoingRequests]
      setOutgoingRequests(updatedReqs)
      localStorage.setItem(`lab_requests_${activeAddress}`, JSON.stringify(updatedReqs))

      enqueueSnackbar(`Access request for ${requestPatientId} securely anchored.`, { variant: 'success' })
      setRequestPatientId('')
    } catch (e: any) {
      enqueueSnackbar(`Request failed: ${e.message}`, { variant: 'error' })
    } finally {
      setLoading(false)
    }
  }

  // ─── Upload Report Handler (Full Encrypted Pipeline) ──────────────
  const handleUploadReport = async () => {
    if (!activeAddress || !transactionSigner || !patientId) return

    setLoading(true)
    setUploadCid('')
    setUploadTxId('')
    setUploadError('')

    try {
      // ── Step 1: Validate ──
      setUploadStep('validating')
      const targetAddress = await resolveAddress(patientId)

      let realCID: string

      if (selectedFile) {
        // ── Step 2: Encrypt File ──
        setUploadStep('encrypting')
        const { encryptedBlob, metadata } = await encryptFile(selectedFile, targetAddress)

        // ── Step 3: Upload to IPFS ──
        setUploadStep('uploading')
        realCID = await uploadEncryptedFile(
          encryptedBlob,
          metadata,
          `${reportType}_${patientId.slice(0, 6)}`
        )
      } else {
        // Fallback: text-only encryption (no file selected)
        setUploadStep('encrypting')
        const encryptedData = await encryptData(
          `Report: ${reportType} generated by ${activeAddress}`,
          targetAddress
        )

        setUploadStep('uploading')
        realCID = await uploadToIPFS(encryptedData)
      }

      setUploadCid(realCID)

      // ── Step 4: Anchor on Algorand ──
      setUploadStep('anchoring')
      const client = new MedicalRecordsClient({ appId: BigInt(medicalAppId), algorand })
      const recordBox = calcMedicalRecordBox(targetAddress)

      const result = await client.send.addRecord({
          args: {
              patient: targetAddress,
              cid: realCID,
              previousCid: '',
              recordType: reportType,
              billAmount: BigInt(500)
          },
          sender: activeAddress as string,
          signer: transactionSigner,
          boxReferences: [{ appId: BigInt(medicalAppId), name: recordBox }],
          extraFee: microAlgos(1000)
      })

      const txId = result.transaction?.txID?.() || result.txIds?.[0] || ''
      setUploadTxId(txId)

      // ── Done ──
      setUploadStep('done')

      const newAnchor = {
          type: reportType,
          patient: patientId,
          cid: realCID,
          txId,
          fileName: selectedFile?.name || 'text_record',
          timestamp: Date.now()
      }
      setRecentAnchors([newAnchor, ...recentAnchors])

      enqueueSnackbar(`Report encrypted & anchored. CID: ${realCID.substring(0, 12)}...`, { variant: 'success' })
      setPatientId('')
      setSelectedFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''

    } catch (e: any) {
      setUploadError(e.message)
      setUploadStep('error')
      enqueueSnackbar(`Upload failed: ${e.message}`, { variant: 'error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="animate-fade-in space-y-8">
      <div>
        <h1 className="text-3xl font-black mb-2 text-[#0F172A] flex items-center gap-3">
           <TestTube className="text-violet-500" /> Laboratory Console
        </h1>
        <p className="text-[#64748B] text-sm">Upload encrypted diagnostic reports and generate IPFS anchors.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Upload Form */}
        <section className="premium-card" style={{ padding: '2rem' }}>
          <h2 className="font-bold text-lg mb-6 flex items-center gap-2 border-b pb-4">
             <Upload size={20} className="text-violet-500" /> Secure Report Upload
          </h2>
          <div className="space-y-4">
             <div>
                 <label className="text-xs font-bold text-[#64748B] uppercase tracking-widest mb-1 block">Patient Wallet / ID</label>
                 <input
                    type="text"
                    placeholder="Patient Identifier"
                    value={patientId}
                    onChange={(e) => setPatientId(e.target.value)}
                    className="w-full p-3 rounded-xl border border-border bg-[#F8FAFC] text-sm focus:ring-2 focus:ring-violet-500 outline-none transition-all"
                 />
             </div>
             <div>
                 <label className="text-xs font-bold text-[#64748B] uppercase tracking-widest mb-1 block">Report Type</label>
                 <select
                    value={reportType}
                    onChange={(e) => setReportType(e.target.value)}
                    className="w-full p-3 rounded-xl border border-border bg-[#F8FAFC] text-sm focus:ring-2 focus:ring-violet-500 outline-none transition-all"
                 >
                     <option>Blood Panel</option>
                     <option>MRI Scan</option>
                     <option>X-Ray</option>
                     <option>Genetic Sequence</option>
                     <option>Biopsy Result</option>
                 </select>
             </div>

             {/* Real File Input */}
             <div
               onClick={() => fileInputRef.current?.click()}
               className={`p-6 border-2 border-dashed rounded-xl text-center mt-2 group transition-all cursor-pointer ${
                 selectedFile
                   ? 'border-emerald-300 bg-emerald-50/50'
                   : 'border-border bg-[#F8FAFC] hover:border-violet-300'
               }`}
             >
                 <input
                   ref={fileInputRef}
                   type="file"
                   accept=".pdf,.png,.jpg,.jpeg,.dcm"
                   onChange={handleFileSelect}
                   className="hidden"
                   id="lab-file-input"
                 />

                 {selectedFile ? (
                   <div className="flex items-center justify-center gap-3">
                     <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                       <FileText size={20} className="text-emerald-600" />
                     </div>
                     <div className="text-left">
                       <p className="text-sm font-bold text-gray-900">{selectedFile.name}</p>
                       <p className="text-[10px] text-gray-500">
                         {(selectedFile.size / 1024).toFixed(1)} KB · {selectedFile.type || 'binary'}
                       </p>
                     </div>
                     <button
                       onClick={(e) => {
                         e.stopPropagation()
                         setSelectedFile(null)
                         if (fileInputRef.current) fileInputRef.current.value = ''
                       }}
                       className="ml-2 w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center hover:bg-red-100 transition-colors"
                     >
                       <X size={12} className="text-gray-600" />
                     </button>
                   </div>
                 ) : (
                   <>
                     <div className="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                        <PlusCircle size={24} className="text-violet-500" />
                     </div>
                     <p className="text-sm font-bold text-[#0F172A] mb-1">Select PDF, Image, or DICOM File</p>
                     <p className="text-[10px] text-[#64748B]">Max 10MB · File will be AES-256-GCM encrypted before IPFS transmission.</p>
                   </>
                 )}
             </div>

             {/* Encryption Notice */}
             <div className="flex items-center gap-3 p-3 bg-violet-50/50 border border-violet-100 rounded-xl">
               <Lock size={14} className="text-violet-500 shrink-0" />
               <p className="text-[10px] text-violet-700 font-medium leading-tight">
                 {selectedFile
                   ? `"${selectedFile.name}" will be encrypted with AES-256-GCM using the patient's wallet-derived key before uploading to Pinata IPFS.`
                   : 'Select a file to encrypt and upload, or submit without a file for a text-only record anchor.'
                 }
               </p>
             </div>

             <button
                onClick={handleUploadReport}
                disabled={loading || !patientId || uploadStep === 'done'}
                className="w-full py-4 mt-2 text-sm font-bold bg-[#3D5141] text-white rounded-xl shadow-lg hover:shadow-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
             >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                {selectedFile ? 'Encrypt & Anchor to Blockchain' : 'Anchor Text Record'}
             </button>

             {/* Upload Stepper */}
             <UploadStepper step={uploadStep} cid={uploadCid} txId={uploadTxId} error={uploadError} />
          </div>
        </section>

        {/* Right Column */}
        <section className="space-y-6">
            <div className="premium-card p-6" style={{ padding: '1.5rem' }}>
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3 text-violet-600">
                        <Activity size={18} />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[#64748B]">Session Uploads</span>
                    </div>
                    <span className="text-xs font-bold text-emerald-500 flex items-center gap-1"><CheckCircle2 size={12}/> Network Synced</span>
                </div>
                <div className="text-4xl font-black text-[#0F172A]">{recentAnchors.length}</div>
            </div>

            <div className="premium-card" style={{ padding: '2rem' }}>
                <h2 className="font-bold text-md mb-4 flex items-center gap-2 border-b pb-4">
                  <FileCheck size={18} className="text-[#64748B]" /> Recent Anchors
                </h2>
                <div className="space-y-3">
                    {recentAnchors.length > 0 ? (
                        recentAnchors.map((anch, i) => (
                            <div key={i} className="p-3 rounded-lg border border-border bg-[#F8FAFC] flex justify-between items-center animate-fade-in">
                                <div>
                                    <div className="text-xs font-bold">{anch.type} ({anch.patient.slice(0, 6)})</div>
                                    <div className="text-[10px] font-mono text-[#64748B]">CID: {anch.cid.slice(0, 16)}...</div>
                                    {anch.fileName && (
                                      <div className="text-[9px] text-violet-500 font-medium mt-0.5">{anch.fileName}</div>
                                    )}
                                </div>
                                <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-1 rounded font-bold uppercase tracking-tighter">Verified</span>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-6">
                            <Database size={20} className="text-[#E2E8F0] mx-auto mb-1" />
                            <p className="text-[10px] text-[#64748B]">No uploads processed in this session.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Outgoing Requests Queue */}
            <div className="premium-card" style={{ padding: '2rem' }}>
                <h2 className="font-bold text-md mb-4 flex items-center gap-2 border-b pb-4">
                  <Clock size={18} className="text-amber-500" /> Outgoing Access Requests
                </h2>

                <div className="flex gap-2 mb-4">
                     <input
                        type="text"
                        placeholder="Patient Address"
                        value={requestPatientId}
                        onChange={(e) => setRequestPatientId(e.target.value)}
                        className="flex-1 p-3 rounded-xl border border-border bg-[#F8FAFC] text-xs focus:ring-2 focus:ring-violet-500 outline-none transition-all"
                     />
                     <button
                        onClick={handleRequestAccess}
                        disabled={loading || !requestPatientId}
                        className="bg-[#3D5141] text-white px-4 rounded-xl text-xs font-bold hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center"
                     >
                        Request
                     </button>
                </div>

                <div className="space-y-3">
                    {outgoingRequests.length > 0 ? outgoingRequests.map((req, i) => (
                        <div key={i} className="p-3 rounded-lg border border-border bg-[#F8FAFC] flex flex-col gap-1">
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                   PT: {req.originalInput || req.patient.slice(0, 6)}
                                </span>
                                <div className="flex items-center gap-2">
                                    {req.status === 'Pending' && <span className="px-1.5 py-0.5 bg-amber-50 text-amber-600 text-[9px] font-black rounded uppercase">Pending</span>}
                                    {req.status === 'Approved' && <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-600 text-[9px] font-black rounded uppercase">Approved</span>}
                                    {req.status === 'Rejected' && <span className="px-1.5 py-0.5 bg-red-50 text-red-600 text-[9px] font-black rounded uppercase">Rejected</span>}
                                </div>
                            </div>
                            <div className="text-xs font-semibold text-gray-800">{req.purpose}</div>
                            <div className="text-[9px] text-gray-400 mt-1 flex justify-between items-center">
                                {new Date(req.timestamp).toLocaleString()}
                                
                                {req.status === 'Approved' && req.cid && (
                                    <button
                                        onClick={() => {
                                            setViewingCid(req.cid)
                                            setViewingPatientAddr(req.patient)
                                        }}
                                        className="flex items-center gap-1.5 px-3 py-1 bg-[#0F172A] text-white text-[10px] font-bold rounded-lg hover:bg-slate-800 transition-all shadow-sm"
                                    >
                                        <Eye size={12} /> View Data
                                    </button>
                                )}
                            </div>
                        </div>
                    )) : (
                        <div className="text-center py-4">
                            <AlertCircle size={20} className="text-[#E2E8F0] mx-auto mb-1" />
                            <p className="text-xs text-[#64748B]">No pending requests sent from your lab node.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Audit Log Section */}
            <div className="premium-card" style={{ padding: '2rem' }}>
                <div className="flex items-center gap-2 mb-4 border-b pb-4">
                    <Fingerprint size={18} className="text-violet-500" />
                    <h2 className="font-bold text-md text-gray-900">Recent Transaction Activity</h2>
                </div>
                {auditLogs.length > 0 ? (
                    <div className="flex flex-col gap-3 overflow-y-auto max-h-[300px] pr-2">
                        {auditLogs.map((log) => (
                            <div key={log.id} className="p-3 bg-gray-50 border border-gray-100 rounded-xl flex flex-col gap-1 hover:border-gray-200 transition-colors">
                                <div className="flex justify-between items-center text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                    <span className="text-violet-600">{log.type}</span>
                                    <span className="text-gray-400">{new Date(log.timestamp).toLocaleString()}</span>
                                </div>
                                <div className="text-[10px] font-bold text-gray-800">{log.provider}</div>
                                <p className="font-mono text-[9px] text-gray-400 break-all">
                                    "{log.purpose}"
                                </p>
                                <a
                                    href={`https://testnet.explorer.perawallet.app/tx/${log.txId}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[8px] text-violet-400 hover:underline mt-1 flex items-center gap-1"
                                >
                                    <ExternalLink size={8} /> View on Explorer
                                </a>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-6 text-center">
                        <Fingerprint size={28} className="text-gray-200 mb-2" />
                        <p className="text-xs text-gray-400">No cryptographic read footprints detected on your lab node.</p>
                    </div>
                )}
            </div>
        </section>
      </div>

      {viewingCid && (
        <FileViewer
          cid={viewingCid}
          patientAddress={viewingPatientAddr}
          onClose={() => setViewingCid(null)}
        />
      )}
    </div>
  )
}

export default LabDashboard
