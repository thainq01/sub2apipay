import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getEnv } from '@/lib/config';
import { buildOrderResultUrl } from '@/lib/order/status-access';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true },
  });

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  const env = getEnv();
  const resultUrl = buildOrderResultUrl(env.NEXT_PUBLIC_APP_URL, order.id);
  return NextResponse.redirect(resultUrl);
}
