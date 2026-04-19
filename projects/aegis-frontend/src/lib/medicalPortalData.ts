import { MedicalRecordsClient } from '../contracts/MedicalRecords'
import { patients, getPatientById, recordTypeLabel, type MedicalRecord, type Patient } from './mockdb'
import { getAlgorandClientFromViteEnvironment } from '../utils/network/getAlgoClientConfigs'
import { resolveAddress } from '../utils/resolveAddress'
import algosdk from 'algosdk'
import { fetchFromIPFS, uploadToIPFS } from '../utils/ipfs'
import { encryptData } from '../utils/crypto'
import { calcMedicalRecordBox, calcPrescriptionQueueBox } from '../utils/boxUtils'

const medicalAppId = Number(import.meta.env.VITE_MEDICAL_RECORDS_APP_ID || 0)

const algorand = getAlgorandClientFromViteEnvironment()

export type ContractRecordTuple = [bigint, string, string, string, string, string, bigint, bigint]

export interface PatientResolution {
  patient: Patient
  walletAddress: string
}

export interface PrescriptionDraft {
  patientIdentifier: string
  patientName: string
  medication: string
  dosage: string
  instructions: string
  notes?: string
  providerName: string
}

export function findPatientByIdentifier(identifier: string): Patient | null {
  const trimmed = identifier.trim()
  if (!trimmed) return null

  const directMatch = patients.find((entry) =>
    entry.id === trimmed ||
    entry.shortId.toLowerCase() === trimmed.toLowerCase() ||
    entry.name.toLowerCase() === trimmed.toLowerCase() ||
    entry.walletAddress.toLowerCase() === trimmed.toLowerCase()
  )

  return directMatch ?? null
}

function isValidAlgorandAddress(addr: string): boolean {
  if (!addr || addr.length !== 58) return false
  try {
    algosdk.decodeAddress(addr)
    return true
  } catch {
    return false
  }
}

export async function resolvePatient(identifier: string): Promise<PatientResolution> {
  const patient = findPatientByIdentifier(identifier)

  // Only use mock walletAddress if it's a valid Algorand address.
  // Mock patients may have Ethereum-style addresses — skip those and resolve on-chain.
  const mockAddress = patient?.walletAddress
  const walletAddress = (mockAddress && isValidAlgorandAddress(mockAddress))
    ? mockAddress
    : await resolveAddress(identifier)

  return {
    patient: patient ?? {
      ...getPatientById('p1'),
      name: identifier.trim() || getPatientById('p1').name,
      shortId: identifier.trim().slice(0, 6).toUpperCase() || getPatientById('p1').shortId,
      walletAddress,
      avatar: (identifier.trim().slice(0, 2) || getPatientById('p1').avatar).toUpperCase(),
    },
    walletAddress,
  }
}

function formatTimestamp(timestamp: bigint): string {
  const date = new Date(Number(timestamp) * 1000)
  if (Number.isNaN(date.getTime())) {
    return new Date().toLocaleDateString()
  }

  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function recordTypeFromChain(recordType: string): MedicalRecord['type'] {
  const normalized = recordType.toLowerCase()
  if (normalized.includes('prescription')) return 'prescription'
  if (normalized.includes('lab')) return 'lab'
  if (normalized.includes('image') || normalized.includes('scan')) return 'imaging'
  if (normalized.includes('discharge')) return 'discharge'
  if (normalized.includes('vaccin')) return 'vaccination'
  return 'vitals'
}

function buildFallbackDescription(cid: string, recordType: string): string {
  return `${recordTypeLabel[recordTypeFromChain(recordType)]} anchored at ${cid}`
}

export function mapContractRecord(tuple: ContractRecordTuple, patient: Patient): MedicalRecord {
  const [id, patientAddress, providerAddress, cid, previousCid, recordType, timestamp] = tuple
  const type = recordTypeFromChain(recordType)

  return {
    id: id.toString(),
    patientId: patient.id,
    type,
    title: `${recordTypeLabel[type]} #${id.toString()}`,
    description: buildFallbackDescription(cid, recordType),
    uploadedBy: providerAddress === patientAddress ? 'Connected wallet' : `${providerAddress.slice(0, 6)}...${providerAddress.slice(-4)}`,
    uploadedByRole: providerAddress === patientAddress ? 'Patient' : 'Provider',
    hospital: 'Algorand network',
    date: formatTimestamp(timestamp),
    ipfsHash: cid,
    txHash: previousCid || '',
    blockHeight: Number(timestamp),
    encrypted: true,
    size: `${Math.max(1, Math.round(cid.length / 4))} KB`,
    tags: [recordTypeLabel[type], type.toUpperCase()],
    color: type === 'prescription' ? 'sky' : type === 'lab' ? 'lime' : type === 'imaging' ? 'coral' : 'violet',
  }
}

async function readPreview(cid: string): Promise<string> {
  try {
    const raw = await fetchFromIPFS(cid)
    const trimmed = raw.trim()

    if (!trimmed) {
      return ''
    }

    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>
      const title = typeof parsed.title === 'string' ? parsed.title : ''
      const description = typeof parsed.description === 'string' ? parsed.description : ''
      return [title, description].filter(Boolean).join(' · ') || trimmed.slice(0, 140)
    } catch {
      return trimmed.slice(0, 180)
    }
  } catch {
    return ''
  }
}

export async function fetchPatientRecords(identifier: string): Promise<{ patient: Patient; records: MedicalRecord[] }> {
  const resolved = await resolvePatient(identifier)
  if (!medicalAppId) {
    return {
      patient: resolved.patient,
      records: [],
    }
  }

  try {
    const client = new MedicalRecordsClient({ appId: BigInt(medicalAppId), algorand })
    const tuples = (await client.state.box.patientRecords.value(resolved.walletAddress) || []) as ContractRecordTuple[]
    const mapped = tuples.map((tuple) => mapContractRecord(tuple, resolved.patient)).sort((left, right) => Number(right.blockHeight) - Number(left.blockHeight))

    return {
      patient: resolved.patient,
      records: mapped,
    }
  } catch {
    return {
      patient: resolved.patient,
      records: [],
    }
  }
}

export async function fetchAllPatientRecords(): Promise<MedicalRecord[]> {
  const results = await Promise.all(patients.map((patient) => fetchPatientRecords(patient.walletAddress)))
  return results.flatMap((result) => result.records)
}

export async function createPrescriptionCid(draft: PrescriptionDraft): Promise<string> {
  const payload = JSON.stringify({
    type: 'prescription',
    patientIdentifier: draft.patientIdentifier,
    patientName: draft.patientName,
    medication: draft.medication,
    dosage: draft.dosage,
    instructions: draft.instructions,
    notes: draft.notes ?? '',
    providerName: draft.providerName,
    createdAt: new Date().toISOString(),
  })

  const encryptedPayload = await encryptData(payload, draft.patientIdentifier)
  return uploadToIPFS(encryptedPayload, `prescription-${draft.patientIdentifier.replace(/\s+/g, '-')}`)
}

export async function loadRecordPreview(cid: string): Promise<string> {
  return readPreview(cid)
}

export async function getNextPrescriptionBoxName(): Promise<Uint8Array> {
  if (!medicalAppId) {
    return calcPrescriptionQueueBox(0n)
  }

  const client = new MedicalRecordsClient({ appId: BigInt(medicalAppId), algorand })
  const state = await client.state.global.getAll()
  const queueLength = state.queueLength ?? 0n

  return calcPrescriptionQueueBox(queueLength)
}

export async function buildPrescriptionBoxReferences(patientAddress: string): Promise<Array<{ appId: bigint; name: Uint8Array }>> {
  if (!medicalAppId) {
    return []
  }

  const recordBox = calcMedicalRecordBox(patientAddress)
  const nextQueueBox = await getNextPrescriptionBoxName()

  return [
    { appId: BigInt(medicalAppId), name: recordBox },
    { appId: BigInt(medicalAppId), name: nextQueueBox },
  ]
}
