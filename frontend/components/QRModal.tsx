'use client';

import { useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import type { MedicalRecord, Patient } from '../lib/mockdb';

interface QRModalProps {
  record: MedicalRecord | null;
  patient: Patient;
  onClose: () => void;
}

export default function QRModal({ record, patient, onClose }: QRModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!record) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [record, onClose]);

  if (!record) return null;

  const shareUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/share/${record.id}?pid=${patient.shortId}`;

  return (
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(10,21,20,.55)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div style={{
        background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: '28px',
        padding: '40px', maxWidth: '420px', width: '100%',
        boxShadow: '0 32px 64px -24px rgba(10,21,20,.35)',
        animation: 'modalIn .28s cubic-bezier(.2,.65,.3,1)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' }}>
          <div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--ink-3)', letterSpacing: '.16em', textTransform: 'uppercase', marginBottom: '6px' }}>Share record</div>
            <h3 style={{ fontFamily: 'var(--serif)', fontWeight: 400, fontSize: '22px', letterSpacing: '-.01em' }}>{record.title}</h3>
            <div style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--ink-3)', marginTop: '4px', letterSpacing: '.12em' }}>Patient: {patient.name} · {patient.shortId}</div>
          </div>
          <button onClick={onClose} style={{ width: '36px', height: '36px', borderRadius: '10px', border: '1px solid var(--line)', background: 'var(--bg)', display: 'grid', placeItems: 'center', cursor: 'pointer', color: 'var(--ink-2)', flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
          <div style={{
            padding: '20px', background: '#fff', borderRadius: '20px',
            border: '1px solid var(--line)', display: 'inline-block',
          }}>
            <QRCodeSVG
              value={shareUrl}
              size={200}
              bgColor="#ffffff"
              fgColor="#0a1514"
              level="M"
              includeMargin={false}
            />
          </div>

          <div style={{ width: '100%', padding: '14px 16px', background: 'var(--bg)', borderRadius: '14px', border: '1px solid var(--line)' }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: '9px', color: 'var(--ink-3)', letterSpacing: '.14em', textTransform: 'uppercase', marginBottom: '6px' }}>Share link</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--ink)', wordBreak: 'break-all', lineHeight: 1.5 }}>{shareUrl}</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', width: '100%' }}>
            <button
              onClick={() => navigator.clipboard?.writeText(shareUrl)}
              style={{ padding: '10px', borderRadius: '12px', border: '1px solid var(--line)', background: 'var(--bg)', fontFamily: 'var(--mono)', fontSize: '11px', letterSpacing: '.1em', textTransform: 'uppercase', cursor: 'pointer', color: 'var(--ink-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
              Copy link
            </button>
            <button
              onClick={onClose}
              style={{ padding: '10px', borderRadius: '12px', border: 'none', background: 'var(--ink)', fontFamily: 'var(--mono)', fontSize: '11px', letterSpacing: '.1em', textTransform: 'uppercase', cursor: 'pointer', color: 'var(--lime)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m5 12 5 5L20 7" /></svg>
              Done
            </button>
          </div>

          <div style={{ fontFamily: 'var(--mono)', fontSize: '9px', color: 'var(--ink-3)', letterSpacing: '.12em', textAlign: 'center', lineHeight: 1.6 }}>
            QR code grants time-limited read access · Encrypted · Logged to chain
          </div>
        </div>
      </div>

      <style>{`@keyframes modalIn { from { opacity:0; transform:scale(.95) translateY(8px) } to { opacity:1; transform:none } }`}</style>
    </div>
  );
}
