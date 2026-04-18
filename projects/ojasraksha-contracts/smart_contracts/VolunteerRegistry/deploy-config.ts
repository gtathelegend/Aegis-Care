import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { VolunteerRegistryFactory } from '../artifacts/volunteer_registry/VolunteerRegistryClient'

export async function deploy() {
  console.log('=== Deploying VolunteerRegistry ===')

  const algorand = AlgorandClient.fromEnvironment()
  const deployer = await algorand.account.fromEnvironment('DEPLOYER')

  const factory = algorand.client.getTypedAppFactory(VolunteerRegistryFactory, {
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
  // Example: addVolunteer
  // --------------------------------------------------
  const method = 'addVolunteer'

  // ⚠️ 32-byte hash (must be exactly 32 bytes)
  const hashId = new Uint8Array(32).fill(1)

  const response = await appClient.send.addVolunteer({
    args: {
      hashId: hashId,
      cid: 'QmVolunteerCID123',
    },
  })

  console.log(
    `Called ${method} on ${appClient.appClient.appName} (${appClient.appClient.appId})`
  )

  // --------------------------------------------------
  // Example: getVolunteer
  // --------------------------------------------------
  const getMethod = 'getVolunteer'

  const volunteer = await appClient.send.getVolunteer({
    args: {
      hashId: hashId,
    },
  })

  console.log(
    `Called ${getMethod}, result:`,
    volunteer.return
  )
}
