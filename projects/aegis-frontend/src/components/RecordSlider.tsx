'use client';

import { useEffect, useRef, useState } from 'react';
import type { MedicalRecord } from '../lib/mockdb';
import { recordTypeLabel } from '../lib/mockdb';

interface RecordSliderProps {
  records: MedicalRecord[];
  initialIndex: number;
  onClose: () => void;
  onShare: (record: MedicalRecord) => void;
}

const colorMap: Record<string, string> = {
  lime: 'var(--lime)',
  coral: 'var(--coral)',
  sky: 'var(--sky)',
  violet: 'var(--violet)',
  sun: 'var(--sun)',
};

const typeIcons: Record<string, JSX.Element> = {
  lab: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M10 2v6L4 18a2 2 0 0 0 2 3h12a2 2 0 0 0 2-3L14 8V2" /><path d="M9 2h6" /></svg>,
  imaging: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 9v12" /></svg>,
  prescription: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 3h9l4 4v14H5V4Z" /><path d="M14 3v4h4" /><path d="M9 12h6M9 16h4" /></svg>,
  discharge: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8l-5-5z" /><path d="M9 3v6h6" /></svg>,
  vaccination: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m18 2 4 4-4 4" /><path d="m14 6 6-4" /><path d="m6.5 17.5-3 3-2-2 3-3L3 14l7-7 1.5 1.5" /><path d="m10 14 4-4" /></svg>,
  vitals: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 12h4l3-9 4 18 3-9h4" /></svg>,
};

export default function RecordSlider({ records, initialIndex, onClose, onShare }: RecordSliderProps) {
  const [idx, setIdx] = useState(initialIndex);
  const [dir, setDir] = useState<'left' | 'right' | null>(null);
  const [animating, setAnimating] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const swipeStartX = useRef<number | null>(null);
  const swipeStartY = useRef<number | null>(null);
  const record = records[idx];

  const navigate = (direction: 'left' | 'right') => {
    if (animating) return;
    const next = direction === 'right' ? idx + 1 : idx - 1;
    if (next < 0 || next >= records.length) return;
    setDir(direction);
    setAnimating(true);
    setTimeout(() => {
      setIdx(next);
      setDir(null);
      setAnimating(false);
    }, 260);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') navigate('right');
      if (e.key === 'ArrowLeft') navigate('left');
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [idx, animating]);

  if (!record) return null;

  const accent = colorMap[record.color] ?? 'var(--lime)';

  const slideStyle: React.CSSProperties = animating
    ? { opacity: 0, transform: dir === 'right' ? 'translateX(-24px)' : 'translateX(24px)', transition: 'all .26s ease' }
    : { opacity: 1, transform: 'none', transition: 'all .26s ease' };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    swipeStartX.current = e.clientX;
    swipeStartY.current = e.clientY;
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (swipeStartX.current === null || swipeStartY.current === null) return;
    const dx = e.clientX - swipeStartX.current;
    const dy = e.clientY - swipeStartY.current;
    const isHorizontalSwipe = Math.abs(dx) > 52 && Math.abs(dx) > Math.abs(dy);

    if (isHorizontalSwipe) {
      if (dx < 0) navigate('right');
      else navigate('left');
    }

    swipeStartX.current = null;
    swipeStartY.current = null;
  };

  const onPointerCancel = () => {
    swipeStartX.current = null;
    swipeStartY.current = null;
  };

  return (
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(10,21,20,.55)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
    >
      <div style={{
        position: 'relative',
        background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: '28px',
        width: '100%', maxWidth: '600px', overflow: 'hidden',
        boxShadow: '0 40px 80px -32px rgba(10,21,20,.4)',
        animation: 'modalIn .28s cubic-bezier(.2,.65,.3,1)',
      }}>
        {/* Header */}
        <div style={{ padding: '22px 24px 18px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '14px', background: accent, display: 'grid', placeItems: 'center', color: 'var(--ink)', flexShrink: 0 }}>
              <div style={{ width: '20px', height: '20px' }}>{typeIcons[record.type]}</div>
            </div>
            <div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--ink-3)', letterSpacing: '.14em', textTransform: 'uppercase' }}>{recordTypeLabel[record.type]}</div>
              <div style={{ fontWeight: 600, fontSize: '15px', color: 'var(--ink)', marginTop: '2px' }}>{record.title}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button onClick={() => onShare(record)} style={{ padding: '8px 14px', borderRadius: '10px', border: '1px solid var(--line)', background: 'var(--panel)', fontFamily: 'var(--mono)', fontSize: '10px', letterSpacing: '.1em', textTransform: 'uppercase', cursor: 'pointer', color: 'var(--ink-2)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="3" height="9" /><rect x="9.5" y="7" width="3" height="13" /><rect x="16" y="4" width="3" height="16" /></svg>
              Share QR
            </button>
            <button onClick={onClose} style={{ width: '36px', height: '36px', borderRadius: '10px', border: '1px solid var(--line)', background: 'var(--panel)', display: 'grid', placeItems: 'center', cursor: 'pointer', color: 'var(--ink-2)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        {/* Slide content */}
        <div
          style={{ padding: '28px', touchAction: 'pan-y', ...slideStyle }}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
        >
          {/* Description */}
          <p style={{ fontSize: '14px', lineHeight: 1.65, color: 'var(--ink-2)', marginBottom: '24px' }}>{record.description}</p>

          {/* Metadata grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
            {[
              { label: 'Date', value: record.date },
              { label: 'Uploaded by', value: record.uploadedBy },
              { label: 'Role', value: record.uploadedByRole },
              { label: 'Hospital', value: record.hospital },
              { label: 'File size', value: record.size },
              { label: 'Encrypted', value: record.encrypted ? '✓ AES-GCM 256' : 'Plain' },
            ].map(({ label, value }) => (
              <div key={label} style={{ padding: '12px 14px', background: 'var(--bg)', borderRadius: '12px', border: '1px solid var(--line)' }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: '9px', color: 'var(--ink-3)', letterSpacing: '.14em', textTransform: 'uppercase', marginBottom: '4px' }}>{label}</div>
                <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--ink)' }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Chain data */}
          <div style={{ padding: '16px', background: 'var(--ink)', borderRadius: '14px', marginBottom: '20px' }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: '9px', color: 'rgba(246,245,240,.5)', letterSpacing: '.16em', textTransform: 'uppercase', marginBottom: '12px' }}>On-chain data</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: 'rgba(246,245,240,.55)', letterSpacing: '.1em' }}>IPFS HASH</span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--lime)', letterSpacing: '.06em' }}>Qm…{record.ipfsHash.slice(-8)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: 'rgba(246,245,240,.55)', letterSpacing: '.1em' }}>TX HASH</span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--lime)', letterSpacing: '.06em' }}>{record.txHash}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: 'rgba(246,245,240,.55)', letterSpacing: '.1em' }}>BLOCK HEIGHT</span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: '#f6f5f0', letterSpacing: '.06em' }}>{record.blockHeight.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Tags */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {record.tags.map((tag) => (
              <span key={tag} style={{ padding: '4px 10px', borderRadius: '999px', background: 'var(--bg)', border: '1px solid var(--line)', fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--ink-3)', letterSpacing: '.12em', textTransform: 'uppercase' }}>{tag}</span>
            ))}
          </div>
        </div>

        {/* Side arrows */}
        <button
          onClick={() => navigate('left')}
          disabled={idx === 0}
          aria-label="Previous record"
          style={{
            position: 'absolute',
            top: '50%',
            left: '12px',
            transform: 'translateY(-50%)',
            width: '48px',
            height: '48px',
            borderRadius: '999px',
            border: idx === 0 ? '1px solid var(--line)' : '1px solid color-mix(in oklch, var(--lime) 26%, var(--line))',
            background: idx === 0
              ? 'rgba(255,255,255,.72)'
              : 'radial-gradient(circle at 30% 30%, #ffffff 0%, var(--panel) 65%, var(--bg-2) 100%)',
            color: idx === 0 ? 'var(--ink-3)' : 'var(--ink)',
            display: 'grid',
            placeItems: 'center',
            cursor: idx === 0 ? 'not-allowed' : 'pointer',
            boxShadow: idx === 0
              ? '0 8px 18px -14px rgba(10,21,20,.3)'
              : '0 18px 28px -18px rgba(10,21,20,.55), 0 0 0 2px rgba(255,255,255,.55) inset',
            zIndex: 6,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18 9 12l6-6" /></svg>
        </button>

        <button
          onClick={() => navigate('right')}
          disabled={idx === records.length - 1}
          aria-label="Next record"
          style={{
            position: 'absolute',
            top: '50%',
            right: '12px',
            transform: 'translateY(-50%)',
            width: '48px',
            height: '48px',
            borderRadius: '999px',
            border: idx === records.length - 1 ? '1px solid var(--line)' : '1px solid color-mix(in oklch, var(--lime) 26%, var(--line))',
            background: idx === records.length - 1
              ? 'rgba(255,255,255,.72)'
              : 'radial-gradient(circle at 30% 30%, #ffffff 0%, var(--panel) 65%, var(--bg-2) 100%)',
            color: idx === records.length - 1 ? 'var(--ink-3)' : 'var(--ink)',
            display: 'grid',
            placeItems: 'center',
            cursor: idx === records.length - 1 ? 'not-allowed' : 'pointer',
            boxShadow: idx === records.length - 1
              ? '0 8px 18px -14px rgba(10,21,20,.3)'
              : '0 18px 28px -18px rgba(10,21,20,.55), 0 0 0 2px rgba(255,255,255,.55) inset',
            zIndex: 6,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6" /></svg>
        </button>

        {/* Navigation footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'var(--bg-2)' }}>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            {records.map((_, i) => (
              <button
                key={i}
                onClick={() => { if (!animating) setIdx(i); }}
                aria-label={`Go to record ${i + 1}`}
                style={{ width: i === idx ? '22px' : '7px', height: '7px', borderRadius: '999px', border: 'none', cursor: 'pointer', transition: 'all .3s', background: i === idx ? accent : 'var(--line-2)' }}
              />
            ))}
          </div>
        </div>
      </div>

      <style>{`@keyframes modalIn { from { opacity:0; transform:scale(.95) translateY(8px) } to { opacity:1; transform:none } }`}</style>
    </div>
  );
}
