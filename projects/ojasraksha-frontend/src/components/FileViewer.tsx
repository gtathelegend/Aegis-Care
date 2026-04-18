/**
 * FileViewer — Shared modal component for the full
 * Fetch → Decrypt → Render pipeline.
 *
 * Supports PDF (iframe), images (img tag), and download fallback.
 */

import { useState, useCallback } from 'react'
import { useWallet } from '@txnlab/use-wallet-react'
import {
  X,
  Loader2,
  Lock,
  Download,
  Globe,
  ShieldCheck,
  ShieldAlert,
  FileText,
  Image as ImageIcon,
  RefreshCcw,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react'
import { fetchEncryptedFile, fetchFromIPFS } from '../utils/ipfs'
import { decryptFile, decryptData } from '../utils/crypto'
import { checkDecryptionAuth } from '../utils/authCheck'
import type { EncryptionMetadata } from '../utils/crypto'
import { getAlgorandClientFromViteEnvironment } from '../utils/network/getAlgoClientConfigs'
import { AuditLogClient } from '../contracts/AuditLogClient'

// ─── Types ──────────────────────────────────────────────────────────
type ViewerStep = 'idle' | 'auth' | 'fetching' | 'decrypting' | 'rendering' | 'done' | 'error'

interface FileViewerProps {
  cid: string
  patientAddress: string
  recordType?: string
  onClose: () => void
}

// ─── Step Indicator ─────────────────────────────────────────────────
const STEPS: { key: ViewerStep; label: string }[] = [
  { key: 'auth', label: 'Verifying authorization...' },
  { key: 'fetching', label: 'Fetching from IPFS...' },
  { key: 'decrypting', label: 'Decrypting file...' },
  { key: 'rendering', label: 'Rendering preview...' },
]

function StepIndicator({ currentStep }: { currentStep: ViewerStep }) {
  const activeIdx = STEPS.findIndex(s => s.key === currentStep)

  return (
    <div className="flex flex-col gap-3 py-2">
      {STEPS.map((step, i) => {
        let status: 'pending' | 'active' | 'done' = 'pending'
        if (i < activeIdx) status = 'done'
        else if (i === activeIdx) status = 'active'

        return (
          <div key={step.key} className="flex items-center gap-3">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black transition-all duration-300 ${
                status === 'done'
                  ? 'bg-emerald-500 text-white scale-100'
                  : status === 'active'
                  ? 'bg-blue-600 text-white animate-pulse scale-110'
                  : 'bg-gray-100 text-gray-400 scale-95'
              }`}
            >
              {status === 'done' ? (
                <CheckCircle2 size={14} />
              ) : status === 'active' ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                i + 1
              )}
            </div>
            <span
              className={`text-sm font-medium transition-colors ${
                status === 'done'
                  ? 'text-emerald-600'
                  : status === 'active'
                  ? 'text-blue-700 font-bold'
                  : 'text-gray-400'
              }`}
            >
              {step.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Component ──────────────────────────────────────────────────────
const FileViewer = ({ cid, patientAddress, recordType, onClose }: FileViewerProps) => {
  const { activeAddress, transactionSigner } = useWallet()
  const [step, setStep] = useState<ViewerStep>('idle')
  const [error, setError] = useState('')
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [mimeType, setMimeType] = useState('')
  const [fileName, setFileName] = useState('')
  const [legacyText, setLegacyText] = useState<string | null>(null)

  const consentAppId = Number(import.meta.env.VITE_CONSENT_MANAGER_APP_ID || 0)

  const handleDecrypt = useCallback(async () => {
    if (!activeAddress || !transactionSigner || !cid) return

    setError('')
    setBlobUrl(null)
    setLegacyText(null)

    try {
      // ── Step 1: Auth ──
      setStep('auth')
      const algorand = getAlgorandClientFromViteEnvironment()
      const authResult = await checkDecryptionAuth(
        activeAddress,
        patientAddress,
        algorand,
        consentAppId,
        transactionSigner
      )

      if (!authResult.authorized) {
        throw new Error(authResult.reason)
      }

      // ── Step 2: Fetch ──
      setStep('fetching')

      // Try new bundle format first, fall back to legacy text format
      let encryptedData: ArrayBuffer | null = null
      let metadata: EncryptionMetadata | null = null
      let isLegacy = false

      try {
        const bundle = await fetchEncryptedFile(cid)
        encryptedData = bundle.encryptedData
        metadata = bundle.metadata
      } catch (bundleErr) {
        // Might be a legacy text-encrypted record
        console.debug('[FileViewer] Bundle parse failed, trying legacy text format...')
        isLegacy = true
      }

      // ── Step 3: Decrypt ──
      setStep('decrypting')

      if (isLegacy) {
        // Legacy text decryption path
        const encryptedText = await fetchFromIPFS(cid)
        const plainText = await decryptData(encryptedText, patientAddress)
        setLegacyText(plainText)
        setStep('done')
        return
      }

      if (!encryptedData || !metadata) {
        throw new Error('FETCH_ERROR: Could not retrieve encrypted data from IPFS.')
      }

      const blob = await decryptFile(encryptedData, metadata, patientAddress)

      // ── Step 4: Render ──
      setStep('rendering')
      const url = URL.createObjectURL(blob)
      setBlobUrl(url)
      setMimeType(metadata.mimeType)
      setFileName(metadata.originalName)

      // ── Step 5: Audit Log ──
      try {
        const auditAppId = Number(import.meta.env.VITE_AUDIT_LOG_APP_ID || 0)
        if (auditAppId > 0) {
          const auditC = new AuditLogClient({ appId: BigInt(auditAppId), algorand })
          await auditC.send.logDataAccessed({
              args: {
                  principal: patientAddress,
                  fiduciary: activeAddress,
                  purpose: `Viewed ${recordType || 'Medical Record'} - CID: ${cid}`,
                  timestamp: BigInt(Math.floor(Date.now() / 1000)),
                  isEmergency: false
              },
              sender: activeAddress,
              signer: transactionSigner
          })
        }
      } catch (auditErr) {
        console.error('Audit logging failed, but file was decrypted:', auditErr)
      }

      setStep('done')
    } catch (err: any) {
      setError(err.message || 'Unknown error during decryption.')
      setStep('error')
    }
  }, [activeAddress, transactionSigner, cid, patientAddress, consentAppId])

  const handleDownload = () => {
    if (!blobUrl) return
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = fileName || 'decrypted_file'
    a.click()
  }

  const isPdf = mimeType === 'application/pdf'
  const isImage = mimeType.startsWith('image/')

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <div
        className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-fade-in-scale flex flex-col"
        style={{ maxHeight: '90vh' }}
      >
        {/* Header */}
        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-blue-50/50 to-violet-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center text-white shadow-lg">
              <Lock size={18} />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-sm">Encrypted File Viewer</h3>
              <p className="text-[10px] text-gray-500 font-mono">
                CID: {cid.slice(0, 16)}...{cid.slice(-6)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 flex-1 overflow-y-auto">
          {/* Idle state — show start button */}
          {step === 'idle' && (
            <div className="flex flex-col items-center justify-center py-10 gap-6">
              <div className="w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center">
                <ShieldCheck size={36} className="text-blue-500" />
              </div>
              <div className="text-center">
                <h4 className="font-bold text-gray-900 mb-1">Ready to Decrypt</h4>
                <p className="text-xs text-gray-500 max-w-xs">
                  This will verify your authorization, fetch the encrypted file from IPFS, and
                  decrypt it for viewing.
                </p>
                {recordType && (
                  <span className="inline-block mt-2 px-3 py-1 bg-violet-50 text-violet-600 text-[10px] font-bold rounded-full uppercase tracking-wider">
                    {recordType}
                  </span>
                )}
              </div>
              <button
                onClick={handleDecrypt}
                className="px-8 py-3 bg-gradient-to-r from-blue-600 to-violet-600 text-white rounded-xl font-bold text-sm shadow-lg hover:shadow-xl transition-all flex items-center gap-2"
              >
                <Lock size={16} /> Decrypt & View
              </button>
            </div>
          )}

          {/* Processing steps */}
          {['auth', 'fetching', 'decrypting', 'rendering'].includes(step) && (
            <div className="py-6">
              <StepIndicator currentStep={step} />
            </div>
          )}

          {/* Error state */}
          {step === 'error' && (
            <div className="flex flex-col items-center justify-center py-8 gap-4">
              <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center">
                {error.includes('ACCESS_DENIED') ? (
                  <ShieldAlert size={32} className="text-red-500" />
                ) : (
                  <AlertTriangle size={32} className="text-red-500" />
                )}
              </div>
              <div className="text-center max-w-sm">
                <h4 className="font-bold text-red-700 mb-2">
                  {error.includes('ACCESS_DENIED') ? 'Authorization Failed' : 'Decryption Error'}
                </h4>
                <p className="text-xs text-gray-600 font-mono bg-red-50 p-3 rounded-xl border border-red-100">
                  {error}
                </p>
              </div>
              <button
                onClick={handleDecrypt}
                className="flex items-center gap-2 px-6 py-2 bg-gray-900 text-white rounded-xl text-xs font-bold hover:bg-gray-800 transition-colors"
              >
                <RefreshCcw size={14} /> Retry
              </button>
            </div>
          )}

          {/* Success — Legacy text */}
          {step === 'done' && legacyText && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 size={16} className="text-emerald-500" />
                <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">
                  Decrypted Successfully (Legacy Text Record)
                </span>
              </div>
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-2xl font-mono text-xs text-gray-700 whitespace-pre-wrap leading-relaxed max-h-[400px] overflow-y-auto">
                {legacyText}
              </div>
            </div>
          )}

          {/* Success — File preview */}
          {step === 'done' && blobUrl && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-500" />
                  <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">
                    Decrypted Successfully
                  </span>
                </div>
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg text-xs font-bold hover:bg-gray-800 transition-colors"
                >
                  <Download size={14} /> Download
                </button>
              </div>

              {/* File info */}
              <div className="flex items-center gap-3 text-xs text-gray-500 bg-gray-50 p-3 rounded-xl border border-gray-100">
                {isPdf ? <FileText size={16} /> : isImage ? <ImageIcon size={16} /> : <Globe size={16} />}
                <span className="font-medium">{fileName}</span>
                <span className="text-[10px] bg-gray-200 px-2 py-0.5 rounded font-mono">{mimeType}</span>
              </div>

              {/* Preview */}
              {isPdf && (
                <iframe
                  src={blobUrl}
                  className="w-full rounded-2xl border border-gray-200 shadow-inner"
                  style={{ height: '500px' }}
                  title="PDF Preview"
                />
              )}

              {isImage && (
                <div className="flex justify-center bg-gray-50 rounded-2xl border border-gray-200 p-4">
                  <img
                    src={blobUrl}
                    alt={fileName}
                    className="max-w-full max-h-[500px] rounded-xl shadow-md"
                  />
                </div>
              )}

              {!isPdf && !isImage && (
                <div className="text-center py-8 bg-gray-50 rounded-2xl border border-gray-200">
                  <Globe size={32} className="text-gray-300 mx-auto mb-3" />
                  <p className="text-xs text-gray-500">
                    Preview not available for this file type. Use the download button above.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default FileViewer
