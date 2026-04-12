import { NextRequest, NextResponse } from 'next/server';
import { handlePaymentNotify } from '@/lib/order/service';
import { prisma } from '@/lib/db';
import { getEnv } from '@/lib/config';
import { getSystemConfig } from '@/lib/system-config';
import { SepayProvider } from '@/lib/providers/sepay';
import type { SepayWebhookPayload } from '@/lib/providers/sepay';
import { extractHeaders } from '@/lib/utils/api';

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const headers = extractHeaders(request);

    // Parse payload early to get sepay_id for idempotency check
    let payload: SepayWebhookPayload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ success: false, error: 'invalid request body' }, { status: 400 });
    }

    if (!payload.id) {
      return NextResponse.json({ success: false, error: 'missing transaction id' }, { status: 400 });
    }

    // Idempotency: check if we already processed this SePay transaction
    const existing = await prisma.sepayTransaction.findUnique({
      where: { sepayId: payload.id },
    });
    if (existing) {
      return NextResponse.json({ success: true });
    }

    // Save raw transaction record
    const txRecord = await prisma.sepayTransaction.create({
      data: {
        sepayId: payload.id,
        gateway: payload.gateway || null,
        transactionDate: payload.transactionDate || null,
        accountNumber: payload.accountNumber || null,
        code: payload.code || null,
        content: payload.content || null,
        transferType: payload.transferType || null,
        transferAmount: payload.transferAmount || 0,
        accumulated: payload.accumulated ?? null,
        subAccount: payload.subAccount || null,
        referenceCode: payload.referenceCode || null,
        description: payload.description || null,
      },
    });

    // Use SePay provider to verify and match
    const provider = new SepayProvider();
    const notification = await provider.verifyNotification(rawBody, headers);

    if (!notification) {
      // No matching order found or not an incoming transfer — still return success to SePay
      return NextResponse.json({ success: true });
    }

    // Link transaction to order
    await prisma.sepayTransaction.update({
      where: { id: txRecord.id },
      data: { orderId: notification.orderId, matched: true },
    });

    // Process payment through the standard order flow
    await handlePaymentNotify(notification, provider.name);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('SePay notify error:', error);
    // Always return 200 to SePay to prevent retries for auth/config errors
    return NextResponse.json({ success: true });
  }
}
