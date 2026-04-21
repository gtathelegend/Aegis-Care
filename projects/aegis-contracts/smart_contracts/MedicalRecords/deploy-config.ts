import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { MedicalRecordsFactory } from '../artifacts/medical_records/MedicalRecordsClient'

export async function deploy() {
  console.log('=== Deploying MedicalRecords ===')

  const algorand = AlgorandClient.fromEnvironment()
  const deployer = await algorand.account.fromEnvironment('DEPLOYER')

  const factory = algorand.client.getTypedAppFactory(MedicalRecordsFactory, {
    defaultSender: deployer.addr,
  })

  const { appClient, result } = await factory.deploy({
    onUpdate: 'append',
    onSchemaBreak: 'append',
  })

  // Fund app account if newly created
  if (['create', 'replace'].includes(result.operationPerformed)) {
    await algorand.send.payment({
      amount: (1).algo(),
      sender: deployer.addr,
      receiver: appClient.appAddress,
    })
  }


  // --------------------------------------------------
  // ⚠️ REQUIRED: bootstrap (set AuditLog app ID)
  // --------------------------------------------------
  const bootstrapMethod = 'bootstrap'

  // Fetch from env or fall back to 0 (which triggers safer contract behavior)
  const AUDIT_APP_ID = BigInt(process.env.VITE_AUDIT_LOG_APP_ID || "0")

  if (AUDIT_APP_ID > 0n) {
      await appClient.send.bootstrap({
        args: {
          auditAppId: AUDIT_APP_ID,
        },
      })
      console.log(
        `Called ${bootstrapMethod} on ${appClient.appClient.appName} (${appClient.appClient.appId}) with Audit ID: ${AUDIT_APP_ID}`
      )
  } else {
      console.warn(`[MedicalRecords] Skipping bootstrap: VITE_AUDIT_LOG_APP_ID not set in environment.`)
  }

}
