import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { HealthcareRbacFactory } from '../artifacts/healthcare_r_b_a_c/HealthcareRBACClient'

export async function deploy() {
  console.log('=== Deploying HealthcareRBAC ===')

  const algorand = AlgorandClient.fromEnvironment()
  const deployer = await algorand.account.fromEnvironment('DEPLOYER')

  // Warn if not the hardcoded contract admin — on-chain admin-gated calls will
  // be skipped below if the deployer isn't the expected admin.
  const FIXED_ADMIN = 'ZB4FKAVJU6E3ANTCSPPA5PSSIA35XUUA4O2GASDKZVDLUNZ4DMPLYJMVKM'
  const isFixedAdmin = deployer.addr.toString() === FIXED_ADMIN
  if (!isFixedAdmin) {
    console.warn(`[HealthcareRBAC] Deployer ${deployer.addr.toString()} is not the hardcoded admin ${FIXED_ADMIN}. Admin-only demo calls will be skipped.`)
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
  // Example: check admin (deployer) — read-only, always safe
  // --------------------------------------------------
  const response = await appClient.send.isAdmin({
    args: {
      wallet: deployer.addr.toString(),
    },
  })

  console.log(
    `Called isAdmin on ${appClient.appClient.appName} (${appClient.appClient.appId}), result: ${response.return}`
  )

  // --------------------------------------------------
  // Example: register role — only when deployer is the on-chain admin
  // --------------------------------------------------
  if (isFixedAdmin) {
    await appClient.send.registerRole({
      args: {
        user: deployer.addr.toString(),
        role: 1,
      },
    })
    console.log(
      `Called registerRole on ${appClient.appClient.appName} (${appClient.appClient.appId})`
    )
  } else {
    console.log('[HealthcareRBAC] Skipping registerRole demo call (deployer is not admin).')
  }
}
