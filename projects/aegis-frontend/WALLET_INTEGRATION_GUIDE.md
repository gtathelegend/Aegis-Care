# Wallet Integration & Dynamic Dashboard Guide

## Overview

The Aegis Care frontend now supports **fully dynamic, wallet-connected dashboards** where patient data, prescriptions, and audit logs are fetched directly from the Algorand blockchain and IPFS.

## Architecture

### Data Flow

```
┌─────────────────────────────────────────────────────────┐
│                    User Connects Wallet                  │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │  useRole() Hook       │
         │  - Resolves wallet    │
         │  - Fetches role/RBAC  │
         │  - Gets short ID      │
         └───────────┬───────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
        ▼                         ▼
  Patient Portal    Doctor/Hospital Portal
        │                         │
    ┌───┴─────────┐          ┌────┴─────────┐
    │             │          │              │
    ▼             ▼          ▼              ▼
useMedical  usePrescription  useMedical  usePatients
Records     Upload           Records     List
    │             │          │              │
    └─────────────┴──────────┴──────────────┘
                   │
                   ▼
       ┌───────────────────────┐
       │  Smart Contracts      │
       ├───────────────────────┤
       │ MedicalRecords        │
       │ - get_patient_records │
       │ - add_prescription    │
       ├───────────────────────┤
       │ HealthcareRBAC        │
       │ - get_role            │
       │ - register_role       │
       ├───────────────────────┤
       │ WalletMapper          │
       │ - get_short_id        │
       │ - add_beneficiary     │
       └───────────┬───────────┘
                   │
       ┌───────────┴──────────┐
       │                      │
       ▼                      ▼
    Algorand            IPFS (Pinata)
   Blockchain        Encrypted Data Storage
   (on-chain          (off-chain encrypted
    references)       prescriptions & records)
```

---

## Core Hooks

### 1. **useRole** (existing, enhanced)
**Location:** `src/hooks/useRole.ts`

Fetches user identity and role information from the blockchain.

```typescript
const { role, roles, shortId, isAdmin, isVerified, loading, error } = useRole()
```

**Returns:**
- `role`: Primary role ('patient', 'doctor', 'hospital', etc.)
- `roles`: Array of all roles assigned to the wallet
- `shortId`: Patient/provider short identifier
- `isAdmin`: Is this the admin wallet?
- `isVerified`: Is wallet registered in RBAC?
- `loading`, `error`: State flags

**Used By:**
- All dashboard pages (determines role-based rendering)
- LoginScreen (redirects to appropriate dashboard)

---

### 2. **useMedicalRecords** (NEW)
**Location:** `src/hooks/useMedicalRecords.ts`

Fetches all medical records (including prescriptions) for a given patient wallet.

```typescript
const { 
  records,           // Non-prescription medical records
  prescriptions,     // Prescription records only
  allRecords,        // All records combined
  requestQueue,      // Pending access requests
  loading,
  error,
  refetch            // Manually refresh
} = useMedicalRecords(patientAddress, patient)
```

**Data Sources:**
- `MedicalRecords.get_patient_records(patientAddress)` - blockchain
- Records are enriched with IPFS data if available

**Used By:**
- `PatientPortal.tsx` - Patient views their records
- `DoctorDashboard.tsx` - Doctor views accessible patient records
- Records displayed in both patient and provider dashboards

---

### 3. **usePrescriptionUpload** (NEW)
**Location:** `src/hooks/usePrescriptionUpload.ts`

Handles the end-to-end prescription upload process: IPFS storage + blockchain transaction.

```typescript
const { 
  uploadPrescription,  // async function
  uploading,           // boolean
  error,               // string | null
  success,
  cid,                 // IPFS hash of uploaded prescription
  txHash,              // Blockchain transaction hash
  reset                // Clear state
} = usePrescriptionUpload()
```

**Upload Process:**
1. Create prescription JSON object with:
   - Patient wallet address, name
   - Medication, dosage, instructions, notes
   - Provider name, timestamp

2. Upload to IPFS via Pinata:
   ```
   JSON → Encrypt (optional) → IPFS → CID returned
   ```

3. Call smart contract `MedicalRecords.add_prescription()`:
   ```
   MedicalRecords.add_prescription(
     patient: walletAddress,
     patient_name: name,
     cid: ipfsHash
   )
   ```

4. Transaction settles on-chain, prescription now accessible to patient

**Used By:**
- `DoctorDashboard.tsx` - Doctor uploads prescription
- `HospitalPortal.tsx` - Hospital uploads prescription
- Forms trigger this hook on submit

---

### 4. **usePatientsList** (NEW)
**Location:** `src/hooks/usePatientsList.ts`

Fetches list of accessible patients for hospital/provider dashboards.

```typescript
const { 
  patients,          // Array of patient objects with record counts
  loading,
  error,
  refetch
} = usePatientsList()
```

**Used By:**
- `HospitalPortal.tsx` - Shows "Patient Registry" table
- Currently falls back to mock data if blockchain unavailable

---

## Dashboard Pages

### Patient Dashboard: `PatientPortal.tsx`

**What Displays:**
- Patient's own medical records (pulled from blockchain)
- Prescriptions issued to this patient
- Consent windows and active access grants
- Audit trail of all data accesses

**Wallet Connection Flow:**
```
1. User connects wallet
   ↓
2. useRole() fetches user role
   ↓
3. If role is 'patient' (or just not a provider):
   useMedicalRecords(walletAddress) fetches their records
   ↓
4. Dashboard renders:
   - Overview: consent status, record count
   - Records tab: list of medical records
   - Consents tab: who has access to what
   - Audit: immutable log of all access
```

**Key Features:**
- Wallet address resolves to patient identity
- Records updated every 45 seconds (configurable)
- QR code sharing for paper-free consultations
- Record slider for viewing details
- Consent grant/revoke actions

---

### Doctor Dashboard: `DoctorDashboard.tsx`

**What Displays:**
- List of patients under care
- Ability to upload prescriptions for patients
- Prescription queue (pending/dispensed status)
- Access requests from other providers
- Audit trail of doctor's own actions

**Wallet Connection Flow:**
```
1. User connects wallet
   ↓
2. useRole() fetches role = 'doctor'
   ↓
3. Show doctor-specific UI:
   - Patient list (hardcoded for MVP, blockchain-powered later)
   - Prescription upload form
     ├─ Patient identifier
     ├─ Medication/dosage/instructions
     └─ Submit → usePrescriptionUpload() → on-chain + IPFS
   ↓
4. Prescription appears:
   - On doctor's view (shows as "uploaded")
   - On patient's dashboard (shows as "received")
   - In audit trail (both sides logged)
```

**Prescription Upload UI:**
- Patient target field (short ID, wallet, or name)
- Medication, dosage, instructions, notes
- "Upload prescription" button
- Status feedback (success/error)

---

### Hospital Portal: `HospitalPortal.tsx`

**What Displays:**
- Patient registry (list of all accessible patients)
- Prescription upload (same as doctor but for hospital)
- Inbound access requests
- Audit trail of hospital activities
- Settings for hospital information

**Similar to Doctor Dashboard** but with hospital-specific data and permissions.

---

## Prescription Workflow (End-to-End)

### Doctor/Hospital uploads prescription:

```
Doctor's Screen
┌──────────────────────────────────────┐
│ Prescription Upload Form              │
├──────────────────────────────────────┤
│ Patient: 847KOR (or wallet addr)      │
│ Medication: Amoxicillin 500mg         │
│ Dosage: 1 tablet 3x daily for 10d     │
│ Instructions: Take after meals        │
│ Notes: (optional)                     │
│ [Upload Prescription]                 │
└──────────────────────────────────────┘
              │
              ▼ onClick
    usePrescriptionUpload.uploadPrescription({
      patientAddress: resolvePatient("847KOR").wallet,
      patientName: "Ishaan Kapoor",
      medication: "Amoxicillin 500mg",
      dosage: "1 tablet 3x daily for 10d",
      instructions: "Take after meals",
      providerName: doctor.wallet,
      notes: ""
    })
              │
              ├─→ Create JSON prescription object
              │
              ├─→ Upload to IPFS
              │   POST https://api.pinata.cloud/pinning/pinFileToIPFS
              │   Returns: CID (e.g., "Qm...")
              │
              ├─→ Call smart contract
              │   MedicalRecords.add_prescription({
              │     patient: "0x...",
              │     patient_name: "Ishaan Kapoor",
              │     cid: "Qm..."
              │   })
              │   Sender: doctor.wallet
              │   Signer: transactionSigner
              │
              ├─→ Txn settles on Algorand (≈4 seconds)
              │   Returns: txHash, confirmation
              │
              └─→ Show: "Prescription uploaded! CID: Qm...abc"

Dashboard Feedback
┌──────────────────────────────────────┐
│ ✓ Prescription uploaded successfully  │
│   CID: Qm...abc (truncated)          │
│   TX Hash: 0x...def (if available)   │
│   Status: On-chain (settled)         │
└──────────────────────────────────────┘
```

### Patient sees prescription:

```
Patient logs in with same wallet
         │
         ▼ useRole() + useMedicalRecords()
PatientPortal.tsx renders
         │
         ▼ medicalRecords includes prescription
┌──────────────────────────────────────┐
│ Recent Records                        │
├──────────────────────────────────────┤
│ ☑ Prescription — Amoxicillin 500mg   │
│   Dr. Hanwa, K. · 19 Apr 2026        │
│   ipfs://Qm...abc (IPFS hash)        │
│                                      │
│ Click to view full details           │
└──────────────────────────────────────┘
         │
         ▼ Click → RecordSlider
┌──────────────────────────────────────┐
│ Prescription Details                  │
├──────────────────────────────────────┤
│ Medication: Amoxicillin 500mg         │
│ Dosage: 1 tablet 3x daily for 10d    │
│ Instructions: Take after meals        │
│ Provider: Dr. Hanwa, K.               │
│ Uploaded: 19 Apr 2026                │
│ CID: Qm...abc                        │
│ [Share QR] [Verify on chain]         │
└──────────────────────────────────────┘
```

### Audit Trail (Immutable):

Both dashboards show event in audit trail:
```
AuditLog.log_data_accessed(
  principal: patient.wallet,
  fiduciary: doctor.wallet,
  purpose: "Prescription uploaded",
  timestamp: now,
  is_emergency: false
)
```

This event is **immutable on-chain** and queryable via indexers.

---

## Configuration

### Environment Variables

Required in `.env.local` (or `.env.development`):

```bash
# Contracts
VITE_WALLET_MAPPER_APP_ID=12345
VITE_HEALTHCARE_RBAC_APP_ID=12346
VITE_MEDICAL_RECORDS_APP_ID=12347
VITE_QUEUE_MANAGER_APP_ID=12348
VITE_AUDIT_LOG_APP_ID=12349
VITE_DATA_ACCESS_MANAGER_APP_ID=12350

# Network
VITE_ALGOD_SERVER=http://localhost:4001
VITE_ALGOD_TOKEN=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
VITE_INDEXER_SERVER=http://localhost:8980
VITE_INDEXER_TOKEN=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa

# IPFS (Pinata)
VITE_PINATA_JWT=eyJhbGc...
```

### Algorand Network Setup

```bash
# Start LocalNet (includes Algod + Indexer)
algokit localnet start

# Deploy contracts
cd projects/aegis-contracts
algokit project deploy localnet

# Copy app IDs to .env.local
```

---

## Testing the Integration

### 1. Patient Dashboard Test

```bash
# Start dev server
npm run dev

# In browser:
# 1. Navigate to /patient
# 2. Click "Connect Wallet"
# 3. Select test wallet (pre-funded)
# 4. Dashboard loads with patient's records
```

### 2. Prescription Upload Test

```bash
# In Doctor/Hospital portal:
# 1. Fill prescription form:
#    - Patient: 847KOR (or paste wallet address)
#    - Medication: "Test Med"
#    - Dosage: "1x daily"
#    - Instructions: "After meals"
# 2. Click "Upload prescription"
# 3. Wait for "Uploading..." → "Success"
# 4. Check patient dashboard - prescription should appear
```

### 3. Audit Trail Test

```bash
# Both dashboards show audit entry:
# "Dr. X uploaded prescription for patient Y"
# Timestamp, CID, and immutable on-chain record verified
```

---

## Fallback Behavior

If blockchain is unavailable (network down, contract not deployed):

1. **useRole()**: Returns error, falls back to 'unknown' role
2. **useMedicalRecords()**: Returns empty array, shows mock data
3. **usePrescriptionUpload()**: Fails with network error
4. **Dashboards**: Render mock data gracefully

The UI is designed to **degrade gracefully** but always show the wallet connection state.

---

## Data Privacy & Encryption

### Current Implementation:
- Prescription JSON uploaded to IPFS in plaintext
- CID (content hash) stored on-chain
- Patient wallet address on-chain visible to providers with consent

### Future Enhancement:
- Encrypt prescription before IPFS upload
- Store encryption key in patient's custody
- Only decryptable by patient + authorized providers

---

## Common Issues & Troubleshooting

### Issue: "Contract not configured"
**Cause:** `VITE_MEDICAL_RECORDS_APP_ID` not set  
**Fix:** Update `.env.local` with correct app ID

### Issue: "Wallet not connected"
**Cause:** User hasn't clicked wallet connect button  
**Fix:** Show "Connect Wallet" button when `activeAddress` is null

### Issue: Prescription upload hangs
**Cause:** IPFS upload timeout (Pinata gateway slow)  
**Fix:** Implement timeout, retry logic (already in `uploadEncryptedFile`)

### Issue: Records show mock data instead of blockchain
**Cause:** Contract query failed, fell back to `medicalRecords` mock  
**Fix:** Check contract app ID, network connection, box state

---

## Future Enhancements

1. **Batch Prescriptions**: Upload multiple at once
2. **Prescription Fulfillment**: Track pharmacy dispensing
3. **Drug Interactions**: Check against patient's med list
4. **Insurance Integration**: Verify coverage before upload
5. **Consent Workflow**: Require patient approval before prescription visible
6. **Emergency Override**: Admin can mark prescription as urgent
7. **Expiry Tracking**: Auto-remove prescriptions after 30 days
8. **Delegation**: Patient can delegate to healthcare proxy

---

## API Reference

### useMedicalRecords(patientAddress, patient?)

```typescript
export const useMedicalRecords = (
  patientAddress: string | null,
  patient?: Patient
): MedicalRecordsHookState => {
  // Returns: { records, prescriptions, allRecords, requestQueue, loading, error, refetch }
}
```

### usePrescriptionUpload()

```typescript
export const usePrescriptionUpload = (): PrescriptionUploadState => {
  // Returns: { uploadPrescription, uploading, error, success, txHash, cid, reset }
}
```

### uploadPrescription(params)

```typescript
await uploadPrescription({
  patientAddress: string,      // Wallet address
  patientName: string,         // Full name
  medication: string,          // Drug name
  dosage: string,             // Dosage + frequency
  instructions: string,       // Patient instructions
  notes?: string,             // Optional provider notes
  providerName: string        // Provider wallet/name
})
```

---

## File Locations Summary

```
projects/aegis-frontend/
├── src/
│   ├── hooks/
│   │   ├── useRole.ts ..................... User identity resolution
│   │   ├── useMedicalRecords.ts ........... Fetch records from blockchain
│   │   ├── usePrescriptionUpload.ts ....... Upload to IPFS + contract
│   │   └── usePatientsList.ts ............ List of accessible patients
│   ├── pages/
│   │   ├── PatientPortal.tsx ............. Patient dashboard
│   │   ├── DoctorDashboard.tsx ........... Doctor dashboard
│   │   ├── HospitalPortal.tsx ............ Hospital dashboard
│   │   └── LoginScreen.tsx ............... Wallet connection
│   ├── contracts/
│   │   ├── MedicalRecordsClient.ts ....... Generated client
│   │   ├── HealthcareRBACClient.ts ....... Generated client
│   │   └── WalletMapperClient.ts ......... Generated client
│   └── utils/
│       ├── ipfs.ts ....................... IPFS/Pinata integration
│       ├── crypto.ts ..................... Encryption (optional)
│       └── network/
│           └── getAlgoClientConfigs.ts ... Network configuration
│
└── WALLET_INTEGRATION_GUIDE.md ........... This file
```

---

## Contact & Support

For issues or questions:
1. Check contract deployment status: `algokit project run deploy localnet`
2. Verify environment variables are set correctly
3. Check browser console for detailed error messages
4. Review audit trail for transaction failures
