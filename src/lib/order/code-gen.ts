import crypto from 'crypto';

export function generateRechargeCode(_orderId: string): string {
  const prefix = 'ORDER';
  const bytes = crypto.randomBytes(6);
  let digits = '';
  for (let i = 0; i < 10; i++) {
    // Use 2 bytes per pair to get enough randomness, cycling through bytes
    digits += (bytes[i % 6] % 10).toString();
  }
  return `${prefix}${digits}`;
}
