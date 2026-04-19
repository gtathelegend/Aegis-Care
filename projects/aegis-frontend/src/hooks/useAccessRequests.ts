import { useState, useMemo } from 'react'
import { useWallet } from '@txnlab/use-wallet-react'
import { QueueManagerClient } from '../contracts/QueueManager'
import { getAlgorandClientFromViteEnvironment } from '../utils/network/getAlgoClientConfigs'
import {
  createSharedAccessRequest,
  updateSharedAccessRequestStatus,
  type AccessRequesterRole,
} from '../lib/realtimeAccessRequests'
import { useSnackbar } from 'notistack'

export interface SubmitAccessRequestParams {
  patientId: string
  patientAddress: string
  requestedBy: string
  requestedByRole: AccessRequesterRole
  requestedByAvatar: string
  requestedByColor: string
  scope: string
  reason: string
  isEmergency?: boolean
}

export function useAccessRequests() {
  const { activeAddress, transactionSigner } = useWallet()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { enqueueSnackbar } = useSnackbar()

  const algorand = useMemo(() => getAlgorandClientFromViteEnvironment(), [])
  const queueAppId = useMemo(() => Number(import.meta.env.VITE_QUEUE_MANAGER_APP_ID || 0), [])

  const submitRequest = async (params: SubmitAccessRequestParams) => {
    if (!activeAddress) {
      enqueueSnackbar('Connect your wallet to submit a request', { variant: 'error' })
      return null
    }

    setLoading(true)
    setError(null)

    let blockchainRequestId: string | undefined

    // Try blockchain first if configured
    if (queueAppId !== 0) {
      try {
        const queueClient = new QueueManagerClient({
          appId: BigInt(queueAppId),
          algorand,
        })

        const result = await queueClient.send.submitRequest({
          args: {
            target: params.patientAddress,
            purpose: params.reason,
            isEmergency: params.isEmergency ?? false,
          },
          sender: activeAddress,
          signer: transactionSigner,
          populateAppCallResources: true,
        })

        // Return value is the request_id (uint64)
        const returnValue = result.return
        if (returnValue !== undefined && returnValue !== null) {
          blockchainRequestId = returnValue.toString()
        }

        enqueueSnackbar(
          `Request submitted on-chain! TX: ${result.txIds?.[0]?.slice(0, 8) ?? 'n/a'}...`,
          { variant: 'success' }
        )
      } catch (err: any) {
        console.warn('[useAccessRequests] Blockchain submit failed, falling back to local:', err.message)
        enqueueSnackbar('Request sent to patient (local mode)', { variant: 'info' })
      }
    }

    // Always create in localStorage for cross-tab sync
    const localReq = createSharedAccessRequest({
      patientId: params.patientId,
      requestedBy: params.requestedBy,
      requestedByRole: params.requestedByRole,
      requestedByAvatar: params.requestedByAvatar,
      requestedByColor: params.requestedByColor,
      scope: params.scope,
      reason: params.reason,
      urgency: params.isEmergency ? 'emergency' : 'urgent',
      blockchainRequestId,
    })

    if (queueAppId === 0) {
      enqueueSnackbar(`Access request sent to ${params.patientId}`, { variant: 'info' })
    }

    setLoading(false)
    return localReq
  }

  const approveRequest = async (localRequestId: string, patientAddress: string, blockchainRequestId?: string) => {
    // Update localStorage immediately for cross-tab sync
    updateSharedAccessRequestStatus(localRequestId, 'approved')

    // Also call blockchain if we have the request ID
    if (queueAppId !== 0 && blockchainRequestId && activeAddress) {
      try {
        const queueClient = new QueueManagerClient({
          appId: BigInt(queueAppId),
          algorand,
        })

        const requestIdBigInt = BigInt(blockchainRequestId)

        await queueClient.send.approveRequest({
          args: { requestId: requestIdBigInt },
          sender: activeAddress,
          signer: transactionSigner,
          populateAppCallResources: true,
        })

        enqueueSnackbar('Access approved on-chain!', { variant: 'success' })
      } catch (err: any) {
        console.warn('[useAccessRequests] Blockchain approve failed:', err.message)
        enqueueSnackbar('Access approved', { variant: 'success' })
      }
    } else {
      enqueueSnackbar('Access approved', { variant: 'success' })
    }
  }

  const rejectRequest = async (localRequestId: string, patientAddress: string, blockchainRequestId?: string) => {
    updateSharedAccessRequestStatus(localRequestId, 'rejected')

    if (queueAppId !== 0 && blockchainRequestId && activeAddress) {
      try {
        const queueClient = new QueueManagerClient({
          appId: BigInt(queueAppId),
          algorand,
        })

        const requestIdBigInt = BigInt(blockchainRequestId)

        await queueClient.send.rejectRequest({
          args: { requestId: requestIdBigInt },
          sender: activeAddress,
          signer: transactionSigner,
          populateAppCallResources: true,
        })
      } catch (err: any) {
        console.warn('[useAccessRequests] Blockchain reject failed:', err.message)
      }
    }

    enqueueSnackbar('Access request rejected', { variant: 'info' })
  }

  return { submitRequest, approveRequest, rejectRequest, loading, error }
}
