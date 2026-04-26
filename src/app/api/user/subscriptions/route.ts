import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserByToken, getUserSubscriptions, getGroup } from '@/lib/sub2api/client';

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')?.trim();
  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 401 });
  }

  let user;
  try {
    user = await getCurrentUserByToken(token);
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  try {
    const subscriptions = await getUserSubscriptions(user.id);

    // Filter to only active subscriptions and enrich with group info
    const activeSubscriptions = subscriptions.filter(
      (sub) => sub.status === 'active' && new Date(sub.expires_at) > new Date()
    );

    // Fetch group info for each subscription
    const enriched = await Promise.all(
      activeSubscriptions.map(async (sub) => {
        let groupName = null;
        let platform = null;
        try {
          const group = await getGroup(sub.group_id);
          groupName = group?.name ?? null;
          platform = group?.platform ?? null;
        } catch {
          // Group fetch failed, continue without enrichment
        }

        return {
          id: sub.id,
          groupId: sub.group_id,
          groupName,
          platform,
          startsAt: sub.starts_at,
          expiresAt: sub.expires_at,
          status: sub.status,
          dailyUsageUsd: sub.daily_usage_usd,
          weeklyUsageUsd: sub.weekly_usage_usd,
          monthlyUsageUsd: sub.monthly_usage_usd,
        };
      })
    );

    return NextResponse.json({ subscriptions: enriched });
  } catch (error) {
    console.error('Failed to fetch user subscriptions:', error);
    return NextResponse.json({ error: 'Failed to fetch subscriptions' }, { status: 500 });
  }
}
