export type BillingPlan = 'starter' | 'pro' | 'enterprise';

export type BillingFeature =
  | 'dashboard'
  | 'menu'
  | 'qr'
  | 'orders'
  | 'whatsapp'
  | 'printers'
  | 'reports'
  | 'pricing'
  | 'team'
  | 'inventory'
  | 'branches';

export const billingFeatureLabels: Record<BillingFeature, string> = {
  dashboard: 'Dashboard',

  menu: 'Digital Menu',

  qr: 'Custom Branded QR Code Generator & High-Res Export',

  orders:
    'Order Management & Kitchen Prep Dashboard',

  whatsapp:
    'WhatsApp Ordering & Order Notifications',

  printers:
    'Universal Printer Support — Wi-Fi, USB/Cable & Bluetooth',

  reports:
    'Reports & Analytics',

  pricing:
    'Dynamic Pricing, Combo Builder & Time-Based Promotions',

  team:
    'Team Management & Staff Permissions',

  inventory:
    'Inventory Management (Coming Soon)',

  branches:
    'Multiple Branches (Coming Soon)',
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

    /**
     * Maximum total restaurant members allowed by the plan.
     *
     * Includes the restaurant owner.
     *
     * null = unlimited
     */
    teamMemberLimit: number | null;
  }
> = {
  starter: {
    name: 'Starter',
    monthlyPrice: 19,
    yearlyPrice: 180,
    effectiveMonthlyRate: '$15',
    discount: '2 months free',

    description:
      'A lightweight digital menu for cafes and restaurants, with multilingual support, instant item availability controls, and branded QR ordering access.',

    features: [
      'menu',
      'qr',
    ],

    // Team Management is not included in Starter.
    teamMemberLimit: 1,
  },

  pro: {
    name: 'Pro',
    monthlyPrice: 39,
    yearlyPrice: 360,
    effectiveMonthlyRate: '$30',
    discount: '2 months free',

    description:
      'Everything you need to run daily restaurant operations — including order management, WhatsApp ordering, kitchen preparation, reporting, universal printer support, and team management for up to 3 members.',

    features: [
      'dashboard',
      'menu',
      'qr',
      'orders',
      'whatsapp',
      'printers',
      'reports',
      'team',
    ],

    // Maximum 3 total members INCLUDING the owner.
    // Example: Owner + 2 staff members.
    teamMemberLimit: 3,
  },

  enterprise: {
    name: 'Enterprise',
    monthlyPrice: 79,
    yearlyPrice: 720,
    effectiveMonthlyRate: '$60',
    discount: '2+ months free',

    description:
      'Advanced tools for growing and multi-branch restaurants, with centralized management, unlimited team members, dynamic pricing, inventory, and multi-location capabilities.',

    features: [
      'dashboard',
      'menu',
      'qr',
      'orders',
      'whatsapp',
      'printers',
      'reports',
      'pricing',
      'team',
      'inventory',
      'branches',
    ],

    // null means unlimited team members.
    teamMemberLimit: null,
  },
};

export function planIncludes(
  plan: BillingPlan,
  feature: BillingFeature
): boolean {
  return billingPlans[plan].features.includes(feature);
}

export function getTeamMemberLimit(
  plan: BillingPlan
): number | null {
  return billingPlans[plan].teamMemberLimit;
}

export function teamLimitReached(
  plan: BillingPlan,
  currentMemberCount: number
): boolean {
  const limit = billingPlans[plan].teamMemberLimit;

  // Enterprise / unlimited
  if (limit === null) {
    return false;
  }

  return currentMemberCount >= limit;
}

export function canAddTeamMember(
  plan: BillingPlan,
  currentMemberCount: number
): boolean {
  const limit = billingPlans[plan].teamMemberLimit;

  // Enterprise / unlimited
  if (limit === null) {
    return true;
  }

  return currentMemberCount < limit;
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

  // During the trial, the restaurant has full feature access.
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