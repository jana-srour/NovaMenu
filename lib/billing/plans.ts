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

export const billingFeatureLabels: Record<
  BillingFeature,
  string
> = {
  dashboard: 'Dashboard',
  menu: 'Digital Menu',
  qr: 'Custom Branded QR Code Generator & High-Res Export',
  orders: 'Direct Order Receiving & Kitchen Prep Dashboard',
  pricing: 'Dynamic Pricing, Combo Builder, & Time-Based Promotions',
  team: 'Team Management',
  inventory: 'Inventory Management (Coming Soon)',
  branches: 'Multiple Branches (Coming Soon)',
};

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
    monthlyPrice: 19,
    yearlyPrice: 190,
    effectiveMonthlyRate: '$15.83',
    discount: '2 months free',
    description: 'Keep as a lightweight digital menu. Add Multi-language support (English/Arabic) and Instant Item Availability Toggles to make it instantly viable for standalone cafes.',
    features: ['menu', 'qr'],
  },

  pro: {
    name: 'Pro',
    monthlyPrice: 49,
    yearlyPrice: 490,
    effectiveMonthlyRate: '$40.83',
    discount: '2 months free',
    description: 'Frame this as the primary plan for delivery/takeout and cloud kitchens. Explicitly highlight Order Routing (WhatsApp/Dashboard) and Item Modifiers/Add-ons.',
    features: ['dashboard', 'menu', 'qr', 'orders'],
  },

  enterprise: {
    name: 'Enterprise',
    monthlyPrice: 89,
    yearlyPrice: 790,
    effectiveMonthlyRate: '$65.83',
    discount: '2+ months free',
    description: 'Reposition this specifically for multi-branch brands or central operations. Include Multi-Location Menu Sync, Staff Roles & Permissions, and POS/ERP Webhook Integrations.',
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