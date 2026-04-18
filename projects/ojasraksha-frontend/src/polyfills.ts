import { Buffer } from 'buffer'

if (typeof window !== 'undefined') {
  (window as any).Buffer = Buffer;
}

if (typeof globalThis !== 'undefined') {
  (globalThis as any).Buffer = Buffer;
}

export { Buffer }
