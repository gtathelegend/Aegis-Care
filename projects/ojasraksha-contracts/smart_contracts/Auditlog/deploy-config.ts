import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { AuditLogFactory } from '../artifacts/audit_log/AuditLogClient'

export async function deploy() {
  console.log('=== Deploying AuditLog ===')

  const algorand = AlgorandClient.fromEnvironment()
  const deployer = await algorand.account.fromEnvironment('DEPLOYER')

  const factory = algorand.client.getTypedAppFactory(AuditLogFactory, {
    defaultSender: deployer.addr,
  })

  // 🚀 Deploy contract
  const { appClient, result } = await factory.deploy({
    onUpdate: 'append',
    onSchemaBreak: 'append',
  })

  console.log(`App deployed with ID: ${appClient.appId}`)

  // 💰 Fund app (still good practice even if no state)
  if (['create', 'replace'].includes(result.operationPerformed)) {
    await algorand.send.payment({
      amount: (1).algo(),
      sender: deployer.addr,
      receiver: appClient.appAddress,
    })
  }

  // 🧪 TEST CALLS (emit events)

  const now = Math.floor(Date.now() / 1000)

  console.log('Logging consent granted...')
  await appClient.send.logConsentGranted({
    args: {
      principal: deployer.addr,
      fiduciary: deployer.addr,
      purpose: 'treatment',
      expiry: now + 3600,
    },
  })

  console.log('Logging access request...')
  await appClient.send.logAccessRequested({
    args: {
      principal: deployer.addr,
      fiduciary: deployer.addr,
      purpose: 'diagnosis',
      timestamp: now,
    },
  })

  console.log('Logging data accessed...')
  await appClient.send.logDataAccessed({
    args: {
      principal: deployer.addr,
      fiduciary: deployer.addr,
      purpose: 'treatment',
      timestamp: now,
    },
  })

  console.log('Logging consent revoked...')
  await appClient.send.logConsentRevoked({
    args: {
      principal: deployer.addr,
      fiduciary: deployer.addr,
    },
  })

  console.log('Logging erasure requested...')
  await appClient.send.logErasureRequested({
    args: {
      principal: deployer.addr,
      timestamp: now,
    },
  })

  console.log('=== AuditLog Events Emitted Successfully ===')
}
