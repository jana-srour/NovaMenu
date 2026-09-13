'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  Clock3,
  DollarSign,
  Loader2,
  Minus,
  RefreshCw,
  Tag,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react';

import { supabase } from '@/lib/supabase';
import {
  getCurrentRestaurantId,
  getReportsData,
  type ReportCategory,
  type ReportMenuItem,
  type ReportMenuPricingHistory,
  type ReportsData,
} from '@/lib/reports/data';
import ReportDateRangePicker from '@/components/report-date-range-picker';

type Period = '7d' | '30d' | '90d' | '12m' | 'custom';

type PricingChange = {
  id: string;
  itemName: string;
  categoryName: string;
  oldPrice: number | null;
  newPrice: number | null;
  percentage: number | null;
  direction: 'increase' | 'decrease' | 'unchanged';
  createdAt: string;
  summary: string;
};

type CategoryPricing = {
  id: string;
  name: string;
  itemCount: number;
  averagePrice: number;
  changes: number;
  increases: number;
  decreases: number;
};

const PERIODS: { key: Period; label: string }[] = [
  { key: '7d', label: '7 Days' },
  { key: '30d', label: '30 Days' },
  { key: '90d', label: '90 Days' },
  { key: '12m', label: '12 Months' },
];

function normalizeCurrencyCode(currency: string | null | undefined): string {
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

function getPeriodRange(period: Period, customFrom?: string, customTo?: string) {
  const to = new Date();
  const from = new Date(to);
  if (period === 'custom' && customFrom && customTo) {
    const customEnd = new Date(`${customTo}T00:00:00`);
    customEnd.setDate(customEnd.getDate() + 1);
    return {
      from: new Date(`${customFrom}T00:00:00`),
      to: customEnd,
    };
  }

  if (period === '7d') {
    from.setDate(from.getDate() - 7);
  }

  if (period === '30d') {
    from.setDate(from.getDate() - 30);
  }

  if (period === '90d') {
    from.setDate(from.getDate() - 90);
  }

  if (period === '12m') {
    from.setFullYear(from.getFullYear() - 1);
  }

  return { from, to };
}

function normalizeName(value: string | null | undefined) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function getHistoryDirection(
  record: ReportMenuPricingHistory,
): 'increase' | 'decrease' | 'unchanged' {
  if (record.direction === 'up' || record.direction === 'increase') {
    return 'increase';
  }

  if (record.direction === 'down' || record.direction === 'decrease') {
    return 'decrease';
  }

  const oldPrice = Number(record.old_price);
  const newPrice = Number(record.new_price);

  if (
    Number.isFinite(oldPrice) &&
    Number.isFinite(newPrice)
  ) {
    if (newPrice > oldPrice) return 'increase';
    if (newPrice < oldPrice) return 'decrease';
  }

  return 'unchanged';
}

function getChangePercentage(
  oldPrice: number | null | undefined,
  newPrice: number | null | undefined,
) {
  const oldValue = Number(oldPrice);
  const newValue = Number(newPrice);

  if (
    !Number.isFinite(oldValue) ||
    !Number.isFinite(newValue) ||
    oldValue === 0
  ) {
    return null;
  }

  return ((newValue - oldValue) / Math.abs(oldValue)) * 100;
}

function escapeCsv(value: unknown) {
  const text = String(value ?? '');

  if (
    text.includes(',') ||
    text.includes('"') ||
    text.includes('\n')
  ) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

export default function PricingReportPage() {
  const [period, setPeriod] = useState<Period>('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [data, setData] = useState<ReportsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadReport = useCallback(
    async (showRefreshing = false) => {
      try {
        if (showRefreshing) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError(null);

        /*
         * IMPORTANT:
         * We deliberately load pricing history here and then apply the
         * selected period locally below.
         *
         * getReportsData() currently date-filters orders, but pricing
         * history is returned in full. Filtering it here guarantees that
         * 7d / 30d / 90d / 12m really changes the report.
         */
        const result = await getReportsData();

        setData(result);
        setLastUpdated(new Date());
      } catch (err) {
        console.error('Pricing report loading failed:', err);

        setError(
          err instanceof Error
            ? err.message
            : 'Could not load pricing report.',
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  /*
   * Realtime refresh.
   *
   * IMPORTANT:
   * .on(...) MUST come before .subscribe().
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
        .channel(`pricing-report-${restaurantId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'menu_item_pricing_history',
            filter: `restaurant_id=eq.${restaurantId}`,
          },
          () => {
            loadReport(true);
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
            loadReport(true);
          },
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'categories',
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
        supabase.removeChannel(channel);
      }
    };
  }, [loadReport]);

  const range = useMemo(
    () => getPeriodRange(period, customFrom, customTo),
    [period, customFrom, customTo],
  );

  /*
   * THIS IS THE IMPORTANT FIX.
   *
   * Only pricing-history records whose created_at falls inside
   * the selected period are included.
   */
  const periodPricingHistory = useMemo(() => {
    if (!data) return [];

    const fromTime = range.from.getTime();
    const toTime = range.to.getTime();

    return data.menuPricingHistory.filter((record) => {
      const createdTime = new Date(record.created_at).getTime();

      return (
        Number.isFinite(createdTime) &&
        createdTime >= fromTime &&
        createdTime < toTime
      );
    });
  }, [data, range]);

  /*
   * Current menu lookup.
   */
  const menuItemById = useMemo(() => {
    const map = new Map<string, ReportMenuItem>();

    for (const item of data?.menuItems || []) {
      map.set(item.id, item);
    }

    return map;
  }, [data?.menuItems]);

  /*
   * Current category lookup.
   */
  const categoryById = useMemo(() => {
    const map = new Map<string, ReportCategory>();

    for (const category of data?.categories || []) {
      map.set(category.id, category);
    }

    return map;
  }, [data?.categories]);

  /*
   * Exact fallback:
   *
   * If historical menu_item_id is missing, only match a current
   * menu item when exactly ONE current menu item has that name.
   *
   * This prevents accidentally assigning history to the wrong item
   * when two items have the same name.
   */
  const uniqueMenuItemByName = useMemo(() => {
    const groups = new Map<string, ReportMenuItem[]>();

    for (const item of data?.menuItems || []) {
      const key = normalizeName(item.name);

      if (!key) continue;

      const current = groups.get(key) || [];
      current.push(item);
      groups.set(key, current);
    }

    const unique = new Map<string, ReportMenuItem>();

    for (const [key, items] of groups) {
      if (items.length === 1) {
        unique.set(key, items[0]);
      }
    }

    return unique;
  }, [data?.menuItems]);

  const resolveMenuItem = useCallback(
    (record: ReportMenuPricingHistory) => {
      if (record.menu_item_id) {
        const byId = menuItemById.get(record.menu_item_id);

        if (byId) {
          return byId;
        }
      }

      const byName = uniqueMenuItemByName.get(
        normalizeName(record.item_name),
      );

      return byName || null;
    },
    [menuItemById, uniqueMenuItemByName],
  );

  /*
   * Convert raw pricing-history records into clean report rows.
   */
  const pricingChanges = useMemo<PricingChange[]>(() => {
    return periodPricingHistory.map((record, index) => {
      const item = resolveMenuItem(record);

      const categoryName = item?.category_id
        ? categoryById.get(item.category_id)?.name || 'Uncategorized'
        : 'Uncategorized';

      const direction = getHistoryDirection(record);

      const percentage = getChangePercentage(
        record.old_price,
        record.new_price,
      );

      return {
        id: record.id || `${record.created_at}-${index}`,
        itemName:
          item?.name ||
          record.item_name ||
          'Unknown menu item',
        categoryName,
        oldPrice:
          record.old_price == null
            ? null
            : Number(record.old_price),
        newPrice:
          record.new_price == null
            ? null
            : Number(record.new_price),
        percentage,
        direction,
        createdAt: record.created_at,
        summary:
          record.summary ||
          record.change_type ||
          'Price updated',
      };
    });
  }, [
    periodPricingHistory,
    resolveMenuItem,
    categoryById,
  ]);

  /*
   * KPI calculations.
   */
  const stats = useMemo(() => {
    const increases = pricingChanges.filter(
      (change) => change.direction === 'increase',
    );

    const decreases = pricingChanges.filter(
      (change) => change.direction === 'decrease',
    );

    const percentageChanges = pricingChanges
      .map((change) => change.percentage)
      .filter(
        (value): value is number =>
          value !== null &&
          Number.isFinite(value),
      );

    const uniqueItems = new Set(
      pricingChanges.map((change) => {
        const item = resolveMenuItem({
          menu_item_id: null,
          item_name: change.itemName,
          created_at: change.createdAt,
        });

        return item?.id || normalizeName(change.itemName);
      }),
    );

    const averageAdjustment =
      percentageChanges.length > 0
        ? percentageChanges.reduce(
            (sum, value) => sum + value,
            0,
          ) / percentageChanges.length
        : 0;

    const currentPrices = (data?.menuItems || [])
      .map((item) => Number(item.price))
      .filter(
        (price) =>
          Number.isFinite(price) &&
          price >= 0,
      );

    const averageCurrentPrice =
      currentPrices.length > 0
        ? currentPrices.reduce(
            (sum, price) => sum + price,
            0,
          ) / currentPrices.length
        : 0;

    return {
      totalChanges: pricingChanges.length,
      increases: increases.length,
      decreases: decreases.length,
      repricedItems: uniqueItems.size,
      averageAdjustment,
      averageCurrentPrice,
    };
  }, [
    pricingChanges,
    data?.menuItems,
    resolveMenuItem,
  ]);

  /*
   * Current category pricing.
   *
   * This intentionally uses CURRENT menu prices, not historical prices.
   */
  const categoryPricing = useMemo<CategoryPricing[]>(() => {
    if (!data) return [];

    const historyByCategory = new Map<
      string,
      {
        changes: number;
        increases: number;
        decreases: number;
      }
    >();

    for (const change of pricingChanges) {
      const item = resolveMenuItem({
        menu_item_id: null,
        item_name: change.itemName,
        created_at: change.createdAt,
      });

      const categoryId =
        item?.category_id || 'uncategorized';

      const current = historyByCategory.get(
        categoryId,
      ) || {
        changes: 0,
        increases: 0,
        decreases: 0,
      };

      current.changes += 1;

      if (change.direction === 'increase') {
        current.increases += 1;
      }

      if (change.direction === 'decrease') {
        current.decreases += 1;
      }

      historyByCategory.set(
        categoryId,
        current,
      );
    }

    const categories: CategoryPricing[] = [];

    for (const category of data.categories) {
      const items = data.menuItems.filter(
        (item) =>
          item.category_id === category.id,
      );

      const prices = items
        .map((item) => Number(item.price))
        .filter(
          (price) =>
            Number.isFinite(price) &&
            price >= 0,
        );

      const history =
        historyByCategory.get(category.id) || {
          changes: 0,
          increases: 0,
          decreases: 0,
        };

      categories.push({
        id: category.id,
        name: category.name,
        itemCount: items.length,
        averagePrice:
          prices.length > 0
            ? prices.reduce(
                (sum, price) => sum + price,
                0,
              ) / prices.length
            : 0,
        changes: history.changes,
        increases: history.increases,
        decreases: history.decreases,
      });
    }

    const uncategorizedItems =
      data.menuItems.filter(
        (item) => !item.category_id,
      );

    if (uncategorizedItems.length > 0) {
      const prices = uncategorizedItems
        .map((item) => Number(item.price))
        .filter(
          (price) =>
            Number.isFinite(price) &&
            price >= 0,
        );

      const history =
        historyByCategory.get('uncategorized') || {
          changes: 0,
          increases: 0,
          decreases: 0,
        };

      categories.push({
        id: 'uncategorized',
        name: 'Uncategorized',
        itemCount: uncategorizedItems.length,
        averagePrice:
          prices.length > 0
            ? prices.reduce(
                (sum, price) => sum + price,
                0,
              ) / prices.length
            : 0,
        changes: history.changes,
        increases: history.increases,
        decreases: history.decreases,
      });
    }

    return categories;
  }, [
    data,
    pricingChanges,
    resolveMenuItem,
  ]);

  const largestIncrease = useMemo(() => {
    return pricingChanges
      .filter(
        (change) =>
          change.direction === 'increase' &&
          change.percentage !== null,
      )
      .sort(
        (a, b) =>
          (b.percentage || 0) -
          (a.percentage || 0),
      )[0] || null;
  }, [pricingChanges]);

  const largestDecrease = useMemo(() => {
    return pricingChanges
      .filter(
        (change) =>
          change.direction === 'decrease' &&
          change.percentage !== null,
      )
      .sort(
        (a, b) =>
          (a.percentage || 0) -
          (b.percentage || 0),
      )[0] || null;
  }, [pricingChanges]);

  const mostChangedCategory = useMemo(() => {
    return (
      [...categoryPricing]
        .filter((category) => category.changes > 0)
        .sort(
          (a, b) =>
            b.changes - a.changes,
        )[0] || null
    );
  }, [categoryPricing]);

  const recommendation = useMemo(() => {
    if (stats.totalChanges === 0) {
      return 'No pricing changes were recorded during the selected period. Your current menu pricing remained stable.';
    }

    if (
      stats.increases >
      stats.decreases * 2
    ) {
      return 'Most pricing activity was upward. Review high-volume items before making additional increases to protect customer value perception.';
    }

    if (
      stats.decreases >
      stats.increases * 2
    ) {
      return 'Most pricing activity was downward. Review margins on discounted or reduced-price items to make sure profitability remains healthy.';
    }

    if (
      stats.averageAdjustment > 5
    ) {
      return 'Pricing activity was relatively aggressive during this period. Consider monitoring sales volume and item performance after these changes.';
    }

    if (
      stats.averageAdjustment < -5
    ) {
      return 'Average pricing moved downward noticeably. Review whether the reductions are producing enough additional demand to offset the lower prices.';
    }

    return 'Pricing activity appears relatively balanced. Continue monitoring item-level performance when adjusting prices.';
  }, [
    stats,
  ]);

  /* Exporting is centralized in the Export Center. */
  const exportCsv = useCallback(() => {
    if (pricingChanges.length === 0) {
      return;
    }

    const rows = [
      [
        'Date',
        'Item',
        'Category',
        'Old Price',
        'New Price',
        'Change %',
        'Direction',
        'Summary',
      ],
      ...pricingChanges.map((change) => [
        new Date(change.createdAt).toISOString(),
        change.itemName,
        change.categoryName,
        change.oldPrice ?? '',
        change.newPrice ?? '',
        change.percentage == null
          ? ''
          : change.percentage.toFixed(2),
        change.direction,
        change.summary,
      ]),
    ];

    const csv = rows
      .map((row) =>
        row
          .map(escapeCsv)
          .join(','),
      )
      .join('\n');

    const blob = new Blob(
      [csv],
      {
        type: 'text/csv;charset=utf-8;',
      },
    );

    const url =
      URL.createObjectURL(blob);

    const anchor =
      document.createElement('a');

    anchor.href = url;
    anchor.download = `novamenu-pricing-report-${period}.csv`;

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    URL.revokeObjectURL(url);
  }, [
    pricingChanges,
    period,
  ]);

  const currency =
    data?.restaurant.currency || '$';

  if (loading) {
    return (
      <div
        className="flex min-h-[60vh] items-center justify-center px-6"
        style={{
          color: 'var(--portal-text)',
        }}
      >
        <div className="text-center">
          <Loader2
            className="mx-auto mb-4 animate-spin"
            size={28}
            style={{
              color: 'var(--portal-accent)',
            }}
          />

          <div className="text-xs font-black uppercase tracking-[0.2em]">
            Loading pricing report
          </div>

          <div
            className="mt-2 text-xs"
            style={{
              color:
                'var(--portal-muted)',
            }}
          >
            Reading your real menu pricing history...
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="flex min-h-[60vh] items-center justify-center px-6"
        style={{
          color: 'var(--portal-text)',
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
            className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl"
            style={{
              background:
                'rgba(239,68,68,0.12)',
              color: '#ef4444',
            }}
          >
            <Zap size={22} />
          </div>

          <h2 className="text-lg font-black">
            Could not load pricing report
          </h2>

          <p
            className="mt-2 text-sm"
            style={{
              color:
                'var(--portal-muted)',
            }}
          >
            {error}
          </p>

          <button
            type="button"
            onClick={() => loadReport()}
            className="mt-6 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black uppercase tracking-[0.12em]"
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

  if (!data) {
    return (
      <div
        className="flex min-h-[60vh] items-center justify-center px-6 text-center"
        style={{
          color: 'var(--portal-muted)',
        }}
      >
        No restaurant data available.
      </div>
    );
  }

  return (
    <div
      className="min-h-full px-4 pb-8 sm:px-6 sm:pb-10 lg:px-8 lg:pb-12"
      style={{
        color: 'var(--portal-text)',
      }}
    >
      <div className="mx-auto max-w-[1500px]">
        {/* HEADER */}
        <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div
              className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em]"
              style={{
                color:
                  'var(--portal-accent)',
              }}
            >
              <Tag size={13} />
              Reports / Pricing
            </div>

            <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
              Pricing Performance
            </h1>

            <p
              className="mt-2 max-w-2xl text-sm"
              style={{
                color:
                  'var(--portal-muted)',
              }}
            >
              Analyze real menu price changes, pricing
              activity, and current category pricing.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div
              className="flex rounded-xl border p-1"
              style={{
                borderColor:
                  'var(--portal-border)',
                background:
                  'var(--portal-surface)',
              }}
            >
              {PERIODS.map((item) => {
                const active =
                  period === item.key;

                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() =>
                      setPeriod(item.key)
                    }
                    className="rounded-lg px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] transition"
                    style={{
                      background: active
                        ? 'var(--portal-accent)'
                        : 'transparent',
                      color: active
                        ? '#fff'
                        : 'var(--portal-muted)',
                    }}
                  >
                    {item.label}
                  </button>
                );
              })}
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
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] disabled:opacity-50"
              style={{
                borderColor:
                  'var(--portal-border)',
                background:
                  'var(--portal-surface)',
                color:
                  'var(--portal-text)',
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

        {/* PERIOD INFO */}
        <div
          className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3"
          style={{
            borderColor:
              'var(--portal-border)',
            background:
              'var(--portal-surface)',
          }}
        >
          <div className="flex items-center gap-2">
            <Clock3
              size={15}
              style={{
                color:
                  'var(--portal-accent)',
              }}
            />

            <span className="text-xs font-bold">
              Showing pricing changes from{' '}
              <span className="font-black">
                {range.from.toLocaleDateString()}
              </span>{' '}
              to{' '}
              <span className="font-black">
                {range.to.toLocaleDateString()}
              </span>
            </span>
          </div>

          <div
            className="text-[10px] font-bold uppercase tracking-[0.12em]"
            style={{
              color:
                'var(--portal-muted)',
            }}
          >
            {pricingChanges.length}{' '}
            recorded change
            {pricingChanges.length === 1
              ? ''
              : 's'} in period
          </div>
        </div>

        {/* KPI GRID */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <KpiCard
            icon={
              <BarChart3 size={18} />
            }
            label="Price Changes"
            value={stats.totalChanges}
            description={`Recorded in ${PERIODS.find((p) => p.key === period)?.label}`}
          />

          <KpiCard
            icon={
              <ArrowUpRight size={18} />
            }
            label="Increases"
            value={stats.increases}
            description="Prices moved upward"
            accent="up"
          />

          <KpiCard
            icon={
              <ArrowDownRight size={18} />
            }
            label="Decreases"
            value={stats.decreases}
            description="Prices moved downward"
            accent="down"
          />

          <KpiCard
            icon={
              <Tag size={18} />
            }
            label="Repriced Items"
            value={stats.repricedItems}
            description="Unique menu items changed"
          />

          <KpiCard
            icon={
              <DollarSign size={18} />
            }
            label="Avg Current Price"
            value={formatMoney(
              stats.averageCurrentPrice,
              currency,
            )}
            description="Across current menu"
          />
        </div>

        {/* SECONDARY KPI */}
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <MetricPanel
            title="Average adjustment"
            value={`${stats.averageAdjustment >= 0 ? '+' : ''}${stats.averageAdjustment.toFixed(1)}%`}
            description="Average percentage movement across recorded changes"
            icon={
              stats.averageAdjustment > 0 ? (
                <TrendingUp size={18} />
              ) : stats.averageAdjustment < 0 ? (
                <TrendingDown size={18} />
              ) : (
                <Minus size={18} />
              )
            }
          />

          <MetricPanel
            title="Largest increase"
            value={
              largestIncrease
                ? `${largestIncrease.percentage! >= 0 ? '+' : ''}${largestIncrease.percentage!.toFixed(1)}%`
                : '—'
            }
            description={
              largestIncrease
                ? `${largestIncrease.itemName} · ${formatMoney(largestIncrease.oldPrice, currency)} → ${formatMoney(largestIncrease.newPrice, currency)}`
                : 'No increases in this period'
            }
            icon={
              <ArrowUpRight size={18} />
            }
          />

          <MetricPanel
            title="Largest decrease"
            value={
              largestDecrease
                ? `${largestDecrease.percentage!.toFixed(1)}%`
                : '—'
            }
            description={
              largestDecrease
                ? `${largestDecrease.itemName} · ${formatMoney(largestDecrease.oldPrice, currency)} → ${formatMoney(largestDecrease.newPrice, currency)}`
                : 'No decreases in this period'
            }
            icon={
              <ArrowDownRight size={18} />
            }
          />
        </div>

        {/* MAIN TABLE */}
        <div className="mt-5">
          <div
            className="overflow-hidden rounded-3xl border"
            style={{
              borderColor:
                'var(--portal-border)',
              background:
                'var(--portal-surface)',
            }}
          >
            <div className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
              style={{
                borderColor:
                  'var(--portal-border)',
              }}
            >
              <div>
                <h2 className="text-sm font-black">
                  Pricing Activity
                </h2>

                <p
                  className="mt-1 text-xs"
                  style={{
                    color:
                      'var(--portal-muted)',
                  }}
                >
                  Actual pricing history recorded by
                  NOVAMENU.
                </p>
              </div>

              {refreshing && (
                <div
                  className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.12em]"
                  style={{
                    color:
                      'var(--portal-accent)',
                  }}
                >
                  <Loader2
                    size={13}
                    className="animate-spin"
                  />
                  Updating
                </div>
              )}
            </div>

            {pricingChanges.length === 0 ? (
              <EmptyState
                title="No pricing changes in this period"
                description="Try a longer period, or make a price change in Menu Management and the report will update automatically."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left">
                  <thead>
                    <tr
                      className="border-b text-[9px] font-black uppercase tracking-[0.15em]"
                      style={{
                        borderColor:
                          'var(--portal-border)',
                        color:
                          'var(--portal-muted)',
                      }}
                    >
                      <th className="px-5 py-3">
                        Date
                      </th>

                      <th className="px-5 py-3">
                        Item
                      </th>

                      <th className="px-5 py-3">
                        Category
                      </th>

                      <th className="px-5 py-3">
                        Old Price
                      </th>

                      <th className="px-5 py-3">
                        New Price
                      </th>

                      <th className="px-5 py-3">
                        Change
                      </th>

                      <th className="px-5 py-3">
                        Summary
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {pricingChanges.map(
                      (change) => (
                        <tr
                          key={change.id}
                          className="border-b last:border-b-0"
                          style={{
                            borderColor:
                              'var(--portal-border)',
                          }}
                        >
                          <td className="px-5 py-4 text-xs">
                            {new Date(
                              change.createdAt,
                            ).toLocaleDateString()}
                          </td>

                          <td className="px-5 py-4">
                            <div className="text-xs font-black">
                              {change.itemName}
                            </div>
                          </td>

                          <td
                            className="px-5 py-4 text-xs"
                            style={{
                              color:
                                'var(--portal-muted)',
                            }}
                          >
                            {change.categoryName}
                          </td>

                          <td className="px-5 py-4 text-xs font-bold">
                            {formatMoney(
                              change.oldPrice,
                              currency,
                            )}
                          </td>

                          <td className="px-5 py-4 text-xs font-black">
                            {formatMoney(
                              change.newPrice,
                              currency,
                            )}
                          </td>

                          <td className="px-5 py-4">
                            <ChangeBadge
                              direction={
                                change.direction
                              }
                              percentage={
                                change.percentage
                              }
                            />
                          </td>

                          <td
                            className="max-w-[280px] px-5 py-4 text-xs"
                            style={{
                              color:
                                'var(--portal-muted)',
                            }}
                          >
                            {change.summary}
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* CATEGORY PRICING */}
        <div className="mt-5">
          <div
            className="overflow-hidden rounded-3xl border"
            style={{
              borderColor:
                'var(--portal-border)',
              background:
                'var(--portal-surface)',
            }}
          >
            <div
              className="border-b px-5 py-4"
              style={{
                borderColor:
                  'var(--portal-border)',
              }}
            >
              <h2 className="text-sm font-black">
                Current Pricing by Category
              </h2>

              <p
                className="mt-1 text-xs"
                style={{
                  color:
                    'var(--portal-muted)',
                }}
              >
                Current menu prices, with pricing activity
                from the selected period.
              </p>
            </div>

            {categoryPricing.length === 0 ? (
              <EmptyState
                title="No categories found"
                description="Create menu categories to see category pricing analysis."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px] text-left">
                  <thead>
                    <tr
                      className="border-b text-[9px] font-black uppercase tracking-[0.15em]"
                      style={{
                        borderColor:
                          'var(--portal-border)',
                        color:
                          'var(--portal-muted)',
                      }}
                    >
                      <th className="px-5 py-3">
                        Category
                      </th>

                      <th className="px-5 py-3">
                        Items
                      </th>

                      <th className="px-5 py-3">
                        Avg Current Price
                      </th>

                      <th className="px-5 py-3">
                        Changes
                      </th>

                      <th className="px-5 py-3">
                        Increases
                      </th>

                      <th className="px-5 py-3">
                        Decreases
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {categoryPricing.map(
                      (category) => (
                        <tr
                          key={category.id}
                          className="border-b last:border-b-0"
                          style={{
                            borderColor:
                              'var(--portal-border)',
                          }}
                        >
                          <td className="px-5 py-4">
                            <div className="text-xs font-black">
                              {category.name}
                            </div>
                          </td>

                          <td className="px-5 py-4 text-xs">
                            {category.itemCount}
                          </td>

                          <td className="px-5 py-4 text-xs font-black">
                            {formatMoney(
                              category.averagePrice,
                              currency,
                            )}
                          </td>

                          <td className="px-5 py-4 text-xs font-black">
                            {category.changes}
                          </td>

                          <td className="px-5 py-4">
                            <span
                              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-black"
                              style={{
                                background:
                                  'rgba(34,197,94,0.10)',
                                color:
                                  '#22c55e',
                              }}
                            >
                              <ArrowUpRight
                                size={12}
                              />
                              {category.increases}
                            </span>
                          </td>

                          <td className="px-5 py-4">
                            <span
                              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-black"
                              style={{
                                background:
                                  'rgba(239,68,68,0.10)',
                                color:
                                  '#ef4444',
                              }}
                            >
                              <ArrowDownRight
                                size={12}
                              />
                              {category.decreases}
                            </span>
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* INSIGHTS */}
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <div
            className="rounded-3xl border p-5"
            style={{
              borderColor:
                'var(--portal-border)',
              background:
                'var(--portal-surface)',
            }}
          >
            <div className="mb-5 flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{
                  background:
                    'rgba(83,109,254,0.12)',
                  color:
                    'var(--portal-accent)',
                }}
              >
                <BarChart3 size={18} />
              </div>

              <div>
                <h2 className="text-sm font-black">
                  Pricing Insights
                </h2>

                <p
                  className="text-xs"
                  style={{
                    color:
                      'var(--portal-muted)',
                  }}
                >
                  Based on actual recorded changes
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <InsightRow
                label="Most changed category"
                value={
                  mostChangedCategory
                    ? mostChangedCategory.name
                    : '—'
                }
                detail={
                  mostChangedCategory
                    ? `${mostChangedCategory.changes} change${mostChangedCategory.changes === 1 ? '' : 's'} in selected period`
                    : 'No category changes'
                }
              />

              <InsightRow
                label="Largest increase"
                value={
                  largestIncrease
                    ? `${largestIncrease.percentage! >= 0 ? '+' : ''}${largestIncrease.percentage!.toFixed(1)}%`
                    : '—'
                }
                detail={
                  largestIncrease
                    ? largestIncrease.itemName
                    : 'No increases'
                }
              />

              <InsightRow
                label="Largest decrease"
                value={
                  largestDecrease
                    ? `${largestDecrease.percentage!.toFixed(1)}%`
                    : '—'
                }
                detail={
                  largestDecrease
                    ? largestDecrease.itemName
                    : 'No decreases'
                }
              />
            </div>
          </div>

          <div
            className="rounded-3xl border p-5"
            style={{
              borderColor:
                'var(--portal-border)',
              background:
                'var(--portal-surface)',
            }}
          >
            <div className="mb-5 flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{
                  background:
                    'rgba(118,91,213,0.12)',
                  color:
                    'var(--portal-accent-2, #765BD5)',
                }}
              >
                <Zap size={18} />
              </div>

              <div>
                <h2 className="text-sm font-black">
                  Recommendation
                </h2>

                <p
                  className="text-xs"
                  style={{
                    color:
                      'var(--portal-muted)',
                  }}
                >
                  Automated interpretation
                </p>
              </div>
            </div>

            <p
              className="text-sm leading-7"
              style={{
                color:
                  'var(--portal-muted)',
              }}
            >
              {recommendation}
            </p>

            <div
              className="mt-5 flex items-center gap-2 rounded-xl border px-3 py-3 text-[10px] font-bold"
              style={{
                borderColor:
                  'var(--portal-border)',
                background:
                  'rgba(83,109,254,0.05)',
              }}
            >
              <CheckCircle2
                size={14}
                style={{
                  color:
                    'var(--portal-accent)',
                }}
              />

              Report uses live menu and pricing-history
              data.
            </div>
          </div>
        </div>

        {/* DATA STATUS */}
        <div
          className="mt-5 flex flex-col gap-2 rounded-2xl border px-4 py-3 text-[10px] font-bold sm:flex-row sm:items-center sm:justify-between"
          style={{
            borderColor:
              'var(--portal-border)',
            background:
              'var(--portal-surface)',
            color:
              'var(--portal-muted)',
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

            Live report data
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
  icon,
  label,
  value,
  description,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  description: string;
  accent?: 'up' | 'down';
}) {
  const accentColor =
    accent === 'up'
      ? '#22c55e'
      : accent === 'down'
        ? '#ef4444'
        : 'var(--portal-accent)';

  return (
    <div
      className="rounded-3xl border p-5"
      style={{
        borderColor:
          'var(--portal-border)',
        background:
          'var(--portal-surface)',
      }}
    >
      <div
        className="mb-4 flex h-9 w-9 items-center justify-center rounded-xl"
        style={{
          background:
            accent === 'up'
              ? 'rgba(34,197,94,0.10)'
              : accent === 'down'
                ? 'rgba(239,68,68,0.10)'
                : 'rgba(83,109,254,0.10)',
          color: accentColor,
        }}
      >
        {icon}
      </div>

      <div
        className="text-[9px] font-black uppercase tracking-[0.15em]"
        style={{
          color:
            'var(--portal-muted)',
        }}
      >
        {label}
      </div>

      <div className="mt-1 text-2xl font-black tracking-tight">
        {value}
      </div>

      <div
        className="mt-1 text-[10px]"
        style={{
          color:
            'var(--portal-muted)',
        }}
      >
        {description}
      </div>
    </div>
  );
}

function MetricPanel({
  title,
  value,
  description,
  icon,
}: {
  title: string;
  value: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <div
      className="rounded-3xl border p-5"
      style={{
        borderColor:
          'var(--portal-border)',
        background:
          'var(--portal-surface)',
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div
            className="text-[9px] font-black uppercase tracking-[0.15em]"
            style={{
              color:
                'var(--portal-muted)',
            }}
          >
            {title}
          </div>

          <div className="mt-2 text-xl font-black">
            {value}
          </div>

          <div
            className="mt-1 text-xs"
            style={{
              color:
                'var(--portal-muted)',
            }}
          >
            {description}
          </div>
        </div>

        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{
            background:
              'rgba(83,109,254,0.10)',
            color:
              'var(--portal-accent)',
          }}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

function ChangeBadge({
  direction,
  percentage,
}: {
  direction:
    | 'increase'
    | 'decrease'
    | 'unchanged';
  percentage: number | null;
}) {
  if (direction === 'increase') {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-black"
        style={{
          background:
            'rgba(34,197,94,0.10)',
          color: '#22c55e',
        }}
      >
        <ArrowUpRight size={12} />

        {percentage == null
          ? 'Increase'
          : `+${percentage.toFixed(1)}%`}
      </span>
    );
  }

  if (direction === 'decrease') {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-black"
        style={{
          background:
            'rgba(239,68,68,0.10)',
          color: '#ef4444',
        }}
      >
        <ArrowDownRight size={12} />

        {percentage == null
          ? 'Decrease'
          : `${percentage.toFixed(1)}%`}
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-black"
      style={{
        background:
          'rgba(148,163,184,0.10)',
        color:
          'var(--portal-muted)',
      }}
    >
      <Minus size={12} />
      No change
    </span>
  );
}

function InsightRow({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div
      className="flex items-center justify-between gap-4 rounded-2xl border px-4 py-3"
      style={{
        borderColor:
          'var(--portal-border)',
      }}
    >
      <div>
        <div className="text-xs font-black">
          {label}
        </div>

        <div
          className="mt-1 text-[10px]"
          style={{
            color:
              'var(--portal-muted)',
          }}
        >
          {detail}
        </div>
      </div>

      <div
        className="shrink-0 text-sm font-black"
        style={{
          color:
            'var(--portal-accent)',
        }}
      >
        {value}
      </div>
    </div>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="px-6 py-14 text-center">
      <div
        className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl"
        style={{
          background:
            'rgba(83,109,254,0.10)',
          color:
            'var(--portal-accent)',
        }}
      >
        <BarChart3 size={20} />
      </div>

      <div className="mt-4 text-sm font-black">
        {title}
      </div>

      <div
        className="mx-auto mt-2 max-w-md text-xs leading-6"
        style={{
          color:
            'var(--portal-muted)',
        }}
      >
        {description}
      </div>
    </div>
  );
}