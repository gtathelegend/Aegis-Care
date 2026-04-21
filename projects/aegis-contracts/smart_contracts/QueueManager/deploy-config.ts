import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { QueueManagerFactory } from '../artifacts/queue_manager/QueueManagerClient'

export async function deploy() {
  console.log('=== Deploying QueueManager ===')

  const algorand = AlgorandClient.fromEnvironment()
  const deployer = await algorand.account.fromEnvironment('DEPLOYER')

  // Warn if deployer is not the hardcoded on-chain admin. Deployment itself
  // does not require admin rights — admin is enforced inside the contract.
  const FIXED_ADMIN = 'RGXCDITOJF7HQR5KOVUXNQNEDBWTN4UQFHIEJZTZQLIN2CMNET22FZYJWQ'
  if (deployer.addr.toString() !== FIXED_ADMIN) {
    console.warn(`[QueueManager] Deployer ${deployer.addr.toString()} is not the hardcoded admin ${FIXED_ADMIN}.`)
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
