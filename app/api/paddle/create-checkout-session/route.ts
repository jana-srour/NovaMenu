import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { billingPlans, type BillingPlan } from '@/lib/billing/plans';

const PADDLE_API_URL =
  process.env.NEXT_PADDLE_ENVIRONMENT === 'production'
    ? 'https://api.paddle.com'
    : 'https://sandbox-api.paddle.com';

const PADDLE_ENVIRONMENT =
  process.env.NEXT_PADDLE_ENVIRONMENT === 'production'
    ? 'production'
    : 'sandbox';

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
    const checkoutUrl =
      process.env.PADDLE_CHECKOUT_URL ||
      `${new URL(request.url).origin}/dashboard/billing`;

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

    const currentPlanDetails =
      existingSubscription?.plan_code &&
      existingSubscription.plan_code in billingPlans
        ? billingPlans[
            existingSubscription.plan_code as BillingPlan
          ]
        : null;

    const currentPlanPrice =
      currentPlanDetails &&
      existingSubscription?.billing_interval === billingCycle
        ? billingCycle === 'monthly'
          ? currentPlanDetails.monthlyPrice
          : currentPlanDetails.yearlyPrice
        : null;

    const selectedPlanPrice =
      billingCycle === 'monthly'
        ? billingPlans[plan].monthlyPrice
        : billingPlans[plan].yearlyPrice;

    const upgradeCredit =
      existingSubscription?.status === 'active' &&
      existingSubscription.plan_code !== plan &&
      currentPlanPrice !== null &&
      selectedPlanPrice > currentPlanPrice
        ? currentPlanPrice
        : 0;

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
          checkout: {
            url: checkoutUrl,
          },
          ...(upgradeCredit > 0
            ? {
                discount: {
                  description:
                    'Credit for the current paid plan',
                  type: 'flat',
                  amount: String(
                    Math.round(upgradeCredit * 100)
                  ),
                  currency_code: 'USD',
                  recur: false,
                },
              }
            : {}),
          ...(existingSubscription?.provider_customer_id
            ? {
                customer_id:
                  existingSubscription.provider_customer_id,
              }
            : {}),
          custom_data: {
            restaurant_id: restaurant.id,
            user_id: user.id,
            plan_code: plan,
            billing_interval: billingCycle,
            previous_subscription_id:
              existingSubscription?.status === 'active'
                ? existingSubscription.provider_subscription_id
                : null,
          },
        }),
      }
    );

    const paddleData = await paddleResponse.json();

    if (!paddleResponse.ok) {
      console.error(
        'Paddle transaction creation failed:',
        JSON.stringify(paddleData, null, 2)
      );

      const paddleErrors = Array.isArray(
        paddleData?.error?.errors
      )
        ? paddleData.error.errors
            .map(
              (item: { detail?: string; field?: string }) =>
                item.field
                  ? `${item.field}: ${item.detail || 'Invalid value.'}`
                  : item.detail || 'Invalid request.'
            )
            .join(' ')
        : null;

      return NextResponse.json(
        {
          error:
            paddleErrors ||
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
      environment: PADDLE_ENVIRONMENT,
      clientToken: process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN,
      upgradeCredit,
      amountBeforePaddleFees:
        selectedPlanPrice - upgradeCredit,
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