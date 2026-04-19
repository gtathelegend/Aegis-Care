import { useState, useRef } from 'react'
import { useUploadRecord } from '../hooks/useUploadRecord'

interface UploadRecordModalProps {
  isOpen: boolean
  onClose: () => void
  patientAddress: string
  onSuccess?: (cid: string) => void
}

const RECORD_TYPES = [
  { value: 'lab', label: 'Lab Results' },
  { value: 'imaging', label: 'Imaging' },
  { value: 'prescription', label: 'Prescription' },
  { value: 'discharge', label: 'Discharge Summary' },
  { value: 'vaccination', label: 'Vaccination' },
  { value: 'vitals', label: 'Vitals' },
]

export default function UploadRecordModal({
  isOpen,
  onClose,
  patientAddress,
  onSuccess,
}: UploadRecordModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [recordType, setRecordType] = useState('lab')
  const [billAmount, setBillAmount] = useState('')

  const { uploadRecord, loading, error } = useUploadRecord()

  if (!isOpen) return null

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] || null)
  }

  const handleUpload = async () => {
    if (!file || !title) {
      alert('Please select a file and enter a title')
      return
    }

    const result = await uploadRecord({
      file,
      patientAddress,
      recordType: recordType as any,
      title,
      billAmount: billAmount ? parseInt(billAmount) : undefined,
    })

    if (result?.success) {
      onSuccess?.(result.cid)
      setFile(null)
      setTitle('')
      setBillAmount('')
      onClose()
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(10,21,20,.55)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: 'var(--panel)',
          border: '1px solid var(--line)',
          borderRadius: '28px',
          padding: '40px',
          maxWidth: '500px',
          width: '100%',
          boxShadow: '0 32px 64px -24px rgba(10,21,20,.35)',
          animation: 'modalIn .28s cubic-bezier(.2,.65,.3,1)',
        }}
      >
        <div style={{ marginBottom: '28px' }}>
          <h3 style={{ fontSize: '22px', marginBottom: '8px' }}>Upload Record</h3>
          <p style={{ fontSize: '14px', color: 'var(--ink-2)' }}>
            Select a file and enter record details
          </p>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: 600 }}>
            Record Type
          </label>
          <select
            value={recordType}
            onChange={(e) => setRecordType(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: '12px',
              border: '1px solid var(--line)',
              background: 'var(--bg)',
              color: 'var(--ink)',
              fontSize: '14px',
              fontFamily: 'inherit',
            }}
          >
            {RECORD_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: 600 }}>
            Record Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Blood Panel 2026-04"
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: '12px',
              border: '1px solid var(--line)',
              background: 'var(--bg)',
              color: 'var(--ink)',
              fontSize: '14px',
              fontFamily: 'inherit',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: 600 }}>
            Bill Amount (µAlgos, optional)
          </label>
          <input
            type="number"
            value={billAmount}
            onChange={(e) => setBillAmount(e.target.value)}
            placeholder="0"
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: '12px',
              border: '1px solid var(--line)',
              background: 'var(--bg)',
              color: 'var(--ink)',
              fontSize: '14px',
              fontFamily: 'inherit',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: 600 }}>
            Select File
          </label>
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            style={{
              display: 'block',
              width: '100%',
              padding: '10px 12px',
              borderRadius: '12px',
              border: '1px dashed var(--line)',
              background: 'var(--bg)',
              cursor: 'pointer',
            }}
          />
          {file && (
            <p style={{ fontSize: '12px', color: 'var(--ink-2)', marginTop: '8px' }}>
              Selected: {file.name}
            </p>
          )}
        </div>

        {error && (
          <div
            style={{
              marginBottom: '20px',
              padding: '12px 16px',
              background: 'rgba(220, 38, 38, 0.1)',
              border: '1px solid rgba(220, 38, 38, 0.3)',
              borderRadius: '12px',
              color: 'var(--ink)',
              fontSize: '13px',
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={onClose}
            disabled={loading}
            style={{
              flex: 1,
              padding: '12px 16px',
              borderRadius: '12px',
              border: '1px solid var(--line)',
              background: 'var(--bg)',
              color: 'var(--ink-2)',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: 600,
              opacity: loading ? 0.6 : 1,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={loading || !file}
            style={{
              flex: 1,
              padding: '12px 16px',
              borderRadius: '12px',
              border: 'none',
              background: 'var(--lime)',
              color: 'var(--ink)',
              cursor: loading || !file ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: 600,
              opacity: loading || !file ? 0.6 : 1,
            }}
          >
            {loading ? 'Uploading...' : 'Upload Record'}
          </button>
        </div>
      </div>
      <style>{`@keyframes modalIn { from { opacity:0; transform:scale(.95) translateY(8px) } to { opacity:1; transform:none } }`}</style>
    </div>
  )
}
