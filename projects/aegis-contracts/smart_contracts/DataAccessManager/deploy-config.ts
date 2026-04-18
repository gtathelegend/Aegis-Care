import { AlgorandClient } from '@algorandfoundation/algokit-utils'

import { ConsentManagerFactory } from '../artifacts/consent_manager/ConsentManagerClient'
import { AuditLogFactory } from '../artifacts/audit_log/AuditLogClient'
import { DataAccessManagerFactory } from '../artifacts/data_access_manager/DataAccessManagerClient'

export async function deploy() {
  console.log('=== Deploying Full System ===')

  const algorand = AlgorandClient.fromEnvironment()
  const deployer = await algorand.account.fromEnvironment('DEPLOYER')

  // --------------------------------------------------
  // Deploy ConsentManager
  // --------------------------------------------------
  const consentFactory = algorand.client.getTypedAppFactory(ConsentManagerFactory, {
    defaultSender: deployer.addr,
  })

  const { appClient: consentApp } = await consentFactory.deploy({
    onUpdate: 'append',
    onSchemaBreak: 'append',
  })

  // --------------------------------------------------
  // Deploy AuditLog
  // --------------------------------------------------
  const auditFactory = algorand.client.getTypedAppFactory(AuditLogFactory, {
    defaultSender: deployer.addr,
  })

  const { appClient: auditApp } = await auditFactory.deploy({
    onUpdate: 'append',
    onSchemaBreak: 'append',
  })

  // --------------------------------------------------
  // Deploy DataAccessManager
  // --------------------------------------------------
  const dataFactory = algorand.client.getTypedAppFactory(DataAccessManagerFactory, {
    defaultSender: deployer.addr,
  })

  const { appClient, result } = await dataFactory.deploy({
    onUpdate: 'append',
    onSchemaBreak: 'append',
  })

  // Fund only main app (same as your style)
  if (['create', 'replace'].includes(result.operationPerformed)) {
    await algorand.send.payment({
      amount: (1).algo(),
      sender: deployer.addr,
      receiver: appClient.appAddress,
    })
  }

  // --------------------------------------------------
  // Bootstrap — link ConsentManager, AuditLog, and QueueManager
  // --------------------------------------------------
  // QueueManager is deployed by its own script; pull its ID from the env if set,
  // otherwise fall back to 0 (emergency flows will be unavailable until re-bootstrapped).
  const queueAppIdEnv = process.env.VITE_QUEUE_MANAGER_APP_ID
  const queueAppId = queueAppIdEnv && !isNaN(Number(queueAppIdEnv)) ? BigInt(queueAppIdEnv) : 0n

  await appClient.send.bootstrap({
    args: {
      consentManagerAppId: BigInt(consentApp.appClient.appId),
      auditAppId: BigInt(auditApp.appClient.appId),
      queueAppId,
    },
  })

  console.log(
    `Called bootstrap on ${appClient.appClient.appName} (${appClient.appClient.appId}) — consent=${consentApp.appClient.appId}, audit=${auditApp.appClient.appId}, queue=${queueAppId}`
  )

  // Example call (accessData) requires a valid consent record — skipped during
  // deploy because no consent has been granted yet. Frontend/tests should
  // exercise this path after setup.
}
