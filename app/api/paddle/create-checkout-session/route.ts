import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const PADDLE_API_URL =
  process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT === 'production'
    ? 'https://api.paddle.com'
    : 'https://sandbox-api.paddle.com';

const priceMap = {
  starter: {
    monthly: process.env.NEXT_PUBLIC_PADDLE_PRICE_STARTER_MONTHLY!,
    yearly: process.env.NEXT_PUBLIC_PADDLE_PRICE_STARTER_YEARLY!,
  },
  pro: {
    monthly: process.env.NEXT_PUBLIC_PADDLE_PRICE_PRO_MONTHLY!,
    yearly: process.env.NEXT_PUBLIC_PADDLE_PRICE_PRO_YEARLY!,
  },
  enterprise: {
    monthly: process.env.NEXT_PUBLIC_PADDLE_PRICE_ENTERPRISE_MONTHLY!,
    yearly: process.env.NEXT_PUBLIC_PADDLE_PRICE_ENTERPRISE_YEARLY!,
  },
} as const;

type Plan = keyof typeof priceMap;
type BillingCycle = 'monthly' | 'yearly';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const plan = body.plan as Plan;
    const billingCycle = body.billingCycle as BillingCycle;

    if (
      !priceMap[plan] ||
      !priceMap[plan][billingCycle]
    ) {
      return NextResponse.json(
        { error: 'Invalid plan or billing cycle.' },
        { status: 400 }
      );
    }

    const authorization =
      request.headers.get('Authorization') ?? '';

    if (!authorization) {
      return NextResponse.json(
        { error: 'You must be logged in.' },
        { status: 401 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: authorization,
          },
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
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
            'Only the restaurant owner can change the plan.',
        },
        { status: 403 }
      );
    }

    const { data: restaurant, error: restaurantError } =
      await supabase
        .from('restaurants')
        .select('id, name')
        .eq('id', membership.restaurant_id)
        .single();

    if (restaurantError || !restaurant) {
      return NextResponse.json(
        { error: 'Restaurant not found.' },
        { status: 404 }
      );
    }

    const priceId = priceMap[plan][billingCycle];

    const { data: existingSubscription, error: subscriptionError } =
      await supabase
        .from('restaurant_subscriptions')
        .select(
          'provider_subscription_id, provider_customer_id, plan_code, status, billing_interval'
        )
        .eq('restaurant_id', restaurant.id)
        .maybeSingle();

    if (subscriptionError) {
      console.error(
        'Failed to load restaurant subscription:',
        subscriptionError
      );

      return NextResponse.json(
        {
          error: 'Unable to load the current subscription.',
        },
        { status: 500 }
      );
    }

    if (
      existingSubscription?.provider_subscription_id &&
      existingSubscription.status === 'active'
    ) {
      const paddleResponse = await fetch(
        `${PADDLE_API_URL}/subscriptions/${existingSubscription.provider_subscription_id}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${process.env.PADDLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            items: [
              {
                price_id: priceId,
                quantity: 1,
              },
            ],
            proration_billing_mode: 'prorated_immediately',
          }),
        }
      );

      const paddleData = await paddleResponse.json();

      if (!paddleResponse.ok) {
        console.error(
          'Paddle subscription update failed:',
          paddleData
        );

        return NextResponse.json(
          {
            error:
              paddleData?.error?.detail ||
              paddleData?.error?.message ||
              'Unable to update Paddle subscription.',
          },
          { status: 502 }
        );
      }

      return NextResponse.json({
        updated: true,
        subscriptionId:
          paddleData?.data?.id ||
          existingSubscription.provider_subscription_id,
      });
    }

    /*
     * Create the Paddle transaction server-side.
     *
     * The restaurant ID comes from the authenticated
     * restaurant membership, not from the browser.
     */
    const paddleResponse = await fetch(
      `${PADDLE_API_URL}/transactions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.PADDLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: [
            {
              price_id: priceId,
              quantity: 1,
            },
          ],
          collection_mode: 'automatic',
          custom_data: {
            restaurant_id: restaurant.id,
            user_id: user.id,
            plan_code: plan,
            billing_interval: billingCycle,
          },
          ...(user.email
            ? {
                customer: {
                  email: user.email,
                },
              }
            : {}),
        }),
      }
    );

    const paddleData = await paddleResponse.json();

    if (!paddleResponse.ok) {
      console.error(
        'Paddle transaction creation failed:',
        paddleData
      );

      return NextResponse.json(
        {
          error:
            paddleData?.error?.detail ||
            paddleData?.error?.message ||
            'Unable to create Paddle checkout.',
        },
        { status: 502 }
      );
    }

    const transaction = paddleData?.data;

    if (!transaction?.id) {
      return NextResponse.json(
        {
          error:
            'Paddle did not return a transaction ID.',
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      transactionId: transaction.id,
    });
  } catch (error) {
    console.error('Paddle Checkout error:', error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to create Paddle Checkout transaction.',
      },
      { status: 500 }
    );
  }
}