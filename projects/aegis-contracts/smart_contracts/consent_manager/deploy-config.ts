import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { ConsentManagerFactory } from '../artifacts/consent_manager/ConsentManagerClient'

export async function deploy() {
  console.log('=== Deploying ConsentManager ===')

  const algorand = AlgorandClient.fromEnvironment()
  const deployer = await algorand.account.fromEnvironment('DEPLOYER')

  const factory = algorand.client.getTypedAppFactory(ConsentManagerFactory, {
    defaultSender: deployer.addr,
  })

  const { appClient, result } = await factory.deploy({
    onUpdate: 'append',
    onSchemaBreak: 'append',
  })

  // ✅ Fund app account if newly created
  if (['create', 'replace'].includes(result.operationPerformed)) {
    await algorand.send.payment({
      amount: (1).algo(),
      sender: deployer.addr,
      receiver: appClient.appAddress,
    })
  }

  console.log(
    `App deployed: ${appClient.appClient.appName} (ID: ${appClient.appClient.appId})`
  )

  // --------------------------------------------------
  // ✅ Example 1: Grant Consent
  // --------------------------------------------------
  const grantResponse = await appClient.send.grantConsent({
    args: {
      fiduciary: deployer.addr,
      purpose: 'Testing Purpose',
      dataHash: 'QmTestHash123',
      dataScope: 'All',
      durationInSeconds: BigInt(3600), // 1 hour
    },
  })

  console.log('Grant Consent Tx:', grantResponse.txId)

  // --------------------------------------------------
  // ✅ Example 2: Request Access
  // --------------------------------------------------
  const requestResponse = await appClient.send.requestAccess({
    args: {
      patient: deployer.addr,
      purpose: 'Research',
    },
  })

  console.log('Request Access Tx:', requestResponse.txId)

  // --------------------------------------------------
  // ✅ Example 3: Read Consents
  // --------------------------------------------------
  const consents = await appClient.send.getPatientConsents({
    args: {
      patient: deployer.addr,
    },
  })

  console.log('Patient Consents:', consents.return)

  // --------------------------------------------------
  // ✅ Example 4: Validate Consent
  // --------------------------------------------------
  const isValid = await appClient.send.validateConsent({
    args: {
      principal: deployer.addr,
      index: BigInt(0),
      requiredScope: 'All',
    },
  })

  console.log('Consent Valid:', isValid.return)
}
