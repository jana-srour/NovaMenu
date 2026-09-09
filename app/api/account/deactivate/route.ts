import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { deleteRestaurantCompletely } from '@/lib/server/delete-restaurant';

export const runtime = 'nodejs';

const PADDLE_API_URL =
  process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT === 'production'
    ? 'https://api.paddle.com'
    : 'https://sandbox-api.paddle.com';

export async function POST(request: Request) {
  try {
    const authorization =
      request.headers.get('authorization');

    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized.' },
        { status: 401 }
      );
    }

    const accessToken =
      authorization.replace('Bearer ', '');

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(accessToken);

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized.' },
        { status: 401 }
      );
    }

    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: membership, error: membershipError } =
      await adminSupabase
        .from('restaurant_members')
        .select('restaurant_id, role')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

    if (membershipError) {
      console.error(
        'Failed to load restaurant membership:',
        membershipError
      );

      return NextResponse.json(
        { error: 'Unable to verify restaurant ownership.' },
        { status: 500 }
      );
    }

    if (!membership) {
      return NextResponse.json(
        { error: 'Restaurant membership not found.' },
        { status: 403 }
      );
    }

    if (membership.role !== 'owner') {
      return NextResponse.json(
        {
          error:
            'Only the restaurant owner can deactivate the restaurant.',
        },
        { status: 403 }
      );
    }

    const restaurantId = membership.restaurant_id;

    const { data: subscription, error: subscriptionError } =
      await adminSupabase
        .from('restaurant_subscriptions')
        .select(
          `
            id,
            status,
            provider_subscription_id,
            trial_ends_at,
            current_period_end,
            deletion_requested_at,
            deletion_scheduled_at
          `
        )
        .eq('restaurant_id', restaurantId)
        .maybeSingle();

    if (subscriptionError) {
      console.error(
        'Failed to load restaurant subscription:',
        subscriptionError
      );

      return NextResponse.json(
        {
          error:
            'Unable to load the restaurant subscription.',
        },
        { status: 500 }
      );
    }

    const isTrial = subscription?.status === 'trialing';

    if (
      !isTrial &&
      subscription?.deletion_requested_at &&
      subscription?.deletion_scheduled_at
    ) {
      return NextResponse.json({
        success: true,
        alreadyScheduled: true,
        deletionScheduledAt:
          subscription.deletion_scheduled_at,
      });
    }

    const now = new Date();

    let deletionScheduledAt: string | null = null;

    /*
     * Trials are deactivated immediately. Cancel the provider
     * subscription first when one exists, then remove all data.
     */
    if (subscription?.provider_subscription_id) {
      const paddleResponse = await fetch(
        `${PADDLE_API_URL}/subscriptions/${subscription.provider_subscription_id}/cancel`,
        {
          method: 'POST',
          headers: {
            Authorization:
              `Bearer ${process.env.PADDLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            effective_from:
              isTrial
                ? 'immediately'
                : 'next_billing_period',
          }),
        }
      );

      const paddleData =
        await paddleResponse.json();

      if (!paddleResponse.ok) {
        console.error(
          'Paddle cancellation failed:',
          paddleData
        );

        return NextResponse.json(
          {
            error:
              paddleData?.error?.detail ||
              paddleData?.error?.message ||
              'Unable to cancel the Paddle subscription.',
          },
          { status: 502 }
        );
      }

      deletionScheduledAt = isTrial
        ? null
        : paddleData?.data?.scheduledChange?.effectiveAt ??
          null;

      /*
       * Fallback in case Paddle does not return a
       * scheduled change in the response.
       */
      if (!isTrial && !deletionScheduledAt) {
        deletionScheduledAt =
          subscription.trial_ends_at ??
          subscription.current_period_end ??
          null;
      }
    } else if (!isTrial) {
      /*
       * Paid account without a Paddle subscription.
       * Use the local subscription period as the fallback.
       */
      deletionScheduledAt =
        subscription?.current_period_end ??
        subscription?.trial_ends_at ??
        null;
    }

    if (isTrial) {
      await deleteRestaurantCompletely(restaurantId);

      return NextResponse.json({
        success: true,
        deletedImmediately: true,
      });
    }

    if (
      !deletionScheduledAt ||
      new Date(deletionScheduledAt) <= now
    ) {
      return NextResponse.json(
        {
          error:
            'The restaurant has no valid subscription or trial end date.',
        },
        { status: 409 }
      );
    }

    const { error: updateError } =
      await adminSupabase
        .from('restaurant_subscriptions')
        .update({
          deletion_requested_at:
            now.toISOString(),
          deletion_scheduled_at:
            deletionScheduledAt,
          updated_at:
            now.toISOString(),
        })
        .eq('restaurant_id', restaurantId);

    if (updateError) {
      console.error(
        'Failed to schedule restaurant deletion:',
        updateError
      );

      return NextResponse.json(
        {
          error:
            'Subscription was canceled, but the deletion schedule could not be saved.',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      deletionScheduledAt,
    });
  } catch (error) {
    console.error(
      'Restaurant deactivation error:',
      error
    );

    return NextResponse.json(
      {
        error:
          'Unable to deactivate the restaurant.',
      },
      { status: 500 }
    );
  }
}