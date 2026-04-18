/**
 * Generates a deterministic 6-character Short ID for a patient.
 * Pattern: 3 numeric characters derived from address hash + last 3 characters of the wallet address.
 * 
 * @param walletAddress The Algorand wallet address (58 characters)
 * @returns A 6-character string (e.g., "482H7R")
 */
export const generateShortId = (walletAddress: string): string => {
  if (!walletAddress || walletAddress.length < 3) {
    throw new Error('Invalid wallet address')
  }

  // Linear feedback or simple hash to get 3 deterministic digits (100-999)
  let hash = 0
  for (let i = 0; i < walletAddress.length; i++) {
    hash = ((hash << 5) - hash) + walletAddress.charCodeAt(i)
    hash |= 0 // Convert to 32bit integer
  }
  
  const deterministicDigits = (Math.abs(hash) % 900 + 100).toString()

  // Get last 3 characters of the wallet address
  const lastThree = walletAddress.slice(-3).toUpperCase()

  return `${deterministicDigits}${lastThree}`
}

/**
 * Validates if a string matches the Short ID pattern (3 digits + 3 uppercase/digits)
 */
export const isValidShortId = (shortId: string): boolean => {
  return /^\d{3}[A-Z0-9]{3}$/.test(shortId)
}
