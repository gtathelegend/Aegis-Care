import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { WalletMapperFactory } from '../artifacts/wallet_mapper/WalletMapperClient'

export async function deploy() {
  console.log('=== Deploying WalletMapper ===')

  const algorand = AlgorandClient.fromEnvironment()
  const deployer = await algorand.account.fromEnvironment('DEPLOYER')

  // Warn if deployer is not the hardcoded admin — not a hard requirement at deploy time.
  const FIXED_ADMIN = 'RGXCDITOJF7HQR5KOVUXNQNEDBWTN4UQFHIEJZTZQLIN2CMNET22FZYJWQ'
  if (deployer.addr.toString() !== FIXED_ADMIN) {
    console.warn(`[WalletMapper] Deployer ${deployer.addr.toString()} is not the hardcoded admin ${FIXED_ADMIN}.`)
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
