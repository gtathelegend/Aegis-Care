# Aegis Care

**Aegis Care** is a decentralized healthcare data management system built on the **Algorand** blockchain. It provides a privacy-preserving platform for managing medical records, prescriptions, volunteer data, and healthcare access control — with a full React frontend connecting directly to on-chain smart contracts.

**Primary Goals:**
- Enable secure medical record management on-chain
- Implement role-based access control (RBAC) for healthcare providers
- Track data access and consent through immutable audit logs
- Manage prescription workflows with dispensing tracking
- Provide emergency data access mechanisms
- Maintain volunteer registries for healthcare support

---

## Technology Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Blockchain** | Algorand Layer 1 | Smart contract execution & data settlement |
| **Smart Contracts** | Python (Puya) | Contract logic via AlgoKit |
| **Data Storage** | IPFS (CID) | Off-chain encrypted medical records |
| **Client SDK** | AlgoKit Utils (TypeScript) | Contract interaction & deployment |
| **Frontend** | React 18 + Vite 5 + TypeScript | Patient & provider portals |
| **Styling** | Tailwind CSS v3 + Framer Motion | UI & animations |
| **Wallet** | `@txnlab/use-wallet-react` v4 | Defly, Pera, Exodus, WalletConnect, KMD |
| **Encryption** | Web Crypto API (AES-256-GCM) | Client-side file encryption |
| **Environment** | Python Poetry, Node.js/npm | Dependency management |
| **Networks** | LocalNet, Testnet, Mainnet | Development → Production |

---

## Repository Structure

```
Aegis-Care/
├── projects/
│   ├── aegis-contracts/          # Smart contracts (Python/Puya + TypeScript deployer)
│   │   ├── smart_contracts/
│   │   │   ├── AccessControl/
│   │   │   ├── HealthcareRBAC/
│   │   │   ├── MedicalRecords/
│   │   │   ├── AuditLog/
│   │   │   ├── ConsentManager/
│   │   │   ├── DataAccessManager/
│   │   │   ├── DataFiduciaryRegistry/
│   │   │   ├── QueueManager/
│   │   │   ├── VolunteerRegistry/
│   │   │   └── WalletMapper/
│   │   └── scripts/
│   │       └── deploy_all.ts     # Full deploy + bootstrap + auto-updates frontend .env
│   └── aegis-frontend/           # React 18 frontend
│       └── src/
│           ├── pages/            # One file per portal
│           ├── components/       # Shared UI (Sidebar, DashboardShell, QRModal, ...)
│           ├── hooks/            # useRole, useMedicalRecords, usePrescriptionUpload, ...
│           ├── contracts/        # AlgoKit-generated TypeScript clients + ARC-56 JSON
│           ├── lib/              # Mock data, helpers, realtime access requests
│           └── utils/            # Algorand client config, IPFS, crypto, box utilities
├── STARTUP.md                    # Full setup runbook (Windows)
└── CLAUDE.md                     # AI assistant project context
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Aegis CARE ECOSYSTEM                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Healthcare  │  │   Patients   │  │   Auditors   │      │
│  │  Providers   │  │   (Subjects) │  │  (Observers) │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         │                  │                  │              │
│         └──────────────────┴──────────────────┘              │
│                            │                                 │
│  ┌────────────────────────▼─────────────────────────┐       │
│  │         SMART CONTRACT LAYER (Algorand)          │       │
│  ├──────────────────────────────────────────────────┤       │
│  │                                                   │       │
│  │  ┌─────────────────────────────────────────┐    │       │
│  │  │    ACCESS CONTROL & AUTHENTICATION      │    │       │
│  │  │  AccessControl · HealthcareRBAC         │    │       │
│  │  └─────────────────────────────────────────┘    │       │
│  │                                                   │       │
│  │  ┌─────────────────────────────────────────┐    │       │
│  │  │     DATA MANAGEMENT & WORKFLOW          │    │       │
│  │  │  MedicalRecords · QueueManager          │    │       │
│  │  │  ConsentManager · DataAccessManager     │    │       │
│  │  └─────────────────────────────────────────┘    │       │
│  │                                                   │       │
│  │  ┌─────────────────────────────────────────┐    │       │
│  │  │       REGISTRY & GOVERNANCE             │    │       │
│  │  │  DataFiduciaryRegistry · WalletMapper   │    │       │
│  │  │  VolunteerRegistry                      │    │       │
│  │  └─────────────────────────────────────────┘    │       │
│  │                                                   │       │
│  │  ┌─────────────────────────────────────────┐    │       │
│  │  │  AUDIT & LOGGING (ARC-28 Events)        │    │       │
│  │  │  AuditLog                               │    │       │
│  │  └─────────────────────────────────────────┘    │       │
│  │                                                   │       │
│  └───────────────────────────────────────────────────┘       │
│                                                              │
│  ┌──────────────────────────────────────────────────┐      │
│  │        OFF-CHAIN STORAGE (IPFS via CID)         │      │
│  │  Encrypted medical records · Patient data blobs │      │
│  └──────────────────────────────────────────────────┘      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Contract Interaction Flow

```
1. REGISTRATION & SETUP
   Patient registers → WalletMapper creates short ID → DataFiduciaryRegistry approves providers

2. DATA UPLOAD
   Provider uploads medical record → MedicalRecords stores (CID, patient metadata)
                                  → AuditLog records access event

3. PRESCRIPTION WORKFLOW
   Provider adds prescription → MedicalRecords queue + patient history
   Pharmacy marks dispensed   → MedicalRecords updates bill amount → AuditLog logs

4. DATA ACCESS REQUEST (Consent-based)
   Patient initiates request → QueueManager.submit_request()
   Provider approves/rejects → QueueManager.approve_request()
   Provider accesses data    → DataAccessManager.access_data() → AuditLog

5. EMERGENCY ACCESS
   Provider triggers emergency → QueueManager creates emergency request
   Admin approves             → QueueManager.approve_request()
   Provider accesses data     → DataAccessManager.emergency_access() (is_emergency=true)
```

---

## Smart Contracts

### 1. AccessControl

Basic admin role management. Accounts opt-in; the deployer is marked as super admin. Admins can add or remove other admins.

### 2. HealthcareRBAC

Role-Based Access Control via bitmask-encoded roles stored in BoxMaps.

| Bit | Value | Role      |
| --- | ----- | --------- |
| 0   | 1     | Hospital  |
| 1   | 2     | Doctor    |
| 2   | 4     | Lab       |
| 3   | 8     | Pharmacy  |
| 4   | 16    | Insurance |
| 5   | 32    | Auditor   |

**Methods:** `add_admin`, `is_admin`, `register_role`, `update_role`, `get_role`

### 3. MedicalRecords

Core data repository for patient records and prescriptions. Each record stores an IPFS CID, record type, provider, timestamp, and bill amount. Prescriptions have a global dispensing queue.

**Methods:** `bootstrap(audit_app_id)`, `add_record`, `add_prescription`, `get_pending_prescriptions`, `mark_prescription_dispensed`, `get_patient_records`

**Events (ARC-28):** `RecordAdded`, `PrescriptionAddedToQueue`, `PrescriptionDispensed`

### 4. AuditLog

Write-only immutable audit trail. Other contracts call it via inner transactions. Events are queryable via Algorand indexers.

**Events:** `ConsentGranted`, `ConsentRevoked`, `DataAccessed`, `AccessRequested`, `ErasureRequested`

### 5. ConsentManager

Formal consent workflow with expiry tracking. Acts as the consent validation layer for DataAccessManager.

### 6. DataAccessManager

Gateway for all data access. Validates consent and logs every access (normal or emergency) to AuditLog.

**Methods:** `bootstrap(consent_manager_app_id, audit_app_id, queue_app_id)`, `access_data`, `emergency_access`

### 7. DataFiduciaryRegistry

Registry of approved healthcare providers. Providers self-register; an admin approves, suspends, or revokes them.

**Methods:** `register_fiduciary`, `approve_fiduciary`, `suspend_fiduciary`, `revoke_fiduciary`, `is_approved`, `get_fiduciary`

### 8. QueueManager

Access request queue with emergency prioritization. Normal requests require patient approval; emergency requests can be approved by admin or patient.

**Statuses:** `0=Pending`, `1=Approved`, `2=Rejected`, `3=Expired`

**Methods:** `submit_request`, `approve_request`, `reject_request`, `check_status`, `get_patient_queue`, `get_request`

### 9. VolunteerRegistry

Privacy-preserving volunteer tracking using hashed identities (32-byte hash → IPFS CID).

**Methods:** `add_volunteer`, `update_status`, `get_volunteer`

### 10. WalletMapper

Maps patient wallets to short 6-byte IDs and manages beneficiary (proxy) relationships with bcrypt-hashed passwords.

**Methods:** `register_short_id`, `clear_registration`, `get_wallet_from_short_id`, `get_short_id_from_wallet`, `add_beneficiary`, `clear_beneficiaries`, `get_beneficiaries`

---

## Frontend Portals

| Route | Portal | Description |
|-------|--------|-------------|
| `/` | Landing | Wallet connect, role detection, portal routing |
| `/beneficiary-login` | Beneficiary Login | Proxy access with bcrypt password verification |
| `/patient` | Patient Portal | Records, consent management, access request approvals |
| `/hospital` | Hospital Portal | Request queue, prescription upload, activity feed |
| `/doctor` | Doctor Dashboard | Patient lookup, prescription writing, consent review |
| `/lab` | Lab Dashboard | AES-256-GCM encrypted file upload → IPFS → Algorand anchor |
| `/pharmacy` | Pharmacy Dashboard | Live prescription queue, decrypt & dispense |
| `/insurance` | Insurance Dashboard | Consent-gated record requests, claim processing |
| `/auditor` | Auditor Dashboard | DPDP-compliant immutable audit log viewer |
| `/admin` | Admin Hub | RBAC role assignment and registry management |

### Identity & Role Resolution

On wallet connect, `useRole` resolves identity in three steps:

1. **WalletMapper** box query → short patient ID
2. **HealthcareRBAC** box query → role bitmask
3. Hardcoded admin override for the governance wallet

Role resolution gates all routes — unregistered wallets stay on the landing page until they register a short ID.

### Feature Highlights

- **Patient Portal:** Full record history, QR code sharing, real-time consent approvals, beneficiary proxy mode
- **Lab Dashboard:** Visual 5-step upload pipeline (Validating → Encrypting → Uploading → Anchoring → Done) with AES-256-GCM encryption
- **Pharmacy Dashboard:** Live on-chain prescription queue with one-click dispense
- **Auditor Dashboard:** Full audit event history with summary stats and DPDP compliance indicators
- **Admin Hub:** Role assignment with color-coded bitmask badges; non-admin wallets are blocked at the page level

---

## Deployment

### Deploy Order (deploy_all.ts)

The `scripts/deploy_all.ts` script deploys all 9 contracts in dependency order, runs the bootstrap linking calls, and **automatically writes the app IDs back to `projects/aegis-frontend/.env`**.

```
1.  AuditLog
2.  QueueManager
3.  HealthcareRBAC
4.  DataFiduciaryRegistry
5.  ConsentManager
6.  MedicalRecords
7.  DataAccessManager
8.  WalletMapper
9.  VolunteerRegistry
→   bootstrap: MedicalRecords.bootstrap(audit_app_id)
→   bootstrap: DataAccessManager.bootstrap(consent_app_id, audit_app_id, queue_app_id)
→   auto-write: frontend .env updated with all VITE_*_APP_ID variables
```

### Environment Variables (frontend)

```env
VITE_ALGOD_NETWORK=localnet
VITE_AUDITLOG_APP_ID=<app-id>
VITE_QUEUE_MANAGER_APP_ID=<app-id>
VITE_HEALTHCARE_RBAC_APP_ID=<app-id>
VITE_DATA_FIDUCIARY_REGISTRY_APP_ID=<app-id>
VITE_CONSENT_MANAGER_APP_ID=<app-id>
VITE_MEDICAL_RECORDS_APP_ID=<app-id>
VITE_DATA_ACCESS_MANAGER_APP_ID=<app-id>
VITE_WALLET_MAPPER_APP_ID=<app-id>
VITE_VOLUNTEER_REGISTRY_APP_ID=<app-id>
```

---

## Quick Start

### Prerequisites

- Git, Node.js 20+, Python 3.12, Poetry, AlgoKit CLI, Docker Desktop

```powershell
pipx install poetry
pipx install algokit
pipx ensurepath
```

### First-Time Setup

```powershell
git clone <repo-url>
cd Aegis-Care

# Point Poetry at Python 3.12
cd projects/Aegis-contracts
poetry env use "<absolute-path-to-python3.12.exe>"

# Install all dependencies
cd ../..
algokit project bootstrap all

# Start local Algorand network
algokit localnet start

# Build contracts
cd projects/Aegis-contracts
algokit project run build

# Deploy all contracts + auto-update frontend .env
algokit project deploy localnet

# Run the frontend
cd ../Aegis-frontend
npm run dev
```

Open `http://localhost:5173/` in your browser.

### Daily Development

```powershell
algokit localnet start
cd projects/Aegis-frontend
npm run dev
```

Only re-run build and deploy when you modify `projects/aegis-contracts/smart_contracts/*/contract.py`.

### Useful Commands

```powershell
algokit localnet status   # check network health
algokit localnet reset    # reset if state gets inconsistent
algokit localnet stop     # stop the network
```

---

## Testnet / Mainnet Deployment

1. Create `.env.testnet` or `.env.mainnet`
2. Set `ALGOD_SERVER`, `ALGOD_TOKEN`, `INDEXER_SERVER`, `INDEXER_TOKEN`
3. Fund deployer account: [bank.testnet.algorand.network](https://bank.testnet.algorand.network/) (testnet)

```bash
algokit project deploy testnet
```

---

## Security Considerations

### Hardcoded Admin Address
Several contracts hardcode the initial super admin:
```
ZB4FKAVJU6E3ANTCSPPA5PSSIA35XUUA4O2GASDKZVDLUNZ4DMPLYJMVKM
```
Acceptable for governance initialization; should be rotated in production.

### Access Control Patterns
- **HealthcareRBAC:** Role-based checks via bitmasks
- **QueueManager:** Only the target patient or admin can approve emergency requests
- **DataFiduciaryRegistry:** Admin-gated provider approval/suspension/revocation

### Data Privacy
- Medical record content stored encrypted on IPFS; only CID hashes on-chain
- Volunteer identities stored as 32-byte hashes
- Beneficiary passwords stored as bcrypt hashes

### Audit Trail
- All data access logged immutably via AuditLog ARC-28 events
- Emergency flag (`is_emergency=true`) distinguishes routine vs. critical access
- Events queryable via Algorand indexers for compliance audits

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `poetry: command not found` | Run `pipx ensurepath`, reopen terminal |
| `Python version not supported` | Re-run `poetry env use <path-to-python3.12.exe>` |
| `Cannot connect to Docker` | Start Docker Desktop, then `algokit localnet start` |
| Frontend shows `APP_ID = 0` errors | Redeploy contracts and update `.env` with new app IDs |
| LocalNet state inconsistent | `algokit localnet reset`, then repeat steps 4–7 |
| `Inner transaction fails: App not found` | Ensure `bootstrap()` was called to link app IDs |
| `Box MBR insufficient` | Call `WalletMapper.fund_app()` with sufficient payment |
| `Deploy fails: Insufficient balance` | Fund testnet account at https://bank.testnet.algorand.network/ |

---

## Future Enhancements

1. **Data Marketplace** — Enable patients to monetize anonymized data
2. **Insurance Integration** — Direct on-chain insurance claim processing
3. **Multi-Sig Governance** — DAO-based community oversight
4. **Privacy Proofs** — ZK proofs for compliance verification
5. **Consent Expiry** — Time-bounded emergency access requests

### Known Limitations
- No consensus-based consent validation (centralized approval for now)
- Prescription queue O(n) iteration on dispensing
- No expiry logic for emergency access requests
- Volunteer registry hash collision potential (mitigated by 32-byte hash)

---

## References

- [Algorand Developer Docs](https://developer.algorand.org/)
- [AlgoKit Documentation](https://algorandfoundation.github.io/algokit-cli/)
- [Puya (Python → TEAL)](https://github.com/algorandfoundation/puya)
- [ARC-28 Events Spec](https://github.com/algorandfoundation/ARCs/blob/main/ARCs/arc-0028.md)
- [Algorand SDK (TypeScript)](https://github.com/algorandfoundation/js-algorand-sdk)

---

**Project:** Aegis Care v1.0 — Healthcare RBAC + Medical Records + Audit + React Frontend
