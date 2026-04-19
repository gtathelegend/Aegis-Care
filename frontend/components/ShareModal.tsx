'use client';

import { useEffect, useRef, useState } from 'react';
import { getProviders, addConsent, addAuditEntry, MedicalRecord, Consent } from '../lib/mockdb';

interface ShareModalProps {
  record: MedicalRecord | null;
  onClose: () => void;
  onSuccess?: (consent: Consent) => void;
  patientName?: string;
}

const scopeByRecordType: Record<string, { label: string; color: string }> = {
  lab: { label: 'LAB_RESULTS', color: 'sky' },
  imaging: { label: 'IMAGING', color: 'coral' },
  prescription: { label: 'RX_VIEW', color: 'sky' },
  discharge: { label: 'DISCHARGE', color: 'violet' },
  vaccination: { label: 'VACCINATION', color: 'sun' },
  vitals: { label: 'VITALS', color: 'lime' },
};

export default function ShareModal({ record, onClose, onSuccess, patientName = 'Ishaan Kapoor' }: ShareModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [providerId, setProviderId] = useState('');
  const [duration, setDuration] = useState('24h');
  const [purpose, setPurpose] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const providers = getProviders();

  useEffect(() => {
    if (!record) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [record, onClose]);

  if (!record) return null;

  const provider = providers.find(p => p.id === providerId);
  const scope = scopeByRecordType[record.type];
  const durationMap: Record<string, { hours: number; label: string }> = {
    '1h': { hours: 1, label: '1H' },
    '6h': { hours: 6, label: '6H' },
    '24h': { hours: 24, label: '24H' },
    '48h': { hours: 48, label: '48H' },
    '7d': { hours: 168, label: '7D' },
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!providerId || !duration) {
      alert('Please select a provider and duration');
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      const now = new Date();
      const durationInfo = durationMap[duration];
      const expiresAt = new Date(now.getTime() + durationInfo.hours * 60 * 60 * 1000);

      const consent = addConsent({
        patientId: record.patientId,
        grantedTo: provider?.name || 'Unknown Provider',
        grantedToRole: provider?.role || 'Unknown Role',
        grantedToAvatar: provider?.avatar || '?',
        grantedToColor: (provider?.color || 'sky') as any,
        scope: scope.label,
        scopeLabel: `${scope.label} · ${durationInfo.label}`,
        status: 'active',
        issuedAt: now.toLocaleString('en-GB', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
        expiresAt: expiresAt.toLocaleString('en-GB', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
        remaining: `${durationInfo.hours}h`,
        progressPct: 100,
        txHash: `0x${Math.random().toString(16).slice(2, 18)}`,
      });

      addAuditEntry({
        action: 'CONSENT_GRANT',
        actor: patientName,
        actorRole: 'Patient',
        subject: provider?.name || 'Unknown Provider',
        detail: `CONSENT · ${scope.label} · ${durationInfo.label}`,
        timestamp: now.toLocaleString(),
        txHash: consent.txHash,
        color: scope.color as any,
      });

      setSuccess(true);
      setTimeout(() => {
        setIsLoading(false);
        setSuccess(false);
        setProviderId('');
        setPurpose('');
        onSuccess?.(consent);
        onClose();
      }, 1200);
    }, 800);
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
        maxWidth: '480px',
        width: '100%',
        boxShadow: '0 32px 64px -24px rgba(10,21,20,.35)',
        animation: 'modalIn .28s cubic-bezier(.2,.65,.3,1)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
          <div>
            <h2 style={{ margin: '0 0 4px 0', fontSize: '20px', fontFamily: 'var(--serif)' }}>Share Record</h2>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--ink-3)', fontFamily: 'var(--mono)', letterSpacing: '.1em' }}>{record.title}</p>
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
              <label htmlFor="provider">Share with *</label>
              <select
                id="provider"
                value={providerId}
                onChange={(e) => setProviderId(e.target.value)}
                className="field"
              >
                <option value="">Select a provider…</option>
                {providers.map(p => (
                  <option key={p.id} value={p.id}>{p.name} · {p.role}</option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="scope">Scope</label>
              <div style={{
                padding: '10px 14px',
                border: '1px solid var(--line)',
                borderRadius: '12px',
                background: 'var(--bg)',
                fontFamily: 'var(--mono)',
                fontSize: '11px',
                color: 'var(--ink)',
                letterSpacing: '.06em',
              }}>
                {scope?.label || 'Unknown'} ACCESS
              </div>
            </div>

            <div className="field">
              <label htmlFor="duration">Access Duration *</label>
              <select
                id="duration"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="field"
              >
                <option value="1h">1 hour</option>
                <option value="6h">6 hours</option>
                <option value="24h">24 hours</option>
                <option value="48h">48 hours</option>
                <option value="7d">7 days</option>
              </select>
            </div>

            <div className="field">
              <label htmlFor="purpose">Purpose (Optional)</label>
              <textarea
                id="purpose"
                rows={2}
                placeholder="e.g., Emergency consultation, Routine follow-up…"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                className="field"
                style={{ resize: 'vertical' }}
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
                {isLoading ? 'Sharing...' : 'Grant Access'}
              </button>
            </div>
          </form>
        ) : (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>✓</div>
            <h3 style={{ margin: '0 0 4px 0', color: 'var(--ink-green)' }}>Access granted</h3>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--ink-2)' }}>
              {provider?.name} can now access this record for {durationMap[duration].label}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
