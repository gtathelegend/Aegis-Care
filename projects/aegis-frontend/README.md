# Aegis Care — Frontend

The user interface for the **Aegis Care** decentralized healthcare ecosystem. Built with **React 18**, **TypeScript**, and **Tailwind CSS**, it connects directly to Algorand smart contracts for role resolution, medical record management, prescription workflows, and compliance auditing.

---

## Portals & Routes

| Route | Portal | Description |
| --- | --- | --- |
| `/` | Landing | Wallet connect, role detection, and portal routing |
| `/beneficiary-login` | Beneficiary Login | Proxy access with bcrypt password verification |
| `/patient` | Patient Portal | Records, consent management, access request approvals |
| `/hospital` | Hospital Portal | Request queue, prescription upload, activity feed |
| `/doctor` | Doctor Dashboard | Patient lookup, prescription writing, consent review |
| `/lab` | Lab Dashboard | Encrypted report upload → IPFS → Algorand anchoring |
| `/pharmacy` | Pharmacy Dashboard | Live prescription queue, decrypt & dispense |
| `/insurance` | Insurance Dashboard | Consent-based record requests, claim processing |
| `/auditor` | Auditor Dashboard | DPDP-compliant immutable audit log viewer |
| `/admin` | Admin Hub | RBAC role assignment and registry management |

---

## Feature Highlights

### Patient Portal

- Full medical records history with type filtering (lab, prescription, imaging, etc.)
- QR code sharing per record
- Real-time access request approvals/rejections (pending → approved/rejected)
- Beneficiary proxy mode: act on behalf of a registered patient
- On-chain identity display via **WalletMapper** short IDs
- Blockchain settle-time measurement for live record fetches

### Hospital Portal

- Manage incoming access requests by status (`pending`, `approved`, `rejected`)
- Search and filter patients; view full record histories via a slide-over panel
- Upload new medical records directly to the **MedicalRecords** smart contract
- Live activity feed from the on-chain audit log

### Doctor Dashboard

- Look up patients by name, short ID, or wallet address
- Write and submit prescriptions (encrypted CID anchored on-chain)
- Consent tracker with tabs: `active`, `pending`, `expired` (persisted to localStorage)

### Lab Dashboard

- AES-256-GCM client-side file encryption (max 10 MB, typed file validation)
- Visual 5-step upload pipeline: **Validating → Encrypting → Uploading → Anchoring → Done**
- IPFS upload → Algorand transaction anchor with TX ID display
- Step-by-step progress stepper with per-state icons and colors

### Pharmacy Dashboard

- Fetches live prescription queue from the **MedicalRecords** contract on-chain
- Decrypts prescription CIDs and renders medication details
- One-click dispense: calls `mark_prescription_dispensed` with bill amount
- Local audit log tracking all dispense events

### Insurance Dashboard

- Submit consent-gated record access requests via **ConsentManager** contract
- Outgoing request tracker synced with on-chain approval status
- Local audit log of all access events

### Auditor Dashboard

- Fetches full audit event history from the **AuditLog** contract
- Summary stats: total logs, emergency access count, system health / DPDP compliance
- Search and filter events by principal, fiduciary, or purpose

### Admin Hub

- Assign and update roles via **HealthcareRBAC** (Hospital, Doctor, Lab, Pharmacy, Insurance, Auditor)
- Access denied guard: non-admin wallets are blocked at the page level
- Role bitmask display with color-coded badges

### Beneficiary Login

- Caregiver/proxy login using owner short ID + hashed password (bcrypt)
- Writes proxy context to `sessionStorage` — automatically cleared on logout
- Audits every proxy login via the **AuditLog** contract

---

## Identity & Role System

On wallet connect, `useRole` resolves identity in three steps:

1. **WalletMapper** box query → short patient ID
2. **HealthcareRBAC** box query → role bitmask (bits: Hospital=1, Doctor=2, Lab=4, Pharmacy=8, Insurance=16, Auditor=32)
3. Hardcoded admin override for the governance wallet

Role resolution gates all routes — unregistered wallets stay on the landing page until they register a short ID.

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| Framework | React 18 + Vite 5 |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v3 + lucide-react icons |
| Animation | Framer Motion |
| Routing | React Router DOM v7 |
| Wallet | `@txnlab/use-wallet-react` v4 (Defly, Pera, Exodus, WalletConnect, KMD) |
| Algorand SDK | `algosdk` v3 + `@algorandfoundation/algokit-utils` v9 |
| QR Codes | `qrcode.react` |
| Password Hashing | `bcryptjs` |
| Notifications | `notistack` |
| Encryption | Web Crypto API — AES-256-GCM |
| Storage | IPFS (CID-based, via custom `uploadToIPFS` util) |

A `vite-plugin-node-polyfills` config ensures `Buffer` and `process` are available in the browser for Pera Wallet and Algorand SDK compatibility.

---

## Getting Started

### Prerequisites

- Node.js v20+ (LTS)
- AlgoKit CLI v2+ ([Install Guide](https://github.com/algorandfoundation/algokit-cli#install))
- Docker (for LocalNet)

### Install

```bash
npm install
```

### Environment

```bash
cp .env.template .env
```

Key variables:

```env
VITE_ALGOD_NETWORK=localnet
VITE_WALLET_MAPPER_APP_ID=<app-id>
VITE_HEALTHCARE_RBAC_APP_ID=<app-id>
VITE_MEDICAL_RECORDS_APP_ID=<app-id>
VITE_QUEUE_MANAGER_APP_ID=<app-id>
VITE_CONSENT_MANAGER_APP_ID=<app-id>
VITE_AUDIT_LOG_APP_ID=<app-id>
```

### Run

```bash
npm run dev          # generate contract clients + start dev server
npm run build        # type-check + production build
```

---

## Project Structure

```text
src/
├── pages/           # One file per portal (PatientPortal, DoctorDashboard, etc.)
├── components/      # Shared UI (Sidebar, DashboardShell, QRModal, RecordSlider, ...)
├── hooks/           # useRole, useMedicalRecords, usePrescriptionUpload, ...
├── contracts/       # AlgoKit-generated TypeScript clients + ARC-56 JSON
├── lib/             # Mock data (mockdb), helpers, realtime access requests
└── utils/           # Algorand client config, IPFS, crypto, box utilities
```

---

Empowering patients through decentralization.
