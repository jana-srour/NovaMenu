'use client';

import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  Heart,
  Loader2,
  RefreshCw,
  Repeat2,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  UserCheck,
  Users,
  UserRoundPlus,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { supabase } from '@/lib/supabase';
import {
  getCurrentRestaurantId,
  getReportPeriodRange,
} from '@/lib/reports/data';
import ReportDateRangePicker from '@/components/report-date-range-picker';

type Period = '7d' | '30d' | '90d' | '12m' | 'custom';

const periods: { key: Period; label: string }[] = [
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: '90d', label: '90 days' },
  { key: '12m', label: '12 months' },
];

type OrderRow = {
  id: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  status: string | null;
  total: number | null;
  created_at: string;
};

type Customer = {
  key: string;
  name: string;
  phone: string;
  address: string;
  orders: OrderRow[];
  totalSpend: number;
  firstOrderAt: number;
};

type CustomerSegment = {
  label: string;
  value: number;
  percentage: number;
  description: string;
};

type ActivityMetric = {
  label: string;
  value: string;
  change: string;
  positive: boolean;
};

function normalizeCustomerName(
  value: string | null | undefined,
) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function displayCustomerName(
  value: string | null | undefined,
) {
  const name = String(value || '').trim();

  if (!name) return 'Guest';

  return name;
}

function isAnonymousCustomer(
  value: string | null | undefined,
) {
  const normalized = normalizeCustomerName(value);

  return (
    !normalized ||
    normalized === 'guest' ||
    normalized === 'unknown' ||
    normalized === 'anonymous' ||
    normalized === 'walk-in' ||
    normalized === 'walkin'
  );
}

function isCancelledOrder(
  status: string | null | undefined,
) {
  const normalized = String(status || '')
    .trim()
    .toLowerCase();

  return (
    normalized === 'cancelled' ||
    normalized === 'canceled' ||
    normalized === 'rejected' ||
    normalized === 'declined' ||
    normalized === 'voided'
  );
}

function isTrackedOrder(
  status: string | null | undefined,
) {
  return !isCancelledOrder(status);
}

function getPeriodRange(
  period: Period,
  anchor = new Date(),
  customFrom?: string,
  customTo?: string,
) {
  if (period === 'custom' && customFrom && customTo) {
    const customEnd = new Date(`${customTo}T00:00:00`);
    customEnd.setDate(customEnd.getDate() + 1);
    return {
      start: new Date(`${customFrom}T00:00:00`),
      end: customEnd,
    };
  }
  const range = getReportPeriodRange(
    period === 'custom' ? '30d' : period,
    anchor,
  );

  return {
    start: new Date(range.from!),
    end: new Date(range.to!),
  };
}

function formatMoney(
  value: number,
  currency: string,
) {
  const amount = Number(value || 0);

  const normalized =
    String(currency || '')
      .trim()
      .toUpperCase();

  const currencyMap: Record<
    string,
    string
  > = {
    '$': 'USD',
    'US$': 'USD',
    USD: 'USD',
    '€': 'EUR',
    EUR: 'EUR',
    '£': 'GBP',
    GBP: 'GBP',
    LBP: 'LBP',
    'ل.ل': 'LBP',
    'ل.ل.': 'LBP',
    AED: 'AED',
    SAR: 'SAR',
    QAR: 'QAR',
    KWD: 'KWD',
    BHD: 'BHD',
    JOD: 'JOD',
    EGP: 'EGP',
  };

  const code =
    currencyMap[normalized] || 'USD';

  try {
    return new Intl.NumberFormat(
      'en-US',
      {
        style: 'currency',
        currency: code,
        maximumFractionDigits: 2,
      },
    ).format(amount);
  } catch {
    return `${currency || '$'} ${amount.toFixed(2)}`;
  }
}

function formatPercent(
  value: number,
) {
  if (!Number.isFinite(value)) {
    return '0.0%';
  }

  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}

function calculateChange(
  current: number,
  previous: number,
) {
  if (previous === 0) {
    if (current === 0) return 0;
    return 100;
  }

  return (
    ((current - previous) /
      Math.abs(previous)) *
    100
  );
}

function getCustomerMap(
  orders: OrderRow[],
) {
  const map = new Map<
    string,
    Customer
  >();

  for (const order of orders) {
    if (!isTrackedOrder(order.status)) {
      continue;
    }

    /*
     * Do not combine all anonymous/Guest orders into
     * one fake customer.
     */
    if (
      isAnonymousCustomer(
        order.customer_name,
      )
    ) {
      continue;
    }

    const phoneKey = normalizeCustomerPhone(order.customer_phone);
    const nameKey = normalizeCustomerName(order.customer_name);
    const key = phoneKey ? `phone:${phoneKey}` : `name:${nameKey}`;

    if (!phoneKey && !nameKey) continue;

    const existing = map.get(key);

    if (existing) {
      existing.orders.push(order);
      existing.totalSpend += Number(
        order.total || 0,
      );

      const timestamp =
        new Date(
          order.created_at,
        ).getTime();

      if (
        Number.isFinite(timestamp) &&
        timestamp <
          existing.firstOrderAt
      ) {
        existing.firstOrderAt =
          timestamp;
      }

      if (order.customer_phone?.trim()) {
        existing.phone = order.customer_phone.trim();
      }

      if (order.customer_address?.trim()) {
        existing.address = order.customer_address.trim();
      }
    } else {
      const timestamp =
        new Date(
          order.created_at,
        ).getTime();

      map.set(key, {
        key,
        name: displayCustomerName(
          order.customer_name,
        ),
        phone: order.customer_phone?.trim() || '',
        address: order.customer_address?.trim() || '',
        orders: [order],
        totalSpend: Number(
          order.total || 0,
        ),
        firstOrderAt:
          Number.isFinite(timestamp)
            ? timestamp
            : Number.MAX_SAFE_INTEGER,
      });
    }
  }

  return map;
}

function getCustomersInRange(
  orders: OrderRow[],
  start: Date,
  end: Date,
) {
  const startTime = start.getTime();
  const endTime = end.getTime();

  return orders.filter((order) => {
    if (
      !isTrackedOrder(order.status)
    ) {
      return false;
    }

    const timestamp =
      new Date(
        order.created_at,
      ).getTime();

    return (
      timestamp >= startTime &&
      timestamp < endTime
    );
  });
}

function getBucketCount(
  period: Period,
) {
  if (period === '7d') return 7;
  if (period === '30d') return 7;
  if (period === '90d') return 9;
  return 12;
}

function buildGrowthBuckets(
  orders: OrderRow[],
  period: Period,
  start: Date,
  end: Date,
) {
  const count =
    getBucketCount(period);

  const startTime = start.getTime();
  const endTime = end.getTime();

  const duration =
    endTime - startTime;

  const bucketDuration =
    duration / count;

  const buckets = Array.from(
    { length: count },
    (_, index) => ({
      index,
      start: new Date(
        startTime +
          bucketDuration * index,
      ),
      end: new Date(
        startTime +
          bucketDuration *
            (index + 1),
      ),
      value: 0,
      label: '',
    }),
  );

  const customers = getCustomerMap(
    orders,
  );

  /*
   * A customer is counted as "new" in the
   * bucket containing their first-ever order.
   */
  for (const customer of customers.values()) {
    const firstOrder =
      customer.firstOrderAt;

    if (
      firstOrder < startTime ||
      firstOrder >= endTime
    ) {
      continue;
    }

    const index = Math.min(
      count - 1,
      Math.max(
        0,
        Math.floor(
          (firstOrder - startTime) /
            bucketDuration,
        ),
      ),
    );

    buckets[index].value += 1;
  }

  buckets.forEach((bucket) => {
    if (
      period === '7d'
    ) {
      bucket.label =
        bucket.start.toLocaleDateString(
          'en-US',
          {
            weekday: 'short',
          },
        );
    } else if (
      period === '12m'
    ) {
      bucket.label =
        bucket.start.toLocaleDateString(
          'en-US',
          {
            month: 'short',
          },
        );
    } else {
      bucket.label =
        bucket.start.toLocaleDateString(
          'en-US',
          {
            month: 'short',
            day: 'numeric',
          },
        );
    }
  });

  return buckets;
}

function getTopCustomers(
  orders: OrderRow[],
) {
  const map = getCustomerMap(
    orders,
  );

  return Array.from(
    map.values(),
  )
    .sort(
      (a, b) =>
        b.totalSpend -
        a.totalSpend,
    )
    .slice(0, 5);
}

export default function CustomersReportPage() {
  const [period, setPeriod] =
    useState<Period>('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const [orders, setOrders] =
    useState<OrderRow[]>([]);

  const [currency, setCurrency] =
    useState('$');

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState('');

  const [lastUpdated, setLastUpdated] =
    useState<Date | null>(null);

  const loadReport =
    useCallback(
      async (
        showRefreshing = false,
      ) => {
        try {
          if (showRefreshing) {
            setRefreshing(true);
          } else {
            setLoading(true);
          }

          setError('');

          const restaurantId =
            await getCurrentRestaurantId();

          if (!restaurantId) {
            throw new Error(
              'No restaurant is associated with the current account.',
            );
          }

          const [
            restaurantResult,
            ordersResult,
          ] = await Promise.all([
            supabase
              .from('restaurants')
              .select(
                'currency',
              )
              .eq(
                'id',
                restaurantId,
              )
              .single(),

            /*
             * IMPORTANT:
             * We intentionally load ALL orders.
             *
             * We need historical orders to know whether a customer
             * is genuinely new or whether they ordered before the
             * selected reporting period.
             */
            supabase
              .from('orders')
              .select(
                'id, order_number, customer_name, customer_phone, customer_address, status, total, created_at',
              )
              .eq(
                'restaurant_id',
                restaurantId,
              )
              .order(
                'created_at',
                {
                  ascending: true,
                },
              ),
          ]);

          if (
            restaurantResult.error
          ) {
            throw new Error(
              restaurantResult.error.message,
            );
          }

          if (
            ordersResult.error
          ) {
            throw new Error(
              ordersResult.error.message,
            );
          }

          setCurrency(
            restaurantResult.data
              ?.currency || '$',
          );

          setOrders(
            (ordersResult.data ||
              []) as OrderRow[],
          );

          setLastUpdated(
            new Date(),
          );
        } catch (err) {
          console.error(
            'Customers report loading failed:',
            err,
          );

          setError(
            err instanceof Error
              ? err.message
              : 'Could not load customer report.',
          );
        } finally {
          setLoading(false);
          setRefreshing(false);
        }
      },
      [],
    );

  useEffect(() => {
    void Promise.resolve().then(() => loadReport());
  }, [loadReport]);

  /*
   * Realtime updates.
   *
   * Order Management already updates the orders table and
   * order_items table in realtime, so customer analytics should
   * react to the same source.
   *
   * .on() MUST come before .subscribe().
   */
  useEffect(() => {
    let channel:
      | ReturnType<
          typeof supabase.channel
        >
      | null = null;

    let cancelled = false;

    async function setupRealtime() {
      const restaurantId =
        await getCurrentRestaurantId();

      if (
        !restaurantId ||
        cancelled
      ) {
        return;
      }

      channel = supabase
        .channel(
          `customers-report-${restaurantId}`,
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'orders',
            filter: `restaurant_id=eq.${restaurantId}`,
          },
          () => {
            loadReport(true);
          },
        )
        .subscribe();
    }

    setupRealtime();

    return () => {
      cancelled = true;

      if (channel) {
        supabase.removeChannel(
          channel,
        );
      }
    };
  }, [loadReport]);

  const currentRange = useMemo(
    () => getPeriodRange(period, new Date(), customFrom, customTo),
    [period, customFrom, customTo],
  );

  const previousRange = useMemo(
    () => {
      const current = getPeriodRange(
        period,
        new Date(),
        customFrom,
        customTo,
      );
      const duration =
        current.end.getTime() - current.start.getTime();
      return {
        start: new Date(current.start.getTime() - duration),
        end: current.start,
      };
    },
    [period, customFrom, customTo],
  );

  const currentOrders = useMemo(
    () =>
      getCustomersInRange(
        orders,
        currentRange.start,
        currentRange.end,
      ),
    [
      orders,
      currentRange,
    ],
  );

  const previousOrders = useMemo(
    () =>
      getCustomersInRange(
        orders,
        previousRange.start,
        previousRange.end,
      ),
    [
      orders,
      previousRange,
    ],
  );

  const allCustomers = useMemo(
    () => getCustomerMap(orders),
    [orders],
  );

  const currentCustomers = useMemo(
    () =>
      getCustomerMap(
        currentOrders,
      ),
    [currentOrders],
  );

  const previousCustomers = useMemo(
    () =>
      getCustomerMap(
        previousOrders,
      ),
    [previousOrders],
  );

  /*
   * New customers:
   * Customer's first-ever order must be inside current period.
   */
  const newCustomers = useMemo(
    () => {
      const start =
        currentRange.start.getTime();

      const end =
        currentRange.end.getTime();

      return Array.from(
        currentCustomers.values(),
      ).filter(
        (customer) =>
          customer.firstOrderAt >=
            start &&
          customer.firstOrderAt <
            end,
      );
    },
    [
      currentCustomers,
      currentRange,
    ],
  );

  const previousNewCustomers =
    useMemo(() => {
      const start =
        previousRange.start.getTime();

      const end =
        previousRange.end.getTime();

      return Array.from(
        allCustomers.values(),
      ).filter(
        (customer) =>
          customer.firstOrderAt >=
            start &&
          customer.firstOrderAt <
            end,
      );
    }, [
      allCustomers,
      previousRange,
    ]);

  const returningCustomers =
    useMemo(
      () =>
        Array.from(
          currentCustomers.values(),
        ).filter(
          (customer) =>
            customer.orders.length >=
            2,
        ),
      [currentCustomers],
    );

  const previousReturningCustomers =
    useMemo(
      () =>
        Array.from(
          previousCustomers.values(),
        ).filter(
          (customer) =>
            customer.orders.length >=
            2,
        ),
      [previousCustomers],
    );

  const frequentCustomers =
    useMemo(
      () =>
        Array.from(
          currentCustomers.values(),
        ).filter(
          (customer) =>
            customer.orders.length >=
            3,
        ),
      [currentCustomers],
    );

  const totalCustomers =
    currentCustomers.size;

  const returningCount =
    returningCustomers.length;

  const repeatRate =
    totalCustomers > 0
      ? (returningCount /
          totalCustomers) *
        100
      : 0;

  const previousRepeatRate =
    previousCustomers.size > 0
      ? (previousReturningCustomers.length /
          previousCustomers.size) *
        100
      : 0;

  const averageOrdersPerCustomer =
    totalCustomers > 0
      ? currentOrders.length /
        totalCustomers
      : 0;

  const previousAverageOrdersPerCustomer =
    previousCustomers.size > 0
      ? previousOrders.length /
        previousCustomers.size
      : 0;

  const currentSpend =
    currentOrders.reduce(
      (sum, order) =>
        sum +
        Number(order.total || 0),
      0,
    );

  const averageOrderValue =
    currentOrders.length > 0
      ? currentSpend /
        currentOrders.length
      : 0;

  const customerSegments =
    useMemo<CustomerSegment[]>(() => {
      const total =
        totalCustomers;

      const newCount =
        newCustomers.length;

      const returning =
        returningCustomers.length;

      const frequent =
        frequentCustomers.length;

      const highValue =
        [...currentCustomers.values()]
          .sort(
            (a, b) =>
              b.totalSpend -
              a.totalSpend,
          )
          .slice(
            0,
            Math.max(
              1,
              Math.ceil(
                total * 0.12,
              ),
            ),
          ).length;

      return [
        {
          label: 'New Customers',
          value: newCount,
          percentage:
            total > 0
              ? (newCount /
                  total) *
                100
              : 0,
          description:
            'First-time customers whose first order occurred in this period',
        },
        {
          label:
            'Returning Customers',
          value: returning,
          percentage:
            total > 0
              ? (returning /
                  total) *
                100
              : 0,
          description:
            'Customers with 2+ orders in this period',
        },
        {
          label:
            'Frequent Customers',
          value: frequent,
          percentage:
            total > 0
              ? (frequent /
                  total) *
                100
              : 0,
          description:
            'Customers with 3+ orders in this period',
        },
        {
          label:
            'High-Value Customers',
          value: highValue,
          percentage:
            total > 0
              ? (highValue /
                  total) *
                100
              : 0,
          description:
            'Top spending customers in this period',
        },
      ];
    }, [
      totalCustomers,
      newCustomers,
      returningCustomers,
      frequentCustomers,
      currentCustomers,
    ]);

  const activityRows =
    useMemo<ActivityMetric[]>(
      () => [
        {
          label: 'First-time customers',
          value:
            newCustomers.length.toString(),
          change: formatPercent(
            calculateChange(
              newCustomers.length,
              previousNewCustomers.length,
            ),
          ),
          positive:
            newCustomers.length >=
            previousNewCustomers.length,
        },
        {
          label: 'Repeat customers',
          value:
            returningCustomers.length.toString(),
          change: formatPercent(
            calculateChange(
              returningCustomers.length,
              previousReturningCustomers.length,
            ),
          ),
          positive:
            returningCustomers.length >=
            previousReturningCustomers.length,
        },
        {
          label:
            'Returning customer rate',
          value: `${repeatRate.toFixed(1)}%`,
          change: formatPercent(
            repeatRate -
              previousRepeatRate,
          ),
          positive:
            repeatRate >=
            previousRepeatRate,
        },
        {
          label:
            'Average orders / customer',
          value:
            averageOrdersPerCustomer.toFixed(
              2,
            ),
          change: formatPercent(
            calculateChange(
              averageOrdersPerCustomer,
              previousAverageOrdersPerCustomer,
            ),
          ),
          positive:
            averageOrdersPerCustomer >=
            previousAverageOrdersPerCustomer,
        },
      ],
      [
        newCustomers,
        previousNewCustomers,
        returningCustomers,
        previousReturningCustomers,
        repeatRate,
        previousRepeatRate,
        averageOrdersPerCustomer,
        previousAverageOrdersPerCustomer,
      ],
    );

  const growthBuckets =
    useMemo(
      () =>
        buildGrowthBuckets(
          orders,
          period,
          currentRange.start,
          currentRange.end,
        ),
      [
        orders,
        period,
        currentRange,
      ],
    );

  const maxGrowth =
    Math.max(
      1,
      ...growthBuckets.map(
        (bucket) =>
          bucket.value,
      ),
    );

  const topCustomers =
    useMemo(
      () =>
        getTopCustomers(
          currentOrders,
        ),
      [currentOrders],
    );

  const customerGrowth =
    calculateChange(
      newCustomers.length,
      previousNewCustomers.length,
    );

  const averageCustomerOrderValue =
    averageOrderValue;

  const periodLabel =
    period === '7d'
      ? 'Last 7 days'
      : period === '30d'
        ? 'Last 30 days'
        : period === '90d'
          ? 'Last 90 days'
          : 'Last 12 months';

  if (loading) {
    return (
      <div
        className="flex min-h-[60vh] items-center justify-center"
        style={{
          background:
            'var(--portal-background)',
          color:
            'var(--portal-text)',
        }}
      >
        <div className="text-center">
          <Loader2
            size={28}
            className="mx-auto mb-4 animate-spin"
            style={{
              color:
                'var(--portal-accent)',
            }}
          />

          <p className="text-xs font-black uppercase tracking-[0.2em]">
            Loading customer report
          </p>

          <p
            className="mt-2 text-xs"
            style={{
              color:
                'var(--portal-text-muted)',
            }}
          >
            Reading your real order history...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="flex min-h-[60vh] items-center justify-center px-6"
        style={{
          background:
            'var(--portal-background)',
          color:
            'var(--portal-text)',
        }}
      >
        <div
          className="w-full max-w-lg rounded-3xl border p-8 text-center"
          style={{
            borderColor:
              'var(--portal-border)',
            background:
              'var(--portal-surface)',
          }}
        >
          <div
            className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl"
            style={{
              color:
                'var(--portal-accent)',
              background:
                'var(--portal-accent-soft)',
            }}
          >
            <Users size={21} />
          </div>

          <h2 className="mt-4 text-lg font-black">
            Could not load customer report
          </h2>

          <p
            className="mt-2 text-sm"
            style={{
              color:
                'var(--portal-text-muted)',
            }}
          >
            {error}
          </p>

          <button
            type="button"
            onClick={() =>
              loadReport()
            }
            className="mt-6 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black"
            style={{
              background:
                'var(--portal-accent)',
              color: '#fff',
            }}
          >
            <RefreshCw size={14} />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-full px-4 pb-8 sm:px-6 sm:pb-10 lg:px-8 lg:pb-12"
      style={{
        color:
          'var(--portal-text)',
        background:
          'var(--portal-background)',
      }}
    >
      <div className="mx-auto max-w-7xl space-y-6">
        {/* HEADER */}
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div
              className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em]"
              style={{
                color:
                  'var(--portal-accent)',
              }}
            >
              <Users size={13} />
              Reports / Customers
            </div>

            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
              Customers
            </h1>

            <p
              className="mt-2 max-w-2xl text-sm leading-6"
              style={{
                color:
                  'var(--portal-text-muted)',
              }}
            >
              Understand customer activity, repeat ordering,
              spending patterns, and customer growth.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div
              className="flex items-center gap-1 rounded-xl border p-1"
              style={{
                borderColor:
                  'var(--portal-border)',
                background:
                  'var(--portal-surface)',
              }}
            >
              {periods.map(
                (item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() =>
                      setPeriod(
                        item.key,
                      )
                    }
                    className="rounded-lg px-3 py-2 text-xs font-bold transition"
                    style={{
                      color:
                        period ===
                        item.key
                          ? 'var(--portal-text)'
                          : 'var(--portal-text-muted)',
                      background:
                        period ===
                        item.key
                          ? 'var(--portal-accent-soft)'
                          : 'transparent',
                    }}
                  >
                    {item.label}
                  </button>
                ),
              )}
            </div>
            <ReportDateRangePicker
              period={period}
              onPeriodChange={(value) => setPeriod(value as Period)}
              from={customFrom}
              to={customTo}
              onFromChange={setCustomFrom}
              onToChange={setCustomTo}
            />

            <button
              type="button"
              onClick={() =>
                loadReport(true)
              }
              disabled={
                refreshing
              }
              className="inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-black transition disabled:opacity-50"
              style={{
                color:
                  'var(--portal-text)',
                background:
                  'var(--portal-surface)',
                borderColor:
                  'var(--portal-border)',
              }}
            >
              <RefreshCw
                size={14}
                className={
                  refreshing
                    ? 'animate-spin'
                    : ''
                }
              />
              Refresh
            </button>

          </div>
        </div>

        {/* PERIOD STATUS */}
        <div
          className="flex flex-col gap-2 rounded-xl border px-4 py-3 text-[10px] font-bold sm:flex-row sm:items-center sm:justify-between"
          style={{
            borderColor:
              'var(--portal-border)',
            background:
              'var(--portal-surface)',
            color:
              'var(--portal-text-muted)',
          }}
        >
          <div className="flex items-center gap-2">
            <CalendarDays
              size={13}
              style={{
                color:
                  'var(--portal-accent)',
              }}
            />

            <span>
              Showing{' '}
              <strong
                style={{
                  color:
                    'var(--portal-text)',
                }}
              >
                {periodLabel}
              </strong>
            </span>
          </div>

          <div>
            {currentOrders.length}{' '}
            tracked orders ·{' '}
            {totalCustomers}{' '}
            identifiable customers
          </div>
        </div>

        {/* KPI CARDS */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            icon={Users}
            label="Total Customers"
            value={totalCustomers.toString()}
            detail="Unique identifiable customers in period"
          />

          <KpiCard
            icon={UserRoundPlus}
            label="New Customers"
            value={newCustomers.length.toString()}
            detail="First-ever order occurred in period"
            positive={
              newCustomers.length >=
              previousNewCustomers.length
            }
          />

          <KpiCard
            icon={Repeat2}
            label="Returning Customers"
            value={returningCount.toString()}
            detail="Placed 2+ orders in period"
            positive={
              returningCount >=
              previousReturningCustomers.length
            }
          />

          <KpiCard
            icon={Heart}
            label="Repeat Rate"
            value={`${repeatRate.toFixed(1)}%`}
            detail="Customers ordering more than once"
            positive={
              repeatRate >=
              previousRepeatRate
            }
          />
        </div>

        {/* CUSTOMER ACTIVITY */}
        <section
          className="overflow-hidden rounded-2xl border"
          style={{
            borderColor:
              'var(--portal-border)',
            background:
              'var(--portal-surface)',
          }}
        >
          <div
            className="flex flex-col gap-3 border-b px-5 py-5 sm:flex-row sm:items-center sm:justify-between"
            style={{
              borderColor:
                'var(--portal-border)',
            }}
          >
            <div>
              <div className="flex items-center gap-2">
                <Activity
                  size={17}
                  style={{
                    color:
                      'var(--portal-accent)',
                  }}
                />

                <h2 className="text-sm font-black">
                  Customer Activity
                </h2>
              </div>

              <p
                className="mt-1 text-xs"
                style={{
                  color:
                    'var(--portal-text-muted)',
                }}
              >
                Real customer activity compared with the immediately
                preceding period.
              </p>
            </div>

            <div
              className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em]"
              style={{
                color:
                  'var(--portal-text-muted)',
              }}
            >
              <CalendarDays size={13} />
              {periodLabel}
            </div>
          </div>

          <div className="grid divide-y sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">
            {activityRows.map(
              (item) => (
                <div
                  key={item.label}
                  className="p-5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p
                      className="text-[10px] font-black uppercase tracking-[0.14em]"
                      style={{
                        color:
                          'var(--portal-text-muted)',
                      }}
                    >
                      {item.label}
                    </p>

                    <span
                      className="inline-flex items-center gap-1 text-[10px] font-black"
                      style={{
                        color:
                          item.positive
                            ? 'var(--portal-accent)'
                            : '#ef4444',
                      }}
                    >
                      {item.positive ? (
                        <ArrowUpRight
                          size={11}
                        />
                      ) : (
                        <ArrowDownRight
                          size={11}
                        />
                      )}

                      {item.change}
                    </span>
                  </div>

                  <p className="mt-4 text-2xl font-black tracking-tight">
                    {item.value}
                  </p>
                </div>
              ),
            )}
          </div>
        </section>

        {/* SEGMENTS + GROWTH */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* SEGMENTS */}
          <section
            className="rounded-2xl border p-5"
            style={{
              borderColor:
                'var(--portal-border)',
              background:
                'var(--portal-surface)',
            }}
          >
            <div className="flex items-center gap-2">
              <UserCheck
                size={17}
                style={{
                  color:
                    'var(--portal-accent)',
                }}
              />

              <h2 className="text-sm font-black">
                Customer Segments
              </h2>
            </div>

            <p
              className="mt-1 text-xs"
              style={{
                color:
                  'var(--portal-text-muted)',
              }}
            >
              Breakdown of customers using real order behavior.
            </p>

            <div className="mt-5 space-y-3">
              {customerSegments.map(
                (segment) => (
                  <div
                    key={
                      segment.label
                    }
                    className="rounded-xl border p-4"
                    style={{
                      borderColor:
                        'var(--portal-border)',
                      background:
                        'var(--portal-background)',
                    }}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs font-black">
                          {segment.label}
                        </p>

                        <p
                          className="mt-1 text-[10px]"
                          style={{
                            color:
                              'var(--portal-text-muted)',
                          }}
                        >
                          {
                            segment.description
                          }
                        </p>
                      </div>

                      <div className="text-right">
                        <p
                          className="text-sm font-black"
                          style={{
                            color:
                              'var(--portal-accent)',
                          }}
                        >
                          {
                            segment.value
                          }
                        </p>

                        <p
                          className="text-[10px] font-bold"
                          style={{
                            color:
                              'var(--portal-text-muted)',
                          }}
                        >
                          {segment.percentage.toFixed(
                            1,
                          )}
                          %
                        </p>
                      </div>
                    </div>

                    <div
                      className="mt-3 h-1.5 overflow-hidden rounded-full"
                      style={{
                        background:
                          'var(--portal-border)',
                      }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(
                            100,
                            segment.percentage,
                          )}%`,
                          background:
                            'var(--portal-accent)',
                        }}
                      />
                    </div>
                  </div>
                ),
              )}
            </div>
          </section>

          {/* GROWTH */}
          <section
            className="rounded-2xl border p-5"
            style={{
              borderColor:
                'var(--portal-border)',
              background:
                'var(--portal-surface)',
            }}
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <TrendingUp
                    size={17}
                    style={{
                      color:
                        'var(--portal-accent)',
                    }}
                  />

                  <h2 className="text-sm font-black">
                    Customer Growth
                  </h2>
                </div>

                <p
                  className="mt-1 text-xs"
                  style={{
                    color:
                      'var(--portal-text-muted)',
                  }}
                >
                  New customers based on their first-ever order.
                </p>
              </div>

              <BarChart3
                size={17}
                style={{
                  color:
                    'var(--portal-text-muted)',
                }}
              />
            </div>

            <div className="mt-8 flex h-56 items-end gap-2 sm:gap-3">
              {growthBuckets.map(
                (bucket) => {
                  const height =
                    (bucket.value /
                      maxGrowth) *
                    100;

                  return (
                    <div
                      key={`${bucket.start.toISOString()}-${bucket.index}`}
                      className="flex h-full min-w-0 flex-1 flex-col items-center gap-2"
                    >
                      <div className="flex h-full w-full items-end">
                        <div
                          className="w-full rounded-t-lg transition-all"
                          style={{
                            height: `${Math.max(
                              bucket.value >
                                0
                                ? 5
                                : 1,
                              height,
                            )}%`,
                            background:
                              'var(--portal-accent)',
                            opacity: 0.75,
                          }}
                          title={`${bucket.value} new customer${bucket.value === 1 ? '' : 's'}`}
                        />
                      </div>

                      <span
                        className="max-w-full truncate text-[9px] font-bold"
                        style={{
                          color:
                            'var(--portal-text-muted)',
                        }}
                      >
                        {bucket.label}
                      </span>
                    </div>
                  );
                },
              )}
            </div>

            <div
              className="mt-5 flex items-center justify-between border-t pt-4"
              style={{
                borderColor:
                  'var(--portal-border)',
              }}
            >
              <span
                className="text-[10px] font-black uppercase tracking-[0.14em]"
                style={{
                  color:
                    'var(--portal-text-muted)',
                }}
              >
                Growth vs previous period
              </span>

              <span
                className="inline-flex items-center gap-1 text-xs font-black"
                style={{
                  color:
                    customerGrowth >= 0
                      ? 'var(--portal-accent)'
                      : '#ef4444',
                }}
              >
                {customerGrowth >=
                0 ? (
                  <ArrowUpRight
                    size={13}
                  />
                ) : (
                  <ArrowDownRight
                    size={13}
                  />
                )}

                {formatPercent(
                  customerGrowth,
                )}
              </span>
            </div>
          </section>
        </div>

        {/* TOP CUSTOMERS */}
        <section
          className="overflow-hidden rounded-2xl border"
          style={{
            borderColor:
              'var(--portal-border)',
            background:
              'var(--portal-surface)',
          }}
        >
          <div
            className="flex flex-col gap-3 border-b px-5 py-5 sm:flex-row sm:items-center sm:justify-between"
            style={{
              borderColor:
                'var(--portal-border)',
            }}
          >
            <div>
              <div className="flex items-center gap-2">
                <Sparkles
                  size={17}
                  style={{
                    color:
                      'var(--portal-accent)',
                  }}
                />

                <h2 className="text-sm font-black">
                  Top Customers
                </h2>
              </div>

              <p
                className="mt-1 text-xs"
                style={{
                  color:
                    'var(--portal-text-muted)',
                }}
              >
                Highest customer spending during the selected period.
              </p>
            </div>

            <div
              className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em]"
              style={{
                color:
                  'var(--portal-text-muted)',
              }}
            >
              <ShoppingBag size={13} />
              By customer spend
            </div>
          </div>

          {topCustomers.length ===
          0 ? (
            <div className="px-6 py-12 text-center">
              <Users
                size={22}
                className="mx-auto"
                style={{
                  color:
                    'var(--portal-accent)',
                }}
              />

              <p className="mt-3 text-sm font-black">
                No identifiable customers in this period
              </p>

              <p
                className="mt-1 text-xs"
                style={{
                  color:
                    'var(--portal-text-muted)',
                }}
              >
                Customer names are required to build customer-level analytics.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[650px] text-left">
                <thead>
                  <tr
                    className="border-b text-[10px] font-black uppercase tracking-[0.15em]"
                    style={{
                      borderColor:
                        'var(--portal-border)',
                      color:
                        'var(--portal-text-muted)',
                    }}
                  >
                    <th className="px-5 py-4">
                      Customer
                    </th>

                    <th className="px-5 py-4">
                      Phone
                    </th>

                    <th className="px-5 py-4">
                      Address
                    </th>

                    <th className="px-5 py-4">
                      Orders
                    </th>

                    <th className="px-5 py-4">
                      Total Spend
                    </th>

                    <th className="px-5 py-4">
                      Avg. Order
                    </th>

                    <th className="px-5 py-4">
                      First Order
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {topCustomers.map(
                    (
                      customer,
                      index,
                    ) => {
                      const average =
                        customer.totalSpend /
                        Math.max(
                          1,
                          customer.orders.length,
                        );

                      return (
                        <tr
                          key={
                            customer.key
                          }
                          className="border-b last:border-b-0"
                          style={{
                            borderColor:
                              'var(--portal-border)',
                          }}
                        >
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div
                                className="flex h-9 w-9 items-center justify-center rounded-full text-[10px] font-black"
                                style={{
                                  color:
                                    'var(--portal-accent)',
                                  background:
                                    'var(--portal-accent-soft)',
                                }}
                              >
                                #
                                {index +
                                  1}
                              </div>

                              <div>
                                <p className="text-xs font-black">
                                  {
                                    customer.name
                                  }
                                </p>

                                <p
                                  className="mt-0.5 text-[10px]"
                                  style={{
                                    color:
                                      'var(--portal-text-muted)',
                                  }}
                                >
                                  {customer.address || 'Customer'}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="px-5 py-4 text-xs">
                            {customer.phone || '—'}
                          </td>

                          <td className="max-w-[240px] px-5 py-4 text-xs">
                            <span className="block truncate" title={customer.address}>
                              {customer.address || '—'}
                            </span>
                          </td>

                          <td className="px-5 py-4 text-xs font-black">
                            {
                              customer
                                .orders
                                .length
                            }
                          </td>

                          <td
                            className="px-5 py-4 text-xs font-black"
                            style={{
                              color:
                                'var(--portal-accent)',
                            }}
                          >
                            {formatMoney(
                              customer.totalSpend,
                              currency,
                            )}
                          </td>

                          <td
                            className="px-5 py-4 text-xs font-bold"
                            style={{
                              color:
                                'var(--portal-text-muted)',
                            }}
                          >
                            {formatMoney(
                              average,
                              currency,
                            )}
                          </td>

                          <td
                            className="px-5 py-4 text-xs font-bold"
                            style={{
                              color:
                                'var(--portal-text-muted)',
                            }}
                          >
                            {new Date(
                              customer.firstOrderAt,
                            ).toLocaleDateString()}
                          </td>
                        </tr>
                      );
                    },
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* INSIGHTS */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <InsightCard
            icon={UserRoundPlus}
            label="Customer Growth"
            value={formatPercent(
              customerGrowth,
            )}
            detail="New customers vs previous period"
          />

          <InsightCard
            icon={Repeat2}
            label="Repeat Behavior"
            value={`${repeatRate.toFixed(1)}%`}
            detail="Customers placed 2+ orders"
          />

          <InsightCard
            icon={ShoppingBag}
            label="Orders / Customer"
            value={averageOrdersPerCustomer.toFixed(
              2,
            )}
            detail="Average tracked orders per customer"
          />

          <InsightCard
            icon={TrendingUp}
            label="Average Order Value"
            value={formatMoney(
              averageCustomerOrderValue,
              currency,
            )}
            detail="Average tracked order value"
          />
        </div>

        {/* RECOMMENDATION */}
        <section
          className="rounded-2xl border p-5"
          style={{
            borderColor:
              'var(--portal-border)',
            background:
              'var(--portal-surface)',
          }}
        >
          <div className="flex items-center gap-2">
            <Sparkles
              size={17}
              style={{
                color:
                  'var(--portal-accent)',
              }}
            />

            <h2 className="text-sm font-black">
              Customer Insight
            </h2>
          </div>

          <div
            className="mt-5 rounded-xl border p-4"
            style={{
              borderColor:
                'var(--portal-border)',
              background:
                'var(--portal-background)',
            }}
          >
            <p className="text-sm font-black">
              {totalCustomers === 0
                ? 'There is not enough identifiable customer activity in this period yet.'
                : repeatRate >= 50
                  ? 'Your customer base shows strong repeat-order behavior.'
                  : newCustomers.length >
                      returningCustomers.length
                    ? 'You are attracting more first-time customers than repeat customers. Converting those new customers into a second order is the biggest opportunity.'
                    : 'Focus on encouraging customers to return and place their next order.'}
            </p>

            <p
              className="mt-2 max-w-3xl text-xs leading-6"
              style={{
                color:
                  'var(--portal-text-muted)',
              }}
            >
              {totalCustomers === 0
                ? 'Once customers place orders with a customer name, NOVAMENU can build customer-level activity and retention analytics.'
                : `During ${periodLabel.toLowerCase()}, ${newCustomers.length} customers placed their first-ever order, while ${returningCustomers.length} customers placed at least two orders.`}
            </p>
          </div>

          <div
            className="mt-4 flex items-center gap-2 text-[10px] font-bold"
            style={{
              color:
                'var(--portal-text-muted)',
            }}
          >
            <Activity
              size={13}
              style={{
                color:
                  'var(--portal-accent)',
              }}
            />

            Real-time customer analytics from NOVAMENU order data.
          </div>
        </section>

        {/* DATA STATUS */}
        <div
          className="flex flex-col gap-2 rounded-xl border px-4 py-3 text-[10px] font-bold sm:flex-row sm:items-center sm:justify-between"
          style={{
            borderColor:
              'var(--portal-border)',
            background:
              'var(--portal-surface)',
            color:
              'var(--portal-text-muted)',
          }}
        >
          <div className="flex items-center gap-2">
            <span
              className="h-2 w-2 rounded-full"
              style={{
                background:
                  '#22c55e',
              }}
            />

            Live customer report
          </div>

          <div>
            {lastUpdated
              ? `Last updated ${lastUpdated.toLocaleTimeString()}`
              : 'Updating...'}
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  detail,
  positive,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  detail: string;
  positive?: boolean;
}) {
  return (
    <div
      className="rounded-2xl border p-5"
      style={{
        borderColor:
          'var(--portal-border)',
        background:
          'var(--portal-surface)',
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{
            color:
              'var(--portal-accent)',
            background:
              'var(--portal-accent-soft)',
          }}
        >
          <Icon size={18} />
        </div>

        {positive !== undefined && (
          <span
            className="inline-flex items-center gap-1 text-[10px] font-black"
            style={{
              color:
                positive
                  ? 'var(--portal-accent)'
                  : '#ef4444',
            }}
          >
            {positive ? (
              <ArrowUpRight
                size={11}
              />
            ) : (
              <ArrowDownRight
                size={11}
              />
            )}

            {positive
              ? 'Growing'
              : 'Down'}
          </span>
        )}
      </div>

      <p
        className="mt-5 text-[10px] font-black uppercase tracking-[0.16em]"
        style={{
          color:
            'var(--portal-text-muted)',
        }}
      >
        {label}
      </p>

      <p className="mt-2 text-2xl font-black tracking-tight">
        {value}
      </p>

      <p
        className="mt-1 text-[11px]"
        style={{
          color:
            'var(--portal-text-muted)',
        }}
      >
        {detail}
      </p>
    </div>
  );
}

function InsightCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div
      className="rounded-2xl border p-5"
      style={{
        borderColor:
          'var(--portal-border)',
        background:
          'var(--portal-surface)',
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl"
          style={{
            color:
              'var(--portal-accent)',
            background:
              'var(--portal-accent-soft)',
          }}
        >
          <Icon size={16} />
        </div>

        <span
          className="text-lg font-black"
          style={{
            color:
              'var(--portal-accent)',
          }}
        >
          {value}
        </span>
      </div>

      <p className="mt-4 text-xs font-black">
        {label}
      </p>

      <p
        className="mt-1 text-[10px] leading-5"
        style={{
          color:
            'var(--portal-text-muted)',
        }}
      >
        {detail}
      </p>
    </div>
  );
}

function normalizeCustomerPhone(
  value: string | null | undefined,
) {
  return String(value || '').replace(/\D/g, '');
}