'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ListOrdered,
  RefreshCw,
  ShoppingBag,
  Timer,
  TrendingUp,
  XCircle,
} from 'lucide-react';

import {
  getReportsData,
  type ReportOrder,
} from '@/lib/reports/data';
import ReportDateRangePicker from '@/components/report-date-range-picker';

type Period =
  | '7 days'
  | '30 days'
  | '90 days'
  | '12 months'
  | 'custom';

type ChartPoint = {
  label: string;
  value: number;
  start: Date;
  end: Date;
};

type OrderStage =
  | 'new'
  | 'preparing'
  | 'ready'
  | 'delivered'
  | 'cancelled'
  | 'other';

const periods: Period[] = [
  '7 days',
  '30 days',
  '90 days',
  '12 months',
];

function normalizeStatus(status: string) {
  return status.trim().toLowerCase();
}

/**
 * Maps database statuses to the actual stages used by
 * Order Management.
 *
 * Order Management:
 * New → Preparing → Ready → Delivered
 */
function getOrderStage(status: string): OrderStage {
  const normalized = normalizeStatus(status);

  switch (normalized) {
    case 'new':
      return 'new';

    case 'preparing':
    case 'processing':
    case 'in progress':
    case 'in_progress':
      return 'preparing';

    case 'ready':
    case 'ready for pickup':
    case 'ready_for_pickup':
      return 'ready';

    case 'delivered':
    case 'completed':
    case 'complete':
      return 'delivered';

    case 'cancelled':
    case 'canceled':
    case 'rejected':
    case 'declined':
    case 'voided':
      return 'cancelled';

    default:
      return 'other';
  }
}

function isCompleted(order: ReportOrder) {
  return getOrderStage(order.status) === 'delivered';
}

function isCancelled(order: ReportOrder) {
  return getOrderStage(order.status) === 'cancelled';
}

function isPending(order: ReportOrder) {
  const stage = getOrderStage(order.status);

  return (
    stage === 'new' ||
    stage === 'preparing' ||
    stage === 'ready'
  );
}

/**
 * IMPORTANT:
 * Always use the real order_number from the database.
 *
 * Example:
 * order_number = 1002
 * displayed as #1002
 */
function formatOrderNumber(order: ReportOrder) {
  if (
    order.order_number !== null &&
    order.order_number !== undefined
  ) {
    return `#${order.order_number}`;
  }

  return '—';
}

function getStageLabel(stage: OrderStage) {
  switch (stage) {
    case 'new':
      return 'New';

    case 'preparing':
      return 'Preparing';

    case 'ready':
      return 'Ready';

    case 'delivered':
      return 'Delivered';

    case 'cancelled':
      return 'Cancelled';

    default:
      return 'Other';
  }
}

function getPeriodDays(period: Period) {
  switch (period) {
    case '7 days':
      return 7;

    case '30 days':
      return 30;

    case '90 days':
      return 90;

    case '12 months':
      return 365;

    default:
      return 7;
  }
}

function getChartMode(period: Period) {
  switch (period) {
    case '7 days':
      return 'daily';

    case '30 days':
      return 'daily';

    case '90 days':
      return 'weekly';

    case '12 months':
      return 'monthly';

    default:
      return 'daily';
  }
}

function startOfDay(date: Date) {
  const result = new Date(date);

  result.setHours(0, 0, 0, 0);

  return result;
}

function addDays(date: Date, days: number) {
  const result = new Date(date);

  result.setDate(result.getDate() + days);

  return result;
}

function startOfWeek(date: Date) {
  const result = startOfDay(date);
  const day = result.getDay();

  const diff = day === 0 ? -6 : 1 - day;

  result.setDate(result.getDate() + diff);

  return result;
}

function addWeeks(date: Date, weeks: number) {
  return addDays(date, weeks * 7);
}

function startOfMonth(date: Date) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    1,
  );
}

function addMonths(date: Date, months: number) {
  return new Date(
    date.getFullYear(),
    date.getMonth() + months,
    1,
  );
}

function getPeriodRange(period: Period, customFrom?: string, customTo?: string) {
  const now = new Date();

  if (period === 'custom' && customFrom && customTo) {
    const currentStart = new Date(`${customFrom}T00:00:00`);
    const currentEnd = new Date(`${customTo}T00:00:00`);
    currentEnd.setDate(currentEnd.getDate() + 1);
    const duration = currentEnd.getTime() - currentStart.getTime();
    return {
      currentStart,
      currentEnd,
      previousStart: new Date(currentStart.getTime() - duration),
      previousEnd: currentStart,
    };
  }

  if (period === '12 months') {
    const currentMonth = startOfMonth(now);

    const currentStart = addMonths(
      currentMonth,
      -11,
    );

    const currentEnd = addMonths(
      currentMonth,
      1,
    );

    const previousStart = addMonths(
      currentStart,
      -12,
    );

    const previousEnd = currentStart;

    return {
      currentStart,
      currentEnd,
      previousStart,
      previousEnd,
    };
  }

  const days = getPeriodDays(period);

  const today = startOfDay(now);

  const currentStart = addDays(
    today,
    -(days - 1),
  );

  const currentEnd = addDays(
    today,
    1,
  );

  const previousStart = addDays(
    currentStart,
    -days,
  );

  const previousEnd = currentStart;

  return {
    currentStart,
    currentEnd,
    previousStart,
    previousEnd,
  };
}

function isWithinRange(
  date: Date,
  start: Date,
  end: Date,
) {
  return date >= start && date < end;
}

function formatCurrency(
  value: number,
  currency: string,
) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency || 'USD',
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency || 'USD'} ${value.toFixed(2)}`;
  }
}

function formatNumber(value: number) {
  return new Intl.NumberFormat().format(value);
}

function formatPercentage(value: number) {
  return `${value.toFixed(1)}%`;
}

function formatHour(hour: number | null) {
  if (hour === null) {
    return '—';
  }

  const date = new Date();

  date.setHours(hour, 0, 0, 0);

  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function getDayLabel(date: Date) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
  }).format(date);
}

function getShortDateLabel(date: Date) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function getMonthLabel(date: Date) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function buildDailyChart(
  orders: ReportOrder[],
  start: Date,
  end: Date,
): ChartPoint[] {
  const points: ChartPoint[] = [];

  let cursor = startOfDay(start);

  while (cursor < end) {
    const bucketStart = new Date(cursor);
    const bucketEnd = addDays(bucketStart, 1);

    const value = orders.filter((order) => {
      const created = new Date(order.created_at);

      return isWithinRange(
        created,
        bucketStart,
        bucketEnd,
      );
    }).length;

    points.push({
      label: getShortDateLabel(bucketStart),
      value,
      start: bucketStart,
      end: bucketEnd,
    });

    cursor = bucketEnd;
  }

  return points;
}

function buildWeeklyChart(
  orders: ReportOrder[],
  start: Date,
  end: Date,
): ChartPoint[] {
  const points: ChartPoint[] = [];

  let cursor = startOfWeek(start);

  while (cursor < end) {
    const bucketStart = new Date(cursor);
    const bucketEnd = addWeeks(bucketStart, 1);

    const value = orders.filter((order) => {
      const created = new Date(order.created_at);

      return isWithinRange(
        created,
        bucketStart,
        bucketEnd,
      );
    }).length;

    points.push({
      label: getShortDateLabel(bucketStart),
      value,
      start: bucketStart,
      end: bucketEnd,
    });

    cursor = bucketEnd;
  }

  return points;
}

function buildMonthlyChart(
  orders: ReportOrder[],
  start: Date,
  end: Date,
): ChartPoint[] {
  const points: ChartPoint[] = [];

  let cursor = startOfMonth(start);

  while (cursor < end) {
    const bucketStart = new Date(cursor);

    const bucketEnd = addMonths(
      bucketStart,
      1,
    );

    const value = orders.filter((order) => {
      const created = new Date(order.created_at);

      return isWithinRange(
        created,
        bucketStart,
        bucketEnd,
      );
    }).length;

    points.push({
      label: getMonthLabel(bucketStart),
      value,
      start: bucketStart,
      end: bucketEnd,
    });

    cursor = bucketEnd;
  }

  return points;
}

function buildOrderChart(
  orders: ReportOrder[],
  start: Date,
  end: Date,
  period: Period,
) {
  const mode = getChartMode(period);

  if (mode === 'monthly') {
    return buildMonthlyChart(
      orders,
      start,
      end,
    );
  }

  if (mode === 'weekly') {
    return buildWeeklyChart(
      orders,
      start,
      end,
    );
  }

  return buildDailyChart(
    orders,
    start,
    end,
  );
}

function getTrendPercentage(
  current: number,
  previous: number,
) {
  if (previous === 0) {
    return current === 0 ? 0 : 100;
  }

  return (
    ((current - previous) / previous) *
    100
  );
}

function formatTrend(value: number) {
  if (value === 0) {
    return '0%';
  }

  const sign = value > 0 ? '+' : '';

  return `${sign}${value.toFixed(1)}%`;
}

function escapeCsv(value: string | number) {
  const stringValue = String(value);

  if (
    stringValue.includes(',') ||
    stringValue.includes('"') ||
    stringValue.includes('\n')
  ) {
    return `"${stringValue.replaceAll('"', '""')}"`;
  }

  return stringValue;
}

function formatDateTime(value: string) {
  const date = new Date(value);

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function getStatusBadgeStyle(
  stage: OrderStage,
) {
  switch (stage) {
    case 'delivered':
      return {
        background:
          'var(--portal-accent-soft)',
        color: 'var(--portal-accent)',
        borderColor:
          'var(--portal-accent)',
      };

    case 'cancelled':
      return {
        background:
          'color-mix(in srgb, var(--portal-text) 8%, transparent)',
        color: 'var(--portal-text)',
        borderColor:
          'var(--portal-border)',
      };

    default:
      return {
        background:
          'color-mix(in srgb, var(--portal-accent) 8%, transparent)',
        color: 'var(--portal-text)',
        borderColor:
          'var(--portal-border)',
      };
  }
}

export default function OrdersReportPage() {
  const [period, setPeriod] =
    useState<Period>('7 days');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const [orders, setOrders] =
    useState<ReportOrder[]>([]);

  const [currency, setCurrency] =
    useState('USD');

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const [reloadKey, setReloadKey] =
    useState(0);

  const [hoveredBar, setHoveredBar] =
    useState<number | null>(null);

  useEffect(() => {
    let active = true;

    async function loadReports() {
      try {
        setLoading(true);
        setError(null);

        const data = await getReportsData();

        if (!active) {
          return;
        }

        if (!data) {
          setError(
            'Could not identify the current restaurant.',
          );
          return;
        }

        setOrders(data.orders || []);

        setCurrency(
          data.restaurant.currency || 'USD',
        );
      } catch (err) {
        console.error(
          'Orders report loading error:',
          err,
        );

        if (active) {
          setError(
            'Could not load order reports. Please try again.',
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadReports();

    return () => {
      active = false;
    };
  }, [reloadKey]);

  const range = useMemo(
    () => getPeriodRange(period, customFrom, customTo),
    [period, customFrom, customTo],
  );

  const currentOrders = useMemo(
    () =>
      orders.filter((order) =>
        isWithinRange(
          new Date(order.created_at),
          range.currentStart,
          range.currentEnd,
        ),
      ),
    [orders, range],
  );

  const previousOrders = useMemo(
    () =>
      orders.filter((order) =>
        isWithinRange(
          new Date(order.created_at),
          range.previousStart,
          range.previousEnd,
        ),
      ),
    [orders, range],
  );

  const stageCounts = useMemo(() => {
    const counts: Record<
      OrderStage,
      number
    > = {
      new: 0,
      preparing: 0,
      ready: 0,
      delivered: 0,
      cancelled: 0,
      other: 0,
    };

    currentOrders.forEach((order) => {
      const stage = getOrderStage(
        order.status,
      );

      counts[stage] += 1;
    });

    return counts;
  }, [currentOrders]);

  const previousStageCounts = useMemo(() => {
    const counts: Record<
      OrderStage,
      number
    > = {
      new: 0,
      preparing: 0,
      ready: 0,
      delivered: 0,
      cancelled: 0,
      other: 0,
    };

    previousOrders.forEach((order) => {
      const stage = getOrderStage(
        order.status,
      );

      counts[stage] += 1;
    });

    return counts;
  }, [previousOrders]);

  const totalOrders =
    currentOrders.length;

  const completedCount =
    stageCounts.delivered;

  const pendingCount =
    stageCounts.new +
    stageCounts.preparing +
    stageCounts.ready;

  const cancelledCount =
    stageCounts.cancelled;

  const otherCount =
    stageCounts.other;

  const completionRate =
    totalOrders > 0
      ? (completedCount / totalOrders) * 100
      : 0;

  const cancellationRate =
    totalOrders > 0
      ? (cancelledCount / totalOrders) * 100
      : 0;

  const totalRevenue =
    currentOrders
      .filter(isCompleted)
      .reduce(
        (sum, order) =>
          sum + Number(order.total || 0),
        0,
      );

  const averageOrderValue =
    completedCount > 0
      ? totalRevenue / completedCount
      : 0;

  const previousTotalOrders =
    previousOrders.length;

  const previousCompletedCount =
    previousStageCounts.delivered;

  const previousCancelledCount =
    previousStageCounts.cancelled;

  const previousPendingCount =
    previousStageCounts.new +
    previousStageCounts.preparing +
    previousStageCounts.ready;

  const totalOrdersTrend =
    getTrendPercentage(
      totalOrders,
      previousTotalOrders,
    );

  const completedTrend =
    getTrendPercentage(
      completedCount,
      previousCompletedCount,
    );

  const pendingTrend =
    getTrendPercentage(
      pendingCount,
      previousPendingCount,
    );

  const cancelledTrend =
    getTrendPercentage(
      cancelledCount,
      previousCancelledCount,
    );

  const chartData = useMemo(
    () =>
      buildOrderChart(
        currentOrders,
        range.currentStart,
        range.currentEnd,
        period,
      ),
    [
      currentOrders,
      range,
      period,
    ],
  );

  const maxOrders = Math.max(
    ...chartData.map(
      (item) => item.value,
    ),
    1,
  );

  const peakOrderHour = useMemo(() => {
    if (currentOrders.length === 0) {
      return null;
    }

    const counts = Array.from(
      { length: 24 },
      () => 0,
    );

    currentOrders.forEach((order) => {
      const hour = new Date(
        order.created_at,
      ).getHours();

      counts[hour] += 1;
    });

    let peakHour = 0;

    for (let hour = 1; hour < 24; hour += 1) {
      if (
        counts[hour] >
        counts[peakHour]
      ) {
        peakHour = hour;
      }
    }

    return counts[peakHour] > 0
      ? peakHour
      : null;
  }, [currentOrders]);

  const hourlyData = useMemo(() => {
    const counts = Array.from(
      { length: 24 },
      () => 0,
    );

    currentOrders.forEach((order) => {
      const hour = new Date(
        order.created_at,
      ).getHours();

      counts[hour] += 1;
    });

    return counts;
  }, [currentOrders]);

  const peakOrderDay = useMemo(() => {
    if (currentOrders.length === 0) {
      return null;
    }

    const counts = new Map<
      string,
      number
    >();

    currentOrders.forEach((order) => {
      const date = new Date(
        order.created_at,
      );

      const key = [
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
      ].join('-');

      counts.set(
        key,
        (counts.get(key) || 0) + 1,
      );
    });

    let peakDate: Date | null = null;
    let peakCount = 0;

    currentOrders.forEach((order) => {
      const date = new Date(
        order.created_at,
      );

      const key = [
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
      ].join('-');

      const count =
        counts.get(key) || 0;

      if (count > peakCount) {
        peakCount = count;
        peakDate = startOfDay(date);
      }
    });

    return peakDate;
  }, [currentOrders]);

  const averageDailyOrders =
    useMemo(() => {
      if (totalOrders === 0) {
        return 0;
      }

      if (period === '12 months') {
        return totalOrders / 365;
      }

      return (
        totalOrders /
        getPeriodDays(period)
      );
    }, [totalOrders, period]);

  const topPeriods = useMemo(() => {
    return [...chartData]
      .sort(
        (a, b) => b.value - a.value,
      )
      .slice(0, 5);
  }, [chartData]);

  const latestOrders = useMemo(() => {
    return [...currentOrders]
      .sort(
        (a, b) =>
          new Date(
            b.created_at,
          ).getTime() -
          new Date(
            a.created_at,
          ).getTime(),
      )
      .slice(0, 10);
  }, [currentOrders]);

  function handleExport() {
    if (currentOrders.length === 0) {
      return;
    }

    const sortedOrders = [
      ...currentOrders,
    ].sort(
      (a, b) =>
        new Date(
          b.created_at,
        ).getTime() -
        new Date(
          a.created_at,
        ).getTime(),
    );

    const header = [
      'Order',
      'Status',
      'Created At',
      'Total',
    ];

    const rows = sortedOrders.map(
      (order) => [
        formatOrderNumber(order),
        getStageLabel(
          getOrderStage(order.status),
        ),
        new Date(
          order.created_at,
        ).toISOString(),
        Number(order.total || 0).toFixed(
          2,
        ),
      ],
    );

    const csv = [
      header,
      ...rows,
    ]
      .map((row) =>
        row
          .map(escapeCsv)
          .join(','),
      )
      .join('\n');

    const blob = new Blob(
      [`\uFEFF${csv}`],
      {
        type: 'text/csv;charset=utf-8;',
      },
    );

    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement('a');

    link.href = url;

    link.download = `novamenu-orders-${period
      .replaceAll(' ', '-')
      .toLowerCase()}.csv`;

    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }

  const mappedOrders =
    totalOrders - otherCount;

  const reconciliationComplete =
    otherCount === 0;

  return (
    <div
      className="min-h-screen px-4 pb-8 sm:px-6 sm:pb-10 lg:px-8 lg:pb-12"
      style={{
        background:
          'var(--portal-background)',
        color: 'var(--portal-text)',
      }}
    >
      <div className="mx-auto max-w-[1600px] space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div
              className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em]"
              style={{
                color:
                  'var(--portal-accent)',
              }}
            >
              <Activity
                className="h-3.5 w-3.5"
                strokeWidth={2.5}
              />
              Reports / Orders
            </div>

            <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
              Order Analytics
            </h1>

            <p
              className="mt-2 max-w-2xl text-sm"
              style={{
                color:
                  'var(--portal-text-muted)',
              }}
            >
              Understand order volume, operational
              stages, delivery performance, and
              customer ordering patterns.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div
              className="flex items-center gap-1 rounded-xl border p-1"
              style={{
                borderColor:
                  'var(--portal-border)',
                background:
                  'var(--portal-surface)',
              }}
            >
              {periods.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() =>
                    setPeriod(item)
                  }
                  className="rounded-lg px-3 py-2 text-xs font-bold transition"
                  style={
                    period === item
                      ? {
                          background:
                            'var(--portal-accent)',
                          color: 'white',
                        }
                      : {
                          color:
                            'var(--portal-text-muted)',
                        }
                  }
                >
                  {item}
                </button>
              ))}
            </div>
            <ReportDateRangePicker
              period={period}
              onPeriodChange={(value) => setPeriod(value as Period)}
              from={customFrom}
              to={customTo}
              onFromChange={setCustomFrom}
              onToChange={setCustomTo}
            />

          </div>
        </div>

        {/* Error */}
        {error && (
          <div
            className="rounded-2xl border p-5"
            style={{
              borderColor:
                'var(--portal-border)',
              background:
                'var(--portal-surface)',
            }}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-black">
                  Unable to load order reports
                </p>

                <p
                  className="mt-1 text-sm"
                  style={{
                    color:
                      'var(--portal-text-muted)',
                  }}
                >
                  {error}
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setReloadKey(
                    (value) =>
                      value + 1,
                  )
                }
                className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black"
                style={{
                  background:
                    'var(--portal-accent)',
                  color: 'white',
                }}
              >
                <RefreshCw className="h-4 w-4" />
                Retry
              </button>
            </div>
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={<ShoppingBag className="h-5 w-5" />}
            label="Total Orders"
            value={
              loading
                ? '—'
                : formatNumber(totalOrders)
            }
            description="Orders in selected period"
            trend={
              loading
                ? null
                : totalOrdersTrend
            }
          />

          <MetricCard
            icon={
              <CheckCircle2 className="h-5 w-5" />
            }
            label="Delivered"
            value={
              loading
                ? '—'
                : formatNumber(
                    completedCount,
                  )
            }
            description="Orders reaching Delivered"
            trend={
              loading
                ? null
                : completedTrend
            }
          />

          <MetricCard
            icon={
              <Timer className="h-5 w-5" />
            }
            label="In Progress"
            value={
              loading
                ? '—'
                : formatNumber(
                    pendingCount,
                  )
            }
            description="New + Preparing + Ready"
            trend={
              loading
                ? null
                : pendingTrend
            }
          />

          <MetricCard
            icon={
              <TrendingUp className="h-5 w-5" />
            }
            label="Completion Rate"
            value={
              loading
                ? '—'
                : formatPercentage(
                    completionRate,
                  )
            }
            description="Delivered / total orders"
            trend={null}
          />
        </div>

        {/* Order Status Flow */}
        <section
          className="rounded-2xl border p-5 sm:p-6"
          style={{
            borderColor:
              'var(--portal-border)',
            background:
              'var(--portal-surface)',
          }}
        >
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <ListOrdered
                  className="h-5 w-5"
                  style={{
                    color:
                      'var(--portal-accent)',
                  }}
                />

                <h2 className="text-base font-black">
                  Order Status Flow
                </h2>
              </div>

              <p
                className="mt-1 text-xs"
                style={{
                  color:
                    'var(--portal-text-muted)',
                }}
              >
                Directly aligned with Order Management:
                New → Preparing → Ready → Delivered.
              </p>
            </div>

            <div
              className="text-xs font-bold"
              style={{
                color:
                  reconciliationComplete
                    ? 'var(--portal-accent)'
                    : 'var(--portal-text-muted)',
              }}
            >
              {reconciliationComplete
                ? `${formatNumber(mappedOrders)} / ${formatNumber(totalOrders)} orders mapped`
                : `${formatNumber(otherCount)} order(s) need status mapping`}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <StageCard
              label="New"
              count={stageCounts.new}
              total={totalOrders}
            />

            <StageCard
              label="Preparing"
              count={
                stageCounts.preparing
              }
              total={totalOrders}
            />

            <StageCard
              label="Ready"
              count={stageCounts.ready}
              total={totalOrders}
            />

            <StageCard
              label="Delivered"
              count={
                stageCounts.delivered
              }
              total={totalOrders}
              highlight
            />

            <StageCard
              label="Cancelled"
              count={
                stageCounts.cancelled
              }
              total={totalOrders}
            />
          </div>

          {otherCount > 0 && (
            <div
              className="mt-3 rounded-xl border px-4 py-3 text-xs"
              style={{
                borderColor:
                  'var(--portal-border)',
                color:
                  'var(--portal-text-muted)',
              }}
            >
              <strong
                style={{
                  color:
                    'var(--portal-text)',
                }}
              >
                Other / Unknown:
              </strong>{' '}
              {formatNumber(otherCount)} order(s)
              have a status that is not currently
              mapped to an Order Management stage.
            </div>
          )}
        </section>

        {/* Chart */}
        <section
          className="rounded-2xl border p-5 sm:p-6"
          style={{
            borderColor:
              'var(--portal-border)',
            background:
              'var(--portal-surface)',
          }}
        >
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <BarChart3
                  className="h-5 w-5"
                  style={{
                    color:
                      'var(--portal-accent)',
                  }}
                />

                <h2 className="text-base font-black">
                  Order Volume
                </h2>
              </div>

              <p
                className="mt-1 text-xs"
                style={{
                  color:
                    'var(--portal-text-muted)',
                }}
              >
                {period === '90 days'
                  ? 'Weekly'
                  : period === '12 months'
                    ? 'Monthly'
                    : 'Daily'}{' '}
                order volume.
              </p>
            </div>

            <div className="text-right">
              <div
                className="text-2xl font-black"
                style={{
                  color:
                    'var(--portal-accent)',
                }}
              >
                {loading
                  ? '—'
                  : formatNumber(
                      totalOrders,
                    )}
              </div>

              <div
                className="text-[10px] font-bold uppercase tracking-wider"
                style={{
                  color:
                    'var(--portal-text-muted)',
                }}
              >
                Total orders
              </div>
            </div>
          </div>

          <div
            className="relative h-72"
            onMouseLeave={() =>
              setHoveredBar(null)
            }
          >
            <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
              {[4, 3, 2, 1, 0].map(
                (index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3"
                  >
                    <span
                      className="w-8 text-right text-[10px] font-bold"
                      style={{
                        color:
                          'var(--portal-text-muted)',
                      }}
                    >
                      {Math.round(
                        (maxOrders *
                          index) /
                          4,
                      )}
                    </span>

                    <div
                      className="h-px flex-1"
                      style={{
                        background:
                          'var(--portal-border)',
                      }}
                    />
                  </div>
                ),
              )}
            </div>

            <div className="absolute inset-x-12 inset-y-0 flex items-end gap-1 sm:gap-2">
              {loading
                ? Array.from({
                    length: period ===
                      '12 months'
                      ? 12
                      : period === '90 days'
                        ? 13
                        : period ===
                            '30 days'
                          ? 30
                          : 7,
                  }).map((_, index) => (
                    <div
                      key={index}
                      className="flex h-full min-w-0 flex-1 items-end"
                    >
                      <div
                        className="w-full animate-pulse rounded-t-lg"
                        style={{
                          height: `${25 + ((index * 17) % 45)}%`,
                          background:
                            'var(--portal-border)',
                        }}
                      />
                    </div>
                  ))
                : chartData.map(
                    (item, index) => {
                      const height =
                        item.value === 0
                          ? 2
                          : Math.max(
                              (item.value /
                                maxOrders) *
                                100,
                              4,
                            );

                      const share =
                        totalOrders >
                        0
                          ? (item.value /
                              totalOrders) *
                            100
                          : 0;

                      const isHovered =
                        hoveredBar ===
                        index;

                      return (
                        <div
                          key={`${item.label}-${index}`}
                          className="relative flex h-full min-w-0 flex-1 items-end"
                          onMouseEnter={() =>
                            setHoveredBar(
                              index,
                            )
                          }
                        >
                          {isHovered && (
                            <div
                              className="absolute bottom-[calc(100%+10px)] left-1/2 z-20 w-44 -translate-x-1/2 rounded-xl border p-3 text-xs shadow-2xl"
                              style={{
                                background:
                                  'var(--portal-surface)',
                                borderColor:
                                  'var(--portal-border)',
                              }}
                            >
                              <div className="font-black">
                                {item.label}
                              </div>

                              <div
                                className="mt-2 flex justify-between gap-3"
                                style={{
                                  color:
                                    'var(--portal-text-muted)',
                                }}
                              >
                                <span>
                                  Orders
                                </span>

                                <strong
                                  style={{
                                    color:
                                      'var(--portal-text)',
                                  }}
                                >
                                  {formatNumber(
                                    item.value,
                                  )}
                                </strong>
                              </div>

                              <div
                                className="mt-1 flex justify-between gap-3"
                                style={{
                                  color:
                                    'var(--portal-text-muted)',
                                }}
                              >
                                <span>
                                  Share
                                </span>

                                <strong
                                  style={{
                                    color:
                                      'var(--portal-text)',
                                  }}
                                >
                                  {formatPercentage(
                                    share,
                                  )}
                                </strong>
                              </div>
                            </div>
                          )}

                          <div
                            className="w-full rounded-t-lg transition-all duration-200"
                            style={{
                              height: `${height}%`,
                              minHeight:
                                item.value >
                                0
                                  ? '4px'
                                  : '2px',
                              background:
                                isHovered
                                  ? 'var(--portal-accent)'
                                  : 'var(--portal-accent-soft)',
                              opacity:
                                isHovered
                                  ? 1
                                  : 0.8,
                              boxShadow:
                                isHovered
                                  ? '0 0 24px color-mix(in srgb, var(--portal-accent) 35%, transparent)'
                                  : 'none',
                            }}
                          />
                        </div>
                      );
                    },
                  )}
            </div>

            {!loading && (
              <div className="absolute inset-x-12 bottom-[-24px] flex gap-1 sm:gap-2">
                {chartData.map(
                  (item, index) => (
                    <div
                      key={`${item.label}-axis-${index}`}
                      className="min-w-0 flex-1 truncate text-center text-[9px] font-bold"
                      style={{
                        color:
                          'var(--portal-text-muted)',
                      }}
                    >
                      {item.label}
                    </div>
                  ),
                )}
              </div>
            )}
          </div>
        </section>

        {/* Top Periods + Operational Snapshot */}
        <div className="grid gap-6 xl:grid-cols-2">
          <section
            className="rounded-2xl border p-5 sm:p-6"
            style={{
              borderColor:
                'var(--portal-border)',
              background:
                'var(--portal-surface)',
            }}
          >
            <div className="mb-5">
              <div className="flex items-center gap-2">
                <TrendingUp
                  className="h-5 w-5"
                  style={{
                    color:
                      'var(--portal-accent)',
                  }}
                />

                <h2 className="text-base font-black">
                  Top Activity Periods
                </h2>
              </div>

              <p
                className="mt-1 text-xs"
                style={{
                  color:
                    'var(--portal-text-muted)',
                }}
              >
                Highest-volume periods in the
                selected range.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[500px] text-left">
                <thead>
                  <tr
                    className="border-b text-[10px] font-black uppercase tracking-wider"
                    style={{
                      borderColor:
                        'var(--portal-border)',
                      color:
                        'var(--portal-text-muted)',
                    }}
                  >
                    <th className="pb-3">
                      Period
                    </th>

                    <th className="pb-3 text-right">
                      Orders
                    </th>

                    <th className="pb-3 text-right">
                      Share
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {topPeriods.map(
                    (item, index) => (
                      <tr
                        key={`${item.label}-${index}`}
                        className="border-b last:border-0"
                        style={{
                          borderColor:
                            'var(--portal-border)',
                        }}
                      >
                        <td className="py-3 text-xs font-bold">
                          {item.label}
                        </td>

                        <td className="py-3 text-right text-xs font-black">
                          {formatNumber(
                            item.value,
                          )}
                        </td>

                        <td
                          className="py-3 text-right text-xs"
                          style={{
                            color:
                              'var(--portal-text-muted)',
                          }}
                        >
                          {formatPercentage(
                            totalOrders >
                              0
                              ? (item.value /
                                  totalOrders) *
                                  100
                              : 0,
                          )}
                        </td>
                      </tr>
                    ),
                  )}

                  {!loading &&
                    topPeriods.length ===
                      0 && (
                      <tr>
                        <td
                          colSpan={3}
                          className="py-8 text-center text-xs"
                          style={{
                            color:
                              'var(--portal-text-muted)',
                          }}
                        >
                          No order activity in
                          this period.
                        </td>
                      </tr>
                    )}
                </tbody>
              </table>
            </div>
          </section>

          <section
            className="rounded-2xl border p-5 sm:p-6"
            style={{
              borderColor:
                'var(--portal-border)',
              background:
                'var(--portal-surface)',
            }}
          >
            <div className="mb-5">
              <div className="flex items-center gap-2">
                <Activity
                  className="h-5 w-5"
                  style={{
                    color:
                      'var(--portal-accent)',
                  }}
                />

                <h2 className="text-base font-black">
                  Operational Snapshot
                </h2>
              </div>

              <p
                className="mt-1 text-xs"
                style={{
                  color:
                    'var(--portal-text-muted)',
                }}
              >
                Key order-performance indicators.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <SnapshotCard
                icon={
                  <ShoppingBag className="h-4 w-4" />
                }
                label="Average order"
                value={
                  loading
                    ? '—'
                    : formatCurrency(
                        averageOrderValue,
                        currency,
                      )
                }
              />

              <SnapshotCard
                icon={
                  <Clock3 className="h-4 w-4" />
                }
                label="Peak hour"
                value={
                  loading
                    ? '—'
                    : formatHour(
                        peakOrderHour,
                      )
                }
              />

              <SnapshotCard
                icon={
                  <CalendarDays className="h-4 w-4" />
                }
                label="Peak day"
                value={
                  loading
                    ? '—'
                    : peakOrderDay
                      ? getDayLabel(
                          peakOrderDay,
                        )
                      : '—'
                }
              />

              <SnapshotCard
                icon={
                  <Activity className="h-4 w-4" />
                }
                label="Average / day"
                value={
                  loading
                    ? '—'
                    : averageDailyOrders.toFixed(
                        1,
                      )
                }
              />
            </div>

            <div
              className="mt-4 flex items-center justify-between rounded-xl border px-4 py-3"
              style={{
                borderColor:
                  'var(--portal-border)',
                background:
                  'color-mix(in srgb, var(--portal-accent) 4%, transparent)',
              }}
            >
              <div>
                <div className="text-xs font-black">
                  Cancellation rate
                </div>

                <div
                  className="mt-1 text-[10px]"
                  style={{
                    color:
                      'var(--portal-text-muted)',
                  }}
                >
                  Cancelled / total orders
                </div>
              </div>

              <div className="text-lg font-black">
                {loading
                  ? '—'
                  : formatPercentage(
                      cancellationRate,
                    )}
              </div>
            </div>
          </section>
        </div>

        {/* Hourly Activity */}
        <section
          className="rounded-2xl border p-5 sm:p-6"
          style={{
            borderColor:
              'var(--portal-border)',
            background:
              'var(--portal-surface)',
          }}
        >
          <div className="mb-5 flex items-center gap-2">
            <Clock3
              className="h-5 w-5"
              style={{
                color:
                  'var(--portal-accent)',
              }}
            />

            <div>
              <h2 className="text-base font-black">
                Order Activity by Hour
              </h2>

              <p
                className="mt-1 text-xs"
                style={{
                  color:
                    'var(--portal-text-muted)',
                }}
              >
                When orders are arriving throughout
                the day.
              </p>
            </div>
          </div>

          <div className="grid h-44 grid-cols-24 items-end gap-1">
            {hourlyData.map(
              (value, hour) => {
                const maxHourly =
                  Math.max(
                    ...hourlyData,
                    1,
                  );

                const height =
                  value === 0
                    ? 3
                    : Math.max(
                        (value /
                          maxHourly) *
                          100,
                        5,
                      );

                return (
                  <div
                    key={hour}
                    className="group relative flex h-full min-w-0 items-end"
                  >
                    <div
                      className="absolute bottom-[calc(100%+8px)] left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-lg border px-2 py-1.5 text-[10px] font-bold group-hover:block"
                      style={{
                        background:
                          'var(--portal-surface)',
                        borderColor:
                          'var(--portal-border)',
                      }}
                    >
                      {formatHour(hour)} ·{' '}
                      {value} orders
                    </div>

                    <div
                      className="w-full rounded-t-md transition-all group-hover:opacity-100"
                      style={{
                        height: `${height}%`,
                        background:
                          hour ===
                          peakOrderHour
                            ? 'var(--portal-accent)'
                            : 'var(--portal-accent-soft)',
                        opacity:
                          hour ===
                          peakOrderHour
                            ? 1
                            : 0.65,
                      }}
                    />
                  </div>
                );
              },
            )}
          </div>

          <div className="mt-2 grid grid-cols-6 text-[9px] font-bold">
            {[0, 4, 8, 12, 16, 20].map(
              (hour) => (
                <span
                  key={hour}
                  style={{
                    color:
                      'var(--portal-text-muted)',
                  }}
                >
                  {formatHour(hour)}
                </span>
              ),
            )}
          </div>
        </section>

        {/* Recent Orders */}
        <section
          className="rounded-2xl border p-5 sm:p-6"
          style={{
            borderColor:
              'var(--portal-border)',
            background:
              'var(--portal-surface)',
          }}
        >
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <ListOrdered
                  className="h-5 w-5"
                  style={{
                    color:
                      'var(--portal-accent)',
                  }}
                />

                <h2 className="text-base font-black">
                  Latest Orders
                </h2>
              </div>

              <p
                className="mt-1 text-xs"
                style={{
                  color:
                    'var(--portal-text-muted)',
                }}
              >
                Most recent orders in the selected
                period.
              </p>
            </div>

            <div
              className="hidden text-xs font-bold sm:block"
              style={{
                color:
                  'var(--portal-text-muted)',
              }}
            >
              Showing {Math.min(
                latestOrders.length,
                10,
              )}{' '}
              of {formatNumber(totalOrders)}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr
                  className="border-b text-left text-[10px] font-black uppercase tracking-wider"
                  style={{
                    borderColor:
                      'var(--portal-border)',
                    color:
                      'var(--portal-text-muted)',
                  }}
                >
                  <th className="pb-3">
                    Order
                  </th>

                  <th className="pb-3">
                    Status
                  </th>

                  <th className="pb-3">
                    Date
                  </th>

                  <th className="pb-3 text-right">
                    Total
                  </th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  Array.from({
                    length: 5,
                  }).map((_, index) => (
                    <tr
                      key={index}
                      className="border-b last:border-0"
                      style={{
                        borderColor:
                          'var(--portal-border)',
                      }}
                    >
                      <td
                        colSpan={4}
                        className="py-4"
                      >
                        <div
                          className="h-5 animate-pulse rounded-lg"
                          style={{
                            background:
                              'var(--portal-border)',
                          }}
                        />
                      </td>
                    </tr>
                  ))
                ) : latestOrders.length ===
                  0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-12 text-center text-xs"
                      style={{
                        color:
                          'var(--portal-text-muted)',
                      }}
                    >
                      No orders found in this
                      period.
                    </td>
                  </tr>
                ) : (
                  latestOrders.map(
                    (order) => {
                      const stage =
                        getOrderStage(
                          order.status,
                        );

                      const badgeStyle =
                        getStatusBadgeStyle(
                          stage,
                        );

                      return (
                        <tr
                          key={order.id}
                          className="border-b transition-colors last:border-0"
                          style={{
                            borderColor:
                              'var(--portal-border)',
                          }}
                        >
                          <td className="py-4">
                            <div className="font-mono text-sm font-black">
                              {formatOrderNumber(
                                order,
                              )}
                            </div>
                          </td>

                          <td className="py-4">
                            <span
                              className="inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider"
                              style={
                                badgeStyle
                              }
                            >
                              {getStageLabel(
                                stage,
                              )}
                            </span>
                          </td>

                          <td
                            className="py-4 text-xs"
                            style={{
                              color:
                                'var(--portal-text-muted)',
                            }}
                          >
                            {formatDateTime(
                              order.created_at,
                            )}
                          </td>

                          <td className="py-4 text-right text-sm font-black">
                            {formatCurrency(
                              Number(
                                order.total ||
                                  0,
                              ),
                              currency,
                            )}
                          </td>
                        </tr>
                      );
                    },
                  )
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Period Comparison */}
        <section
          className="rounded-2xl border p-5 sm:p-6"
          style={{
            borderColor:
              'var(--portal-border)',
            background:
              'var(--portal-surface)',
          }}
        >
          <div className="mb-5">
            <div className="flex items-center gap-2">
              <Activity
                className="h-5 w-5"
                style={{
                  color:
                    'var(--portal-accent)',
                }}
              />

              <h2 className="text-base font-black">
                Period Comparison
              </h2>
            </div>

            <p
              className="mt-1 text-xs"
              style={{
                color:
                  'var(--portal-text-muted)',
              }}
            >
              Current period compared with the
              immediately preceding period.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <ComparisonCard
              label="Total orders"
              current={totalOrders}
              previous={
                previousTotalOrders
              }
              trend={totalOrdersTrend}
            />

            <ComparisonCard
              label="Delivered"
              current={completedCount}
              previous={
                previousCompletedCount
              }
              trend={completedTrend}
            />

            <ComparisonCard
              label="In progress"
              current={pendingCount}
              previous={
                previousPendingCount
              }
              trend={pendingTrend}
            />

            <ComparisonCard
              label="Cancelled"
              current={cancelledCount}
              previous={
                previousCancelledCount
              }
              trend={cancelledTrend}
            />
          </div>
        </section>

        {/* Footer data note */}
        <div
          className="flex flex-col gap-2 rounded-xl border px-4 py-3 text-[10px] font-bold sm:flex-row sm:items-center sm:justify-between"
          style={{
            borderColor:
              'var(--portal-border)',
            color:
              'var(--portal-text-muted)',
          }}
        >
          <span>
            Report period: {period}
          </span>

          <span>
            {formatNumber(
              orders.length,
            )}{' '}
            total order records loaded
          </span>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  description,
  trend,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  description: string;
  trend: number | null;
}) {
  const trendPositive =
    trend !== null && trend >= 0;

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
      <div className="flex items-start justify-between gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{
            background:
              'var(--portal-accent-soft)',
            color:
              'var(--portal-accent)',
          }}
        >
          {icon}
        </div>

        {trend !== null && (
          <div
            className="flex items-center gap-1 text-[10px] font-black"
            style={{
              color:
                'var(--portal-accent)',
            }}
          >
            {trendPositive ? (
              <ArrowUpRight className="h-3.5 w-3.5" />
            ) : (
              <ArrowDownRight className="h-3.5 w-3.5" />
            )}

            {formatTrend(trend)}
          </div>
        )}
      </div>

      <div className="mt-5">
        <div
          className="text-[10px] font-black uppercase tracking-[0.16em]"
          style={{
            color:
              'var(--portal-text-muted)',
          }}
        >
          {label}
        </div>

        <div className="mt-1 text-2xl font-black tracking-tight">
          {value}
        </div>

        <div
          className="mt-1 text-[11px]"
          style={{
            color:
              'var(--portal-text-muted)',
          }}
        >
          {description}
        </div>
      </div>
    </div>
  );
}

function StageCard({
  label,
  count,
  total,
  highlight = false,
}: {
  label: string;
  count: number;
  total: number;
  highlight?: boolean;
}) {
  const percentage =
    total > 0
      ? (count / total) * 100
      : 0;

  return (
    <div
      className="rounded-xl border p-4"
      style={{
        borderColor:
          highlight
            ? 'var(--portal-accent)'
            : 'var(--portal-border)',
        background:
          highlight
            ? 'color-mix(in srgb, var(--portal-accent) 5%, transparent)'
            : 'transparent',
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-black">
          {label}
        </span>

        <span
          className="text-[10px] font-bold"
          style={{
            color:
              'var(--portal-text-muted)',
          }}
        >
          {formatPercentage(
            percentage,
          )}
        </span>
      </div>

      <div className="mt-3 text-2xl font-black">
        {formatNumber(count)}
      </div>

      <div
        className="mt-3 h-1.5 overflow-hidden rounded-full"
        style={{
          background:
            'var(--portal-border)',
        }}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${percentage}%`,
            background:
              'var(--portal-accent)',
          }}
        />
      </div>
    </div>
  );
}

function SnapshotCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div
      className="rounded-xl border p-4"
      style={{
        borderColor:
          'var(--portal-border)',
      }}
    >
      <div
        className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider"
        style={{
          color:
            'var(--portal-text-muted)',
        }}
      >
        <span
          style={{
            color:
              'var(--portal-accent)',
          }}
        >
          {icon}
        </span>

        {label}
      </div>

      <div className="mt-2 text-lg font-black">
        {value}
      </div>
    </div>
  );
}

function ComparisonCard({
  label,
  current,
  previous,
  trend,
}: {
  label: string;
  current: number;
  previous: number;
  trend: number;
}) {
  const positive = trend >= 0;

  return (
    <div
      className="rounded-xl border p-4"
      style={{
        borderColor:
          'var(--portal-border)',
      }}
    >
      <div
        className="text-[10px] font-black uppercase tracking-wider"
        style={{
          color:
            'var(--portal-text-muted)',
        }}
      >
        {label}
      </div>

      <div className="mt-2 flex items-end justify-between gap-3">
        <div className="text-xl font-black">
          {formatNumber(current)}
        </div>

        <div
          className="flex items-center gap-1 text-[10px] font-black"
          style={{
            color:
              'var(--portal-accent)',
          }}
        >
          {positive ? (
            <ArrowUpRight className="h-3.5 w-3.5" />
          ) : (
            <ArrowDownRight className="h-3.5 w-3.5" />
          )}

          {formatTrend(trend)}
        </div>
      </div>

      <div
        className="mt-1 text-[10px]"
        style={{
          color:
            'var(--portal-text-muted)',
        }}
      >
        Previous: {formatNumber(previous)}
      </div>
    </div>
  );
}