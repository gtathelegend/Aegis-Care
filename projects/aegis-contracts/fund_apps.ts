import * as algokit from '@algorandfoundation/algokit-utils';
import algosdk from 'algosdk';
import * as dotenv from 'dotenv';

dotenv.config();

const appIds = [
  758214385, // WalletMapper
  758207912, // ConsentManager
  758329477, // MedicalRecords (Hardened)
  758207980, // VolunteerRegistry
  758208017, // AuditLog
  758208070, // AccessControl
  758207872, // DataFiduciaryRegistry
  758327051, // HealthcareRBAC
  758207942  // MedicalRecords (Old/Screenshot)
];

async function fundApps() {
  const algorand = algokit.AlgorandClient.fromEnvironment();
  const deployer = await algorand.account.fromEnvironment('DEPLOYER');

  console.log(`\n🚀 Initializing Global App Funding from: ${deployer.addr}`);
  
  for (const appId of appIds) {
    const appAddr = algosdk.getApplicationAddress(appId);
    console.log(`\n------------------------------------------------`);
    console.log(`🌐 Funding App ID: ${appId}`);
    console.log(`👤 App Address: ${appAddr}`);
    
    try {
      // Check current balance
      const info = await algorand.client.algod.accountInformation(appAddr).do();
      const currentBalance = Number(info.amount) / 1_000_000;
      console.log(`💰 Current Balance: ${currentBalance} ALGO`);

      if (currentBalance < 1.0) {
          console.log(`💸 Funding with 2 ALGO...`);
          const result = await algorand.send.payment({
            sender: deployer.addr,
            receiver: appAddr,
            amount: (2).algo(),
          });
          console.log(`✅ Success! TxID: ${result.transaction.txID()}`);
      } else {
          console.log(`⏭️ Sufficient balance. Skipping.`);
      }
    } catch (e: any) {
      console.error(`❌ Failed to fund App ${appId}: ${e.message}`);
    }
  }

  console.log('\n✨ Global Funding Operations Complete.');
}

fundApps().catch(console.error);
