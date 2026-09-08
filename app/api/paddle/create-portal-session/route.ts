import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const PADDLE_API_URL =
  process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT === 'production'
    ? 'https://api.paddle.com'
    : 'https://sandbox-api.paddle.com';

export async function POST(request: Request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization:
              request.headers.get('Authorization') ?? '',
          },
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'You must be logged in.' },
        { status: 401 }
      );
    }

    const { data: membership, error: membershipError } =
      await supabase
        .from('restaurant_members')
        .select('restaurant_id, role')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

    if (membershipError || !membership) {
      return NextResponse.json(
        { error: 'Restaurant membership not found.' },
        { status: 403 }
      );
    }

    if (membership.role !== 'owner') {
      return NextResponse.json(
        {
          error:
            'Only the restaurant owner can manage billing.',
        },
        { status: 403 }
      );
    }

    const { data: subscription, error: subscriptionError } =
      await supabase
        .from('restaurant_subscriptions')
        .select(
          'provider_customer_id, provider_subscription_id'
        )
        .eq('restaurant_id', membership.restaurant_id)
        .maybeSingle();

    if (subscriptionError) {
      console.error(
        'Subscription lookup error:',
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

    if (!subscription?.provider_customer_id) {
      return NextResponse.json(
        {
          error:
            'No Paddle customer is associated with this restaurant.',
        },
        { status: 400 }
      );
    }

    const paddleResponse = await fetch(
      `${PADDLE_API_URL}/customers/${subscription.provider_customer_id}/portal-sessions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.PADDLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: undefined,
      }
    );

    const paddleData = await paddleResponse.json();

    if (!paddleResponse.ok) {
      console.error(
        'Paddle Customer Portal error:',
        paddleData
      );

      return NextResponse.json(
        {
          error:
            paddleData?.error?.detail ||
            paddleData?.error?.message ||
            'Unable to create Paddle billing portal session.',
        },
        { status: 502 }
      );
    }

    const portalUrl =
      paddleData?.data?.urls?.general?.overview;

    if (!portalUrl) {
      return NextResponse.json(
        {
          error:
            'Paddle did not return a billing portal URL.',
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      url: portalUrl,
    });
  } catch (error) {
    console.error(
      'Paddle Customer Portal error:',
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to open Paddle billing management.',
      },
      { status: 500 }
    );
  }
}