import algosdk from 'algosdk';

export const calcMedicalRecordBox = (patientAddress: string) => {
  const encoder = new TextEncoder();
  const prefix = encoder.encode('pr_');
  const addressBytes = algosdk.decodeAddress(patientAddress).publicKey;
  const boxName = new Uint8Array(prefix.length + addressBytes.length);
  boxName.set(prefix);
  boxName.set(addressBytes, prefix.length);
  return boxName;
};

export const calcPrescriptionQueueBox = (index: number | bigint) => {
  const encoder = new TextEncoder();
  const prefix = encoder.encode('pq_');
  const indexBytes = algosdk.encodeUint64(BigInt(index));
  const boxName = new Uint8Array(prefix.length + indexBytes.length);
  boxName.set(prefix);
  boxName.set(indexBytes, prefix.length);
  return boxName;
};

export const calcConsentBox = (patientAddress: string) => {
  const encoder = new TextEncoder();
  const prefix = encoder.encode('c_');
  const addressBytes = algosdk.decodeAddress(patientAddress).publicKey;
  const boxName = new Uint8Array(prefix.length + addressBytes.length);
  boxName.set(prefix);
  boxName.set(addressBytes, prefix.length);
  return boxName;
};

export const calcAccessRequestBox = (patientAddress: string) => {
  const encoder = new TextEncoder();
  const prefix = encoder.encode('ar_');
  const addressBytes = algosdk.decodeAddress(patientAddress).publicKey;
  const boxName = new Uint8Array(prefix.length + addressBytes.length);
  boxName.set(prefix);
  boxName.set(addressBytes, prefix.length);
  return boxName;
};

/** Queue Manager: patient-indexed request list */
export const calcQueuePatientBox = (patientAddress: string) => {
  const encoder = new TextEncoder();
  const prefix = encoder.encode('prq_');
  const addressBytes = algosdk.decodeAddress(patientAddress).publicKey;
  const boxName = new Uint8Array(prefix.length + addressBytes.length);
  boxName.set(prefix);
  boxName.set(addressBytes, prefix.length);
  return boxName;
};

/** Queue Manager: a single request entry by ID */
export const calcQueueRequestBox = (requestId: bigint) => {
  const encoder = new TextEncoder();
  const prefix = encoder.encode('req_');
  const idBytes = algosdk.encodeUint64(requestId);
  const boxName = new Uint8Array(prefix.length + idBytes.length);
  boxName.set(prefix);
  boxName.set(idBytes, prefix.length);
  return boxName;
};

/** DataFiduciaryRegistry: a single fiduciary address box */
export const calcFiduciaryBox = (fiduciaryAddress: string) => {
  const encoder = new TextEncoder();
  const prefix = encoder.encode('fid_');
  const addressBytes = algosdk.decodeAddress(fiduciaryAddress).publicKey;
  const boxName = new Uint8Array(prefix.length + addressBytes.length);
  boxName.set(prefix);
  boxName.set(addressBytes, prefix.length);
  return boxName;
};

/** HealthcareRBAC: a single user role box */
export const calcRoleBox = (userAddress: string) => {
  const encoder = new TextEncoder();
  const prefix = encoder.encode('role_');
  const addressBytes = algosdk.decodeAddress(userAddress).publicKey;
  const boxName = new Uint8Array(prefix.length + addressBytes.length);
  boxName.set(prefix);
  boxName.set(addressBytes, prefix.length);
  return boxName;
};
