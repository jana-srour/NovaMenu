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
  Maximize2,
  Minimize2,
  ShoppingBag,
  Trophy,
  X,
  XCircle,
} from 'lucide-react';

import {
  getReportsData,
  type ReportOrder,
  type ReportsData,
} from '@/lib/reports/data';
import ReportDateRangePicker from '@/components/report-date-range-picker';

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

type Period = '7 days' | '30 days' | '90 days' | '12 months' | 'custom';

type RevenuePoint = {
  key: string;
  label: string;
  tooltipLabel: string;
  value: number;
  orders: number;
  showLabel: boolean;
};

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

const PERIODS: Period[] = [
  '7 days',
  '30 days',
  '90 days',
  '12 months',
];

const EXCLUDED_STATUSES = new Set([
  'cancelled',
  'canceled',
  'rejected',
  'declined',
]);

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function isCompletedOrder(order: ReportOrder) {
  return !EXCLUDED_STATUSES.has(
    String(order.status || '').toLowerCase()
  );
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
      return 30;
  }
}

function getRangeForPeriod(period: Period, customFrom?: string, customTo?: string) {
  const now = new Date();
  const from = new Date(now);
  if (period === 'custom' && customFrom && customTo) {
    const customStart = new Date(`${customFrom}T00:00:00`);
    const customEnd = new Date(`${customTo}T00:00:00`);
    customEnd.setDate(customEnd.getDate() + 1);
    return { from: customStart.toISOString(), to: customEnd.toISOString() };
  }

  if (period === '12 months') {
    from.setDate(from.getDate() - 365);
  } else {
    from.setDate(
      from.getDate() -
        getPeriodDays(
          period === 'custom' ? '30 days' : period,
        )
    );
  }

  return {
    from: from.toISOString(),
    to: now.toISOString(),
  };
}

function startOfDay(date: Date) {
  const result = new Date(date);

  result.setHours(0, 0, 0, 0);

  return result;
}

function startOfWeek(date: Date) {
  const result = startOfDay(date);
  const day = result.getDay();

  // Monday = 0
  const diff = day === 0 ? 6 : day - 1;

  result.setDate(
    result.getDate() - diff
  );

  return result;
}

function startOfMonth(date: Date) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    1
  );
}

function formatMoney(
  value: number,
  currency: string
) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency || 'USD',
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${
      currency || ''
    }`.trim();
  }
}

function formatCompactMoney(
  value: number,
  currency: string
) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency || 'USD',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value);
  } catch {
    return `${value.toFixed(0)} ${
      currency || ''
    }`.trim();
  }
}

function formatNumber(value: number) {
  return new Intl.NumberFormat().format(value);
}

function formatShortDate(date: Date) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function formatDayLabel(date: Date) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
  }).format(date);
}

function formatMonthLabel(date: Date) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
  }).format(date);
}

function getRevenue(
  orders: ReportOrder[]
) {
  return orders
    .filter(isCompletedOrder)
    .reduce(
      (sum, order) =>
        sum + Number(order.total || 0),
      0
    );
}

function getPeriodLabel(
  period: Period
) {
  switch (period) {
    case '7 days':
      return 'Last 7 days';

    case '30 days':
      return 'Last 30 days';

    case '90 days':
      return 'Last 90 days';

    case '12 months':
      return 'Last 12 months';
  }
}

/* -------------------------------------------------------------------------- */
/* Chart builders                                                             */
/* -------------------------------------------------------------------------- */

function buildDailyRevenueData(
  orders: ReportOrder[],
  days: number
): RevenuePoint[] {
  const completed = orders.filter(
    isCompletedOrder
  );

  const now = new Date();
  const points: RevenuePoint[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const date = startOfDay(
      new Date(now)
    );

    date.setDate(
      date.getDate() - i
    );

    const key = date
      .toISOString()
      .slice(0, 10);

    const matchingOrders =
      completed.filter((order) => {
        const orderDate = startOfDay(
          new Date(order.created_at)
        );

        return (
          orderDate.getTime() ===
          date.getTime()
        );
      });

    const value =
      matchingOrders.reduce(
        (sum, order) =>
          sum + Number(order.total || 0),
        0
      );

    points.push({
      key,

      label:
        days <= 7
          ? formatDayLabel(date)
          : formatShortDate(date),

      tooltipLabel:
        new Intl.DateTimeFormat(
          undefined,
          {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          }
        ).format(date),

      value,

      orders:
        matchingOrders.length,

      showLabel:
        days <= 30,
    });
  }

  return points;
}

function buildWeeklyRevenueData(
  orders: ReportOrder[]
): RevenuePoint[] {
  const completed = orders.filter(
    isCompletedOrder
  );

  const now = new Date();
  const currentWeek =
    startOfWeek(now);

  const points: RevenuePoint[] = [];

  for (let i = 12; i >= 0; i--) {
    const weekStart =
      new Date(currentWeek);

    weekStart.setDate(
      weekStart.getDate() -
        i * 7
    );

    const weekEnd =
      new Date(weekStart);

    weekEnd.setDate(
      weekEnd.getDate() + 7
    );

    const matchingOrders =
      completed.filter((order) => {
        const date = new Date(
          order.created_at
        );

        return (
          date >= weekStart &&
          date < weekEnd
        );
      });

    const value =
      matchingOrders.reduce(
        (sum, order) =>
          sum + Number(order.total || 0),
        0
      );

    points.push({
      key:
        weekStart.toISOString(),

      label:
        formatShortDate(
          weekStart
        ),

      tooltipLabel:
        `Week of ${new Intl.DateTimeFormat(
          undefined,
          {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          }
        ).format(weekStart)}`,

      value,

      orders:
        matchingOrders.length,

      showLabel: true,
    });
  }

  return points;
}

function buildMonthlyRevenueData(
  orders: ReportOrder[]
): RevenuePoint[] {
  const completed = orders.filter(
    isCompletedOrder
  );

  const now = new Date();
  const points: RevenuePoint[] = [];

  for (let i = 11; i >= 0; i--) {
    const monthStart =
      startOfMonth(
        new Date(
          now.getFullYear(),
          now.getMonth() - i,
          1
        )
      );

    const monthEnd =
      startOfMonth(
        new Date(
          now.getFullYear(),
          now.getMonth() - i + 1,
          1
        )
      );

    const matchingOrders =
      completed.filter((order) => {
        const date = new Date(
          order.created_at
        );

        return (
          date >= monthStart &&
          date < monthEnd
        );
      });

    const value =
      matchingOrders.reduce(
        (sum, order) =>
          sum + Number(order.total || 0),
        0
      );

    points.push({
      key:
        monthStart.toISOString(),

      label:
        formatMonthLabel(
          monthStart
        ),

      tooltipLabel:
        new Intl.DateTimeFormat(
          undefined,
          {
            month: 'long',
            year: 'numeric',
          }
        ).format(monthStart),

      value,

      orders:
        matchingOrders.length,

      showLabel: true,
    });
  }

  return points;
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function SalesReportPage() {
  const [period, setPeriod] =
    useState<Period>('30 days');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const [data, setData] =
    useState<ReportsData | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const [expanded, setExpanded] =
    useState(false);

  const [reloadKey, setReloadKey] =
    useState(0);

  /* ------------------------------------------------------------------------ */
  /* Load data                                                                */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const range =
          getRangeForPeriod(period, customFrom, customTo);

        const result =
          await getReportsData(range);

        if (!active) {
          return;
        }

        setData(result);
      } catch (err) {
        console.error(
          'Sales report loading failed:',
          err
        );

        if (!active) {
          return;
        }

        setError(
          err instanceof Error
            ? err.message
            : 'Could not load sales report.'
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [period, reloadKey, customFrom, customTo]);

  /* ------------------------------------------------------------------------ */
  /* Escape fullscreen                                                        */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    if (!expanded) {
      document.body.style.overflow = '';
      return;
    }

    document.body.style.overflow =
      'hidden';

    const handleKeyDown = (
      event: KeyboardEvent
    ) => {
      if (event.key === 'Escape') {
        setExpanded(false);
      }
    };

    window.addEventListener(
      'keydown',
      handleKeyDown
    );

    return () => {
      document.body.style.overflow =
        '';

      window.removeEventListener(
        'keydown',
        handleKeyDown
      );
    };
  }, [expanded]);

  /* ------------------------------------------------------------------------ */
  /* Derived metrics                                                          */
  /* ------------------------------------------------------------------------ */

  const completedOrders = useMemo(
    () =>
      data?.orders.filter(
        isCompletedOrder
      ) || [],
    [data]
  );

  const cancelledOrders = useMemo(
    () =>
      data?.orders.filter((order) =>
        EXCLUDED_STATUSES.has(
          String(
            order.status || ''
          ).toLowerCase()
        )
      ) || [],
    [data]
  );

  const totalRevenue = useMemo(
    () =>
      getRevenue(
        completedOrders
      ),
    [completedOrders]
  );

  const totalOrders =
    completedOrders.length;

  const averageOrder =
    totalOrders > 0
      ? totalRevenue /
        totalOrders
      : 0;

  /* ------------------------------------------------------------------------ */
  /* Chart data                                                               */
  /* ------------------------------------------------------------------------ */

  const chartData = useMemo(() => {
    if (!data) {
      return [];
    }

    if (period === '7 days') {
      return buildDailyRevenueData(
        data.orders,
        7
      );
    }

    if (period === '30 days') {
      return buildDailyRevenueData(
        data.orders,
        30
      );
    }

    if (period === '90 days') {
      return buildWeeklyRevenueData(
        data.orders
      );
    }

    return buildMonthlyRevenueData(
      data.orders
    );
  }, [data, period]);

  /* ------------------------------------------------------------------------ */
  /* Chart calculations                                                       */
  /* ------------------------------------------------------------------------ */

  const maxRevenue = useMemo(() => {
    const max = Math.max(
      ...chartData.map(
        (point) => point.value
      ),
      0
    );

    return max > 0 ? max : 1;
  }, [chartData]);

  const peakPoint = useMemo(() => {
    if (
      chartData.length === 0
    ) {
      return null;
    }

    return chartData.reduce(
      (best, current) =>
        current.value >
        best.value
          ? current
          : best,
      chartData[0]
    );
  }, [chartData]);

  /* ------------------------------------------------------------------------ */
  /* Performance table                                                        */
  /* ------------------------------------------------------------------------ */

  const performanceRows =
    useMemo(() => {
      if (
        chartData.length === 0
      ) {
        return [];
      }

      return [...chartData]
        .sort(
          (a, b) =>
            b.value - a.value
        )
        .slice(0, 5)
        .map((point) => ({
          ...point,

          average:
            point.orders > 0
              ? point.value /
                point.orders
              : 0,

          share:
            totalRevenue > 0
              ? (point.value /
                  totalRevenue) *
                100
              : 0,
        }));
    }, [chartData, totalRevenue]);

  /* ------------------------------------------------------------------------ */
  /* Render chart                                                             */
  /* ------------------------------------------------------------------------ */

  function renderChart(
    fullscreen = false
  ) {
    const chartHeight =
      fullscreen
        ? 'h-full min-h-0'
        : 'h-[300px] sm:h-[340px]';

    return (
      <div
        className={`relative ${chartHeight} w-full min-w-0 overflow-visible`}
      >
        {/* ------------------------------------------------------------------ */}
        {/* Y axis + grid                                                      */}
        {/* ------------------------------------------------------------------ */}

        <div className="pointer-events-none absolute inset-0">
          {[1, 0.75, 0.5, 0.25, 0].map(
            (ratio) => (
              <div
                key={ratio}
                className="absolute left-0 right-0 flex items-center"
                style={{
                  top: `${
                    (1 - ratio) *
                    100
                  }%`,
                }}
              >
                <div className="w-[68px] shrink-0 pr-3 text-right text-[10px] font-semibold tabular-nums text-[var(--portal-text-muted)]">
                  {formatCompactMoney(
                    maxRevenue *
                      ratio,
                    data?.restaurant
                      .currency ||
                      'USD'
                  )}
                </div>

                <div className="h-px flex-1 bg-[var(--portal-border)] opacity-60" />
              </div>
            )
          )}
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* Bars                                                               */}
        {/* ------------------------------------------------------------------ */}

        <div className="absolute inset-y-0 left-[68px] right-0 overflow-visible pb-8 pt-3">
          <div
            className="grid h-full w-full items-end gap-1 sm:gap-2"
            style={{
              gridTemplateColumns: `repeat(${Math.max(
                chartData.length,
                1
              )}, minmax(0, 1fr))`,
            }}
          >
            {chartData.map(
              (
                point,
                index
              ) => {
                const height =
                  point.value === 0
                    ? 3
                    : Math.max(
                        5,
                        (point.value /
                          maxRevenue) *
                          100
                      );

                const isFirst =
                  index === 0;

                const isLast =
                  index ===
                  chartData.length -
                    1;

                const revenueShare =
                  totalRevenue >
                  0
                    ? (point.value /
                        totalRevenue) *
                      100
                    : 0;

                const averageForPoint =
                  point.orders >
                  0
                    ? point.value /
                      point.orders
                    : 0;

                return (
                  <div
                    key={
                      point.key
                    }
                    className="group relative flex h-full min-w-0 items-end justify-center overflow-visible outline-none"
                    tabIndex={
                      fullscreen
                        ? -1
                        : 0
                    }
                  >
                    {/* ---------------------------------------------------- */}
                    {/* Hover tooltip                                          */}
                    {/* ---------------------------------------------------- */}

                    {!fullscreen && (
                      <div
                        className={[
                          'pointer-events-none absolute bottom-full z-[60] mb-3 w-[235px] rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface)] p-3 text-left shadow-2xl opacity-0 transition-all duration-150',
                          'translate-y-1 group-hover:translate-y-0 group-hover:opacity-100',
                          'group-focus:translate-y-0 group-focus:opacity-100',

                          isFirst
                            ? 'left-0'
                            : isLast
                            ? 'right-0'
                            : 'left-1/2 -translate-x-1/2',
                        ]
                          .filter(
                            Boolean
                          )
                          .join(
                            ' '
                          )}
                      >
                        <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--portal-text-muted)]">
                          {
                            point.tooltipLabel
                          }
                        </div>

                        <div className="mb-3 text-lg font-black tabular-nums text-[var(--portal-text)]">
                          {formatMoney(
                            point.value,
                            data?.restaurant
                              .currency ||
                              'USD'
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="rounded-xl border border-[var(--portal-border)] bg-[var(--portal-background)] p-2">
                            <div className="text-[9px] font-bold uppercase tracking-wider text-[var(--portal-text-muted)]">
                              Orders
                            </div>

                            <div className="mt-1 text-sm font-bold tabular-nums text-[var(--portal-text)]">
                              {formatNumber(
                                point.orders
                              )}
                            </div>
                          </div>

                          <div className="rounded-xl border border-[var(--portal-border)] bg-[var(--portal-background)] p-2">
                            <div className="text-[9px] font-bold uppercase tracking-wider text-[var(--portal-text-muted)]">
                              Avg order
                            </div>

                            <div className="mt-1 text-sm font-bold tabular-nums text-[var(--portal-text)]">
                              {formatMoney(
                                averageForPoint,
                                data?.restaurant
                                  .currency ||
                                  'USD'
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="mt-2 flex items-center justify-between border-t border-[var(--portal-border)] pt-2 text-[10px]">
                          <span className="text-[var(--portal-text-muted)]">
                            Revenue share
                          </span>

                          <span className="font-bold tabular-nums text-[var(--portal-text)]">
                            {revenueShare.toFixed(
                              1
                            )}
                            %
                          </span>
                        </div>
                      </div>
                    )}

                    {/* ---------------------------------------------------- */}
                    {/* Bar                                                    */}
                    {/* ---------------------------------------------------- */}

                    <div
                      className="relative w-full max-w-[42px] overflow-visible rounded-t-xl border border-[var(--portal-accent)]/30 bg-[var(--portal-accent)]/20 transition-all duration-200 group-hover:bg-[var(--portal-accent)]/60 group-hover:shadow-[0_0_28px_var(--portal-accent-soft)] group-focus:bg-[var(--portal-accent)]/60"
                      style={{
                        height: `${height}%`,
                      }}
                    >
                      <div className="absolute inset-x-0 bottom-0 h-full rounded-t-xl bg-[var(--portal-accent)] opacity-60" />

                      <div className="absolute inset-x-0 top-0 h-1 rounded-full bg-[var(--portal-accent)] opacity-90" />
                    </div>

                    {/* ---------------------------------------------------- */}
                    {/* X axis label                                           */}
                    {/* ---------------------------------------------------- */}

                    <div className="absolute left-1/2 top-full mt-2 w-[55px] -translate-x-1/2 truncate text-center text-[9px] font-semibold text-[var(--portal-text-muted)]">
                      {
                        point.label
                      }
                    </div>
                  </div>
                );
              }
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Loading                                                                  */
  /* ------------------------------------------------------------------------ */

  if (loading) {
    return (
      <div
        className="space-y-6 px-4 pb-8 sm:px-6 sm:pb-10 lg:px-8 lg:pb-12"
        style={{
          color:
            'var(--portal-text)',
        }}
      >
        <div className="animate-pulse space-y-3">
          <div className="h-3 w-24 rounded bg-[var(--portal-border)]" />

          <div className="h-8 w-64 rounded bg-[var(--portal-border)]" />

          <div className="h-4 w-96 max-w-full rounded bg-[var(--portal-border)]" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({
            length: 4,
          }).map((_, index) => (
            <div
              key={index}
              className="h-28 animate-pulse rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface)]"
            />
          ))}
        </div>

        <div className="h-[430px] animate-pulse rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface)]" />
      </div>
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Error                                                                    */
  /* ------------------------------------------------------------------------ */

  if (error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div className="max-w-md rounded-2xl border border-red-500/20 bg-[var(--portal-surface)] p-6 text-center">
          <XCircle className="mx-auto mb-3 h-8 w-8 text-red-400" />

          <h2 className="text-lg font-black text-[var(--portal-text)]">
            Unable to load sales
          </h2>

          <p className="mt-2 text-sm text-[var(--portal-text-muted)]">
            {error}
          </p>

          <button
            type="button"
            onClick={() =>
              setReloadKey(
                (value) =>
                  value + 1
              )
            }
            className="mt-5 rounded-xl border border-[var(--portal-border)] px-4 py-2 text-xs font-bold text-[var(--portal-text)] transition hover:border-[var(--portal-accent)]"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Empty state                                                              */
  /* ------------------------------------------------------------------------ */

  if (!data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div className="text-center">
          <BarChart3 className="mx-auto mb-3 h-10 w-10 text-[var(--portal-text-muted)]" />

          <h2 className="text-lg font-black text-[var(--portal-text)]">
            No restaurant found
          </h2>
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Main page                                                                */
  /* ------------------------------------------------------------------------ */

  return (
    <>
      <main
        className="min-w-0 space-y-6 px-4 pb-8 sm:px-6 sm:pb-10 lg:px-8 lg:pb-12"
        style={{
          color:
            'var(--portal-text)',
        }}
      >
        {/* ------------------------------------------------------------------ */}
        {/* Header                                                             */}
        {/* ------------------------------------------------------------------ */}

        <section className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--portal-accent)]">
              <Activity className="h-3.5 w-3.5" />

              Sales intelligence
            </div>

            <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
              Sales & Revenue
            </h1>

            <p className="mt-2 max-w-2xl text-sm text-[var(--portal-text-muted)]">
              Track revenue performance,
              order volume, average
              order value and sales
              momentum.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-xl border border-[var(--portal-border)] bg-[var(--portal-surface)] p-1">
              <CalendarDays className="ml-2 h-4 w-4 text-[var(--portal-text-muted)]" />

              {PERIODS.map(
                (option) => (
                  <button
                    key={
                      option
                    }
                    type="button"
                    onClick={() =>
                      setPeriod(
                        option
                      )
                    }
                    className={`rounded-lg px-3 py-2 text-[11px] font-bold transition ${
                      period ===
                      option
                        ? 'bg-[var(--portal-accent)] text-white shadow-lg'
                        : 'text-[var(--portal-text-muted)] hover:bg-[var(--portal-background)] hover:text-[var(--portal-text)]'
                    }`}
                  >
                    {
                      option
                    }
                  </button>
                )
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

          </div>
        </section>

        {/* ------------------------------------------------------------------ */}
        {/* KPI cards                                                          */}
        {/* ------------------------------------------------------------------ */}

        <section className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {/* Revenue */}
          <div className="min-w-0 rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface)] p-5">
            <div className="flex items-center justify-between">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--portal-accent-soft)] text-[var(--portal-accent)]">
                <BarChart3 className="h-4 w-4" />
              </div>
            </div>

            <div className="mt-4 text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--portal-text-muted)]">
              Revenue
            </div>

            <div className="mt-1 truncate text-2xl font-black tabular-nums">
              {formatMoney(
                totalRevenue,
                data.restaurant
                  .currency
              )}
            </div>

            <div className="mt-1 text-[10px] text-[var(--portal-text-muted)]">
              {getPeriodLabel(
                period
              )}
            </div>
          </div>

          {/* Orders */}
          <div className="min-w-0 rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface)] p-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--portal-accent-soft)] text-[var(--portal-accent)]">
              <ShoppingBag className="h-4 w-4" />
            </div>

            <div className="mt-4 text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--portal-text-muted)]">
              Orders
            </div>

            <div className="mt-1 text-2xl font-black tabular-nums">
              {formatNumber(
                totalOrders
              )}
            </div>

            <div className="mt-1 text-[10px] text-[var(--portal-text-muted)]">
              Completed / valid
              orders
            </div>
          </div>

          {/* Average order */}
          <div className="min-w-0 rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface)] p-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--portal-accent-soft)] text-[var(--portal-accent)]">
              <Activity className="h-4 w-4" />
            </div>

            <div className="mt-4 text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--portal-text-muted)]">
              Average order
            </div>

            <div className="mt-1 text-2xl font-black tabular-nums">
              {formatMoney(
                averageOrder,
                data.restaurant
                  .currency
              )}
            </div>

            <div className="mt-1 text-[10px] text-[var(--portal-text-muted)]">
              Revenue ÷ completed
              orders
            </div>
          </div>

          {/* Cancelled */}
          <div className="min-w-0 rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface)] p-5">
            <div className="flex items-center justify-between">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-500/10 text-red-400">
                <XCircle className="h-4 w-4" />
              </div>

              {totalOrders >
                0 && (
                <span className="text-[10px] font-bold tabular-nums text-[var(--portal-text-muted)]">
                  {(
                    (cancelledOrders.length /
                      (totalOrders +
                        cancelledOrders.length)) *
                    100
                  ).toFixed(
                    1
                  )}
                  %
                </span>
              )}
            </div>

            <div className="mt-4 text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--portal-text-muted)]">
              Cancelled / rejected
            </div>

            <div className="mt-1 text-2xl font-black tabular-nums">
              {formatNumber(
                cancelledOrders.length
              )}
            </div>

            <div className="mt-1 text-[10px] text-[var(--portal-text-muted)]">
              Excluded from
              revenue
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------------ */}
        {/* Revenue chart                                                      */}
        {/* ------------------------------------------------------------------ */}

        <section className="min-w-0 overflow-visible rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface)]">
          <div className="flex flex-col gap-3 border-b border-[var(--portal-border)] p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-black">
                  Revenue performance
                </h2>

                <span className="rounded-full border border-[var(--portal-border)] px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-[var(--portal-text-muted)]">
                  {
                    period
                  }
                </span>
              </div>

              <p className="mt-1 text-[11px] text-[var(--portal-text-muted)]">
                Hover any bar for
                exact revenue, orders
                and average order
                value.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                setExpanded(
                  true
                )
              }
              className="inline-flex w-fit items-center gap-2 rounded-xl border border-[var(--portal-border)] bg-[var(--portal-background)] px-3 py-2 text-[11px] font-bold text-[var(--portal-text-muted)] transition hover:border-[var(--portal-accent)] hover:text-[var(--portal-text)]"
            >
              <Maximize2 className="h-3.5 w-3.5" />

              Expand chart
            </button>
          </div>

          <div className="min-w-0 overflow-visible p-5 pb-12">
            {chartData.length >
            0 ? (
              renderChart(
                false
              )
            ) : (
              <div className="flex h-[300px] items-center justify-center text-sm text-[var(--portal-text-muted)]">
                No sales data for
                this period.
              </div>
            )}
          </div>

          {/* Chart summary */}
          <div className="grid border-t border-[var(--portal-border)] sm:grid-cols-3">
            <div className="border-b border-[var(--portal-border)] p-4 sm:border-b-0 sm:border-r">
              <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-[var(--portal-text-muted)]">
                Peak period
              </div>

              <div className="mt-1 text-sm font-black">
                {peakPoint
                  ? peakPoint.label
                  : '—'}
              </div>

              {peakPoint && (
                <div className="mt-0.5 text-[10px] tabular-nums text-[var(--portal-text-muted)]">
                  {formatMoney(
                    peakPoint.value,
                    data.restaurant
                      .currency
                  )}
                </div>
              )}
            </div>

            <div className="border-b border-[var(--portal-border)] p-4 sm:border-b-0 sm:border-r">
              <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-[var(--portal-text-muted)]">
                Total revenue
              </div>

              <div className="mt-1 text-sm font-black tabular-nums">
                {formatMoney(
                  totalRevenue,
                  data.restaurant
                    .currency
                )}
              </div>

              <div className="mt-0.5 text-[10px] text-[var(--portal-text-muted)]">
                {getPeriodLabel(
                  period
                )}
              </div>
            </div>

            <div className="p-4">
              <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-[var(--portal-text-muted)]">
                Average order
              </div>

              <div className="mt-1 text-sm font-black tabular-nums">
                {formatMoney(
                  averageOrder,
                  data.restaurant
                    .currency
                )}
              </div>

              <div className="mt-0.5 text-[10px] text-[var(--portal-text-muted)]">
                Across{' '}
                {formatNumber(
                  totalOrders
                )}{' '}
                orders
              </div>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------------ */}
        {/* Performance breakdown table                                       */}
        {/* ------------------------------------------------------------------ */}

        <section className="min-w-0 overflow-hidden rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface)]">
          <div className="flex flex-col gap-3 border-b border-[var(--portal-border)] p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-[var(--portal-accent)]" />

                <h2 className="text-sm font-black">
                  Top-performing periods
                </h2>
              </div>

              <p className="mt-1 text-[11px] text-[var(--portal-text-muted)]">
                Highest-revenue periods in
                the selected reporting
                range.
              </p>
            </div>

            <div className="rounded-full border border-[var(--portal-border)] px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-[var(--portal-text-muted)]">
              Top 5
            </div>
          </div>

          {/* Desktop table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[700px] border-collapse">
              <thead>
                <tr className="border-b border-[var(--portal-border)]">
                  <th className="px-5 py-3 text-left text-[9px] font-bold uppercase tracking-[0.15em] text-[var(--portal-text-muted)]">
                    Period
                  </th>

                  <th className="px-5 py-3 text-right text-[9px] font-bold uppercase tracking-[0.15em] text-[var(--portal-text-muted)]">
                    Revenue
                  </th>

                  <th className="px-5 py-3 text-right text-[9px] font-bold uppercase tracking-[0.15em] text-[var(--portal-text-muted)]">
                    Orders
                  </th>

                  <th className="px-5 py-3 text-right text-[9px] font-bold uppercase tracking-[0.15em] text-[var(--portal-text-muted)]">
                    Avg order
                  </th>

                  <th className="px-5 py-3 text-right text-[9px] font-bold uppercase tracking-[0.15em] text-[var(--portal-text-muted)]">
                    Revenue share
                  </th>
                </tr>
              </thead>

              <tbody>
                {performanceRows.map(
                  (
                    row,
                    index
                  ) => (
                    <tr
                      key={
                        row.key
                      }
                      className="border-b border-[var(--portal-border)] last:border-b-0 transition hover:bg-[var(--portal-background)]"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--portal-accent-soft)] text-[10px] font-black text-[var(--portal-accent)]">
                            {index +
                              1}
                          </div>

                          <div>
                            <div className="text-xs font-bold text-[var(--portal-text)]">
                              {
                                row.label
                              }
                            </div>

                            <div className="mt-0.5 text-[9px] text-[var(--portal-text-muted)]">
                              {
                                row.tooltipLabel
                              }
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4 text-right">
                        <div className="text-xs font-black tabular-nums">
                          {formatMoney(
                            row.value,
                            data.restaurant
                              .currency
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-4 text-right">
                        <div className="text-xs font-bold tabular-nums">
                          {formatNumber(
                            row.orders
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-4 text-right">
                        <div className="text-xs font-bold tabular-nums">
                          {formatMoney(
                            row.average,
                            data.restaurant
                              .currency
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-4 text-right">
                        <div className="text-xs font-bold tabular-nums">
                          {row.share.toFixed(
                            1
                          )}
                          %
                        </div>

                        <div className="mt-1 ml-auto h-1.5 w-20 overflow-hidden rounded-full bg-[var(--portal-border)]">
                          <div
                            className="h-full rounded-full bg-[var(--portal-accent)]"
                            style={{
                              width: `${Math.min(
                                row.share,
                                100
                              )}%`,
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="divide-y divide-[var(--portal-border)] md:hidden">
            {performanceRows.map(
              (
                row,
                index
              ) => (
                <div
                  key={
                    row.key
                  }
                  className="p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--portal-accent-soft)] text-[10px] font-black text-[var(--portal-accent)]">
                        {index +
                          1}
                      </div>

                      <div className="min-w-0">
                        <div className="truncate text-xs font-bold">
                          {
                            row.label
                          }
                        </div>

                        <div className="mt-0.5 truncate text-[9px] text-[var(--portal-text-muted)]">
                          {
                            row.tooltipLabel
                          }
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <div className="text-xs font-black tabular-nums">
                        {formatMoney(
                          row.value,
                          data.restaurant
                            .currency
                        )}
                      </div>

                      <div className="mt-0.5 text-[9px] text-[var(--portal-text-muted)]">
                        {row.share.toFixed(
                          1
                        )}
                        % of revenue
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-[var(--portal-border)] bg-[var(--portal-background)] p-3">
                      <div className="text-[9px] font-bold uppercase tracking-wider text-[var(--portal-text-muted)]">
                        Orders
                      </div>

                      <div className="mt-1 text-sm font-black tabular-nums">
                        {formatNumber(
                          row.orders
                        )}
                      </div>
                    </div>

                    <div className="rounded-xl border border-[var(--portal-border)] bg-[var(--portal-background)] p-3">
                      <div className="text-[9px] font-bold uppercase tracking-wider text-[var(--portal-text-muted)]">
                        Avg order
                      </div>

                      <div className="mt-1 text-sm font-black tabular-nums">
                        {formatMoney(
                          row.average,
                          data.restaurant
                            .currency
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            )}
          </div>

          {performanceRows.length ===
            0 && (
            <div className="p-8 text-center text-sm text-[var(--portal-text-muted)]">
              No performance data
              available for this
              period.
            </div>
          )}
        </section>

        {/* ------------------------------------------------------------------ */}
        {/* Operational summary                                                */}
        {/* ------------------------------------------------------------------ */}

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface)] p-5">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />

              <h2 className="text-sm font-black">
                Revenue quality
              </h2>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-[var(--portal-border)] bg-[var(--portal-background)] p-4">
                <div className="text-[9px] font-bold uppercase tracking-wider text-[var(--portal-text-muted)]">
                  Valid orders
                </div>

                <div className="mt-2 text-xl font-black tabular-nums">
                  {formatNumber(
                    totalOrders
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-[var(--portal-border)] bg-[var(--portal-background)] p-4">
                <div className="text-[9px] font-bold uppercase tracking-wider text-[var(--portal-text-muted)]">
                  Revenue / order
                </div>

                <div className="mt-2 text-xl font-black tabular-nums">
                  {formatMoney(
                    averageOrder,
                    data.restaurant
                      .currency
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface)] p-5">
            <div className="flex items-center gap-2">
              <Clock3 className="h-4 w-4 text-[var(--portal-accent)]" />

              <h2 className="text-sm font-black">
                Reporting period
              </h2>
            </div>

            <div className="mt-5 rounded-xl border border-[var(--portal-border)] bg-[var(--portal-background)] p-4">
              <div className="text-[9px] font-bold uppercase tracking-wider text-[var(--portal-text-muted)]">
                Current view
              </div>

              <div className="mt-2 text-lg font-black">
                {getPeriodLabel(
                  period
                )}
              </div>

              <div className="mt-1 text-[10px] text-[var(--portal-text-muted)]">
                {
                  chartData.length
                }{' '}
                reporting{' '}
                {chartData.length ===
                1
                  ? 'point'
                  : 'points'}{' '}
                displayed
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* -------------------------------------------------------------------- */}
      {/* Fullscreen chart overlay                                             */}
      {/* -------------------------------------------------------------------- */}

      {expanded && (
        <div className="fixed inset-0 z-[100] bg-black/70 p-3 backdrop-blur-md sm:p-5 lg:p-8">
          <div className="mx-auto flex h-full max-w-[1550px] flex-col overflow-hidden rounded-3xl border border-[var(--portal-border)] bg-[var(--portal-background)] shadow-2xl">
            {/* Overlay header */}
            <div className="flex shrink-0 flex-col gap-4 border-b border-[var(--portal-border)] p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-[var(--portal-accent)]" />

                  <h2 className="text-lg font-black">
                    Revenue performance
                  </h2>
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-[var(--portal-text-muted)]">
                  <span>
                    {
                      data.restaurant
                        .name
                    }
                  </span>

                  <span>
                    •
                  </span>

                  <span>
                    {getPeriodLabel(
                      period
                    )}
                  </span>

                  <span>
                    •
                  </span>

                  <span>
                    Professional
                    detail view
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setExpanded(
                      false
                    )
                  }
                  className="inline-flex items-center gap-2 rounded-xl border border-[var(--portal-border)] bg-[var(--portal-surface)] px-3 py-2.5 text-xs font-bold text-[var(--portal-text-muted)] transition hover:border-[var(--portal-accent)] hover:text-[var(--portal-text)]"
                >
                  <Minimize2 className="h-4 w-4" />

                  Collapse
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setExpanded(
                      false
                    )
                  }
                  aria-label="Close fullscreen chart"
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--portal-border)] bg-[var(--portal-surface)] text-[var(--portal-text-muted)] transition hover:border-red-400/50 hover:text-red-400"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Overlay controls */}
            <div className="flex shrink-0 items-center justify-between border-b border-[var(--portal-border)] px-5 py-3">
              <div className="flex items-center gap-1 rounded-xl border border-[var(--portal-border)] bg-[var(--portal-surface)] p-1">
                {PERIODS.map(
                  (option) => (
                    <button
                      key={
                        option
                      }
                      type="button"
                      onClick={() =>
                        setPeriod(
                          option
                        )
                      }
                      className={`rounded-lg px-3 py-2 text-[10px] font-bold transition ${
                        period ===
                        option
                          ? 'bg-[var(--portal-accent)] text-white'
                          : 'text-[var(--portal-text-muted)] hover:text-[var(--portal-text)]'
                      }`}
                    >
                      {
                        option
                      }
                    </button>
                  )
                )}
              </div>

              <div className="hidden text-right sm:block">
                <div className="text-[9px] font-bold uppercase tracking-wider text-[var(--portal-text-muted)]">
                  Total
                </div>

                <div className="text-sm font-black tabular-nums">
                  {formatMoney(
                    totalRevenue,
                    data.restaurant
                      .currency
                  )}
                </div>
              </div>
            </div>

            {/* ---------------------------------------------------------------- */}
            {/* Overlay chart                                                    */}
            {/* ---------------------------------------------------------------- */}

            <div className="min-h-0 flex-1 overflow-hidden p-5 pb-10">
              {chartData.length >
              0 ? (
                renderChart(
                  true
                )
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-[var(--portal-text-muted)]">
                  No sales data for
                  this period.
                </div>
              )}
            </div>

            {/* ---------------------------------------------------------------- */}
            {/* Overlay footer                                                   */}
            {/* ---------------------------------------------------------------- */}

            <div className="grid shrink-0 border-t border-[var(--portal-border)] bg-[var(--portal-surface)] sm:grid-cols-4">
              <div className="border-b border-[var(--portal-border)] p-4 sm:border-b-0 sm:border-r">
                <div className="text-[9px] font-bold uppercase tracking-wider text-[var(--portal-text-muted)]">
                  Revenue
                </div>

                <div className="mt-1 text-sm font-black tabular-nums">
                  {formatMoney(
                    totalRevenue,
                    data.restaurant
                      .currency
                  )}
                </div>
              </div>

              <div className="border-b border-[var(--portal-border)] p-4 sm:border-b-0 sm:border-r">
                <div className="text-[9px] font-bold uppercase tracking-wider text-[var(--portal-text-muted)]">
                  Orders
                </div>

                <div className="mt-1 text-sm font-black tabular-nums">
                  {formatNumber(
                    totalOrders
                  )}
                </div>
              </div>

              <div className="border-b border-[var(--portal-border)] p-4 sm:border-b-0 sm:border-r">
                <div className="text-[9px] font-bold uppercase tracking-wider text-[var(--portal-text-muted)]">
                  Average order
                </div>

                <div className="mt-1 text-sm font-black tabular-nums">
                  {formatMoney(
                    averageOrder,
                    data.restaurant
                      .currency
                  )}
                </div>
              </div>

              <div className="p-4">
                <div className="text-[9px] font-bold uppercase tracking-wider text-[var(--portal-text-muted)]">
                  Peak
                </div>

                <div className="mt-1 text-sm font-black">
                  {peakPoint
                    ? peakPoint.label
                    : '—'}
                </div>

                {peakPoint && (
                  <div className="text-[10px] tabular-nums text-[var(--portal-text-muted)]">
                    {formatMoney(
                      peakPoint.value,
                      data.restaurant
                        .currency
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}