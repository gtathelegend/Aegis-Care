/**
 * IPFS utilities for Aegis Care
 * Handles Pinata integration and IPFS gateway URLs
 */

const PINATA_GATEWAY = process.env.NEXT_PUBLIC_PINATA_GATEWAY || 'https://gateway.pinata.cloud';

export function getIpfsGatewayUrl(ipfsHash: string): string {
  if (!ipfsHash) return '';
  // Remove ipfs:// prefix if present
  const hash = ipfsHash.replace(/^ipfs:\/\//, '');
  return `${PINATA_GATEWAY}/ipfs/${hash}`;
}

export function formatIpfsHash(hash: string): string {
  if (!hash) return '';
  const cleaned = hash.replace(/^ipfs:\/\//, '');
  return `ipfs://${cleaned.slice(0, 8)}...${cleaned.slice(-8)}`;
}

export async function uploadToPinata(file: File, metadata?: Record<string, any>): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);

  if (metadata) {
    formData.append('pinataMetadata', JSON.stringify({
      name: file.name,
      keyvalues: metadata,
    }));
  }

  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to upload to IPFS');
  }

  const data = await response.json();
  return data.ipfsHash;
}

export function isValidIpfsHash(hash: string): boolean {
  // Basic validation - starts with Qm or baf (CIDv0 or CIDv1)
  const cleaned = hash.replace(/^ipfs:\/\//, '');
  return /^(Qm|baf)[a-zA-Z0-9]{44,}/.test(cleaned);
}
