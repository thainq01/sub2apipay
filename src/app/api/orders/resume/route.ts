import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserByToken } from '@/lib/sub2api/client';
import { getEnv } from '@/lib/config';
import { getSystemConfig } from '@/lib/system-config';
import { createOrderStatusAccessToken } from '@/lib/order/status-access';

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token') || '';
  const orderId = request.nextUrl.searchParams.get('order_id') || '';

  if (!token || !orderId) {
    return NextResponse.json({ error: 'Missing token or order_id' }, { status: 400 });
  }

  let user;
  try {
    user = await getCurrentUserByToken(token);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      userId: true,
      amount: true,
      payAmount: true,
      status: true,
      paymentType: true,
      expiresAt: true,
      rechargeCode: true,
      orderType: true,
    },
  });

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  if (order.userId !== user.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  if (order.status !== 'PENDING') {
    return NextResponse.json({ error: 'Order is not pending', status: order.status }, { status: 400 });
  }

  // Regenerate SePay QR and bank info
  const env = getEnv();
  const bankAccount = (await getSystemConfig('SEPAY_BANK_ACCOUNT')) || env.SEPAY_BANK_ACCOUNT || '';
  const bankName = (await getSystemConfig('SEPAY_BANK_NAME')) || env.SEPAY_BANK_NAME || '';
  const accountName = (await getSystemConfig('SEPAY_ACCOUNT_NAME')) || env.SEPAY_ACCOUNT_NAME || '';

  const payAmount = Number(order.payAmount ?? order.amount);
  const transferCode = order.rechargeCode || order.id;
  let qrCode: string | undefined;
  if (bankAccount && bankName) {
    qrCode = `https://qr.sepay.vn/img?acc=${encodeURIComponent(bankAccount)}&bank=${encodeURIComponent(bankName)}&amount=${Math.round(payAmount)}&des=${encodeURIComponent(transferCode)}`;
  }

  const statusAccessToken = createOrderStatusAccessToken(order.id);

  return NextResponse.json({
    orderId: order.id,
    amount: Number(order.amount),
    payAmount,
    status: order.status,
    paymentType: order.paymentType,
    expiresAt: order.expiresAt.toISOString(),
    statusAccessToken,
    qrCode: qrCode || null,
    sepayBankInfo: bankAccount ? {
      bankName,
      accountNumber: bankAccount,
      accountName,
      transferCode: order.rechargeCode || order.id,
    } : null,
    orderType: order.orderType || 'balance',
  });
}
