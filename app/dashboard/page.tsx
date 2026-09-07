'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  CalendarClock,
  ChefHat,
  Clock3,
  DollarSign,
  Layers3,
  ShoppingBag,
  Sparkles,
  Tag,
  TrendingUp,
  Users,
  Utensils,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { subscribeRestaurantRealtime } from '@/lib/live-sync';
import { DashboardLoader } from '@/app/dashboard/components/dashboard-loader';
import { PlanRequired } from '@/app/dashboard/components/plan-required';
import {
  subscriptionAllows,
  type BillingPlan,
  type SubscriptionStatus,
} from '@/lib/billing/plans';

type OrderRow = {
  total: number | null;
  status: string;
  created_at: string;
};

type PricingHistoryRow = {
  created_at: string;
  change_type?: string | null;
  action?: string | null;
  item_name?: string | null;
  summary?: string | null;
  description?: string | null;
};

type PromoItemRow = {
  id: string;
  discount_enabled: boolean | null;
  discount_type: 'percentage' | 'fixed' | null;
  discount_value: number | null;
  discount_start_at: string | null;
  discount_end_at: string | null;
};

type DashboardData = {
  restaurant: {
    id: string;
    name: string;
    slug: string;
    currency: string;
    logo_url: string | null;
  };
  categories: number;
  items: number;
  availableItems: number;
  activePromos: number;
  scheduledPromos: number;
  teamMembers: number;
  orders: OrderRow[];
  pricingHistory: PricingHistoryRow[];
};

type TrendPoint = {
  key: string;
  date: Date;
  label: string;
  fullLabel: string;
  orders: number;
  revenue: number;
  pricing: number;
};

function localDayKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function isActivePromotion(item: PromoItemRow, now = Date.now()) {
  if (
    !item.discount_enabled ||
    !item.discount_type ||
    item.discount_value === null ||
    Number(item.discount_value) <= 0
  ) {
    return false;
  }

  const start = item.discount_start_at
    ? new Date(item.discount_start_at).getTime()
    : null;

  const end = item.discount_end_at
    ? new Date(item.discount_end_at).getTime()
    : null;

  if (start !== null && Number.isNaN(start)) return false;
  if (end !== null && Number.isNaN(end)) return false;

  if (start !== null && start > now) return false;
  if (end !== null && end < now) return false;

  return true;
}

function isScheduledPromotion(item: PromoItemRow, now = Date.now()) {
  if (
    !item.discount_enabled ||
    !item.discount_type ||
    item.discount_value === null ||
    Number(item.discount_value) <= 0 ||
    !item.discount_start_at
  ) {
    return false;
  }

  const start = new Date(item.discount_start_at).getTime();

  if (Number.isNaN(start)) return false;

  return start > now;
}

function formatCompactNumber(value: number) {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }

  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }

  return String(Math.round(value));
}

function formatCurrency(value: number, currency: string) {
  const numeric = Number(value);

  if (Number.isInteger(numeric)) {
    return `${currency}${numeric}`;
  }

  return `${currency}${numeric.toFixed(2)}`;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [liveError, setLiveError] = useState('');
  const [planAllowed, setPlanAllowed] = useState(true);

  useEffect(() => {
    let active = true;
    let unsubscribeRealtime: (() => void) | undefined;

    const start = async () => {
      const { data: auth } = await supabase.auth.getUser();

      if (!active) return;

      if (!auth.user) {
        setLoading(false);
        return;
      }

      const { data: membership } = await supabase
        .from('restaurant_members')
        .select('restaurant_id')
        .eq('user_id', auth.user.id)
        .limit(1)
        .maybeSingle();

      const restaurantId = membership?.restaurant_id;

      if (!restaurantId) {
        setLoading(false);
        return;
      }

      const { data: subscription } = await supabase
        .from('restaurant_subscriptions')
        .select('plan_code, status, trial_ends_at')
        .eq('restaurant_id', restaurantId)
        .maybeSingle();

      const allowed = subscriptionAllows(
        subscription as {
          plan_code: BillingPlan;
          status: SubscriptionStatus;
          trial_ends_at: string;
        } | null,
        'dashboard'
      );

      setPlanAllowed(allowed);

      if (!allowed) {
        setLoading(false);
        return;
      }

      const loadStats = async () => {
        const { data: sessionData } = await supabase.auth.getSession();
        const teamResponse = sessionData.session
          ? await fetch('/api/team/members', {
              headers: {
                Authorization: `Bearer ${sessionData.session.access_token}`,
              },
            })
          : null;
        const teamPayload = teamResponse?.ok
          ? await teamResponse.json() as { members?: Array<{ user_id: string }> }
          : { members: [] };

        const [
          restaurantResult,
          categoriesResult,
          itemsResult,
          availableResult,
          menuPromoResult,
          ordersResult,
          restaurantHistoryResult,
          menuHistoryResult,
        ] = await Promise.all([
          supabase
            .from('restaurants')
            .select('id, name, slug, currency, logo_url')
            .eq('id', restaurantId)
            .single(),

          supabase
            .from('categories')
            .select('id', { count: 'exact', head: true })
            .eq('restaurant_id', restaurantId),

          supabase
            .from('menu_items')
            .select('id', { count: 'exact', head: true })
            .eq('restaurant_id', restaurantId),

          supabase
            .from('menu_items')
            .select('id', { count: 'exact', head: true })
            .eq('restaurant_id', restaurantId)
            .eq('is_available', true),

          supabase
            .from('menu_items')
            .select(
              'id, discount_enabled, discount_type, discount_value, discount_start_at, discount_end_at'
            )
            .eq('restaurant_id', restaurantId),

          supabase
            .from('orders')
            .select('total, status, created_at')
            .eq('restaurant_id', restaurantId)
            .order('created_at', { ascending: false }),

          supabase
            .from('restaurant_price_adjustment_history')
            .select('action, adjustment_value, description, created_at')
            .eq('restaurant_id', restaurantId)
            .order('created_at', { ascending: false })
            .limit(50),

          supabase
            .from('menu_item_pricing_history')
            .select('change_type, item_name, summary, created_at')
            .eq('restaurant_id', restaurantId)
            .order('created_at', { ascending: false })
            .limit(50),
        ]);

        if (!active) return;

        if (restaurantResult.error || ordersResult.error) {
          setLiveError(
            restaurantResult.error?.message ||
              ordersResult.error?.message ||
              'Could not load live dashboard data.'
          );
          return;
        }

        const menuItems = (menuPromoResult.data || []) as PromoItemRow[];
        const now = Date.now();

        const activePromos = menuItems.filter((item) =>
          isActivePromotion(item, now)
        ).length;

        const scheduledPromos = menuItems.filter((item) =>
          isScheduledPromotion(item, now)
        ).length;

        /*
         * Count UNIQUE team members.
         *
         * restaurant_members should contain the owner and workers.
         * Using Set prevents duplicate rows for the same user
         * from being counted more than once.
         */
        const uniqueTeamMemberIds = new Set(
          (teamPayload.members || [])
            .map((member) => member.user_id)
            .filter(Boolean)
        );

        const teamMembers = uniqueTeamMemberIds.size;

        const pricingHistory: PricingHistoryRow[] = [
          ...(restaurantHistoryResult.data || []).map((entry) => ({
            created_at: entry.created_at,
            action: entry.action,
            summary: entry.description,
            description: entry.description,
          })),

          ...(menuHistoryResult.data || []).map((entry) => ({
            created_at: entry.created_at,
            change_type: entry.change_type,
            item_name: entry.item_name,
            summary: entry.summary,
            description: entry.summary,
          })),
        ].sort(
          (a, b) =>
            new Date(b.created_at).getTime() -
            new Date(a.created_at).getTime()
        );

        if (restaurantResult.data) {
          setData({
            restaurant: restaurantResult.data,
            categories: categoriesResult.count || 0,
            items: itemsResult.count || 0,
            availableItems: availableResult.count || 0,
            activePromos,
            scheduledPromos,
            teamMembers,
            orders: (ordersResult.data || []) as OrderRow[],
            pricingHistory,
          });

          setLiveError('');
        }
      };

      let statsRefreshInProgress = false;
      const refreshStats = async () => {
        if (!active || statsRefreshInProgress) {
          return;
        }

        statsRefreshInProgress = true;
        try {
          await loadStats();
        } finally {
          statsRefreshInProgress = false;
        }
      };

      await refreshStats();

      if (!active) return;

      unsubscribeRealtime = subscribeRestaurantRealtime(supabase, {
        restaurantId,
        name: 'dashboard-kpis',
        tables: [
          'orders',
          'menu_items',
          'categories',
          'menu_item_extras',
          'restaurant_members',
          'restaurant_roles',
          'restaurant_price_adjustment_history',
          'menu_item_pricing_history',
        ],
        onChange: refreshStats,
        onStatus: (status) => {
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            setLiveError(
              'Live team updates are unavailable. Check Supabase Realtime configuration.'
            );
          }

          if (status === 'SUBSCRIBED') {
            setLiveError('');
          }
        },
      });

      if (!active) {
        unsubscribeRealtime();
        return;
      }

      setLoading(false);

      const previousCleanup = unsubscribeRealtime;
      unsubscribeRealtime = () => {
        previousCleanup();
      };
    };

    start();

    return () => {
      active = false;

      unsubscribeRealtime?.();
    };
  }, []);

  const stats = data;

  /*
   * =========================================================
   * 7-DAY ANALYTICS DATA
   * =========================================================
   */
  const trend = useMemo<TrendPoint[]>(() => {
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date();

      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - (6 - index));

      const key = localDayKey(date);

      const orders =
        stats?.orders.filter(
          (order) => localDayKey(new Date(order.created_at)) === key
        ) || [];

      const pricing =
        stats?.pricingHistory.filter(
          (entry) => localDayKey(new Date(entry.created_at)) === key
        ) || [];

      const revenue = orders.reduce(
        (sum, order) => sum + Number(order.total || 0),
        0
      );

      return {
        key,
        date,
        label: date.toLocaleDateString(undefined, {
          weekday: 'short',
        }),
        fullLabel: date.toLocaleDateString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        }),
        orders: orders.length,
        revenue,
        pricing: pricing.length,
      };
    });
  }, [stats?.orders, stats?.pricingHistory]);

  /*
   * =========================================================
   * ANALYTICS METRICS
   * =========================================================
   */
  const analytics = useMemo(() => {
    const totalOrders = trend.reduce(
      (sum, point) => sum + point.orders,
      0
    );

    const totalRevenue = trend.reduce(
      (sum, point) => sum + point.revenue,
      0
    );

    const averageDailyRevenue = totalRevenue / 7;
    const averageDailyOrders = totalOrders / 7;

    const averageOrderValue =
      totalOrders > 0 ? totalRevenue / totalOrders : 0;

    const peakRevenueDay = trend.reduce(
      (best, point) =>
        point.revenue > best.revenue ? point : best,
      trend[0] || {
        key: '',
        date: new Date(),
        label: '',
        fullLabel: '',
        orders: 0,
        revenue: 0,
        pricing: 0,
      }
    );

    const peakOrdersDay = trend.reduce(
      (best, point) =>
        point.orders > best.orders ? point : best,
      trend[0] || {
        key: '',
        date: new Date(),
        label: '',
        fullLabel: '',
        orders: 0,
        revenue: 0,
        pricing: 0,
      }
    );

    return {
      totalOrders,
      totalRevenue,
      averageDailyRevenue,
      averageDailyOrders,
      averageOrderValue,
      peakRevenueDay,
      peakOrdersDay,
    };
  }, [trend]);

  if (loading) {
    return <DashboardLoader />;
  }

  if (!planAllowed) {
    return (
      <PlanRequired
        featureName="Dashboard"
        requiredPlan="Pro"
      />
    );
  }

  if (!stats) {
    return (
      <div
        className="flex min-h-screen items-center justify-center text-sm"
        style={{
          background: 'var(--portal-background)',
          color: 'var(--portal-text)',
        }}
      >
        No restaurant is associated with this account.
      </div>
    );
  }

  const today = localDayKey(new Date());

  const todayOrders = stats.orders.filter(
    (order) => localDayKey(new Date(order.created_at)) === today
  );

  const todayRevenue = todayOrders.reduce(
    (sum, order) => sum + Number(order.total || 0),
    0
  );

  const avgOrderValue = todayOrders.length
    ? todayRevenue / todayOrders.length
    : 0;

  const newOrders = stats.orders.filter(
    (order) => order.status === 'New'
  ).length;

  const preparing = stats.orders.filter(
    (order) => order.status === 'Preparing'
  ).length;

  const ready = stats.orders.filter(
    (order) => order.status === 'Ready'
  ).length;

  const delivered = stats.orders.filter(
    (order) => order.status === 'Delivered'
  ).length;

  const cancelled = stats.orders.filter(
    (order) =>
      order.status.toLowerCase() === 'cancelled' ||
      order.status.toLowerCase() === 'canceled'
  ).length;

  const attentionCount = newOrders + preparing;

  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  const weeklyOrders = stats.orders.filter(
    (order) => new Date(order.created_at).getTime() >= weekAgo
  );

  const weeklyRevenue = weeklyOrders.reduce(
    (sum, order) => sum + Number(order.total || 0),
    0
  );

  const weeklyAverage = weeklyOrders.length
    ? weeklyRevenue / weeklyOrders.length
    : 0;

  const weeklyHistory = stats.pricingHistory.filter(
    (entry) => new Date(entry.created_at).getTime() >= weekAgo
  );

  const priceChanges = weeklyHistory.filter(
    (entry) =>
      entry.change_type === 'price' ||
      entry.action === 'increase' ||
      entry.action === 'decrease'
  ).length;

  const promoUpdates = weeklyHistory.filter(
    (entry) =>
      entry.change_type === 'discount' ||
      entry.change_type === 'promotion' ||
      entry.change_type === 'status'
  ).length;

  const recentHistory = stats.pricingHistory.slice(0, 4);

  const menuAvailability =
    stats.items > 0
      ? Math.round((stats.availableItems / stats.items) * 100)
      : 0;

  const orderStatusTotal =
    newOrders + preparing + ready + delivered + cancelled;

  const orderHealth = [
    {
      label: 'New',
      value: newOrders,
      icon: ShoppingBag,
    },
    {
      label: 'Preparing',
      value: preparing,
      icon: ChefHat,
    },
    {
      label: 'Ready',
      value: ready,
      icon: Clock3,
    },
    {
      label: 'Delivered',
      value: delivered,
      icon: TrendingUp,
    },
  ];

  const publicMenuUrl = `/menu/${stats.restaurant.slug}`;

  /*
   * =========================================================
   * PROFESSIONAL CHART GEOMETRY
   * =========================================================
   */
  const chartWidth = 900;
  const chartHeight = 300;

  const chartPadding = {
    top: 24,
    right: 24,
    bottom: 42,
    left: 58,
  };

  const innerWidth =
    chartWidth - chartPadding.left - chartPadding.right;

  const innerHeight =
    chartHeight - chartPadding.top - chartPadding.bottom;

  const maxRevenue = Math.max(
    ...trend.map((point) => point.revenue),
    1
  );

  const maxOrders = Math.max(
    ...trend.map((point) => point.orders),
    1
  );

  const revenueScaleMax = Math.ceil(maxRevenue / 10) * 10 || 10;

  const ordersScaleMax = Math.max(
    Math.ceil(maxOrders / 5) * 5,
    5
  );

  const chartPoints = trend.map((point, index) => {
    const x =
      chartPadding.left +
      (index / Math.max(trend.length - 1, 1)) * innerWidth;

    const revenueY =
      chartPadding.top +
      innerHeight -
      (point.revenue / revenueScaleMax) * innerHeight;

    const ordersHeight =
      (point.orders / ordersScaleMax) * innerHeight;

    return {
      ...point,
      x,
      revenueY,
      ordersHeight,
    };
  });

  const revenuePath = chartPoints
    .map((point, index) => {
      if (index === 0) {
        return `M ${point.x} ${point.revenueY}`;
      }

      const previous = chartPoints[index - 1];

      const controlPointX =
        (previous.x + point.x) / 2;

      return `C ${controlPointX} ${previous.revenueY},
        ${controlPointX} ${point.revenueY},
        ${point.x} ${point.revenueY}`;
    })
    .join(' ');

  const revenueAreaPath = `
    ${revenuePath}
    L ${chartPoints[chartPoints.length - 1]?.x || chartPadding.left}
      ${chartPadding.top + innerHeight}
    L ${chartPoints[0]?.x || chartPadding.left}
      ${chartPadding.top + innerHeight}
    Z
  `;

  const revenueGridValues = [0.25, 0.5, 0.75, 1];

  return (
    <div
      className="min-h-screen"
      style={{
        background: 'var(--portal-background)',
        color: 'var(--portal-text)',
      }}
    >
      <main className="mx-auto max-w-[1500px] px-4 py-7 sm:px-6 lg:px-8">
        {/* HEADER */}
        <header className="mb-7 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div
              className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.2em]"
              style={{ color: 'var(--portal-accent)' }}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: 'var(--portal-accent)' }}
              />
              Live operations
            </div>

            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
              {stats.restaurant.name}
            </h1>

            <p
              className="mt-2 text-sm"
              style={{ color: 'var(--portal-text)' }}
            >
              Live overview of your restaurant performance and operations.
            </p>
          </div>

          <a
            href={publicMenuUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center rounded-xl px-5 py-3 text-xs font-bold text-white transition hover:opacity-90"
            style={{ background: 'var(--portal-accent)' }}
          >
            Open public menu
            <span className="ml-2">↗</span>
          </a>
        </header>

        {liveError && (
          <div className="mb-5 rounded-xl border border-[#E7E4DE] bg-[#F7F5F1] p-3 text-sm text-[#A85C4A]">
            {liveError}
          </div>
        )}

        {/* MAIN KPI CARDS */}
        <section className="grid grid-cols-2 gap-4 xl:grid-cols-5">
          {[
            {
              label: 'Today revenue',
              value: formatCurrency(todayRevenue, stats.restaurant.currency),
              detail: `${todayOrders.length} orders today`,
              icon: DollarSign,
            },
            {
              label: 'Today orders',
              value: String(todayOrders.length),
              detail: 'Live customer orders',
              icon: ShoppingBag,
            },
            {
              label: 'Avg order value',
              value: formatCurrency(avgOrderValue, stats.restaurant.currency),
              detail: 'Average today',
              icon: BarChart3,
            },
            {
              label: 'Active promos',
              value: String(stats.activePromos),
              detail: 'Currently live',
              icon: Tag,
            },
            {
              label: 'Needs attention',
              value: String(attentionCount),
              detail: `${newOrders} new · ${preparing} preparing`,
              icon: Activity,
            },
          ].map((card) => {
            const Icon = card.icon;

            return (
              <div
                key={card.label}
                className="rounded-2xl border p-5 shadow-sm"
                style={{
                  borderColor: 'var(--portal-border)',
                  background: 'var(--portal-surface)',
                  color: 'var(--portal-text)',
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p
                      className="text-[9px] font-black uppercase tracking-[0.16em]"
                      style={{ color: 'var(--portal-accent)' }}
                    >
                      {card.label}
                    </p>

                    <p className="mt-4 text-2xl font-black">
                      {card.value}
                    </p>

                    <p
                      className="mt-1 text-[10px]"
                      style={{ color: 'var(--portal-text)' }}
                    >
                      {card.detail}
                    </p>
                  </div>

                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-xl"
                    style={{
                      background: 'var(--portal-accent-soft)',
                      color: 'var(--portal-accent)',
                    }}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                </div>
              </div>
            );
          })}
        </section>

        {/* PROFESSIONAL ANALYTICS */}
        <section className="mt-6">
          <div
            className="overflow-hidden rounded-3xl border shadow-sm"
            style={{
              borderColor: 'var(--portal-border)',
              background: 'var(--portal-surface)',
              color: 'var(--portal-text)',
            }}
          >
            {/* CHART HEADER */}
            <div className="flex flex-col gap-5 border-b p-5 sm:p-6 lg:flex-row lg:items-start lg:justify-between"
              style={{
                borderColor: 'var(--portal-border)',
              }}
            >
              <div>
                <div
                  className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.18em]"
                  style={{ color: 'var(--portal-accent)' }}
                >
                  <BarChart3 className="h-3.5 w-3.5" />
                  Performance analytics
                </div>

                <h2 className="mt-1 text-xl font-black">
                  Revenue & order performance
                </h2>

                <p
                  className="mt-1 text-xs"
                  style={{ color: 'var(--portal-text)' }}
                >
                  Daily performance across the last seven days.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2 text-[10px] font-bold">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{
                      background: 'var(--portal-accent)',
                    }}
                  />
                  Revenue
                </div>

                <div className="flex items-center gap-2 text-[10px] font-bold">
                  <span
                    className="h-2 w-2 rounded-sm"
                    style={{
                      background: 'rgba(128,128,128,0.28)',
                    }}
                  />
                  Orders
                </div>

                <span
                  className="rounded-lg px-2.5 py-1.5 text-[9px] font-black"
                  style={{
                    background: 'var(--portal-accent-soft)',
                    color: 'var(--portal-accent)',
                  }}
                >
                  LIVE
                </span>
              </div>
            </div>

            {/* STATISTIC SUMMARY */}
            <div className="grid grid-cols-2 divide-x border-b lg:grid-cols-4"
              style={{
                borderColor: 'var(--portal-border)',
              }}
            >
              {[
                {
                  label: '7-day revenue',
                  value: formatCurrency(
                    analytics.totalRevenue,
                    stats.restaurant.currency
                  ),
                },
                {
                  label: '7-day orders',
                  value: String(analytics.totalOrders),
                },
                {
                  label: 'Avg. order value',
                  value: formatCurrency(
                    analytics.averageOrderValue,
                    stats.restaurant.currency
                  ),
                },
                {
                  label: 'Avg. daily revenue',
                  value: formatCurrency(
                    analytics.averageDailyRevenue,
                    stats.restaurant.currency
                  ),
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="p-4 sm:p-5"
                  style={{
                    borderColor: 'var(--portal-border)',
                  }}
                >
                  <p
                    className="text-[9px] font-black uppercase tracking-[0.14em]"
                    style={{ color: 'var(--portal-text)' }}
                  >
                    {item.label}
                  </p>

                  <p className="mt-2 text-lg font-black sm:text-xl">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>

            {/* SVG ANALYTICS CHART */}
            <div className="px-3 pb-2 pt-6 sm:px-6">
              <div className="w-full overflow-x-auto">
                <svg
                  viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                  className="min-w-[700px] w-full"
                  role="img"
                  aria-label="Seven day revenue and order performance chart"
                >
                  {/* GRID */}
                  {revenueGridValues.map((ratio) => {
                    const y =
                      chartPadding.top +
                      innerHeight -
                      ratio * innerHeight;

                    const revenueValue =
                      ratio * revenueScaleMax;

                    return (
                      <g key={ratio}>
                        <line
                          x1={chartPadding.left}
                          x2={chartWidth - chartPadding.right}
                          y1={y}
                          y2={y}
                          stroke="currentColor"
                          strokeOpacity="0.08"
                          strokeDasharray="3 5"
                        />

                        <text
                          x={chartPadding.left - 10}
                          y={y + 3}
                          textAnchor="end"
                          fontSize="10"
                          fill="currentColor"
                          fillOpacity="0.5"
                        >
                          {formatCompactNumber(revenueValue)}
                        </text>
                      </g>
                    );
                  })}

                  {/* BASELINE */}
                  <line
                    x1={chartPadding.left}
                    x2={chartWidth - chartPadding.right}
                    y1={chartPadding.top + innerHeight}
                    y2={chartPadding.top + innerHeight}
                    stroke="currentColor"
                    strokeOpacity="0.12"
                  />

                  {/* ORDER BARS */}
                  {chartPoints.map((point) => {
                    const barWidth = Math.min(
                      38,
                      innerWidth / trend.length / 2.2
                    );

                    return (
                      <rect
                        key={`bar-${point.key}`}
                        x={point.x - barWidth / 2}
                        y={
                          chartPadding.top +
                          innerHeight -
                          point.ordersHeight
                        }
                        width={barWidth}
                        height={point.ordersHeight}
                        rx="5"
                        fill="currentColor"
                        fillOpacity="0.09"
                      />
                    );
                  })}

                  {/* REVENUE AREA */}
                  <path
                    d={revenueAreaPath}
                    fill="var(--portal-accent)"
                    fillOpacity="0.06"
                  />

                  {/* REVENUE LINE */}
                  <path
                    d={revenuePath}
                    fill="none"
                    stroke="var(--portal-accent)"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {/* REVENUE POINTS */}
                  {chartPoints.map((point) => (
                    <g key={`point-${point.key}`}>
                      <circle
                        cx={point.x}
                        cy={point.revenueY}
                        r="5"
                        fill="var(--portal-surface)"
                        stroke="var(--portal-accent)"
                        strokeWidth="2.5"
                      />

                      <title>
                        {`${point.fullLabel}: ${formatCurrency(
                          point.revenue,
                          stats.restaurant.currency
                        )} revenue · ${point.orders} orders`}
                      </title>
                    </g>
                  ))}

                  {/* X AXIS */}
                  {chartPoints.map((point) => (
                    <g key={`label-${point.key}`}>
                      <text
                        x={point.x}
                        y={chartHeight - 17}
                        textAnchor="middle"
                        fontSize="10"
                        fontWeight="600"
                        fill="currentColor"
                        fillOpacity="0.58"
                      >
                        {point.label}
                      </text>
                    </g>
                  ))}

                  {/* RIGHT ORDER SCALE */}
                  {[0, 0.5, 1].map((ratio) => {
                    const y =
                      chartPadding.top +
                      innerHeight -
                      ratio * innerHeight;

                    return (
                      <text
                        key={`orders-${ratio}`}
                        x={chartWidth - 8}
                        y={y + 3}
                        textAnchor="end"
                        fontSize="10"
                        fill="currentColor"
                        fillOpacity="0.38"
                      >
                        {Math.round(ordersScaleMax * ratio)}
                      </text>
                    );
                  })}
                </svg>
              </div>
            </div>

            {/* PEAK DAY INSIGHTS */}
            <div className="grid gap-3 border-t p-5 sm:grid-cols-3 sm:p-6"
              style={{
                borderColor: 'var(--portal-border)',
              }}
            >
              <div>
                <p
                  className="text-[9px] font-black uppercase tracking-[0.14em]"
                  style={{ color: 'var(--portal-text)' }}
                >
                  Peak revenue
                </p>

                <p className="mt-1 text-sm font-black">
                  {analytics.peakRevenueDay.fullLabel || '—'}
                </p>

                <p
                  className="mt-0.5 text-[10px]"
                  style={{ color: 'var(--portal-text)' }}
                >
                  {formatCurrency(
                    analytics.peakRevenueDay.revenue,
                    stats.restaurant.currency
                  )}
                </p>
              </div>

              <div>
                <p
                  className="text-[9px] font-black uppercase tracking-[0.14em]"
                  style={{ color: 'var(--portal-text)' }}
                >
                  Peak order volume
                </p>

                <p className="mt-1 text-sm font-black">
                  {analytics.peakOrdersDay.fullLabel || '—'}
                </p>

                <p
                  className="mt-0.5 text-[10px]"
                  style={{ color: 'var(--portal-text)' }}
                >
                  {analytics.peakOrdersDay.orders} orders
                </p>
              </div>

              <div>
                <p
                  className="text-[9px] font-black uppercase tracking-[0.14em]"
                  style={{ color: 'var(--portal-text)' }}
                >
                  Daily order average
                </p>

                <p className="mt-1 text-sm font-black">
                  {analytics.averageDailyOrders.toFixed(1)}
                </p>

                <p
                  className="mt-0.5 text-[10px]"
                  style={{ color: 'var(--portal-text)' }}
                >
                  Orders per day
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ORDER HEALTH */}
        <section className="mt-6 grid gap-5 lg:grid-cols-[1.3fr_0.7fr]">
          <div
            className="rounded-3xl border p-5 shadow-sm sm:p-6"
            style={{
              borderColor: 'var(--portal-border)',
              background: 'var(--portal-surface)',
              color: 'var(--portal-text)',
            }}
          >
            <div className="flex items-start justify-between">
              <div>
                <p
                  className="text-[9px] font-black uppercase tracking-[0.18em]"
                  style={{ color: 'var(--portal-accent)' }}
                >
                  Operational performance
                </p>

                <h2 className="mt-1 text-lg font-black">
                  Current order queue
                </h2>
              </div>

              <span
                className="rounded-lg px-2.5 py-1.5 text-[9px] font-black"
                style={{
                  background: 'var(--portal-accent-soft)',
                  color: 'var(--portal-accent)',
                }}
              >
                {orderStatusTotal} TOTAL
              </span>
            </div>

            <div className="mt-6 space-y-3">
              {orderHealth.map((item) => {
                const Icon = item.icon;

                const percentage = orderStatusTotal
                  ? Math.round((item.value / orderStatusTotal) * 100)
                  : 0;

                return (
                  <div
                    key={item.label}
                    className="rounded-2xl border p-3"
                    style={{
                      borderColor: 'var(--portal-border)',
                      background: 'var(--portal-background)',
                    }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-9 w-9 items-center justify-center rounded-xl"
                          style={{
                            background: 'var(--portal-accent-soft)',
                            color: 'var(--portal-accent)',
                          }}
                        >
                          <Icon className="h-4 w-4" />
                        </div>

                        <span className="text-sm font-semibold">
                          {item.label}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className="text-[10px] font-bold"
                          style={{ color: 'var(--portal-text)' }}
                        >
                          {percentage}%
                        </span>

                        <span
                          className="text-xl font-black"
                          style={{ color: 'var(--portal-accent)' }}
                        >
                          {item.value}
                        </span>
                      </div>
                    </div>

                    <div
                      className="mt-3 h-1.5 overflow-hidden rounded-full"
                      style={{
                        background: 'rgba(128,128,128,0.14)',
                      }}
                    >
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${percentage}%`,
                          background: 'var(--portal-accent)',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {cancelled > 0 && (
              <div
                className="mt-4 flex items-center justify-between rounded-2xl border px-3 py-2.5 text-xs"
                style={{
                  borderColor: 'var(--portal-border)',
                  background: 'var(--portal-background)',
                }}
              >
                <span>Cancelled orders</span>
                <span className="font-black">{cancelled}</span>
              </div>
            )}
          </div>

          {/* LIVE OPERATIONAL SNAPSHOT */}
          <div
            className="rounded-3xl border p-5 shadow-sm sm:p-6"
            style={{
              borderColor: 'var(--portal-border)',
              background: 'var(--portal-surface)',
              color: 'var(--portal-text)',
            }}
          >
            <p
              className="text-[9px] font-black uppercase tracking-[0.18em]"
              style={{ color: 'var(--portal-accent)' }}
            >
              Live snapshot
            </p>

            <h2 className="mt-1 text-lg font-black">
              Restaurant performance
            </h2>

            <div className="mt-6 space-y-3">
              <div
                className="rounded-2xl border p-4"
                style={{
                  borderColor: 'var(--portal-border)',
                  background: 'var(--portal-background)',
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">
                    Menu availability
                  </span>

                  <span
                    className="text-lg font-black"
                    style={{ color: 'var(--portal-accent)' }}
                  >
                    {menuAvailability}%
                  </span>
                </div>

                <div
                  className="mt-3 h-1.5 overflow-hidden rounded-full"
                  style={{
                    background: 'rgba(128,128,128,0.14)',
                  }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${menuAvailability}%`,
                      background: 'var(--portal-accent)',
                    }}
                  />
                </div>

                <p
                  className="mt-2 text-[10px]"
                  style={{ color: 'var(--portal-text)' }}
                >
                  {stats.availableItems} of {stats.items} items available
                </p>
              </div>

              <div
                className="flex items-center justify-between rounded-2xl border p-4"
                style={{
                  borderColor: 'var(--portal-border)',
                  background: 'var(--portal-background)',
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-xl"
                    style={{
                      background: 'var(--portal-accent-soft)',
                      color: 'var(--portal-accent)',
                    }}
                  >
                    <Users className="h-4 w-4" />
                  </div>

                  <div>
                    <p className="text-sm font-black">
                      Team members
                    </p>

                    <p
                      className="text-[10px]"
                      style={{ color: 'var(--portal-text)' }}
                    >
                      Unique restaurant members
                    </p>
                  </div>
                </div>

                <span className="text-xl font-black">
                  {stats.teamMembers}
                </span>
              </div>

              <div
                className="flex items-center justify-between rounded-2xl border p-4"
                style={{
                  borderColor: 'var(--portal-border)',
                  background: 'var(--portal-background)',
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-xl"
                    style={{
                      background: 'var(--portal-accent-soft)',
                      color: 'var(--portal-accent)',
                    }}
                  >
                    <Tag className="h-4 w-4" />
                  </div>

                  <div>
                    <p className="text-sm font-black">
                      Promotions
                    </p>

                    <p
                      className="text-[10px]"
                      style={{ color: 'var(--portal-text)' }}
                    >
                      Active + scheduled
                    </p>
                  </div>
                </div>

                <span className="text-xl font-black">
                  {stats.activePromos + stats.scheduledPromos}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* UNIQUE RESTAURANT STATS */}
        <section className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              label: 'Menu coverage',
              value: `${stats.availableItems}/${stats.items}`,
              detail: `${menuAvailability}% available`,
              icon: Utensils,
              href: '/dashboard/menu',
            },
            {
              label: 'Categories',
              value: String(stats.categories),
              detail: 'Menu categories',
              icon: Layers3,
              href: '/dashboard/menu',
            },
            {
              label: 'Team members',
              value: String(stats.teamMembers),
              detail: 'Unique restaurant members',
              icon: Users,
              href: '/dashboard/team',
            },
            {
              label: 'Completed today',
              value: String(delivered),
              detail: 'Delivered orders',
              icon: TrendingUp,
              href: '/dashboard/orders',
            },
          ].map((card) => {
            const Icon = card.icon;

            return (
              <a
                key={card.label}
                href={card.href}
                className="rounded-2xl border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                style={{
                  borderColor: 'var(--portal-border)',
                  background: 'var(--portal-surface)',
                  color: 'var(--portal-text)',
                }}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p
                      className="text-[9px] font-black uppercase tracking-[0.16em]"
                      style={{ color: 'var(--portal-accent)' }}
                    >
                      {card.label}
                    </p>

                    <p className="mt-3 text-2xl font-black">
                      {card.value}
                    </p>

                    <p
                      className="mt-1 text-xs"
                      style={{ color: 'var(--portal-text)' }}
                    >
                      {card.detail}
                    </p>
                  </div>

                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-xl"
                    style={{
                      background: 'var(--portal-accent-soft)',
                      color: 'var(--portal-accent)',
                    }}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                </div>

                <span
                  className="mt-4 inline-block text-[10px] font-black uppercase tracking-[0.14em]"
                  style={{ color: 'var(--portal-accent)' }}
                >
                  View details →
                </span>
              </a>
            );
          })}
        </section>

        {/* PRICING & PROMOTION PULSE */}
        <section className="mt-6">
          <div
            className="rounded-3xl border p-5 shadow-sm sm:p-6"
            style={{
              borderColor: 'var(--portal-border)',
              background: 'var(--portal-surface)',
              color: 'var(--portal-text)',
            }}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles
                    className="h-4 w-4"
                    style={{ color: 'var(--portal-accent)' }}
                  />

                  <p
                    className="text-[9px] font-black uppercase tracking-[0.18em]"
                    style={{ color: 'var(--portal-accent)' }}
                  >
                    Pricing & promotions
                  </p>
                </div>

                <h2 className="mt-1 text-lg font-black">
                  Pricing & promotion pulse
                </h2>

                <p
                  className="mt-1 text-xs"
                  style={{ color: 'var(--portal-text)' }}
                >
                  Current pricing status and the latest activity.
                </p>
              </div>

              <a
                href="/dashboard/pricing"
                className="text-[10px] font-black uppercase tracking-[0.14em]"
                style={{ color: 'var(--portal-accent)' }}
              >
                View full pricing →
              </a>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {[
                [
                  'Price changes',
                  String(priceChanges),
                  'Last 7 days',
                ],
                [
                  'Active promotions',
                  String(stats.activePromos),
                  'Currently live',
                ],
                [
                  'Scheduled promotions',
                  String(stats.scheduledPromos),
                  'Coming up',
                ],
              ].map(([label, value, detail]) => (
                <div
                  key={label}
                  className="rounded-2xl border p-4"
                  style={{
                    borderColor: 'var(--portal-border)',
                    background: 'var(--portal-background)',
                  }}
                >
                  <p
                    className="text-[9px] font-black uppercase tracking-[0.16em]"
                    style={{ color: 'var(--portal-text)' }}
                  >
                    {label}
                  </p>

                  <p className="mt-3 text-2xl font-black">
                    {value}
                  </p>

                  <p
                    className="mt-1 text-[10px]"
                    style={{ color: 'var(--portal-text)' }}
                  >
                    {detail}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-6">
              <div className="mb-3 flex items-center justify-between">
                <p
                  className="text-[9px] font-black uppercase tracking-[0.16em]"
                  style={{ color: 'var(--portal-text)' }}
                >
                  Latest activity
                </p>

                <span
                  className="rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em]"
                  style={{
                    background: 'var(--portal-accent-soft)',
                    color: 'var(--portal-accent)',
                  }}
                >
                  Last 4
                </span>
              </div>

              <div className="space-y-3">
                {recentHistory.length === 0 ? (
                  <div
                    className="rounded-2xl border border-dashed p-4 text-sm"
                    style={{
                      borderColor: 'var(--portal-border)',
                      color: 'var(--portal-text)',
                    }}
                  >
                    No pricing or promotion history yet.
                  </div>
                ) : (
                  recentHistory.map((entry, index) => (
                    <div
                      key={`${entry.created_at}-${index}`}
                      className="flex items-center justify-between gap-4 rounded-2xl border px-4 py-3"
                      style={{
                        borderColor: 'var(--portal-border)',
                        background: 'var(--portal-background)',
                      }}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{
                              background: 'var(--portal-accent)',
                            }}
                          />

                          <div className="truncate text-sm font-black">
                            {entry.item_name ||
                              entry.action ||
                              'Restaurant update'}
                          </div>
                        </div>

                        <div
                          className="mt-1 truncate text-[10px]"
                          style={{ color: 'var(--portal-text)' }}
                        >
                          {entry.summary ||
                            entry.description ||
                            'Pricing activity'}
                        </div>
                      </div>

                      <div
                        className="shrink-0 text-right text-[10px] font-black uppercase tracking-[0.12em]"
                        style={{ color: 'var(--portal-text)' }}
                      >
                        {new Date(entry.created_at).toLocaleDateString(
                          undefined,
                          {
                            month: 'short',
                            day: 'numeric',
                          }
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>

        {/* WEEKLY OPERATIONAL SUMMARY */}
        <section className="mt-5 grid gap-4 sm:grid-cols-3">
          <div
            className="rounded-2xl border p-5"
            style={{
              borderColor: 'var(--portal-border)',
              background: 'var(--portal-surface)',
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-xl"
                style={{
                  background: 'var(--portal-accent-soft)',
                  color: 'var(--portal-accent)',
                }}
              >
                <CalendarClock className="h-4 w-4" />
              </div>

              <div>
                <p
                  className="text-[9px] font-black uppercase tracking-[0.15em]"
                  style={{ color: 'var(--portal-text)' }}
                >
                  Weekly orders
                </p>

                <p className="text-xl font-black">
                  {weeklyOrders.length}
                </p>
              </div>
            </div>
          </div>

          <div
            className="rounded-2xl border p-5"
            style={{
              borderColor: 'var(--portal-border)',
              background: 'var(--portal-surface)',
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-xl"
                style={{
                  background: 'var(--portal-accent-soft)',
                  color: 'var(--portal-accent)',
                }}
              >
                <DollarSign className="h-4 w-4" />
              </div>

              <div>
                <p
                  className="text-[9px] font-black uppercase tracking-[0.15em]"
                  style={{ color: 'var(--portal-text)' }}
                >
                  Weekly revenue
                </p>

                <p className="text-xl font-black">
                  {formatCurrency(
                    weeklyRevenue,
                    stats.restaurant.currency
                  )}
                </p>
              </div>
            </div>
          </div>

          <div
            className="rounded-2xl border p-5"
            style={{
              borderColor: 'var(--portal-border)',
              background: 'var(--portal-surface)',
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-xl"
                style={{
                  background: 'var(--portal-accent-soft)',
                  color: 'var(--portal-accent)',
                }}
              >
                <Activity className="h-4 w-4" />
              </div>

              <div>
                <p
                  className="text-[9px] font-black uppercase tracking-[0.15em]"
                  style={{ color: 'var(--portal-text)' }}
                >
                  Pricing activity
                </p>

                <p className="text-xl font-black">
                  {weeklyHistory.length}
                </p>

                <p
                  className="mt-0.5 text-[10px]"
                  style={{ color: 'var(--portal-text)' }}
                >
                  Events in last 7 days
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
