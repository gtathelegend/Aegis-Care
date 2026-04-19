'use client';

import { useEffect, useRef, useState } from 'react';
import { patients, addPrescription, addRecord, addAuditEntry, MedicalRecord } from '../lib/mockdb';

interface PrescriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultPatientId?: string;
  onSuccess?: (rec: MedicalRecord) => void;
  doctorName?: string;
}

export default function PrescriptionModal({ isOpen, onClose, defaultPatientId = 'p1', onSuccess, doctorName = 'Dr. Hanwa, K.' }: PrescriptionModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [patientId, setPatientId] = useState(defaultPatientId);
  const [medication, setMedication] = useState('');
  const [dosage, setDosage] = useState('');
  const [duration, setDuration] = useState('');
  const [instructions, setInstructions] = useState('');
  const [fileName, setFileName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const patient = patients.find(p => p.id === patientId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!medication || !dosage || !duration || !instructions) {
      alert('Please fill in all required fields');
      return;
    }

    setIsLoading(true);

    try {
      let ipfsHash = `QmMOCK_${Date.now()}`;
      let fileSize = '12 KB';

      // Upload file to Pinata if provided
      const fileInput = document.getElementById('file-input') as HTMLInputElement;
      if (fileInput?.files?.[0]) {
        const file = fileInput.files[0];
        const formData = new FormData();
        formData.append('file', file);
        formData.append('recordType', 'prescription');

        const uploadResponse = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!uploadResponse.ok) {
          const error = await uploadResponse.json();
          throw new Error(error.error || 'Upload failed');
        }

        const uploadData = await uploadResponse.json();
        ipfsHash = uploadData.ipfsHash;
        fileSize = `${(uploadData.size / 1024).toFixed(1)} KB`;
      }

      const recordData = {
        patientId,
        type: 'prescription' as const,
        title: `Prescription — ${medication}`,
        description: `Dosage: ${dosage}\nDuration: ${duration}\n\nInstructions: ${instructions}`,
        uploadedBy: doctorName,
        uploadedByRole: 'Clinician',
        hospital: 'Helix Hospital',
        date: new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' }),
        ipfsHash,
        txHash: `0x${Math.random().toString(16).slice(2, 18)}`,
        blockHeight: Math.floor(Math.random() * 30000000),
        encrypted: true,
        size: fileSize,
        tags: ['Prescription', medication],
        color: 'sky' as const,
      };

      const record = addRecord(recordData);

      addPrescription({
        patientId,
        patientName: patient?.name || 'Unknown Patient',
        medication,
        dosage,
        instructions,
        prescribedBy: doctorName,
        prescribedAt: new Date().toLocaleString(),
        cid: ipfsHash,
        status: 'pending',
        fileName,
      });

      addAuditEntry({
        action: 'WRITE',
        actor: doctorName,
        actorRole: 'Clinician',
        subject: `Prescription — ${medication}`,
        detail: `WRITE · PRESCRIPTION · ${record.id}`,
        timestamp: new Date().toLocaleString(),
        txHash: recordData.txHash,
        color: 'sky',
      });

      setSuccess(true);
      setTimeout(() => {
        setIsLoading(false);
        setSuccess(false);
        setMedication('');
        setDosage('');
        setDuration('');
        setInstructions('');
        setFileName('');
        onSuccess?.(record);
        onClose();
      }, 1200);
    } catch (error) {
      setIsLoading(false);
      alert(`Error: ${error instanceof Error ? error.message : 'Upload failed'}`);
    }
  };

  return (
    <div
      ref={overlayRef}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
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
    >
      <style>{`@keyframes modalIn{from{opacity:0;transform:scale(.95) translateY(8px)}to{opacity:1;transform:none}}`}</style>

      <div style={{
        background: 'var(--panel)',
        border: '1px solid var(--line)',
        borderRadius: '28px',
        padding: '40px',
        maxWidth: '500px',
        width: '100%',
        boxShadow: '0 32px 64px -24px rgba(10,21,20,.35)',
        animation: 'modalIn .28s cubic-bezier(.2,.65,.3,1)',
        overflowY: 'auto',
        maxHeight: '90vh',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
          <div>
            <h2 style={{ margin: '0 0 4px 0', fontSize: '20px', fontFamily: 'var(--serif)' }}>Upload Prescription</h2>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--ink-3)', fontFamily: 'var(--mono)', letterSpacing: '.1em' }}>Add new prescription to patient record</p>
          </div>
          <button
            onClick={onClose}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              border: '1px solid var(--line)',
              background: 'var(--bg)',
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
              color: 'var(--ink-2)',
              flexShrink: 0,
              padding: 0,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {!success ? (
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="patient">Patient *</label>
              <select
                id="patient"
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                className="field"
              >
                {patients.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.shortId})</option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="medication">Medication Name *</label>
              <input
                id="medication"
                type="text"
                placeholder="e.g., Amoxicillin"
                value={medication}
                onChange={(e) => setMedication(e.target.value)}
                className="field"
              />
            </div>

            <div className="field-row">
              <div className="field">
                <label htmlFor="dosage">Dosage *</label>
                <input
                  id="dosage"
                  type="text"
                  placeholder="e.g., 500mg TID"
                  value={dosage}
                  onChange={(e) => setDosage(e.target.value)}
                  className="field"
                />
              </div>
              <div className="field">
                <label htmlFor="duration">Duration *</label>
                <input
                  id="duration"
                  type="text"
                  placeholder="e.g., 10 days"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="field"
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor="instructions">Instructions *</label>
              <textarea
                id="instructions"
                rows={3}
                placeholder="Take one tablet three times daily with food. Complete full course even if symptoms resolve."
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                className="field"
                style={{ resize: 'vertical' }}
              />
            </div>

            <div className="field">
              <label htmlFor="file">Prescription File (Optional)</label>
              <div
                className="upload-zone"
                onClick={() => document.getElementById('file-input')?.click()}
              >
                {fileName ? (
                  <div style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--ink)' }}>
                    📄 {fileName}
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: '20px', marginBottom: '6px' }}>📎</div>
                    <div>Click or drag PDF/image</div>
                  </>
                )}
              </div>
              <input
                id="file-input"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setFileName(e.target.files?.[0]?.name || '')}
                style={{ display: 'none' }}
              />
            </div>

            <div className="form-actions">
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '10px',
                  borderRadius: '12px',
                  border: '1px solid var(--line)',
                  background: 'var(--bg)',
                  fontFamily: 'var(--mono)',
                  fontSize: '11px',
                  letterSpacing: '.1em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  color: 'var(--ink-2)',
                  transition: 'all .2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--ink)';
                  e.currentTarget.style.background = 'var(--bg-1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--ink-2)';
                  e.currentTarget.style.background = 'var(--bg)';
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                style={{
                  padding: '10px',
                  borderRadius: '12px',
                  border: 'none',
                  background: isLoading ? 'var(--ink-3)' : 'var(--ink)',
                  fontFamily: 'var(--mono)',
                  fontSize: '11px',
                  letterSpacing: '.1em',
                  textTransform: 'uppercase',
                  cursor: isLoading ? 'default' : 'pointer',
                  color: 'var(--lime)',
                  transition: 'all .2s',
                  opacity: isLoading ? 0.6 : 1,
                }}
              >
                {isLoading ? 'Uploading...' : 'Upload'}
              </button>
            </div>
          </form>
        ) : (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>✓</div>
            <h3 style={{ margin: '0 0 4px 0', color: 'var(--ink-green)' }}>Prescription uploaded</h3>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--ink-2)' }}>
              Added to {patient?.name}'s record and prescription queue
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
