import { useState, useEffect } from 'react'
import { useWallet } from '@txnlab/use-wallet-react'
import { useNavigate } from 'react-router-dom'
import ConnectWallet from '../components/ConnectWallet'
import RoleSelectionModal from '../components/RoleSelectionModal'
import LandingEffects from '../components/LandingEffects'
import { useRole } from '../hooks/useRole'
import '../styles/landing.css'

export default function Landing() {
  const { activeAddress } = useWallet()
  const { shortId, loading, roles } = useRole()
  const navigate = useNavigate()
  const [walletModalOpen, setWalletModalOpen] = useState(false)
  const [roleModalOpen, setRoleModalOpen] = useState(false)
  const [prevAddress, setPrevAddress] = useState<string | null>(null)

  useEffect(() => {
    if (activeAddress && !prevAddress) {
      setPrevAddress(activeAddress)
      setWalletModalOpen(false)
      setRoleModalOpen(true)
    } else if (!activeAddress && prevAddress) {
      setPrevAddress(null)
      setRoleModalOpen(false)
    }
  }, [activeAddress, prevAddress])

  const openWallet = (e?: React.MouseEvent) => {
    e?.preventDefault()
    setWalletModalOpen(true)
  }

  const goto = (path: string) => (e: React.MouseEvent) => {
    e.preventDefault()
    navigate(path)
  }

  return (
    <>
      <LandingEffects />
      <div className="landing-page">
        <div className="grid-bg"></div>
        <div className="blobs">
          <i className="b1"></i>
          <i className="b2"></i>
          <i className="b3"></i>
          <i className="b4"></i>
        </div>
        <div className="cursor" id="cursor"></div>
        <div className="rail"><i id="rail"></i></div>

        {/* NAV */}
        <nav className="top" id="nav">
          <div className="navshell">
            <div className="brand">
              <div className="mark">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5l-8-3Z"/>
                  <path d="m9 12 2 2 4-4"/>
                </svg>
              </div>
              <b>Aegis-Care <span>/ v2.4</span></b>
            </div>
            <div className="navlinks">
              <a href="#network">Network</a>
              <a href="#protocol">Protocol</a>
              <a href="#flow">Flow</a>
              <a href="#console">Console</a>
              <a href="#roles">Portals</a>
            </div>
            <div className="navactions">
              <a href="#connect" onClick={openWallet} className="cta lime" data-magnetic>
                <span className="dot"></span>{activeAddress ? 'Wallet connected' : 'Connect wallet'}
              </a>
            </div>
          </div>
        </nav>

        {/* HERO */}
        <section className="hero">
          <div className="wrap" style={{ position: 'relative', zIndex: 2 }}>
            <div className="eyebrow reveal d1" style={{ marginBottom: '28px' }}>
              <span className="pulse"></span>
              <span className="mono">Sovereign Medical Data · DPDP · HIPAA · GDPR</span>
            </div>
            
            <div className="hero-content">
              <h1 className="hero-headline">
                <span className="line">Your body.</span>
                <span className="line">Your records.</span>
                <span className="line highlight">Your keys.</span>
              </h1>

              <p className="lede reveal d3" style={{ maxWidth: '600px', marginTop: '28px' }}>
                Aegis-Care is a consent protocol for healthcare. Patients hold the
                keys to their records. Hospitals, labs and insurers request time-
                scoped access — every touch is logged to an immutable chain.
              </p>
              
              <div className="ctas reveal d4" style={{ marginTop: '28px', gap: '12px' }}>
                <a href="#connect" onClick={openWallet} className="cta lime" data-magnetic>
                  {activeAddress ? 'Switch wallet' : 'Connect wallet'}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14M13 5l7 7-7 7"/>
                  </svg>
                </a>
                <a href="/beneficiary-login" onClick={goto('/beneficiary-login')} className="cta">Beneficiary login</a>
              </div>
            </div>

            {activeAddress && !loading && (
              <div className="hero-meta reveal d5" style={{ marginTop: '16px' }}>
                <div className="item">
                  <span>User ID</span>
                  <b>{shortId || 'Unregistered'}</b>
                </div>
                <div className="item">
                  <span>Wallet</span>
                  <b>{activeAddress.slice(0, 6)}...{activeAddress.slice(-6)}</b>
                </div>
                <div className="item">
                  <span>Status</span>
                  <b style={{ color: 'var(--ink-green)' }}>{shortId ? 'ID Linked' : 'Create ID in dashboard'}</b>
                </div>
                <div className="item">
                  <span>Upload routing</span>
                  <b>Hospital/Doctor use wallet address</b>
                </div>
              </div>
            )}

            <div className="hero-meta reveal d5">
              <div className="item"><span>01 / Chain</span><b>Algorand</b></div>
              <div className="item"><span>02 / Storage</span><b>IPFS · <em>encrypted</em></b></div>
              <div className="item"><span>03 / Latency</span><b>~3.3s</b></div>
              <div className="item"><span>04 / Status</span><b style={{ color: 'var(--ink-green)' }}>● Operational</b></div>
            </div>
          </div>

          <div className="scrolldown">
            <div className="bar"></div>
            <span className="mono" style={{ fontSize: '9px' }}>SCROLL</span>
          </div>
        </section>

        {/* MARQUEE */}
        <div className="marquee">
          <div className="marquee-track" id="mtrack"></div>
        </div>

        {/* NETWORK */}
        <section className="section" id="network">
          <div className="wrap">
            <div className="section-head">
              <div>
                <div className="mono reveal" style={{ marginBottom: '24px' }}>§ 01 — Network</div>
                <h2 className="reveal d1">A <em>permissioned mesh</em><br/>between care-givers<br/>and the cared-for.</h2>
              </div>
              <div className="meta reveal d2">
                <div className="mono" style={{ marginBottom: '10px' }}>ROLE-BASED ACCESS</div>
                <p>Seven verified entity classes, one patient-held key. Requests traverse the chain; data never leaves encryption.</p>
              </div>
            </div>

            <div className="constellation reveal d1" id="constellation">
              <svg className="links" viewBox="0 0 1000 600" preserveAspectRatio="none" id="links">
                <defs>
                  <linearGradient id="lg" x1="0" x2="1">
                    <stop offset="0" stopColor="#0a1514" stopOpacity="0"/>
                    <stop offset=".5" stopColor="#0a1514" stopOpacity=".7"/>
                    <stop offset="1" stopColor="#0a1514" stopOpacity="0"/>
                  </linearGradient>
                </defs>
              </svg>

              <div className="center">
                <div className="shield">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5l-8-3Z"/>
                    <path d="m9 12 2 2 4-4"/>
                  </svg>
                </div>
              </div>

              <div className="node" data-n="0" data-c="lime" style={{ left: '14%', top: '22%' }}>
                <div className="box">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <path d="M3 21V7l9-4 9 4v14"/>
                    <path d="M9 21v-6h6v6"/>
                    <path d="M12 7v4"/>
                    <path d="M10 9h4"/>
                  </svg>
                </div>
                <div className="label">Hospital</div>
              </div>
              <div className="node" data-n="1" data-c="coral" style={{ left: '50%', top: '12%' }}>
                <div className="box">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <path d="M6 2v6a6 6 0 0 0 12 0V2"/>
                    <circle cx="18" cy="16" r="3"/>
                    <path d="M12 8v6"/>
                  </svg>
                </div>
                <div className="label">Doctor</div>
              </div>
              <div className="node" data-n="2" data-c="sky" style={{ left: '86%', top: '22%' }}>
                <div className="box">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <path d="M10 2v6L4 18a2 2 0 0 0 2 3h12a2 2 0 0 0 2-3L14 8V2"/>
                    <path d="M9 2h6"/>
                  </svg>
                </div>
                <div className="label">Lab</div>
              </div>
              <div className="node" data-n="3" data-c="sun" style={{ left: '12%', top: '78%' }}>
                <div className="box">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <rect x="3" y="3" width="18" height="18" rx="3"/>
                    <path d="M8 12h8"/>
                    <path d="M12 8v8"/>
                  </svg>
                </div>
                <div className="label">Pharmacy</div>
              </div>
              <div className="node" data-n="4" data-c="violet" style={{ left: '50%', top: '88%' }}>
                <div className="box">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <circle cx="12" cy="8" r="4"/>
                    <path d="M4 21a8 8 0 0 1 16 0"/>
                  </svg>
                </div>
                <div className="label">Patient</div>
              </div>
              <div className="node" data-n="5" data-c="coral" style={{ left: '88%', top: '78%' }}>
                <div className="box">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5l-8-3Z"/>
                  </svg>
                </div>
                <div className="label">Insurer</div>
              </div>
              <div className="node" data-n="6" data-c="lime" style={{ left: '28%', top: '50%' }}>
                <div className="box">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <path d="M3 7h18M3 12h18M3 17h18"/>
                    <circle cx="7" cy="7" r="1.2" fill="currentColor"/>
                    <circle cx="12" cy="12" r="1.2" fill="currentColor"/>
                  </svg>
                </div>
                <div className="label">Auditor</div>
              </div>
              <div className="node" data-n="7" data-c="sky" style={{ left: '72%', top: '50%' }}>
                <div className="box">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <rect x="4" y="8" width="16" height="12" rx="2"/>
                    <path d="M8 8V6a4 4 0 0 1 8 0v2"/>
                  </svg>
                </div>
                <div className="label">Vault</div>
              </div>
            </div>
          </div>
        </section>

        {/* PILLARS */}
        <section className="section tinted" id="protocol">
          <div className="wrap">
            <div className="section-head">
              <div>
                <div className="mono reveal">§ 02 — Protocol</div>
                <h2 className="reveal d1">Consent, signed<br/>in <em>ink that won't fade</em>.</h2>
              </div>
              <div className="meta reveal d2">
                <p>Three primitives. One ledger. Every consent is revocable; every revocation is final.</p>
              </div>
            </div>
            <div className="pillars">
              <div className="pillar lime reveal d1">
                <div>
                  <div className="top">
                    <div className="num">01 / Primitive</div>
                    <div className="glyph">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M12 3v18M3 12h18"/>
                        <circle cx="12" cy="12" r="9"/>
                      </svg>
                    </div>
                  </div>
                  <h3>Granular<br/>consent</h3>
                  <p>Scope by record type, requester, and minute-level duration. Cryptographically signed from the patient's wallet — revocable in one tap.</p>
                </div>
                <div className="foot">
                  <span>On-chain</span>
                  <em>ConsentManager</em>
                </div>
              </div>
              <div className="pillar coral reveal d2">
                <div>
                  <div className="top">
                    <div className="num">02 / Primitive</div>
                    <div className="glyph">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <rect x="3" y="3" width="18" height="18" rx="2"/>
                        <path d="M3 9h18M9 9v12"/>
                      </svg>
                    </div>
                  </div>
                  <h3>Immutable<br/>audit</h3>
                  <p>Every read, write, approval and revocation lands in AuditLog — replicated across validators, visible to the patient, forever.</p>
                </div>
                <div className="foot">
                  <span>On-chain</span>
                  <em>AuditLog</em>
                </div>
              </div>
              <div className="pillar violet reveal d3">
                <div>
                  <div className="top">
                    <div className="num">03 / Primitive</div>
                    <div className="glyph">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M6 3h9l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"/>
                        <path d="M14 3v4h4"/>
                      </svg>
                    </div>
                  </div>
                  <h3>Encrypted<br/>records</h3>
                  <p>Data rests on IPFS, encrypted at the client. Only an active consent token can derive the read key — expiry dissolves it.</p>
                </div>
                <div className="foot">
                  <span>Off-chain</span>
                  <em>IPFS · AES-GCM</em>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FLOW */}
        <section className="section" id="flow">
          <div className="wrap">
            <div className="flow">
              <div className="stick">
                <div className="mono reveal" style={{ marginBottom: '24px' }}>§ 03 — Flow</div>
                <h3 className="reveal d1">A request,<br/>a signature,<br/>a <em>trace</em>.</h3>
                <p className="reveal d2">Four steps. Three seconds. Zero silent reads.</p>
                <div className="kpis reveal d3">
                  <div className="kpi"><b>3.3s</b><span>Settle time</span></div>
                  <div className="kpi"><b>256b</b><span>AES-GCM</span></div>
                  <div className="kpi"><b>0</b><span>Silent reads</span></div>
                </div>
              </div>
              <div className="steps">
                <div className="step reveal d1" data-c="lime">
                  <div className="badge">01</div>
                  <div className="body">
                    <h4>Entity requests</h4>
                    <p>A verified hospital submits an access request targeting a specific patient wallet and record scope.</p>
                  </div>
                  <div className="arrow">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M5 12h14M13 5l7 7-7 7"/>
                    </svg>
                  </div>
                </div>
                <div className="step reveal d2" data-c="coral">
                  <div className="badge">02</div>
                  <div className="body">
                    <h4>Patient signs</h4>
                    <p>The patient reviews scope, duration and reason in their wallet. One tap grants or denies.</p>
                  </div>
                  <div className="arrow">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="m5 12 5 5L20 7"/>
                    </svg>
                  </div>
                </div>
                <div className="step reveal d3" data-c="sky">
                  <div className="badge">03</div>
                  <div className="body">
                    <h4>Key derives</h4>
                    <p>The consent token derives a time-bound decryption key. Records are fetched and streamed to the requester.</p>
                  </div>
                  <div className="arrow">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="5" y="11" width="14" height="10" rx="2"/>
                      <path d="M8 11V7a4 4 0 0 1 8 0v2"/>
                    </svg>
                  </div>
                </div>
                <div className="step reveal d4" data-c="violet">
                  <div className="badge">04</div>
                  <div className="body">
                    <h4>Audit settles</h4>
                    <p>The event writes to AuditLog. At expiry, the key dissolves — no silent re-reads, ever.</p>
                  </div>
                  <div className="arrow">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="9"/>
                      <path d="M12 7v5l3 3"/>
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* STATS */}
        <section className="wrap" style={{ padding: '0 24px' }}>
          <div className="stats">
            <div className="stat reveal d1">
              <div className="tag"></div>
              <b><em>∞</em></b>
              <span>Retention of audit trail</span>
            </div>
            <div className="stat reveal d2">
              <div className="tag"></div>
              <b>0</b>
              <span>Silent reads since mainnet</span>
            </div>
            <div className="stat reveal d3">
              <div className="tag"></div>
              <b>3.3s</b>
              <span>Median settle time</span>
            </div>
            <div className="stat reveal d4">
              <div className="tag"></div>
              <b>7</b>
              <span>Verified entity classes</span>
            </div>
          </div>
        </section>

        {/* FEATURE BAND / CONSOLE */}
        <section className="section" id="console">
          <div className="wrap">
            <div className="section-head">
              <div>
                <div className="mono reveal">§ 04 — Console</div>
                <h2 className="reveal d1">Consent you can<br/><em>see</em> and <em>steer</em>.</h2>
              </div>
              <div className="meta reveal d2">
                <p>A quiet dashboard with loud defaults. Every active permission is visible, pausable, and time-stamped.</p>
              </div>
            </div>
            <div className="feature-band">
              <div className="copy reveal d1">
                <h3>A wallet<br/>for <em>permissions</em>.</h3>
                <p>Aegis-Care treats consent like a portable credential. Issue it, revoke it, expire it — the chain keeps score.</p>
                <ul>
                  <li>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="m5 12 5 5L20 7"/>
                    </svg>
                    <span>Revoke any consent in a single tap — the key dissolves before the next read.</span>
                  </li>
                  <li>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="m5 12 5 5L20 7"/>
                    </svg>
                    <span>Scope permissions down to a single record type, a single provider, a single hour.</span>
                  </li>
                  <li>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="m5 12 5 5L20 7"/>
                    </svg>
                    <span>Receive a signed notification for every inbound request — no silent background access.</span>
                  </li>
                </ul>
              </div>
              <div className="mock reveal d2">
                <div className="mock-head">
                  <div className="dots"><i></i><i></i><i></i></div>
                  <div className="mock-title">Active consents · 12</div>
                </div>
                <div className="mock-rows">
                  <div className="mock-row">
                    <div className="l">
                      <i style={{ background: 'var(--lime)' }}>HX</i>
                      <div>
                        <div style={{ fontSize: '14px' }}>Helix Hospital</div>
                        <div style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: 'rgba(246,245,240,.5)', letterSpacing: '.1em' }}>
                          LAB RESULTS · 48H
                        </div>
                      </div>
                    </div>
                    <span className="status active">Active</span>
                  </div>
                  <div className="mock-row">
                    <div className="l">
                      <i style={{ background: 'var(--coral)' }}>DR</i>
                      <div>
                        <div style={{ fontSize: '14px' }}>Dr. Hanwa, K.</div>
                        <div style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: 'rgba(246,245,240,.5)', letterSpacing: '.1em' }}>
                          IMAGING · 2H
                        </div>
                      </div>
                    </div>
                    <span className="status active">Active</span>
                  </div>
                  <div className="mock-row">
                    <div className="l">
                      <i style={{ background: 'var(--sky)' }}>LB</i>
                      <div>
                        <div style={{ fontSize: '14px' }}>Meridian Labs</div>
                        <div style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: 'rgba(246,245,240,.5)', letterSpacing: '.1em' }}>
                          PROFILE READ · PENDING
                        </div>
                      </div>
                    </div>
                    <span className="status pending">Pending</span>
                  </div>
                  <div className="mock-row">
                    <div className="l">
                      <i style={{ background: 'var(--violet)' }}>IN</i>
                      <div>
                        <div style={{ fontSize: '14px' }}>Arc Insurance</div>
                        <div style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: 'rgba(246,245,240,.5)', letterSpacing: '.1em' }}>
                          CLAIM REVIEW · EXPIRED
                        </div>
                      </div>
                    </div>
                    <span className="status expired">Expired</span>
                  </div>
                  <div className="mock-row">
                    <div className="l">
                      <i style={{ background: 'var(--sun)' }}>PH</i>
                      <div>
                        <div style={{ fontSize: '14px' }}>Nil Pharmacy</div>
                        <div style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: 'rgba(246,245,240,.5)', letterSpacing: '.1em' }}>
                          DISPENSING · 24H
                        </div>
                      </div>
                    </div>
                    <span className="status active">Active</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ROLES — bento */}
        <section className="section tinted" id="roles">
          <div className="wrap">
            <div className="section-head">
              <div>
                <div className="mono reveal">§ 05 — Portals</div>
                <h2 className="reveal d1">One protocol.<br/><em>Seven front doors.</em></h2>
              </div>
              <div className="meta reveal d2">
                <p>Every role sees exactly what its key unlocks — no more, no less.</p>
              </div>
            </div>
            <div className="roles">
              <a href="/patient" onClick={goto('/patient')} style={{ textDecoration: 'none', color: 'inherit' }} className="role big reveal d1">
                <div>
                  <div className="icn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <circle cx="12" cy="8" r="4"/>
                      <path d="M4 21a8 8 0 0 1 16 0"/>
                    </svg>
                  </div>
                  <div className="arr">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M5 12h14M13 5l7 7-7 7"/>
                    </svg>
                  </div>
                </div>
                <div>
                  <div className="t">Patient<br/>portal</div>
                  <p>The center of the system. Hold the keys, read the log, revoke with a tap. Designed for people, not institutions.</p>
                  <div className="b" style={{ marginTop: '20px' }}>self-custody · wallet-native</div>
                </div>
              </a>
              <a href="/hospital" onClick={goto('/hospital')} style={{ textDecoration: 'none', color: 'inherit' }} className="role reveal d2" data-c="lime">
                <div>
                  <div className="icn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M3 21V7l9-4 9 4v14"/>
                      <path d="M9 21v-6h6v6"/>
                    </svg>
                  </div>
                  <div className="arr">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M5 12h14M13 5l7 7-7 7"/>
                    </svg>
                  </div>
                </div>
                <div>
                  <div className="t">Hospital</div>
                  <div className="b">institutional</div>
                </div>
              </a>
              <a href="/doctor" onClick={goto('/doctor')} style={{ textDecoration: 'none', color: 'inherit' }} className="role reveal d2" data-c="coral">
                <div>
                  <div className="icn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M6 2v6a6 6 0 0 0 12 0V2"/>
                      <circle cx="18" cy="16" r="3"/>
                      <path d="M12 8v6"/>
                    </svg>
                  </div>
                  <div className="arr">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M5 12h14M13 5l7 7-7 7"/>
                    </svg>
                  </div>
                </div>
                <div>
                  <div className="t">Doctor</div>
                  <div className="b">clinician</div>
                </div>
              </a>
              <a href="/lab" onClick={goto('/lab')} style={{ textDecoration: 'none', color: 'inherit' }} className="role reveal d3" data-c="sky">
                <div>
                  <div className="icn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M10 2v6L4 18a2 2 0 0 0 2 3h12a2 2 0 0 0 2-3L14 8V2"/>
                    </svg>
                  </div>
                  <div className="arr">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M5 12h14M13 5l7 7-7 7"/>
                    </svg>
                  </div>
                </div>
                <div>
                  <div className="t">Lab</div>
                  <div className="b">diagnostics</div>
                </div>
              </a>
              <a href="/pharmacy" onClick={goto('/pharmacy')} style={{ textDecoration: 'none', color: 'inherit' }} className="role reveal d3" data-c="sun">
                <div>
                  <div className="icn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <rect x="3" y="3" width="18" height="18" rx="3"/>
                      <path d="M8 12h8"/>
                      <path d="M12 8v8"/>
                    </svg>
                  </div>
                  <div className="arr">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M5 12h14M13 5l7 7-7 7"/>
                    </svg>
                  </div>
                </div>
                <div>
                  <div className="t">Pharmacy</div>
                  <div className="b">dispensary</div>
                </div>
              </a>
              <a href="/insurance" onClick={goto('/insurance')} style={{ textDecoration: 'none', color: 'inherit' }} className="role reveal d4" data-c="violet">
                <div>
                  <div className="icn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5l-8-3Z"/>
                    </svg>
                  </div>
                  <div className="arr">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M5 12h14M13 5l7 7-7 7"/>
                    </svg>
                  </div>
                </div>
                <div>
                  <div className="t">Insurer</div>
                  <div className="b">payor</div>
                </div>
              </a>
              <a href="/auditor" onClick={goto('/auditor')} style={{ textDecoration: 'none', color: 'inherit' }} className="role reveal d4" data-c="ink">
                <div>
                  <div className="icn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M3 7h18M3 12h18M3 17h18"/>
                    </svg>
                  </div>
                  <div className="arr">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M5 12h14M13 5l7 7-7 7"/>
                    </svg>
                  </div>
                </div>
                <div>
                  <div className="t">Auditor</div>
                  <div className="b">oversight</div>
                </div>
              </a>
            </div>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="finalcta">
          <div className="wrap">
            <h2 className="reveal d1">Healthcare runs on trust.<br/><em>Trust</em> runs on proof.</h2>
            <p className="reveal d2">Connect a wallet to claim your records — or launch an admin workspace for your institution.</p>
            <div className="ctas reveal d3">
              <a href="#connect" onClick={openWallet} className="cta lime" data-magnetic>
                Connect wallet
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M13 5l7 7-7 7"/>
                </svg>
              </a>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer>
          <div className="wrap">
            <div className="row">
              <div className="fbrand">
                <div className="brand">
                  <div className="mark">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5l-8-3Z"/>
                      <path d="m9 12 2 2 4-4"/>
                    </svg>
                  </div>
                  <b>Aegis-Care</b>
                </div>
                <p>Sovereign consent for healthcare data. Built on Algorand, anchored in law — DPDP Act 2023, HIPAA, GDPR.</p>
              </div>
              <div>
                <h5>Protocol</h5>
                <ul>
                  <li><a href="#">ConsentManager</a></li>
                  <li><a href="#">AuditLog</a></li>
                  <li><a href="#">HealthcareRBAC</a></li>
                  <li><a href="#">DataAccessManager</a></li>
                </ul>
              </div>
              <div>
                <h5>Portals</h5>
                <ul>
                  <li><a href="/patient" onClick={goto('/patient')}>Patient</a></li>
                  <li><a href="/hospital" onClick={goto('/hospital')}>Hospital</a></li>
                  <li><a href="/doctor" onClick={goto('/doctor')}>Doctor · Lab</a></li>
                  <li><a href="/insurance" onClick={goto('/insurance')}>Insurer · Auditor</a></li>
                </ul>
              </div>
              <div>
                <h5>Contact</h5>
                <ul>
                  <li><a href="mailto:hello@Aegis-care.io">hello@Aegis-care.io</a></li>
                  <li><a href="#">Status</a></li>
                  <li><a href="#">Security</a></li>
                </ul>
              </div>
            </div>
            <div className="bigmark">
              <span>Aegis<em>-</em>Care</span>
              <span className="side">Sovereign medical data, built for the patient-first decade.</span>
            </div>
            <div className="bottom">
              <span>© 2026 Aegis-Care · All rights reserved</span>
              <span>DPDP · HIPAA · GDPR</span>
            </div>
          </div>
        </footer>
      </div>

      <ConnectWallet openModal={walletModalOpen} closeModal={() => setWalletModalOpen(false)} />
      <RoleSelectionModal isOpen={roleModalOpen} onClose={() => setRoleModalOpen(false)} />
    </>
  )
}
