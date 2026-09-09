import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Paddle } from '@paddle/paddle-node-sdk';
import { deleteRestaurantCompletely } from '@/lib/server/delete-restaurant';

export const runtime = 'nodejs';

const paddle = new Paddle(
  process.env.PADDLE_API_KEY!
);

const priceToPlan = (
  priceId: string
): {
  planCode: 'starter' | 'pro' | 'enterprise';
  billingInterval: 'monthly' | 'yearly';
} | null => {
  if (
    priceId ===
      process.env.NEXT_PUBLIC_PADDLE_PRICE_STARTER_MONTHLY
  ) {
    return {
      planCode: 'starter',
      billingInterval: 'monthly',
    };
  }

  if (
    priceId ===
      process.env.NEXT_PUBLIC_PADDLE_PRICE_STARTER_YEARLY
  ) {
    return {
      planCode: 'starter',
      billingInterval: 'yearly',
    };
  }

  if (
    priceId ===
      process.env.NEXT_PUBLIC_PADDLE_PRICE_PRO_MONTHLY
  ) {
    return {
      planCode: 'pro',
      billingInterval: 'monthly',
    };
  }

  if (
    priceId ===
      process.env.NEXT_PUBLIC_PADDLE_PRICE_PRO_YEARLY
  ) {
    return {
      planCode: 'pro',
      billingInterval: 'yearly',
    };
  }

  if (
    priceId ===
      process.env.NEXT_PUBLIC_PADDLE_PRICE_ENTERPRISE_MONTHLY
  ) {
    return {
      planCode: 'enterprise',
      billingInterval: 'monthly',
    };
  }

  if (
    priceId ===
      process.env.NEXT_PUBLIC_PADDLE_PRICE_ENTERPRISE_YEARLY
  ) {
    return {
      planCode: 'enterprise',
      billingInterval: 'yearly',
    };
  }

  return null;
};

export async function POST(request: Request) {
  const signature = request.headers.get(
    'paddle-signature'
  );

  if (!signature) {
    return NextResponse.json(
      { error: 'Missing Paddle signature.' },
      { status: 400 }
    );
  }

  const body = await request.text();

  let event: any;

  try {
    event = await paddle.webhooks.unmarshal(
      body,
      process.env.PADDLE_WEBHOOK_SECRET!,
      signature
    );
  } catch (error) {
    console.error(
      'Paddle webhook signature verification failed:',
      error
    );

    return NextResponse.json(
      { error: 'Invalid Paddle webhook signature.' },
      { status: 400 }
    );
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    switch (event.eventType) {
      /*
       * Paddle creates a subscription after a recurring
       * transaction is completed.
       */
      case 'subscription.created':
      case 'subscription.activated':
      case 'subscription.updated':
      case 'subscription.resumed': {
        const subscription = event.data;

        const restaurantId =
          subscription.customData?.restaurant_id;

        const priceId =
          subscription.items?.[0]?.price?.id;

        if (!restaurantId) {
          console.error(
            'Paddle subscription is missing restaurant_id in custom data.'
          );

          return NextResponse.json(
            {
              error:
                'Subscription is missing restaurant information.',
            },
            { status: 400 }
          );
        }

        if (!priceId) {
          console.error(
            'Paddle subscription is missing a price ID.'
          );

          return NextResponse.json(
            {
              error:
                'Subscription is missing a price ID.',
            },
            { status: 400 }
          );
        }

        const plan = priceToPlan(priceId);

        if (!plan) {
          console.error(
            `Unknown Paddle price ID: ${priceId}`
          );

          return NextResponse.json(
            {
              error:
                'Unknown Paddle price ID.',
            },
            { status: 400 }
          );
        }

        const statusMap: Record<
          string,
          | 'trialing'
          | 'active'
          | 'past_due'
          | 'canceled'
          | 'expired'
        > = {
          trialing: 'trialing',
          active: 'active',
          past_due: 'past_due',
          canceled: 'canceled',
          paused: 'expired',
        };

        const status =
          statusMap[subscription.status] ??
          'expired';

        const customerId =
          subscription.customerId ?? null;

        const subscriptionId =
          subscription.id ?? null;

        const currentPeriodStart =
          subscription.currentBillingPeriod?.startsAt ??
          null;

        const currentPeriodEnd =
          subscription.currentBillingPeriod?.endsAt ??
          null;

        const { error } = await supabase
          .from('restaurant_subscriptions')
          .update({
            plan_code: plan.planCode,
            status,
            billing_interval:
              plan.billingInterval,
            provider_customer_id:
              customerId,
            provider_subscription_id:
              subscriptionId,
            current_period_start:
              currentPeriodStart,
            current_period_end:
              currentPeriodEnd,
            updated_at:
              new Date().toISOString(),
          })
          .eq(
            'restaurant_id',
            restaurantId
          );

        if (error) {
          console.error(
            'Failed to update restaurant subscription:',
            error
          );

          throw error;
        }

        break;
      }

      /*
       * Paddle sends this when a subscription becomes
       * past due because of an overdue payment.
       */
      case 'subscription.past_due': {
        const subscription = event.data;

        const restaurantId =
          subscription.customData?.restaurant_id;

        if (!restaurantId) {
          console.error(
            'Past-due Paddle subscription is missing restaurant_id.'
          );

          break;
        }

        const { error } = await supabase
          .from('restaurant_subscriptions')
          .update({
            status: 'past_due',
            updated_at:
              new Date().toISOString(),
          })
          .eq(
            'restaurant_id',
            restaurantId
          );

        if (error) {
          console.error(
            'Failed to mark restaurant subscription past due:',
            error
          );

          throw error;
        }

        break;
      }

      /*
       * Paddle sends this when a subscription becomes
       * paused.
       */
      case 'subscription.paused': {
        const subscription = event.data;

        const restaurantId =
          subscription.customData?.restaurant_id;

        if (!restaurantId) {
          console.error(
            'Paused Paddle subscription is missing restaurant_id.'
          );

          break;
        }

        const { error } = await supabase
          .from('restaurant_subscriptions')
          .update({
            status: 'expired',
            updated_at:
              new Date().toISOString(),
          })
          .eq(
            'restaurant_id',
            restaurantId
          );

        if (error) {
          console.error(
            'Failed to mark restaurant subscription paused:',
            error
          );

          throw error;
        }

        break;
      }

      /*
       * Paddle sends this when a subscription actually
       * becomes canceled.
       *
       * If cancellation was scheduled for the end of
       * the billing period, Paddle keeps the subscription
       * active until the cancellation takes effect.
       */
      case 'subscription.canceled': {
        const subscription = event.data;

        const restaurantId =
          subscription.customData?.restaurant_id;

        if (!restaurantId) {
          console.error(
            'Canceled Paddle subscription is missing restaurant_id.'
          );

          break;
        }

        const { data: restaurantSubscription, error: lookupError } =
          await supabase
            .from('restaurant_subscriptions')
            .select(
              `
                id,
                deletion_requested_at,
                deletion_scheduled_at
              `
            )
            .eq('restaurant_id', restaurantId)
            .maybeSingle();

        if (lookupError) {
          console.error(
            'Failed to load restaurant deletion state:',
            lookupError
          );

          throw lookupError;
        }

        /*
        * Always synchronize Paddle's final subscription state.
        */
        const { error: updateError } =
          await supabase
            .from('restaurant_subscriptions')
            .update({
              status: 'canceled',
              updated_at:
                new Date().toISOString(),
            })
            .eq('restaurant_id', restaurantId);

        if (updateError) {
          console.error(
            'Failed to cancel restaurant subscription:',
            updateError
          );

          throw updateError;
        }

        /*
        * Only permanently delete the restaurant when the owner
        * explicitly requested account deactivation.
        */
        if (
          restaurantSubscription?.deletion_requested_at &&
          restaurantSubscription?.deletion_scheduled_at
        ) {
          const scheduledAt = new Date(
            restaurantSubscription.deletion_scheduled_at
          );

          if (scheduledAt <= new Date()) {
            await deleteRestaurantCompletely(
              restaurantId
            );

          } else {
            console.log(
              `Restaurant deletion is scheduled for ${scheduledAt.toISOString()}`
            );
          }
        }

        break;
      }

      /*
       * We receive transaction.completed from Paddle as
       * part of the configured webhook destination.
       *
       * Subscription state is synchronized from the
       * subscription events above, so no database update
       * is required here.
       */
      case 'transaction.completed': {
        break;
      }

      /*
       * Other configured Paddle events are intentionally
       * ignored for now.
       */
      default: {
        break;
      }
    }

    return NextResponse.json({
      received: true,
    });
  } catch (error) {
    console.error(
      'Paddle webhook processing error:',
      error
    );

    return NextResponse.json(
      {
        error:
          'Webhook processing failed.',
      },
      { status: 500 }
    );
  }
}