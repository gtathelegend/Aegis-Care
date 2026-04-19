import { useCallback, useEffect, useMemo, useState } from 'react';
import { useWallet } from '@txnlab/use-wallet-react';
import '../styles/dashboard.css';
import QRModal from '../components/QRModal';
import RecordSlider from '../components/RecordSlider';
import UploadRecordModal from '../components/UploadRecordModal';
import {
  auditLog,
  consents,
  inboundRequests,
  medicalRecords,
  patients,
  getPatientById,
  recordTypeLabel,
  type AuditEntry,
  type MedicalRecord,
  type Patient,
} from '../lib/mockdb';
import { makeInitials, normalizeText, sortByTimeline, uniqueCount } from '../lib/dashboardHelpers';
import { useSnackbar } from 'notistack';
import { MedicalRecordsClient } from '../contracts/MedicalRecords';
import { getAlgorandClientFromViteEnvironment } from '../utils/network/getAlgoClientConfigs';
import { buildPrescriptionBoxReferences, createPrescriptionCid, fetchAllPatientRecords, findPatientByIdentifier, resolvePatient } from '../lib/medicalPortalData';

type RequestStatus = 'pending' | 'approved' | 'rejected';
type RequestTab = 'all' | RequestStatus;

interface HospitalRequestView {
  id: string;
  from: string;
  fromRole: string;
  fromAvatar: string;
  fromColor: string;
  scope: string;
  reason: string;
  urgency: 'routine' | 'urgent' | 'emergency';
  requestedAt: string;
  patient: Patient;
}

interface ConsentsSummary {
  active: number;
  pending: number;
  expired: number;
}

const requestStorageKey = 'aegis-hospital-request-statuses';

const statusStyles: Record<RequestStatus, string> = {
  pending: 'pending',
  approved: 'active',
  rejected: 'expired',
};

const urgencyColor: Record<HospitalRequestView['urgency'], string> = {
  routine: 'var(--sky)',
  urgent: 'var(--sun)',
  emergency: 'var(--coral)',
};

const INITIAL_PATIENT = getPatientById('p1');

const loadStatuses = (fallback: HospitalRequestView[]) => {
  if (typeof window === 'undefined') {
    return Object.fromEntries(fallback.map((request) => [request.id, 'pending'])) as Record<string, RequestStatus>;
  }

  try {
    const raw = window.localStorage.getItem(requestStorageKey);
    if (!raw) {
      return Object.fromEntries(fallback.map((request) => [request.id, 'pending'])) as Record<string, RequestStatus>;
    }

    const parsed = JSON.parse(raw) as Record<string, RequestStatus>;
    return fallback.reduce<Record<string, RequestStatus>>((accumulator, request) => {
      accumulator[request.id] = parsed[request.id] ?? 'pending';
      return accumulator;
    }, {});
  } catch {
    return Object.fromEntries(fallback.map((request) => [request.id, 'pending'])) as Record<string, RequestStatus>;
  }
};

export default function HospitalPortal() {
  const { activeAddress, transactionSigner } = useWallet();
  const { enqueueSnackbar } = useSnackbar();
  const [activeNav, setActiveNav] = useState('overview');
  const [activeTab, setActiveTab] = useState<RequestTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [requestStatuses, setRequestStatuses] = useState<Record<string, RequestStatus>>(() => ({}) as Record<string, RequestStatus>);
  const [activityFeed, setActivityFeed] = useState<AuditEntry[]>(auditLog);
  const [viewerRecords, setViewerRecords] = useState<MedicalRecord[]>([]);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [shareRecord, setShareRecord] = useState<MedicalRecord | null>(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [selectedPatientAddress, setSelectedPatientAddress] = useState('');
  const [liveRecords, setLiveRecords] = useState<MedicalRecord[]>(medicalRecords);
  const [prescriptionTarget, setPrescriptionTarget] = useState(INITIAL_PATIENT.shortId);
  const [prescriptionMedication, setPrescriptionMedication] = useState('Amoxicillin 500mg');
  const [prescriptionDosage, setPrescriptionDosage] = useState('1 tablet three times daily for 10 days');
  const [prescriptionInstructions, setPrescriptionInstructions] = useState('Take after meals and complete the full course.');
  const [prescriptionNotes, setPrescriptionNotes] = useState('');
  const [prescriptionSubmitting, setPrescriptionSubmitting] = useState(false);
  const [prescriptionFeedback, setPrescriptionFeedback] = useState('');

  const algorand = useMemo(() => getAlgorandClientFromViteEnvironment(), []);
  const medicalAppId = Number(import.meta.env.VITE_MEDICAL_RECORDS_APP_ID || 0);

  const patientById = useMemo(
    () => Object.fromEntries(patients.map((patient) => [patient.id, patient])) as Record<string, Patient>,
    []
  );

  const hospitalRequests = useMemo<HospitalRequestView[]>(() => {
    const patientRotation = ['p1', 'p2', 'p3', 'p4', 'p5'];
    return inboundRequests.map((request, index) => {
      const patientId = patientRotation[index % patientRotation.length];
      return {
        ...request,
        patient: patientById[patientId] ?? INITIAL_PATIENT,
      };
    });
  }, [patientById]);

  useEffect(() => {
    setRequestStatuses(loadStatuses(hospitalRequests));
  }, [hospitalRequests]);

  useEffect(() => {
    let cancelled = false;

    const syncRecords = async () => {
      try {
        const records = await fetchAllPatientRecords();
        if (!cancelled && records.length > 0) {
          setLiveRecords(records);
        }
      } catch {
        if (!cancelled) {
          setLiveRecords(medicalRecords);
        }
      }
    };

    syncRecords();
    const interval = setInterval(syncRecords, 45000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || Object.keys(requestStatuses).length === 0) {
      return;
    }

    window.localStorage.setItem(requestStorageKey, JSON.stringify(requestStatuses));
  }, [requestStatuses]);

  const navLabels: Record<string, string> = {
    overview: 'Overview',
    patients: 'Patients',
    requests: 'Access Requests',
    records: 'Records',
    audit: 'Audit Log',
    staff: 'Staff',
    compliance: 'Compliance',
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
      revealEls.forEach((element) => element.classList.add('in'));
    } else {
      revealEls.forEach((element) => io?.observe(element));
    }

    return () => {
      io?.disconnect();
    };
  }, [activeNav]);

  const records = useMemo(() => sortByTimeline(liveRecords, (record) => record.date), [liveRecords]);
  const activePatients = useMemo(() => uniqueCount(records, (record) => record.patientId), [records]);
  const recentUploads = records.length;
  const staffCount = useMemo(() => uniqueCount(records, (record) => record.uploadedBy), [records]);
  const activeConsentCount = consents.filter((consent) => consent.status === 'active').length;
  const expiringConsentCount = consents.filter((consent) => consent.status === 'active' && consent.remaining !== 'key dissolved').length;

  const requestSummary = useMemo<ConsentsSummary>(() => ({
    active: consents.filter((consent) => consent.status === 'active').length,
    pending: consents.filter((consent) => consent.status === 'pending').length,
    expired: consents.filter((consent) => consent.status === 'expired').length,
  }), []);

  const filteredRequests = useMemo(() => {
    const query = normalizeText(searchQuery);

    return hospitalRequests.filter((request) => {
      const status = requestStatuses[request.id] ?? 'pending';
      const matchesTab = activeTab === 'all' || status === activeTab;
      const matchesQuery = !query || [request.from, request.scope, request.reason, request.patient.name, request.patient.shortId]
        .some((value) => normalizeText(value).includes(query));

      return matchesTab && matchesQuery;
    });
  }, [activeTab, hospitalRequests, requestStatuses, searchQuery]);

  const filteredRecords = useMemo(() => {
    const query = normalizeText(searchQuery);

    return records.filter((record) => {
      if (!query) return true;

      return [record.title, record.description, record.uploadedBy, record.uploadedByRole, record.hospital, record.patientId, recordTypeLabel[record.type]]
        .some((value) => normalizeText(value).includes(query));
    });
  }, [records, searchQuery]);

  const recentRecords = filteredRecords.slice(0, 6);
  const activeRecordSet = viewerRecords.length > 0 ? viewerRecords : filteredRecords;

  const staffRoster = useMemo(() => {
    const staffMap = new Map<string, { name: string; role: string; count: number }>();

    records.forEach((record) => {
      const existing = staffMap.get(record.uploadedBy);
      if (existing) {
        existing.count += 1;
        return;
      }

      staffMap.set(record.uploadedBy, {
        name: record.uploadedBy,
        role: record.uploadedByRole,
        count: 1,
      });
    });

    return Array.from(staffMap.values()).sort((left, right) => right.count - left.count);
  }, [records]);

  const complianceWatchlist = useMemo(() => {
    return sortByTimeline(
      consents.filter((consent) => consent.status === 'active' || consent.status === 'pending'),
      (consent) => consent.expiresAt === '—' ? '0' : consent.expiresAt
    ).slice(0, 4);
  }, []);

  const openRecordViewer = useCallback(
    (record: MedicalRecord) => {
      const viewerSource = filteredRecords.length > 0 ? filteredRecords : records;
      const index = viewerSource.findIndex((candidate) => candidate.id === record.id);
      setViewerRecords(viewerSource);
      setViewerIndex(index >= 0 ? index : 0);
    },
    [filteredRecords, records]
  );

  const handleRequestAction = useCallback(
    (requestId: string, nextStatus: Exclude<RequestStatus, 'pending'>) => {
      const request = hospitalRequests.find((item) => item.id === requestId);
      if (!request) {
        return;
      }

      setRequestStatuses((current) => ({ ...current, [requestId]: nextStatus }));
      setActivityFeed((current) => [
        {
          id: `audit-${requestId}-${Date.now()}`,
          action: nextStatus === 'approved' ? 'CONSENT_GRANT' : 'CONSENT_REVOKE',
          actor: 'Hospital Admin',
          actorRole: 'Administrator',
          subject: request.patient.name,
          detail: `${nextStatus.toUpperCase()} · ${request.scope} · ${request.from}`,
          timestamp: new Date().toLocaleString(),
          txHash: '',
          color: nextStatus === 'approved' ? 'lime' : 'coral',
        },
        ...current,
      ]);

      enqueueSnackbar(`${request.patient.name} request ${nextStatus}.`, { variant: nextStatus === 'approved' ? 'success' : 'warning' });
    },
    [enqueueSnackbar, hospitalRequests]
  );

  const handleMarkReviewed = useCallback(
    (record: MedicalRecord) => {
      setActivityFeed((current) => [
        {
          id: `review-${record.id}-${Date.now()}`,
          action: 'READ',
          actor: 'Hospital Review Desk',
          actorRole: 'Operations',
          subject: record.title,
          detail: `REVIEWED · ${recordTypeLabel[record.type]} · ${record.patientId}`,
          timestamp: new Date().toLocaleString(),
          txHash: record.txHash,
          color: record.color as AuditEntry['color'],
        },
        ...current,
      ]);
      enqueueSnackbar(`Record reviewed: ${record.title}`, { variant: 'info' });
    },
    [enqueueSnackbar]
  );

  const heroSummary = `${requestStatuses ? Object.values(requestStatuses).filter((status) => status === 'pending').length : 0} requests pending. ${activePatients} patients with on-chain records.`;

  const filteredRecordCount = filteredRecords.length;

  const submitPrescription = useCallback(async () => {
    if (!activeAddress || !transactionSigner || !medicalAppId) {
      enqueueSnackbar('Connect a wallet and ensure the MedicalRecords contract is configured.', { variant: 'error' });
      return;
    }

    setPrescriptionSubmitting(true);
    setPrescriptionFeedback('');

    try {
      const target = findPatientByIdentifier(prescriptionTarget);
      const { patient: resolvedPatient, walletAddress } = await resolvePatient(prescriptionTarget);
      const client = new MedicalRecordsClient({ appId: BigInt(medicalAppId), algorand });
      const cid = await createPrescriptionCid({
        patientIdentifier: walletAddress,
        patientName: resolvedPatient.name,
        medication: prescriptionMedication,
        dosage: prescriptionDosage,
        instructions: prescriptionInstructions,
        notes: prescriptionNotes,
        providerName: activeAddress,
      });

      const boxReferences = await buildPrescriptionBoxReferences(walletAddress);

      await client.send.addPrescription({
        args: {
          patient: walletAddress,
          patientName: target?.name ?? resolvedPatient.name,
          cid,
        },
        sender: activeAddress,
        signer: transactionSigner,
        boxReferences,
      });

      setPrescriptionFeedback(`Prescription anchored for ${resolvedPatient.name}. CID ${cid}`);
      enqueueSnackbar(`Prescription uploaded for ${resolvedPatient.name}.`, { variant: 'success' });
      setLiveRecords(await fetchAllPatientRecords());
    } catch (error: any) {
      setPrescriptionFeedback(error?.message ?? 'Failed to upload prescription.');
      enqueueSnackbar(error?.message ?? 'Failed to upload prescription.', { variant: 'error' });
    } finally {
      setPrescriptionSubmitting(false);
    }
  }, [activeAddress, algorand, enqueueSnackbar, medicalAppId, prescriptionDosage, prescriptionInstructions, prescriptionMedication, prescriptionNotes, prescriptionTarget, transactionSigner]);

  const renderHospitalTabContent = () => {
    if (activeNav === 'patients') {
      return (
        <div style={{ padding: '40px' }}>
          <div style={{ marginBottom: '24px' }}>
            <h2 style={{ margin: '0 0 8px 0' }}>Patient Registry</h2>
            <p style={{ margin: 0, color: 'var(--ink-2)', fontSize: '14px' }}>{patients.length} patients registered</p>
          </div>
          <table className="tbl">
            <thead>
              <tr>
                <th>Patient Name</th>
                <th>Short ID</th>
                <th>Blood Group</th>
                <th>DOB</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {patients.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="avn">
                      <div className="av" data-c={p.avatarColor}>{makeInitials(p.name)}</div>
                      <div>
                        <div className="nm">{p.name}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ fontFamily: 'var(--mono)', fontSize: '12px' }}>{p.shortId}</td>
                  <td style={{ fontSize: '12px', color: 'var(--ink-2)' }}>{p.bloodGroup}</td>
                  <td style={{ fontSize: '12px', color: 'var(--ink-2)' }}>{p.dob}</td>
                  <td className="actions-cell">
                    <button className="ibtn lime" title="Upload record" onClick={() => { setSelectedPatientAddress(p.walletAddress); setUploadModalOpen(true); }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (activeNav === 'settings') {
      return (
        <div style={{ padding: '40px' }}>
          <h2 style={{ margin: '0 0 24px 0' }}>Settings</h2>
          <div style={{ maxWidth: '500px' }}>
            <div style={{ padding: '20px', background: 'var(--bg-2)', borderRadius: '12px', border: '1px solid var(--line)' }}>
              <h3 style={{ margin: '0 0 12px 0' }}>Hospital Information</h3>
              <div style={{ display: 'grid', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--ink-2)', marginBottom: '4px' }}>Hospital Name</label>
                  <input value="Helix Hospital" disabled style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--line)', background: 'var(--bg)', fontSize: '14px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--ink-2)', marginBottom: '4px' }}>Email</label>
                  <input value="admin@helixhospital.com" disabled style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--line)', background: 'var(--bg)', fontSize: '14px' }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return <div style={{ padding: '40px' }}>No content available for this section.</div>;
  };

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
            <b>
              Helix Hospital <span>/ Admin</span>
            </b>
          </div>

          <div className="navgroup">
            <h5>Operations</h5>
            <div className={`navitem ${activeNav === 'overview' ? 'active' : ''}`} onClick={() => setActiveNav('overview')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>
              Overview
            </div>
            <div className={`navitem ${activeNav === 'patients' ? 'active' : ''}`} onClick={() => setActiveNav('patients')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>
              Patients<span className="badge">{activePatients}</span>
            </div>
            <div className={`navitem ${activeNav === 'requests' ? 'active' : ''}`} onClick={() => setActiveNav('requests')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5l-8-3Z" /></svg>
              Access Requests<span className="badge">{Object.values(requestStatuses).filter((status) => status === 'pending').length}</span>
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
              Staff<span className="badge">{staffCount}</span>
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
              <a
                href="/patient"
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '10px', fontSize: '12px', color: 'var(--ink-3)', fontFamily: 'var(--mono)', letterSpacing: '.1em', textTransform: 'uppercase', textDecoration: 'none', transition: 'all .2s' }}
                onMouseEnter={(event) => (event.currentTarget.style.color = 'var(--ink)')}
                onMouseLeave={(event) => (event.currentTarget.style.color = 'var(--ink-3)')}
              >
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
              <h1>
                Helix <em style={{ fontStyle: 'italic', color: 'var(--sky)' }}>Hospital</em>.
              </h1>
            </div>
            <div className="search">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
              <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search patients, records, requests…" />
              <span className="kbd">⌘ K</span>
            </div>
            <div className="topactions">
              <span className="chip">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 21V7l9-4 9 4v14" /><path d="M9 21v-6h6v6" /></svg>
                HLX-001
                <span className="tag" style={{ background: 'var(--sky)' }}>Verified</span>
              </span>
              <button className="iconbtn" onClick={() => enqueueSnackbar('Notifications are wired to the live record feed.', { variant: 'info' })}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8" /><path d="M10 21a2 2 0 0 0 4 0" /></svg>
                <span className="pip" />
              </button>
              <div className="avatar" style={{ background: 'var(--sky)', color: 'var(--ink)', fontFamily: 'var(--mono)', fontSize: '13px', fontWeight: '600' }}>HL</div>
            </div>
          </div>

          <div className="content">
            {activeNav === 'overview' ? (
              <>
                <div className="hero">
              <div className="greet reveal d1" style={{ background: 'var(--ink)' }}>
                <div>
                  <div className="k">§ Hospital Overview · Live Snapshot</div>
                  <h2>
                    {Object.values(requestStatuses).filter((status) => status === 'pending').length} requests <em>pending</em>.
                    <br />{activePatients} patients on record.
                  </h2>
                  <p>{heroSummary} {requestSummary.active} active consent windows are available for review.</p>
                </div>
                <div className="foot">
                  <button className="btn lime" onClick={() => setActiveNav('requests')}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
                    Review requests
                  </button>
                  <button className="btn ghost" onClick={() => openRecordViewer(records[0] ?? liveRecords[0] ?? medicalRecords[0])}>Open latest record</button>
                  <button className="btn ghost" onClick={() => setActiveNav('audit')}>View audit feed</button>
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
                  <span>Staff · <em>{staffCount}</em></span>
                </div>
              </div>
            </div>

            <div className="kpis">
              <div className="kpi reveal d1" data-c="sky">
                <div className="top">
                  <div className="icn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg></div>
                  <span className="delta">{activePatients} patients</span>
                </div>
                <b>{activePatients}</b>
                <span className="lbl">Active patients</span>
                <svg className="spark" viewBox="0 0 140 28" fill="none"><path d="M0 22 L20 20 L40 16 L60 14 L80 10 L100 8 L120 5 L140 2" stroke="var(--ink-green)" strokeWidth="1.5" /></svg>
              </div>
              <div className="kpi reveal d2" data-c="coral">
                <div className="top">
                  <div className="icn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5l-8-3Z" /></svg></div>
                  <span className="delta down">{Object.values(requestStatuses).filter((status) => status === 'pending').length} pending</span>
                </div>
                <b>{Object.values(requestStatuses).filter((status) => status === 'pending').length}</b>
                <span className="lbl">Consent requests</span>
                <svg className="spark" viewBox="0 0 140 28" fill="none"><path d="M0 10 L20 12 L40 8 L60 14 L80 10 L100 16 L120 12 L140 8" stroke="var(--ink-green)" strokeWidth="1.5" /></svg>
              </div>
              <div className="kpi reveal d3" data-c="lime">
                <div className="top">
                  <div className="icn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 3h9l4 4v14H5V4Z" /><path d="M14 3v4h4" /></svg></div>
                  <span className="delta">{recentUploads} total</span>
                </div>
                <b>{recentUploads}</b>
                <span className="lbl">Records uploaded</span>
                <svg className="spark" viewBox="0 0 140 28" fill="none"><path d="M0 24 L20 22 L40 18 L60 16 L80 12 L100 10 L120 6 L140 4" stroke="var(--ink-green)" strokeWidth="1.5" /></svg>
              </div>
              <div className="kpi reveal d4" data-c="violet">
                <div className="top">
                  <div className="icn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg></div>
                  <span className="delta">{staffCount} clinicians</span>
                </div>
                <b>{staffCount}</b>
                <span className="lbl">Staff registered</span>
                <svg className="spark" viewBox="0 0 140 28" fill="none"><path d="M0 14 L20 12 L40 14 L60 10 L80 12 L100 8 L120 10 L140 6" stroke="var(--ink-green)" strokeWidth="1.5" /></svg>
              </div>
            </div>

            <div className="grid">
              <div className="card reveal d1">
                <div className="head">
                  <div>
                    <h3>Access requests</h3>
                    <div className="sub" style={{ marginTop: '4px' }}>{filteredRequests.length} visible · {Object.values(requestStatuses).filter((status) => status === 'pending').length} awaiting approval</div>
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
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRequests.map((request) => {
                      const status = requestStatuses[request.id] ?? 'pending';

                      return (
                        <tr key={request.id}>
                          <td>
                            <div className="avn">
                              <div className="av" data-c={request.fromColor}>{request.fromAvatar}</div>
                              <div>
                                <div className="nm">{request.patient.name}</div>
                                <div className="rl">{request.patient.shortId}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--ink-2)', letterSpacing: '.06em' }}>{request.scope}</td>
                          <td style={{ fontSize: '13px', color: 'var(--ink-2)' }}>{request.from}</td>
                          <td>
                            <span className={`pill-s ${statusStyles[status]}`}>{status}</span>
                          </td>
                          <td style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--ink-3)' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: urgencyColor[request.urgency] }} />
                              {request.requestedAt}
                            </span>
                          </td>
                          <td className="actions-cell">
                            {status === 'pending' ? (
                              <>
                                <button className="ibtn" title="Approve request" onClick={() => handleRequestAction(request.id, 'approved')}>
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 12 2 2 4-4" /><path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5l-8-3Z" /></svg>
                                </button>
                                <button className="ibtn danger" title="Reject request" onClick={() => handleRequestAction(request.id, 'rejected')}>
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
                                </button>
                              </>
                            ) : (
                              <button className="ibtn" title="Open patient record" onClick={() => openRecordViewer(records.find((record) => record.patientId === request.patient.id) ?? records[0])}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="card reveal d2">
                <div className="head">
                  <div>
                    <h3>Audit log</h3>
                    <div className="sub" style={{ marginTop: '4px' }}>{activityFeed.length} immutable events</div>
                  </div>
                </div>
                <div className="audit">
                  {activityFeed.slice(0, 7).map((entry) => (
                    <div className="audit-item" key={entry.id}>
                      <div className="pin" data-c={entry.color} />
                      <div className="body">
                        <div className="t">
                          <em>{entry.actor}</em> · {entry.subject}
                        </div>
                        <div className="d">{entry.detail}</div>
                      </div>
                      <time>{entry.timestamp}</time>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid">
              <div className="card reveal d2">
                <div className="head">
                  <div>
                    <h3>Recent uploads</h3>
                    <div className="sub" style={{ marginTop: '4px' }}>{filteredRecordCount} matching records</div>
                  </div>
                </div>
                <div className="recs">
                  {recentRecords.map((record) => {
                    const patient = patientById[record.patientId] ?? INITIAL_PATIENT;

                    return (
                      <div className="rec" data-c={record.color} key={record.id} onClick={() => openRecordViewer(record)}>
                        <div className="top">
                          <div className="icn">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                              {record.type === 'lab' && <path d="M10 2v6L4 18a2 2 0 0 0 2 3h12a2 2 0 0 0 2-3L14 8V2" />}
                              {record.type === 'imaging' && <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 9v12" /></>}
                              {record.type === 'prescription' && <><path d="M6 3h9l4 4v14H5V4Z" /><path d="M14 3v4h4" /></>}
                              {record.type === 'discharge' && <path d="M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8l-5-5z" />}
                              {record.type === 'vaccination' && <path d="m18 2 4 4-4 4" />}
                              {record.type === 'vitals' && <path d="M3 12h4l3-9 4 18 3-9h4" />}
                            </svg>
                          </div>
                          <span className="chip-s">{record.type}</span>
                        </div>
                        <h4>{record.title}</h4>
                        <p>{patient.name} · {record.uploadedByRole}</p>
                        <div className="cid">{record.ipfsHash}</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px' }}>
                          <button className="ibtn" title="Share record" onClick={(event) => { event.stopPropagation(); setShareRecord(record); }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="3" height="9" /><rect x="9.5" y="7" width="3" height="13" /><rect x="16" y="4" width="3" height="16" /></svg>
                          </button>
                          <button className="ibtn" title="Mark reviewed" onClick={(event) => { event.stopPropagation(); handleMarkReviewed(record); }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 12 2 2 4-4" /><path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5l-8-3Z" /></svg>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="card reveal d2">
                <div className="head">
                  <div>
                    <h3>Compliance watchlist</h3>
                    <div className="sub" style={{ marginTop: '4px' }}>{requestSummary.active} active · {requestSummary.pending} pending · {requestSummary.expired} expired</div>
                  </div>
                </div>
                <div className="requests">
                  {complianceWatchlist.map((consent) => {
                    const patient = patientById[consent.patientId] ?? INITIAL_PATIENT;

                    return (
                      <div className="req" key={consent.id}>
                        <div className="av" data-c={consent.grantedToColor} style={{ width: '40px', height: '40px', borderRadius: '12px', flexShrink: 0 }}>{makeInitials(consent.grantedTo)}</div>
                        <div className="body">
                          <div className="t">{patient.name}</div>
                          <div className="d">{consent.scopeLabel}</div>
                          <div style={{ fontFamily: 'var(--mono)', fontSize: '9px', color: 'var(--ink-3)', letterSpacing: '.1em', marginTop: '4px' }}>{consent.remaining}</div>
                        </div>
                        <div className="acts">
                          <button className={consent.status === 'active' ? 'approve' : 'deny'}>{consent.status}</button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div style={{ padding: '0 20px 20px', display: 'grid', gap: '12px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                    <div style={{ padding: '14px', border: '1px solid var(--line)', borderRadius: '16px', background: 'var(--bg)' }}>
                      <div className="mono">Records</div>
                      <div style={{ fontFamily: 'var(--serif)', fontSize: '32px', lineHeight: 1.1, marginTop: '6px' }}>{recentUploads}</div>
                    </div>
                    <div style={{ padding: '14px', border: '1px solid var(--line)', borderRadius: '16px', background: 'var(--bg)' }}>
                      <div className="mono">Providers</div>
                      <div style={{ fontFamily: 'var(--serif)', fontSize: '32px', lineHeight: 1.1, marginTop: '6px' }}>{staffCount}</div>
                    </div>
                    <div style={{ padding: '14px', border: '1px solid var(--line)', borderRadius: '16px', background: 'var(--bg)' }}>
                      <div className="mono">Consents</div>
                      <div style={{ fontFamily: 'var(--serif)', fontSize: '32px', lineHeight: 1.1, marginTop: '6px' }}>{activeConsentCount}</div>
                    </div>
                  </div>

                  <div style={{ padding: '14px 16px', border: '1px solid var(--line)', borderRadius: '16px', background: 'var(--ink)', color: 'var(--bg)' }}>
                    <div className="mono" style={{ color: 'rgba(246,245,240,.55)' }}>Hospital snapshot</div>
                    <div style={{ marginTop: '8px', fontSize: '14px', lineHeight: 1.6, color: 'rgba(246,245,240,.85)' }}>
                      {expiringConsentCount} active consents are approaching expiry and {staffCount} clinical staff entries are visible in the current dataset.
                    </div>
                  </div>
                </div>
              </div>

              <div className="card reveal d3">
                <div className="head">
                  <div>
                    <h3>Prescription upload</h3>
                    <div className="sub" style={{ marginTop: '4px' }}>Issue a prescription to a patient by short ID or wallet address.</div>
                  </div>
                </div>
                <div style={{ padding: '0 20px 20px', display: 'grid', gap: '10px' }}>
                  <input value={prescriptionTarget} onChange={(event) => setPrescriptionTarget(event.target.value)} placeholder="Patient short ID or wallet address" style={{ width: '100%', padding: '10px 12px', borderRadius: '12px', border: '1px solid var(--line)', background: 'var(--bg)', fontSize: '12px' }} />
                  <input value={prescriptionMedication} onChange={(event) => setPrescriptionMedication(event.target.value)} placeholder="Medication" style={{ width: '100%', padding: '10px 12px', borderRadius: '12px', border: '1px solid var(--line)', background: 'var(--bg)', fontSize: '12px' }} />
                  <input value={prescriptionDosage} onChange={(event) => setPrescriptionDosage(event.target.value)} placeholder="Dosage and frequency" style={{ width: '100%', padding: '10px 12px', borderRadius: '12px', border: '1px solid var(--line)', background: 'var(--bg)', fontSize: '12px' }} />
                  <textarea value={prescriptionInstructions} onChange={(event) => setPrescriptionInstructions(event.target.value)} rows={3} placeholder="Patient instructions" style={{ width: '100%', padding: '10px 12px', borderRadius: '12px', border: '1px solid var(--line)', background: 'var(--bg)', fontSize: '12px', resize: 'vertical' }} />
                  <textarea value={prescriptionNotes} onChange={(event) => setPrescriptionNotes(event.target.value)} rows={2} placeholder="Optional notes" style={{ width: '100%', padding: '10px 12px', borderRadius: '12px', border: '1px solid var(--line)', background: 'var(--bg)', fontSize: '12px', resize: 'vertical' }} />
                  <button className="btn lime" onClick={submitPrescription} disabled={prescriptionSubmitting}>
                    {prescriptionSubmitting ? 'Uploading prescription…' : 'Upload prescription'}
                  </button>
                  {prescriptionFeedback && <div style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--ink-2)', lineHeight: 1.6 }}>{prescriptionFeedback}</div>}
                </div>
              </div>
            </div>
              </>
            ) : renderHospitalTabContent()}
          </div>
        </main>
      </div>

      <UploadRecordModal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        patientAddress={selectedPatientAddress}
        onSuccess={(cid) => {
          alert(`Record uploaded successfully! CID: ${cid.slice(0, 20)}...`);
          setUploadModalOpen(false);
        }}
      />

      {viewerRecords.length > 0 && (
        <RecordSlider
          records={activeRecordSet}
          initialIndex={viewerIndex}
          onClose={() => setViewerRecords([])}
          onShare={(record) => setShareRecord(record)}
        />
      )}

      {shareRecord && (
        <QRModal
          record={shareRecord}
          patient={patientById[shareRecord.patientId] ?? INITIAL_PATIENT}
          onClose={() => setShareRecord(null)}
        />
      )}
    </div>
  );
}
