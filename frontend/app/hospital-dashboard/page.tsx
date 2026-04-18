'use client';

import { useEffect, useState } from 'react';
import '../../styles/dashboard.css';

export default function HospitalDashboardPage() {
  const [activeNav, setActiveNav] = useState('overview');
  const [activeTab, setActiveTab] = useState('all');

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
    return () => { io?.disconnect(); };
  }, [activeNav]);

  return (
    <div className="grain">
      <div className="blobs">
        <i className="b1" style={{ background: 'var(--sky)' }} />
        <i className="b2" />
        <i className="b3" style={{ background: 'var(--lime)' }} />
      </div>
      <div className="app">
        <aside>
          <div className="brand">
            <div className="mark">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M3 21V7l9-4 9 4v14" />
                <path d="M9 21v-6h6v6" />
              </svg>
            </div>
            <b>Helix Hospital <span>/ Admin</span></b>
          </div>

          <div className="navgroup">
            <h5>Operations</h5>
            <div className={`navitem ${activeNav === 'overview' ? 'active' : ''}`} onClick={() => setActiveNav('overview')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>
              Overview
            </div>
            <div className={`navitem ${activeNav === 'patients' ? 'active' : ''}`} onClick={() => setActiveNav('patients')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>
              Patients<span className="badge">247</span>
            </div>
            <div className={`navitem ${activeNav === 'requests' ? 'active' : ''}`} onClick={() => setActiveNav('requests')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5l-8-3Z" /></svg>
              Access Requests<span className="badge">8</span>
            </div>
            <div className={`navitem ${activeNav === 'records' ? 'active' : ''}`} onClick={() => setActiveNav('records')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M6 3h9l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" /><path d="M14 3v4h4" /></svg>
              Records
            </div>
            <div className={`navitem ${activeNav === 'audit' ? 'active' : ''}`} onClick={() => setActiveNav('audit')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M3 7h18M3 12h18M3 17h18" /></svg>
              Audit Log
            </div>
          </div>

          <div className="navgroup" style={{ borderTop: '1px solid var(--line)' }}>
            <h5>Admin</h5>
            <div className={`navitem ${activeNav === 'staff' ? 'active' : ''}`} onClick={() => setActiveNav('staff')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>
              Staff
            </div>
            <div className={`navitem ${activeNav === 'compliance' ? 'active' : ''}`} onClick={() => setActiveNav('compliance')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5l-8-3Z" /><path d="m9 12 2 2 4-4" /></svg>
              Compliance
            </div>
            <div className={`navitem ${activeNav === 'settings' ? 'active' : ''}`} onClick={() => setActiveNav('settings')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 0 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 0 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 0 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></svg>
              Settings
            </div>
          </div>

          <div className="asidefoot">
            <div style={{ marginBottom: '10px' }}>
              <a href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '10px', fontSize: '12px', color: 'var(--ink-3)', fontFamily: 'var(--mono)', letterSpacing: '.1em', textTransform: 'uppercase', textDecoration: 'none', transition: 'all .2s' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--ink)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-3)')}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
                Patient Portal
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
              <div className="crumb">Hospital · {activeNav.charAt(0).toUpperCase() + activeNav.slice(1)}</div>
              <h1>Helix <em style={{ fontStyle: 'italic', color: 'var(--sky)' }}>Hospital</em>.</h1>
            </div>
            <div className="search">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
              <input placeholder="Search patients, records, requests…" />
              <span className="kbd">⌘ K</span>
            </div>
            <div className="topactions">
              <span className="chip">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 21V7l9-4 9 4v14" /><path d="M9 21v-6h6v6" /></svg>
                HLX-001
                <span className="tag" style={{ background: 'var(--sky)' }}>Verified</span>
              </span>
              <button className="iconbtn">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8" /><path d="M10 21a2 2 0 0 0 4 0" /></svg>
                <span className="pip" />
              </button>
              <div className="avatar" style={{ background: 'var(--sky)', color: 'var(--ink)', fontFamily: 'var(--mono)', fontSize: '13px', fontWeight: '600' }}>HL</div>
            </div>
          </div>

          <div className="content">
            {/* HERO */}
            <div className="hero">
              <div className="greet reveal d1" style={{ background: 'var(--ink)' }}>
                <div>
                  <div className="k">§ Hospital Overview — 18 April 2026</div>
                  <h2>
                    8 requests <em>pending</em>.<br />247 patients on record.
                  </h2>
                  <p>Three consent windows expire today. All record uploads are compliant. No unauthorised access attempts detected.</p>
                </div>
                <div className="foot">
                  <button className="btn lime">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
                    Request access
                  </button>
                  <button className="btn ghost">Upload records</button>
                  <button className="btn ghost">Export report</button>
                </div>
              </div>
              <div className="id reveal d2">
                <div className="row">
                  <div>
                    <div className="mono">Institution ID</div>
                    <h3>Helix Hospital</h3>
                  </div>
                  <span className="tag" style={{ background: 'var(--sky)' }}>Verified</span>
                </div>
                <div className="sid">HLX<em>–001</em></div>
                <div className="meta">
                  <span>Chain · <em>Algorand</em></span>
                  <span>Since <em>Jan 2025</em></span>
                </div>
              </div>
            </div>

            {/* KPIs */}
            <div className="kpis">
              <div className="kpi reveal d1" data-c="sky">
                <div className="top">
                  <div className="icn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg></div>
                  <span className="delta">+12 this week</span>
                </div>
                <b>247</b>
                <span className="lbl">Active patients</span>
                <svg className="spark" viewBox="0 0 140 28" fill="none"><path d="M0 22 L20 20 L40 16 L60 14 L80 10 L100 8 L120 5 L140 2" stroke="var(--ink-green)" strokeWidth="1.5" /></svg>
              </div>
              <div className="kpi reveal d2" data-c="coral">
                <div className="top">
                  <div className="icn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5l-8-3Z" /></svg></div>
                  <span className="delta down">8 pending</span>
                </div>
                <b>8</b>
                <span className="lbl">Consent requests</span>
                <svg className="spark" viewBox="0 0 140 28" fill="none"><path d="M0 10 L20 12 L40 8 L60 14 L80 10 L100 16 L120 12 L140 8" stroke="var(--ink-green)" strokeWidth="1.5" /></svg>
              </div>
              <div className="kpi reveal d3" data-c="lime">
                <div className="top">
                  <div className="icn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 3h9l4 4v14H5V4Z" /><path d="M14 3v4h4" /></svg></div>
                  <span className="delta">+34 today</span>
                </div>
                <b>1,842</b>
                <span className="lbl">Records uploaded</span>
                <svg className="spark" viewBox="0 0 140 28" fill="none"><path d="M0 24 L20 22 L40 18 L60 16 L80 12 L100 10 L120 6 L140 4" stroke="var(--ink-green)" strokeWidth="1.5" /></svg>
              </div>
              <div className="kpi reveal d4" data-c="violet">
                <div className="top">
                  <div className="icn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg></div>
                  <span className="delta">18 online</span>
                </div>
                <b>64</b>
                <span className="lbl">Staff registered</span>
                <svg className="spark" viewBox="0 0 140 28" fill="none"><path d="M0 14 L20 12 L40 14 L60 10 L80 12 L100 8 L120 10 L140 6" stroke="var(--ink-green)" strokeWidth="1.5" /></svg>
              </div>
            </div>

            {/* MAIN GRID */}
            <div className="grid">
              <div className="card reveal d1">
                <div className="head">
                  <div>
                    <h3>Access requests</h3>
                    <div className="sub" style={{ marginTop: '4px' }}>8 awaiting patient approval</div>
                  </div>
                  <div className="actions">
                    <div className="tabs">
                      <button className={activeTab === 'all' ? 'on' : ''} onClick={() => setActiveTab('all')}>All</button>
                      <button className={activeTab === 'pending' ? 'on' : ''} onClick={() => setActiveTab('pending')}>Pending</button>
                      <button className={activeTab === 'approved' ? 'on' : ''} onClick={() => setActiveTab('approved')}>Approved</button>
                    </div>
                  </div>
                </div>
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Patient</th>
                      <th>Scope</th>
                      <th>Requested by</th>
                      <th>Status</th>
                      <th>Submitted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { av: 'IK', c: 'lime', name: 'Ishaan Kapoor', id: '847KOR', scope: 'LAB RESULTS · 48H', by: 'Dr. Hanwa', status: 'pending', time: '2h ago' },
                      { av: 'PR', c: 'coral', name: 'Priya Rajan', id: '512RAJ', scope: 'IMAGING · 24H', by: 'Dr. Seth', status: 'approved', time: '4h ago' },
                      { av: 'AM', c: 'sky', name: 'Arjun Mehta', id: '391MEH', scope: 'PROFILE · 72H', by: 'Dr. Hanwa', status: 'pending', time: '6h ago' },
                      { av: 'SV', c: 'sun', name: 'Sneha Verma', id: '204VER', scope: 'RX VIEW · 12H', by: 'Dr. Patel', status: 'approved', time: 'Yesterday' },
                      { av: 'RN', c: 'violet', name: 'Rohan Nair', id: '768NAI', scope: 'FULL CHART · 7D', by: 'Dr. Seth', status: 'pending', time: 'Yesterday' },
                    ].map((row) => (
                      <tr key={row.id}>
                        <td>
                          <div className="avn">
                            <div className="av" data-c={row.c}>{row.av}</div>
                            <div>
                              <div className="nm">{row.name}</div>
                              <div className="rl">{row.id}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--ink-2)', letterSpacing: '.06em' }}>{row.scope}</td>
                        <td style={{ fontSize: '13px', color: 'var(--ink-2)' }}>{row.by}</td>
                        <td><span className={`pill-s ${row.status === 'approved' ? 'active' : 'pending'}`}>{row.status}</span></td>
                        <td style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--ink-3)' }}>{row.time}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="card reveal d2">
                <div className="head">
                  <h3>Audit log</h3>
                </div>
                <div className="audit">
                  {[
                    { c: 'lime', t: '<em>Dr. Hanwa</em> accessed Ishaan K. lab results', d: 'READ · LAB_RESULTS', time: '14:32' },
                    { c: 'sky', t: 'Record uploaded for <em>Priya Rajan</em>', d: 'WRITE · IMAGING', time: '13:18' },
                    { c: 'coral', t: 'Access request submitted for <em>Rohan Nair</em>', d: 'REQUEST · FULL_CHART', time: '11:55' },
                    { c: 'violet', t: '<em>Sneha Verma</em> revoked consent early', d: 'REVOKE · RX_VIEW', time: '10:40' },
                    { c: 'lime', t: 'New patient <em>Arjun Mehta</em> onboarded', d: 'REGISTER · PATIENT', time: '09:15' },
                    { c: 'sky', t: '<em>Dr. Seth</em> consent approved by patient', d: 'CONSENT · IMAGING', time: '08:50' },
                  ].map((item, i) => (
                    <div className="audit-item" key={i}>
                      <div className="pin" data-c={item.c} />
                      <div className="body">
                        <div className="t" dangerouslySetInnerHTML={{ __html: item.t }} />
                        <div className="d">{item.d}</div>
                      </div>
                      <time>{item.time}</time>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ACTIVE PATIENTS RECORDS */}
            <div className="card reveal d2">
              <div className="head">
                <div><h3>Recent uploads</h3><div className="sub" style={{ marginTop: '4px' }}>34 records added today</div></div>
              </div>
              <div className="recs">
                {[
                  { c: 'lime', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M10 2v6L4 18a2 2 0 0 0 2 3h12a2 2 0 0 0 2-3L14 8V2" /></svg>, label: 'Lab Results', patient: 'Ishaan Kapoor', cid: 'ipfs://Qm7dF...a4b2', chip: 'verified' },
                  { c: 'coral', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 9v12" /></svg>, label: 'MRI Imaging', patient: 'Priya Rajan', cid: 'ipfs://Qm3aK...c8d1', chip: 'encrypted' },
                  { c: 'sky', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 3h9l4 4v14H5V4Z" /><path d="M14 3v4h4" /></svg>, label: 'Discharge Notes', patient: 'Arjun Mehta', cid: 'ipfs://Qm9bL...e6f3', chip: 'pending' },
                ].map((rec, i) => (
                  <div className="rec" data-c={rec.c} key={i}>
                    <div className="top">
                      <div className="icn">{rec.icon}</div>
                      <span className="chip-s">{rec.chip}</span>
                    </div>
                    <h4>{rec.label}</h4>
                    <p>{rec.patient}</p>
                    <div className="cid">{rec.cid}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
