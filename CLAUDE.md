# Aegis-Care: Healthcare Data Management on Algorand

## Project Overview

**Aegis-Care** is a blockchain-based healthcare data management system built on the **Algorand** network. It provides a decentralized, privacy-preserving platform for managing medical records, prescriptions, volunteer data, and healthcare access control. The project uses Algorand smart contracts (Python via Puya/AlgoKit) and IPFS (via CID - Content Identifier) for data storage.

**Primary Goals:**
- Enable secure medical record management on-chain
- Implement role-based access control (RBAC) for healthcare providers
- Track data access and consent through immutable audit logs
- Manage prescription workflows with dispensing tracking
- Provide emergency data access mechanisms
- Maintain volunteer registries for healthcare support

**Status:** V1.0 (Two commits, foundational contracts deployed)

---

## Technology Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Blockchain** | Algorand Layer 1 | Smart contract execution & data settlement |
| **Smart Contracts** | Python (Puya) | Contract logic implementation |
| **Contract Framework** | AlgoKit | Development, testing, deployment |
| **Data Storage** | IPFS (CID) | Off-chain encrypted medical records |
| **Deployment Tool** | AlgoKit CLI | Contract compilation & deployment |
| **Client SDK** | AlgoKit Utils (TypeScript) | Contract interaction & deployment |
| **Environment** | Python Poetry, Node.js/npm | Dependency management |
| **Networks** | LocalNet, Testnet, Mainnet | Development → Production |

---

## Architecture Overview

### High-Level System Design

```
┌─────────────────────────────────────────────────────────────┐
│                     AEGIS-CARE ECOSYSTEM                     │
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
│  ├────────────────────────────────────────────────┤       │
│  │                                                 │        │
│  │  ┌─────────────────────────────────────────┐  │        │
│  │  │    ACCESS CONTROL & AUTHENTICATION      │  │        │
│  │  │  ┌──────────────┐  ┌────────────────┐  │  │        │
│  │  │  │AccessControl │  │HealthcareRBAC │  │  │        │
│  │  │  │              │  │  (Roles: 1-32) │  │  │        │
│  │  │  └──────────────┘  └────────────────┘  │  │        │
│  │  └─────────────────────────────────────────┘  │        │
│  │                                                 │        │
│  │  ┌─────────────────────────────────────────┐  │        │
│  │  │     DATA MANAGEMENT & WORKFLOW          │  │        │
│  │  │  ┌──────────────┐  ┌────────────────┐  │  │        │
│  │  │  │ MedicalRecds │  │ QueueManager   │  │  │        │
│  │  │  │(PatientRecds)│  │(Access Reqs)   │  │  │        │
│  │  │  └──────────────┘  └────────────────┘  │  │        │
│  │  │  ┌──────────────┐                       │  │        │
│  │  │  │  Prescriptions (in MedicalRecords)  │  │        │
│  │  │  └──────────────┘                       │  │        │
│  │  └─────────────────────────────────────────┘  │        │
│  │                                                 │        │
│  │  ┌─────────────────────────────────────────┐  │        │
│  │  │       REGISTRY & GOVERNANCE             │  │        │
│  │  │  ┌──────────────┐  ┌────────────────┐  │  │        │
│  │  │  │ DataFiduciary│  │WalletMapper    │  │  │        │
│  │  │  │ Registry     │  │(ID Mapping)    │  │  │        │
│  │  │  └──────────────┘  └────────────────┘  │  │        │
│  │  │  ┌──────────────┐                       │  │        │
│  │  │  │VolunteerReg. │  (Volunteer tracking)│  │        │
│  │  │  └──────────────┘                       │  │        │
│  │  └─────────────────────────────────────────┘  │        │
│  │                                                 │        │
│  │  ┌─────────────────────────────────────────┐  │        │
│  │  │         AUDIT & LOGGING                 │  │        │
│  │  │  ┌──────────────────────────────────┐   │  │        │
│  │  │  │  AuditLog (ARC-28 Events)        │   │  │        │
│  │  │  │  - Consent granted/revoked       │   │  │        │
│  │  │  │  - Data accessed                 │   │  │        │
│  │  │  │  - Access requests               │   │  │        │
│  │  │  │  - Erasure requests              │   │  │        │
│  │  │  └──────────────────────────────────┘   │  │        │
│  │  └─────────────────────────────────────────┘  │        │
│  │                                                 │        │
│  └─────────────────────────────────────────────────┘       │
│                                                              │
│  ┌──────────────────────────────────────────────────┐      │
│  │        OFF-CHAIN STORAGE (IPFS via CID)         │      │
│  │  - Encrypted medical records                    │      │
│  │  - Patient data blobs                           │      │
│  │  - Content-addressed immutable storage          │      │
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
                             → QueueManager tracks (optional for urgent flow)
   Pharmacy marks dispensed   → MedicalRecords updates bill amount
                             → AuditLog logs

4. DATA ACCESS REQUEST (Consent-based)
   Patient initiates request → QueueManager.submit_request()
   Provider approves/rejects → QueueManager.approve_request()
   Provider accesses data    → DataAccessManager.access_data()
                            → Validates consent + logs to AuditLog

5. EMERGENCY ACCESS
   Provider triggers emergency → QueueManager creates emergency request
   Admin approves             → QueueManager.approve_request()
   Provider accesses data     → DataAccessManager.emergency_access()
                             → Logs as is_emergency=true
```

---

## Smart Contracts Details

### 1. **AccessControl** (`smart_contracts/AccessControl/contract.py`)
**Purpose:** Basic admin role management for the healthcare system.

**Key Components:**
- **super_admin**: Hardcoded initial admin address
- **admins**: Local state mapping (address → bool)
- **OptIn requirement**: Accounts must opt-in to use this contract

**Public Methods:**
- `initialize()` - Sets up the hardcoded super admin (create="require")
- `opt_in()` - Accounts opt-in; marked as admin if sender == super_admin
- `add_admin(admin)` - Only admins can add new admins
- `remove_admin(admin)` - Only admins can revoke admin status

**Role:** Foundational access control; likely superseded by HealthcareRBAC in later use.

---

### 2. **HealthcareRBAC** (`smart_contracts/HealthcareRBAC/contract.py`)
**Purpose:** Role-Based Access Control (RBAC) for different healthcare actors.

**Key Components:**
- **initial_admin**: Hardcoded admin (ZB4FK...)
- **admins**: BoxMap (address → bool) - Additional admins
- **roles**: BoxMap (address → uint8) - Role bitmasks

**Role Bitmasks:**
```
Bit 0 (1):  Hospital
Bit 1 (2):  Doctor
Bit 2 (4):  Lab
Bit 3 (8):  Pharmacy
Bit 4 (16): Insurance
Bit 5 (32): Auditor
```

**Public Methods:**
- `add_admin(new_admin)` - Only existing admins can add new admins
- `is_admin(wallet)` - Check if address is admin
- `register_role(user, role)` - Admins can assign roles; Hospitals can register Doctors/Labs
- `update_role(user, role)` - Only admins can update roles
- `get_role(wallet)` - Returns role bitmask (0 if unset)

**Role:** Central authorization layer for determining who can do what in the healthcare system.

---

### 3. **MedicalRecords** (`smart_contracts/MedicalRecords/contract.py`)
**Purpose:** Core contract for storing and managing patient medical records and prescriptions.

**Data Structures:**
```python
Record {
    id: uint64,
    patient: Address,
    provider: Address,
    cid: String,              # IPFS content hash
    previous_cid: String,     # For versioning
    record_type: String,      # "Lab Result", "Prescription", etc.
    timestamp: uint64,
    bill_amount: uint64
}

PrescriptionQueueItem {
    record_id: uint64,
    patient: Address,
    patient_name: String,
    cid: String,
    is_dispensed: Bool,
    bill_amount: uint64
}
```

**Global State:**
- `record_counter` - Incremental ID for records
- `audit_app` - App ID of AuditLog contract
- `patient_records` - BoxMap[Address → DynamicArray[Record]]
- `prescription_queue` - BoxMap[UInt64 → PrescriptionQueueItem]
- `queue_length` - Count of total prescriptions

**Public Methods:**
- `bootstrap(audit_app_id)` - Link to AuditLog (called once after deploy)
- `add_record(patient, cid, previous_cid, record_type, bill_amount)` - Upload new medical record
  - Increments record counter
  - Appends to patient's record history
  - Logs to AuditLog contract
  - Emits ARC-28 event: `RecordAdded`
- `add_prescription(patient, patient_name, cid)` - Add prescription to global queue
  - Creates queue item
  - Adds to patient history
  - Emits `PrescriptionAddedToQueue` event
- `get_pending_prescriptions()` - Returns all un-dispensed prescriptions
- `mark_prescription_dispensed(record_id, bill_amount)` - Mark prescription as dispensed
  - Updates bill amount in both queue and patient history
  - Emits `PrescriptionDispensed` event
- `get_patient_records(patient)` - Retrieve all records for a patient

**Role:** Central data repository; all medical records flow through this contract.

---

### 4. **AuditLog** (`smart_contracts/Auditlog/contract.py`)
**Purpose:** Immutable audit trail of all data access and consent changes via ARC-28 events.

**Event Structs:**
```python
ConsentGranted(principal, fiduciary, purpose, expiry, scopes)
ConsentRevoked(principal, fiduciary, timestamp)
DataAccessed(principal, fiduciary, purpose, timestamp, is_emergency)
AccessRequested(principal, fiduciary, purpose, timestamp)
ErasureRequested(principal, timestamp)
```

**Public Methods:**
- `log_consent_granted(principal, fiduciary, purpose, expiry, scopes)`
- `log_consent_revoked(principal, fiduciary, timestamp)`
- `log_data_accessed(principal, fiduciary, purpose, timestamp, is_emergency)`
- `log_access_requested(principal, fiduciary, purpose, timestamp)`
- `log_erasure_requested(principal, timestamp)`

**Role:** Write-only audit contract; other contracts call it via inner transactions to log events. Events are queryable via Algorand indexers.

---

### 5. **DataAccessManager** (`smart_contracts/DataAccessManager/contract.py`)
**Purpose:** Orchestrates data access by validating consent and logging access.

**Global State:**
- `consent_manager_app` - App ID of consent manager (future expansion)
- `audit_app` - App ID of AuditLog
- `queue_app` - App ID of QueueManager

**Public Methods:**
- `bootstrap(consent_manager_app_id, audit_app_id, queue_app_id)` - Link to other contracts
- `access_data(principal, index, scope, purpose)` - Normal data access with consent validation
  - Calls consent manager to validate consent
  - Logs to AuditLog as is_emergency=false
- `emergency_access(principal, request_id, purpose)` - Emergency data access
  - Verifies QueueManager approval status
  - Logs to AuditLog as is_emergency=true

**Role:** Gateway for data access; ensures all accesses are logged and (eventually) consent-validated.

---

### 6. **DataFiduciaryRegistry** (`smart_contracts/DataFiduciaryRegistry/contract.py`)
**Purpose:** Registry of approved healthcare providers (fiduciaries) and their status.

**Data Structure:**
```python
Fiduciary {
    name: String,
    license_id: String,
    approved: Bool,
    suspended: Bool,
    revoked: Bool
}
```

**Global State:**
- `admin` - Admin address (deployer)
- `fiduciaries` - BoxMap[Address → Fiduciary]

**Public Methods:**
- `register_fiduciary(name, license_id)` - Any account can self-register (pending approval)
  - Emits `FiduciaryRegistered` event
- `approve_fiduciary(fiduciary)` - Admin approves a fiduciary
- `suspend_fiduciary(fiduciary)` - Admin temporarily suspends access
- `revoke_fiduciary(fiduciary)` - Admin permanently revokes access
- `is_approved(fiduciary)` - Check if fiduciary is active (approved, not suspended, not revoked)
- `get_fiduciary(fiduciary)` - Retrieve fiduciary details

**Role:** Provider governance; ensures only qualified healthcare providers can interact with the system.

---

### 7. **QueueManager** (`smart_contracts/QueueManager/contract.py`)
**Purpose:** Manages access request queues with emergency prioritization.

**Data Structure:**
```python
QueueRequest {
    id: uint64,
    requester: Address,
    target: Address,         # Patient (data subject)
    purpose: String,
    request_type: uint8,     # 1=Normal, 2=Emergency
    timestamp: uint64,
    status: uint8            # 0=Pending, 1=Approved, 2=Rejected, 3=Expired
}
```

**Global State:**
- `request_counter` - Incremental request ID
- `admin` - Hardcoded admin for emergency overrides
- `requests` - BoxMap[UInt64 → QueueRequest]
- `patient_requests` - BoxMap[Address → DynamicArray[UInt64]]

**Public Methods:**
- `submit_request(target, purpose, is_emergency)` - Create new access request
  - Returns request ID
  - Sets type to 2 if emergency, else 1
  - Emits `RequestSubmitted` event
- `approve_request(request_id)` - Approve a request
  - For emergency: only admin or target can approve
  - For normal: only target patient can approve
  - Status → 1
- `reject_request(request_id)` - Reject a request
  - Similar permissions to approve
  - Status → 2
- `check_status(request_id)` - Quick status check (helper)
- `get_patient_queue(patient)` - Retrieve patient's requests (emergency pending first, then normal)
- `get_request(request_id)` - Retrieve specific request details

**Role:** Request orchestration; handles both routine consent and emergency access workflows.

---

### 8. **VolunteerRegistry** (`smart_contracts/VolunteerRegistry/contract.py`)
**Purpose:** Track volunteer healthcare workers with hashed identity.

**Data Structure:**
```python
Volunteer {
    cid: String,      # IPFS content hash of volunteer data
    active: Bool
}
```

**Global State:**
- `volunteers` - BoxMap[bytes32 (hash) → Volunteer]

**Public Methods:**
- `add_volunteer(hash_id, cid)` - Register a volunteer with hashed identity
  - Emits `VolunteerAdded` event
- `update_status(hash_id, active)` - Enable/disable volunteer
  - Emits `StatusUpdated` event
- `get_volunteer(hash_id)` - Retrieve volunteer details

**Role:** Privacy-preserving volunteer management; identity hashing protects volunteer data.

---

### 9. **WalletMapper** (`smart_contracts/WalletMapper/contract.py`)
**Purpose:** Map patient wallets to short IDs and manage beneficiary relationships.

**Data Structure:**
```python
BeneficiaryRecord {
    beneficiary_id: bytes[6],  # Short ID
    beneficiary_wallet: Address,
    hashed_password: String,
    created_at: uint64
}
```

**Global State:**
- `short_id_to_address` - BoxMap[bytes[6] → Address]
- `address_to_short_id` - BoxMap[Address → bytes[6]]
- `beneficiaries` - BoxMap[Address → DynamicArray[BeneficiaryRecord]]

**Public Methods:**
- `fund_app(pay)` - Helper to fund contract MBR (no-op in logic, used for payment tracking)
- `register_short_id(short_id)` - Caller registers a 6-byte short ID
  - Idempotent: same ID twice returns; different ID requires clear
  - Emits `ShortIdRegistered` event
- `clear_registration()` - Remove short ID mapping
- `get_wallet_from_short_id(short_id)` - Lookup wallet by short ID
- `get_short_id_from_wallet(wallet)` - Lookup short ID by wallet
- `add_beneficiary(beneficiary_id, hashed_password)` - Add proxy beneficiary
  - Prevents self-beneficiary and duplicates
  - Stores hashed password for later verification
- `clear_beneficiaries()` - Remove all beneficiaries for caller
- `get_beneficiaries(owner)` - Retrieve all beneficiaries for an address

**Role:** Identity mapping; enables shorter patient IDs while supporting healthcare proxy/beneficiary relationships.

---

## Deployment Architecture

### Project Structure
```
projects/ojasraksha-contracts/
├── smart_contracts/
│   ├── __init__.py
│   ├── __main__.py
│   ├── index.ts                    # TypeScript deployment orchestrator
│   ├── config.py                   # Python build config
│   ├── AccessControl/
│   │   ├── contract.py
│   │   └── deploy-config.ts
│   ├── HealthcareRBAC/
│   │   ├── contract.py
│   │   └── deploy-config.ts
│   ├── MedicalRecords/
│   │   ├── contract.py
│   │   └── deploy-config.ts
│   ├── AuditLog/
│   │   ├── contract.py
│   │   └── deploy-config.ts
│   ├── DataAccessManager/
│   │   ├── contract.py
│   │   └── deploy-config.ts
│   ├── DataFiduciaryRegistry/
│   │   ├── contract.py
│   │   └── deploy-config.ts
│   ├── QueueManager/
│   │   ├── contract.py
│   │   └── deploy-config.ts
│   ├── VolunteerRegistry/
│   │   ├── contract.py
│   │   └── deploy-config.ts
│   └── WalletMapper/
│       ├── contract.py
│       └── deploy-config.ts
├── package.json                    # npm dependencies
├── pyproject.toml                  # Python/Poetry config
└── tsconfig.json
```

### Deployment Flow
1. **Build** (`algokit project run build`):
   - Python Puya compiler converts contract.py → TEAL
   - Generates ARC-56 JSON artifacts
   - Generates TypeScript client stubs

2. **Deploy** (`algokit project run deploy localnet`):
   - `index.ts` reads all `deploy-config.ts` files
   - Each contract's deployer runs in sequence
   - Contracts are created on Algorand
   - App IDs are captured

3. **Bootstrap**:
   - After all contracts deployed, linking methods called:
     - `MedicalRecords.bootstrap(audit_app_id)`
     - `DataAccessManager.bootstrap(consent_app_id, audit_app_id, queue_app_id)`
   - Cross-contract inner transaction calls enabled

### Environment Configuration
- `.env.localnet` - LocalNet development (Algorand in Docker)
- `.env.testnet` - Algorand Testnet
- `.env.mainnet` - Algorand Mainnet (production)

---

## Data Flow Examples

### Example 1: Patient Medical Record Upload
```
1. Doctor (provider) calls:
   MedicalRecords.add_record(
       patient=alice_addr,
       cid="QmXxxx...",           # IPFS hash of encrypted record
       record_type="Lab Result",
       bill_amount=50000000       # microAlgos
   )

2. MedicalRecords contract:
   - Increments record_counter
   - Creates Record struct
   - Appends to patient_records[alice_addr]
   - Calls via inner txn:
     AuditLog.log_data_accessed(
         principal=alice_addr,
         fiduciary=doctor_addr,
         purpose="Uploaded new record",
         timestamp=now,
         is_emergency=false
     )
   - Emits ARC-28 event: RecordAdded

3. Audit trail exists on-chain in AuditLog events
4. Medical data (encrypted) stored on IPFS
```

### Example 2: Prescription Workflow
```
1. Doctor calls:
   MedicalRecords.add_prescription(
       patient=alice_addr,
       patient_name="Alice Smith",
       cid="QmYyyy..."
   )

2. MedicalRecords:
   - Creates prescription queue item
   - Adds to prescription_queue (keyed by index)
   - Adds to patient history
   - Logs to AuditLog

3. Pharmacy retrieves pending prescriptions:
   MedicalRecords.get_pending_prescriptions()
   → Returns all items with is_dispensed=false

4. Pharmacy dispenses:
   MedicalRecords.mark_prescription_dispensed(
       record_id=1,
       bill_amount=25000000  # microAlgos
   )

5. MedicalRecords:
   - Finds prescription in queue
   - Sets is_dispensed=true
   - Updates bill_amount in both queue and patient history
   - Emits PrescriptionDispensed event
```

### Example 3: Emergency Data Access
```
1. ER Doctor initiates emergency:
   request_id = QueueManager.submit_request(
       target=patient_addr,
       purpose="Emergency trauma assessment",
       is_emergency=true
   )

2. Hospital Admin approves:
   QueueManager.approve_request(request_id)
   → Only admin or patient can approve emergencies

3. ER Doctor accesses data:
   DataAccessManager.emergency_access(
       principal=patient_addr,
       request_id=request_id,
       purpose="Emergency trauma assessment"
   )

4. DataAccessManager:
   - Verifies status == 1 (approved) via QueueManager
   - Logs to AuditLog with is_emergency=true
   - Grant proceeds

5. Audit shows emergency access with timestamp
```

---

## Security Considerations

### Hardcoded Addresses
Several contracts hardcode a super admin address:
```
ZB4FKAVJU6E3ANTCSPPA5PSSIA35XUUA4O2GASDKZVDLUNZ4DMPLYJMVKM
```
This is acceptable for governance initialization but should be rotated in production.

### Access Control Patterns
1. **HealthcareRBAC**: Role-based checks via bitmasks
2. **Approver checks**: Only target patient or admin can approve access requests
3. **Admin guards**: Only admins can revoke or suspend providers

### Data Privacy
- Off-chain storage: Medical records stored on IPFS (encrypted by application layer)
- On-chain: Only references (CID) and metadata on-chain
- Audit trail: Events logged immutably but queryable

### Audit Trail
- All data access logged via AuditLog contract
- Events enable compliance audits
- Timestamps prove when access occurred
- Emergency flag distinguishes routine vs. critical access

---

## Development Workflow

### Local Development
```bash
# Start local Algorand network
algokit localnet start

# Install dependencies
algokit project bootstrap all

# Build contracts
algokit project run build

# Deploy contracts
algokit project run deploy localnet

# Run tests (if configured)
algokit project run test
```

### Contract Modification
1. Edit contract.py
2. Run `algokit project run build`
3. Review generated TEAL in artifacts/
4. Update deploy-config.ts if new params needed
5. Test via deploy to localnet

### Debugging
- Use AlgoKit AVM Debugger VS Code extension
- Enable debug logging in index.ts
- Monitor local node logs: `algokit localnet logs`

---

## Testnet/Mainnet Deployment

### Prerequisites
1. Create .env.testnet or .env.mainnet
2. Set ALGOD_SERVER, ALGOD_TOKEN, INDEXER_SERVER, INDEXER_TOKEN
3. Fund deployer account at https://bank.testnet.algorand.network/ (testnet)

### Deploy
```bash
algokit project deploy testnet
```

### Verify
```bash
algokit app call --name MedicalRecords --method get_patient_records testnet
```

---

## Future Enhancements

### Planned Features
1. **Consent Manager Contract** - Formal consent workflow with expiry
2. **Data Marketplace** - Enable patients to monetize anonymized data
3. **Insurance Integration** - Direct insurance claim processing
4. **Multi-Sig Governance** - DAOs for community oversight
5. **Privacy Proofs** - ZK proofs for compliance verification

### Known Limitations
1. No consensus-based consent validation (centralized approval)
2. Prescription queue O(n) iteration on dispensing
3. No expiry logic for emergency access requests
4. Volunteer registry hash collision potential (mitigated by 32-byte hash)

---

## Testing & Validation

### Test Coverage Areas (to implement)
- Access control enforcement (unauthorized calls should fail)
- Record storage and retrieval
- Prescription workflow state transitions
- Audit logging completeness
- Cross-contract inner call success

### Current Status
- Contracts compiled and deployed to testnet (commit ba711f1)
- account.txt generated for testnet wallet
- Build/deploy errors exist in historical logs (resolved in v1.0)

---

## Troubleshooting

### Common Issues

**Build Error: "Module not found"**
```bash
poetry install
algokit project bootstrap all
```

**Deploy fails: "Insufficient balance"**
→ Fund testnet account at faucet: https://bank.testnet.algorand.network/

**Inner transaction fails: "App not found"**
→ Ensure bootstrap() called to link app IDs

**Box MBR insufficient**
→ Call WalletMapper.fund_app() with sufficient payment to cover box storage

---

## References

- [Algorand Developer Docs](https://developer.algorand.org/)
- [AlgoKit Documentation](https://algorandfoundation.github.io/algokit-cli/)
- [Puya (Python → TEAL)](https://github.com/algorandfoundation/puya)
- [ARC-28 Events Spec](https://github.com/algorandfoundation/ARCs/blob/main/ARCs/arc-0028.md)
- [Algorand SDK (TypeScript)](https://github.com/algorandfoundation/js-algorand-sdk)

---

## Team & Contacts

**Project:** Aegis-Care v1.0  
**Status:** Initial Release (Healthcare RBAC + Medical Records + Audit)  
**Git:** Main branch (ba711f1 V1.0, 34d47ca Initial commit)

---

*Documentation generated: 2026-04-18*
*Last Updated: v1.0 Release*
