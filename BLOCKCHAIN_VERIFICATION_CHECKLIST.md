# Patient Dashboard Blockchain Verification Checklist

## Problem: Patient Dashboard Still Shows Mock Data

If your patient dashboard is showing mock data instead of blockchain data, follow this checklist:

---

## ✅ Step 1: Verify Contract Deployment

### Check if contracts are deployed on LocalNet:

```bash
# Start LocalNet first
algokit localnet start

# Deploy contracts
cd projects/aegis-contracts
algokit project deploy localnet

# Look for output like:
# MedicalRecords deployed: app_id=12347
# HealthcareRBAC deployed: app_id=12346
# WalletMapper deployed: app_id=12345
```

### Verify contracts are running:
```bash
# Check LocalNet is healthy
algokit localnet status

# If issues, try:
algokit localnet reset
algokit localnet start
```

---

## ✅ Step 2: Verify Environment Variables

### Check `.env.local` has all required variables:

```bash
# Open projects/aegis-frontend/.env.local
# Should have ALL of these:

VITE_WALLET_MAPPER_APP_ID=12345
VITE_HEALTHCARE_RBAC_APP_ID=12346
VITE_MEDICAL_RECORDS_APP_ID=12347
VITE_QUEUE_MANAGER_APP_ID=12348
VITE_AUDIT_LOG_APP_ID=12349

VITE_ALGOD_SERVER=http://localhost:4001
VITE_ALGOD_TOKEN=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
VITE_INDEXER_SERVER=http://localhost:8980
VITE_INDEXER_TOKEN=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa

VITE_PINATA_JWT=<your_pinata_jwt_here>
```

### The app IDs MUST match deployed contracts:
```bash
# If you see "not found" errors, the app IDs don't match

# Re-check deployed app IDs:
cd projects/aegis-contracts
algokit project deploy localnet --verbose

# Copy the correct app IDs to .env.local
```

---

## ✅ Step 3: Check Browser Console for Errors

### Open Developer Console (F12 or right-click → Inspect):

Go to **Console** tab and look for:

#### 🔴 Error: "MedicalRecords contract not configured"
```
Message: MedicalRecords contract not configured. Check VITE_MEDICAL_RECORDS_APP_ID
Fix: App ID is 0 or missing from .env.local
Action: Verify VITE_MEDICAL_RECORDS_APP_ID is set to deployed app ID
```

#### 🔴 Error: "app not found"
```
Message: app not found
Fix: App ID doesn't exist on this network
Action: 
  1. Verify app ID is correct
  2. Verify LocalNet is running (algokit localnet status)
  3. Re-deploy contracts with fresh app IDs
```

#### 🔴 Error: "Patient has no records yet"
```
Message: Patient has no records yet
Fix: Blockchain is working, but no records for this wallet
Action: 
  1. ✓ This is NORMAL if no prescriptions have been uploaded
  2. Try uploading a test prescription from Doctor dashboard
  3. Then refresh patient dashboard
```

#### 🟢 Success: "✓ Blockchain data"
```
Message: (in breadcrumb) ✓ Blockchain data
Fix: Working correctly!
Action: Data is being fetched from blockchain successfully
```

---

## ✅ Step 4: Check Network Connection

### Verify LocalNet is accessible:

```bash
# Test Algod endpoint
curl -s http://localhost:4001/health | jq .

# Test Indexer endpoint
curl -s http://localhost:8980/health | jq .

# Should return JSON responses with status info
```

### If endpoints not responding:
```bash
# Restart LocalNet
algokit localnet stop
algokit localnet start --verbose

# Wait 30 seconds for services to fully start
sleep 30

# Re-test endpoints
```

---

## ✅ Step 5: Verify Wallet Connection

### Make sure wallet is properly connected:

1. **Check top-right corner** of browser:
   - Should show connected wallet address
   - Format: `0x...` or Algorand address format
   - Should be green/highlighted

2. **Check breadcrumb** shows:
   - `Patient · Overview` (correct role detected)
   - Loading indicator (`⟳`) while fetching
   - Success indicator (`✓ Blockchain data`) when ready
   - Or error message if something failed

3. **Check browser console** for role info:
   ```
   [useRole] Identity resolved: shortId=847KOR
   [useRole] Roles detected: ['patient', 'doctor']
   ```

### If wallet not connected:
```
1. Click "Connect Wallet" button
2. Select test wallet (with Algo funds)
3. Approve connection in wallet modal
4. Wait for dashboard to reload
5. Check console for [useRole] logs
```

---

## ✅ Step 6: Test with Mock Data (Fallback)

### If blockchain isn't working, you should see:

**BEFORE fix:** Dashboard loads with mock data (hardcoded prescriptions)
**AFTER fix:** Dashboard either shows:
- ✓ Real blockchain data
- ⚠ "No medical records found" (empty state)
- ⚠ Error message with debugging info

### To test fallback works:
```
1. Close LocalNet: algokit localnet stop
2. Reload browser
3. Should see error in console: "Contract not configured"
4. Dashboard should show helpful error message
5. Don't show mock data silently
```

---

## ✅ Step 7: Monitor Network Requests

### Open Network Tab (F12 → Network):

Look for requests to:
- `http://localhost:4001/...` (Algod RPC calls)
- `http://localhost:8980/...` (Indexer queries)

### Healthy network activity:
```
✓ POST /v2/transactions (wallet connection)
✓ GET /v2/accounts/{address} (fetch user role)
✓ GET /v2/applications/{appId}/box?name=... (fetch records)
```

### If you see errors:
```
✗ Failed to load resource: Connection refused
✗ 404 Not Found
✗ 500 Internal Server Error

Fix: LocalNet not running or endpoints are wrong in .env.local
```

---

## ✅ Step 8: Check Smart Contract State

### Query contract state directly:

```bash
# Check if MedicalRecords has any records stored
algokit goal app read --app-id 12347 --global-state

# Check patient's records box
algokit goal app box read --app-id 12347 --box-name "patient_records_0x..."

# If empty, no prescriptions have been uploaded yet
# This is normal! Upload a test prescription and try again.
```

---

## 🧪 Complete Test Procedure

### To fully verify everything works:

```bash
# Terminal 1: Start LocalNet
algokit localnet start

# Terminal 2: Deploy contracts
cd projects/aegis-contracts
algokit project deploy localnet

# Copy app IDs from output, update .env.local

# Terminal 3: Start dev server
cd projects/aegis-frontend
npm run dev

# Browser: Navigate to http://localhost:5173/patient
# 1. Click "Connect Wallet"
# 2. Wait for dashboard to load
# 3. Check breadcrumb: should say "✓ Blockchain data" or "No medical records found"
# 4. Go to Doctor dashboard (/doctor)
# 5. Fill prescription form and click Upload
# 6. Go back to Patient dashboard (/patient)
# 7. Refresh page
# 8. Prescription should appear!

# Console: Should see logs like:
# [useRole] Identity resolved: shortId=847KOR
# [useMedicalRecords] Fetching for patient: 0x...
# [useMedicalRecords] Received records: 1
# [useMedicalRecords] Enriched records count: 1
```

---

## 📊 Debug Checklist Table

| Item | Status | Action |
|------|--------|--------|
| LocalNet running | ✓ | `algokit localnet status` |
| Contracts deployed | ✓ | `algokit project deploy localnet` |
| App IDs correct | ✓ | Check `.env.local` matches output |
| Wallet connected | ✓ | Check top-right corner shows address |
| Role detected | ✓ | Check console: `[useRole] Roles detected: ...` |
| Blockchain fetching | ✓ | Check breadcrumb: `⟳ Loading...` then `✓ Blockchain data` |
| Error messages helpful | ✓ | Check console shows detailed error info |
| Fallback to mock data | ✓ | Graceful error handling when blockchain down |

---

## 🆘 Common Issues & Solutions

### Issue: "Contract not configured"
**Cause:** `VITE_MEDICAL_RECORDS_APP_ID` is 0 or missing  
**Fix:** Add correct app ID to `.env.local` and restart dev server

### Issue: "Patient has no records yet"
**Cause:** Wallet is correct, but no prescriptions uploaded  
**Fix:** This is normal. Upload a prescription from Doctor dashboard first.

### Issue: Dashboard shows mock data instead of error
**Cause:** Old fallback logic is still active  
**Fix:** Clear browser cache, restart dev server, hard refresh (Ctrl+Shift+R)

### Issue: "Connection refused" to localhost:4001
**Cause:** LocalNet not running  
**Fix:** `algokit localnet start`

### Issue: Error says "app not found"
**Cause:** App ID doesn't exist on this network  
**Fix:** Verify app ID is correct, re-deploy contracts

### Issue: Wallet connected but role says "unknown"
**Cause:** Wallet not registered in HealthcareRBAC  
**Fix:** Admin needs to register wallet with a role first

### Issue: Records load but show "No medical records found"
**Cause:** No prescriptions have been uploaded for this wallet  
**Fix:** This is correct behavior. Upload a prescription first.

---

## 📈 Visual Indicators to Look For

### Patient Dashboard Breadcrumb Should Show:

```
GOOD STATE:
├─ Patient · Overview ✓ Blockchain data
│  (Green checkmark - data loaded successfully)
│
├─ Patient · Overview ⟳ Loading blockchain data...
│  (Spinner - still fetching)
│
├─ Patient · Overview ⚠ Patient has no records yet
│  (Yellow warning - blockchain working, no data)
│
PROBLEM STATE:
├─ Patient · Overview ⚠ Contract not configured
│  (Red error - environment variable issue)
│
├─ Patient · Overview ⚠ app not found
│  (Red error - wrong app ID)
│
├─ (Shows mock data with no indicator)
│  (Not showing blockchain status - needs fix)
```

---

## 🎯 Expected Behavior After Fix

### When you connect wallet to Patient Dashboard:

1. **Breadcrumb updates:**
   - Shows "⟳ Loading blockchain data..."

2. **Within 2-3 seconds:**
   - Shows "✓ Blockchain data"
   - OR shows error message
   - OR shows "No medical records found" (if no prescriptions yet)

3. **Dashboard displays:**
   - ✓ Real blockchain records (if any exist)
   - ✓ NOT mock hardcoded data
   - ✓ Clear empty state if no records
   - ✓ Helpful error message if blockchain issues

4. **After uploading prescription from Doctor dashboard:**
   - Patient dashboard refreshes
   - New prescription appears immediately
   - Shows correct provider name and date
   - QR code works for sharing

---

## 🚀 Success Criteria

Dashboard is working correctly when:
- ✅ Breadcrumb shows blockchain indicator (not silent fallback)
- ✅ Console shows debug logs for fetching
- ✅ Prescribed prescriptions appear after upload
- ✅ Empty state shown when no records (not mock data)
- ✅ Errors are helpful and point to solution
- ✅ Works without hardcoded test data

---

## 📞 Still Having Issues?

1. Check browser **Console** tab (F12)
2. Look for `[useMedicalRecords]` and `[useRole]` logs
3. Check **Network** tab for request failures
4. Verify all environment variables in `.env.local`
5. Try fresh deployment: `algokit localnet reset && algokit project deploy localnet`
6. Check that wallet is connected (address shown in UI)
7. Look for detailed error messages in UI breadcrumb area
