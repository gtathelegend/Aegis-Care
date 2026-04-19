# Pinata IPFS Integration Setup

## Overview
Aegis Care now supports live IPFS file uploads via Pinata. All prescription uploads and medical records are stored on IPFS with persistent pinning.

## Setup Steps

### 1. Get Pinata JWT
1. Visit [Pinata Dashboard](https://app.pinata.cloud/developers/api-keys)
2. Create a new API key with "Admin" permissions
3. Copy the JWT token

### 2. Configure Environment Variables
Create a `.env.local` file in the `frontend/` directory:

```bash
# Copy from .env.local.example
cp frontend/.env.local.example frontend/.env.local

# Then edit and add your Pinata JWT:
NEXT_PUBLIC_PINATA_JWT=your_jwt_token_here
```

### 3. Verify Setup
Run the development server and test:

```bash
cd frontend
npm run dev
```

Then:
1. Navigate to `/doctor-dashboard` → "Upload Prescription"
2. Fill in prescription details and **select a PDF/image file**
3. Submit → File will be uploaded to Pinata IPFS
4. Check the IPFS hash in browser console or network tab

## How It Works

### File Upload Flow
```
Doctor uploads file
    ↓
PrescriptionModal calls /api/upload
    ↓
API route sends file to Pinata
    ↓
Pinata returns IPFS hash (CID)
    ↓
Hash stored in MedicalRecord (ipfsHash field)
    ↓
Record accessible via gateway URL
```

### API Endpoint
**POST `/api/upload`**

Request:
```javascript
const formData = new FormData();
formData.append('file', file);
formData.append('recordType', 'prescription');

const response = await fetch('/api/upload', {
  method: 'POST',
  body: formData,
});
```

Response:
```json
{
  "success": true,
  "cid": "QmXxxx...",
  "ipfsHash": "QmXxxx...",
  "size": 1024,
  "gateway": "https://gateway.pinata.cloud/ipfs/QmXxxx..."
}
```

## Accessing Files

All uploaded files are accessible via:
```
https://gateway.pinata.cloud/ipfs/{IPFS_HASH}
```

Example:
```
https://gateway.pinata.cloud/ipfs/QmXxxx...
```

## Features

✅ **Live IPFS Integration** - Files stored on Pinata IPFS  
✅ **Persistent Pinning** - Files remain pinned indefinitely  
✅ **Gateway URLs** - Direct access to files via HTTP gateway  
✅ **Metadata Tracking** - Record type & upload timestamp stored with file  
✅ **Error Handling** - User-friendly error messages on upload failure  

## Testing

### Manual Testing Checklist
- [ ] Upload prescription with PDF file → IPFS hash generated
- [ ] Upload prescription without file → uses mock CID
- [ ] Share record with provider → creates consent entry
- [ ] Check hospital prescription queue → shows uploaded prescriptions
- [ ] Mark prescription dispensed → status updates

### Console Debugging
Open browser DevTools → Network tab:
1. Look for `POST /api/upload` request
2. Verify Pinata API response contains `IpfsHash`
3. Check MedicalRecord in mockdb has real IPFS hash

## Troubleshooting

### "Pinata JWT not configured"
**Solution:** Add `NEXT_PUBLIC_PINATA_JWT` to `.env.local`

### Upload fails with 401
**Solution:** JWT token is invalid or expired. Get a new one from Pinata Dashboard.

### Upload fails with 413
**Solution:** File is too large (Pinata limit is 100MB). Try a smaller file.

### IPFS file not accessible
**Solution:** Wait 30 seconds for Pinata to pin the file, then try the gateway URL.

## Security Notes

⚠️ **Do not commit `.env.local` to git** - it contains your Pinata JWT  
✅ `.env.local` is already in `.gitignore`  
✅ JWT is only used server-side (in `/api/upload`)  
✅ Public gateway URLs do not expose JWT

## Future Integration: Smart Contracts

Once ready, wire IPFS hashes to Algorand smart contracts:

```typescript
// Example (future)
const record = addRecord({...});
await MedicalRecords.add_record(
  patient_address,
  record.ipfsHash,  // CID from Pinata
  record_type,
  bill_amount
);
```

The groundwork is already in place with:
- ✅ `ipfsHash` field in MedicalRecord type
- ✅ Real Pinata uploads working
- ✅ Audit logging in place
- ✅ Transaction hash placeholder (`txHash`)

## References

- [Pinata Documentation](https://docs.pinata.cloud)
- [IPFS Gateway Specification](https://specs.ipfs.tech/http-gateways/)
- [Algorand Integration Guide](./BLOCKCHAIN_INTEGRATION_SETUP.md)
