import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { WalletMapperFactory } from '../artifacts/wallet_mapper/WalletMapperClient'

export async function deploy() {
  console.log('=== Deploying WalletMapper ===')

  const algorand = AlgorandClient.fromEnvironment()
  const deployer = await algorand.account.fromEnvironment('DEPLOYER')

  // 🛡️ STRICT VALIDATION: Ensure we are using the fixed admin wallet
  const FIXED_ADMIN = 'ZB4FKAVJU6E3ANTCSPPA5PSSIA35XUUA4O2GASDKZVDLUNZ4DMPLYJMVKM'
  if (deployer.addr.toString() !== FIXED_ADMIN) {
    throw new Error(`CRITICAL: Deployment attempted with incorrect wallet ${deployer.addr.toString()}. Expected ${FIXED_ADMIN}. Check your .env file.`)
  }

  const factory = new WalletMapperFactory({
    algorand,
    defaultSender: deployer.addr,
  })

  // 🔄 REUSE LOGIC: Check for existing App ID in environment
  const envAppId = process.env.VITE_WALLET_MAPPER_APP_ID
  const EXISTING_APP_ID = envAppId && !isNaN(Number(envAppId)) && Number(envAppId) > 0 ? BigInt(envAppId) : 0n

  let appClient
  if (EXISTING_APP_ID > 0n) {
    console.log(`Reusing existing WalletMapper App ID: ${EXISTING_APP_ID}`)
    appClient = factory.getAppClientById({ appId: EXISTING_APP_ID })
  } else {
    console.log('No valid WalletMapper App ID found in environment. Deploying new app...')
    const deployResult = await factory.deploy({
      onUpdate: 'replace',
      onSchemaBreak: 'replace',
    })
    appClient = deployResult.appClient
    console.log(`✅ WalletMapper deployed with NEW_APP_ID: ${appClient.appId}`)

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
  
  console.log('✅ WalletMapper deployment script completed successfully.')
}
