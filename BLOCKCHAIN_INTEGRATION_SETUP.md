# Blockchain Integration Setup Guide
## Aegis Care - Patient Data Management on Algorand

This guide walks you through setting up and testing the dynamic blockchain-integrated dashboards with real Algorand smart contracts.

---

## 🎯 Overview

The dashboards now support:
- **Patient Dashboard**: View encrypted medical records from blockchain
- **Doctor Dashboard**: Upload medical records for patients via Pinata IPFS
- **Hospital Dashboard**: Bulk upload records for patients
- **Wallet Integration**: Pera Algo wallet for patient profile management
- **QR Code Sharing**: Generate shareable links for patient profiles

---

## 🔧 Prerequisites

### 1. **Algorand Environment**
- **LocalNet** (development) or **Testnet** (testing)
- Deployment of Aegis Care smart contracts
- Contract app IDs for:
  - `MedicalRecords`
  - `WalletMapper`
  - `DataAccessManager`
  - `QueueManager`
  - `AuditLog`
  - `HealthcareRBAC`

### 2. **Pinata IPFS Account**
- Sign up at https://pinata.cloud
- Generate API JWT token
- Minimum: Free tier (supports encrypted file uploads)

### 3. **Environment Variables**
- Pera wallet ready (built-in to browser)
- Node.js 18+ installed

---

## ⚙️ Configuration Steps

### Step 1: Set Up Environment Variables

Edit `.env.localnet` or `.env.testnet`:

```bash
# Algorand Network Configuration
VITE_ALGOD_NETWORK=localnet          # or 'testnet'
VITE_ALGOD_SERVER=http://localhost:4001  # LocalNet, or testnet server
VITE_ALGOD_TOKEN=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
VITE_INDEXER_SERVER=http://localhost:8980  # LocalNet indexer
VITE_INDEXER_TOKEN=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa

# Pinata IPFS Configuration (CRITICAL FOR FILE UPLOADS)
VITE_PINATA_JWT=your_pinata_jwt_token_here

# Contract App IDs (from deployment)
VITE_MEDICAL_RECORDS_APP_ID=1234
VITE_WALLET_MAPPER_APP_ID=1235
VITE_DATA_ACCESS_MANAGER_APP_ID=1236
VITE_QUEUE_MANAGER_APP_ID=1237
VITE_AUDIT_LOG_APP_ID=1238
VITE_HEALTHCARE_RBAC_APP_ID=1239
```

### Step 2: Get Pinata JWT Token

1. Go to https://pinata.cloud/keys
2. Click "New Key"
3. Copy the JWT token
4. Paste into `VITE_PINATA_JWT` in your `.env` file

### Step 3: Deploy Smart Contracts

```bash
cd projects/Aegis-contracts

# LocalNet Setup
algokit localnet start
algokit project bootstrap all
algokit project run build
algokit project run deploy localnet

# Testnet Setup (ensure testnet account is funded)
algokit project run deploy testnet
```

After deployment, capture the app IDs from the output and update your `.env` file.

### Step 4: Fund Testnet Account (if using Testnet)

```bash
# Get your account address from Pera wallet
# Go to https://bank.testnet.algorand.network/
# Paste your address to receive test Algos
```

---

## 🚀 Running the Development Server

```bash
cd projects/Aegis-frontend

# Install dependencies
npm install

# Run dev server
npm run dev
```

Access the app at `http://localhost:5173`

---

## 📋 Testing Workflow

### A. Patient Dashboard

**Goal**: View encrypted medical records from blockchain

1. **Connect Wallet**:
   - Click "Connect Wallet" on landing page
   - Select "Pera Wallet"
   - Approve in Pera popup
   - Auto-redirects to `/patient`

2. **View Profile**:
   - Profile shows your short ID (e.g., "847KOR")
   - Wallet address displayed
   - QR code available for sharing

3. **Fetch Records**:
   - Navigate to "Records" section
   - Records fetch from `MedicalRecords` contract
   - Falls back to mock data if contract empty
   - Click record to open slider
   - Click QR button to generate shareable link

4. **Copy QR Link**:
   - QR modal shows encrypted share URL
   - URL format: `https://app.com/share/{record.id}?pid={patient.shortId}`
   - Copy or scan QR code

### B. Doctor Dashboard

**Goal**: Upload encrypted medical records for patients

1. **Login as Doctor**:
   - Go to `/doctor`
   - Connect wallet (Pera)
   - Lands on Doctor dashboard

2. **Upload Record for Patient**:
   - Go to "My Patients" section
   - Click "Upload" button next to patient name
   - Select record type (Lab, Imaging, Prescription, etc.)
   - Enter record title (e.g., "Blood Panel 2026-04")
   - Select file from computer
   - Click "Upload Record"

3. **What Happens Behind the Scenes**:
   ```
   a) File is encrypted with AES-256-GCM
   b) Encrypted file uploaded to Pinata IPFS
   c) CID returned from Pinata
   d) Contract call: MedicalRecords.add_record()
   e) Record stored on-chain with CID reference
   f) Audit log updated automatically
   g) Success message shows CID
   ```

4. **Verify Upload**:
   - Switch to patient wallet
   - Go to patient dashboard
   - Records section shows newly uploaded record
   - Click to open and verify content

### C. Hospital Dashboard

**Goal**: Bulk upload records for multiple patients

1. **Login as Hospital Admin**:
   - Go to `/hospital`
   - Connect wallet
   - Lands on Hospital dashboard

2. **Upload Records**:
   - Go to "Patient Registry" section
   - Click "Upload" next to each patient
   - Follow same upload flow as doctor

3. **Bulk Operations**:
   - Can upload for multiple patients sequentially
   - Each upload creates separate encrypted record
   - All tied to patient wallet addresses

---

## 🔐 Data Security

### File Encryption
```javascript
// All files are encrypted before upload:
1. Client-side encryption using Web Crypto API
2. AES-256-GCM cipher
3. Random IV generated per file
4. Auth tag for integrity verification
5. Encryption metadata bundled with encrypted data
```

### IPFS Storage
```javascript
// Encrypted files uploaded to Pinata IPFS:
1. File never stored unencrypted on IPFS
2. Only decryptable with patient's encryption key
3. IPFS CID stored on-chain as reference
4. Content-addressed (immutable reference)
```

### On-Chain Records
```javascript
// Smart contracts store:
1. Patient address (wallet ID)
2. Provider address (doctor/hospital)
3. IPFS CID (file reference)
4. Record type (lab, imaging, etc.)
5. Timestamp
6. Bill amount (optional)
7. Encryption metadata in event logs
```

---

## 🧪 Testing Scenarios

### Scenario 1: Single Doctor, Single Patient

```
1. Connect as Doctor (Pera wallet 1)
2. Upload lab result for Patient (Pera wallet 2)
3. Switch to Patient wallet (Pera wallet 2)
4. View uploaded record on patient dashboard
5. Share record via QR code
```

### Scenario 2: Hospital, Multiple Patients

```
1. Connect as Hospital (Pera wallet 3)
2. Upload discharge summary for Patient A
3. Upload imaging report for Patient B
4. Switch to Patient A wallet → see discharge summary
5. Switch to Patient B wallet → see imaging report
6. Verify different records for different patients
```

### Scenario 3: Consent & Access Control

```
1. Patient grants consent to Doctor (via QueueManager)
2. Doctor uploads record to patient
3. Hospital tries to access → blocked without consent
4. Patient grants consent to Hospital
5. Hospital can now access patient records
```

### Scenario 4: Audit Trail

```
1. Doctor uploads record → audit log updated
2. Hospital uploads record → audit log updated
3. Patient shares profile via QR → audit log updated
4. View complete audit trail showing all access events
```

---

## 🐛 Troubleshooting

### Issue: "Wallet not connected"
- **Solution**: Click "Connect Wallet" button
- Ensure Pera extension installed: https://perawallet.app

### Issue: "IPFS_CONFIG_ERROR: Pinata JWT not configured"
- **Solution**: Check `.env` file has `VITE_PINATA_JWT`
- Generate new JWT from https://pinata.cloud/keys
- Restart dev server after updating `.env`

### Issue: "MedicalRecords contract not found"
- **Solution**: Check `VITE_MEDICAL_RECORDS_APP_ID` in `.env`
- Verify contracts deployed: `algokit project run deploy localnet`
- Check contract client imports in `src/contracts/`

### Issue: "File too large"
- **Solution**: Max file size is 10MB
- Compress before uploading
- Update `MAX_FILE_SIZE` in `src/utils/ipfs.ts` if needed

### Issue: "Access denied" on contract call
- **Solution**: Verify user has required role (doctor/hospital)
- Check `HealthcareRBAC` contract for role assignments
- Ensure `activeAddress` matches registered provider

### Issue: Records not appearing after upload
- **Solution**: Wait 5-10 seconds (block confirmation)
- Refresh page
- Check browser console for errors
- Verify patient address matches in contract call

---

## 📊 Monitoring & Debugging

### View Contract State

```bash
# LocalNet: Use goal CLI
goal app read --app-id <app_id> --guess-format

# Testnet: Use AlgoExplorer
# https://testnet.algoexplorer.io/application/<app_id>
```

### View IPFS Files

```bash
# Check Pinata for uploaded files
# https://app.pinata.cloud/files

# Or fetch directly from IPFS
curl https://gateway.pinata.cloud/ipfs/<CID>
```

### View Blockchain Events

```bash
# Browser DevTools → Console
# Look for contract logs and transaction confirmations
```

### Enable Debug Logging

```javascript
// In src/hooks/useUploadRecord.ts
// Uncomment console.log statements:
console.log('Uploading file:', params.file.name);
console.log('Encrypted CID:', cid);
console.log('Contract call:', { patient, cid, type });
```

---

## 🚢 Deployment Checklist

- [ ] `.env` file configured with all required variables
- [ ] Pinata JWT token valid and active
- [ ] Smart contracts deployed and app IDs captured
- [ ] Test wallets funded (Testnet)
- [ ] Pera wallet installed in browser
- [ ] `npm install` and dependencies resolved
- [ ] `npm run dev` starts without errors
- [ ] Landing page loads, wallet connect works
- [ ] Can upload file to patient and see on dashboard
- [ ] QR code share link generated successfully
- [ ] Audit trail shows upload events

---

## 📚 Key Files

| File | Purpose |
|------|---------|
| `src/hooks/usePatientRecords.ts` | Fetch records from contract |
| `src/hooks/useUploadRecord.ts` | Encrypt & upload records |
| `src/hooks/useWalletProfile.ts` | Patient profile management |
| `src/components/UploadRecordModal.tsx` | File upload UI |
| `src/utils/ipfs.ts` | Pinata IPFS integration |
| `src/utils/crypto.ts` | AES-256-GCM encryption |
| `src/contracts/MedicalRecordsClient.ts` | Contract interactions |
| `src/pages/PatientPortal.tsx` | Patient dashboard |
| `src/pages/DoctorDashboard.tsx` | Doctor dashboard |
| `src/pages/HospitalPortal.tsx` | Hospital dashboard |

---

## 🔗 Useful Resources

- **Algorand**: https://developer.algorand.org/
- **AlgoKit**: https://algorandfoundation.github.io/algokit-cli/
- **Pinata**: https://docs.pinata.cloud/
- **Pera Wallet**: https://perawallet.app/
- **IPFS**: https://ipfs.io/
- **AES-256-GCM**: https://en.wikipedia.org/wiki/Galois/Counter_Mode

---

## ✅ Next Steps

1. **Complete Setup**: Follow configuration steps above
2. **Test Upload Flow**: Try uploading a test file
3. **Verify Records**: Confirm records appear on patient dashboard
4. **Share Profile**: Generate and test QR code sharing
5. **Monitor Events**: Check audit trail for all activities

---

**Questions?** Check the `CLAUDE.md` file for architecture details or the smart contract documentation in `projects/Aegis-contracts/`.
