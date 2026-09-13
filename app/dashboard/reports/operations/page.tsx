'use client';

import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Gauge,
  ShoppingBag,
  TrendingUp,
  XCircle,
  Zap,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  getReportsData,
  type ReportsData,
} from '@/lib/reports/data';
import ReportDateRangePicker from '@/components/report-date-range-picker';

import { supabase } from '@/lib/supabase';

type Period = '7d' | '30d' | '90d' | '12m' | 'custom';

const periods: { key: Period; label: string }[] = [
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: '90d', label: '90 days' },
  { key: '12m', label: '12 months' },
];

function getPeriodRange(period: Period, customFrom?: string, customTo?: string) {
  const to = new Date();
  const end = new Date(
    to.getFullYear(),
    to.getMonth(),
    to.getDate() + 1,
  );
  const from = new Date(
    to.getFullYear(),
    to.getMonth(),
    to.getDate(),
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
    from.setDate(from.getDate() - 6);
  } else if (period === '30d') {
    from.setDate(from.getDate() - 29);
  } else if (period === '90d') {
    from.setDate(from.getDate() - 89);
  } else {
    from.setDate(1);
    from.setMonth(from.getMonth() - 11);
  }

  return {
    from,
    to: end,
  };
}

function normalizeStatus(status: string | null | undefined) {
  return String(status || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

function isCompleted(status: string | null | undefined) {
  const value = normalizeStatus(status);

  return [
    'completed',
    'complete',
    'delivered',
    'done',
    'fulfilled',
  ].includes(value);
}

function isCancelled(status: string | null | undefined) {
  const value = normalizeStatus(status);

  return [
    'cancelled',
    'canceled',
    'rejected',
  ].includes(value);
}

function isPending(status: string | null | undefined) {
  const value = normalizeStatus(status);

  return !isCompleted(value) && !isCancelled(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return '0.0%';

  return `${value.toFixed(1)}%`;
}

function getHourLabel(hour: number) {
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;

  return `${displayHour} ${suffix}`;
}

function getDayName(index: number) {
  return [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ][index];
}

function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    '0',
  )}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function OperationsReportPage() {
  const [period, setPeriod] = useState<Period>('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [data, setData] = useState<ReportsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadReport = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { from, to } = getPeriodRange(period, customFrom, customTo);

      const result = await getReportsData({
        from: from.toISOString(),
        to: to.toISOString(),
      });

      setData(result);
    } catch (err) {
      console.error('Operations report loading failed:', err);

      setError(
        err instanceof Error
          ? err.message
          : 'Could not load operations report.',
      );
    } finally {
      setLoading(false);
    }
  }, [period, customFrom, customTo]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  /*
   * IMPORTANT:
   * Supabase realtime callbacks MUST be registered BEFORE subscribe().
   *
   * Correct:
   * channel.on(...).on(...).subscribe()
   *
   * NOT:
   * channel.subscribe().on(...)
   */
  useEffect(() => {
    const channel = supabase
      .channel(`operations-report-${period}-${Math.random()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
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
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [period, loadReport]);

  const calculations = useMemo(() => {
    if (!data) {
      return null;
    }

    const orders = data.orders || [];

    const completedOrders = orders.filter((order) =>
      isCompleted(order.status),
    );

    const cancelledOrders = orders.filter((order) =>
      isCancelled(order.status),
    );

    const pendingOrders = orders.filter((order) =>
      isPending(order.status),
    );

    const completionRate =
      orders.length > 0
        ? (completedOrders.length / orders.length) * 100
        : 0;

    const cancellationRate =
      orders.length > 0
        ? (cancelledOrders.length / orders.length) * 100
        : 0;

    /*
     * Hourly order workload.
     */
    const hourlyMap = new Map<number, number>();

    for (let hour = 0; hour < 24; hour += 1) {
      hourlyMap.set(hour, 0);
    }

    for (const order of orders) {
      const date = new Date(order.created_at);
      const hour = date.getHours();

      hourlyMap.set(hour, (hourlyMap.get(hour) || 0) + 1);
    }

    const hourlyData = Array.from(hourlyMap.entries())
      .filter(([, value]) => value > 0)
      .map(([hour, value]) => ({
        hour,
        label: getHourLabel(hour),
        value,
      }))
      .sort((a, b) => a.hour - b.hour);

    const peakHour =
      hourlyData.length > 0
        ? hourlyData.reduce((best, current) =>
            current.value > best.value ? current : best,
          )
        : null;

    const lowestHour =
      hourlyData.length > 0
        ? hourlyData.reduce((best, current) =>
            current.value < best.value ? current : best,
          )
        : null;

    /*
     * Daily performance.
     *
     * For 7/30/90/12m we show weekday performance based
     * on the selected period.
     */
    const dayMap = new Map<
      number,
      {
        orders: number;
        completed: number;
      }
    >();

    for (let day = 0; day < 7; day += 1) {
      dayMap.set(day, {
        orders: 0,
        completed: 0,
      });
    }

    for (const order of orders) {
      const date = new Date(order.created_at);
      const day = date.getDay();

      const current = dayMap.get(day)!;

      current.orders += 1;

      if (isCompleted(order.status)) {
        current.completed += 1;
      }
    }

    const dayData = Array.from(dayMap.entries()).map(
      ([day, values]) => ({
        day,
        name: getDayName(day),
        orders: values.orders,
        rate:
          values.orders > 0
            ? (values.completed / values.orders) * 100
            : 0,
      }),
    );

    const ordersPerDay =
      orders.length > 0
        ? orders.length /
          Math.max(
            1,
            Math.ceil(
              (getPeriodRange(period, customFrom, customTo).to.getTime() -
                getPeriodRange(period, customFrom, customTo).from.getTime()) /
                86400000,
            ),
          )
        : 0;

    /*
     * Current database model does not contain:
     * accepted_at / preparing_at / ready_at / delivered_at.
     *
     * Therefore we intentionally do NOT fabricate processing/wait
     * times or an efficiency score.
     */
    return {
      totalOrders: orders.length,
      completedOrders: completedOrders.length,
      pendingOrders: pendingOrders.length,
      cancelledOrders: cancelledOrders.length,
      completionRate,
      cancellationRate,
      hourlyData,
      peakHour,
      lowestHour,
      dayData,
      ordersPerDay,
    };
  }, [data, period]);

  const maxHourlyValue = Math.max(
    ...(calculations?.hourlyData.map((item) => item.value) || [1]),
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

  return (
    <div
      className="min-h-full px-4 pb-8 sm:px-6 sm:pb-10 lg:px-8 lg:pb-12"
      style={{
        color: 'var(--portal-text)',
        background: 'var(--portal-background)',
      }}
    >
      <div className="mx-auto max-w-7xl space-y-6">
        {/* HEADER */}
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div
              className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em]"
              style={{ color: 'var(--portal-accent)' }}
            >
              <Activity size={13} />
              Reports / Operations
            </div>

            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
              Operations
            </h1>

            <p
              className="mt-2 max-w-2xl text-sm leading-6"
              style={{ color: 'var(--portal-text-muted)' }}
            >
              Monitor order flow, workload, completion performance, and
              operational activity using your actual restaurant data.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div
              className="flex items-center gap-1 overflow-x-auto rounded-xl border p-1"
              style={{
                borderColor: 'var(--portal-border)',
                background: 'var(--portal-surface)',
              }}
            >
              {periods.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setPeriod(item.key)}
                  className="whitespace-nowrap rounded-lg px-3 py-2 text-xs font-bold transition"
                  style={{
                    color:
                      period === item.key
                        ? 'var(--portal-text)'
                        : 'var(--portal-text-muted)',
                    background:
                      period === item.key
                        ? 'var(--portal-accent-soft)'
                        : 'transparent',
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

          </div>
        </div>

        {/* ERROR */}
        {error && (
          <div
            className="rounded-xl border px-4 py-3 text-xs"
            style={{
              borderColor: 'var(--portal-border)',
              background: 'var(--portal-surface)',
              color: 'var(--portal-text)',
            }}
          >
            <span className="font-black">Report error:</span> {error}
          </div>
        )}

        {/* LOADING */}
        {loading && !data && (
          <div
            className="rounded-2xl border p-10 text-center text-xs font-bold"
            style={{
              borderColor: 'var(--portal-border)',
              background: 'var(--portal-surface)',
              color: 'var(--portal-text-muted)',
            }}
          >
            Loading operations data…
          </div>
        )}

        {calculations && (
          <>
            {/* KPI */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard
                icon={CheckCircle2}
                label="Completed Orders"
                value={formatNumber(calculations.completedOrders)}
                detail="Successfully completed"
              />

              <KpiCard
                icon={Activity}
                label="Pending Orders"
                value={formatNumber(calculations.pendingOrders)}
                detail="Not completed or cancelled"
              />

              <KpiCard
                icon={XCircle}
                label="Cancelled Orders"
                value={formatNumber(calculations.cancelledOrders)}
                detail="Cancelled during period"
              />

              <KpiCard
                icon={Gauge}
                label="Completion Rate"
                value={formatPercent(calculations.completionRate)}
                detail="Completed orders / total orders"
              />
            </div>

            {/* OVERVIEW */}
            <section
              className="overflow-hidden rounded-2xl border"
              style={{
                borderColor: 'var(--portal-border)',
                background: 'var(--portal-surface)',
              }}
            >
              <div
                className="flex flex-col gap-3 border-b px-5 py-5 sm:flex-row sm:items-center sm:justify-between"
                style={{ borderColor: 'var(--portal-border)' }}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <Zap
                      size={17}
                      style={{ color: 'var(--portal-accent)' }}
                    />
                    <h2 className="text-sm font-black">
                      Operational Overview
                    </h2>
                  </div>

                  <p
                    className="mt-1 text-xs"
                    style={{ color: 'var(--portal-text-muted)' }}
                  >
                    Actual order-processing activity for the selected period.
                  </p>
                </div>

                <div
                  className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em]"
                  style={{ color: 'var(--portal-text-muted)' }}
                >
                  <CalendarDays size={13} />
                  {periodLabel}
                </div>
              </div>

              <div className="grid divide-y sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">
                <MetricBlock
                  icon={ShoppingBag}
                  label="Total Orders"
                  value={formatNumber(calculations.totalOrders)}
                  detail="Orders recorded during the period"
                />

                <MetricBlock
                  icon={CheckCircle2}
                  label="Completion Rate"
                  value={formatPercent(calculations.completionRate)}
                  detail="Orders successfully completed"
                />

                <MetricBlock
                  icon={XCircle}
                  label="Cancellation Rate"
                  value={formatPercent(calculations.cancellationRate)}
                  detail="Orders cancelled during period"
                />

                <MetricBlock
                  icon={ShoppingBag}
                  label="Orders / Day"
                  value={calculations.ordersPerDay.toFixed(1)}
                  detail="Average order volume per day"
                />
              </div>
            </section>

            {/* WORKLOAD */}
            <div className="grid gap-4 lg:grid-cols-3">
              <section
                className="rounded-2xl border p-5 lg:col-span-2"
                style={{
                  borderColor: 'var(--portal-border)',
                  background: 'var(--portal-surface)',
                }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <BarChart3
                        size={17}
                        style={{ color: 'var(--portal-accent)' }}
                      />
                      <h2 className="text-sm font-black">
                        Order Workload
                      </h2>
                    </div>

                    <p
                      className="mt-1 text-xs"
                      style={{ color: 'var(--portal-text-muted)' }}
                    >
                      Actual order volume by hour.
                    </p>
                  </div>

                  {calculations.peakHour && (
                    <span
                      className="rounded-lg px-2 py-1 text-[10px] font-black"
                      style={{
                        color: 'var(--portal-accent)',
                        background: 'var(--portal-accent-soft)',
                      }}
                    >
                      Peak: {calculations.peakHour.label}
                    </span>
                  )}
                </div>

                {calculations.hourlyData.length === 0 ? (
                  <div
                    className="mt-8 flex h-64 items-center justify-center rounded-xl border border-dashed text-xs"
                    style={{
                      borderColor: 'var(--portal-border)',
                      color: 'var(--portal-text-muted)',
                    }}
                  >
                    No orders in this period.
                  </div>
                ) : (
                  <div className="mt-8 flex h-64 items-end gap-2 overflow-x-auto pb-1">
                    {calculations.hourlyData.map((item) => {
                      const height =
                        (item.value / maxHourlyValue) * 100;

                      return (
                        <div
                          key={item.hour}
                          className="flex h-full min-w-[38px] flex-1 flex-col items-center justify-end gap-2"
                        >
                          <span
                            className="text-[9px] font-black"
                            style={{
                              color: 'var(--portal-text-muted)',
                            }}
                          >
                            {item.value}
                          </span>

                          <div className="flex h-full w-full items-end">
                            <div
                              className="w-full rounded-t-lg"
                              style={{
                                height: `${height}%`,
                                background: 'var(--portal-accent)',
                                opacity:
                                  item === calculations.peakHour
                                    ? 1
                                    : 0.65,
                              }}
                            />
                          </div>

                          <span
                            className="whitespace-nowrap text-[8px] font-bold"
                            style={{
                              color: 'var(--portal-text-muted)',
                            }}
                          >
                            {item.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {calculations.peakHour && (
                  <div
                    className="mt-5 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between"
                    style={{
                      borderColor: 'var(--portal-border)',
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <TrendingUp
                        size={13}
                        style={{ color: 'var(--portal-accent)' }}
                      />

                      <span
                        className="text-[10px] font-bold"
                        style={{
                          color: 'var(--portal-text-muted)',
                        }}
                      >
                        Highest workload: {calculations.peakHour.label}{' '}
                        ({calculations.peakHour.value} orders)
                      </span>
                    </div>

                    {calculations.lowestHour && (
                      <span
                        className="text-[10px] font-black uppercase tracking-[0.12em]"
                        style={{
                          color: 'var(--portal-text-muted)',
                        }}
                      >
                        Lowest: {calculations.lowestHour.label}
                      </span>
                    )}
                  </div>
                )}
              </section>

              {/* SIGNALS */}
              <section
                className="rounded-2xl border p-5"
                style={{
                  borderColor: 'var(--portal-border)',
                  background: 'var(--portal-surface)',
                }}
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle
                    size={17}
                    style={{ color: 'var(--portal-accent)' }}
                  />
                  <h2 className="text-sm font-black">
                    Operational Signals
                  </h2>
                </div>

                <p
                  className="mt-1 text-xs"
                  style={{ color: 'var(--portal-text-muted)' }}
                >
                  Areas worth monitoring.
                </p>

                <div className="mt-5 space-y-3">
                  <SignalRow
                    label="Cancelled orders"
                    value={formatNumber(calculations.cancelledOrders)}
                    detail={`${formatPercent(
                      calculations.cancellationRate,
                    )} of total orders`}
                    attention={calculations.cancelledOrders > 0}
                  />

                  <SignalRow
                    label="Pending orders"
                    value={formatNumber(calculations.pendingOrders)}
                    detail="Currently not completed"
                    attention={calculations.pendingOrders > 0}
                  />

                  <SignalRow
                    label="Peak workload"
                    value={
                      calculations.peakHour
                        ? calculations.peakHour.label
                        : '—'
                    }
                    detail={
                      calculations.peakHour
                        ? `${calculations.peakHour.value} orders`
                        : 'No orders'
                    }
                  />

                  <SignalRow
                    label="Lowest activity"
                    value={
                      calculations.lowestHour
                        ? calculations.lowestHour.label
                        : '—'
                    }
                    detail={
                      calculations.lowestHour
                        ? `${calculations.lowestHour.value} orders`
                        : 'No orders'
                    }
                  />
                </div>
              </section>
            </div>

            {/* DAILY */}
            <section
              className="overflow-hidden rounded-2xl border"
              style={{
                borderColor: 'var(--portal-border)',
                background: 'var(--portal-surface)',
              }}
            >
              <div
                className="border-b px-5 py-5"
                style={{ borderColor: 'var(--portal-border)' }}
              >
                <div className="flex items-center gap-2">
                  <Activity
                    size={17}
                    style={{ color: 'var(--portal-accent)' }}
                  />
                  <h2 className="text-sm font-black">
                    Daily Operational Performance
                  </h2>
                </div>

                <p
                  className="mt-1 text-xs"
                  style={{ color: 'var(--portal-text-muted)' }}
                >
                  Order volume and completion performance by weekday.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-left">
                  <thead>
                    <tr
                      className="border-b text-[10px] font-black uppercase tracking-[0.15em]"
                      style={{
                        borderColor: 'var(--portal-border)',
                        color: 'var(--portal-text-muted)',
                      }}
                    >
                      <th className="px-5 py-4">Day</th>
                      <th className="px-5 py-4">Orders</th>
                      <th className="px-5 py-4">Completion Rate</th>
                      <th className="px-5 py-4">
                        Operational Status
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {calculations.dayData.map((day) => (
                      <tr
                        key={day.day}
                        className="border-b last:border-b-0"
                        style={{
                          borderColor: 'var(--portal-border)',
                        }}
                      >
                        <td className="px-5 py-4 text-xs font-black">
                          {day.name}
                        </td>

                        <td className="px-5 py-4">
                          <span className="inline-flex items-center gap-2 text-xs font-bold">
                            <ShoppingBag
                              size={13}
                              style={{
                                color:
                                  'var(--portal-text-muted)',
                              }}
                            />
                            {formatNumber(day.orders)}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className="text-xs font-black"
                            style={{
                              color: 'var(--portal-accent)',
                            }}
                          >
                            {day.orders > 0
                              ? formatPercent(day.rate)
                              : '—'}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          {day.orders === 0 ? (
                            <span
                              className="text-[10px] font-black"
                              style={{
                                color:
                                  'var(--portal-text-muted)',
                              }}
                            >
                              No data
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-black"
                              style={{
                                color:
                                  day.rate >= 95
                                    ? 'var(--portal-accent)'
                                    : 'var(--portal-text-muted)',
                                background:
                                  day.rate >= 95
                                    ? 'var(--portal-accent-soft)'
                                    : 'var(--portal-background)',
                              }}
                            >
                              {day.rate >= 95 ? (
                                <CheckCircle2 size={11} />
                              ) : (
                                <AlertTriangle size={11} />
                              )}

                              {day.rate >= 95
                                ? 'Healthy'
                                : 'Monitor'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* INSIGHTS */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <InsightCard
                icon={ShoppingBag}
                label="Total Orders"
                value={formatNumber(calculations.totalOrders)}
                detail="Orders recorded during the selected period"
              />

              <InsightCard
                icon={CheckCircle2}
                label="Completion"
                value={formatPercent(calculations.completionRate)}
                detail="Orders successfully completed"
              />

              <InsightCard
                icon={XCircle}
                label="Cancellation"
                value={formatPercent(calculations.cancellationRate)}
                detail="Share of orders cancelled"
              />

              <InsightCard
                icon={TrendingUp}
                label="Orders / Day"
                value={calculations.ordersPerDay.toFixed(1)}
                detail="Average daily order volume"
              />
            </div>

            {/* RECOMMENDATION */}
            <section
              className="rounded-2xl border p-5"
              style={{
                borderColor: 'var(--portal-border)',
                background: 'var(--portal-surface)',
              }}
            >
              <div className="flex items-center gap-2">
                <Zap
                  size={17}
                  style={{ color: 'var(--portal-accent)' }}
                />
                <h2 className="text-sm font-black">
                  Operational Recommendation
                </h2>
              </div>

              <div
                className="mt-5 rounded-xl border p-4"
                style={{
                  borderColor: 'var(--portal-border)',
                  background: 'var(--portal-background)',
                }}
              >
                {calculations.peakHour ? (
                  <>
                    <p className="text-sm font-black">
                      Prepare for the {calculations.peakHour.label}{' '}
                      workload peak.
                    </p>

                    <p
                      className="mt-2 max-w-3xl text-xs leading-6"
                      style={{
                        color: 'var(--portal-text-muted)',
                      }}
                    >
                      Your highest order volume during this reporting
                      period occurred around{' '}
                      {calculations.peakHour.label}, with{' '}
                      {calculations.peakHour.value} orders. This is
                      the period where staffing and preparation capacity
                      may need the most attention.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-black">
                      No operational recommendation yet.
                    </p>

                    <p
                      className="mt-2 text-xs"
                      style={{
                        color: 'var(--portal-text-muted)',
                      }}
                    >
                      There are no orders in the selected period.
                    </p>
                  </>
                )}
              </div>

              <div
                className="mt-4 flex items-center gap-2 text-[10px] font-bold"
                style={{
                  color: 'var(--portal-text-muted)',
                }}
              >
                <Activity
                  size={13}
                  style={{
                    color: 'var(--portal-accent)',
                  }}
                />
                Live report data from Supabase orders.
              </div>
            </section>

            {/* STATUS */}
            <div
              className="rounded-xl border px-4 py-3 text-[11px] leading-5"
              style={{
                borderColor: 'var(--portal-border)',
                background: 'var(--portal-surface)',
                color: 'var(--portal-text-muted)',
              }}
            >
              <span
                className="font-black"
                style={{
                  color: 'var(--portal-text)',
                }}
              >
                Report status:
              </span>{' '}
              Connected to live restaurant order data. Changes to
              orders and order items automatically refresh this report.
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div
      className="rounded-2xl border p-5"
      style={{
        borderColor: 'var(--portal-border)',
        background: 'var(--portal-surface)',
      }}
    >
      <div
        className="flex h-10 w-10 items-center justify-center rounded-xl"
        style={{
          color: 'var(--portal-accent)',
          background: 'var(--portal-accent-soft)',
        }}
      >
        <Icon size={18} />
      </div>

      <p
        className="mt-5 text-[10px] font-black uppercase tracking-[0.16em]"
        style={{
          color: 'var(--portal-text-muted)',
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
          color: 'var(--portal-text-muted)',
        }}
      >
        {detail}
      </p>
    </div>
  );
}

function MetricBlock({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="p-5">
      <div
        className="flex h-9 w-9 items-center justify-center rounded-xl"
        style={{
          color: 'var(--portal-accent)',
          background: 'var(--portal-accent-soft)',
        }}
      >
        <Icon size={16} />
      </div>

      <p
        className="mt-4 text-[10px] font-black uppercase tracking-[0.14em]"
        style={{
          color: 'var(--portal-text-muted)',
        }}
      >
        {label}
      </p>

      <p className="mt-2 text-xl font-black">
        {value}
      </p>

      <p
        className="mt-1 text-[10px] leading-5"
        style={{
          color: 'var(--portal-text-muted)',
        }}
      >
        {detail}
      </p>
    </div>
  );
}

function SignalRow({
  label,
  value,
  detail,
  attention = false,
}: {
  label: string;
  value: string;
  detail: string;
  attention?: boolean;
}) {
  return (
    <div
      className="rounded-xl border p-4"
      style={{
        borderColor: 'var(--portal-border)',
        background: 'var(--portal-background)',
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-black">{label}</p>

        <span
          className="text-sm font-black"
          style={{
            color: attention
              ? 'var(--portal-accent)'
              : 'var(--portal-text)',
          }}
        >
          {value}
        </span>
      </div>

      <p
        className="mt-1 text-[10px]"
        style={{
          color: 'var(--portal-text-muted)',
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
  icon: React.ElementType;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div
      className="rounded-2xl border p-5"
      style={{
        borderColor: 'var(--portal-border)',
        background: 'var(--portal-surface)',
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl"
          style={{
            color: 'var(--portal-accent)',
            background: 'var(--portal-accent-soft)',
          }}
        >
          <Icon size={16} />
        </div>

        <span
          className="text-lg font-black"
          style={{
            color: 'var(--portal-accent)',
          }}
        >
          {value}
        </span>
      </div>

      <p className="mt-4 text-xs font-black">{label}</p>

      <p
        className="mt-1 text-[10px] leading-5"
        style={{
          color: 'var(--portal-text-muted)',
        }}
      >
        {detail}
      </p>
    </div>
  );
}