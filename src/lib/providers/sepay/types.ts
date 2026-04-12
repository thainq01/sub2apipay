export interface SepayWebhookPayload {
  id: number;
  gateway: string;
  transactionDate: string;
  accountNumber: string;
  code: string;
  content: string;
  transferType: string;
  transferAmount: number;
  accumulated: number;
  subAccount: string;
  referenceCode: string;
  description: string;
}

/**
 * Extract a recharge code from SePay webhook fields.
 * Format: ORDER + 10 digits (e.g., ORDER1234567890)
 */
export function extractRechargeCode(text: string): string | null {
  const match = text.match(/\bORDER\d{10}\b/);
  return match ? match[0] : null;
}
