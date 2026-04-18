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
  // Bootstrap (NO manual IDs)
  // --------------------------------------------------
  const method = 'bootstrap'

  const bootstrapResponse = await appClient.send.bootstrap({
    args: {
      consentManagerAppId: BigInt(consentApp.appClient.appId),
      auditAppId: BigInt(auditApp.appClient.appId),
    },
  })

  console.log(
    `Called ${method} on ${appClient.appClient.appName} (${appClient.appClient.appId})`
  )

  // --------------------------------------------------
  // Example call: accessData
  // --------------------------------------------------
  const accessMethod = 'accessData'

  const response = await appClient.send.accessData({
    args: {
      principal: deployer.addr,
      index: BigInt(0),
      scope: 'All',
      purpose: 'Testing',
    },
  })

  console.log(
    `Called ${accessMethod} on ${appClient.appClient.appName} (${appClient.appClient.appId})`
  )
}
