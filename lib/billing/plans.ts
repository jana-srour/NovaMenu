export type BillingPlan = 'starter' | 'pro' | 'enterprise';

export type BillingFeature =
  | 'dashboard'
  | 'menu'
  | 'qr'
  | 'orders'
  | 'pricing'
  | 'team'
  | 'inventory'
  | 'branches';

export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'expired';

export const billingPlans: Record<
  BillingPlan,
  {
    name: string;
    monthlyPrice: number;
    yearlyPrice: number;
    effectiveMonthlyRate: string;
    discount: string;
    description: string;
    features: BillingFeature[];
  }
> = {
  starter: {
    name: 'Starter',
    monthlyPrice: 25,
    yearlyPrice: 250,
    effectiveMonthlyRate: '$20.83',
    discount: '2 months free',
    description: 'The essentials for publishing and sharing your menu.',
    features: ['menu', 'qr'],
  },

  pro: {
    name: 'Pro',
    monthlyPrice: 69,
    yearlyPrice: 690,
    effectiveMonthlyRate: '$57.50',
    discount: '2 months free',
    description: 'The tools you need to run daily restaurant operations.',
    features: ['dashboard', 'menu', 'qr', 'orders'],
  },

  enterprise: {
    name: 'Enterprise',
    monthlyPrice: 99,
    yearlyPrice: 890,
    effectiveMonthlyRate: '$74.17',
    discount: '2+ months free',
    description: 'The complete NOVAMENU operating platform.',
    features: [
      'dashboard',
      'menu',
      'qr',
      'orders',
      'pricing',
      'team',
      'inventory',
      'branches',
    ],
  },
};

export function planIncludes(
  plan: BillingPlan,
  feature: BillingFeature
): boolean {
  return billingPlans[plan].features.includes(feature);
}

export function subscriptionAllows(
  subscription: {
    plan_code: BillingPlan;
    status: SubscriptionStatus;
    trial_ends_at: string;
  } | null,
  feature: BillingFeature
): boolean {
  if (!subscription) {
    return false;
  }

  if (subscription.status === 'trialing') {
    const trialActive =
      new Date(subscription.trial_ends_at).getTime() > Date.now();

    return trialActive;
  }

  return (
    subscription.status === 'active' &&
    planIncludes(subscription.plan_code, feature)
  );
}