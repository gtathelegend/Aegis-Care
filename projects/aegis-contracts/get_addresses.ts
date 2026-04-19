import algosdk from 'algosdk'

const appIds = [
  758214385, // WalletMapper
  758207912, // ConsentManager
  758329477, // MedicalRecords (Hardened)
  758207980, // VolunteerRegistry
  758208017, // AuditLog
  758208070, // AccessControl
  758207872, // DataFiduciaryRegistry
  758327051, // HealthcareRBAC
]

console.log('--- App Addresses for Aegis ---')
appIds.forEach((id) => {
  const addr = algosdk.getApplicationAddress(id)
  console.log(`App ID ${id}: ${addr}`)
})
