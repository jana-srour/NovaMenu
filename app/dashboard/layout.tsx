'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  ArrowUpRight,
  BriefcaseBusiness,
  Boxes,
  GitBranch,
  Info,
  LayoutDashboard,
  Lock,
  Menu,
  Percent,
  QrCode,
  ReceiptText,
  Settings2,
  Users,
  WalletCards,
  X,
  BarChart3,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { subscribeRestaurantRealtime } from '@/lib/live-sync';
import { AccessRestricted } from '@/app/dashboard/components/access-restricted';
import { DashboardLoader } from '@/app/dashboard/components/dashboard-loader';
import { applyRestaurantTheme, defaultRestaurantTheme, loadRestaurantTheme, subscribeRestaurantTheme } from '@/lib/restaurant-theme';
import { subscriptionAllows, type BillingFeature, type BillingPlan, type SubscriptionStatus } from '@/lib/billing/plans';

interface Restaurant {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
}

interface Permissions {
  can_view_dashboard: boolean;
  can_manage_menu: boolean;
  can_manage_pricing: boolean;
  can_manage_orders: boolean;
  can_manage_team: boolean;
  can_manage_settings: boolean;
  can_manage_qr_studio: boolean;
}

interface Subscription {
  plan_code: BillingPlan;
  status: SubscriptionStatus;
  trial_ends_at: string;
}

const defaultPermissions: Permissions = {
  can_view_dashboard: false,
  can_manage_menu: false,
  can_manage_pricing: false,
  can_manage_orders: false,
  can_manage_team: false,
  can_manage_settings: false,
  can_manage_qr_studio: false,
};

const isValidBillingPlan = (value: unknown): value is BillingPlan => {
  return (
    value === 'starter' ||
    value === 'pro' ||
    value === 'enterprise'
  );
};

const isValidSubscriptionStatus = (
  value: unknown
): value is SubscriptionStatus => {
  return (
    value === 'trialing' ||
    value === 'active' ||
    value === 'past_due' ||
    value === 'canceled' ||
    value === 'expired'
  );
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string>('');
  const [currentUserRole, setCurrentUserRole] = useState('');
  const [permissions, setPermissions] =
    useState<Permissions>(defaultPermissions);
  const [loadingRestaurant, setLoadingRestaurant] = useState(true);
  const [theme, setTheme] = useState(defaultRestaurantTheme);
  const [subscription, setSubscription] = useState<Subscription | null>(null);

  const subscriptionFeatureForPath = (
    path: string
  ): BillingFeature | null => {
    if (path.startsWith('/dashboard/menu')) return 'menu';
    if (path.startsWith('/dashboard/orders')) return 'orders';
    if (path.startsWith('/dashboard/pricing')) return 'pricing';
    if (path.startsWith('/dashboard/qr')) return 'qr';
    if (path.startsWith('/dashboard/team')) return 'team';
    if (path.startsWith('/dashboard/inventory')) return 'inventory';
    if (path.startsWith('/dashboard/branches')) return 'branches';
    if (path === '/dashboard') return 'dashboard';

    return null;
  };

  const subscriptionAllowsPath = (path: string) => {
    const feature = subscriptionFeatureForPath(path);
    return feature ? subscriptionAllows(subscription, feature) : true;
  };

  const currentRouteAccess =
    pathname === '/dashboard'
      ? permissions.can_view_dashboard
      : pathname.startsWith('/dashboard/menu')
        ? permissions.can_manage_menu
        : pathname.startsWith('/dashboard/team')
          ? permissions.can_manage_team
          : pathname.startsWith('/dashboard/orders')
            ? permissions.can_manage_orders
            : pathname.startsWith('/dashboard/pricing')
              ? permissions.can_manage_pricing
              : pathname.startsWith('/dashboard/settings')
                ? permissions.can_manage_settings
                : pathname.startsWith('/dashboard/qr')
                  ? permissions.can_manage_qr_studio
                  : true;

  /*
   * =========================================================
   * LOAD RESTAURANT + PERMISSIONS
   * =========================================================
   */

  useEffect(() => {
    if (!restaurant || !restaurant.id) {
      return;
    }

    const restaurantId: string = restaurant.id;

    let active = true;

    async function loadTheme() {
      const nextTheme = await loadRestaurantTheme(
        supabase,
        restaurantId
      );

      if (!active) {
        return;
      }

      setTheme(nextTheme);
      applyRestaurantTheme(nextTheme);
    }

    loadTheme();

    const unsubscribe = subscribeRestaurantTheme(
      supabase,
      restaurantId,
      (nextTheme) => {
        if (!active) {
          return;
        }

        setTheme(nextTheme);
        applyRestaurantTheme(nextTheme);
      }
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [restaurant]);


  useEffect(() => {
    async function loadAccess() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login');
        return;
      }
      const userName =
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.email?.split('@')[0] ||
        'User';

      setCurrentUserName(userName);

      /*
       * FIND USER MEMBERSHIP
       */

      const { data: membership, error: membershipError } =
        await supabase
          .from('restaurant_members')
          .select('restaurant_id, role, position_id')
          .eq('user_id', user.id)
          .limit(1)
          .maybeSingle();

      if (membershipError || !membership) {
        setLoadingRestaurant(false);
        return;
      }

      /*
       * LOAD RESTAURANT
       */

      const { data: restaurantData } = await supabase
        .from('restaurants')
        .select('id, name, slug, logo_url')
        .eq('id', membership.restaurant_id)
        .single();


      if (restaurantData) {
        setRestaurant(restaurantData);
      }

      const { data: subscriptionData } = await supabase
      .from('restaurant_subscriptions')
      .select('plan_code, status, trial_ends_at')
      .eq('restaurant_id', membership.restaurant_id)
      .maybeSingle();

    if (
      subscriptionData &&
      isValidBillingPlan(subscriptionData.plan_code) &&
      isValidSubscriptionStatus(subscriptionData.status) &&
      typeof subscriptionData.trial_ends_at === 'string'
    ) {
      setSubscription({
        plan_code: subscriptionData.plan_code,
        status: subscriptionData.status,
        trial_ends_at: subscriptionData.trial_ends_at,
      });
    } else {
      setSubscription(null);
    }

      /*
       * LOAD POSITION PERMISSIONS
       */

      const membershipRole =
        typeof membership.role === 'string'
          ? membership.role.toLowerCase().trim()
          : '';
        
      const formattedRole =
        membershipRole
          ? membershipRole.charAt(0).toUpperCase() + membershipRole.slice(1)
          : 'Team Member';

      setCurrentUserRole(formattedRole);

      const isOwnerOrAdmin = ['owner', 'admin'].includes(
        membershipRole
      );

      if (isOwnerOrAdmin) {
        setPermissions({
          can_view_dashboard: true,
          can_manage_menu: true,
          can_manage_pricing: true,
          can_manage_orders: true,
          can_manage_team: true,
          can_manage_settings: true,
          can_manage_qr_studio: true,
        });
        setLoadingRestaurant(false);
        return;
      }

      if (!membership.position_id) {
        setPermissions(defaultPermissions);
        setLoadingRestaurant(false);
        return;
      }

      const { data: roleData, error: roleError } =
        await supabase
          .from('restaurant_roles')
          .select(`
            can_view_dashboard,
            can_manage_menu,
            can_manage_pricing,
            can_manage_orders,
            can_manage_team,
            can_manage_settings,
            can_manage_qr_studio
          `)
          .eq('id', membership.position_id)
          .eq('restaurant_id', membership.restaurant_id)
          .maybeSingle();

      if (!roleError && roleData) {
        setPermissions({
          can_view_dashboard:
            roleData.can_view_dashboard ?? false,

          can_manage_menu:
            roleData.can_manage_menu ?? false,

          can_manage_pricing:
            roleData.can_manage_pricing ?? false,

          can_manage_orders:
            roleData.can_manage_orders ?? false,

          can_manage_team:
            roleData.can_manage_team ?? false,

          can_manage_settings:
            roleData.can_manage_settings ?? false,

          can_manage_qr_studio:
            roleData.can_manage_qr_studio ?? false,
        });
      } else {
        setPermissions(defaultPermissions);
      }

      setLoadingRestaurant(false);
    }

    loadAccess();
  }, [router]);

  useEffect(() => {
    if (!restaurant?.id) {
      return;
    }

    return subscribeRestaurantRealtime(supabase, {
      restaurantId: restaurant.id,
      name: 'dashboard-access',
      tables: [
        'restaurant_members',
        'restaurant_roles',
        'restaurant_subscriptions',
      ],
      onChange: async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          return;
        }

        const { data: subscriptionData } = await supabase
          .from('restaurant_subscriptions')
          .select('plan_code, status, trial_ends_at')
          .eq('restaurant_id', restaurant.id)
          .maybeSingle();

        if (
          subscriptionData &&
          isValidBillingPlan(subscriptionData.plan_code) &&
          isValidSubscriptionStatus(subscriptionData.status) &&
          typeof subscriptionData.trial_ends_at === 'string'
        ) {
          setSubscription({
            plan_code: subscriptionData.plan_code,
            status: subscriptionData.status,
            trial_ends_at: subscriptionData.trial_ends_at,
          });
        } else {
          setSubscription(null);
        }

        const { data: membership } = await supabase
          .from('restaurant_members')
          .select('restaurant_id, role, position_id')
          .eq('user_id', user.id)
          .eq('restaurant_id', restaurant.id)
          .limit(1)
          .maybeSingle();

        if (!membership) {
          setPermissions(defaultPermissions);
          return;
        }

        const role = typeof membership.role === 'string'
          ? membership.role.toLowerCase().trim()
          : '';

        if (['owner', 'admin'].includes(role)) {
          setPermissions({
            can_view_dashboard: true,
            can_manage_menu: true,
            can_manage_pricing: true,
            can_manage_orders: true,
            can_manage_team: true,
            can_manage_settings: true,
            can_manage_qr_studio: true,
          });
          return;
        }

        if (!membership.position_id) {
          setPermissions(defaultPermissions);
          return;
        }

        const { data: roleData } = await supabase
          .from('restaurant_roles')
          .select('can_view_dashboard, can_manage_menu, can_manage_pricing, can_manage_orders, can_manage_team, can_manage_settings, can_manage_qr_studio')
          .eq('id', membership.position_id)
          .eq('restaurant_id', restaurant.id)
          .maybeSingle();

        setPermissions(roleData ? {
          can_view_dashboard: roleData.can_view_dashboard ?? false,
          can_manage_menu: roleData.can_manage_menu ?? false,
          can_manage_pricing: roleData.can_manage_pricing ?? false,
          can_manage_orders: roleData.can_manage_orders ?? false,
          can_manage_team: roleData.can_manage_team ?? false,
          can_manage_settings: roleData.can_manage_settings ?? false,
          can_manage_qr_studio: roleData.can_manage_qr_studio ?? false,
        } : defaultPermissions);
      },
    });
  }, [restaurant?.id]);

  /*
   * =========================================================
   * SIGN OUT
   * =========================================================
   */

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  /*
   * =========================================================
   * NAVIGATION
   * =========================================================
   */

  const navigation = [
    ...(permissions.can_view_dashboard
        ? [{
            name: 'Dashboard',
            href: '/dashboard',
            icon: LayoutDashboard,
            type: 'link' as const,
            locked: !subscriptionAllowsPath('/dashboard'),
          }]
        : []),

    ...(permissions.can_manage_menu
        ? [{
            name: 'Menu Management',
            href: '/dashboard/menu',
            icon: Menu,
            type: 'link' as const,
            locked: !subscriptionAllowsPath('/dashboard/menu'),
          }]
        : []),

    ...(permissions.can_manage_orders
        ? [{
            name: 'Orders Management',
            href: '/dashboard/orders',
            icon: ReceiptText,
            type: 'link' as const,
            locked: !subscriptionAllowsPath('/dashboard/orders'),
          }]
        : []),
    
    ...(permissions.can_manage_pricing
        ? [{
            name: 'Pricing & Promotions',
            href: '/dashboard/pricing',
            icon: Percent,
            type: 'link' as const,
            locked: !subscriptionAllowsPath('/dashboard/pricing'),
          }]
        : []),

    ...(permissions.can_manage_qr_studio
          ? [{
              name: 'QR Studio',
              href: '/dashboard/qr',
              icon: QrCode,
              type: 'link' as const,
              locked: !subscriptionAllowsPath('/dashboard/qr'),
            }]
          : []),

    ...(permissions.can_manage_team
    ? [{
        name: 'Team Management',
        href: '/dashboard/team',
        icon: Users,
        type: 'link' as const,
        locked: !subscriptionAllowsPath('/dashboard/team'),
      }]
    : []),

    {
      name: 'Inventory Management',
      href: '#',
      icon: Boxes,
      type: 'coming-soon' as const,
      locked: true,
    },

    {
      name: 'Branch Management',
      href: '#',
      icon: GitBranch,
      type: 'coming-soon' as const,
      locked: true,
    },

    {
      name: 'Reports',
      href: '#',
      icon: BarChart3,
      type: 'coming-soon' as const,
      locked: true,
    },
  ];

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard';
    }

    return pathname.startsWith(href);
  };

  const publicMenuUrl = restaurant?.slug
    ? `/menu/${restaurant.slug}`
    : '#';

  if (loadingRestaurant) {
    return <DashboardLoader />;
  }

  if (pathname.startsWith('/dashboard') && !currentRouteAccess) {
    const accessTitle =
      pathname === '/dashboard'
        ? 'Dashboard access restricted'
        : pathname.startsWith('/dashboard/menu')
          ? 'Menu management access restricted'
          : pathname.startsWith('/dashboard/team')
            ? 'Team management access restricted'
            : pathname.startsWith('/dashboard/orders')
              ? 'Orders management access restricted'
              : pathname.startsWith('/dashboard/pricing')
                ? 'Pricing & promotions access restricted'
                : pathname.startsWith('/dashboard/settings')
                  ? 'Settings access restricted'
                  : pathname.startsWith('/dashboard/qr')
                    ? 'QR Studio access restricted'
                    : 'Access restricted';

    const accessDescription =
      pathname === '/dashboard'
        ? 'Your current role does not have permission to view the dashboard.'
        : 'Your current role does not have permission to access this section.';

    return (
      <AccessRestricted
        title={accessTitle}
        description={accessDescription}
      />
    );
  }

  /*
   * =========================================================
   * NAVIGATION RENDER
   * =========================================================
   */

  const renderNavigation = (mobile = false) => (
    <nav className="space-y-1.5">

      {navigation.map((item) => {
        const active =
          item.type === 'link' && isActive(item.href);

        const content = (
          <>
            <span
              className="flex h-8 w-8 items-center justify-center rounded-lg text-base transition"
              style={{
                background: active
                  ? theme.portal_accent
                  : `${theme.portal_accent}12`,
                color: active
                  ? '#fff'
                  : theme.portal_text,
                boxShadow: active
                  ? `0 8px 20px ${theme.portal_accent}35`
                  : 'none',
              }}
            >
              <item.icon className="h-4 w-4" />
            </span>

            <span>{item.name}</span>

            {item.type === 'coming-soon' ? (
              <span
                className="ml-auto rounded-full px-2 py-1 text-[8px] font-black uppercase tracking-[0.08em]"
                style={{
                  background: `${theme.portal_text}10`,
                  color: `${theme.portal_text}65`,
                }}
              >
                Coming Soon
              </span>
            ) : item.locked ? (
              <Lock className="ml-auto h-3.5 w-3.5 opacity-60" />
            ) : (
              active && (
                <span
                  className="ml-auto h-1.5 w-1.5 rounded-full"
                  style={{
                    background: theme.portal_accent,
                  }}
                />
              )
            )}
          </>
        );

        if (item.type === 'coming-soon') {
          return (
            <div
              key={item.href + item.name}
              className="flex cursor-not-allowed items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold opacity-55"
              style={{
                color: theme.portal_text,
              }}
              aria-disabled="true"
            >
              {content}
            </div>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => {
              if (mobile) {
                setMobileOpen(false);
              }
            }}
            className="group flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold transition"
            style={{
              background: active
                ? `${theme.portal_accent}18`
                : 'transparent',
              color: active
                ? theme.portal_accent
                : theme.portal_text,
            }}
          >
            {content}
          </Link>
        );
      })}

    </nav>
  );

  /*
   * =========================================================
   * PAGE
   * =========================================================
   */

  return (
    <div className="min-h-screen" style={{ background: theme.portal_background, color: theme.portal_text }}>

      {/* MOBILE HEADER */}

      <header
        className="fixed left-0 right-0 top-0 z-50 flex h-[70px] items-center justify-between border-b px-5 backdrop-blur-xl lg:hidden"
        style={{
          borderColor: theme.portal_border,
          background: theme.portal_surface,
        }}
      >

        <Link href="/dashboard" aria-label="Go to dashboard" className="flex items-center gap-3">

<div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl">
  <img
    src="/novamenu-icon.jpeg"
    alt="NOVAMENU"
    className="h-full w-full object-contain"
  />
</div>
          <div>
<div
  className="text-sm font-black tracking-[0.16em]"
  style={{
    color: theme.portal_text,
  }}
>
  NOVAMENU
</div>
<div
  className="text-[8px] font-semibold tracking-[0.16em]"
  style={{
    color: `${theme.portal_text}80`,
  }}
>
  RESTAURANT DASHBOARD
</div>          </div>

        </Link>

        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="flex h-10 w-10 items-center justify-center rounded-xl border text-lg"
          style={{
            borderColor: '#303747',
            background: '#202534',
            color: '#ffffff',
          }}
        >
          {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>

      </header>


      {/* DESKTOP SIDEBAR */}

      <aside className="fixed bottom-0 left-0 top-0 z-40 hidden w-[270px] border-r lg:flex lg:flex-col" style={{ borderColor: theme.portal_border, background: theme.portal_surface }}>

        {/* BRAND */}

        <div
          className="flex h-[82px] items-center border-b px-6"
          style={{
            borderColor: theme.portal_border,
            background: theme.portal_surface,
          }}
        >

          <Link href="/dashboard" aria-label="Go to dashboard" className="flex items-center gap-3">

            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl">
              <img
                src="/novamenu-icon.jpeg"
                alt="NOVAMENU"
                className="h-full w-full object-contain"
              />
            </div>

            <div>
              <div className="text-sm font-black tracking-[0.18em] text-white">
                NOVAMENU
              </div>

              <div className="text-[9px] font-semibold tracking-[0.18em] text-white/50">
                RESTAURANT DASHBOARD
              </div>
            </div>

          </Link>

        </div>


        {/* RESTAURANT */}

        <div className="px-4 pt-5">
          <div
            className="overflow-hidden rounded-2xl border"
            style={{
              borderColor: theme.portal_border,
              background: theme.portal_background,
            }}
          >
            {/* RESTAURANT IDENTITY */}
            <div className="p-4">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl font-black shadow-sm"
                  style={{
                    background: restaurant?.logo_url
                      ? theme.portal_surface
                      : `${theme.portal_accent}12`,
                    color: theme.portal_accent,
                  }}
                >
                  {restaurant?.logo_url ? (
                    <img
                      src={restaurant.logo_url}
                      alt={`${restaurant.name} logo`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    restaurant?.name?.charAt(0).toUpperCase() || 'N'
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-black">
                    {restaurant?.name || 'Restaurant'}
                  </p>

                  <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-full px-2 py-1"
                    style={{
                      background: `${theme.portal_accent}10`,
                    }}
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: theme.portal_accent }}
                    />

                    <span
                      className="text-[8px] font-bold uppercase tracking-[0.08em]"
                      style={{ color: theme.portal_accent }}
                    >
                      Restaurant Active
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* WORKER IDENTITY */}
            <div
              className="border-t px-4 py-4"
              style={{ borderColor: theme.portal_border }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p
                    className="text-[9px] font-semibold uppercase tracking-[0.14em]"
                    style={{ color: `${theme.portal_text}65` }}
                  >
                    Welcome back
                  </p>

                  <p
                    className="mt-1 truncate text-sm font-black"
                    style={{ color: theme.portal_text }}
                  >
                    {currentUserName || 'User'}
                  </p>

                  <p
                    className="mt-0.5 text-[10px] font-medium"
                    style={{ color: `${theme.portal_text}70` }}
                  >
                    {currentUserRole || 'Team Member'}
                  </p>
                </div>

                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[11px] font-black"
                  style={{
                    background: theme.portal_accent,
                    color: '#ffffff',
                    boxShadow: `0 8px 20px ${theme.portal_accent}30`,
                  }}
                >
                  {(currentUserName || 'U')
                    .split(' ')
                    .map((part) => part.charAt(0))
                    .join('')
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
              </div>
            </div>
          </div>
        </div>


        {/* NAVIGATION */}

        <div className="flex-1 overflow-y-auto px-4 py-6">

          <div className="mb-3 px-3 text-[9px] font-black uppercase tracking-[0.18em]" style={{ color: 'var(--portal-text)' }}>
            Workspace
          </div>

          {renderNavigation()}


          {/* MANAGEMENT */}

          <div className="mb-3 mt-8 px-3 text-[9px] font-black uppercase tracking-[0.18em]" style={{ color: theme.portal_text }}>
            Management
          </div>


          {/* SETTINGS */}

          {permissions.can_manage_settings && (
            <Link
              href="/dashboard/settings"
              className="group flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold transition hover:opacity-90"
              style={{ color: theme.portal_text }}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg text-base" style={{ background: `${theme.portal_accent}12`, color: theme.portal_accent }}>
                <Settings2 className="h-4 w-4" />
              </span>

              <span>Settings</span>
            </Link>
          )}

          <Link
            href="/dashboard/billing"
            className="group mt-1 flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold transition hover:opacity-90"
            style={{ color: theme.portal_text }}
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg text-base" style={{ background: `${theme.portal_accent}12`, color: theme.portal_accent }}>
              <WalletCards className="h-4 w-4" />
            </span>
            <span>Billing & Plans</span>
          </Link>

          {/* About */}

          <Link
            href="/dashboard/about"
            className="group mt-1 flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold transition hover:opacity-90"
            style={{ color: theme.portal_text }}
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg text-base" style={{ background: `${theme.portal_accent}12`, color: theme.portal_accent }}>
              <Info className="h-4 w-4" />
            </span>

            <span>About NOVAMENU</span>
          </Link>

          {/* PUBLIC MENU */}

          {restaurant && (
            <a
              href={publicMenuUrl}
              target="_blank"
              rel="noreferrer"
              className="group mt-1 flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold transition hover:opacity-90"
              style={{ color: theme.portal_text }}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg text-base" style={{ background: `${theme.portal_accent}12`, color: theme.portal_accent }}>
                <ArrowUpRight className="h-4 w-4" />
              </span>

              <span>View Public Menu</span>
            </a>
          )}

        </div>


        {/* BOTTOM */}

        <div className="border-t p-4" style={{ borderColor: theme.portal_border }}>

          <button
            onClick={handleSignOut}
            className="mb-3 flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold transition hover:bg-red-50 hover:text-red-500"
            style={{ color: theme.portal_text }}
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg text-base" style={{ background: `${theme.portal_accent}12`, color: theme.portal_accent }}>
              <ArrowUpRight className="h-4 w-4 rotate-180" />
            </span>

            Sign Out
          </button>


          <div className="rounded-2xl p-4" style={{ background: theme.portal_background }}>

            <div className="text-[9px] font-black uppercase tracking-[0.16em]" style={{ color: theme.portal_text }}>
              Powered by
            </div>

            <div className="mt-1 text-sm font-black" style={{ color: theme.portal_text }}>
              Novera Labs
            </div>

            <div className="mt-1 text-[10px]" style={{ color: theme.portal_text }}>
              Digital menus made simple.
            </div>

          </div>

        </div>

      </aside>


      {/* MOBILE SIDEBAR */}

      {mobileOpen && (

        <div className="fixed inset-0 z-40 lg:hidden">

          <button
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
            className="absolute inset-0 bg-[#151923]/30 backdrop-blur-sm"
          />

          <aside className="absolute bottom-0 left-0 top-[70px] w-[280px] overflow-y-auto border-r p-4 shadow-2xl" style={{ borderColor: theme.portal_border, background: theme.portal_surface }}>

            <div className="mb-5">
              <div
                className="overflow-hidden rounded-2xl border"
                style={{
                  borderColor: theme.portal_border,
                  background: theme.portal_background,
                }}
              >
                <div className="p-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl font-black shadow-sm"
                      style={{
                        background: restaurant?.logo_url
                          ? theme.portal_surface
                          : `${theme.portal_accent}12`,
                        color: theme.portal_accent,
                      }}
                    >
                      {restaurant?.logo_url ? (
                        <img
                          src={restaurant.logo_url}
                          alt={`${restaurant.name} logo`}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        restaurant?.name?.charAt(0).toUpperCase() || 'N'
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-black">
                        {restaurant?.name || 'Restaurant'}
                      </p>

                      <div
                        className="mt-1.5 inline-flex items-center gap-1.5 rounded-full px-2 py-1"
                        style={{
                          background: `${theme.portal_accent}10`,
                        }}
                      >
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ background: theme.portal_accent }}
                        />

                        <span
                          className="text-[8px] font-bold uppercase tracking-[0.08em]"
                          style={{ color: theme.portal_accent }}
                        >
                          Restaurant Active
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  className="border-t px-4 py-4"
                  style={{ borderColor: theme.portal_border }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p
                        className="text-[9px] font-semibold uppercase tracking-[0.14em]"
                        style={{ color: `${theme.portal_text}65` }}
                      >
                        Welcome back
                      </p>

                      <p
                        className="mt-1 truncate text-sm font-black"
                        style={{ color: theme.portal_text }}
                      >
                        {currentUserName || 'User'}
                      </p>

                      <p
                        className="mt-0.5 text-[10px] font-medium"
                        style={{ color: `${theme.portal_text}70` }}
                      >
                        {currentUserRole || 'Team Member'}
                      </p>
                    </div>

                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[11px] font-black"
                      style={{
                        background: theme.portal_accent,
                        color: '#ffffff',
                        boxShadow: `0 8px 20px ${theme.portal_accent}30`,
                      }}
                    >
                      {(currentUserName || 'U')
                        .split(' ')
                        .map((part) => part.charAt(0))
                        .join('')
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>
                  </div>
                </div>
              </div>
            </div>


            <div className="mb-3 px-3 text-[9px] font-black uppercase tracking-[0.18em]" style={{ color: theme.portal_text }}>
              Workspace
            </div>

            {renderNavigation(true)}


            <div className="mb-3 mt-8 px-3 text-[9px] font-black uppercase tracking-[0.18em]" style={{ color: theme.portal_text }}>
              Management
            </div>


            {permissions.can_manage_settings && (
              <Link
                href="/dashboard/settings"
                onClick={() => setMobileOpen(false)}
                className="group flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold"
                style={{ color: theme.portal_text }}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg text-base" style={{ background: `${theme.portal_accent}12`, color: theme.portal_accent }}>
                  <Settings2 className="h-4 w-4" />
                </span>

                <span>Settings</span>
              </Link>
            )}

            <Link
              href="/dashboard/billing"
              onClick={() => setMobileOpen(false)}
              className="mt-1 flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold"
              style={{ color: theme.portal_text }}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg text-base" style={{ background: `${theme.portal_accent}12`, color: theme.portal_accent }}>
                <WalletCards className="h-4 w-4" />
              </span>
              Billing & Plans
            </Link>

            <Link
              href="/dashboard/about"
              onClick={() => setMobileOpen(false)}
              className="mt-1 flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold"
              style={{ color: theme.portal_text }}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg text-base" style={{ background: `${theme.portal_accent}12`, color: theme.portal_accent }}>
                <Info className="h-4 w-4" />
              </span>

              About NOVAMENU
            </Link>


            {restaurant && (
              <a
                href={publicMenuUrl}
                target="_blank"
                rel="noreferrer"
                onClick={() => setMobileOpen(false)}
                className="mt-1 flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold"
                style={{ color: theme.portal_text }}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg text-base" style={{ background: `${theme.portal_accent}12`, color: theme.portal_accent }}>
                  <ArrowUpRight className="h-4 w-4" />
                </span>

                View Public Menu
              </a>
            )}


            <div className="mt-6 border-t border-[#E7D9C3] pt-4">

              <button
                onClick={handleSignOut}
                className="flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold hover:bg-red-50 hover:text-red-500"
                style={{ color: theme.portal_text }}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: `${theme.portal_accent}12`, color: theme.portal_accent }}>
                  <ArrowUpRight className="h-4 w-4 rotate-180" />
                </span>

                Sign Out
              </button>

            </div>

          </aside>

        </div>

      )}


      {/* PAGE CONTENT */}

      <main className="min-h-screen lg:ml-[270px]">

        <div className="pt-[70px] lg:pt-0">
          {children}
        </div>

      </main>

    </div>
  );
}
