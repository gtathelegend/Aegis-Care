import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import '../styles/dashboard.css';
import QRModal from '../components/QRModal';
import RecordSlider from '../components/RecordSlider';
import { medicalRecords, consents, auditLog, inboundRequests, getPatientById, patients, recordTypeLabel } from '../lib/mockdb';
import type { MedicalRecord } from '../lib/mockdb';
import { useWallet } from '@txnlab/use-wallet-react';
import { useRole } from '../hooks/useRole';
import { fetchPatientRecords } from '../lib/medicalPortalData';
import { useMedicalRecords } from '../hooks/useMedicalRecords';
import {
  subscribeToSharedAccessRequests,
  type SharedAccessRequest,
} from '../lib/realtimeAccessRequests';
import { useAccessRequests } from '../hooks/useAccessRequests';

const DEFAULT_PATIENT = getPatientById('p1');

export default function PatientPortal() {
  const { activeAddress, wallets } = useWallet();
  const navigate = useNavigate();
  const { shortId, isProxyActive, proxyAddress, proxyShortId, disableProxy } = useRole();
  const { approveRequest, rejectRequest } = useAccessRequests();
  const [activeNav, setActiveNav] = useState('overview');
  const [activeTab, setActiveTab] = useState('all');
  const [qrRecord, setQrRecord] = useState<MedicalRecord | null>(null);
  const [sliderOpen, setSliderOpen] = useState(false);
  const [sliderIndex, setSliderIndex] = useState(0);
  const [liveRecords, setLiveRecords] = useState<MedicalRecord[]>(medicalRecords.filter((record) => record.patientId === DEFAULT_PATIENT.id));
  const [sharedRequests, setSharedRequests] = useState<SharedAccessRequest[]>([]);
  const [showLogoutMenu, setShowLogoutMenu] = useState(false);
  const [settleTime, setSettleTime] = useState<number | null>(null);
  const fetchStartRef = useRef<number>(0);

  const effectiveAddress = isProxyActive && proxyAddress ? proxyAddress : activeAddress;

  const patient = useMemo(() => {
    if (!effectiveAddress) {
      return DEFAULT_PATIENT;
    }

    const directMatch = patients.find((entry) => entry.walletAddress === effectiveAddress);
    if (directMatch) {
      return directMatch;
    }

    const hashSeed = Array.from(effectiveAddress).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    const mappedPatient = patients[hashSeed % patients.length] ?? DEFAULT_PATIENT;
    const syntheticShortId = (proxyShortId || shortId || `${(hashSeed % 900) + 100}${effectiveAddress.slice(-3).toUpperCase()}`).slice(0, 6);

    return {
      ...mappedPatient,
      name: isProxyActive ? `${mappedPatient.name} (Proxy)` : mappedPatient.name,
      shortId: syntheticShortId,
      walletAddress: effectiveAddress,
      avatar: syntheticShortId.slice(0, 1) || mappedPatient.avatar,
    };
  }, [effectiveAddress, isProxyActive, proxyShortId, shortId]);

  // Use hook to fetch patient's medical records from blockchain
  const { allRecords: blockchainRecords, loading: recordsLoading, error: recordsError, refetch: refetchRecords } = useMedicalRecords(effectiveAddress, patient);

  // Track blockchain fetch timing for settle time metric
  useEffect(() => {
    if (recordsLoading) {
      fetchStartRef.current = Date.now();
    } else if (fetchStartRef.current > 0) {
      const elapsed = (Date.now() - fetchStartRef.current) / 1000;
      setSettleTime(Math.round(elapsed * 10) / 10);
      fetchStartRef.current = 0;
    }
  }, [recordsLoading]);

  // Prioritize blockchain data; only use mock if loading or blockchain has data
  useEffect(() => {
    let cancelled = false;

    if (recordsLoading) {
      // Still loading from blockchain
      return;
    }

    // If blockchain returned records (even if empty array), use them
    if (blockchainRecords && blockchainRecords.length > 0) {
      if (!cancelled) {
        setLiveRecords(blockchainRecords);
      }
      return;
    }

    // If blockchain is empty but we have an address, don't fall back yet
    // Just show empty state with option to refresh
    if (effectiveAddress) {
      if (!cancelled) {
        setLiveRecords([]); // Show empty state, not mock data
      }
      return;
    }

    // No wallet connected - show mock data as default
    if (!cancelled) {
      setLiveRecords(medicalRecords.filter((record) => record.patientId === DEFAULT_PATIENT.id));
    }
  }, [effectiveAddress, blockchainRecords, recordsLoading]);

  const patientRecords = useMemo(() => {
    return liveRecords.length > 0 ? liveRecords : medicalRecords.filter((record) => record.patientId === patient.id);
  }, [liveRecords, patient.id]);

  const patientConsents = useMemo(() => {
    return consents.filter((consent) => consent.patientId === patient.id);
  }, [patient.id]);

  const patientInboundRequests = useMemo(() => {
    return sharedRequests.filter((request) => request.patientId === patient.id);
  }, [patient.id, sharedRequests]);

  const pendingInboundCount = useMemo(
    () => patientInboundRequests.filter((request) => request.status === 'pending').length,
    [patientInboundRequests]
  );

  // Active consents = approved access requests (real cross-tab data) + mock active consents
  const approvedRequestCount = useMemo(
    () => patientInboundRequests.filter((r) => r.status === 'approved').length,
    [patientInboundRequests]
  );
  const activeConsentCount = patientConsents.filter((c) => c.status === 'active').length + approvedRequestCount;
  const pendingConsentCount = patientConsents.filter((consent) => consent.status === 'pending').length;
  const expiringConsentCount = patientConsents.filter(
    (consent) => consent.status === 'active' && consent.remaining !== 'key dissolved'
  ).length;
  const filteredConsents = useMemo(() => {
    if (activeTab === 'all') {
      return patientConsents;
    }
    return patientConsents.filter((consent) => consent.status === activeTab);
  }, [activeTab, patientConsents]);

  // Records delta: how many records added in last 7 days
  const recentRecordCount = useMemo(() => {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return patientRecords.filter((r) => {
      const ts = typeof r.blockHeight === 'number' ? r.blockHeight * 1000 : 0;
      return ts > cutoff;
    }).length;
  }, [patientRecords]);

  // Silent reads = access requests approved by patient that were later accessed
  const silentReadCount = useMemo(
    () => patientInboundRequests.filter((r) => r.status === 'approved' && r.urgency !== 'emergency').length,
    [patientInboundRequests]
  );

  useEffect(() => {
    const unsubscribe = subscribeToSharedAccessRequests(setSharedRequests);
    return unsubscribe;
  }, []);

  const openSlider = useCallback((index: number) => {
    setSliderIndex(index);
    setSliderOpen(true);
  }, []);

  const openQR = useCallback((record: MedicalRecord) => {
    setQrRecord(record);
  }, []);

  const handleLogout = useCallback(async () => {
    setShowLogoutMenu(false);

    try {
      // Disconnect all wallets
      if (wallets && wallets.length > 0) {
        wallets.forEach(w => w.disconnect());
      }

      // Disable proxy if active
      if (isProxyActive) {
        disableProxy();
      }

      // Clear any local storage related to wallet/session
      if (typeof window !== 'undefined') {
        // Clear wallet-related session data
        sessionStorage.removeItem('Aegis_proxy_addr');
        sessionStorage.removeItem('Aegis_proxy_id');
        localStorage.removeItem('Aegis-doctor-consent-statuses');
        localStorage.removeItem('Aegis-doctor-request-queue');
      }

      // Navigate with a slight delay and force page reload
      setTimeout(() => {
        window.location.replace('/');
      }, 200);
    } catch (err) {
      console.error('[PatientPortal] Logout error:', err);
      // Force redirect even if disconnect fails
      window.location.replace('/');
    }
  }, [wallets, isProxyActive, disableProxy]);

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

  const renderPatientTabContent = () => {
    if (activeNav === 'records') {
      return (
        <div className="card reveal in">
          <div className="head">
            <div>
              <h3>Recent records</h3>
              <div className="sub" style={{ marginTop: '4px' }}>{medicalRecords.length} records · encrypted · IPFS-pinned</div>
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
      );
    }

    if (activeNav === 'consents') {
      return (
        <div className="card reveal in">
          <div className="head">
            <div>
              <h3>Consent list</h3>
              <div className="sub" style={{ marginTop: '4px' }}>{consents.length} permissions in your account</div>
            </div>
          </div>
          <table className="tbl">
            <thead>
              <tr>
                <th>Requester</th>
                <th>Scope</th>
                <th>Status</th>
                <th>Remaining</th>
              </tr>
            </thead>
            <tbody>
              {consents.map((consent) => (
                <tr key={consent.id}>
                  <td>
                    <div className="avn">
                      <div className="av" data-c={consent.grantedToColor}>{consent.grantedToAvatar}</div>
                      <div>
                        <div className="nm">{consent.grantedTo}</div>
                        <div className="rl">{consent.grantedToRole}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--ink-2)', letterSpacing: '.06em' }}>{consent.scopeLabel}</td>
                  <td><span className={`pill-s ${consent.status}`}>{consent.status}</span></td>
                  <td style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--ink-3)' }}>{consent.remaining}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (activeNav === 'audit') {
      return (
        <div className="card reveal in">
          <div className="head">
            <div>
              <h3>Audit trail</h3>
              <div className="sub" style={{ marginTop: '4px' }}>{auditLog.length} immutable events</div>
            </div>
          </div>
          <div className="audit">
            {auditLog.map((entry) => (
              <div className="audit-item" key={entry.id}>
                <span className="pin" data-c={entry.color} />
                <div className="body">
                  <div className="t"><em>{entry.actor}</em> · {entry.subject}</div>
                  <div className="d">{entry.detail}</div>
                </div>
                <time>{entry.timestamp}</time>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (activeNav === 'vault') {
      return (
        <div className="card reveal in">
          <div className="head">
            <div>
              <h3>Identity vault</h3>
              <div className="sub" style={{ marginTop: '4px' }}>Beneficiary and recovery controls</div>
            </div>
          </div>
          <div className="requests">
            {inboundRequests.map((request) => (
              <div className="req" key={request.id}>
                <div className="av" data-c={request.fromColor}>{request.fromAvatar}</div>
                <div className="body">
                  <div className="t">{request.from}</div>
                  <div className="d">{request.scope} · {request.urgency}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="card reveal in">
        <div className="head">
          <div>
            <h3>{currentNavLabel}</h3>
            <div className="sub" style={{ marginTop: '4px' }}>Section loaded and interactive</div>
          </div>
        </div>
        <div className="requests">
          <div className="req" style={{ cursor: 'default' }}>
            <div className="body">
              <div className="t">This panel is active</div>
              <div className="d">Use left navigation to switch sections instantly.</div>
            </div>
          </div>
        </div>
      </div>
    );
  };

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
              Records<span className="badge">{patientRecords.length}</span>
            </div>
            <div className={`navitem ${activeNav === 'consents' ? 'active' : ''}`} onClick={() => setActiveNav('consents')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                <path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5l-8-3Z" />
              </svg>
              Consents<span className="badge">{activeConsentCount + pendingConsentCount}</span>
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
              <a href="/hospital" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '10px', fontSize: '12px', color: 'var(--ink-2)', fontFamily: 'var(--mono)', letterSpacing: '.08em', textDecoration: 'none', transition: 'all .2s' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg)'; e.currentTarget.style.color = 'var(--ink)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ink-2)'; }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 21V7l9-4 9 4v14" /><path d="M9 21v-6h6v6" /></svg>
                Hospital
              </a>
              <a href="/doctor" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '10px', fontSize: '12px', color: 'var(--ink-2)', fontFamily: 'var(--mono)', letterSpacing: '.08em', textDecoration: 'none', transition: 'all .2s' }}
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
              <div className="crumb">
                Patient · {currentNavLabel}
                {recordsLoading && (
                  <span style={{ marginLeft: '12px', fontSize: '11px', color: 'var(--ink-3)' }}>
                    ⟳ Loading blockchain data...
                  </span>
                )}
                {effectiveAddress && !recordsLoading && blockchainRecords.length > 0 && (
                  <span style={{ marginLeft: '12px', fontSize: '11px', color: 'var(--ink-green)' }}>
                    ✓ Blockchain data
                  </span>
                )}
                {recordsError && !recordsLoading && (
                  <span style={{ marginLeft: '12px', fontSize: '11px', color: 'var(--ink-coral)' }}>
                    ⚠ {recordsError}
                  </span>
                )}
              </div>
              <h1>
                Good evening, <em style={{ fontStyle: 'italic', color: 'var(--ink-green)' }}>{patient.name.split(' ')[0]}</em>.
              </h1>
              {effectiveAddress && blockchainRecords.length === 0 && !recordsLoading && (
                <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: 'var(--ink-2)' }}>
                  No medical records found for wallet {effectiveAddress.slice(0, 6)}...{effectiveAddress.slice(-4)}
                  {recordsLoading === false && <> · <button onClick={refetchRecords} style={{ background: 'none', border: 'none', color: 'var(--ink-green)', cursor: 'pointer', textDecoration: 'underline' }}>Refresh</button></>}
                </p>
              )}
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
                {patient.shortId}
                <span className="tag">Verified</span>
              </span>
              <div style={{ position: 'relative' }}>
                <button
                  className="avatar"
                  onClick={() => setShowLogoutMenu(!showLogoutMenu)}
                  style={{ cursor: 'pointer', fontWeight: 600 }}
                  title="Click to logout"
                >
                  {patient.name.split(' ')[0].charAt(0)}
                </button>
                {showLogoutMenu && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      right: 0,
                      marginTop: '8px',
                      background: 'var(--bg-2)',
                      border: '1px solid var(--line)',
                      borderRadius: '8px',
                      minWidth: '160px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      zIndex: 1000,
                    }}
                  >
                    <div style={{ padding: '8px 0' }}>
                      <div style={{ padding: '10px 14px', fontSize: '12px', color: 'var(--ink-2)' }}>
                        {effectiveAddress?.slice(0, 10)}...
                      </div>
                      <hr style={{ margin: '6px 0', borderColor: 'var(--line)' }} />
                      <button
                        onClick={handleLogout}
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          border: 'none',
                          background: 'transparent',
                          cursor: 'pointer',
                          fontSize: '13px',
                          color: 'var(--ink)',
                          textAlign: 'left',
                          transition: 'background 0.2s',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'var(--bg)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        🚪 Logout
                      </button>
                    </div>
                  </div>
                )}
              </div>
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
                    Your consent mesh is <em>calm</em>.<br />{activeConsentCount} keys held, 0 silent reads.
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
              <div className="id reveal d2" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'center', textAlign: 'center' }}>
                <div className="row" style={{ alignSelf: 'stretch', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                  <div>
                    <div className="mono">Short ID</div>
                    <h3 style={{ marginTop: '4px' }}>Your identity</h3>
                  </div>
                  <span className="tag">Verified</span>
                </div>
                <div className="sid">
                  {patient.shortId.slice(0, -3)}<em>{patient.shortId.slice(-3)}</em>
                </div>
                <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'center' }}>
                  <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid var(--line)', overflow: 'hidden' }}>
                    <QRCodeSVG
                      value={`Aegis://patient/${patient.shortId}`}
                      size={140}
                      bgColor="#ffffff"
                      fgColor="#0a1514"
                      level="M"
                      includeMargin={false}
                    />
                  </div>
                </div>
                <div className="meta">
                  <span>Chain · <em>Algorand</em></span>
                  <span>Since <em>{patient.since}</em></span>
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
                  <span className="delta">{approvedRequestCount > 0 ? `+${approvedRequestCount} approved` : 'no new'}</span>
                </div>
                <b>{activeConsentCount}</b>
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
                  <span className="delta">{recordsLoading ? 'syncing…' : recentRecordCount > 0 ? `+${recentRecordCount} this week` : 'up to date'}</span>
                </div>
                <b>{recordsLoading ? '…' : patientRecords.length}</b>
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
                  <span className="delta">{silentReadCount === 0 ? 'all clean' : `${silentReadCount} access`}</span>
                </div>
                <b>{silentReadCount}</b>
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
                  <span className="delta">{settleTime !== null ? 'last fetch' : 'median'}</span>
                </div>
                <b>{settleTime !== null ? <>{settleTime}<em>s</em></> : recordsLoading ? '…' : '—'}</b>
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
                    <div className="sub" style={{ marginTop: '4px' }}>
                      {patientConsents.length} permissions · {expiringConsentCount} expire this week
                    </div>
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
                    {filteredConsents.length > 0 ? filteredConsents.map((consent) => (
                      <tr key={consent.id}>
                        <td>
                          <div className="avn">
                            <div className="av" data-c={consent.grantedToColor}>{consent.grantedToAvatar}</div>
                            <div>
                              <div className="nm">{consent.grantedTo}</div>
                              <div className="rl">{consent.grantedToRole}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--ink-2)', letterSpacing: '.06em' }}>
                          {consent.scopeLabel}
                        </td>
                        <td>
                          <span className={`pill-s ${consent.status}`}>{consent.status}</span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <span style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--ink)' }}>{consent.remaining}</span>
                            {consent.status === 'active' && (
                              <div className="meter">
                                <i style={{ width: `${consent.progressPct}%` }} />
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="actions-cell">
                          <button className="ibtn" title="View">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', padding: '20px', color: 'var(--ink-3)' }}>
                          No consents found for this filter
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="card reveal d2">
                <div className="head">
                  <div>
                    <h3>Inbound requests</h3>
                    <div className="sub" style={{ marginTop: '4px' }}>{pendingInboundCount} new · review and sign</div>
                  </div>
                </div>
                <div className="requests">
                  {patientInboundRequests.length > 0 ? patientInboundRequests.map((request) => (
                    <div className="req" key={request.id}>
                      <div className="av" data-c={request.requestedByColor}>{request.requestedByAvatar}</div>
                      <div className="body">
                        <div className="t">
                          {request.requestedBy} · <em style={{ fontStyle: 'normal', color: 'var(--ink-green)', fontWeight: 500 }}>{request.scope}</em>
                        </div>
                        <div className="d">{request.urgency.toUpperCase()} · {request.reason}</div>
                      </div>
                      <div className="acts">
                        {request.status === 'pending' ? (
                          <>
                            <button className="approve" onClick={() => approveRequest(request.id, patient.walletAddress, request.blockchainRequestId)}>Approve</button>
                            <button className="deny" onClick={() => rejectRequest(request.id, patient.walletAddress, request.blockchainRequestId)}>Deny</button>
                          </>
                        ) : (
                          <button className={request.status === 'approved' ? 'approve' : 'deny'}>{request.status}</button>
                        )}
                      </div>
                    </div>
                  )) : (
                    <div className="req" style={{ cursor: 'default' }}>
                      <div className="av" data-c="sky">--</div>
                      <div className="body">
                        <div className="t">No inbound requests</div>
                        <div className="d">New document access requests will appear here in real time.</div>
                      </div>
                    </div>
                  )}
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
                      <div className="t"><em>Identity verified</em> · {patient.shortId}</div>
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
                  <div className="sub" style={{ marginTop: '4px' }}>{patientRecords.length} records · encrypted · IPFS-pinned</div>
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
                {patientRecords.map((rec, i) => (
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
          records={patientRecords}
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
