'use client';

import { useEffect, useState } from 'react';
import {
  Check,
  CreditCard,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import { initializePaddle } from '@paddle/paddle-js';
import { supabase } from '@/lib/supabase';
import {
  billingFeatureLabels,
  billingPlans,
  type BillingFeature,
  type BillingPlan,
  type SubscriptionStatus,
} from '@/lib/billing/plans';

type Subscription = {
  plan_code: BillingPlan;
  status: SubscriptionStatus;
  trial_ends_at: string;
  billing_interval: 'monthly' | 'yearly' | null;
};

type BillingInterval = 'monthly' | 'yearly';

const planOrder: BillingPlan[] = [
  'starter',
  'pro',
  'enterprise',
];

export default function BillingPage() {
  const [subscription, setSubscription] =
    useState<Subscription | null>(null);

  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [trialDaysLeft, setTrialDaysLeft] = useState(0);

  const [billingInterval, setBillingInterval] =
    useState<BillingInterval>('monthly');

  useEffect(() => {
    let channel:
      | ReturnType<typeof supabase.channel>
      | null = null;

    const loadSubscription = async () => {
      const { data: auth } =
        await supabase.auth.getUser();

      if (!auth.user) {
        setLoading(false);
        return;
      }

      const { data: membership, error: membershipError } =
        await supabase
          .from('restaurant_members')
          .select('restaurant_id')
          .eq('user_id', auth.user.id)
          .limit(1)
          .maybeSingle();

      if (membershipError) {
        console.error(
          'Membership load error:',
          membershipError
        );
      }

      if (!membership?.restaurant_id) {
        setLoading(false);
        return;
      }

      const restaurantId = membership.restaurant_id;

      const updateSubscriptionState = (
        data: Subscription | null
      ) => {
        setSubscription(data);

        if (data?.status === 'trialing') {
          setTrialDaysLeft(
            Math.max(
              0,
              Math.ceil(
                (new Date(
                  data.trial_ends_at
                ).getTime() -
                  Date.now()) /
                  86400000
              )
            )
          );
        } else {
          setTrialDaysLeft(0);
        }

        setLoading(false);
      };

      /*
      * Load the current subscription first.
      */
      const {
        data,
        error: subscriptionError,
      } = await supabase
        .from('restaurant_subscriptions')
        .select(
          'plan_code, status, trial_ends_at, billing_interval'
        )
        .eq('restaurant_id', restaurantId)
        .maybeSingle();

      if (subscriptionError) {
        console.error(
          'Subscription load error:',
          subscriptionError
        );
      }

      updateSubscriptionState(
        data as Subscription | null
      );

      /*
      * Remove any existing channel using this name.
      *
      * This prevents React Strict Mode / hot reload from
      * leaving an already-subscribed channel behind.
      */
      const channelName =
        `billing-subscription-${restaurantId}`;

      const existingChannel =
        supabase.getChannels().find(
          (existing) =>
            existing.topic ===
            `realtime:${channelName}`
        );

      if (existingChannel) {
        await supabase.removeChannel(
          existingChannel
        );
      }

      /*
      * Create a completely fresh channel.
      */
      channel =
        supabase.channel(channelName);

      /*
      * IMPORTANT:
      * Register the postgres_changes listener BEFORE
      * subscribe() is ever called.
      */
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'restaurant_subscriptions',
          filter:
            `restaurant_id=eq.${restaurantId}`,
        },
        (payload) => {
          if (
            payload.eventType === 'DELETE'
          ) {
            updateSubscriptionState(null);
            return;
          }

          updateSubscriptionState(
            payload.new as Subscription
          );
        }
      );

      /*
      * Subscribe only after the callback is registered.
      */
      channel.subscribe((status) => {
        console.log(
          'Billing subscription realtime status:',
          status
        );
      });
    };

    loadSubscription();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
        channel = null;
      }
    };
  }, []);

  const startCheckout = async (
    plan: BillingPlan
  ) => {
    try {
      setLoading(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error(
          'You must be logged in to continue.'
        );
      }

      const response = await fetch(
        '/api/paddle/create-checkout-session',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            plan,
            billingCycle: billingInterval,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            'Unable to start checkout.'
        );
      }

      if (data.updated) {
        setLoading(false);

        alert(
          'Your subscription has been updated successfully.'
        );

        return;
      }

      if (!data.transactionId) {
        throw new Error(
          'Paddle Checkout transaction was not returned.'
        );
      }

      if (!data.clientToken) {
        throw new Error(
          'Paddle Checkout client token is not configured.'
        );
      }

      const paddle =
        await initializePaddle({
          environment: data.environment === 'production'
            ? 'production'
            : 'sandbox',
          token: data.clientToken,
        });

      if (!paddle) {
        throw new Error(
          'Unable to initialize Paddle Checkout.'
        );
      }

      paddle.Checkout.open({
        transactionId: data.transactionId,
        settings: {
          allowLogout: false,
        },
      });

      setLoading(false);
    } catch (error) {
      console.error(
        'Paddle Checkout error:',
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : 'Unable to start Paddle Checkout.'
      );

      setLoading(false);
    }
  };

  const openBillingPortal = async () => {
    try {
      setPortalLoading(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error(
          'You must be logged in to continue.'
        );
      }

      const response = await fetch(
        '/api/paddle/create-portal-session',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            'Unable to open billing management.'
        );
      }

      if (!data.url) {
        throw new Error(
          'Paddle billing portal URL was not returned.'
        );
      }

      window.location.href = data.url;
    } catch (error) {
      console.error(
        'Paddle billing portal error:',
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : 'Unable to open billing management.'
      );

      setPortalLoading(false);
    }
  };

  const hasActiveSubscription =
    subscription?.status === 'active';

  return (
    <main
      className="min-h-screen px-5 py-8 sm:px-8 lg:px-12 lg:py-12"
      style={{
        background: 'var(--portal-background)',
        color: 'var(--portal-text)',
      }}
    >
      <div className="mx-auto max-w-6xl">
        <header
          className="mb-8 rounded-[28px] border p-6 shadow-sm sm:p-8"
          style={{
            background: 'var(--portal-surface)',
            borderColor: 'var(--portal-border)',
          }}
        >
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div
                className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em]"
                style={{
                  color: 'var(--portal-accent)',
                }}
              >
                <CreditCard className="h-4 w-4" />
                Billing & plans
              </div>

              <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
                Choose the right operating level.
              </h1>

              <p
                className="mt-3 max-w-2xl text-sm leading-7"
                style={{
                  color: 'var(--portal-muted)',
                }}
              >
                Every new restaurant starts with seven
                days of full access. After the trial,
                choose a plan to keep the features your
                team needs.
              </p>
            </div>

            <div className="flex flex-col items-stretch gap-3 sm:items-end">
              <div
                className="rounded-2xl border px-4 py-3 text-sm"
                style={{
                  borderColor: 'var(--portal-border)',
                  background: 'var(--portal-background)',
                }}
              >
                {loading
                  ? 'Loading subscription...'
                  : subscription?.status ===
                      'trialing'
                    ? trialDaysLeft > 0
                      ? `${trialDaysLeft} trial days left`
                      : 'Trial expired'
                    : subscription?.status ===
                        'active'
                      ? `${billingPlans[subscription.plan_code].name} plan`
                      : subscription
                        ? 'Subscription requires attention'
                        : 'No plan selected'}
              </div>

              {hasActiveSubscription && (
                <button
                  type="button"
                  onClick={openBillingPortal}
                  disabled={portalLoading}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-xs font-black uppercase tracking-[0.1em] transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-60"
                  style={{
                    borderColor: 'var(--portal-border)',
                    background: 'var(--portal-surface)',
                    color: 'var(--portal-text)',
                  }}
                >
                  <ExternalLink className="h-4 w-4" />

                  {portalLoading
                    ? 'Opening...'
                    : 'Manage billing'}
                </button>
              )}
            </div>
          </div>
        </header>

        <div className="mb-6 flex justify-center">
          <div
            className="inline-flex rounded-2xl border p-1"
            style={{
              background: 'var(--portal-surface)',
              borderColor: 'var(--portal-border)',
            }}
          >
            <button
              type="button"
              onClick={() =>
                setBillingInterval('monthly')
              }
              className="rounded-xl px-5 py-2.5 text-xs font-black uppercase tracking-[0.1em] transition"
              style={{
                background:
                  billingInterval === 'monthly'
                    ? 'var(--portal-accent)'
                    : 'transparent',
                color:
                  billingInterval === 'monthly'
                    ? '#fff'
                    : 'var(--portal-muted)',
              }}
            >
              Monthly
            </button>

            <button
              type="button"
              onClick={() =>
                setBillingInterval('yearly')
              }
              className="rounded-xl px-5 py-2.5 text-xs font-black uppercase tracking-[0.1em] transition"
              style={{
                background:
                  billingInterval === 'yearly'
                    ? 'var(--portal-accent)'
                    : 'transparent',
                color:
                  billingInterval === 'yearly'
                    ? '#fff'
                    : 'var(--portal-muted)',
              }}
            >
              Yearly
            </button>
          </div>
        </div>

        <div className="mb-6 grid gap-5 lg:grid-cols-3">
          {planOrder.map((plan) => {
            const details = billingPlans[plan];

            const current =
              subscription?.plan_code === plan &&
              subscription?.billing_interval ===
                billingInterval &&
              subscription?.status === 'active';

            const samePlanDifferentInterval =
              subscription?.plan_code === plan &&
              subscription?.billing_interval !==
                billingInterval &&
              subscription?.status === 'active';

            return (
              <section
                key={plan}
                className="flex flex-col rounded-[28px] border p-6 shadow-sm"
                style={{
                  background:
                    'var(--portal-surface)',
                  borderColor: current
                    ? 'var(--portal-accent)'
                    : 'var(--portal-border)',
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p
                      className="text-[10px] font-black uppercase tracking-[0.18em]"
                      style={{
                        color:
                          'var(--portal-accent)',
                      }}
                    >
                      {details.name}
                    </p>

                    <h2 className="mt-2 text-3xl font-black">
                      $
                      {billingInterval ===
                      'monthly'
                        ? details.monthlyPrice
                        : details.yearlyPrice}

                      <span
                        className="text-sm font-semibold"
                        style={{
                          color:
                            'var(--portal-muted)',
                        }}
                      >
                        {billingInterval ===
                        'monthly'
                          ? ' / mo'
                          : ' / year'}
                      </span>
                    </h2>
                  </div>

                  {current && (
                    <span
                      className="rounded-full px-3 py-1 text-[9px] font-black uppercase"
                      style={{
                        background:
                          'var(--portal-accent-soft)',
                        color:
                          'var(--portal-accent)',
                      }}
                    >
                      Current
                    </span>
                  )}
                </div>

                <p
                  className="mt-4 min-h-12 text-sm leading-6"
                  style={{
                    color:
                      'var(--portal-muted)',
                  }}
                >
                  {details.description}
                </p>

                <div
                  className="mt-5 rounded-2xl border p-4 text-sm"
                  style={{
                    background:
                      'var(--portal-background)',
                    borderColor:
                      'var(--portal-border)',
                  }}
                >
                  <p className="font-black">
                    {billingInterval ===
                    'monthly'
                      ? `$${details.yearlyPrice} / year if billed annually`
                      : `${details.effectiveMonthlyRate} effective monthly`}
                  </p>

                  <p
                    className="mt-1 text-xs"
                    style={{
                      color:
                        'var(--portal-muted)',
                    }}
                  >
                    {details.discount}
                  </p>
                </div>

                <ul className="mt-6 flex-1 space-y-3 text-sm">
                  {details.features.map(
                    (feature) => (
                      <li
                        key={feature}
                        className="flex items-center gap-2"
                      >
                        <Check
                          className="h-4 w-4"
                          style={{
                            color:
                              'var(--portal-accent)',
                          }}
                        />
                        {billingFeatureLabels[
                          feature as BillingFeature
                        ]}
                      </li>
                    )
                  )}
                </ul>

                <button
                  type="button"
                  onClick={() =>
                    startCheckout(plan)
                  }
                  disabled={current || loading}
                  className="mt-7 inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  style={{
                    background:
                      'var(--portal-accent)',
                  }}
                >
                  <CreditCard className="h-4 w-4" />

                  {current
                    ? 'Current plan'
                    : samePlanDifferentInterval
                      ? 'Change billing'
                      : 'Choose plan'}
                </button>
              </section>
            );
          })}
        </div>

        <div
          className="mb-4 rounded-2xl border p-4 text-xs leading-6"
          style={{
            background:
              'var(--portal-surface)',
            borderColor:
              'var(--portal-border)',
            color:
              'var(--portal-muted)',
          }}
        >
          <p
            className="font-black"
            style={{
              color: 'var(--portal-text)',
            }}
          >
            Subscription renewal, cancellation & refunds
          </p>

          <p className="mt-1">
            Your subscription automatically renews at the end
            of each monthly or yearly billing period, and the
            applicable subscription fee will be charged
            automatically.
          </p>

          <p className="mt-2">
            You can cancel your subscription at any time through
            <span
              className="font-bold"
              style={{
                color: 'var(--portal-text)',
              }}
            >
              {' '}Manage billing
            </span>
            . Cancellation takes effect at the end of your
            current billing period, so you will continue to have
            access to your current plan and its features until
            then.
          </p>

          <p className="mt-2">
            <span
              className="font-bold"
              style={{
                color: 'var(--portal-text)',
              }}
            >
              Subscriptions are non-refundable.
            </span>{' '}
            No refunds or credits are provided for unused time
            remaining after cancellation.
          </p>
        </div>

        <div
          className="flex items-center gap-3 rounded-2xl border p-4 text-xs"
          style={{
            background:
              'var(--portal-surface)',
            borderColor:
              'var(--portal-border)',
            color:
              'var(--portal-muted)',
          }}
        >
          <ShieldCheck
            className="h-5 w-5 shrink-0"
            style={{
              color: 'var(--portal-accent)',
            }}
          />

          Payments are securely processed through
          Paddle. Your subscription and billing status
          are automatically updated after payment.
        </div>
      </div>
    </main>
  );
}