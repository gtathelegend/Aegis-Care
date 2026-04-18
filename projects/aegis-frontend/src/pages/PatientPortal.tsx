import { useWallet } from '@txnlab/use-wallet-react'
import {
  ShieldCheck,
  Search,
  FileText,
  Loader2,
  Lock,
  Globe,
  Fingerprint,
  HeartPulse,
  Flame,
  FileBadge2,
  Inbox,
  ExternalLink,
  Clock,
  CheckCircle,
  XCircle,
  UserPlus,
  Eye,
  Pill,
} from 'lucide-react'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useSnackbar } from 'notistack'
import { useRole } from '../hooks/useRole'
import bcrypt from 'bcryptjs'
import algosdk from 'algosdk'
import { WalletMapperClient } from '../contracts/WalletMapperClient'

// Contracts
import { ConsentManagerClient } from '../contracts/ConsentManagerClient'
import { AuditLogClient } from '../contracts/AuditLogClient'
import { MedicalRecordsClient } from '../contracts/MedicalRecordsClient'
import { VolunteerRegistryClient } from '../contracts/VolunteerRegistryClient'
import { QueueManagerClient } from '../contracts/QueueManagerClient'

import { getAlgorandClientFromViteEnvironment } from '../utils/network/getAlgoClientConfigs'
import { fetchFromIPFS } from '../utils/ipfs'
import { decryptData } from '../utils/crypto'
import { fetchAuditLogs, AuditLogEntry } from '../utils/auditLog'
import { calcMedicalRecordBox, calcConsentBox, calcAccessRequestBox, calcQueuePatientBox, calcQueueRequestBox, calcPrescriptionQueueBox } from '../utils/boxUtils'

// File Viewer
import FileViewer from '../components/FileViewer'

// ─── Record Card with FileViewer Integration ────────────────────────
const RecordCard = ({ record, activeAddress }: { record: any, activeAddress: string }) => {
  const [decryptedData, setDecryptedData] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showViewer, setShowViewer] = useState(false)

  // record is [id, patient, provider, cid, record_type, timestamp, bill_amount]
  const cid = record[3]
  const recordType = record[4]
  const patientAddr = record[1]

  const handleLegacyDecrypt = async () => {
    setLoading(true)
    setError('')
    try {
      const encryptedBase64 = await fetchFromIPFS(cid)
      const plainText = await decryptData(encryptedBase64, activeAddress)
      setDecryptedData(plainText)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="p-4 border border-gray-100 rounded-2xl bg-white shadow-sm flex flex-col gap-3 hover:border-blue-100 transition-colors">
         <div className="flex justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-blue-500 bg-blue-50 px-2 py-1 rounded">
                 {recordType}
              </span>
              <div className="text-sm font-semibold text-gray-800 mt-2">Provider: {record[2].slice(0, 8)}...</div>
            </div>
            <div className="text-[10px] text-gray-400 font-bold">
              {new Date(Number(record[5]) * 1000).toLocaleString()}
            </div>
         </div>

         {/* CID Display */}
         <div className="flex items-center gap-2 text-[10px] text-gray-400 bg-gray-50 p-2 rounded-lg border border-gray-100">
           <Globe size={12} />
           <span className="font-mono">CID: {cid.slice(0, 20)}...</span>
         </div>

         {decryptedData ? (
            <div className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-xl font-mono text-xs text-gray-700 whitespace-pre-wrap">
               {decryptedData}
            </div>
         ) : (
            <div className="flex items-center gap-2 mt-2">
              {/* Primary: Use FileViewer for new encrypted files */}
              <button
                onClick={() => setShowViewer(true)}
                className="flex-1 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white px-4 py-2.5 rounded-lg text-xs font-bold transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
              >
                <Eye size={14} /> View Encrypted File
              </button>

              {/* Secondary: Legacy text decrypt */}
              <button
                onClick={handleLegacyDecrypt}
                disabled={loading}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 flex items-center gap-1"
                title="Decrypt as legacy text record"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
                Text
              </button>

              {error && <span className="text-xs text-red-500 font-medium truncate max-w-[150px]">{error}</span>}
            </div>
         )}
      </div>

      {/* FileViewer Modal */}
      {showViewer && (
        <FileViewer
          cid={cid}
          patientAddress={patientAddr}
          recordType={recordType}
          onClose={() => setShowViewer(false)}
        />
      )}
    </>
  )
}

// ─── Main Component ─────────────────────────────────────────────────
const PatientPortal = () => {
  const { activeAddress, transactionSigner } = useWallet()
  const { shortId, role, isVerified, refresh, isProxyActive, proxyAddress } = useRole()
  const navigate = useNavigate()
  const { enqueueSnackbar } = useSnackbar()

  const targetAddress = isProxyActive && proxyAddress ? proxyAddress : activeAddress

  // Navigation & View State
  const location = useLocation()
  const currentPath = location.pathname

  // Real State Handlers
  const [loading, setLoading] = useState(true)
  const [patientRecords, setPatientRecords] = useState<any[]>([])
  const [consents, setConsents] = useState<any[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([])
  const [pendingRequests, setPendingRequests] = useState<any[]>([])
  const [incomingAccessRequests, setIncomingAccessRequests] = useState<any[]>([])
  const [isVolunteering, setIsVolunteering] = useState(false)
  const [pendingPrescriptions, setPendingPrescriptions] = useState<any[]>([])
  const [beneficiaries, setBeneficiaries] = useState<string[]>([])

  // Modal / Selection State for Linking Records
  const [approvalModalRequest, setApprovalModalRequest] = useState<any | null>(null)
  const [selectedRecordToLink, setSelectedRecordToLink] = useState<string>('All')

  // Interaction States
  const [erasing, setErasing] = useState(false)
  const [newBeneficiary, setNewBeneficiary] = useState('')
  const [bPassword, setBPassword] = useState('')
  const [claimTitle, setClaimTitle] = useState('')

  const algorand = useMemo(() => getAlgorandClientFromViteEnvironment(), [])

  // App IDs
  const consentAppId = Number(import.meta.env.VITE_CONSENT_MANAGER_APP_ID || 0)
  const auditAppId = Number(import.meta.env.VITE_AUDIT_LOG_APP_ID || import.meta.env.VITE_AUDITLOG_APP_ID || 0)
  const recordsAppId = Number(import.meta.env.VITE_MEDICAL_RECORDS_APP_ID || 0)
  const volunteerAppId = Number(import.meta.env.VITE_VOLUNTEER_REGISTRY_APP_ID || 0)
  const queueAppId = Number(import.meta.env.VITE_QUEUE_MANAGER_APP_ID || 0)

  const fetchData = useCallback(async () => {
    if (!targetAddress) return
    setLoading(true)
    try {
       // 1. Fetch Consents
       const consentC = new ConsentManagerClient({ appId: BigInt(consentAppId), algorand })
       const consentBox = calcConsentBox(targetAddress)
       const consentsResult = await consentC.send.getPatientConsents({
           args: { patient: targetAddress },
           sender: activeAddress as string,
           signer: transactionSigner,
           boxReferences: [{ appId: BigInt(consentAppId), name: consentBox }]
       }).catch(() => ({ return: [] }))
       setConsents(consentsResult.return || [])

       // 2. Fetch Records
       const recordsC = new MedicalRecordsClient({ appId: BigInt(recordsAppId), algorand })
       const recordBox = calcMedicalRecordBox(targetAddress)
       const recordsResult = await recordsC.send.getPatientRecords({
           args: { patient: targetAddress },
           sender: activeAddress as string,
           signer: transactionSigner,
           boxReferences: [{ appId: BigInt(recordsAppId), name: recordBox }]
       }).catch(() => ({ return: [] }))
       setPatientRecords(recordsResult.return || [])

       // 3. Fetch Audit Logs
       const logs = await fetchAuditLogs(targetAddress)
       setAuditLogs(logs || [])

       // 4. Fetch Pending Requests from GLOBAL QUEUE
       const queueC = new QueueManagerClient({ appId: BigInt(queueAppId), algorand })
       const queueResult = await queueC.send.getPatientQueue({
           args: { patient: targetAddress },
           sender: activeAddress as string,
           signer: transactionSigner,
           boxReferences: [{ appId: BigInt(queueAppId), name: calcQueuePatientBox(targetAddress) }]
       }).catch((e) => {
           console.error("Queue fetch error", e)
           return { return: [] }
       })
       setPendingRequests(queueResult.return || [])

       // 4b. Fetch Pending Access Requests from CONSENT MANAGER
       const accessRequestBox = calcAccessRequestBox(targetAddress)
       const accessRequestsResult = await consentC.send.getPendingRequests({
           args: { patient: targetAddress },
           sender: activeAddress as string,
           signer: transactionSigner,
           boxReferences: [{ appId: BigInt(consentAppId), name: accessRequestBox }]
       }).catch((e) => {
           console.error("Consent Manager requests fetch error", e)
           return { return: [] }
       })
       setIncomingAccessRequests(accessRequestsResult.return || [])

       // 5. Fetch Pending Prescriptions (Global Queue)
       const state = await recordsC.appClient.getGlobalState()
       const queueLength = typeof state.queue_length === 'bigint' 
         ? state.queue_length 
         : (state.queue_length as any)?.value || 0n
       
       if (queueLength > 0n) {
           const boxRefs = []
           for (let i = 0n; i < queueLength; i++) {
               boxRefs.push({ appId: BigInt(recordsAppId), name: calcPrescriptionQueueBox(i) })
           }
           
           // Note: Using simulation call (no .send) for readonly method to save fees
           const pendingResult = await recordsC.getPendingPrescriptions({ 
               args: {},
               boxReferences: boxRefs
           }).catch(() => [])
           
           // Filter only prescriptions belonging to this patient
           const myPrescs = pendingResult.filter((p: any) => p[1] === targetAddress && p[4] === false)
           setPendingPrescriptions(myPrescs)
        } else {
            setPendingPrescriptions([])
        }

        // 6. Check Volunteer Status
        setIsVolunteering(false)

        // 7. Fetch Beneficiaries (Owner only)
        if (!isProxyActive && activeAddress) {
          try {
            const mapperAppId = Number(import.meta.env.VITE_WALLET_MAPPER_APP_ID || 0)
            console.debug(`[BeneficiaryFetch] AppID: ${mapperAppId}, Wallet: ${activeAddress}`)
            
            if (mapperAppId > 0) {
              const mapperC = new WalletMapperClient({ appId: BigInt(mapperAppId), algorand })
              const benBoxName = new Uint8Array([...new TextEncoder().encode('ben_'), ...algosdk.decodeAddress(activeAddress).publicKey])
              
              console.debug(`[BeneficiaryFetch] BoxName (Hex): ${Array.from(benBoxName).map(b => b.toString(16).padStart(2, '0')).join('')}`)

              const benResult = await mapperC.getBeneficiaries({
                  args: { owner: activeAddress },
                  sender: activeAddress,
                  boxReferences: [{ appId: BigInt(mapperAppId), name: benBoxName }]
              }).catch(err => {
                 console.error("[BeneficiaryFetch] Simulation failed:", err)
                 return []
              })

              console.debug("[BeneficiaryFetch] Raw Result:", benResult)

              if (benResult && Array.isArray(benResult)) {
                const rawList = benResult.map((b: any) => {
                   try {
                     const idBytes = Array.isArray(b) ? b[0] : (b.beneficiary_id || b.beneficiaryId || b[0])
                     if (idBytes) {
                        const str = String.fromCharCode(...Array.from(idBytes as number[])).replace(/\0/g, '').trim()
                        return str || null
                     }
                     return null
                   } catch (e) { return null }
                }).filter((x): x is string => !!x)
                
                // Deduplicate for UI
                const fetchedBen = Array.from(new Set(rawList))
                
                console.debug("[BeneficiaryFetch] Final Parsed List (Deduplicated):", fetchedBen)
                setBeneficiaries(fetchedBen)
              } else {
                setBeneficiaries([])
              }
            }
          } catch(e) {
            console.warn("[BeneficiaryFetch] Non-critical error:", e)
            setBeneficiaries([])
          }
        } else if (isProxyActive) {
           setBeneficiaries([])
        }

    } catch (e) {
       console.error("Data fetch error", e)
    } finally {
       setLoading(false)
    }
  }, [activeAddress, targetAddress, transactionSigner, isProxyActive, algorand, consentAppId, auditAppId, recordsAppId, volunteerAppId, queueAppId])

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAddress, targetAddress, isProxyActive])



  const handleToggleVolunteer = async () => {
    if (isProxyActive) {
       enqueueSnackbar('Action denied. Beneficiary view is read-only.', { variant: 'error' })
       return
    }
    if (!activeAddress || !transactionSigner) return
    try {
      const client = new VolunteerRegistryClient({ appId: BigInt(volunteerAppId), algorand })
      if (!isVolunteering) {
          await client.send.addVolunteer({ args: { hashId: new Uint8Array(32), cid: "anonymous_blob" }, sender: activeAddress as string, signer: transactionSigner }).catch(() => {})
          setIsVolunteering(true)
      } else {
          setIsVolunteering(false)
      }
      enqueueSnackbar('Data pooling status updated', { variant: 'success' })
    } catch (e: any) {
      enqueueSnackbar(`Toggle failed: ${e.message}`, { variant: 'error' })
    }
  }

  const handleErasure = async () => {
    if (isProxyActive) {
       enqueueSnackbar('Action denied. Beneficiary view is read-only.', { variant: 'error' })
       return
    }
    if (!activeAddress || !transactionSigner) return
    if (!window.confirm("CRITICAL: This will permanently revoke all active data authorizations. Proceed?")) return

    setErasing(true)
    try {
       const client = new ConsentManagerClient({ appId: BigInt(consentAppId), algorand })

       for (let i = 0; i < consents.length; i++) {
          await client.send.revokeConsent({
              args: { index: BigInt(i) },
              sender: activeAddress as string,
              signer: transactionSigner
          }).catch(console.warn)
       }

       enqueueSnackbar('GLOBAL ERASURE EXECUTED. All authorizations revoked.', { variant: 'success' })
       fetchData()
    } catch (e: any) {
       enqueueSnackbar(`Erasure failed: ${e.message}`, { variant: 'error' })
    } finally {
       setErasing(false)
    }
  }

  const handleAddBeneficiary = async () => {
     if (isProxyActive) {
        enqueueSnackbar('Action denied. Beneficiary view is read-only.', { variant: 'error' })
        return
     }
     if (beneficiaries.length >= 2) {
        enqueueSnackbar('Maximum 2 cryptographic beneficiaries allowed.', { variant: 'warning' })
        return
     }
     if (newBeneficiary.length !== 6 || !bPassword) {
         enqueueSnackbar('Invalid 6-char ID or missing password.', { variant: 'warning' })
         return
     }
     
     setLoading(true)
     try {
         const salt = bcrypt.genSaltSync(10)
         const hash = bcrypt.hashSync(bPassword, salt)
         
         const mapperAppId = Number(import.meta.env.VITE_WALLET_MAPPER_APP_ID || 0)
         const mapperC = new WalletMapperClient({ appId: BigInt(mapperAppId), algorand })
         
         const sidBytes = new Uint8Array(6)
         for (let i = 0; i < 6; i++) sidBytes[i] = newBeneficiary.charCodeAt(i)

         const sidBox = new Uint8Array([...new TextEncoder().encode('sid_'), ...sidBytes])
         const benBox = new Uint8Array([...new TextEncoder().encode('ben_'), ...algosdk.decodeAddress(activeAddress as string).publicKey])
         
         await mapperC.send.addBeneficiary({
             args: { beneficiaryId: sidBytes, hashedPassword: hash },
             sender: activeAddress as string,
             signer: transactionSigner!,
             boxReferences: [
                 { appId: BigInt(mapperAppId), name: sidBox },
                 { appId: BigInt(mapperAppId), name: benBox }
             ]
         })
         
         enqueueSnackbar('Cryptographic beneficiary anchored.', { variant: 'success' })
         setNewBeneficiary('')
         setBPassword('')
         
         console.debug("[PatientPortal] Success. Delaying refresh for 1.5s to allow for propagation...")
         setTimeout(() => {
            fetchData()
         }, 1500)
     } catch (e: any) {
         console.error("[PatientPortal] Add Beneficiary Error:", e)
         enqueueSnackbar(e.message || 'Failed to add beneficiary.', { variant: 'error' })
     } finally {
         setLoading(false)
     }
  }

  const handleSubmitClaim = () => {
     if (isProxyActive) {
        enqueueSnackbar('Action denied. Beneficiary view is read-only.', { variant: 'error' })
        return
     }
     if (!claimTitle) return
     enqueueSnackbar(`Insurance Claim Formulated: ${claimTitle}`, { variant: 'success' })
     setClaimTitle('')
  }

  const handleApproveRequest = async (request: any) => {
    if (isProxyActive) {
       enqueueSnackbar('Action denied. Beneficiary view is read-only.', { variant: 'error' })
       return
    }
    // If no record is selected yet, open the modal
    if (!selectedRecordToLink || selectedRecordToLink === 'All') {
        setApprovalModalRequest(request)
        return
    }
    await finalizeApproval(request, selectedRecordToLink)
  }

  const finalizeApproval = async (request: any, linkCid: string) => {
    if (!activeAddress || !transactionSigner) return
    setLoading(true)
    try {
        const consentC = new ConsentManagerClient({ appId: BigInt(consentAppId), algorand })
        const accessRequestBox = calcAccessRequestBox(activeAddress)
        const consentBox = calcConsentBox(activeAddress)

        // Find the linked record's type for the scope
        const record = patientRecords.find(r => r[3] === linkCid)
        const scope = record ? record[4] : 'General'

        await consentC.send.approveRequest({
            args: { 
                requestId: request[0], 
                dataHash: linkCid, 
                dataScope: scope,
                durationInSeconds: BigInt(3600 * 24 * 30) // 30 days
            },
            sender: activeAddress as string,
            signer: transactionSigner,
            boxReferences: [
                { appId: BigInt(consentAppId), name: accessRequestBox },
                { appId: BigInt(consentAppId), name: consentBox }
            ]
        })

        enqueueSnackbar(`Access granted. Linked record: ${scope}`, { variant: 'success' })
        setApprovalModalRequest(null)
        setSelectedRecordToLink('All')
        fetchData()
    } catch (e: any) {
        enqueueSnackbar(`Approval failed: ${e.message}`, { variant: 'error' })
    } finally {
        setLoading(false)
    }
  }

  const handleRejectRequest = async (requestId: bigint) => {
    if (isProxyActive) {
       enqueueSnackbar('Action denied. Beneficiary view is read-only.', { variant: 'error' })
       return
    }
    if (!activeAddress || !transactionSigner) return
    setLoading(true)
    try {
        const consentC = new ConsentManagerClient({ appId: BigInt(consentAppId), algorand })
        const accessRequestBox = calcAccessRequestBox(activeAddress)

        await consentC.send.rejectRequest({
            args: { requestId },
            sender: activeAddress as string,
            signer: transactionSigner,
            boxReferences: [{ appId: BigInt(consentAppId), name: accessRequestBox }]
        })

        enqueueSnackbar('Request explicitly rejected.', { variant: 'info' })
        fetchData()
    } catch (e: any) {
        enqueueSnackbar(`Rejection failed: ${e.message}`, { variant: 'error' })
    } finally {
        setLoading(false)
    }
  }

  if (loading && patientRecords.length === 0) {
      return (
          <div className="flex flex-col items-center justify-center h-64 animate-fade-in-scale">
             <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-4" />
             <span className="text-sm font-semibold text-gray-500 tracking-widest uppercase">Decoupling Off-chain Vaults...</span>
          </div>
      )
  }

  // Determine what to show
  const isOverview = currentPath === '/patient'
  const isRecords = currentPath === '/records'
  const isConsents = currentPath === '/consents'
  const isAudit = currentPath === '/audit'

  return (
    <div className="flex flex-col gap-8 animate-fade-in-scale">

        {/* Main Grid View */}
        <div className="grid lg:grid-cols-3 gap-8">

            {/* Main Center Pane */}
            <div className="lg:col-span-2 flex flex-col gap-8">

                {/* 1. Medical Records Section */}
                {(isOverview || isRecords) && (
                <section className="vercel-card flex flex-col min-h-[300px]">
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-2 text-gray-900 border-b pb-2 w-full">
                            <HeartPulse size={18} className="text-blue-500"/>
                            <h2 className="font-semibold text-lg">My Medical Records</h2>
                            {patientRecords.length > 0 && (
                              <span className="ml-auto text-[10px] font-bold text-blue-500 bg-blue-50 px-2 py-1 rounded-full uppercase tracking-wider">
                                {patientRecords.length} Records · E2E Encrypted
                              </span>
                            )}
                        </div>
                    </div>

                    {patientRecords.length > 0 || pendingPrescriptions.length > 0 ? (
                        <div className="grid grid-cols-1 gap-4">
                            {/* Pending Prescriptions First */}
                            {pendingPrescriptions.map((presc, i) => (
                                <div key={`presc-${i}`} className="p-4 border border-emerald-100 rounded-2xl bg-emerald-50/30 shadow-sm flex flex-col gap-3 hover:border-emerald-200 transition-colors">
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-2">
                                            <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600">
                                                <Pill size={16} />
                                            </div>
                                            <div>
                                                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">
                                                    Pending Prescription
                                                </span>
                                                <div className="text-sm font-bold text-gray-900">Dr. {presc[2]}</div>
                                            </div>
                                        </div>
                                        <div className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[9px] font-black rounded uppercase">
                                            Awaiting Pharmacy
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-2 text-[10px] text-emerald-600/70 bg-white/50 p-2 rounded-lg border border-emerald-100">
                                        <Lock size={12} />
                                        <span className="font-mono">Secure Anchor: {presc[3].slice(0, 16)}...</span>
                                    </div>

                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => {
                                                enqueueSnackbar('This prescription is pending pharmacy fulfillment. You can view its details once decrypted.', { variant: 'info' })
                                            }}
                                            className="flex-1 bg-white border border-emerald-200 text-emerald-700 px-3 py-2 rounded-lg text-xs font-bold hover:bg-emerald-50 transition-colors flex items-center justify-center gap-2"
                                        >
                                            <Pill size={14} /> View Details
                                        </button>
                                        <FileViewer
                                            cid={presc[3]}
                                            patientAddress={activeAddress!}
                                            recordType="Prescription"
                                            onClose={() => fetchData()}
                                        />
                                    </div>
                                </div>
                            ))}

                            {/* Existing Records */}
                            {patientRecords.map((rec, i) => (
                                <RecordCard key={`rec-${i}`} record={rec} activeAddress={activeAddress!} />
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-in">
                            <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center text-blue-500 mb-6">
                              <FileText size={40} />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-2">No medical records yet</h3>
                            <p className="text-gray-500 text-sm max-w-xs mx-auto mb-8 leading-relaxed">
                              Your health journey is currently a clean state. Your providers will upload your diagnostic reports here.
                            </p>
                        </div>
                    )}
                </section>
                )}

                {/* DPDP Queue: Pending Requests Box */}
                {(isOverview || isConsents) && (
                <section className="vercel-card flex flex-col">
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-2 text-gray-900 border-b pb-2 w-full">
                            <Clock size={18} className="text-amber-500"/>
                            <h2 className="font-semibold text-lg">Pending Access Requests</h2>
                        </div>
                    </div>

                    {incomingAccessRequests.length > 0 ? (
                        <div className="grid grid-cols-1 gap-4">
                            {incomingAccessRequests.map((req, i) => (
                                <div key={i} className="p-4 border border-amber-100/50 rounded-2xl bg-amber-50/20 hover:bg-amber-50/40 transition-colors shadow-sm">
                                    <div className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-1.5 flex items-center justify-between">
                                        Data Request
                                        <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded uppercase text-[9px] font-black">Requires Action</span>
                                    </div>
                                    <div className="font-mono text-xs font-bold text-gray-800 break-all mb-2">Provider: {req[1]}</div>
                                    <div className="text-sm font-medium text-gray-600 mb-4 bg-white p-3 rounded-xl border border-gray-100">
                                       <span className="text-xs font-bold text-gray-400 block mb-1">Stated Purpose</span>
                                       "{req[2]}"
                                    </div>
                                    <div className="text-[10px] text-gray-400 border-t pt-3 w-full flex justify-between items-center">
                                        Received: {new Date(Number(req[3]) * 1000).toLocaleString()}
                                        <div className="flex items-center gap-2">
                                            <button
                                              onClick={() => handleRejectRequest(req[0])}
                                              className="border border-red-200 text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                                            >
                                               <XCircle size={14} /> Deny
                                            </button>
                                            <button
                                              onClick={() => handleApproveRequest(req)}
                                              className="bg-gray-900 hover:bg-gray-800 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 shadow-md"
                                            >
                                               <CheckCircle size={14} /> Grant Consent
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="empty-state m-auto">
                            <ShieldCheck className="empty-state-icon" />
                            <h3 className="text-gray-900 font-semibold mb-1">Queue Empty</h3>
                            <p className="text-gray-500 text-sm max-w-sm">No clinical actors are currently requesting access to your data.</p>
                        </div>
                    )}
                </section>
                )}

                {/* 2. Consents Box */}
                {(isOverview || isConsents) && (
                <section className="vercel-card flex flex-col min-h-[300px]">
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-2 text-gray-900 border-b pb-2 w-full">
                            <Lock size={18} className="text-gray-400"/>
                            <h2 className="font-semibold text-lg">Active Consents</h2>
                        </div>
                    </div>

                    {consents.filter(c => c[7] === true).length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {consents.filter(c => c[7] === true).map((c, i) => (
                                <div key={i} className="p-4 border border-gray-100 rounded-2xl bg-gray-50/50 hover:bg-gray-50 hover:border-gray-200 transition-colors">
                                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 flex items-center justify-between">
                                        Fiduciary Identity
                                        <span className={`px-1.5 py-0.5 rounded uppercase text-[9px] ${c[7] ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                            {c[7] ? 'Active' : 'Revoked'}
                                        </span>
                                    </div>
                                    <div className="font-mono text-xs font-bold text-gray-800 break-all mb-2">{c[1]}</div>
                                    <div className="text-sm font-medium text-gray-600 mb-3">{c[2]}</div>
                                    <div className="text-[10px] text-gray-400 border-t pt-2 w-full flex justify-between">
                                        Valid Until: {new Date(Number(c[3]) * 1000).toLocaleDateString()}
                                        <button
                                          onClick={async () => {
                                             if (isProxyActive) {
                                                enqueueSnackbar('Action denied.', { variant: 'error' })
                                                return
                                             }
                                             try {
                                                const client = new ConsentManagerClient({ appId: BigInt(consentAppId), algorand })
                                                const consentBox = calcConsentBox(activeAddress!)
                                                await client.send.revokeConsent({
                                                    args: { index: BigInt(i) },
                                                    sender: activeAddress as string,
                                                    signer: transactionSigner,
                                                    boxReferences: [{ appId: BigInt(consentAppId), name: consentBox }]
                                                })
                                                enqueueSnackbar('Consent successfully revoked.', { variant: 'success' })
                                                fetchData()
                                             } catch(e: any) {
                                                enqueueSnackbar(`Failed to revoke: ${e.message}`, { variant: 'error' })
                                             }
                                          }}
                                          className="text-red-500 hover:text-red-600 font-bold uppercase transition-colors"
                                        >
                                           Revoke
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="empty-state m-auto">
                            <Inbox className="empty-state-icon" />
                            <h3 className="text-gray-900 font-semibold mb-1">No Authorizations Found</h3>
                            <p className="text-gray-500 text-sm max-w-sm">You haven't approved any hospitals or doctors to view your encrypted medical records yet.</p>
                        </div>
                    )}
                </section>
                )}

                {(isOverview || isConsents) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

                     {/* Erasure Box */}
                     <section className="vercel-card border-red-100 bg-red-50/10">
                        <div className="flex flex-col h-full justify-between">
                             <div>
                                 <div className="flex items-center gap-2 text-red-600 mb-3">
                                    <Flame size={20} />
                                    <h2 className="font-bold text-lg">Right to Erasure</h2>
                                 </div>
                                 <p className="text-sm text-gray-600 leading-relaxed mb-6">
                                     Exercise your DPDP right. Instantly invoke smart contracts to revoke all data sharing global consents securely.
                                 </p>
                             </div>
                             <button
                                onClick={handleErasure}
                                disabled={erasing || consents.length === 0}
                                className="w-full bg-red-500 hover:bg-red-600 text-white font-semibold py-3 px-4 rounded-xl shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                             >
                                {erasing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Flame className="w-5 h-5" />}
                                Revoke Globally
                             </button>
                        </div>
                     </section>

                     {/* Beneficiaries Box */}
                     <section className="vercel-card flex flex-col justify-between">
                        <div>
                             <div className="flex items-center justify-between mb-4">
                                 <div className="flex items-center gap-2 text-blue-600">
                                    <UserPlus size={20} />
                                    <h2 className="font-bold text-lg">Proxy Beneficiaries</h2>
                                 </div>
                                 <span className="text-[10px] font-bold px-2 py-1 bg-gray-100 text-gray-500 rounded uppercase tracking-wider">MAX 2</span>
                             </div>
                             <div className="space-y-3 mb-6">
                                 {beneficiaries.map((b, i) => (
                                     <div key={i} className="flex justify-between items-center p-3 border border-gray-100 rounded-xl bg-gray-50 shadow-sm">
                                         <span className="font-mono text-xs text-gray-700">{b.length > 15 ? `${b.slice(0,6)}...${b.slice(-6)}` : b}</span>
                                         <button onClick={() => setBeneficiaries(beneficiaries.filter(x => x !== b))} className="text-[10px] text-red-500 font-bold hover:underline">Remove</button>
                                     </div>
                                 ))}
                                 {beneficiaries.length === 0 && (
                                     <div className="text-sm text-gray-400 italic text-center py-4">No proxies linked.</div>
                                 )}
                             </div>
                        </div>
                        {beneficiaries.length < 2 && !isProxyActive && (
                             <div className="flex flex-col gap-2">
                                 <input
                                    value={newBeneficiary}
                                    onChange={e => setNewBeneficiary(e.target.value.toUpperCase())}
                                    maxLength={6}
                                    placeholder="Proxy's 6-Char ID"
                                    className="w-full px-3 py-2 text-sm border font-mono border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-shadow"
                                 />
                                 <div className="flex gap-2">
                                     <input
                                        type="password"
                                        value={bPassword}
                                        onChange={e => setBPassword(e.target.value)}
                                        placeholder="Set Passphrase"
                                        className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-shadow"
                                     />
                                     <button onClick={handleAddBeneficiary} className="bg-gray-900 hover:bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50" disabled={loading}>
                                         {loading ? <Loader2 size={16} className="animate-spin" /> : 'Add'}
                                     </button>
                                 </div>
                             </div>
                        )}
                     </section>

                 </div>
                )}
            </div>

            {/* Sidebar Pane */}
            <div className="flex flex-col gap-8">

                {/* Insurance Claim Formulation */}
                {isOverview && (
                <section className="vercel-card bg-gradient-to-b from-blue-50/50 to-white border-blue-100">
                     <div className="flex items-center gap-2 mb-4 text-blue-700">
                          <FileBadge2 size={20} />
                          <h2 className="font-bold text-lg">Disbursement Claims</h2>
                     </div>
                     <p className="text-xs text-gray-500 mb-4">Leverage zero-knowledge proofs to assert diagnostics against underwriters blindly.</p>
                     <input
                         value={claimTitle}
                         onChange={e => setClaimTitle(e.target.value)}
                         placeholder="Diagnostic Code"
                         className="w-full p-3 text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 mb-3"
                     />
                     <button
                         onClick={handleSubmitClaim}
                         className="stripe-button-primary w-full"
                     >
                         Transmit State
                     </button>
                </section>
                )}

                {/* Audit Logs */}
                {(isOverview || isAudit) && (
                <section className="vercel-card flex-1 flex flex-col">
                    <div className="flex items-center gap-2 mb-4 border-b border-gray-100 pb-3">
                        <Fingerprint size={18} className="text-gray-400" />
                        <h2 className="font-bold text-gray-900">Audit Footprint</h2>
                    </div>
                    {auditLogs.length > 0 ? (
                        <div className="flex flex-col gap-3 overflow-y-auto max-h-[400px] pr-2">
                            {auditLogs.map((log) => (
                                <div key={log.id} className="p-3 bg-gray-50 border border-gray-100 rounded-xl flex flex-col gap-1 hover:border-gray-200 transition-colors">
                                    <div className="flex justify-between items-center text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                        <span className="text-blue-600">{log.type}</span>
                                        <span className="text-gray-400">{new Date(log.timestamp).toLocaleString()}</span>
                                    </div>
                                    <div className="text-[10px] font-bold text-gray-800">{log.provider}</div>
                                    <p className="font-mono text-[9px] text-gray-400 break-all leading-tight">
                                        "{log.purpose}"
                                    </p>
                                    <a
                                        href={`https://testnet.explorer.perawallet.app/tx/${log.txId}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[8px] text-blue-400 hover:underline mt-1 flex items-center gap-1"
                                    >
                                        <ExternalLink size={8} /> View on Explorer
                                    </a>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-10 text-center">
                            <ShieldCheck className="w-8 h-8 text-gray-300 mb-3" />
                            <h3 className="text-gray-800 text-sm font-semibold mb-1">Clean State</h3>
                            <p className="text-xs text-gray-400">No cryptographic read footprints detected on your decentralized node.</p>
                        </div>
                    )}
                </section>
                )}
            </div>
        </div>

        {/* --- Approval Record Linking Modal --- */}
        {approvalModalRequest && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[300] flex items-center justify-center p-4 animate-fade-in">
                <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-fade-in-scale">
                    {/* Header */}
                    <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-amber-50 to-orange-50">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center text-white shadow-lg">
                                <ShieldCheck size={24} />
                            </div>
                            <div>
                                <h3 className="font-black text-gray-900 text-lg">Secure Approval Flow</h3>
                                <p className="text-xs text-amber-600 font-bold uppercase tracking-widest">Digital Consent Verification</p>
                            </div>
                        </div>
                    </div>

                    {/* Body */}
                    <div className="p-8">
                        <div className="mb-6 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Requesting Provider</label>
                            <div className="font-mono text-xs font-bold text-gray-800 break-all">{approvalModalRequest[1]}</div>
                            <div className="mt-3">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Stated Purpose</label>
                                <p className="text-sm text-gray-700 italic">"{approvalModalRequest[2]}"</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-black text-gray-700 uppercase tracking-widest block mb-3">Link One of Your Records</label>
                                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                    <button
                                        onClick={() => setSelectedRecordToLink('All')}
                                        className={`w-full p-3 rounded-xl border text-left transition-all flex items-center justify-between group ${
                                            selectedRecordToLink === 'All'
                                                ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500/10'
                                                : 'border-gray-100 bg-white hover:border-blue-200'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-lg ${selectedRecordToLink === 'All' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
                                                <Globe size={14} />
                                            </div>
                                            <div>
                                                <div className="text-xs font-bold text-gray-900">General Record Access</div>
                                                <div className="text-[10px] text-gray-500">Provide visibility to all relevant history</div>
                                            </div>
                                        </div>
                                        {selectedRecordToLink === 'All' && <CheckCircle size={16} className="text-blue-500" />}
                                    </button>

                                    {patientRecords.map((rec, i) => (
                                        <button
                                            key={i}
                                            onClick={() => setSelectedRecordToLink(rec[3])}
                                            className={`w-full p-3 rounded-xl border text-left transition-all flex items-center justify-between group ${
                                                selectedRecordToLink === rec[3]
                                                    ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500/10'
                                                    : 'border-gray-100 bg-white hover:border-blue-200'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-lg ${selectedRecordToLink === rec[3] ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
                                                    <FileText size={14} />
                                                </div>
                                                <div>
                                                    <div className="text-xs font-bold text-gray-900 capitalize">{rec[4]}</div>
                                                    <div className="text-[10px] text-gray-500 font-mono">CID: {rec[3].slice(0, 16)}...</div>
                                                </div>
                                            </div>
                                            {selectedRecordToLink === rec[3] && <CheckCircle size={16} className="text-blue-500" />}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-6 bg-gray-50 border-t border-gray-100 flex gap-3">
                        <button
                            onClick={() => {
                                setApprovalModalRequest(null)
                                setSelectedRecordToLink('All')
                            }}
                            className="flex-1 py-3 text-xs font-bold text-gray-500 hover:text-gray-700 transition-colors uppercase tracking-widest"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => finalizeApproval(approvalModalRequest, selectedRecordToLink)}
                            disabled={loading}
                            className="flex-[2] py-4 bg-gray-900 text-white rounded-2xl font-black text-sm shadow-xl hover:bg-black transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock size={16} />}
                            Confirm Authorization
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  )
}

export default PatientPortal
