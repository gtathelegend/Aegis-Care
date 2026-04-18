import { useCallback, useEffect, useMemo, useState } from 'react';
import { useWallet } from '@txnlab/use-wallet-react';
import '../styles/dashboard.css';
import QRModal from '../components/QRModal';
import RecordSlider from '../components/RecordSlider';
import {
  auditLog,
  consents,
  inboundRequests,
  medicalRecords,
  patients,
  getPatientById,
  recordTypeLabel,
  type AuditEntry,
  type Consent,
  type MedicalRecord,
  type Patient,
} from '../lib/mockdb';
import { makeInitials, normalizeText, sortByTimeline, uniqueCount } from '../lib/dashboardHelpers';
import { useSnackbar } from 'notistack';
import { MedicalRecordsClient } from '../contracts/MedicalRecords';
import { getAlgorandClientFromViteEnvironment } from '../utils/network/getAlgoClientConfigs';
import { buildPrescriptionBoxReferences, createPrescriptionCid, fetchAllPatientRecords, findPatientByIdentifier, resolvePatient } from '../lib/medicalPortalData';

type ConsentStatus = 'active' | 'pending' | 'expired';
type ConsentTab = 'active' | 'pending' | 'expired';
type RequestStatus = 'pending' | 'approved' | 'rejected';

interface DoctorRequest {
  id: string;
  patient: Patient;
  scope: string;
  reason: string;
  status: RequestStatus;
  requestedAt: string;
}

const consentStorageKey = 'aegis-doctor-consent-statuses';
const requestStorageKey = 'aegis-doctor-request-queue';

const DEFAULT_PATIENT = getPatientById('p1');

const loadConsentStatuses = (fallback: Consent[]) => {
  if (typeof window === 'undefined') {
    return Object.fromEntries(fallback.map((consent) => [consent.id, consent.status])) as Record<string, ConsentStatus>;
  }

  try {
    const raw = window.localStorage.getItem(consentStorageKey);
    if (!raw) {
      return Object.fromEntries(fallback.map((consent) => [consent.id, consent.status])) as Record<string, ConsentStatus>;
    }

    const parsed = JSON.parse(raw) as Record<string, ConsentStatus>;
    return fallback.reduce<Record<string, ConsentStatus>>((accumulator, consent) => {
      accumulator[consent.id] = parsed[consent.id] ?? consent.status;
      return accumulator;
    }, {});
  } catch {
    return Object.fromEntries(fallback.map((consent) => [consent.id, consent.status])) as Record<string, ConsentStatus>;
  }
};

const loadRequests = (fallback: DoctorRequest[]) => {
  if (typeof window === 'undefined') {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(requestStorageKey);
    if (!raw) {
      return fallback;
    }

    return JSON.parse(raw) as DoctorRequest[];
  } catch {
    return fallback;
  }
};

export default function DoctorDashboard() {
  const { activeAddress, transactionSigner } = useWallet();
  const { enqueueSnackbar } = useSnackbar();
  const [activeNav, setActiveNav] = useState('overview');
  const [activeTab, setActiveTab] = useState<ConsentTab>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [consentStatuses, setConsentStatuses] = useState<Record<string, ConsentStatus>>(() => ({}) as Record<string, ConsentStatus>);
  const [activityFeed, setActivityFeed] = useState<AuditEntry[]>(auditLog);
  const [viewerRecords, setViewerRecords] = useState<MedicalRecord[]>([]);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [shareRecord, setShareRecord] = useState<MedicalRecord | null>(null);
  const [requestPatient, setRequestPatient] = useState(DEFAULT_PATIENT.shortId);
  const [requestScope, setRequestScope] = useState('LAB_RESULTS');
  const [requestReason, setRequestReason] = useState('Requesting access for ongoing care coordination.');
  const [requestQueue, setRequestQueue] = useState<DoctorRequest[]>([]);
  const [liveRecords, setLiveRecords] = useState<MedicalRecord[]>(medicalRecords);
  const [prescriptionTarget, setPrescriptionTarget] = useState(DEFAULT_PATIENT.shortId);
  const [prescriptionMedication, setPrescriptionMedication] = useState('Amoxicillin 500mg');
  const [prescriptionDosage, setPrescriptionDosage] = useState('1 tablet three times daily for 10 days');
  const [prescriptionInstructions, setPrescriptionInstructions] = useState('Take after meals and complete the full course.');
  const [prescriptionNotes, setPrescriptionNotes] = useState('');
  const [prescriptionSubmitting, setPrescriptionSubmitting] = useState(false);
  const [prescriptionFeedback, setPrescriptionFeedback] = useState('');

  const algorand = useMemo(() => getAlgorandClientFromViteEnvironment(), []);
  const medicalAppId = Number(import.meta.env.VITE_MEDICAL_RECORDS_APP_ID || 0);

  const patient = DEFAULT_PATIENT;

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
    setConsentStatuses(loadConsentStatuses(consents));
    setRequestQueue(loadRequests([]));
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || Object.keys(consentStatuses).length === 0) {
      return;
    }

    window.localStorage.setItem(consentStorageKey, JSON.stringify(consentStatuses));
  }, [consentStatuses]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(requestStorageKey, JSON.stringify(requestQueue));
  }, [requestQueue]);

  const navLabels: Record<string, string> = {
    overview: 'Overview',
    patients: 'My Patients',
    consents: 'My Consents',
    records: 'Accessible Records',
    requests: 'New Request',
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
      revealEls.forEach((element) => element.classList.add('in'));
    } else {
      revealEls.forEach((element) => io?.observe(element));
    }

    return () => {
      io?.disconnect();
    };
  }, [activeNav]);

  const consentRows = useMemo(() => {
    return consents.map((consent) => ({
      ...consent,
      status: consentStatuses[consent.id] ?? consent.status,
    }));
  }, [consentStatuses]);

  const accessibleRecords = useMemo(() => {
    const activePatientIds = new Set(
      consentRows.filter((consent) => consent.status === 'active').map((consent) => consent.patientId)
    );

    return sortByTimeline(
      liveRecords.filter((record) => activePatientIds.has(record.patientId)),
      (record) => record.date
    );
  }, [consentRows, liveRecords]);

  const activePatients = uniqueCount(accessibleRecords, (record) => record.patientId);
  const activeConsents = consentRows.filter((consent) => consent.status === 'active').length;
  const pendingConsents = consentRows.filter((consent) => consent.status === 'pending').length;
  const expiringConsents = consentRows.filter((consent) => consent.status === 'active' && consent.remaining !== 'key dissolved').length;
  const staffCount = uniqueCount(accessibleRecords, (record) => record.uploadedBy);

  const filteredConsents = useMemo(() => {
    const query = normalizeText(searchQuery);

    return consentRows.filter((consent) => {
      const matchesTab = consent.status === activeTab;
      const matchesQuery = !query || [consent.grantedTo, consent.scopeLabel, consent.issuedAt, consent.expiresAt, consent.remaining]
        .some((value) => normalizeText(value).includes(query));

      return matchesTab && matchesQuery;
    });
  }, [activeTab, consentRows, searchQuery]);

  const filteredRecords = useMemo(() => {
    const query = normalizeText(searchQuery);

    return accessibleRecords.filter((record) => {
      if (!query) return true;

      return [record.title, record.description, record.uploadedBy, record.uploadedByRole, record.hospital, recordTypeLabel[record.type]]
        .some((value) => normalizeText(value).includes(query));
    });
  }, [accessibleRecords, searchQuery]);

  const recentRecords = filteredRecords.slice(0, 6);

  const scheduleItems = useMemo(() => {
    const upcoming = consentRows
      .filter((consent) => consent.status === 'active' || consent.status === 'pending')
      .slice(0, 3)
      .map((consent) => ({
        label: consent.scopeLabel,
        detail: consent.grantedTo,
        status: consent.status,
      }));

    const recordDriven = recentRecords.slice(0, 3).map((record) => ({
      label: record.title,
      detail: record.hospital,
      status: 'active' as const,
    }));

    return [...upcoming, ...recordDriven].slice(0, 4);
  }, [consentRows, recentRecords]);

  const openRecordViewer = useCallback(
    (record: MedicalRecord) => {
      const viewerSource = filteredRecords.length > 0 ? filteredRecords : accessibleRecords;
      const index = viewerSource.findIndex((candidate) => candidate.id === record.id);
      setViewerRecords(viewerSource);
      setViewerIndex(index >= 0 ? index : 0);
    },
    [accessibleRecords, filteredRecords]
  );

  const mutateConsent = useCallback(
    (consentId: string, nextStatus: ConsentStatus, reason: string) => {
      const consent = consentRows.find((entry) => entry.id === consentId);
      if (!consent) {
        return;
      }

      setConsentStatuses((current) => ({ ...current, [consentId]: nextStatus }));
      setActivityFeed((current) => [
        {
          id: `consent-${consentId}-${Date.now()}`,
          action: nextStatus === 'active' ? 'CONSENT_GRANT' : 'CONSENT_REVOKE',
          actor: patient.name,
          actorRole: 'Patient',
          subject: consent.grantedTo,
          detail: `${nextStatus.toUpperCase()} · ${reason} · ${consent.scopeLabel}`,
          timestamp: new Date().toLocaleString(),
          txHash: consent.txHash,
          color: nextStatus === 'active' ? 'lime' : 'coral',
        },
        ...current,
      ]);
      enqueueSnackbar(`${consent.grantedTo} consent ${nextStatus}.`, { variant: nextStatus === 'active' ? 'success' : 'warning' });
    },
    [consentRows, enqueueSnackbar, patient.name]
  );

  const submitRequest = useCallback(() => {
    const target = patients.find((candidate) => candidate.shortId === requestPatient || candidate.name === requestPatient);
    if (!target) {
      enqueueSnackbar('Select a valid patient short ID or name.', { variant: 'error' });
      return;
    }

    const nextRequest: DoctorRequest = {
      id: `req-${Date.now()}`,
      patient: target,
      scope: requestScope,
      reason: requestReason,
      status: 'pending',
      requestedAt: new Date().toLocaleString(),
    };

    setRequestQueue((current) => [nextRequest, ...current]);
    setActivityFeed((current) => [
      {
        id: `request-${nextRequest.id}`,
        action: 'REQUEST',
        actor: 'Dr. Hanwa, K.',
        actorRole: 'Clinician',
        subject: target.name,
        detail: `REQUEST · ${requestScope} · ${requestReason}`,
        timestamp: nextRequest.requestedAt,
        txHash: '',
        color: 'sky',
      },
      ...current,
    ]);

    enqueueSnackbar(`Access request queued for ${target.name}.`, { variant: 'info' });
  }, [enqueueSnackbar, requestPatient, requestReason, requestScope]);

  const updateRequestStatus = useCallback((requestId: string, nextStatus: RequestStatus) => {
    setRequestQueue((current) => current.map((request) => (request.id === requestId ? { ...request, status: nextStatus } : request)));
    setActivityFeed((current) => [
      {
        id: `req-${requestId}-${Date.now()}`,
        action: nextStatus === 'approved' ? 'CONSENT_GRANT' : 'CONSENT_REVOKE',
        actor: patient.name,
        actorRole: 'Patient',
        subject: requestId,
        detail: `${nextStatus.toUpperCase()} · clinician request`,
        timestamp: new Date().toLocaleString(),
        txHash: '',
        color: nextStatus === 'approved' ? 'lime' : 'coral',
      },
      ...current,
    ]);
  }, [patient.name]);

  const filteredRequests = requestQueue.filter((request) => {
    const query = normalizeText(searchQuery);
    if (!query) return true;

    return [request.patient.name, request.patient.shortId, request.scope, request.reason, request.status]
      .some((value) => normalizeText(value).includes(query));
  });

  const heroSummary = `${activeConsents} active consents, ${expiringConsents} expiring windows, and ${accessibleRecords.length} accessible records.`;

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
              My Patients<span className="badge">{activePatients}</span>
            </div>
            <div className={`navitem ${activeNav === 'consents' ? 'active' : ''}`} onClick={() => setActiveNav('consents')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5l-8-3Z" /></svg>
              My Consents<span className="badge">{activeConsents}</span>
            </div>
            <div className={`navitem ${activeNav === 'records' ? 'active' : ''}`} onClick={() => setActiveNav('records')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M6 3h9l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" /><path d="M14 3v4h4" /></svg>
              Accessible Records
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
              <a href="/patient" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '10px', fontSize: '12px', color: 'var(--ink-3)', fontFamily: 'var(--mono)', letterSpacing: '.1em', textTransform: 'uppercase', textDecoration: 'none' }}
                onMouseEnter={(event) => (event.currentTarget.style.color = 'var(--ink)')}
                onMouseLeave={(event) => (event.currentTarget.style.color = 'var(--ink-3)')}>
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
              <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search patients, records, consents…" />
              <span className="kbd">⌘ K</span>
            </div>
            <div className="topactions">
              <span className="chip">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 2v6a6 6 0 0 0 12 0V2" /><circle cx="18" cy="16" r="3" /></svg>
                DOC-4821
                <span className="tag" style={{ background: 'var(--coral)' }}>Clinician</span>
              </span>
              <button className="iconbtn" onClick={() => enqueueSnackbar('Clinical notifications are attached to the record queue.', { variant: 'info' })}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8" /><path d="M10 21a2 2 0 0 0 4 0" /></svg>
              </button>
              <div className="avatar" style={{ background: 'var(--coral)', color: 'var(--ink)', fontFamily: 'var(--mono)', fontSize: '13px', fontWeight: '600' }}>KH</div>
            </div>
          </div>

          <div className="content">
            <div className="hero">
              <div className="greet reveal d1">
                <div>
                  <div className="k">§ Clinician Overview · Live Snapshot</div>
                  <h2>
                    {activeConsents} consents <em>active</em>.
                    <br />{accessibleRecords.length} records in care.
                  </h2>
                  <p>{heroSummary} There are {requestQueue.filter((request) => request.status === 'pending').length} clinician requests waiting in the local queue.</p>
                </div>
                <div className="foot">
                  <button className="btn lime" onClick={() => setActiveNav('requests')}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
                    Request access
                  </button>
                  <button className="btn ghost" onClick={() => openRecordViewer(accessibleRecords[0] ?? liveRecords[0] ?? medicalRecords[0])}>View records</button>
                  <button className="btn ghost" onClick={() => setActiveNav('audit')}>My audit log</button>
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
                  <span>Patients · <em>{activePatients}</em></span>
                </div>
              </div>
            </div>

            <div className="kpis">
              <div className="kpi reveal d1" data-c="coral">
                <div className="top">
                  <div className="icn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg></div>
                  <span className="delta">{activePatients} patients</span>
                </div>
                <b>{activePatients}</b>
                <span className="lbl">My patients</span>
                <svg className="spark" viewBox="0 0 140 28" fill="none"><path d="M0 22 L20 18 L40 16 L60 12 L80 10 L100 8 L120 6 L140 4" stroke="var(--ink-green)" strokeWidth="1.5" /></svg>
              </div>
              <div className="kpi reveal d2" data-c="lime">
                <div className="top">
                  <div className="icn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5l-8-3Z" /></svg></div>
                  <span className="delta">{activeConsents} granted</span>
                </div>
                <b>{activeConsents}</b>
                <span className="lbl">Active consents</span>
                <svg className="spark" viewBox="0 0 140 28" fill="none"><path d="M0 16 L20 14 L40 10 L60 12 L80 8 L100 10 L120 6 L140 4" stroke="var(--ink-green)" strokeWidth="1.5" /></svg>
              </div>
              <div className="kpi reveal d3" data-c="sky">
                <div className="top">
                  <div className="icn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 3h9l4 4v14H5V4Z" /><path d="M14 3v4h4" /></svg></div>
                  <span className="delta">{accessibleRecords.length} visible</span>
                </div>
                <b>{accessibleRecords.length}</b>
                <span className="lbl">Records accessible</span>
                <svg className="spark" viewBox="0 0 140 28" fill="none"><path d="M0 20 L20 16 L40 14 L60 12 L80 10 L100 8 L120 6 L140 4" stroke="var(--ink-green)" strokeWidth="1.5" /></svg>
              </div>
              <div className="kpi reveal d4" data-c="violet">
                <div className="top">
                  <div className="icn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></svg></div>
                  <span className="delta">{expiringConsents} expiring</span>
                </div>
                <b>{expiringConsents}</b>
                <span className="lbl">Expiring today</span>
                <svg className="spark" viewBox="0 0 140 28" fill="none"><path d="M0 8 L20 10 L40 8 L60 10 L80 12 L100 14 L120 18 L140 22" stroke="var(--ink-green)" strokeWidth="1.5" /></svg>
              </div>
            </div>

            <div className="grid">
              <div className="card reveal d1">
                <div className="head">
                  <div>
                    <h3>My consents</h3>
                    <div className="sub" style={{ marginTop: '4px' }}>{activeConsents} active · {pendingConsents} pending</div>
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
                    {filteredConsents.map((consent) => {
                      const patientRecord = patients.find((candidate) => candidate.id === consent.patientId) ?? patient;

                      return (
                        <tr key={consent.id}>
                          <td>
                            <div className="avn">
                              <div className="av" data-c={consent.grantedToColor}>{makeInitials(patientRecord.name)}</div>
                              <div>
                                <div className="nm">{patientRecord.name}</div>
                                <div className="rl">{patientRecord.shortId}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--ink-2)', letterSpacing: '.06em' }}>{consent.scopeLabel}</td>
                          <td><span className={`pill-s ${consent.status}`}>{consent.status}</span></td>
                          <td>
                            {consent.status === 'active' ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <span style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--ink)' }}>{consent.remaining}</span>
                                <div className="meter"><i style={{ width: `${consent.progressPct}%` }} /></div>
                              </div>
                            ) : (
                              <span style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--ink-3)' }}>{consent.remaining}</span>
                            )}
                          </td>
                          <td className="actions-cell">
                            {consent.status === 'active' && (
                              <button className="ibtn danger" title="Revoke consent" onClick={() => mutateConsent(consent.id, 'expired', 'Revoked from clinician dashboard')}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
                              </button>
                            )}
                            {consent.status === 'pending' && (
                              <button className="ibtn" title="Approve consent" onClick={() => mutateConsent(consent.id, 'active', 'Approved from clinician dashboard')}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 12 2 2 4-4" /></svg>
                              </button>
                            )}
                            {consent.status === 'expired' && (
                              <button className="ibtn" title="Renew consent" onClick={() => mutateConsent(consent.id, 'active', 'Renewed from clinician dashboard')}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 0 1 15.95-5.67L21 9" /><path d="M21 3v6h-6" /><path d="M21 12a9 9 0 0 1-15.95 5.67L3 15" /><path d="M3 21v-6h6" /></svg>
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
                    <h3>Request queue</h3>
                    <div className="sub" style={{ marginTop: '4px' }}>{requestQueue.length} local requests · {requestQueue.filter((request) => request.status === 'pending').length} pending</div>
                  </div>
                </div>
                <div className="requests">
                  <div className="req" style={{ cursor: 'default' }}>
                    <div className="av" data-c="coral" style={{ width: '40px', height: '40px', borderRadius: '12px', flexShrink: 0 }}>DR</div>
                    <div className="body" style={{ display: 'grid', gap: '6px' }}>
                      <div className="t">Submit a new request</div>
                      <div className="d">SEND ACCESS REQUEST · CARE COORDINATION</div>
                      <div style={{ display: 'grid', gap: '8px' }}>
                        <input value={requestPatient} onChange={(event) => setRequestPatient(event.target.value)} placeholder="Patient short ID or name" style={{ width: '100%', padding: '10px 12px', borderRadius: '12px', border: '1px solid var(--line)', background: 'var(--bg)', fontSize: '12px' }} />
                        <input value={requestScope} onChange={(event) => setRequestScope(event.target.value)} placeholder="Scope (for example LAB_RESULTS)" style={{ width: '100%', padding: '10px 12px', borderRadius: '12px', border: '1px solid var(--line)', background: 'var(--bg)', fontSize: '12px' }} />
                        <textarea value={requestReason} onChange={(event) => setRequestReason(event.target.value)} rows={3} placeholder="Reason for the request" style={{ width: '100%', padding: '10px 12px', borderRadius: '12px', border: '1px solid var(--line)', background: 'var(--bg)', fontSize: '12px', resize: 'vertical' }} />
                      </div>
                    </div>
                    <div className="acts">
                      <button className="approve" onClick={submitRequest}>Submit</button>
                    </div>
                  </div>

                  {filteredRequests.length > 0 ? filteredRequests.map((request) => (
                    <div className="req" key={request.id}>
                      <div className="av" data-c={request.status === 'approved' ? 'lime' : request.status === 'rejected' ? 'coral' : 'sky'} style={{ width: '40px', height: '40px', borderRadius: '12px', flexShrink: 0 }}>{makeInitials(request.patient.name)}</div>
                      <div className="body">
                        <div className="t">{request.patient.name}</div>
                        <div className="d">{request.scope}</div>
                        <div style={{ fontFamily: 'var(--mono)', fontSize: '9px', color: 'var(--ink-3)', letterSpacing: '.1em', marginTop: '4px' }}>{request.reason}</div>
                      </div>
                      <div className="acts">
                        {request.status === 'pending' ? (
                          <>
                            <button className="approve" onClick={() => updateRequestStatus(request.id, 'approved')}>Allow</button>
                            <button className="deny" onClick={() => updateRequestStatus(request.id, 'rejected')}>Deny</button>
                          </>
                        ) : (
                          <button className={request.status === 'approved' ? 'approve' : 'deny'}>{request.status}</button>
                        )}
                      </div>
                    </div>
                  )) : (
                    <div className="req" style={{ cursor: 'default' }}>
                      <div className="av" data-c="sky" style={{ width: '40px', height: '40px', borderRadius: '12px', flexShrink: 0 }}>--</div>
                      <div className="body">
                        <div className="t">No pending clinician requests</div>
                        <div className="d">QUEUE IS EMPTY</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="card reveal d3">
                <div className="head">
                  <div>
                    <h3>Prescription upload</h3>
                    <div className="sub" style={{ marginTop: '4px' }}>Encrypt a prescription, pin it to IPFS, and anchor it on-chain by patient ID.</div>
                  </div>
                </div>
                <div style={{ display: 'grid', gap: '10px' }}>
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

            <div className="grid">
              <div className="card reveal d2">
                <div className="head">
                  <div>
                    <h3>Accessible records</h3>
                    <div className="sub" style={{ marginTop: '4px' }}>{accessibleRecords.length} consent-gated records</div>
                  </div>
                </div>
                <div className="recs">
                  {recentRecords.map((record) => {
                    const patientRecord = patients.find((candidate) => candidate.id === record.patientId) ?? patient;

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
                          <span className="chip-s">{recordTypeLabel[record.type]}</span>
                        </div>
                        <h4>{record.title}</h4>
                        <p>{patientRecord.name}</p>
                        <div className="cid">{record.ipfsHash}</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px' }}>
                          <button className="ibtn" title="Share record" onClick={(event) => { event.stopPropagation(); setShareRecord(record); }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="3" height="9" /><rect x="9.5" y="7" width="3" height="13" /><rect x="16" y="4" width="3" height="16" /></svg>
                          </button>
                          <button className="ibtn" title="Open record" onClick={(event) => { event.stopPropagation(); openRecordViewer(record); }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
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
                    <h3>Schedule and audit</h3>
                    <div className="sub" style={{ marginTop: '4px' }}>{activityFeed.length} activity events</div>
                  </div>
                </div>
                <div className="audit">
                  {scheduleItems.map((item, index) => (
                    <div className="audit-item" key={`${item.label}-${index}`}>
                      <div className="pin" data-c={item.status === 'pending' ? 'sun' : 'lime'} />
                      <div className="body">
                        <div className="t"><em>{item.label}</em></div>
                        <div className="d">{item.detail}</div>
                      </div>
                      <time>{item.status}</time>
                    </div>
                  ))}
                  {activityFeed.slice(0, 4).map((entry) => (
                    <div className="audit-item" key={entry.id}>
                      <div className="pin" data-c={entry.color} />
                      <div className="body">
                        <div className="t"><em>{entry.actor}</em> · {entry.subject}</div>
                        <div className="d">{entry.detail}</div>
                      </div>
                      <time>{entry.timestamp}</time>
                    </div>
                  ))}
                </div>
              </div>
            </div>
              </>
            ) : renderDoctorTabContent()}
          </div>
        </main>
      </div>

      {viewerRecords.length > 0 && (
        <RecordSlider
          records={viewerRecords}
          initialIndex={viewerIndex}
          onClose={() => setViewerRecords([])}
          onShare={(record) => setShareRecord(record)}
        />
      )}

      {shareRecord && (
        <QRModal
          record={shareRecord}
          patient={patients.find((candidate) => candidate.id === shareRecord.patientId) ?? patient}
          onClose={() => setShareRecord(null)}
        />
      )}
    </div>
  );
}
