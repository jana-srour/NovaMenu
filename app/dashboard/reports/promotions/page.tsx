'use client';

import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  DollarSign,
  Percent,
  Tag,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  getCurrentRestaurantId,
  getReportsData,
  type ReportDiscount,
  type ReportsData,
} from '@/lib/reports/data';

import { supabase } from '@/lib/supabase';
import ReportDateRangePicker from '@/components/report-date-range-picker';

type Period = '7d' | '30d' | '90d' | '12m' | 'custom';

const periods: { key: Period; label: string }[] = [
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: '90d', label: '90 days' },
  { key: '12m', label: '12 months' },
];

type PromotionRow = {
  id: string;
  name: string;
  type: string;
  usage: number;
  discount: number;
  revenue: number;
};

function normalizeCurrencyCode(
  currency: string | null | undefined,
): string {
  const value = String(currency || '').trim().toUpperCase();

  const symbolMap: Record<string, string> = {
    '$': 'USD',
    'US$': 'USD',
    'USD': 'USD',

    '€': 'EUR',
    'EUR': 'EUR',

    '£': 'GBP',
    'GBP': 'GBP',

    'LBP': 'LBP',
    'ل.ل': 'LBP',
    'ل.ل.': 'LBP',

    'AED': 'AED',
    'SAR': 'SAR',
    'QAR': 'QAR',
    'KWD': 'KWD',
    'BHD': 'BHD',
    'JOD': 'JOD',
    'EGP': 'EGP',
  };

  return symbolMap[value] || 'USD';
}

function formatMoney(
  value: number | null | undefined,
  currency: string | null | undefined,
) {
  const amount = Number(value || 0);
  const currencyCode = normalizeCurrencyCode(currency);

  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency || '$'} ${amount.toFixed(2)}`;
  }
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 1,
  }).format(value);
}

function getPeriodRange(period: Period, customFrom?: string, customTo?: string) {
  const now = new Date();
  const end = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
  );
  const start = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  if (period === 'custom' && customFrom && customTo) {
    const customEnd = new Date(`${customTo}T00:00:00`);
    customEnd.setDate(customEnd.getDate() + 1);
    return {
      from: new Date(`${customFrom}T00:00:00`),
      to: customEnd,
    };
  }

  if (period === '7d') {
    start.setDate(start.getDate() - 6);
  } else if (period === '30d') {
    start.setDate(start.getDate() - 29);
  } else if (period === '90d') {
    start.setDate(start.getDate() - 89);
  } else {
    start.setDate(1);
    start.setMonth(start.getMonth() - 11);
  }

  return {
    from: start,
    to: end,
  };
}

function promotionMatchesOrderItem(
  promotion: ReportDiscount,
  item: {
    menu_item_id: string | null;
  },
  menuItemCategoryId: string | null,
) {
  if (promotion.menu_item_id) {
    return promotion.menu_item_id === item.menu_item_id;
  }

  if (promotion.category_id) {
    return promotion.category_id === menuItemCategoryId;
  }

  /*
   * A restaurant-wide promotion applies to all menu items.
   */
  return true;
}

function normalizeItemName(value: string | null | undefined) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function getHistoricalMenuItemName(value: string | null | undefined) {
  return normalizeItemName(value).split(/\s+\+\s+/, 1)[0];
}

function promotionIsValidAt(
  promotion: ReportDiscount,
  orderCreatedAt: string,
) {
  const timestamp = new Date(orderCreatedAt).getTime();

  if (Number.isNaN(timestamp)) {
    return false;
  }

  if (promotion.start_at) {
    const start = new Date(promotion.start_at).getTime();

    if (!Number.isNaN(start) && timestamp < start) {
      return false;
    }
  }

  if (promotion.end_at) {
    const end = new Date(promotion.end_at).getTime();

    if (!Number.isNaN(end) && timestamp >= end) {
      return false;
    }
  }

  return true;
}

function calculatePromotionDiscount(
  promotion: ReportDiscount,
  unitPrice: number,
  quantity: number,
) {
  const subtotal = Math.max(unitPrice, 0) * Math.max(quantity, 0);

  if (promotion.discount_type === 'percentage') {
    return subtotal * (Math.max(promotion.discount_value || 0, 0) / 100);
  }

  if (
    promotion.discount_type === 'fixed' ||
    promotion.discount_type === 'amount'
  ) {
    return Math.min(
      subtotal,
      Math.max(promotion.discount_value || 0, 0) * Math.max(quantity, 0),
    );
  }

  return 0;
}

function getPromotionTypeLabel(
  promotion: ReportDiscount,
) {
  if (promotion.discount_type === 'percentage') {
    return `${promotion.discount_value}% off`;
  }

  if (
    promotion.discount_type === 'fixed' ||
    promotion.discount_type === 'amount'
  ) {
    return `${promotion.discount_value} off`;
  }

  return promotion.discount_type || 'Promotion';
}

function isCompletedStatus(status: string) {
  const normalized = String(status || '').toLowerCase();

  return [
    'completed',
    'complete',
    'delivered',
    'done',
    'closed',
  ].includes(normalized);
}

export default function PromotionsReportPage() {
  const [period, setPeriod] = useState<Period>('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [data, setData] = useState<ReportsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTimestamp] = useState(() => Date.now());

  const loadReport = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const range = getPeriodRange(period, customFrom, customTo);

      const result = await getReportsData({
        from: range.from.toISOString(),
        to: range.to.toISOString(),
      });

      setData(result);
    } catch (err) {
      console.error('Promotions report loading failed:', err);

      setError(
        err instanceof Error
          ? err.message
          : 'Could not load promotions report.',
      );
    } finally {
      setLoading(false);
    }
  }, [period, customFrom, customTo]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  /*
   * Realtime:
   *
   * IMPORTANT:
   * Every postgres_changes callback is added BEFORE subscribe().
   * This avoids:
   *
   * "cannot add postgres_changes callbacks ... after subscribe()"
   */
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    async function setupRealtime() {
      const restaurantId = await getCurrentRestaurantId();

      if (!restaurantId || cancelled) {
        return;
      }

      channel = supabase
        .channel(`promotions-report-${restaurantId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'orders',
            filter: `restaurant_id=eq.${restaurantId}`,
          },
          () => {
            void loadReport();
          },
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'order_items',
          },
          () => {
            void loadReport();
          },
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'discounts',
            filter: `restaurant_id=eq.${restaurantId}`,
          },
          () => {
            void loadReport();
          },
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'menu_items',
            filter: `restaurant_id=eq.${restaurantId}`,
          },
          () => {
            void loadReport();
          },
        );

      /*
       * subscribe() MUST be the final step.
       */
      channel.subscribe();
    }

    void setupRealtime();

    return () => {
      cancelled = true;

      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [loadReport]);

  const currency = data?.restaurant.currency || '$';

  const calculated = useMemo(() => {
    if (!data) {
      return {
        promotions: [] as PromotionRow[],
        activePromotions: 0,
        promotionOrders: 0,
        discountGiven: 0,
        promotionUsage: 0,
        promotedRevenue: 0,
        averageDiscount: 0,
        promotionShare: 0,
        trend: [
          { label: 'Mon', value: 0 },
          { label: 'Tue', value: 0 },
          { label: 'Wed', value: 0 },
          { label: 'Thu', value: 0 },
          { label: 'Fri', value: 0 },
          { label: 'Sat', value: 0 },
          { label: 'Sun', value: 0 },
        ],
        bestPromotion: null as PromotionRow | null,
        mostUsed: null as PromotionRow | null,
        largestDiscount: null as PromotionRow | null,
      };
    }

    const categoryMap = new Map(
      data.categories.map((category) => [
        category.id,
        category,
      ]),
    );

    const menuItemMap = new Map(
      data.menuItems.map((item) => [
        item.id,
        item,
      ]),
    );

    const promotions = new Map<string, PromotionRow>();

    for (const promotion of data.discounts) {
      promotions.set(promotion.id, {
        id: promotion.id,
        name: promotion.name,
        type: getPromotionTypeLabel(promotion),
        usage: 0,
        discount: 0,
        revenue: 0,
      });
    }

    const promotedOrderIds = new Set<string>();

    /*
     * Promotion attribution:
     *
     * We use the actual promotion configuration, order timestamp,
     * menu_item_id and category_id.
     *
     * We do NOT invent promotion IDs inside order_items because the
     * current order_items schema does not contain one.
     */
    for (const order of data.orders) {
      const orderItems = data.orderItems.filter(
        (item) => item.order_id === order.id,
      );

      if (orderItems.length === 0) {
        continue;
      }

      let orderUsedPromotion = false;

      for (const item of orderItems) {
        const menuItem = item.menu_item_id
          ? menuItemMap.get(item.menu_item_id)
          : (() => {
              const historicalName = getHistoricalMenuItemName(
                item.item_name,
              );
              const matches = data.menuItems.filter(
                (candidate) =>
                  normalizeItemName(candidate.name) ===
                  historicalName,
              );

              return matches.length === 1
                ? matches[0]
                : null;
            })();

        const categoryId = menuItem?.category_id ?? null;

        const matchingPromotions = data.discounts.filter(
          (promotion) =>
            promotionIsValidAt(
              promotion,
              order.created_at,
            ) &&
            promotionMatchesOrderItem(
              promotion,
              item,
              categoryId,
            ),
        );

        /*
         * If several promotions overlap, attributing the same item to
         * every promotion would inflate the report.
         *
         * We therefore use the most specific applicable promotion:
         *
         * 1. menu-item promotion
         * 2. category promotion
         * 3. restaurant-wide promotion
         *
         * If there are multiple promotions at the same specificity,
         * use the newest one.
         */
        const sortedPromotions = matchingPromotions.sort(
          (a, b) => {
            const specificity = (promotion: ReportDiscount) => {
              if (promotion.menu_item_id) return 3;
              if (promotion.category_id) return 2;
              return 1;
            };

            const specificityDifference =
              specificity(b) - specificity(a);

            if (specificityDifference !== 0) {
              return specificityDifference;
            }

            return (
              new Date(b.created_at).getTime() -
              new Date(a.created_at).getTime()
            );
          },
        );

        const promotion = sortedPromotions[0];

        if (!promotion) {
          continue;
        }

        const row = promotions.get(promotion.id);

        if (!row) {
          continue;
        }

        const quantity = Math.max(Number(item.quantity || 0), 0);
        const unitPrice = Math.max(Number(item.unit_price || 0), 0);

        const grossItemRevenue = unitPrice * quantity;

        const menuPrice = menuItem
          ? Math.max(Number(menuItem.price || 0), 0)
          : unitPrice;
        const configuredDiscount = calculatePromotionDiscount(
          promotion,
          menuPrice,
          quantity,
        );
        const observedDiscount =
          menuItem && menuPrice > unitPrice
            ? (menuPrice - unitPrice) * quantity
            : 0;
        const discountAmount = Math.min(
          menuPrice * quantity,
          Math.max(configuredDiscount, observedDiscount),
        );

        row.usage += 1;
        row.discount += discountAmount;
        row.revenue += Math.max(
          grossItemRevenue - discountAmount,
          0,
        );

        orderUsedPromotion = true;
      }

      if (orderUsedPromotion) {
        promotedOrderIds.add(order.id);
      }
    }

    const promotionRows = Array.from(promotions.values()).sort(
      (a, b) => {
        if (b.revenue !== a.revenue) {
          return b.revenue - a.revenue;
        }

        return b.usage - a.usage;
      },
    );

    /*
     * "Active promotions" is based on the current moment, not merely
     * whether the DB row has is_active=true.
     */
    const activePromotions = data.discounts.filter(
      (promotion) => {
        if (!promotion.is_active) {
          return false;
        }

        if (
          promotion.start_at &&
          new Date(promotion.start_at).getTime() > currentTimestamp
        ) {
          return false;
        }

        if (
          promotion.end_at &&
          new Date(promotion.end_at).getTime() <= currentTimestamp
        ) {
          return false;
        }

        return true;
      },
    ).length;

    const promotionOrders = promotedOrderIds.size;

    const discountGiven = promotionRows.reduce(
      (sum, promotion) => sum + promotion.discount,
      0,
    );

    const promotedRevenue = promotionRows.reduce(
      (sum, promotion) => sum + promotion.revenue,
      0,
    );

    const averageDiscount =
      promotionOrders > 0
        ? discountGiven / promotionOrders
        : 0;

    const promotionUsage =
      data.orders.length > 0
        ? (promotionOrders / data.orders.length) * 100
        : 0;

    /*
     * Build weekday usage trend from actual promoted orders.
     */
    const weekdayValues = new Map<number, number>();

    for (const order of data.orders) {
      if (!promotedOrderIds.has(order.id)) {
        continue;
      }

      const date = new Date(order.created_at);
      const day = date.getDay();

      weekdayValues.set(
        day,
        (weekdayValues.get(day) || 0) + 1,
      );
    }

    const trend = [
      { label: 'Mon', value: weekdayValues.get(1) || 0 },
      { label: 'Tue', value: weekdayValues.get(2) || 0 },
      { label: 'Wed', value: weekdayValues.get(3) || 0 },
      { label: 'Thu', value: weekdayValues.get(4) || 0 },
      { label: 'Fri', value: weekdayValues.get(5) || 0 },
      { label: 'Sat', value: weekdayValues.get(6) || 0 },
      { label: 'Sun', value: weekdayValues.get(0) || 0 },
    ];

    const bestPromotion =
      promotionRows.length > 0
        ? [...promotionRows].sort(
            (a, b) => b.revenue - a.revenue,
          )[0]
        : null;

    const mostUsed =
      promotionRows.length > 0
        ? [...promotionRows].sort(
            (a, b) => b.usage - a.usage,
          )[0]
        : null;

    const largestDiscount =
      promotionRows.length > 0
        ? [...promotionRows].sort(
            (a, b) => b.discount - a.discount,
          )[0]
        : null;

    /*
     * Keep categoryMap referenced so this calculation layer remains
     * compatible with category-scoped promotions and future UI.
     */
    void categoryMap;

    return {
      promotions: promotionRows,
      activePromotions,
      promotionOrders,
      discountGiven,
      promotionUsage,
      promotedRevenue,
      averageDiscount,
      promotionShare: promotionUsage,
      trend,
      bestPromotion,
      mostUsed,
      largestDiscount,
    };
  }, [currentTimestamp, data]);

  const maxUsage = Math.max(
    ...calculated.trend.map((item) => item.value),
    1,
  );

  const periodLabel =
    period === '7d'
      ? 'Last 7 days'
      : period === '30d'
        ? 'Last 30 days'
        : period === '90d'
          ? 'Last 90 days'
          : 'Last 12 months';

  if (loading && !data) {
    return (
      <div
        className="flex min-h-[60vh] items-center justify-center px-6"
        style={{
          background: 'var(--portal-background)',
          color: 'var(--portal-text)',
        }}
      >
        <div className="text-center">
          <div
            className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-transparent"
            style={{
              borderTopColor: 'var(--portal-accent)',
            }}
          />

          <p
            className="mt-4 text-xs font-bold"
            style={{
              color: 'var(--portal-text-muted)',
            }}
          >
            Loading promotions report...
          </p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div
        className="px-4 pb-8 sm:px-6 sm:pb-10 lg:px-8 lg:pb-12"
        style={{
          background: 'var(--portal-background)',
          color: 'var(--portal-text)',
        }}
      >
        <div className="mx-auto max-w-4xl">
          <div
            className="rounded-2xl border p-6"
            style={{
              background: 'var(--portal-surface)',
              borderColor: 'var(--portal-border)',
            }}
          >
            <div
              className="text-[10px] font-black uppercase tracking-[0.16em]"
              style={{
                color: 'var(--portal-accent)',
              }}
            >
              Promotions report
            </div>

            <h1 className="mt-2 text-xl font-black">
              Could not load report
            </h1>

            <p
              className="mt-2 text-sm"
              style={{
                color: 'var(--portal-text-muted)',
              }}
            >
              {error}
            </p>

            <button
              type="button"
              onClick={() => void loadReport()}
              className="mt-5 rounded-xl px-4 py-2.5 text-xs font-black"
              style={{
                background: 'var(--portal-accent)',
                color: '#ffffff',
              }}
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-full px-4 pb-8 sm:px-6 sm:pb-10 lg:px-8 lg:pb-12"
      style={{
        background: 'var(--portal-background)',
        color: 'var(--portal-text)',
      }}
    >
      <div className="mx-auto max-w-7xl">
        {/* HEADER */}
        <section
          className="relative overflow-hidden rounded-3xl border p-6 sm:p-8"
          style={{
            background: 'var(--portal-surface)',
            borderColor: 'var(--portal-border)',
          }}
        >
          <div
            className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full blur-3xl"
            style={{
              background: 'var(--portal-accent-soft)',
            }}
          />

          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div
                className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em]"
                style={{
                  color: 'var(--portal-accent)',
                }}
              >
                <Tag className="h-3.5 w-3.5" />
                Promotion intelligence
              </div>

              <h2
                className="mt-3 text-3xl font-black tracking-tight sm:text-4xl"
                style={{
                  color: 'var(--portal-text)',
                }}
              >
                Promotions
              </h2>

              <p
                className="mt-3 max-w-2xl text-sm leading-6"
                style={{
                  color: 'var(--portal-text-muted)',
                }}
              >
                Measure how your promotions perform, how often customers use
                them, and how discounts affect your restaurant revenue.
              </p>
            </div>

          </div>
        </section>

        {/* FILTER BAR */}
        <section
          className="mt-5 flex flex-col gap-3 rounded-2xl border p-3 sm:flex-row sm:items-center sm:justify-between"
          style={{
            background: 'var(--portal-surface)',
            borderColor: 'var(--portal-border)',
          }}
        >
          <div className="flex items-center gap-2">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl"
              style={{
                background: 'var(--portal-accent-soft)',
                color: 'var(--portal-accent)',
              }}
            >
              <CalendarDays className="h-4 w-4" />
            </div>

            <div>
              <div
                className="text-[10px] font-black uppercase tracking-[0.15em]"
                style={{
                  color: 'var(--portal-text-muted)',
                }}
              >
                Reporting period
              </div>

              <div
                className="text-xs font-bold"
                style={{
                  color: 'var(--portal-text)',
                }}
              >
                {periodLabel}
              </div>
            </div>
          </div>

          <div className="flex gap-1 overflow-x-auto">
            {periods.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setPeriod(item.key)}
                className="whitespace-nowrap rounded-lg px-3 py-2 text-[11px] font-black transition"
                style={{
                  background:
                    period === item.key
                      ? 'var(--portal-accent-soft)'
                      : 'transparent',
                  color:
                    period === item.key
                      ? 'var(--portal-accent)'
                      : 'var(--portal-text-muted)',
                }}
              >
                {item.label}
              </button>
            ))}
            <ReportDateRangePicker
              period={period}
              onPeriodChange={(value) => setPeriod(value as Period)}
              from={customFrom}
              to={customTo}
              onFromChange={setCustomFrom}
              onToChange={setCustomTo}
            />
          </div>
        </section>

        {/* KPI CARDS */}
        <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Active Promotions"
            value={String(calculated.activePromotions)}
            description="Currently active promotions"
            icon={Tag}
          />

          <KpiCard
            label="Promotion Orders"
            value={String(calculated.promotionOrders)}
            description="Orders using promotions"
            icon={CheckCircle2}
          />

          <KpiCard
            label="Discount Given"
            value={formatMoney(
              calculated.discountGiven,
              currency,
            )}
            description="Total promotional discount"
            icon={DollarSign}
          />

          <KpiCard
            label="Promotion Usage"
            value={`${calculated.promotionUsage.toFixed(1)}%`}
            description="Orders with a promotion"
            icon={Percent}
          />
        </section>

        {/* PROMOTION USAGE + IMPACT */}
        <section className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
          {/* USAGE TREND */}
          <div
            className="rounded-2xl border p-5 sm:p-6"
            style={{
              background: 'var(--portal-surface)',
              borderColor: 'var(--portal-border)',
            }}
          >
            <div className="flex items-start justify-between">
              <div>
                <div
                  className="text-[10px] font-black uppercase tracking-[0.16em]"
                  style={{
                    color: 'var(--portal-accent)',
                  }}
                >
                  Promotion activity
                </div>

                <h3
                  className="mt-1 text-lg font-black"
                  style={{
                    color: 'var(--portal-text)',
                  }}
                >
                  Promotion usage over time
                </h3>

                <p
                  className="mt-1 text-xs"
                  style={{
                    color: 'var(--portal-text-muted)',
                  }}
                >
                  Number of orders using a promotion.
                </p>
              </div>

              <div
                className="flex h-9 w-9 items-center justify-center rounded-xl"
                style={{
                  background: 'var(--portal-accent-soft)',
                  color: 'var(--portal-accent)',
                }}
              >
                <BarChart3 className="h-4 w-4" />
              </div>
            </div>

            <div className="mt-8">
              <div className="flex h-64 items-end gap-2 sm:gap-4">
                {calculated.trend.map((item) => {
                  const height =
                    item.value === 0
                      ? 3
                      : Math.max(
                          (item.value / maxUsage) * 100,
                          4,
                        );

                  return (
                    <div
                      key={item.label}
                      className="flex h-full flex-1 flex-col items-center justify-end"
                    >
                      <div
                        className="w-full max-w-12 rounded-t-lg transition"
                        style={{
                          height: `${height}%`,
                          background:
                            item.value === 0
                              ? 'var(--portal-border)'
                              : 'var(--portal-accent)',
                          opacity:
                            item.value === 0 ? 0.5 : 1,
                        }}
                      />

                      <div
                        className="mt-3 text-[10px] font-bold"
                        style={{
                          color: 'var(--portal-text-muted)',
                        }}
                      >
                        {item.label}
                      </div>

                      <div
                        className="mt-1 text-[9px] font-black"
                        style={{
                          color: 'var(--portal-text-muted)',
                        }}
                      >
                        {item.value}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div
                className="mt-5 rounded-xl border p-4"
                style={{
                  borderColor: 'var(--portal-border)',
                  background: 'var(--portal-background)',
                }}
              >
                <div className="flex items-center gap-2">
                  <BarChart3
                    className="h-4 w-4"
                    style={{
                      color: 'var(--portal-accent)',
                    }}
                  />

                  <span
                    className="text-xs font-bold"
                    style={{
                      color: 'var(--portal-text)',
                    }}
                  >
                    {calculated.promotionOrders > 0
                      ? `${calculated.promotionOrders} order${calculated.promotionOrders === 1 ? '' : 's'} used promotions during this period.`
                      : 'No promotion usage recorded during this period.'}
                  </span>
                </div>

                <p
                  className="mt-1 text-[11px] leading-5"
                  style={{
                    color: 'var(--portal-text-muted)',
                  }}
                >
                  Usage is calculated from actual orders and order
                  items in Supabase.
                </p>
              </div>
            </div>
          </div>

          {/* PROMOTION IMPACT */}
          <div
            className="rounded-2xl border p-5 sm:p-6"
            style={{
              background: 'var(--portal-surface)',
              borderColor: 'var(--portal-border)',
            }}
          >
            <div
              className="text-[10px] font-black uppercase tracking-[0.16em]"
              style={{
                color: 'var(--portal-accent)',
              }}
            >
              Financial impact
            </div>

            <h3
              className="mt-1 text-lg font-black"
              style={{
                color: 'var(--portal-text)',
              }}
            >
              Promotion economics
            </h3>

            <div className="mt-6 space-y-3">
              <ImpactRow
                label="Discount given"
                value={formatMoney(
                  calculated.discountGiven,
                  currency,
                )}
                description="Total discount value"
              />

              <ImpactRow
                label="Revenue from promoted orders"
                value={formatMoney(
                  calculated.promotedRevenue,
                  currency,
                )}
                description="Revenue after estimated promotional discount"
              />

              <ImpactRow
                label="Average discount"
                value={formatMoney(
                  calculated.averageDiscount,
                  currency,
                )}
                description="Average discount per promoted order"
              />

              <ImpactRow
                label="Promotion share"
                value={`${calculated.promotionShare.toFixed(1)}%`}
                description="Orders using promotions"
              />
            </div>
          </div>
        </section>

        {/* PROMOTION TABLE */}
        <section
          className="mt-5 rounded-2xl border p-5 sm:p-6"
          style={{
            background: 'var(--portal-surface)',
            borderColor: 'var(--portal-border)',
          }}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div
                className="text-[10px] font-black uppercase tracking-[0.16em]"
                style={{
                  color: 'var(--portal-accent)',
                }}
              >
                Promotion performance
              </div>

              <h3
                className="mt-1 text-lg font-black"
                style={{
                  color: 'var(--portal-text)',
                }}
              >
                Promotion breakdown
              </h3>

              <p
                className="mt-1 text-xs"
                style={{
                  color: 'var(--portal-text-muted)',
                }}
              >
                Compare individual promotions by usage, discount
                and revenue.
              </p>
            </div>

            <div
              className="hidden h-9 w-9 items-center justify-center rounded-xl sm:flex"
              style={{
                background: 'var(--portal-accent-soft)',
                color: 'var(--portal-accent)',
              }}
            >
              <Tag className="h-4 w-4" />
            </div>
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr
                  className="border-b"
                  style={{
                    borderColor: 'var(--portal-border)',
                  }}
                >
                  <th
                    className="pb-3 text-left text-[10px] font-black uppercase tracking-[0.14em]"
                    style={{
                      color: 'var(--portal-text-muted)',
                    }}
                  >
                    Promotion
                  </th>

                  <th
                    className="pb-3 text-left text-[10px] font-black uppercase tracking-[0.14em]"
                    style={{
                      color: 'var(--portal-text-muted)',
                    }}
                  >
                    Type
                  </th>

                  <th
                    className="pb-3 text-right text-[10px] font-black uppercase tracking-[0.14em]"
                    style={{
                      color: 'var(--portal-text-muted)',
                    }}
                  >
                    Usage
                  </th>

                  <th
                    className="pb-3 text-right text-[10px] font-black uppercase tracking-[0.14em]"
                    style={{
                      color: 'var(--portal-text-muted)',
                    }}
                  >
                    Discount
                  </th>

                  <th
                    className="pb-3 text-right text-[10px] font-black uppercase tracking-[0.14em]"
                    style={{
                      color: 'var(--portal-text-muted)',
                    }}
                  >
                    Revenue
                  </th>
                </tr>
              </thead>

              <tbody>
                {calculated.promotions.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-10 text-center"
                    >
                      <Tag
                        className="mx-auto h-7 w-7"
                        style={{
                          color: 'var(--portal-text-muted)',
                        }}
                      />

                      <p
                        className="mt-3 text-xs font-black"
                        style={{
                          color: 'var(--portal-text)',
                        }}
                      >
                        No promotions found
                      </p>

                      <p
                        className="mt-1 text-[10px]"
                        style={{
                          color: 'var(--portal-text-muted)',
                        }}
                      >
                        Promotions created in Pricing &
                        Promotions will appear here.
                      </p>
                    </td>
                  </tr>
                ) : (
                  calculated.promotions.map(
                    (promotion, index) => (
                      <tr
                        key={promotion.id}
                        className="border-b last:border-0"
                        style={{
                          borderColor:
                            'var(--portal-border)',
                        }}
                      >
                        <td className="py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                              style={{
                                background:
                                  index === 0
                                    ? 'var(--portal-accent-soft)'
                                    : 'var(--portal-background)',
                                color:
                                  index === 0
                                    ? 'var(--portal-accent)'
                                    : 'var(--portal-text-muted)',
                              }}
                            >
                              <Tag className="h-3.5 w-3.5" />
                            </div>

                            <div>
                              <div
                                className="text-xs font-bold"
                                style={{
                                  color:
                                    'var(--portal-text)',
                                }}
                              >
                                {promotion.name}
                              </div>

                              <div
                                className="mt-0.5 text-[10px]"
                                style={{
                                  color:
                                    'var(--portal-text-muted)',
                                }}
                              >
                                Promotion
                              </div>
                            </div>
                          </div>
                        </td>

                        <td
                          className="py-4 text-xs"
                          style={{
                            color:
                              'var(--portal-text-muted)',
                          }}
                        >
                          {promotion.type}
                        </td>

                        <td
                          className="py-4 text-right text-xs font-black"
                          style={{
                            color: 'var(--portal-text)',
                          }}
                        >
                          {promotion.usage}
                        </td>

                        <td
                          className="py-4 text-right text-xs font-black"
                          style={{
                            color: 'var(--portal-text)',
                          }}
                        >
                          {formatMoney(
                            promotion.discount,
                            currency,
                          )}
                        </td>

                        <td
                          className="py-4 text-right text-xs font-black"
                          style={{
                            color: 'var(--portal-text)',
                          }}
                        >
                          {formatMoney(
                            promotion.revenue,
                            currency,
                          )}
                        </td>
                      </tr>
                    ),
                  )
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* PROMOTION INSIGHTS */}
        <section className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <InsightCard
            icon={TrendingUp}
            title="Best promotion"
            value={
              calculated.bestPromotion
                ? calculated.bestPromotion.name
                : '—'
            }
            description={
              calculated.bestPromotion
                ? `${formatMoney(
                    calculated.bestPromotion.revenue,
                    currency,
                  )} revenue generated.`
                : 'Highest-performing promotion by revenue.'
            }
            positive
          />

          <InsightCard
            icon={Users}
            title="Most used"
            value={
              calculated.mostUsed
                ? calculated.mostUsed.name
                : '—'
            }
            description={
              calculated.mostUsed
                ? `${calculated.mostUsed.usage} promoted order item${calculated.mostUsed.usage === 1 ? '' : 's'}.`
                : 'Promotion with the highest usage.'
            }
            positive
          />

          <InsightCard
            icon={DollarSign}
            title="Largest discount"
            value={
              calculated.largestDiscount
                ? formatMoney(
                    calculated.largestDiscount.discount,
                    currency,
                  )
                : '—'
            }
            description={
              calculated.largestDiscount
                ? calculated.largestDiscount.name
                : 'Promotion giving the highest total discount.'
            }
            positive={false}
          />

          <InsightCard
            icon={Percent}
            title="Conversion impact"
            value={`${calculated.promotionShare.toFixed(1)}%`}
            description={`${formatNumber(calculated.promotionOrders)} of ${formatNumber(data?.orders.length || 0)} orders used a promotion.`}
            positive
          />
        </section>

        {/* RECOMMENDATION */}
        <section
          className="mt-5 rounded-2xl border p-5 sm:p-6"
          style={{
            background: 'var(--portal-surface)',
            borderColor: 'var(--portal-border)',
          }}
        >
          <div className="flex items-start gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{
                background: 'var(--portal-accent-soft)',
                color: 'var(--portal-accent)',
              }}
            >
              <Tag className="h-5 w-5" />
            </div>

            <div>
              <div
                className="text-[10px] font-black uppercase tracking-[0.16em]"
                style={{
                  color: 'var(--portal-accent)',
                }}
              >
                Promotion insight
              </div>

              <h3
                className="mt-1 text-lg font-black"
                style={{
                  color: 'var(--portal-text)',
                }}
              >
                {calculated.bestPromotion
                  ? `${calculated.bestPromotion.name} is currently your strongest promotion.`
                  : 'Measure discounts by what they generate'}
              </h3>

              <p
                className="mt-2 max-w-3xl text-xs leading-5"
                style={{
                  color: 'var(--portal-text-muted)',
                }}
              >
                {calculated.bestPromotion
                  ? `This promotion generated ${formatMoney(
                      calculated.bestPromotion.revenue,
                      currency,
                    )} in attributed revenue during the selected period. Use the promotion breakdown to compare its usage and discount cost against your other offers.`
                  : 'A promotion should not only be measured by how many times it was used. NOVAMENU compares promotion usage, discount cost and resulting revenue to help identify which offers are actually valuable.'}
              </p>
            </div>
          </div>
        </section>

        {/* DATA STATUS */}
        <div
          className="mt-5 rounded-xl border border-dashed p-4 text-center"
          style={{
            borderColor: 'var(--portal-border)',
          }}
        >
          <p
            className="text-[10px] font-black uppercase tracking-[0.16em]"
            style={{
              color: 'var(--portal-text-muted)',
            }}
          >
            Promotions report
          </p>

          <p
            className="mt-1 text-xs"
            style={{
              color: 'var(--portal-text-muted)',
            }}
          >
            Connected to your Supabase promotions, orders, order
            items and menu data. Changes are refreshed automatically.
          </p>

          {loading && (
            <p
              className="mt-2 text-[10px] font-bold"
              style={{
                color: 'var(--portal-accent)',
              }}
            >
              Updating report...
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  description,
  icon: Icon,
}: {
  label: string;
  value: string;
  description: string;
  icon: React.ElementType;
}) {
  return (
    <div
      className="rounded-2xl border p-5"
      style={{
        background: 'var(--portal-surface)',
        borderColor: 'var(--portal-border)',
      }}
    >
      <div className="flex items-center justify-between">
        <span
          className="text-[10px] font-black uppercase tracking-[0.16em]"
          style={{
            color: 'var(--portal-text-muted)',
          }}
        >
          {label}
        </span>

        <div
          className="flex h-8 w-8 items-center justify-center rounded-lg"
          style={{
            background: 'var(--portal-accent-soft)',
            color: 'var(--portal-accent)',
          }}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>

      <div
        className="mt-4 text-2xl font-black"
        style={{
          color: 'var(--portal-text)',
        }}
      >
        {value}
      </div>

      <div
        className="mt-1 text-[10px]"
        style={{
          color: 'var(--portal-text-muted)',
        }}
      >
        {description}
      </div>
    </div>
  );
}

function ImpactRow({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description: string;
}) {
  return (
    <div
      className="rounded-xl border p-4"
      style={{
        borderColor: 'var(--portal-border)',
        background: 'var(--portal-background)',
      }}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <div
            className="text-xs font-bold"
            style={{
              color: 'var(--portal-text)',
            }}
          >
            {label}
          </div>

          <div
            className="mt-1 text-[10px]"
            style={{
              color: 'var(--portal-text-muted)',
            }}
          >
            {description}
          </div>
        </div>

        <div
          className="text-sm font-black"
          style={{
            color: 'var(--portal-text)',
          }}
        >
          {value}
        </div>
      </div>
    </div>
  );
}

function InsightCard({
  icon: Icon,
  title,
  value,
  description,
  positive,
}: {
  icon: React.ElementType;
  title: string;
  value: string;
  description: string;
  positive: boolean;
}) {
  return (
    <div
      className="rounded-2xl border p-5"
      style={{
        background: 'var(--portal-surface)',
        borderColor: 'var(--portal-border)',
      }}
    >
      <div className="flex items-start justify-between">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{
            background: 'var(--portal-accent-soft)',
            color: 'var(--portal-accent)',
          }}
        >
          <Icon className="h-5 w-5" />
        </div>

        {positive ? (
          <ArrowUpRight
            className="h-4 w-4"
            style={{
              color: 'var(--portal-accent)',
            }}
          />
        ) : (
          <ArrowDownRight
            className="h-4 w-4"
            style={{
              color: 'var(--portal-text-muted)',
            }}
          />
        )}
      </div>

      <div
        className="mt-5 line-clamp-2 text-[10px] font-black uppercase tracking-[0.15em]"
        style={{
          color: 'var(--portal-text-muted)',
        }}
      >
        {title}
      </div>

      <div
        className="mt-2 line-clamp-2 text-xl font-black"
        style={{
          color: 'var(--portal-text)',
        }}
      >
        {value}
      </div>

      <p
        className="mt-2 text-[11px] leading-5"
        style={{
          color: 'var(--portal-text-muted)',
        }}
      >
        {description}
      </p>
    </div>
  );
}