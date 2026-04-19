import { getPatientById, patients } from './mockdb'

export type AccessRequestStatus = 'pending' | 'approved' | 'rejected'
export type AccessRequesterRole = 'doctor' | 'hospital'

export interface SharedAccessRequest {
  id: string
  patientId: string
  patientName: string
  patientShortId: string
  requestedBy: string
  requestedByRole: AccessRequesterRole
  requestedByAvatar: string
  requestedByColor: string
  scope: string
  reason: string
  urgency: 'routine' | 'urgent' | 'emergency'
  status: AccessRequestStatus
  requestedAt: string
  createdAt: number
  updatedAt: number
  blockchainRequestId?: string
}

interface CreateAccessRequestInput {
  patientId: string
  requestedBy: string
  requestedByRole: AccessRequesterRole
  requestedByAvatar: string
  requestedByColor: string
  scope: string
  reason: string
  urgency?: 'routine' | 'urgent' | 'emergency'
  blockchainRequestId?: string
}

const STORAGE_KEY = 'Aegis-shared-access-requests-v1'
const UPDATE_EVENT = 'aegis:access-requests-updated'

const isBrowser = () => typeof window !== 'undefined'

const buildSeedRequests = (): SharedAccessRequest[] => {
  const p1 = getPatientById('p1')
  const p2 = getPatientById('p2')
  const p3 = getPatientById('p3')
  const now = Date.now()

  return [
    {
      id: `seed-${now}-1`,
      patientId: p1.id,
      patientName: p1.name,
      patientShortId: p1.shortId,
      requestedBy: 'Dr. Hanwa, K.',
      requestedByRole: 'doctor',
      requestedByAvatar: 'KH',
      requestedByColor: 'coral',
      scope: 'LAB_RESULTS · 48H',
      reason: 'Reviewing blood work before treatment plan update.',
      urgency: 'urgent',
      status: 'pending',
      requestedAt: new Date(now - 10 * 60_000).toLocaleString(),
      createdAt: now - 10 * 60_000,
      updatedAt: now - 10 * 60_000,
    },
    {
      id: `seed-${now}-2`,
      patientId: p2.id,
      patientName: p2.name,
      patientShortId: p2.shortId,
      requestedBy: 'Helix Hospital',
      requestedByRole: 'hospital',
      requestedByAvatar: 'HX',
      requestedByColor: 'lime',
      scope: 'DISCHARGE_SUMMARY · 24H',
      reason: 'Need discharge summary for coordinated follow-up care.',
      urgency: 'routine',
      status: 'pending',
      requestedAt: new Date(now - 45 * 60_000).toLocaleString(),
      createdAt: now - 45 * 60_000,
      updatedAt: now - 45 * 60_000,
    },
    {
      id: `seed-${now}-3`,
      patientId: p3.id,
      patientName: p3.name,
      patientShortId: p3.shortId,
      requestedBy: 'Dr. Hanwa, K.',
      requestedByRole: 'doctor',
      requestedByAvatar: 'KH',
      requestedByColor: 'coral',
      scope: 'IMAGING_REPORTS · 2H',
      reason: 'Second opinion requested on recent imaging reports.',
      urgency: 'routine',
      status: 'approved',
      requestedAt: new Date(now - 2 * 60 * 60_000).toLocaleString(),
      createdAt: now - 2 * 60 * 60_000,
      updatedAt: now - 90 * 60_000,
    },
  ]
}

const sortByNewest = (requests: SharedAccessRequest[]) =>
  [...requests].sort((a, b) => b.createdAt - a.createdAt)

const readRequests = (): SharedAccessRequest[] => {
  if (!isBrowser()) return []

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as SharedAccessRequest[]
    return Array.isArray(parsed) ? sortByNewest(parsed) : []
  } catch {
    return []
  }
}

const writeRequests = (requests: SharedAccessRequest[]) => {
  if (!isBrowser()) return

  const sorted = sortByNewest(requests)
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sorted))
  window.dispatchEvent(new CustomEvent(UPDATE_EVENT, { detail: sorted }))
}

export const initializeAccessRequestMockData = () => {
  if (!isBrowser()) return

  const existing = readRequests()
  if (existing.length > 0) return

  writeRequests(buildSeedRequests())
}

export const getSharedAccessRequests = () => {
  initializeAccessRequestMockData()
  return readRequests()
}

export const subscribeToSharedAccessRequests = (listener: (requests: SharedAccessRequest[]) => void) => {
  if (!isBrowser()) {
    listener([])
    return () => undefined
  }

  const emit = () => listener(getSharedAccessRequests())

  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      emit()
    }
  }

  const onUpdated = () => emit()

  emit()
  window.addEventListener('storage', onStorage)
  window.addEventListener(UPDATE_EVENT, onUpdated)

  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener(UPDATE_EVENT, onUpdated)
  }
}

export const createSharedAccessRequest = (input: CreateAccessRequestInput) => {
  const patient = patients.find((candidate) => candidate.id === input.patientId)
  if (!patient) {
    throw new Error('Invalid patient selected for access request.')
  }

  const now = Date.now()
  const nextRequest: SharedAccessRequest = {
    id: `req-${now}`,
    patientId: patient.id,
    patientName: patient.name,
    patientShortId: patient.shortId,
    requestedBy: input.requestedBy,
    requestedByRole: input.requestedByRole,
    requestedByAvatar: input.requestedByAvatar,
    requestedByColor: input.requestedByColor,
    scope: input.scope,
    reason: input.reason,
    urgency: input.urgency ?? 'routine',
    status: 'pending',
    requestedAt: new Date(now).toLocaleString(),
    createdAt: now,
    updatedAt: now,
    blockchainRequestId: input.blockchainRequestId,
  }

  const current = getSharedAccessRequests()
  writeRequests([nextRequest, ...current])
  return nextRequest
}

export const updateSharedAccessRequestStatus = (requestId: string, status: AccessRequestStatus) => {
  const current = getSharedAccessRequests()
  const updated = current.map((request) =>
    request.id === requestId
      ? {
          ...request,
          status,
          updatedAt: Date.now(),
        }
      : request
  )

  writeRequests(updated)
}

export const getRequestsForPatient = (patientId: string) =>
  getSharedAccessRequests().filter((request) => request.patientId === patientId)

export const getRequestsForRequesterRole = (role: AccessRequesterRole) =>
  getSharedAccessRequests().filter((request) => request.requestedByRole === role)
