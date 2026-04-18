import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { QueueManagerFactory } from '../artifacts/queue_manager/QueueManagerClient'

export async function deploy() {
  console.log('=== Deploying QueueManager ===')

  const algorand = AlgorandClient.fromEnvironment()
  const deployer = await algorand.account.fromEnvironment('DEPLOYER')

  // 🛡️ STRICT VALIDATION: Ensure we are using the fixed admin wallet
  const FIXED_ADMIN = 'ZB4FKAVJU6E3ANTCSPPA5PSSIA35XUUA4O2GASDKZVDLUNZ4DMPLYJMVKM'
  if (deployer.addr.toString() !== FIXED_ADMIN) {
    throw new Error(`CRITICAL: Deployment attempted with incorrect wallet ${deployer.addr.toString()}. Expected ${FIXED_ADMIN}. Check your .env file.`)
  }

  const factory = new QueueManagerFactory({
    algorand,
    defaultSender: deployer.addr,
  })

  // We are replacing it as per new deploy requirement
  console.log('Deploying new app...')
  const deployResult = await factory.deploy({
    onUpdate: 'replace',
    onSchemaBreak: 'replace',
  })
  const appClient = deployResult.appClient
  console.log(`✅ QueueManager deployed with NEW_APP_ID: ${appClient.appId}`)

  // Fund app account if newly created
  if (['create', 'replace'].includes(deployResult.result.operationPerformed)) {
    console.log(`Funding new app account: ${appClient.appAddress}`)
    await algorand.send.payment({
      amount: (1).algo(),
      sender: deployer.addr,
      receiver: appClient.appAddress,
    })
  }
}
