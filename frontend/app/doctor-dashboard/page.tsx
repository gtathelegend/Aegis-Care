'use client';

import { useEffect, useState, useRef } from 'react';
import '../../styles/dashboard.css';
import { getMutableRecords, addRecord, addPrescription, addAuditEntry, patients, addAccessRequest } from '../../lib/mockdb';
import { uploadToPinata } from '../../lib/ipfs';

export default function DoctorDashboardPage() {
  const [activeNav, setActiveNav] = useState('overview');
  const [activeTab, setActiveTab] = useState('active');
  const [records, setRecords] = useState(getMutableRecords());

  // Access request form state
  const [reqPatientId, setReqPatientId] = useState('p1');
  const [reqScope, setReqScope] = useState('LAB_RESULTS');
  const [reqPurpose, setReqPurpose] = useState('');
  const [reqSubmitStatus, setReqSubmitStatus] = useState('');

  // Record upload form state
  const [patientId, setPatientId] = useState('p1');
  const [isUploading, setIsUploading] = useState(false);
  const [recordType, setRecordType] = useState('lab');
  const [recordTitle, setRecordTitle] = useState('');
  const [billAmount, setBillAmount] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const navLabels: Record<string, string> = {
    overview: 'Overview',
    patients: 'My Patients',
    consents: 'My Consents',
    records: 'Accessible Records',
    upload: 'Upload Prescription',
    schedule: 'Schedule',
    audit: 'My Audit Trail',
    settings: 'Settings',
  };

  const currentNavLabel = navLabels[activeNav] ?? 'Overview';

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

  const renderDoctorTabContent = () => {
    if (activeNav === 'patients') {
      return (
        <div className="card">
          <div className="head">
            <div>
              <h3>My Patients</h3>
              <div className="sub" style={{ marginTop: '4px' }}>Current assigned caseload</div>
            </div>
            <div className="actions"><button className="chip">Sort by risk</button></div>
          </div>
          <table className="tbl">
            <thead>
              <tr>
                <th>Patient</th>
                <th>Last Visit</th>
                <th>Primary Need</th>
                <th>Active Consent</th>
              </tr>
            </thead>
            <tbody>
              {[
                { av: 'IK', c: 'lime', name: 'Ishaan Kapoor', id: '847KOR', visit: '18 Apr 2026', need: 'Post-op review', consent: 'LAB RESULTS · 48H' },
                { av: 'PR', c: 'coral', name: 'Priya Rajan', id: '512RAJ', visit: '17 Apr 2026', need: 'Imaging follow-up', consent: 'IMAGING · 24H' },
                { av: 'AM', c: 'sky', name: 'Arjun Mehta', id: '391MEH', visit: '16 Apr 2026', need: 'Medication adjustment', consent: 'PROFILE · 72H' },
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
                  <td>{row.visit}</td>
                  <td>{row.need}</td>
                  <td style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--ink-2)' }}>{row.consent}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (activeNav === 'consents') {
      return (
        <div className="card">
          <div className="head">
            <div>
              <h3>My Consents</h3>
              <div className="sub" style={{ marginTop: '4px' }}>Grant windows currently linked to your account</div>
            </div>
          </div>
          <table className="tbl">
            <thead>
              <tr>
                <th>Patient</th>
                <th>Scope</th>
                <th>Status</th>
                <th>Remaining</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {[
                { av: 'IK', c: 'lime', name: 'Ishaan Kapoor', id: '847KOR', scope: 'LAB RESULTS · 48H', status: 'active', remain: '32h 14m', pct: '68%' },
                { av: 'PR', c: 'coral', name: 'Priya Rajan', id: '512RAJ', scope: 'IMAGING · 2H', status: 'active', remain: '1h 04m', pct: '52%' },
                { av: 'AM', c: 'sky', name: 'Arjun Mehta', id: '391MEH', scope: 'PROFILE · 72H', status: 'pending', remain: 'awaiting', pct: '0%' },
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
                  <td style={{ fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--ink-2)' }}>{row.scope}</td>
                  <td><span className={`pill-s ${row.status}`}>{row.status}</span></td>
                  <td>
                    {row.status === 'active' ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <span style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--ink)' }}>{row.remain}</span>
                        <div className="meter"><i style={{ width: row.pct }} /></div>
                      </div>
                    ) : (
                      <span style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--ink-3)' }}>{row.remain}</span>
                    )}
                  </td>
                  <td className="actions-cell"><button className="ibtn">View</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (activeNav === 'records') {
      return (
        <div className="card">
          <div className="head">
            <div>
              <h3>Accessible Records</h3>
              <div className="sub" style={{ marginTop: '4px' }}>Consent-gated documents for treatment</div>
            </div>
          </div>
          <div className="recs">
            {[
              { c: 'lime', label: 'Lab Results', patient: 'Ishaan Kapoor', cid: 'ipfs://Qm7dF...a4b2', chip: 'active' },
              { c: 'coral', label: 'MRI Report', patient: 'Priya Rajan', cid: 'ipfs://Qm3aK...c8d1', chip: 'active' },
              { c: 'sky', label: 'Prescription', patient: 'Sneha Verma', cid: 'ipfs://Qm9bL...e6f3', chip: 'active' },
              { c: 'violet', label: 'Discharge Note', patient: 'Rohan Nair', cid: 'ipfs://Qm2kY...f1d8', chip: 'pending' },
            ].map((rec, i) => (
              <div className="rec" data-c={rec.c} key={i}>
                <div className="top">
                  <div className="icn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 3h9l4 4v14H5V4Z" /><path d="M14 3v4h4" /></svg>
                  </div>
                  <span className="chip-s">{rec.chip}</span>
                </div>
                <h4>{rec.label}</h4>
                <p>{rec.patient}</p>
                <div className="cid">{rec.cid}</div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (activeNav === 'upload') {
      const recordTypeColors: Record<string, string> = {
        lab: 'sky',
        imaging: 'coral',
        prescription: 'sky',
        discharge: 'violet',
        vaccination: 'sun',
        vitals: 'lime',
      };

      const handleRecordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!recordTitle || !selectedFile) {
          setUploadStatus('Please select file and enter record title');
          return;
        }

        setIsUploading(true);
        setUploadStatus('Uploading record to IPFS...');

        try {
          let ipfsHash = `QmMOCK_${Date.now()}`;
          if (selectedFile) {
            ipfsHash = await uploadToPinata(selectedFile, { recordType });
          }

          const patient = patients.find(p => p.id === patientId);
          const recordData = {
            patientId,
            type: recordType as any,
            title: recordTitle,
            description: `Record uploaded via doctor dashboard. Bill Amount: ${billAmount || '0'} μAlgos`,
            uploadedBy: 'Dr. Hanwa, K.',
            uploadedByRole: 'Clinician',
            hospital: 'Helix Hospital',
            date: new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' }),
            ipfsHash,
            txHash: `0x${Math.random().toString(16).slice(2, 18)}`,
            blockHeight: Math.floor(Math.random() * 30000000),
            encrypted: true,
            size: `${(selectedFile.size / 1024).toFixed(1)} KB`,
            tags: [recordType, recordTitle],
            color: recordTypeColors[recordType] as any,
          };

          addRecord(recordData);

          addAuditEntry({
            action: 'WRITE',
            actor: 'Dr. Hanwa, K.',
            actorRole: 'Clinician',
            subject: recordTitle,
            detail: `WRITE · ${recordType.toUpperCase()} · ${recordData.ipfsHash.slice(0, 8)}`,
            timestamp: new Date().toLocaleString(),
            txHash: recordData.txHash,
            color: recordTypeColors[recordType] as any,
          });

          setUploadStatus('✓ Record uploaded successfully!');
          setRecords(getMutableRecords());

          setTimeout(() => {
            setRecordType('lab');
            setRecordTitle('');
            setBillAmount('');
            setSelectedFile(null);
            setUploadStatus('');
            setIsUploading(false);
          }, 2000);
        } catch (error) {
          setUploadStatus(`✗ Error: ${error instanceof Error ? error.message : 'Upload failed'}`);
          setIsUploading(false);
        }
      };

      return (
        <div className="grid" style={{ gridTemplateColumns: '1fr 1.2fr', gap: '24px' }}>
          <div className="card">
            <div className="head">
              <h3>Upload Record</h3>
              <div className="sub" style={{ marginTop: '4px' }}>Select a file and enter record details</div>
            </div>

            <form onSubmit={handleRecordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="field">
                <label htmlFor="patient">Patient ID</label>
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
                <label htmlFor="record-type">Record Type</label>
                <select
                  id="record-type"
                  value={recordType}
                  onChange={(e) => setRecordType(e.target.value)}
                  className="field"
                >
                  <option value="lab">Lab Results</option>
                  <option value="imaging">Imaging</option>
                  <option value="prescription">Prescription</option>
                  <option value="discharge">Discharge Summary</option>
                  <option value="vaccination">Vaccination</option>
                  <option value="vitals">Vitals</option>
                </select>
              </div>

              <div className="field">
                <label htmlFor="title">Record Title</label>
                <input
                  id="title"
                  type="text"
                  placeholder="e.g., ECG, MRI Report, Blood Panel"
                  value={recordTitle}
                  onChange={(e) => setRecordTitle(e.target.value)}
                  className="field"
                  required
                />
              </div>

              <div className="field">
                <label htmlFor="bill">Bill Amount (μAlgos, optional)</label>
                <input
                  id="bill"
                  type="number"
                  placeholder="0"
                  value={billAmount}
                  onChange={(e) => setBillAmount(e.target.value)}
                  className="field"
                />
              </div>

              <div className="field">
                <label htmlFor="file-input">Select File</label>
                <div
                  className="upload-zone"
                  onClick={() => document.getElementById('file-input')?.click()}
                  style={{ textAlign: 'center', padding: '16px' }}
                >
                  <input
                    ref={fileInputRef}
                    id="file-input"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.dcm"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    style={{ display: 'none' }}
                  />
                  {selectedFile ? (
                    <div style={{ fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--ink)' }}>
                      <div style={{ marginBottom: '6px' }}>📁 {selectedFile.name}</div>
                      <div style={{ fontSize: '10px', color: 'var(--ink-3)' }}>
                        {(selectedFile.size / 1024).toFixed(1)} KB
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--ink-3)' }}>
                      <div style={{ marginBottom: '4px' }}>Choose file</div>
                      <div style={{ fontSize: '10px' }}>PDF, Image, or DICOM</div>
                    </div>
                  )}
                </div>
                {selectedFile && (
                  <div style={{ fontSize: '11px', color: 'var(--ink-2)', fontFamily: 'var(--mono)', marginTop: '6px' }}>
                    Selected: {selectedFile.name}
                  </div>
                )}
              </div>

              <div style={{
                padding: '12px',
                borderRadius: '12px',
                background: 'color-mix(in oklch, var(--coral) 12%, var(--bg))',
                border: '1px solid color-mix(in oklch, var(--coral) 30%, transparent)',
                color: 'var(--coral)',
                fontSize: '11px',
                fontFamily: 'var(--mono)',
                textAlign: 'center',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                Wallet not connected · IPFS upload will work, on-chain anchoring requires wallet
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  onClick={() => {
                    setRecordType('lab');
                    setRecordTitle('');
                    setBillAmount('');
                    setSelectedFile(null);
                    setUploadStatus('');
                  }}
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
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploading || !selectedFile}
                  style={{
                    padding: '10px',
                    borderRadius: '12px',
                    border: 'none',
                    background: (isUploading || !selectedFile) ? 'var(--ink-3)' : 'var(--ink-green)',
                    fontFamily: 'var(--mono)',
                    fontSize: '11px',
                    letterSpacing: '.1em',
                    textTransform: 'uppercase',
                    cursor: (isUploading || !selectedFile) ? 'default' : 'pointer',
                    color: 'white',
                    opacity: (isUploading || !selectedFile) ? 0.6 : 1,
                  }}
                >
                  {isUploading ? 'Uploading...' : 'Upload Record'}
                </button>
              </div>

              {uploadStatus && (
                <div style={{
                  padding: '10px 14px',
                  borderRadius: '12px',
                  background: uploadStatus.includes('✓') ? 'var(--bg-green)' : 'var(--bg-coral)',
                  color: uploadStatus.includes('✓') ? 'var(--ink-green)' : 'var(--coral)',
                  fontSize: '12px',
                  fontFamily: 'var(--mono)',
                  textAlign: 'center',
                }}>
                  {uploadStatus}
                </div>
              )}
            </form>
          </div>

          <div className="card">
            <div className="head">
              <h3>Uploaded Records</h3>
              <div className="sub" style={{ marginTop: '4px' }}>All medical records by record type</div>
            </div>
            <table className="tbl" style={{ fontSize: '11px' }}>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Title</th>
                  <th>Patient</th>
                  <th>Date</th>
                  <th>Size</th>
                  <th>IPFS Hash</th>
                </tr>
              </thead>
              <tbody>
                {records.filter(r => r.uploadedBy === 'Dr. Hanwa, K.').slice(0, 10).map((rec) => (
                  <tr key={rec.id}>
                    <td><span className="pill-s active">{rec.type}</span></td>
                    <td style={{ color: 'var(--ink)' }}>{rec.title}</td>
                    <td style={{ color: 'var(--ink-2)' }}>Ishaan Kapoor</td>
                    <td style={{ color: 'var(--ink-2)' }}>{rec.date}</td>
                    <td style={{ color: 'var(--ink-3)' }}>{rec.size}</td>
                    <td style={{ fontFamily: 'var(--mono)', color: 'var(--ink-3)', fontSize: '9px' }}>
                      {rec.ipfsHash.slice(0, 6)}…{rec.ipfsHash.slice(-6)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    if (activeNav === 'requests') {
      const handleRequestSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const patient = patients.find(p => p.id === reqPatientId) ?? patients[0];
        addAccessRequest({
          fromDoctor: 'Dr. Hanwa, K.',
          fromDoctorAvatar: 'KH',
          fromDoctorColor: 'coral',
          targetPatientId: patient.id,
          targetPatientShortId: patient.shortId,
          scope: reqScope.replace('_', ' '),
          purpose: reqPurpose || 'Requesting access for ongoing care coordination.',
          submittedAt: new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
          status: 'pending',
        });
        setReqSubmitStatus('✓ Request sent — waiting for patient approval');
        setReqPurpose('');
        setTimeout(() => setReqSubmitStatus(''), 3000);
      };

      return (
        <div style={{ maxWidth: '520px' }}>
          <div className="card">
            <div className="head">
              <div>
                <h3>Submit a new request</h3>
                <div className="sub" style={{ marginTop: '4px' }}>SEND ACCESS REQUEST · CARE COORDINATION</div>
              </div>
            </div>
            <form onSubmit={handleRequestSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="field">
                <label>Target Patient</label>
                <select value={reqPatientId} onChange={e => setReqPatientId(e.target.value)} className="field">
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>{p.shortId} — {p.name}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Scope</label>
                <select value={reqScope} onChange={e => setReqScope(e.target.value)} className="field">
                  <option value="LAB_RESULTS">LAB_RESULTS</option>
                  <option value="IMAGING">IMAGING</option>
                  <option value="FULL_CHART">FULL_CHART</option>
                  <option value="PROFILE_READ">PROFILE_READ</option>
                  <option value="DISCHARGE_SUMMARY">DISCHARGE_SUMMARY</option>
                  <option value="RX_VIEW">RX_VIEW</option>
                </select>
              </div>
              <div className="field">
                <label>Purpose / Reason</label>
                <textarea
                  value={reqPurpose}
                  onChange={e => setReqPurpose(e.target.value)}
                  placeholder="Requesting access for ongoing care coordination."
                  rows={3}
                  className="field"
                  style={{ resize: 'vertical', fontFamily: 'inherit', fontSize: '13px' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="submit"
                  style={{
                    padding: '10px 22px',
                    borderRadius: '12px',
                    border: 'none',
                    background: 'var(--ink-green)',
                    fontFamily: 'var(--mono)',
                    fontSize: '11px',
                    letterSpacing: '.12em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    color: 'white',
                  }}
                >
                  Submit
                </button>
              </div>
              {reqSubmitStatus && (
                <div style={{ padding: '10px 14px', borderRadius: '12px', background: 'var(--bg-green)', color: 'var(--ink-green)', fontSize: '12px', fontFamily: 'var(--mono)', textAlign: 'center' }}>
                  {reqSubmitStatus}
                </div>
              )}
            </form>
          </div>
        </div>
      );
    }

    if (activeNav === 'schedule') {
      return (
        <div className="card">
          <div className="head">
            <div>
              <h3>Doctor Schedule</h3>
              <div className="sub" style={{ marginTop: '4px' }}>Upcoming appointments and slots</div>
            </div>
          </div>
          <table className="tbl">
            <thead><tr><th>Time</th><th>Patient</th><th>Purpose</th><th>Status</th></tr></thead>
            <tbody>
              <tr><td>09:30</td><td>Ishaan Kapoor</td><td>Post-op review</td><td><span className="pill-s active">confirmed</span></td></tr>
              <tr><td>11:00</td><td>Priya Rajan</td><td>MRI discussion</td><td><span className="pill-s pending">waiting</span></td></tr>
              <tr><td>14:45</td><td>Sneha Verma</td><td>Prescription adjustment</td><td><span className="pill-s active">confirmed</span></td></tr>
            </tbody>
          </table>
        </div>
      );
    }

    if (activeNav === 'audit') {
      return (
        <div className="card">
          <div className="head"><h3>My Audit Trail</h3></div>
          <div className="audit">
            {[
              { c: 'lime', t: 'READ · Ishaan Kapoor · LAB RESULTS', d: '18 Apr 2026, 14:32' },
              { c: 'sky', t: 'REQUEST · Arjun Mehta · PROFILE', d: '18 Apr 2026, 13:10' },
              { c: 'coral', t: 'READ · Priya Rajan · IMAGING', d: '17 Apr 2026, 11:05' },
              { c: 'violet', t: 'REVOKE ACK · Rohan Nair', d: '16 Apr 2026, 09:40' },
            ].map((item, i) => (
              <div className="audit-item" key={i}>
                <span className="pin" data-c={item.c} />
                <div className="body"><div className="t">{item.t}</div><div className="d">{item.d}</div></div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="card">
          <div className="head"><h3>Doctor Settings</h3></div>
          <div className="requests">
            <div className="req" style={{ cursor: 'default' }}><div className="body"><div className="t">Clinical Alerts</div><div className="d">Enabled for urgent requests</div></div></div>
            <div className="req" style={{ cursor: 'default' }}><div className="body"><div className="t">Default Consent Duration</div><div className="d">24 hours</div></div></div>
          </div>
        </div>
        <div className="card">
          <div className="head"><h3>Security</h3></div>
          <div className="audit">
            <div className="audit-item"><span className="pin" data-c="lime" /><div className="body"><div className="t">2FA enabled</div></div></div>
            <div className="audit-item"><span className="pin" data-c="sky" /><div className="body"><div className="t">Session timeout: 15 min</div></div></div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="grain">
      <div className="blobs">
        <i className="b1" style={{ background: 'var(--coral)' }} />
        <i className="b2" style={{ background: 'var(--lime)' }} />
        <i className="b3" />
      </div>
      <div className="app">
        <aside>
          <div className="brand">
            <div className="mark" style={{ background: 'var(--ink)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M6 2v6a6 6 0 0 0 12 0V2" />
                <circle cx="18" cy="16" r="3" />
                <path d="M12 8v6" />
              </svg>
            </div>
            <b>Dr. Hanwa <span>/ Clinician</span></b>
          </div>

          <div className="navgroup">
            <h5>Clinical</h5>
            <div className={`navitem ${activeNav === 'overview' ? 'active' : ''}`} onClick={() => setActiveNav('overview')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>
              Overview
            </div>
            <div className={`navitem ${activeNav === 'patients' ? 'active' : ''}`} onClick={() => setActiveNav('patients')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>
              My Patients<span className="badge">18</span>
            </div>
            <div className={`navitem ${activeNav === 'consents' ? 'active' : ''}`} onClick={() => setActiveNav('consents')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5l-8-3Z" /></svg>
              My Consents<span className="badge">6</span>
            </div>
            <div className={`navitem ${activeNav === 'records' ? 'active' : ''}`} onClick={() => setActiveNav('records')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M6 3h9l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" /><path d="M14 3v4h4" /></svg>
              Accessible Records
            </div>
            <div className={`navitem ${activeNav === 'upload' ? 'active' : ''}`} onClick={() => setActiveNav('upload')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 5v14M5 12h14" /></svg>
              Upload Prescription
            </div>
            <div className={`navitem ${activeNav === 'requests' ? 'active' : ''}`} onClick={() => setActiveNav('requests')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 5v14M5 12h14" /></svg>
              New Request
            </div>
          </div>

          <div className="navgroup" style={{ borderTop: '1px solid var(--line)' }}>
            <h5>Account</h5>
            <div className={`navitem ${activeNav === 'schedule' ? 'active' : ''}`} onClick={() => setActiveNav('schedule')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
              Schedule
            </div>
            <div className={`navitem ${activeNav === 'audit' ? 'active' : ''}`} onClick={() => setActiveNav('audit')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M3 7h18M3 12h18M3 17h18" /></svg>
              My Audit Trail
            </div>
            <div className={`navitem ${activeNav === 'settings' ? 'active' : ''}`} onClick={() => setActiveNav('settings')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 0 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 0 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 0 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></svg>
              Settings
            </div>
          </div>

          <div className="asidefoot">
            <div style={{ marginBottom: '10px' }}>
              <a href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '10px', fontSize: '12px', color: 'var(--ink-3)', fontFamily: 'var(--mono)', letterSpacing: '.1em', textTransform: 'uppercase', textDecoration: 'none' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--ink)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-3)')}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
                Patient Portal
              </a>
            </div>
            <div className="pill">
              <span className="dot" style={{ background: 'var(--coral)', boxShadow: '0 0 10px var(--coral)' }} />
              <span className="label">Network</span>
              <span className="val">TestNet</span>
            </div>
          </div>
        </aside>

        <main>
          <div className="topbar">
            <div>
              <div className="crumb">Doctor · {currentNavLabel}</div>
              <h1>Dr. <em style={{ fontStyle: 'italic', color: 'var(--coral)' }}>Hanwa, K.</em></h1>
            </div>
            <div className="search">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
              <input placeholder="Search patients, records, consents…" />
              <span className="kbd">⌘ K</span>
            </div>
            <div className="topactions">
              <span className="chip">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 2v6a6 6 0 0 0 12 0V2" /><circle cx="18" cy="16" r="3" /></svg>
                DOC-4821
                <span className="tag" style={{ background: 'var(--coral)' }}>Clinician</span>
              </span>
              <button className="iconbtn">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8" /><path d="M10 21a2 2 0 0 0 4 0" /></svg>
              </button>
              <div className="avatar" style={{ background: 'var(--coral)', color: 'var(--ink)', fontFamily: 'var(--mono)', fontSize: '13px', fontWeight: '600' }}>KH</div>
            </div>
          </div>

          <div className="content">
            {activeNav === 'overview' ? (
              <>
            {/* HERO */}
            <div className="hero">
              <div className="greet reveal d1">
                <div>
                  <div className="k">§ Clinician Overview — 18 April 2026</div>
                  <h2>
                    6 consents <em>active</em>.<br />18 patients in care.
                  </h2>
                  <p>Two consents expire within 2 hours. One new patient record accessible since your last login. All reads logged to chain.</p>
                </div>
                <div className="foot">
                  <button className="btn lime">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
                    Request access
                  </button>
                  <button className="btn ghost">View records</button>
                  <button className="btn ghost">My audit log</button>
                </div>
              </div>
              <div className="id reveal d2">
                <div className="row">
                  <div>
                    <div className="mono">Clinician ID</div>
                    <h3>Dr. Hanwa, K.</h3>
                  </div>
                  <span className="tag" style={{ background: 'var(--coral)' }}>Clinician</span>
                </div>
                <div className="sid">DOC<em>–4821</em></div>
                <div className="meta">
                  <span>Chain · <em>Algorand</em></span>
                  <span>Since <em>Feb 2025</em></span>
                </div>
              </div>
            </div>

            {/* KPIs */}
            <div className="kpis">
              <div className="kpi reveal d1" data-c="coral">
                <div className="top">
                  <div className="icn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg></div>
                  <span className="delta">+3 this week</span>
                </div>
                <b>18</b>
                <span className="lbl">My patients</span>
                <svg className="spark" viewBox="0 0 140 28" fill="none"><path d="M0 22 L20 18 L40 16 L60 12 L80 10 L100 8 L120 6 L140 4" stroke="var(--ink-green)" strokeWidth="1.5" /></svg>
              </div>
              <div className="kpi reveal d2" data-c="lime">
                <div className="top">
                  <div className="icn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5l-8-3Z" /></svg></div>
                  <span className="delta">6 granted</span>
                </div>
                <b>6</b>
                <span className="lbl">Active consents</span>
                <svg className="spark" viewBox="0 0 140 28" fill="none"><path d="M0 16 L20 14 L40 10 L60 12 L80 8 L100 10 L120 6 L140 4" stroke="var(--ink-green)" strokeWidth="1.5" /></svg>
              </div>
              <div className="kpi reveal d3" data-c="sky">
                <div className="top">
                  <div className="icn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 3h9l4 4v14H5V4Z" /><path d="M14 3v4h4" /></svg></div>
                  <span className="delta">+2 new</span>
                </div>
                <b>14</b>
                <span className="lbl">Records accessible</span>
                <svg className="spark" viewBox="0 0 140 28" fill="none"><path d="M0 20 L20 16 L40 14 L60 12 L80 10 L100 8 L120 6 L140 4" stroke="var(--ink-green)" strokeWidth="1.5" /></svg>
              </div>
              <div className="kpi reveal d4" data-c="violet">
                <div className="top">
                  <div className="icn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></svg></div>
                  <span className="delta">expiring soon</span>
                </div>
                <b>2</b>
                <span className="lbl">Expiring today</span>
                <svg className="spark" viewBox="0 0 140 28" fill="none"><path d="M0 8 L20 10 L40 8 L60 10 L80 12 L100 14 L120 18 L140 22" stroke="var(--ink-green)" strokeWidth="1.5" /></svg>
              </div>
            </div>

            {/* GRID */}
            <div className="grid">
              <div className="card reveal d1">
                <div className="head">
                  <div>
                    <h3>My consents</h3>
                    <div className="sub" style={{ marginTop: '4px' }}>6 active · 2 expiring</div>
                  </div>
                  <div className="actions">
                    <div className="tabs">
                      <button className={activeTab === 'active' ? 'on' : ''} onClick={() => setActiveTab('active')}>Active</button>
                      <button className={activeTab === 'pending' ? 'on' : ''} onClick={() => setActiveTab('pending')}>Pending</button>
                      <button className={activeTab === 'expired' ? 'on' : ''} onClick={() => setActiveTab('expired')}>Expired</button>
                    </div>
                  </div>
                </div>
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Patient</th>
                      <th>Scope</th>
                      <th>Status</th>
                      <th>Remaining</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { av: 'IK', c: 'lime', name: 'Ishaan Kapoor', id: '847KOR', scope: 'LAB RESULTS · 48H', status: 'active', remain: '32h 14m', pct: '68%' },
                      { av: 'PR', c: 'coral', name: 'Priya Rajan', id: '512RAJ', scope: 'IMAGING · 2H', status: 'active', remain: '1h 04m', pct: '52%' },
                      { av: 'AM', c: 'sky', name: 'Arjun Mehta', id: '391MEH', scope: 'PROFILE · 72H', status: 'pending', remain: 'awaiting', pct: '0%' },
                      { av: 'SV', c: 'sun', name: 'Sneha Verma', id: '204VER', scope: 'RX VIEW · 24H', status: 'active', remain: '18h 40m', pct: '78%' },
                      { av: 'RN', c: 'violet', name: 'Rohan Nair', id: '768NAI', scope: 'FULL CHART · 7D', status: 'expired', remain: 'dissolved', pct: '0%' },
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
                        <td><span className={`pill-s ${row.status}`}>{row.status}</span></td>
                        <td>
                          {row.status === 'active' ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              <span style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--ink)' }}>{row.remain}</span>
                              <div className="meter"><i style={{ width: row.pct }} /></div>
                            </div>
                          ) : (
                            <span style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--ink-3)' }}>{row.remain}</span>
                          )}
                        </td>
                        <td className="actions-cell">
                          {row.status !== 'expired' && (
                            <button className="ibtn" title="View record">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                            </button>
                          )}
                          {row.status === 'active' && (
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

              <div className="card reveal d2">
                <div className="head"><h3>Inbound requests</h3></div>
                <div className="requests">
                  {[
                    { av: 'IK', c: 'lime', t: 'Ishaan Kapoor', d: 'LAB RESULTS · REQUEST', info: 'Helix Hospital · Emergency' },
                    { av: 'AM', c: 'sky', t: 'Arjun Mehta', d: 'PROFILE READ · REQUEST', info: 'Meridian Labs · Routine' },
                    { av: 'SV', c: 'sun', t: 'Sneha Verma', d: 'RX HISTORY · REQUEST', info: 'Nil Pharmacy · Dispensing' },
                  ].map((r, i) => (
                    <div className="req" key={i}>
                      <div className="av" data-c={r.c} style={{ width: '40px', height: '40px', borderRadius: '12px', flexShrink: 0 }}>{r.av}</div>
                      <div className="body">
                        <div className="t">{r.t}</div>
                        <div className="d">{r.d}</div>
                        <div style={{ fontFamily: 'var(--mono)', fontSize: '9px', color: 'var(--ink-3)', letterSpacing: '.1em', marginTop: '4px' }}>{r.info}</div>
                      </div>
                      <div className="acts">
                        <button className="approve">Allow</button>
                        <button className="deny">Deny</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ACCESSIBLE RECORDS */}
            <div className="card reveal d2">
              <div className="head">
                <div><h3>Accessible records</h3><div className="sub" style={{ marginTop: '4px' }}>14 records · consent-gated</div></div>
              </div>
              <div className="recs">
                {[
                  { c: 'lime', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M10 2v6L4 18a2 2 0 0 0 2 3h12a2 2 0 0 0 2-3L14 8V2" /></svg>, label: 'Lab Results', patient: 'Ishaan Kapoor', cid: 'ipfs://Qm7dF...a4b2', chip: 'active' },
                  { c: 'coral', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 9v12" /></svg>, label: 'MRI Report', patient: 'Priya Rajan', cid: 'ipfs://Qm3aK...c8d1', chip: 'active' },
                  { c: 'sky', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 3h9l4 4v14H5V4Z" /><path d="M14 3v4h4" /></svg>, label: 'Prescription', patient: 'Sneha Verma', cid: 'ipfs://Qm9bL...e6f3', chip: 'active' },
                ].map((rec, i) => (
                  <div className="rec" data-c={rec.c} key={i}>
                    <div className="top">
                      <div className="icn">{rec.icon}</div>
                      <span className="chip-s" style={{ background: 'color-mix(in oklch, var(--lime) 30%, white)', color: 'var(--ink-green)' }}>{rec.chip}</span>
                    </div>
                    <h4>{rec.label}</h4>
                    <p>{rec.patient}</p>
                    <div className="cid">{rec.cid}</div>
                  </div>
                ))}
              </div>
            </div>
              </>
            ) : renderDoctorTabContent()}
          </div>
        </main>
      </div>
    </div>
  );
}
