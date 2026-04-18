import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { AccessControlFactory } from '../artifacts/access_control/AccessControlClient'

export async function deploy() {
  console.log('=== Deploying AccessControl ===')

  const algorand = AlgorandClient.fromEnvironment()

  const deployer = await algorand.account.fromEnvironment('DEPLOYER')

  const factory = algorand.client.getTypedAppFactory(AccessControlFactory, {
    defaultSender: deployer.addr,
  })

  // 🚀 Deploy contract — AccessControl marks initialize() as create="require",
  // so the factory must call it on create.
  const { appClient, result } = await factory.deploy({
    onUpdate: 'append',
    onSchemaBreak: 'append',
    createParams: { method: 'initialize', args: [] },
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

  // 🔐 STEP 1: Opt-in deployer. The contract only flags the sender as an admin
  // on opt-in if it matches the hardcoded super_admin — non-super-admin deployers
  // still need to opt-in to use local state, but won't be granted admin rights.
  console.log('Opting-in deployer...')
  await appClient.send.optIn.optIn({
    sender: deployer.addr,
    args: [],
  })

  const SUPER_ADMIN = 'ZB4FKAVJU6E3ANTCSPPA5PSSIA35XUUA4O2GASDKZVDLUNZ4DMPLYJMVKM'
  const deployerIsSuperAdmin = deployer.addr.toString() === SUPER_ADMIN

  if (deployerIsSuperAdmin) {
    console.log('Deployer opted-in as admin')

    // Demo: add a second admin (only works when the deployer is the on-chain super admin)
    const secondAccount = await algorand.account.random()
    console.log(`Generated test account: ${secondAccount.addr}`)

    await algorand.send.payment({
      amount: (0.5).algo(),
      sender: deployer.addr,
      receiver: secondAccount.addr,
    })

    await appClient.send.optIn.optIn({
      sender: secondAccount.addr,
      args: [],
    })
    console.log('Second account opted-in')

    await appClient.send.addAdmin({
      args: { admin: secondAccount.addr.toString() },
      sender: deployer.addr,
    })
    console.log(`Added ${secondAccount.addr} as admin`)
  } else {
    console.log('[AccessControl] Deployer opted-in as a non-admin (super_admin is hardcoded to ZB4FK...). Skipping addAdmin demo.')
  }

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
