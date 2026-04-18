export type RecordType = 'lab' | 'imaging' | 'prescription' | 'discharge' | 'vaccination' | 'vitals';
export type ConsentStatus = 'active' | 'pending' | 'expired' | 'revoked';
export type AuditAction = 'READ' | 'WRITE' | 'CONSENT_GRANT' | 'CONSENT_REVOKE' | 'REQUEST' | 'REGISTER';

export interface Patient {
  id: string;
  name: string;
  shortId: string;
  walletAddress: string;
  dob: string;
  bloodGroup: string;
  allergies: string[];
  since: string;
  avatar: string;
  avatarColor: string;
}

export interface MedicalRecord {
  id: string;
  patientId: string;
  type: RecordType;
  title: string;
  description: string;
  uploadedBy: string;
  uploadedByRole: string;
  hospital: string;
  date: string;
  ipfsHash: string;
  txHash: string;
  blockHeight: number;
  encrypted: boolean;
  size: string;
  tags: string[];
  color: string;
}

export interface Consent {
  id: string;
  patientId: string;
  grantedTo: string;
  grantedToRole: string;
  grantedToAvatar: string;
  grantedToColor: string;
  scope: string;
  scopeLabel: string;
  status: ConsentStatus;
  issuedAt: string;
  expiresAt: string;
  remaining: string;
  progressPct: number;
  txHash: string;
}

export interface AuditEntry {
  id: string;
  action: AuditAction;
  actor: string;
  actorRole: string;
  subject: string;
  detail: string;
  timestamp: string;
  txHash: string;
  color: 'lime' | 'coral' | 'sky' | 'violet' | 'sun';
}

export interface InboundRequest {
  id: string;
  from: string;
  fromRole: string;
  fromAvatar: string;
  fromColor: string;
  scope: string;
  reason: string;
  urgency: 'routine' | 'urgent' | 'emergency';
  requestedAt: string;
}

// ─── Patients ────────────────────────────────────────────────────────────────
export const patients: Patient[] = [
  { id: 'p1', name: 'Ishaan Kapoor', shortId: '847KOR', walletAddress: '0xA1B2C3D4E5F6a1b2c3d4e5f6A1B2C3D4E5F6A1B2', dob: '14 Mar 1994', bloodGroup: 'O+', allergies: ['Penicillin', 'Latex'], since: 'Mar 2026', avatar: 'IK', avatarColor: 'lime' },
  { id: 'p2', name: 'Priya Rajan', shortId: '512RAJ', walletAddress: '0xB2C3D4E5F6A1b2c3d4e5f6A1B2C3D4E5F6A1B2C3', dob: '28 Jul 1989', bloodGroup: 'A-', allergies: ['Sulfa'], since: 'Jan 2026', avatar: 'PR', avatarColor: 'coral' },
  { id: 'p3', name: 'Arjun Mehta', shortId: '391MEH', walletAddress: '0xC3D4E5F6A1B2c3d4e5f6A1B2C3D4E5F6A1B2C3D4', dob: '02 Nov 1997', bloodGroup: 'B+', allergies: [], since: 'Apr 2026', avatar: 'AM', avatarColor: 'sky' },
  { id: 'p4', name: 'Sneha Verma', shortId: '204VER', walletAddress: '0xD4E5F6A1B2C3d4e5f6A1B2C3D4E5F6A1B2C3D4E5', dob: '19 Feb 1992', bloodGroup: 'AB+', allergies: ['Aspirin'], since: 'Feb 2026', avatar: 'SV', avatarColor: 'sun' },
  { id: 'p5', name: 'Rohan Nair', shortId: '768NAI', walletAddress: '0xE5F6A1B2C3D4e5f6A1B2C3D4E5F6A1B2C3D4E5F6', dob: '07 Aug 1986', bloodGroup: 'O-', allergies: ['Ibuprofen'], since: 'Dec 2025', avatar: 'RN', avatarColor: 'violet' },
];

// ─── Medical Records ──────────────────────────────────────────────────────────
export const medicalRecords: MedicalRecord[] = [
  {
    id: 'r1', patientId: 'p1', type: 'lab', title: 'CBC & Metabolic Panel', description: 'Complete blood count with comprehensive metabolic panel. WBC 6.2, RBC 4.9, HGB 14.8 g/dL. All values within normal range. Kidney and liver function normal.',
    uploadedBy: 'Dr. Hanwa, K.', uploadedByRole: 'Clinician', hospital: 'Helix Hospital', date: '18 Apr 2026', ipfsHash: 'QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco', txHash: '0x4f7a8b2c...d3e1f9a0', blockHeight: 29184201, encrypted: true, size: '48 KB', tags: ['Routine', 'Blood', 'Metabolic'], color: 'lime',
  },
  {
    id: 'r2', patientId: 'p1', type: 'imaging', title: 'Chest X-Ray (PA view)', description: 'Posteroanterior chest radiograph. Lung fields clear bilaterally. No consolidation, effusion, or pneumothorax. Heart size normal. No acute cardiopulmonary process identified.',
    uploadedBy: 'Dr. Seth, A.', uploadedByRole: 'Radiologist', hospital: 'Helix Hospital', date: '12 Apr 2026', ipfsHash: 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG', txHash: '0x3e6b9d1f...c2a0e8b7', blockHeight: 29180144, encrypted: true, size: '2.1 MB', tags: ['Imaging', 'Chest', 'X-Ray'], color: 'coral',
  },
  {
    id: 'r3', patientId: 'p1', type: 'prescription', title: 'Prescription — Amoxicillin 500mg', description: 'Prescribed for bacterial sinusitis. Amoxicillin 500mg TID for 10 days. Patient counselled on completing full course. Follow-up in 2 weeks if symptoms persist.',
    uploadedBy: 'Dr. Hanwa, K.', uploadedByRole: 'Clinician', hospital: 'Helix Hospital', date: '15 Apr 2026', ipfsHash: 'QmZbV4DkMnUhTMJtdqASPZp8hfR9NZpZd3mhwx1vvYKLR7', txHash: '0x1c4d7e9a...b5f2c0d8', blockHeight: 29181992, encrypted: true, size: '12 KB', tags: ['Prescription', 'Antibiotic'], color: 'sky',
  },
  {
    id: 'r4', patientId: 'p1', type: 'vitals', title: 'Vitals — OPD Visit', description: 'BP: 118/76 mmHg. HR: 72 bpm. SpO2: 98%. Temp: 37.1°C. Weight: 71kg. BMI: 23.4. All vitals stable and within acceptable range.',
    uploadedBy: 'Nurse Preet', uploadedByRole: 'Nursing', hospital: 'Helix Hospital', date: '18 Apr 2026', ipfsHash: 'QmNkDtpJ8eF2qWnM3xKvR7sLmY9oTzX6cBgV1hAiU4pZeQ', txHash: '0x7d2e5f1b...a8c3d9e6', blockHeight: 29184198, encrypted: false, size: '4 KB', tags: ['Vitals', 'OPD'], color: 'lime',
  },
  {
    id: 'r5', patientId: 'p1', type: 'vaccination', title: 'COVID-19 Booster (Dose 3)', description: 'mRNA booster administered. Covishield batch #HX2024-B3. No immediate adverse reaction. Patient advised to monitor for 30 minutes post-injection. Next due: Annual flu vaccine Oct 2026.',
    uploadedBy: 'Nurse Preet', uploadedByRole: 'Nursing', hospital: 'Helix Hospital', date: '01 Jan 2026', ipfsHash: 'QmRvLmWpCxD4KzN7oFbT8gPeS1jYhAuZ9qMnX3wBiV6tRa', txHash: '0x9a1b3c5d...e7f0g2h4', blockHeight: 29120050, encrypted: false, size: '8 KB', tags: ['Vaccination', 'COVID-19'], color: 'violet',
  },
  {
    id: 'r6', patientId: 'p1', type: 'discharge', title: 'Discharge Summary — Appendectomy', description: 'Laparoscopic appendectomy performed successfully. Pre-op diagnosis: Acute appendicitis. Post-op: Uneventful recovery. Discharged on post-op day 2. Follow-up at 1 week for wound inspection.',
    uploadedBy: 'Dr. Patel, S.', uploadedByRole: 'Surgeon', hospital: 'Helix Hospital', date: '15 Mar 2026', ipfsHash: 'QmTkJpBfWcM8NvQ5xHaR2eLgY7sDuX9oFbZ4nAiV1pKmCw', txHash: '0x2b4c6d8e...f0a1b3c5', blockHeight: 29165780, encrypted: true, size: '28 KB', tags: ['Discharge', 'Surgery'], color: 'coral',
  },
];

// ─── Active Consents ──────────────────────────────────────────────────────────
export const consents: Consent[] = [
  { id: 'c1', patientId: 'p1', grantedTo: 'Helix Hospital', grantedToRole: 'Institutional', grantedToAvatar: 'HX', grantedToColor: 'lime', scope: 'LAB_RESULTS', scopeLabel: 'LAB RESULTS · 48H', status: 'active', issuedAt: '16 Apr 2026, 14:00', expiresAt: '18 Apr 2026, 14:00', remaining: '32h 14m', progressPct: 68, txHash: '0x4a7b2c9d...e1f3a0b5' },
  { id: 'c2', patientId: 'p1', grantedTo: 'Dr. Hanwa, K.', grantedToRole: 'Clinician', grantedToAvatar: 'DR', grantedToColor: 'coral', scope: 'IMAGING', scopeLabel: 'IMAGING · 2H', status: 'active', issuedAt: '18 Apr 2026, 12:00', expiresAt: '18 Apr 2026, 14:00', remaining: '1h 04m', progressPct: 52, txHash: '0x1d3e5f7a...b9c0d2e4' },
  { id: 'c3', patientId: 'p1', grantedTo: 'Meridian Labs', grantedToRole: 'Diagnostics', grantedToAvatar: 'LB', grantedToColor: 'sky', scope: 'PROFILE_READ', scopeLabel: 'PROFILE READ · PENDING', status: 'pending', issuedAt: '—', expiresAt: '—', remaining: 'awaiting signature', progressPct: 0, txHash: '' },
  { id: 'c4', patientId: 'p1', grantedTo: 'Nil Pharmacy', grantedToRole: 'Dispensary', grantedToAvatar: 'PH', grantedToColor: 'sun', scope: 'RX_VIEW', scopeLabel: 'DISPENSING · 24H', status: 'active', issuedAt: '17 Apr 2026, 20:00', expiresAt: '18 Apr 2026, 20:00', remaining: '18h 40m', progressPct: 78, txHash: '0x8f1a2b3c...d4e5f6g7' },
  { id: 'c5', patientId: 'p1', grantedTo: 'Arc Insurance', grantedToRole: 'Payor', grantedToAvatar: 'IN', grantedToColor: 'violet', scope: 'CLAIM_REVIEW', scopeLabel: 'CLAIM REVIEW · EXPIRED', status: 'expired', issuedAt: '11 Apr 2026, 09:00', expiresAt: '18 Apr 2026, 09:00', remaining: 'key dissolved', progressPct: 0, txHash: '0x5e6f7a8b...c9d0e1f2' },
];

// ─── Audit Log ────────────────────────────────────────────────────────────────
export const auditLog: AuditEntry[] = [
  { id: 'a1', action: 'READ', actor: 'Dr. Hanwa, K.', actorRole: 'Clinician', subject: 'CBC & Metabolic Panel', detail: 'READ · LAB_RESULTS · r1', timestamp: '18 Apr 2026, 14:32', txHash: '0xab12cd34...ef56gh78', color: 'lime' },
  { id: 'a2', action: 'WRITE', actor: 'Dr. Seth, A.', actorRole: 'Radiologist', subject: 'Chest X-Ray (PA view)', detail: 'WRITE · IMAGING · r2', timestamp: '12 Apr 2026, 13:18', txHash: '0xcd34ef56...gh78ij90', color: 'sky' },
  { id: 'a3', action: 'CONSENT_GRANT', actor: 'Ishaan Kapoor', actorRole: 'Patient', subject: 'Helix Hospital', detail: 'CONSENT · LAB_RESULTS · 48H', timestamp: '16 Apr 2026, 14:00', txHash: '0xef56gh78...ij90kl12', color: 'lime' },
  { id: 'a4', action: 'REQUEST', actor: 'Meridian Labs', actorRole: 'Diagnostics', subject: 'Profile Read', detail: 'REQUEST · PROFILE_READ · PENDING', timestamp: '18 Apr 2026, 11:55', txHash: '', color: 'coral' },
  { id: 'a5', action: 'CONSENT_REVOKE', actor: 'Ishaan Kapoor', actorRole: 'Patient', subject: 'Arc Insurance', detail: 'REVOKE · CLAIM_REVIEW · EXPIRED', timestamp: '18 Apr 2026, 09:00', txHash: '0xgh78ij90...kl12mn34', color: 'violet' },
  { id: 'a6', action: 'WRITE', actor: 'Nurse Preet', actorRole: 'Nursing', subject: 'Vitals — OPD Visit', detail: 'WRITE · VITALS · r4', timestamp: '18 Apr 2026, 09:15', txHash: '0xij90kl12...mn34op56', color: 'sky' },
  { id: 'a7', action: 'READ', actor: 'Nil Pharmacy', actorRole: 'Dispensary', subject: 'Prescription', detail: 'READ · RX_VIEW · r3', timestamp: '17 Apr 2026, 21:10', txHash: '0xkl12mn34...op56qr78', color: 'lime' },
];

// ─── Inbound Requests ─────────────────────────────────────────────────────────
export const inboundRequests: InboundRequest[] = [
  { id: 'req1', from: 'Meridian Labs', fromRole: 'Diagnostics', fromAvatar: 'ML', fromColor: 'sky', scope: 'PROFILE READ · 72H', reason: 'Pre-operative blood work screening required for scheduled procedure.', urgency: 'routine', requestedAt: '18 Apr 2026, 11:55' },
  { id: 'req2', from: 'Dr. Hanwa, K.', fromRole: 'Clinician', fromAvatar: 'KH', fromColor: 'coral', scope: 'FULL CHART · 24H', reason: 'Emergency follow-up consultation — reviewing complete history for medication adjustment.', urgency: 'urgent', requestedAt: '18 Apr 2026, 13:40' },
  { id: 'req3', from: 'Arc Insurance', fromRole: 'Payor', fromAvatar: 'AI', fromColor: 'violet', scope: 'CLAIM REVIEW · 7D', reason: 'Annual health insurance policy renewal — claim verification.', urgency: 'routine', requestedAt: '17 Apr 2026, 10:00' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
export const getRecordsByPatient = (patientId: string) =>
  medicalRecords.filter((r) => r.patientId === patientId);

export const getConsentsByPatient = (patientId: string) =>
  consents.filter((c) => c.patientId === patientId);

export const getAuditByPatient = (_patientId: string) => auditLog;

export const getPatientById = (id: string) =>
  patients.find((p) => p.id === id) ?? patients[0];

export const recordTypeLabel: Record<RecordType, string> = {
  lab: 'Lab Results',
  imaging: 'Imaging',
  prescription: 'Prescription',
  discharge: 'Discharge Summary',
  vaccination: 'Vaccination',
  vitals: 'Vitals',
};

export const recordTypeIcon: Record<RecordType, string> = {
  lab: 'M10 2v6L4 18a2 2 0 0 0 2 3h12a2 2 0 0 0 2-3L14 8V2',
  imaging: 'M3 3h18v18H3z M3 9h18 M9 9v12',
  prescription: 'M6 3h9l4 4v14H5V4z M14 3v4h4',
  discharge: 'M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18 M3 9h18',
  vaccination: 'M12 2v4 M12 18v4 M4.93 4.93l2.83 2.83 M16.24 16.24l2.83 2.83 M2 12h4 M18 12h4',
  vitals: 'M3 12h4l3-9 4 18 3-9h4',
};
