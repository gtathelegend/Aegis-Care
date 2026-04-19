'use client';

import { useEffect, useState, useCallback } from 'react';
import '../../styles/dashboard.css';
import QRModal from '../../components/QRModal';
import RecordSlider from '../../components/RecordSlider';
import { QRCodeSVG } from 'qrcode.react';
import { medicalRecords, consents, auditLog, inboundRequests, getPatientById, recordTypeLabel } from '../../lib/mockdb';
import type { MedicalRecord } from '../../lib/mockdb';

const patient = getPatientById('p1');

export default function DashboardPage() {
  const [activeNav, setActiveNav] = useState('overview');
  const [activeTab, setActiveTab] = useState('all');
  const [qrRecord, setQrRecord] = useState<MedicalRecord | null>(null);
  const [sliderOpen, setSliderOpen] = useState(false);
  const [sliderIndex, setSliderIndex] = useState(0);

  const navLabels: Record<string, string> = {
    overview: 'Overview',
    records: 'Records',
    consents: 'Consents',
    audit: 'Audit Trail',
    vault: 'Vault',
    hospitals: 'Hospitals',
    research: 'Research',
    settings: 'Settings',
  };

  const currentNavLabel = navLabels[activeNav] ?? 'Overview';

  const openSlider = useCallback((index: number) => {
    setSliderIndex(index);
    setSliderOpen(true);
  }, []);

  const openQR = useCallback((record: MedicalRecord) => {
    setQrRecord(record);
  }, []);

  useEffect(() => {
    const revealEls = Array.from(document.querySelectorAll<HTMLElement>('.reveal'));
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const io = prefersReducedMotion
      ? null
      : new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                entry.target.classList.add('in');
                io?.unobserve(entry.target);
              }
            });
          },
          { threshold: 0.1 }
        );

    if (prefersReducedMotion) {
      revealEls.forEach((el) => el.classList.add('in'));
    } else {
      revealEls.forEach((el) => io?.observe(el));
    }

    const blobs = Array.from(document.querySelectorAll<HTMLElement>('.blobs i'));
    let scrollRaf = 0;
    const applyParallax = () => {
      const y = document.documentElement.scrollTop || document.body.scrollTop;
      blobs.forEach((el, index) => {
        const factor = [0.08, 0.12, -0.06][index] || 0.1;
        el.style.transform = `translate3d(0, ${y * factor}px, 0)`;
      });
      scrollRaf = 0;
    };

    const handleScroll = () => {
      if (prefersReducedMotion || scrollRaf) {
        return;
      }
      scrollRaf = window.requestAnimationFrame(applyParallax);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    if (!prefersReducedMotion) {
      applyParallax();
    }

    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollRaf) {
        window.cancelAnimationFrame(scrollRaf);
      }
      io?.disconnect();
    };
  }, []);

  const renderPatientTabContent = () => {
    if (activeNav === 'records') {
      return (
        <div className="card">
          <div className="head">
            <div>
              <h3>All Records</h3>
              <div className="sub" style={{ marginTop: '4px' }}>{medicalRecords.length} records · click to open slider</div>
            </div>
            <div className="actions">
              <button className="chip">Recent first</button>
              <button className="chip">Encrypted only</button>
            </div>
          </div>
          <div className="recs">
            {medicalRecords.map((rec, i) => (
              <div
                key={rec.id}
                className="rec"
                data-c={rec.color}
                style={{ position: 'relative', cursor: 'pointer' }}
                onClick={() => openSlider(i)}
              >
                <div className="top">
                  <div className="icn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M6 3h9l4 4v14H5V4Z" />
                      <path d="M14 3v4h4" />
                    </svg>
                  </div>
                  <span className="chip-s">{recordTypeLabel[rec.type]}</span>
                </div>
                <h4>{rec.title}</h4>
                <p>{rec.hospital} · {rec.date}</p>
                <div className="cid">ipfs://Qm…{rec.ipfsHash.slice(-8)}</div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (activeNav === 'consents') {
      const filteredConsents = consents.filter((item) => activeTab === 'all' || item.status === activeTab);
      return (
        <div className="card">
          <div className="head">
            <div>
              <h3>Consent Manager</h3>
              <div className="sub" style={{ marginTop: '4px' }}>Review and manage all consent windows</div>
            </div>
            <div className="actions">
              <div className="tabs">
                <button className={activeTab === 'all' ? 'on' : ''} onClick={() => setActiveTab('all')}>All</button>
                <button className={activeTab === 'active' ? 'on' : ''} onClick={() => setActiveTab('active')}>Active</button>
                <button className={activeTab === 'pending' ? 'on' : ''} onClick={() => setActiveTab('pending')}>Pending</button>
                <button className={activeTab === 'expired' ? 'on' : ''} onClick={() => setActiveTab('expired')}>Expired</button>
              </div>
            </div>
          </div>
          <table className="tbl">
            <thead>
              <tr>
                <th>Requester</th>
                <th>Scope</th>
                <th>Status</th>
                <th>Expires</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filteredConsents.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div className="avn">
                      <div className="av" data-c={item.grantedToColor}>{item.grantedToAvatar}</div>
                      <div>
                        <div className="nm">{item.grantedTo}</div>
                        <div className="rl">{item.grantedToRole}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--ink-2)', letterSpacing: '.06em' }}>{item.scopeLabel}</td>
                  <td><span className={`pill-s ${item.status}`}>{item.status}</span></td>
                  <td style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--ink-3)' }}>{item.expiresAt}</td>
                  <td className="actions-cell">
                    <button className="ibtn" title="View">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                    </button>
                    {item.status === 'active' && (
                      <button className="ibtn danger" title="Revoke">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (activeNav === 'audit') {
      return (
        <div className="card">
          <div className="head">
            <div>
              <h3>Full Audit Trail</h3>
              <div className="sub" style={{ marginTop: '4px' }}>All access and consent actions are immutable</div>
            </div>
            <div className="actions">
              <button className="chip">Export CSV</button>
            </div>
          </div>
          <div className="audit" style={{ paddingBottom: '20px' }}>
            {auditLog.map((entry) => (
              <div className="audit-item" key={entry.id}>
                <span className="pin" data-c={entry.color} />
                <div className="body">
                  <div className="t"><em>{entry.action}</em> · {entry.actor}</div>
                  <div className="d">{entry.detail} · {entry.subject}</div>
                </div>
                <time>{entry.timestamp}</time>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (activeNav === 'vault') {
      const encryptedCount = medicalRecords.filter((rec) => rec.encrypted).length;
      return (
        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div className="card">
            <div className="head">
              <div>
                <h3>Vault Health</h3>
                <div className="sub" style={{ marginTop: '4px' }}>Encryption and storage status</div>
              </div>
            </div>
            <div className="requests" style={{ gap: '12px' }}>
              <div className="req" style={{ cursor: 'default' }}>
                <div className="body">
                  <div className="t">Encrypted Records</div>
                  <div className="d">{encryptedCount} / {medicalRecords.length} files</div>
                </div>
              </div>
              <div className="req" style={{ cursor: 'default' }}>
                <div className="body">
                  <div className="t">IPFS Pin Health</div>
                  <div className="d">100% online replication</div>
                </div>
              </div>
              <div className="req" style={{ cursor: 'default' }}>
                <div className="body">
                  <div className="t">Last Key Rotation</div>
                  <div className="d">17 Apr 2026, 08:10 UTC</div>
                </div>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="head">
              <div>
                <h3>Inbound Queue</h3>
                <div className="sub" style={{ marginTop: '4px' }}>Requests waiting for patient decision</div>
              </div>
            </div>
            <div className="requests">
              {inboundRequests.map((item) => (
                <div className="req" key={item.id}>
                  <div className="av" data-c={item.fromColor}>{item.fromAvatar}</div>
                  <div className="body">
                    <div className="t">{item.from}</div>
                    <div className="d">{item.scope} · {item.urgency}</div>
                  </div>
                  <div className="acts">
                    <button className="approve">Approve</button>
                    <button className="deny">Deny</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    if (activeNav === 'hospitals') {
      const hospitalMap = medicalRecords.reduce<Record<string, number>>((acc, rec) => {
        acc[rec.hospital] = (acc[rec.hospital] ?? 0) + 1;
        return acc;
      }, {});
      return (
        <div className="card">
          <div className="head">
            <div>
              <h3>Hospital Registry</h3>
              <div className="sub" style={{ marginTop: '4px' }}>Connected institutions and record activity</div>
            </div>
          </div>
          <table className="tbl">
            <thead>
              <tr>
                <th>Institution</th>
                <th>Records</th>
                <th>Last Sync</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(hospitalMap).map(([name, count]) => (
                <tr key={name}>
                  <td>{name}</td>
                  <td>{count}</td>
                  <td style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--ink-3)' }}>18 Apr 2026, 14:20</td>
                  <td><span className="pill-s active">active</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (activeNav === 'research') {
      return (
        <div className="grid" style={{ gridTemplateColumns: '1.4fr 1fr' }}>
          <div className="card">
            <div className="head">
              <div>
                <h3>Research Sandbox</h3>
                <div className="sub" style={{ marginTop: '4px' }}>De-identified dataset requests</div>
              </div>
            </div>
            <div className="requests">
              <div className="req">
                <div className="av" data-c="sky">RU</div>
                <div className="body">
                  <div className="t">Riverside University</div>
                  <div className="d">Cardio cohort · 180 days · 2,400 records</div>
                </div>
                <div className="acts"><button className="approve">Review</button></div>
              </div>
              <div className="req">
                <div className="av" data-c="violet">NH</div>
                <div className="body">
                  <div className="t">National Health Lab</div>
                  <div className="d">Diabetes outcomes · 90 days · 1,180 records</div>
                </div>
                <div className="acts"><button className="approve">Review</button></div>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="head">
              <div>
                <h3>Policy Guardrails</h3>
                <div className="sub" style={{ marginTop: '4px' }}>Automatic enforcement</div>
              </div>
            </div>
            <div className="audit">
              <div className="audit-item">
                <span className="pin" data-c="lime" />
                <div className="body"><div className="t">PII fields stripped before export</div></div>
              </div>
              <div className="audit-item">
                <span className="pin" data-c="sky" />
                <div className="body"><div className="t">Consent scope validated at query time</div></div>
              </div>
              <div className="audit-item">
                <span className="pin" data-c="coral" />
                <div className="body"><div className="t">Expiry window auto-enforced</div></div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="card">
          <div className="head">
            <div>
              <h3>Profile Settings</h3>
              <div className="sub" style={{ marginTop: '4px' }}>Identity and notification controls</div>
            </div>
          </div>
          <div className="requests" style={{ gap: '10px' }}>
            <div className="req" style={{ cursor: 'default' }}><div className="body"><div className="t">Wallet Verified</div><div className="d">0xA1B2...A1B2</div></div></div>
            <div className="req" style={{ cursor: 'default' }}><div className="body"><div className="t">Alerts</div><div className="d">Push + email enabled</div></div></div>
            <div className="req" style={{ cursor: 'default' }}><div className="body"><div className="t">Auto-revoke</div><div className="d">Enabled for emergency grants</div></div></div>
          </div>
        </div>
        <div className="card">
          <div className="head">
            <div>
              <h3>Security Center</h3>
              <div className="sub" style={{ marginTop: '4px' }}>Session and key protections</div>
            </div>
          </div>
          <div className="audit">
            <div className="audit-item"><span className="pin" data-c="lime" /><div className="body"><div className="t">2FA for critical approvals</div></div></div>
            <div className="audit-item"><span className="pin" data-c="sky" /><div className="body"><div className="t">Device trust list: 3 active</div></div></div>
            <div className="audit-item"><span className="pin" data-c="violet" /><div className="body"><div className="t">Last login: 18 Apr 2026, 19:24</div></div></div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="grain">
      <div className="blobs">
        <i className="b1" />
        <i className="b2" />
        <i className="b3" />
      </div>
      <div className="app">
        <aside>
          <div className="brand">
            <div className="mark">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5l-8-3Z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            </div>
            <b>
              Aegis-Care <span>/ v2.4</span>
            </b>
          </div>

          <div className="navgroup">
            <h5>Patient</h5>
            <div className={`navitem ${activeNav === 'overview' ? 'active' : ''}`} onClick={() => setActiveNav('overview')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                <rect x="3" y="3" width="7" height="7" rx="1.5" />
                <rect x="14" y="3" width="7" height="7" rx="1.5" />
                <rect x="3" y="14" width="7" height="7" rx="1.5" />
                <rect x="14" y="14" width="7" height="7" rx="1.5" />
              </svg>
              Overview
            </div>
            <div className={`navitem ${activeNav === 'records' ? 'active' : ''}`} onClick={() => setActiveNav('records')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                <path d="M6 3h9l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
                <path d="M14 3v4h4" />
              </svg>
              Records<span className="badge">12</span>
            </div>
            <div className={`navitem ${activeNav === 'consents' ? 'active' : ''}`} onClick={() => setActiveNav('consents')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                <path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5l-8-3Z" />
              </svg>
              Consents<span className="badge">5</span>
            </div>
            <div className={`navitem ${activeNav === 'audit' ? 'active' : ''}`} onClick={() => setActiveNav('audit')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                <path d="M3 7h18M3 12h18M3 17h18" />
              </svg>
              Audit trail
            </div>
            <div className={`navitem ${activeNav === 'vault' ? 'active' : ''}`} onClick={() => setActiveNav('vault')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                <rect x="4" y="8" width="16" height="12" rx="2" />
                <path d="M8 8V6a4 4 0 0 1 8 0v2" />
              </svg>
              Vault
            </div>
          </div>

          <div className="navgroup" style={{ borderTop: '1px solid var(--line)' }}>
            <h5>Registry</h5>
            <div className={`navitem ${activeNav === 'hospitals' ? 'active' : ''}`} onClick={() => setActiveNav('hospitals')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                <path d="M3 21V7l9-4 9 4v14" />
                <path d="M9 21v-6h6v6" />
              </svg>
              Hospitals
            </div>
            <div className={`navitem ${activeNav === 'research' ? 'active' : ''}`} onClick={() => setActiveNav('research')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
              </svg>
              Research
            </div>
            <div className={`navitem ${activeNav === 'settings' ? 'active' : ''}`} onClick={() => setActiveNav('settings')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 0 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 0 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 0 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
              </svg>
              Settings
            </div>
          </div>

          <div className="asidefoot">
            <div style={{ marginBottom: '10px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: '9px', color: 'var(--ink-3)', letterSpacing: '.16em', textTransform: 'uppercase', padding: '0 10px', marginBottom: '6px' }}>Switch portal</div>
              <a href="/hospital-dashboard" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '10px', fontSize: '12px', color: 'var(--ink-2)', fontFamily: 'var(--mono)', letterSpacing: '.08em', textDecoration: 'none', transition: 'all .2s' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg)'; e.currentTarget.style.color = 'var(--ink)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ink-2)'; }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 21V7l9-4 9 4v14" /><path d="M9 21v-6h6v6" /></svg>
                Hospital
              </a>
              <a href="/doctor-dashboard" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '10px', fontSize: '12px', color: 'var(--ink-2)', fontFamily: 'var(--mono)', letterSpacing: '.08em', textDecoration: 'none', transition: 'all .2s' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg)'; e.currentTarget.style.color = 'var(--ink)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ink-2)'; }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2v6a6 6 0 0 0 12 0V2" /><circle cx="18" cy="16" r="3" /></svg>
                Doctor
              </a>
            </div>
            <div className="pill">
              <span className="dot" />
              <span className="label">Network</span>
              <span className="val">TestNet</span>
            </div>
          </div>
        </aside>

        <main>
          <div className="topbar">
            <div>
              <div className="crumb">Patient · {currentNavLabel}</div>
              <h1>
                Good evening, <em style={{ fontStyle: 'italic', color: 'var(--ink-green)' }}>Ishaan</em>.
              </h1>
            </div>
            <div className="search">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="7" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input placeholder="Search records, providers, consents…" />
              <span className="kbd">⌘ K</span>
            </div>
            <div className="topactions">
              <span className="chip">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5l-8-3Z" />
                </svg>
                847KOR
                <span className="tag">Verified</span>
              </span>
              <button className="iconbtn">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8" />
                  <path d="M10 21a2 2 0 0 0 4 0" />
                </svg>
                <span className="pip" />
              </button>
              <button className="iconbtn">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M20 7 9 18l-5-5" />
                </svg>
              </button>
              <div className="avatar">I</div>
            </div>
          </div>

          <div className="content">
            {activeNav === 'overview' ? (
              <>
            <div className="hero">
              <div className="greet reveal d1">
                <div>
                  <div className="k">§ Overview — 18 April 2026</div>
                  <h2>
                    Your consent mesh is <em>calm</em>.<br />5 keys held, 0 silent reads.
                  </h2>
                  <p>One provider is waiting for your signature. Everything else is behaving exactly as you've instructed.</p>
                </div>
                <div className="foot">
                  <button className="btn lime">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                    Grant consent
                  </button>
                  <button className="btn ghost">Share identity</button>
                  <button className="btn ghost">Export audit</button>
                </div>
              </div>
              <div className="id reveal d2">
                <div className="row">
                  <div>
                    <div className="mono">Short ID</div>
                    <h3>Your identity</h3>
                  </div>
                  <span className="tag">Verified</span>
                </div>
                <div className="sid" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ background: '#fff', borderRadius: '16px', padding: '12px', border: '1px solid var(--line)' }}>
                    <QRCodeSVG
                      value={`Aegis://patient/${patient.shortId}`}
                      size={148}
                      bgColor="#ffffff"
                      fgColor="#0a1514"
                      level="M"
                      includeMargin={false}
                    />
                  </div>
                </div>
                <div className="meta">
                  <span>ID · <em>{patient.shortId}</em></span>
                  <span>Since <em>Mar 2026</em></span>
                </div>
              </div>
            </div>

            <div className="kpis">
              <div className="kpi reveal d1" data-c="lime">
                <div className="top">
                  <div className="icn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5l-8-3Z" />
                    </svg>
                  </div>
                  <span className="delta">+2 this week</span>
                </div>
                <b>5</b>
                <span className="lbl">Active consents</span>
                <svg className="spark" viewBox="0 0 140 28" fill="none">
                  <path d="M0 20 L20 16 L40 18 L60 10 L80 14 L100 6 L120 9 L140 2" stroke="var(--ink-green)" strokeWidth="1.5" />
                </svg>
              </div>
              <div className="kpi reveal d2" data-c="coral">
                <div className="top">
                  <div className="icn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M6 3h9l4 4v14H5V4Z" />
                      <path d="M14 3v4h4" />
                    </svg>
                  </div>
                  <span className="delta">+1 new</span>
                </div>
                <b>12</b>
                <span className="lbl">Records on chain</span>
                <svg className="spark" viewBox="0 0 140 28" fill="none">
                  <path d="M0 22 L20 20 L40 18 L60 16 L80 14 L100 12 L120 8 L140 6" stroke="var(--ink-green)" strokeWidth="1.5" />
                </svg>
              </div>
              <div className="kpi reveal d3" data-c="sky">
                <div className="top">
                  <div className="icn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 3v18h18" />
                      <path d="M7 14l4-4 3 3 5-6" />
                    </svg>
                  </div>
                  <span className="delta">all clean</span>
                </div>
                <b>0</b>
                <span className="lbl">Silent reads</span>
                <svg className="spark" viewBox="0 0 140 28" fill="none">
                  <path d="M0 24 L140 24" stroke="var(--ink-green)" strokeWidth="1.5" />
                </svg>
              </div>
              <div className="kpi reveal d4" data-c="violet">
                <div className="top">
                  <div className="icn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="9" />
                      <path d="M12 7v5l3 3" />
                    </svg>
                  </div>
                  <span className="delta">median</span>
                </div>
                <b>3.3<em>s</em></b>
                <span className="lbl">Settle time</span>
                <svg className="spark" viewBox="0 0 140 28" fill="none">
                  <path d="M0 10 L20 14 L40 8 L60 12 L80 6 L100 10 L120 4 L140 8" stroke="var(--ink-green)" strokeWidth="1.5" />
                </svg>
              </div>
            </div>

            <div className="grid">
              <div className="card reveal d1">
                <div className="head">
                  <div>
                    <h3>Active consents</h3>
                    <div className="sub" style={{ marginTop: '4px' }}>5 permissions · 2 expire this week</div>
                  </div>
                  <div className="actions">
                    <div className="tabs">
                      <button className={activeTab === 'all' ? 'on' : ''} onClick={() => setActiveTab('all')}>All</button>
                      <button className={activeTab === 'active' ? 'on' : ''} onClick={() => setActiveTab('active')}>Active</button>
                      <button className={activeTab === 'pending' ? 'on' : ''} onClick={() => setActiveTab('pending')}>Pending</button>
                      <button className={activeTab === 'expired' ? 'on' : ''} onClick={() => setActiveTab('expired')}>Expired</button>
                    </div>
                  </div>
                </div>
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Requester</th>
                      <th>Scope</th>
                      <th>Status</th>
                      <th>Remaining</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        <div className="avn">
                          <div className="av" data-c="lime">HX</div>
                          <div>
                            <div className="nm">Helix Hospital</div>
                            <div className="rl">Institutional</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--ink-2)', letterSpacing: '.06em' }}>
                        LAB_RESULTS · 48H
                      </td>
                      <td>
                        <span className="pill-s active">Active</span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <span style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--ink)' }}>32h 14m</span>
                          <div className="meter">
                            <i style={{ width: '68%' }} />
                          </div>
                        </div>
                      </td>
                      <td className="actions-cell">
                        <button className="ibtn" title="Extend">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M5 12h14M13 5l7 7-7 7" />
                          </svg>
                        </button>
                        <button className="ibtn danger" title="Revoke">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 6 6 18M6 6l12 12" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <div className="avn">
                          <div className="av" data-c="coral">DR</div>
                          <div>
                            <div className="nm">Dr. Hanwa, K.</div>
                            <div className="rl">Clinician</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--ink-2)', letterSpacing: '.06em' }}>
                        IMAGING · 2H
                      </td>
                      <td>
                        <span className="pill-s active">Active</span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <span style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--ink)' }}>1h 04m</span>
                          <div className="meter">
                            <i style={{ width: '52%' }} />
                          </div>
                        </div>
                      </td>
                      <td className="actions-cell">
                        <button className="ibtn">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M5 12h14M13 5l7 7-7 7" />
                          </svg>
                        </button>
                        <button className="ibtn danger">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 6 6 18M6 6l12 12" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <div className="avn">
                          <div className="av" data-c="sky">LB</div>
                          <div>
                            <div className="nm">Meridian Labs</div>
                            <div className="rl">Diagnostics</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--ink-2)', letterSpacing: '.06em' }}>
                        PROFILE · 72H
                      </td>
                      <td>
                        <span className="pill-s pending">Pending</span>
                      </td>
                      <td style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--ink-3)' }}>
                        awaiting signature
                      </td>
                      <td className="actions-cell">
                        <button className="ibtn">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="m5 12 5 5L20 7" />
                          </svg>
                        </button>
                        <button className="ibtn danger">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 6 6 18M6 6l12 12" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <div className="avn">
                          <div className="av" data-c="sun">PH</div>
                          <div>
                            <div className="nm">Nil Pharmacy</div>
                            <div className="rl">Dispensary</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--ink-2)', letterSpacing: '.06em' }}>
                        RX_VIEW · 24H
                      </td>
                      <td>
                        <span className="pill-s active">Active</span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <span style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--ink)' }}>18h 40m</span>
                          <div className="meter">
                            <i style={{ width: '78%' }} />
                          </div>
                        </div>
                      </td>
                      <td className="actions-cell">
                        <button className="ibtn">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M5 12h14M13 5l7 7-7 7" />
                          </svg>
                        </button>
                        <button className="ibtn danger">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 6 6 18M6 6l12 12" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <div className="avn">
                          <div className="av" data-c="violet">AR</div>
                          <div>
                            <div className="nm">Arc Insurance</div>
                            <div className="rl">Payor</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--ink-2)', letterSpacing: '.06em' }}>
                        CLAIM · 7D
                      </td>
                      <td>
                        <span className="pill-s expired">Expired</span>
                      </td>
                      <td style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--ink-3)' }}>
                        key dissolved
                      </td>
                      <td className="actions-cell">
                        <button className="ibtn">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="card reveal d2">
                <div className="head">
                  <div>
                    <h3>Inbound requests</h3>
                    <div className="sub" style={{ marginTop: '4px' }}>1 new · review and sign</div>
                  </div>
                </div>
                <div className="requests">
                  <div className="req">
                    <div className="av" data-c="sky">LB</div>
                    <div className="body">
                      <div className="t">
                        Meridian Labs · <em style={{ fontStyle: 'normal', color: 'var(--ink-green)', fontWeight: 500 }}>Profile read</em>
                      </div>
                      <div className="d">72H · Annual physical cross-ref</div>
                    </div>
                    <div className="acts">
                      <button className="approve">Approve</button>
                      <button className="deny">Deny</button>
                    </div>
                  </div>
                  <div className="req">
                    <div className="av" data-c="coral">DR</div>
                    <div className="body">
                      <div className="t">
                        Dr. Avani S. · <em style={{ fontStyle: 'normal', color: 'var(--ink-green)', fontWeight: 500 }}>Imaging review</em>
                      </div>
                      <div className="d">1H · Second-opinion consult</div>
                    </div>
                    <div className="acts">
                      <button className="approve">Approve</button>
                      <button className="deny">Deny</button>
                    </div>
                  </div>
                  <div className="req">
                    <div className="av" data-c="lime">HX</div>
                    <div className="body">
                      <div className="t">
                        Helix Hospital · <em style={{ fontStyle: 'normal', color: 'var(--ink-green)', fontWeight: 500 }}>Discharge summary</em>
                      </div>
                      <div className="d">6H · Transfer to home-care</div>
                    </div>
                    <div className="acts">
                      <button className="approve">Approve</button>
                      <button className="deny">Deny</button>
                    </div>
                  </div>
                </div>

                <div className="head" style={{ paddingTop: '6px', borderTop: '1px solid var(--line)' }}>
                  <div>
                    <h3>Audit trail</h3>
                    <div className="sub" style={{ marginTop: '4px' }}>last 6 events</div>
                  </div>
                  <button className="chip" style={{ fontSize: '10px' }}>View all</button>
                </div>
                <div className="audit">
                  <div className="audit-item">
                    <span className="pin" data-c="lime" />
                    <div className="body">
                      <div className="t"><em>Consent granted</em> · Helix Hospital</div>
                      <div className="d">Lab results · 48h</div>
                    </div>
                    <time>2m ago</time>
                  </div>
                  <div className="audit-item">
                    <span className="pin" data-c="sky" />
                    <div className="body">
                      <div className="t"><em>Record added</em> · Blood panel 2026-04</div>
                      <div className="d">CID: bafy…k2qj</div>
                    </div>
                    <time>1h ago</time>
                  </div>
                  <div className="audit-item">
                    <span className="pin" data-c="coral" />
                    <div className="body">
                      <div className="t"><em>Access request</em> · Dr. Hanwa</div>
                      <div className="d">Imaging · 2h</div>
                    </div>
                    <time>3h ago</time>
                  </div>
                  <div className="audit-item">
                    <span className="pin" data-c="violet" />
                    <div className="body">
                      <div className="t"><em>Consent expired</em> · Arc Insurance</div>
                      <div className="d">Claim · key dissolved</div>
                    </div>
                    <time>Yesterday</time>
                  </div>
                  <div className="audit-item">
                    <span className="pin" data-c="lime" />
                    <div className="body">
                      <div className="t"><em>Consent granted</em> · Nil Pharmacy</div>
                      <div className="d">RX view · 24h</div>
                    </div>
                    <time>2d ago</time>
                  </div>
                  <div className="audit-item">
                    <span className="pin" data-c="sky" />
                    <div className="body">
                      <div className="t"><em>Identity verified</em> · 847KOR</div>
                      <div className="d">Algorand mainnet</div>
                    </div>
                    <time>Mar 21</time>
                  </div>
                </div>
              </div>
            </div>

            <div className="card reveal d3">
              <div className="head">
                <div>
                  <h3>Recent records</h3>
                  <div className="sub" style={{ marginTop: '4px' }}>{medicalRecords.length} records · encrypted · IPFS-pinned</div>
                </div>
                <div className="actions">
                  <button className="chip">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                    Upload
                  </button>
                  <button className="chip">Filter</button>
                </div>
              </div>
              <div className="recs">
                {medicalRecords.map((rec, i) => (
                  <div
                    key={rec.id}
                    className="rec"
                    data-c={rec.color}
                    style={{ position: 'relative', cursor: 'pointer' }}
                    onClick={() => openSlider(i)}
                  >
                    <div className="top">
                      <div className="icn">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <path d="M6 3h9l4 4v14H5V4Z" /><path d="M14 3v4h4" />
                        </svg>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <span className="chip-s">{recordTypeLabel[rec.type]}</span>
                        <button
                          title="Share via QR"
                          onClick={(e) => { e.stopPropagation(); openQR(rec); }}
                          style={{ width: '24px', height: '24px', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--bg)', display: 'grid', placeItems: 'center', cursor: 'pointer', color: 'var(--ink-3)' }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>
                            <path d="M14 14h.01M14 17h3M17 14v3M17 17h3v3h-3v-3"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                    <h4>{rec.title}</h4>
                    <p>{rec.hospital} · {rec.date}</p>
                    <div className="cid">ipfs://Qm…{rec.ipfsHash.slice(-8)}</div>
                  </div>
                ))}
              </div>
            </div>
              </>
            ) : renderPatientTabContent()}
          </div>
        </main>
      </div>

      {sliderOpen && (
        <RecordSlider
          records={medicalRecords}
          initialIndex={sliderIndex}
          onClose={() => setSliderOpen(false)}
          onShare={(rec) => { setSliderOpen(false); openQR(rec); }}
        />
      )}
      <QRModal
        record={qrRecord}
        patient={patient}
        onClose={() => setQrRecord(null)}
      />
    </div>
  );
}
