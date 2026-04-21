import { AlgorandClient } from '@algorandfoundation/algokit-utils'

declare const __dirname: string
declare const require: any

const fs = require('fs')
const path = require('path')

// Factories
import { AccessControlFactory } from '../smart_contracts/artifacts/access_control/AccessControlClient'
import { AuditLogFactory } from '../smart_contracts/artifacts/audit_log/AuditLogClient'
import { ConsentManagerFactory } from '../smart_contracts/artifacts/consent_manager/ConsentManagerClient'
import { DataAccessManagerFactory } from '../smart_contracts/artifacts/data_access_manager/DataAccessManagerClient'
import { DataFiduciaryRegistryFactory } from '../smart_contracts/artifacts/data_fiduciary_registry/DataFiduciaryRegistryClient'
import { HealthcareRbacFactory } from '../smart_contracts/artifacts/healthcare_r_b_a_c/HealthcareRBACClient'
import { MedicalRecordsFactory } from '../smart_contracts/artifacts/medical_records/MedicalRecordsClient'
import { VolunteerRegistryFactory } from '../smart_contracts/artifacts/volunteer_registry/VolunteerRegistryClient'
import { WalletMapperFactory } from '../smart_contracts/artifacts/wallet_mapper/WalletMapperClient'
import { QueueManagerFactory } from '../smart_contracts/artifacts/queue_manager/QueueManagerClient'

export async function deployAll() {
  console.log('🚀 Starting Global Deployment...')
  const algorand = AlgorandClient.fromEnvironment()
  const deployer = await algorand.account.fromEnvironment('DEPLOYER')

  const FIXED_ADMIN = 'RGXCDITOJF7HQR5KOVUXNQNEDBWTN4UQFHIEJZTZQLIN2CMNET22FZYJWQ'
  if (deployer.addr.toString() !== FIXED_ADMIN) {
    throw new Error(`CRITICAL: Deployment using incorrect wallet ${deployer.addr.toString()}.`)
  }

  const commonParams = { algorand, defaultSender: deployer.addr }

  console.log('📦 Deploying Contracts...')

  // 1. AuditLog
  const auditLogDeployResult = await new AuditLogFactory(commonParams).deploy({
    onUpdate: 'append',
    onSchemaBreak: 'append',
  })
  const auditAppId = auditLogDeployResult.appClient.appId
  console.log(`✅ AuditLog: ${auditAppId}`)

  // 2. QueueManager
  const qManagerDeployResult = await new QueueManagerFactory(commonParams).deploy({
    onUpdate: 'append',
    onSchemaBreak: 'append',
  })
  const queueAppId = qManagerDeployResult.appClient.appId
  console.log(`✅ QueueManager: ${queueAppId}`)

  // 3. HealthcareRBAC
  const hRbacDeployResult = await new HealthcareRbacFactory(commonParams).deploy({
    onUpdate: 'append',
    onSchemaBreak: 'append',
  })
  const rbacAppId = hRbacDeployResult.appClient.appId
  console.log(`✅ HealthcareRBAC: ${rbacAppId}`)

  // 4. DataFiduciaryRegistry
  const fdRegDeployResult = await new DataFiduciaryRegistryFactory(commonParams).deploy({
    onUpdate: 'append',
    onSchemaBreak: 'append',
  })
  const fidAppId = fdRegDeployResult.appClient.appId
  console.log(`✅ DataFiduciaryRegistry: ${fidAppId}`)

  // 5. ConsentManager
  const consentDeployResult = await new ConsentManagerFactory(commonParams).deploy({
    onUpdate: 'append',
    onSchemaBreak: 'append',
  })
  const consentAppId = consentDeployResult.appClient.appId
  console.log(`✅ ConsentManager: ${consentAppId}`)

  // 6. MedicalRecords
  const medRecDeployResult = await new MedicalRecordsFactory(commonParams).deploy({
    onUpdate: 'append',
    onSchemaBreak: 'append',
  })
  const medAppId = medRecDeployResult.appClient.appId
  console.log(`✅ MedicalRecords: ${medAppId}`)

  // 7. DataAccessManager
  const dataAccDeployResult = await new DataAccessManagerFactory(commonParams).deploy({
    onUpdate: 'append',
    onSchemaBreak: 'append',
  })
  const accessAppId = dataAccDeployResult.appClient.appId
  console.log(`✅ DataAccessManager: ${accessAppId}`)

  // 8. WalletMapper
  const walletMapDeployResult = await new WalletMapperFactory(commonParams).deploy({
    onUpdate: 'append',
    onSchemaBreak: 'append',
  })
  const walletAppId = walletMapDeployResult.appClient.appId
  console.log(`✅ WalletMapper: ${walletAppId}`)

  // 9. VolunteerRegistry
  const volRegDeployResult = await new VolunteerRegistryFactory(commonParams).deploy({
    onUpdate: 'append',
    onSchemaBreak: 'append',
  })
  const volAppId = volRegDeployResult.appClient.appId
  console.log(`✅ VolunteerRegistry: ${volAppId}`)

  console.log('🔗 Executing Bootstraps...')
  await medRecDeployResult.appClient.send.bootstrap({ args: { auditAppId: auditAppId } })
  await dataAccDeployResult.appClient.send.bootstrap({
    args: { consentManagerAppId: consentAppId, auditAppId: auditAppId, queueAppId: queueAppId },
  })
  console.log('✅ Bootstraps completed.')

  // Write back App IDs to frontend .env
  console.log('📝 Updating Frontend Environment Variables...')
  const frontendEnvPath = path.resolve(__dirname, '../../Aegis-frontend/.env')
  let envData = ''
  if (fs.existsSync(frontendEnvPath)) {
    envData = fs.readFileSync(frontendEnvPath, 'utf8')
  }

  const updates: Record<string, bigint> = {
    VITE_AUDITLOG_APP_ID: auditAppId,
    VITE_QUEUE_MANAGER_APP_ID: queueAppId,
    VITE_HEALTHCARE_RBAC_APP_ID: rbacAppId,
    VITE_DATA_FIDUCIARY_REGISTRY_APP_ID: fidAppId,
    VITE_CONSENT_MANAGER_APP_ID: consentAppId,
    VITE_MEDICAL_RECORDS_APP_ID: medAppId,
    VITE_DATA_ACCESS_MANAGER_APP_ID: accessAppId,
    VITE_WALLET_MAPPER_APP_ID: walletAppId,
    VITE_VOLUNTEER_REGISTRY_APP_ID: volAppId,
  }

  for (const [key, val] of Object.entries(updates)) {
    const regex = new RegExp(`^${key}=.*$`, 'm')
    if (envData.match(regex)) {
      envData = envData.replace(regex, `${key}=${val}`)
    } else {
      envData += `\n${key}=${val}`
    }
  }

  // Ensure Algod / Indexer URLs are properly set if needed (they should already be there)
  fs.writeFileSync(frontendEnvPath, envData.trim() + '\n')
  console.log(`✅ Successfully updated App IDs in ${frontendEnvPath}.`)
}

deployAll().catch((e) => {
  console.error('DEPLOYMENT FAILED')
  if (e.response && e.response.text) console.error(e.response.text)
  console.error(e.message)
  console.error(e.stack)
})
