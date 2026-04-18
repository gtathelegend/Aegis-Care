import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { DataFiduciaryRegistryFactory } from '../artifacts/data_fiduciary_registry/DataFiduciaryRegistryClient'

export async function deploy() {
  console.log('=== Deploying DataFiduciaryRegistry ===')

  const algorand = AlgorandClient.fromEnvironment()
  const deployer = await algorand.account.fromEnvironment('DEPLOYER')

  const factory = algorand.client.getTypedAppFactory(DataFiduciaryRegistryFactory, {
    defaultSender: deployer.addr,
  })

  const { appClient, result } = await factory.deploy({
    onUpdate: 'append',
    onSchemaBreak: 'append',
  })

  // Fund app account if newly created
  if (['create', 'replace'].includes(result.operationPerformed)) {
    await algorand.send.payment({
      amount: (1).algo(),
      sender: deployer.addr,
      receiver: appClient.appAddress,
    })
  }

  // --------------------------------------------------
  // Example: register fiduciary
  // --------------------------------------------------
  const method = 'registerFiduciary'

  const response = await appClient.send.registerFiduciary({
    args: {
      name: 'Test Fiduciary',
      licenseId: 'LIC123',
    },
  })

  console.log(
    `Called ${method} on ${appClient.appClient.appName} (${appClient.appClient.appId})`
  )

  // --------------------------------------------------
  // Example: check approval status
  // --------------------------------------------------
  const checkMethod = 'isApproved'

  const checkResponse = await appClient.send.isApproved({
    args: {
      fiduciary: deployer.addr,
    },
  })

  console.log(
    `Called ${checkMethod}, result: ${checkResponse.return}`
  )
}
