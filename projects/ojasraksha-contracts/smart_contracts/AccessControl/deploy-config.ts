import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { AccessControlFactory } from '../artifacts/access_control/AccessControlClient'

export async function deploy() {
  console.log('=== Deploying AccessControl ===')

  const algorand = AlgorandClient.fromEnvironment()

  const deployer = await algorand.account.fromEnvironment('DEPLOYER')

  const factory = algorand.client.getTypedAppFactory(AccessControlFactory, {
    defaultSender: deployer.addr,
  })

  // 🚀 Deploy contract (calls initialize automatically)
  const { appClient, result } = await factory.deploy({
    onUpdate: 'append',
    onSchemaBreak: 'append',
  })

  console.log(`App deployed with ID: ${appClient.appId}`)

  // 💰 Fund app account (required for storage + ops)
  if (['create', 'replace'].includes(result.operationPerformed)) {
    await algorand.send.payment({
      amount: (1).algo(),
      sender: deployer.addr,
      receiver: appClient.appAddress,
    })
  }

  // 🔐 STEP 1: Opt-in deployer (becomes admin automatically)
  console.log('Opting-in deployer...')
  await appClient.send.optIn({
    sender: deployer.addr,
  })

  console.log('Deployer opted-in as admin')

  // 🧪 STEP 2: Add another admin (example)
  const secondAccount = await algorand.account.random()

  console.log(`Generated test account: ${secondAccount.addr}`)

  // Fund second account so it can opt-in
  await algorand.send.payment({
    amount: (0.5).algo(),
    sender: deployer.addr,
    receiver: secondAccount.addr,
  })

  // Opt-in second account
  await appClient.send.optIn({
    sender: secondAccount.addr,
  })

  console.log('Second account opted-in')

  // Add as admin
  await appClient.send.addAdmin({
    args: { admin: secondAccount.addr },
    sender: deployer.addr,
  })

  console.log(`Added ${secondAccount.addr} as admin`)

  // 🧪 OPTIONAL: Remove admin
  /*
  await appClient.send.removeAdmin({
    args: { admin: secondAccount.addr },
    sender: deployer.addr,
  })

  console.log(`Removed ${secondAccount.addr} as admin`)
  */

  console.log('=== Deployment & Setup Complete ===')
}
