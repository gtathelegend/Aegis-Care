import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { HealthcareRbacFactory } from '../artifacts/healthcare_r_b_a_c/HealthcareRBACClient'

export async function deploy() {
  console.log('=== Deploying HealthcareRBAC ===')

  const algorand = AlgorandClient.fromEnvironment()
  const deployer = await algorand.account.fromEnvironment('DEPLOYER')

  // 🛡️ STRICT VALIDATION: Ensure we are using the fixed admin wallet
  const FIXED_ADMIN = 'ZB4FKAVJU6E3ANTCSPPA5PSSIA35XUUA4O2GASDKZVDLUNZ4DMPLYJMVKM'
  if (deployer.addr.toString() !== FIXED_ADMIN) {
    throw new Error(`CRITICAL: Deployment attempted with incorrect wallet ${deployer.addr.toString()}. Expected ${FIXED_ADMIN}. Check your .env file.`)
  }

  const factory = new HealthcareRbacFactory({
    algorand,
    defaultSender: deployer.addr,
  })

  // 🔄 REUSE LOGIC: Check for existing App ID in environment
  const envAppId = process.env.VITE_HEALTHCARE_RBAC_APP_ID
  const EXISTING_APP_ID = envAppId && !isNaN(Number(envAppId)) && Number(envAppId) > 0 ? BigInt(envAppId) : 0n

  let appClient
  if (EXISTING_APP_ID > 0n) {
    console.log(`Reusing existing HealthcareRBAC App ID: ${EXISTING_APP_ID}`)
    appClient = factory.getAppClientById({ appId: EXISTING_APP_ID })
  } else {
    console.log('No valid HealthcareRBAC App ID found in environment. Deploying new app...')
    const deployResult = await factory.deploy({
      onUpdate: 'update',
      onSchemaBreak: 'fail',
      validityWindow: 100, // 🛡️ Extend validity window for TestNet stability
    })
    appClient = deployResult.appClient
    console.log(`✅ HealthcareRBAC deployed with NEW_APP_ID: ${appClient.appId}`)

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

  // --------------------------------------------------
  // Example: check admin (deployer)
  // --------------------------------------------------
  const method = 'isAdmin'

  const response = await appClient.send.isAdmin({
    args: {
      wallet: deployer.addr.toString(),
    },
  })

  console.log(
    `Called ${method} on ${appClient.appClient.appName} (${appClient.appClient.appId}), result: ${response.return}`
  )

  // --------------------------------------------------
  // Example: register role
  // --------------------------------------------------
  const roleMethod = 'registerRole'

  await appClient.send.registerRole({
    args: {
      user: deployer.addr.toString(),
      role: 1, // example role (uint8)
    },
  })

  console.log(
    `Called ${roleMethod} on ${appClient.appClient.appName} (${appClient.appClient.appId})`
  )
}
