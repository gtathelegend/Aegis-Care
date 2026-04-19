# Aegis Care — Component & Implementation Analysis

## Table of Contents
1. [Project Structure Overview](#project-structure-overview)
2. [Frontend (Next.js)](#frontend-nextjs)
   - [Pages](#pages)
   - [Components](#components)
   - [Mock Database](#mock-database)
   - [IPFS Integration](#ipfs-integration)
3. [Smart Contracts (Algorand)](#smart-contracts-algorand)
4. [Deployment Architecture](#deployment-architecture)
5. [Key Data Flows](#key-data-flows)
6. [Configuration](#configuration)
7. [Notable Implementation Details](#notable-implementation-details)

---

## Project Structure Overview

```
Aegis-Care/
├── frontend/                          # Next.js 14 patient/provider portal
│   ├── app/
│   │   ├── landing/page.tsx           # Marketing/entry page
│   │   ├── patient-dashboard/page.tsx # Patient portal
│   │   ├── doctor-dashboard/page.tsx  # Doctor portal
│   │   └── hospital-dashboard/page.tsx# Hospital portal
│   ├── components/
│   │   ├── ShareModal.tsx             # Record sharing with consent creation
│   │   ├── QRModal.tsx                # QR code for record sharing
│   │   └── RecordSlider.tsx           # Full-screen record browser
│   └── lib/
│       ├── mockdb.ts                  # In-memory state + helpers
│       └── ipfs.ts                    # Pinata IPFS integration
│
└── projects/
    ├── aegis-contracts/               # Algorand smart contracts (Python/Puya)
    │   ├── smart_contracts/
    │   │   ├── AccessControl/contract.py
    │   │   ├── HealthcareRBAC/contract.py
    │   │   ├── MedicalRecords/contract.py
    │   │   ├── AuditLog/contract.py
    │   │   ├── DataAccessManager/contract.py
    │   │   ├── DataFiduciaryRegistry/contract.py
    │   │   ├── QueueManager/contract.py
    │   │   ├── VolunteerRegistry/contract.py
    │   │   ├── WalletMapper/contract.py
    │   │   └── consent_manager/contract.py
    │   └── scripts/deploy_all.ts      # Deployment orchestrator
    │
    └── aegis-frontend/                # Vite/React blockchain-connected frontend
        └── src/
            ├── pages/                 # DoctorDashboard, HospitalPortal, Landing, etc.
            ├── components/            # ConnectWallet, DashboardShell, Sidebar
            └── hooks/useRole.ts       # Wallet role resolution
```

---

## Frontend (Next.js)

**Stack:** Next.js 14.2.5 · React 18.3.1 · TypeScript 5.5.4 · Tailwind CSS  
**Dev port:** 5000 (host `0.0.0.0`)  
**Entry:** `app/page.tsx` → redirects to `/landing`

---

### Pages

#### Patient Dashboard (`app/patient-dashboard/page.tsx`)

The primary patient portal. All state is local (React hooks) with mock data from `mockdb.ts`.

**Navigation sections:**
| Section | Description |
|---------|-------------|
| Overview | KPIs, active consents summary, inbound requests |
| Records | 12 medical records with type filtering |
| Consents | 5 active permissions with progress bars and revoke/extend |
| Audit Trail | Last 6 color-coded access events |
| Vault | Data storage view |
| Hospitals/Research | Registry views |
| Settings | Account settings |

**Key UI mechanics:**
- `IntersectionObserver` triggers CSS reveal animations on scroll; respects `prefers-reduced-motion`
- Parallax blob backgrounds computed from `window.scrollY` on `scroll` event
- Inbound access requests polled every **2 seconds** via `setInterval` + `getPendingAccessRequestsByPatient()`
- Record slider opened via `RecordSlider` component (keyboard + touch swipe navigation)
- QR share opened via `QRModal` component

**KPI bar (hardcoded):**
```
5 Active Consents | 12 On-chain Records | 0 Silent Reads | 3.3s Settlement
```

**Active consents table columns:** Requester · Scope · Status · Remaining (progress bar) · Actions (Extend / Revoke)

**Inbound requests card:** Shows pending requests with Approve / Deny buttons that call `updateAccessRequestStatus()`.

---

#### Doctor Dashboard (`app/doctor-dashboard/page.tsx`)

Clinical provider view.

**Navigation sections:**
| Section | Description |
|---------|-------------|
| Overview | 6 active consents, 18 patients, 14 accessible records |
| My Patients | Patient list with last visit and consent status |
| My Consents | Active consent grants from patients |
| Accessible Records | Consent-gated record table |
| Upload Prescription | IPFS upload form |
| New Request | Submit access request to a patient |
| Schedule | Appointment management |
| My Audit Trail | Doctor's access log |
| Settings | Clinical alerts, session timeout |

**Upload Record Form:**
```
Patient ID (dropdown) → Record Type → Title → Bill amount (μAlgos, optional)
→ File drag-and-drop (PDF/JPG/PNG/DICOM)
→ uploadToPinata() → /api/upload → Pinata
→ addRecord() → mockdb
→ addAuditEntry() → audit trail
→ 2-second success toast
```

**Accessible Records table columns:** Type · Title · Patient · Date · Size · IPFS Hash

Records filtered to current doctor (`Dr. Hanwa, K.`).

---

#### Hospital Dashboard (`app/hospital-dashboard/page.tsx`)

Institutional view for hospital staff.

**Navigation sections:**
| Section | Description |
|---------|-------------|
| Patient Registry | Active and recently onboarded patients |
| Access Requests | Approval/rejection workflow queue |
| Records | Consent-gated documents |
| Prescription Queue | Pending and dispensed prescriptions |
| Audit Log | Institution-level access log |
| Staff | Staff management |
| Compliance | Compliance reports |
| Settings | Hospital settings |

**Prescription Queue:** `PrescriptionModal` component allows viewing prescription details and marking dispensed with a bill amount. Calls `markPrescriptionDispensed(id)` on confirmation.

---

### Components

#### ShareModal (`components/ShareModal.tsx`)

**Props:** `record: MedicalRecord | null`, `onClose: () => void`, `onSuccess: (consent: Consent) => void`, `patientName: string`

**Behavior:**
- Provider selection dropdown (sourced from mockdb providers list)
- Scope auto-derived from record type: `lab → LAB_RESULTS`, `imaging → IMAGING`, etc.
- Duration options: 1h · 6h · 24h · 48h · 7d
- Optional purpose textarea
- On submit: validates selection → calculates expiry → `addConsent()` → `addAuditEntry()` → `onSuccess(consent)`
- Loading state shown during async grant

---

#### QRModal (`components/QRModal.tsx`)

**Props:** `record: MedicalRecord | null`, `patient: Patient`, `onClose: () => void`

**Behavior:**
- Generates share URL using patient's `shortId`
- Renders `QRCodeSVG` (from `qrcode.react`)
- Copy-to-clipboard button via `navigator.clipboard.writeText()`
- Share metadata (record type, patient name, short ID) displayed below QR

---

#### RecordSlider (`components/RecordSlider.tsx`)

**Props:** `records: MedicalRecord[]`, `initialIndex: number`, `onClose: () => void`, `onShare: (record: MedicalRecord) => void`

**Behavior:**
- Full-screen modal
- **Keyboard:** `ArrowLeft` / `ArrowRight` to navigate, `Escape` to close
- **Touch:** Horizontal drag with 52px threshold triggers slide
- Transitions: 260ms with direction-based animation
- Metadata grid: Date · Uploaded by · Role · Hospital · Size · Encryption
- On-chain data: IPFS hash · Tx hash · Block height
- Tags displayed as chips
- Navigation dots (current record indicator)
- Side arrows disabled at boundaries
- Type icons per category (lab, imaging, prescription, discharge, vaccination, vitals)
- Color-coded by record type

---

### Mock Database (`lib/mockdb.ts`)

In-memory state store simulating a backend. Uses `let` mutable arrays so state persists across component re-renders within a session.

**Type definitions:**

| Type | Key Fields |
|------|-----------|
| `Patient` | id, name, shortId, walletAddress, dob, bloodGroup, allergies, avatarColor |
| `MedicalRecord` | id, patientId, type, title, ipfsHash, txHash, blockHeight, encrypted, uploadedBy, uploadedByRole |
| `Consent` | id, patientId, grantedTo, grantedToRole, scope, scopeLabel, status, issuedAt, expiresAt, remaining, progressPct |
| `AuditEntry` | id, action (READ/WRITE/CONSENT_GRANT/CONSENT_REVOKE/REQUEST/REGISTER), actor, actorRole, subject, detail, txHash |
| `InboundRequest` | id, from, fromRole, scope, reason, urgency, requestedAt |
| `PrescriptionQueueItem` | id, patientId, medication, dosage, instructions, prescribedBy, cid, status |
| `AccessRequest` | id, fromDoctor, targetPatientId, scope, purpose, submittedAt, status |

**Sample seed data:**
- 5 patients: Ishaan Kapoor, Priya Rajan, Arjun Mehta, Sneha Verma, Rohan Nair
- 6 medical records, 5 active consents, 7 audit entries, 3 inbound requests

**Helper functions:**

| Function | Description |
|----------|-------------|
| `getRecordsByPatient(patientId)` | Filter records by patient |
| `getConsentsByPatient(patientId)` | Filter consents by patient |
| `getMutableRecords()` / `getMutableConsents()` | Return live mutable arrays |
| `addRecord(record)` | Append record with generated ID |
| `addConsent(consent)` | Create consent entry |
| `addPrescription(item)` | Queue prescription |
| `markPrescriptionDispensed(id)` | Update prescription to dispensed |
| `addAuditEntry(entry)` | Append audit log entry |
| `addAccessRequest(req)` | Create pending access request |
| `updateAccessRequestStatus(id, status)` | Approve or deny request |
| `getPendingAccessRequestsByPatient(patientId)` | Pending requests for a patient |

---

### IPFS Integration (`lib/ipfs.ts`)

Pinata-based IPFS gateway.

| Function | Description |
|----------|-------------|
| `uploadToPinata(file, metadata)` | POST to `/api/upload` → Pinata; returns IPFS hash |
| `getIpfsGatewayUrl(hash)` | Build Pinata gateway URL from hash |
| `formatIpfsHash(hash)` | Truncate hash for display |
| `isValidIpfsHash(hash)` | Validate CIDv0 (`Qm…`) or CIDv1 (`baf…`) |

Environment variable: `NEXT_PUBLIC_PINATA_GATEWAY` (defaults to `https://gateway.pinata.cloud`)

---

## Smart Contracts (Algorand)

All contracts written in **Python (Puya)** and compiled to TEAL via AlgoKit. Data storage uses Algorand **BoxMaps** for dynamic arrays and efficient lookups.

---

### 1. AuditLog (`AuditLog/contract.py`)

Write-only event bus. All other contracts call it via inner transactions.

**ARC-28 Events:**

| Event | Parameters |
|-------|-----------|
| `ConsentGranted` | data_principal, fiduciary, purpose, expiry, scopes |
| `ConsentRevoked` | data_principal, fiduciary, timestamp |
| `DataAccessed` | data_principal, fiduciary, purpose, timestamp, is_emergency |
| `AccessRequested` | data_principal, fiduciary, purpose, timestamp |
| `ErasureRequested` | data_principal, timestamp |

**Methods:** `log_consent_granted`, `log_consent_revoked`, `log_data_accessed`, `log_access_requested`, `log_erasure_requested`

---

### 2. MedicalRecords (`MedicalRecords/contract.py`)

Central record repository. Stores IPFS CIDs on-chain with patient metadata.

**Global State:**
- `record_counter: UInt64` — auto-incrementing record IDs
- `audit_app: UInt64` — reference to AuditLog app ID
- `queue_length: UInt64` — prescription queue size

**Box Storage:**
- `patient_records: BoxMap[Address → DynamicArray[Record]]`
- `prescription_queue: BoxMap[UInt64 → PrescriptionQueueItem]`

**Record struct:**
```python
class Record:
    id: UInt64
    patient: Address
    provider: Address
    cid: String           # IPFS content hash
    previous_cid: String  # Version chain
    record_type: String
    timestamp: UInt64
    bill_amount: UInt64
```

**PrescriptionQueueItem struct:**
```python
class PrescriptionQueueItem:
    record_id: UInt64
    patient: Address
    patient_name: String
    cid: String
    is_dispensed: Bool
    bill_amount: UInt64
```

**Methods:**

| Method | Description |
|--------|-------------|
| `bootstrap(audit_app_id)` | Link AuditLog (called once post-deploy) |
| `add_record(patient, cid, previous_cid, record_type, bill_amount)` | Upload record; logs to AuditLog via inner txn; emits `RecordAdded` |
| `add_prescription(patient, patient_name, cid)` | Queue prescription; emits `PrescriptionAddedToQueue` |
| `get_pending_prescriptions()` | Return non-dispensed items |
| `mark_prescription_dispensed(record_id, bill_amount)` | Update queue + patient history; emits `PrescriptionDispensed` |
| `get_patient_records(patient)` | Retrieve full record history |

---

### 3. ConsentManager (`consent_manager/contract.py`)

Manages the full lifecycle of patient data consent including GDPR erasure.

**Box Storage:**
- `consents: BoxMap[Address → DynamicArray[Consent]]`
- `access_requests: BoxMap[Address → DynamicArray[AccessRequest]]`

**Consent struct:**
```python
class Consent:
    data_principal: Address  # Patient
    data_fiduciary: Address  # Provider
    purpose: String
    data_hash: String        # IPFS reference
    data_scope: String
    granted_at: UInt64
    expiry: UInt64
    is_active: Bool
    erased: Bool             # GDPR right to be forgotten
```

**Methods:**

| Method | Description |
|--------|-------------|
| `grant_consent(fiduciary, purpose, data_hash, data_scope, duration_in_seconds)` | Patient grants time-limited access |
| `revoke_consent(index)` | Patient sets `is_active = False` |
| `request_erasure(index)` | GDPR erasure; overwrites fields with `"ERASED"` |
| `validate_consent(principal, index, required_scope)` | Checks: active + not erased + not expired + scope match |
| `update_consent_duration(index, new_duration_in_seconds)` | Extend consent expiry |
| `request_access(patient, purpose)` | Provider creates pending `AccessRequest` |
| `get_pending_requests(patient)` | List pending requests for patient |
| `approve_request(request_id, data_hash, data_scope, duration_in_seconds)` | Patient approves → creates `Consent` |
| `reject_request(request_id)` | Patient rejects request |
| `get_patient_consents(patient)` | Retrieve all consents |

---

### 4. DataAccessManager (`DataAccessManager/contract.py`)

Gateway that gates all data access through consent validation and audit logging.

**Global State:**
- `consent_manager_app: UInt64`
- `audit_app: UInt64`
- `queue_app: UInt64`

**Methods:**

| Method | Description |
|--------|-------------|
| `bootstrap(consent_manager_app_id, audit_app_id, queue_app_id)` | Link contracts |
| `access_data(principal, index, scope, purpose)` | Validates consent via ConsentManager → logs to AuditLog (`is_emergency=false`) |
| `emergency_access(principal, request_id, purpose)` | Verifies QueueManager approved status → logs (`is_emergency=true`) |

---

### 5. HealthcareRBAC (`HealthcareRBAC/contract.py`)

Role-based access control using bitmask roles.

**Role bitmasks:**
| Bit | Value | Role |
|-----|-------|------|
| 0 | 1 | Hospital |
| 1 | 2 | Doctor |
| 2 | 4 | Lab |
| 3 | 8 | Pharmacy |
| 4 | 16 | Insurance |
| 5 | 32 | Auditor |

**Box Storage:**
- `admins: BoxMap[Address → Bool]`
- `roles: BoxMap[Address → UInt8]`

**Methods:**

| Method | Description |
|--------|-------------|
| `add_admin(new_admin)` | Existing admin promotes another |
| `is_admin(wallet)` | Boolean admin check |
| `register_role(user, role)` | Admin or Hospital registers roles; Hospitals can register Doctors/Labs |
| `update_role(user, role)` | Admin-only role update |
| `get_role(wallet)` | Returns role bitmask (0 if unregistered) |

Hardcoded initial admin: `ZB4FKAVJU6E3ANTCSPPA5PSSIA35XUUA4O2GASDKZVDLUNZ4DMPLYJMVKM`

---

### 6. QueueManager (`QueueManager/contract.py`)

Access request queue with emergency prioritization.

**Box Storage:**
- `requests: BoxMap[UInt64 → QueueRequest]`
- `patient_requests: BoxMap[Address → DynamicArray[UInt64]]`

**QueueRequest struct:**
```python
class QueueRequest:
    id: UInt64
    requester: Address      # Provider requesting access
    target: Address         # Patient (data subject)
    purpose: String
    request_type: UInt8     # 1 = Normal, 2 = Emergency
    timestamp: UInt64
    status: UInt8           # 0=Pending, 1=Approved, 2=Rejected, 3=Expired
```

**Methods:**

| Method | Description |
|--------|-------------|
| `submit_request(target, purpose, is_emergency)` | Creates request; returns request ID; emits `RequestSubmitted` |
| `approve_request(request_id)` | Emergency: admin or patient; Normal: patient only → status = 1 |
| `reject_request(request_id)` | Same permissions as approve → status = 2 |
| `check_status(request_id)` | Quick status lookup |
| `get_patient_queue(patient)` | Returns requests; Emergency pending first, then Normal |
| `get_request(request_id)` | Retrieve specific request |

---

### 7. DataFiduciaryRegistry (`DataFiduciaryRegistry/contract.py`)

Registry of approved healthcare data trustees.

**Fiduciary struct:**
```python
class Fiduciary:
    name: String
    license_id: String
    approved: Bool
    suspended: Bool
    revoked: Bool
```

**Methods:**

| Method | Description |
|--------|-------------|
| `register_fiduciary(name, license_id)` | Self-register (approved=False pending review) |
| `approve_fiduciary(fiduciary)` | Admin approves |
| `suspend_fiduciary(fiduciary)` | Admin suspends (temporary) |
| `revoke_fiduciary(fiduciary)` | Admin revokes (permanent) |
| `is_approved(fiduciary)` | True if approved + not suspended + not revoked |
| `get_fiduciary(fiduciary)` | Retrieve full fiduciary record |

---

### 8. WalletMapper (`WalletMapper/contract.py`)

Bidirectional mapping between wallet addresses and 6-byte short IDs.

**Box Storage:**
- `short_id_to_address: BoxMap[ShortID → Address]`
- `address_to_short_id: BoxMap[Address → ShortID]`
- `beneficiaries: BoxMap[Address → DynamicArray[BeneficiaryRecord]]`

**BeneficiaryRecord struct:**
```python
class BeneficiaryRecord:
    beneficiary_id: bytes[6]    # Short ID
    beneficiary_wallet: Address
    hashed_password: String
    created_at: UInt64
```

**Methods:**

| Method | Description |
|--------|-------------|
| `fund_app(pay)` | Fund contract for box MBR |
| `register_short_id(short_id)` | Patient registers 6-byte ID; idempotent for same ID; different ID requires clear first |
| `clear_registration()` | Remove both sides of mapping |
| `get_wallet_from_short_id(short_id)` | Lookup by short ID |
| `get_short_id_from_wallet(wallet)` | Lookup by wallet address |
| `add_beneficiary(beneficiary_id, hashed_password)` | Add proxy access; prevents self-link and duplicates |
| `clear_beneficiaries()` | Remove all proxy links for caller |
| `get_beneficiaries(owner)` | List all beneficiary records |

---

### 9. VolunteerRegistry (`VolunteerRegistry/contract.py`)

Privacy-preserving volunteer tracker using hashed identities.

**Box Storage:**
- `volunteers: BoxMap[bytes32 (hash) → Volunteer]`

**Volunteer struct:**
```python
class Volunteer:
    cid: String   # IPFS reference to volunteer data
    active: Bool
```

**Methods:** `add_volunteer(hash_id, cid)` · `update_status(hash_id, active)` · `get_volunteer(hash_id)`

---

### 10. AccessControl (`AccessControl/contract.py`)

Foundational admin control (largely superseded by HealthcareRBAC).

**State:** `super_admin` (GlobalState) · `admins` (LocalState per account)

**Methods:** `initialize()` · `opt_in()` · `add_admin(admin)` · `remove_admin(admin)`

Requires account opt-in for local state storage.

---

## Deployment Architecture

**Script:** `projects/aegis-contracts/scripts/deploy_all.ts`

**Deployment order** (dependency-aware):
```
1. AuditLog                    ← no dependencies
2. QueueManager                ← no dependencies
3. HealthcareRBAC              ← no dependencies
4. DataFiduciaryRegistry       ← no dependencies
5. ConsentManager              ← no dependencies
6. MedicalRecords              ← needs AuditLog app ID (bootstrap)
7. DataAccessManager           ← needs ConsentManager + AuditLog + QueueManager (bootstrap)
8. WalletMapper                ← no dependencies
9. VolunteerRegistry           ← no dependencies
```

**Post-deploy bootstrap calls:**
```typescript
await MedicalRecords.bootstrap({ audit_app_id: auditLogAppId })
await DataAccessManager.bootstrap({
    consent_manager_app_id: consentManagerAppId,
    audit_app_id: auditLogAppId,
    queue_app_id: queueManagerAppId
})
```

**Validation:** Deployer must be `ZB4FKAVJU6E3ANTCSPPA5PSSIA35XUUA4O2GASDKZVDLUNZ4DMPLYJMVKM`

**Output:** Script updates `projects/aegis-frontend/.env` with all deployed App IDs as `VITE_*_APP_ID` variables.

**Dynamic loader** (`smart_contracts/index.ts`): Scans subdirectories for `deploy-config.ts` files, imports deployer modules, supports selective deployment via CLI argument.

---

## Key Data Flows

### Patient Consent Grant
```
Patient clicks "Share with provider"
  → ShareModal opens (provider, scope, duration)
  → addConsent() creates Consent in mockdb
  → addAuditEntry() logs CONSENT_GRANT
  → onSuccess(consent) updates parent state
```

### Doctor Record Upload
```
Doctor fills upload form
  → uploadToPinata(file, metadata) → POST /api/upload → Pinata
  → Returns IPFS hash (CIDv0 starting with Qm)
  → addRecord({ patientId, type, ipfsHash, txHash, ... })
  → addAuditEntry({ action: "WRITE", ... })
  → 2-second success toast, form resets
```

### Prescription Workflow
```
Doctor uploads prescription (creates PrescriptionQueueItem)
  → Hospital views Prescription Queue tab
  → Opens PrescriptionModal → marks dispensed with bill amount
  → markPrescriptionDispensed(id) updates mockdb
  → Patient sees dispensed status in their records
```

### Access Request Lifecycle
```
Doctor: addAccessRequest({ targetPatientId, scope, purpose })
  → Patient dashboard polls getPendingAccessRequestsByPatient() every 2s
  → Patient sees request in "Inbound Requests" card
  → Approve: updateAccessRequestStatus(id, "approved")
  → Deny:    updateAccessRequestStatus(id, "denied")
```

### On-Chain Emergency Access
```
ER Doctor: QueueManager.submit_request(patient, purpose, is_emergency=true)
  → Returns request_id
Admin: QueueManager.approve_request(request_id) → status = Approved
ER Doctor: DataAccessManager.emergency_access(patient, request_id, purpose)
  → DataAccessManager verifies QueueManager status == 1
  → Calls AuditLog.log_data_accessed(..., is_emergency=true)
```

---

## Configuration

**Frontend environment variables:**
| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_PINATA_JWT` | Pinata API authentication |
| `NEXT_PUBLIC_PINATA_GATEWAY` | IPFS gateway base URL |
| `NEXT_PUBLIC_ALGOD_SERVER` | Algorand node (e.g., `http://localhost:4001`) |
| `NEXT_PUBLIC_INDEXER_SERVER` | Algorand indexer (e.g., `http://localhost:8980`) |

**Blockchain frontend environment variables (Vite):**
| Variable | Purpose |
|----------|---------|
| `VITE_AUDITLOG_APP_ID` | AuditLog contract App ID |
| `VITE_QUEUE_MANAGER_APP_ID` | QueueManager contract App ID |
| `VITE_HEALTHCARE_RBAC_APP_ID` | HealthcareRBAC contract App ID |
| `VITE_CONSENT_MANAGER_APP_ID` | ConsentManager contract App ID |
| `VITE_MEDICAL_RECORDS_APP_ID` | MedicalRecords contract App ID |
| `VITE_DATA_ACCESS_MANAGER_APP_ID` | DataAccessManager contract App ID |
| `VITE_WALLET_MAPPER_APP_ID` | WalletMapper contract App ID |
| `VITE_DATA_FIDUCIARY_REGISTRY_APP_ID` | DataFiduciaryRegistry contract App ID |

**npm scripts (frontend):**
```json
"dev": "next dev -p 5000 -H 0.0.0.0"
"build": "next build"
"start": "next start"
```

---

## Notable Implementation Details

| Detail | Description |
|--------|-------------|
| **Mutable mock state** | Frontend uses `let mutableRecords` / `let mutableConsents` so state survives component re-renders within the same browser session |
| **Polling vs. WebSocket** | Patient dashboard polls for inbound requests every 2s via `setInterval`; no WebSocket or SSE infrastructure |
| **IntersectionObserver animations** | Reveal animations triggered on scroll; respects `prefers-reduced-motion` OS setting |
| **Parallax blobs** | Background elements move at differentiated rates based on `window.scrollY` |
| **Consent validation logic** | `validate_consent` checks four conditions: `is_active`, `not erased`, `not expired`, `scope == required OR scope == "ALL"` |
| **GDPR erasure** | `request_erasure()` overwrites sensitive Consent fields with the string `"ERASED"` in-place on-chain |
| **Box storage (Algorand)** | All dynamic arrays use Algorand BoxMaps; callers must fund box MBR via `fund_app()` |
| **ARC-28 events** | Every state-changing action emits a typed event queryable via Algorand indexers for compliance audits |
| **Short IDs** | WalletMapper generates 6-byte patient identifiers (e.g., `847KOR`) for human-readable references |
| **Emergency flag** | All AuditLog `DataAccessed` events carry `is_emergency: Bool` to distinguish routine from critical access |
| **Role bitmasks** | HealthcareRBAC stores roles as `UInt8` bitmasks enabling multi-role assignment (e.g., `Hospital + Doctor = 3`) |
| **Prescription versioning** | MedicalRecords stores `previous_cid` in each Record enabling an IPFS version chain |
| **Bootstrap pattern** | MedicalRecords and DataAccessManager require a one-time `bootstrap()` call post-deploy to link App IDs; inner transactions fail without it |
| **Deployer guard** | `deploy_all.ts` checks deployer address matches hardcoded admin before proceeding with deployment |
