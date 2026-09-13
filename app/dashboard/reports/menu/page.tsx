'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  Eye,
  FileText,
  Flame,
  Package,
  RefreshCw,
  Search,
  ShoppingBag,
  Tag,
  TrendingUp,
  UtensilsCrossed,
} from 'lucide-react';

import {
  getReportsData,
  getCurrentRestaurantId,
  ReportsData,
  ReportMenuItem,
} from '@/lib/reports/data';

import { supabase } from '@/lib/supabase';
import ReportDateRangePicker from '@/components/report-date-range-picker';

type Period =
  | '7d'
  | '30d'
  | '90d'
  | '12m'
  | 'custom';

type MenuPerformanceRow = {
  id: string;
  name: string;
  categoryName: string;
  isAvailable: boolean;
  price: number;
  promotion: string | null;
  sold: number;
  revenue: number;
  rank: number | null;
};

type CategoryPerformanceRow = {
  id: string;
  name: string;
  items: number;
  sold: number;
  revenue: number;
};

function normalizeItemName(
  value: string | null | undefined
) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function getHistoricalMenuItemName(
  value: string | null | undefined
) {
  return normalizeItemName(value).split(/\s+\+\s+/, 1)[0];
}

function getPeriodRange(
  period: Period,
  customFrom?: string,
  customTo?: string,
) {
  const now = new Date();

  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0,
    0
  );

  const end = new Date(today);

  end.setDate(
    end.getDate() + 1
  );

  const start = new Date(today);

  if (period === 'custom' && customFrom && customTo) {
    const customEnd = new Date(`${customTo}T00:00:00`);
    customEnd.setDate(customEnd.getDate() + 1);
    return {
      start: new Date(`${customFrom}T00:00:00`),
      end: customEnd,
    };
  }

  if (period === '7d') {
    start.setDate(
      start.getDate() - 6
    );
  }

  if (period === '30d') {
    start.setDate(
      start.getDate() - 29
    );
  }

  if (period === '90d') {
    start.setDate(
      start.getDate() - 89
    );
  }

  if (period === '12m') {
    start.setDate(1);
    start.setMonth(
      start.getMonth() - 11
    );
  }

  return {
    start,
    end,
  };
}

function isCompletedOrActiveSale(
  status: string | null | undefined
) {
  const value = String(status ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

  /*
   * Only cancelled/rejected/voided orders
   * are excluded.
   *
   * If an order exists in Orders and isn't
   * cancelled, its items are sales activity.
   */
  return ![
    'cancelled',
    'canceled',
    'rejected',
    'declined',
    'voided',
  ].includes(value);
}

function formatCurrency(
  value: number,
  currency: string | null | undefined
) {
  try {
    return new Intl.NumberFormat(
      'en-US',
      {
        style: 'currency',
        currency:
          currency || 'USD',
        maximumFractionDigits: 2,
      }
    ).format(value);
  } catch {
    return `${currency || 'USD'} ${value.toFixed(
      2
    )}`;
  }
}

function formatDate(
  date: Date
) {
  return date.toLocaleDateString(
    'en-US',
    {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }
  );
}

function getPeriodLabel(
  period: Period
) {
  if (period === '7d')
    return 'Last 7 days';

  if (period === '30d')
    return 'Last 30 days';

  if (period === '90d')
    return 'Last 90 days';

  return 'Last 12 months';
}

function getCategoryName(
  categoryId: string | null,
  categories: ReportsData['categories']
) {
  if (!categoryId) {
    return 'Uncategorized';
  }

  return (
    categories.find(
      (category) =>
        category.id ===
        categoryId
    )?.name ||
    'Uncategorized'
  );
}

function getPromotionInfo(
  item: ReportMenuItem
) {
  if (
    !item.discount_enabled
  ) {
    return null;
  }

  const value = Number(
    item.discount_value ?? 0
  );

  if (
    !Number.isFinite(value) ||
    value <= 0
  ) {
    return null;
  }

  if (
    item.discount_type ===
    'percentage'
  ) {
    return `${value}% off`;
  }

  if (
    item.discount_type ===
    'fixed'
  ) {
    return `${value.toFixed(
      2
    )} off`;
  }

  return String(value);
}

function getInitials(
  name: string
) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(
      (part) =>
        part.charAt(0).toUpperCase()
    )
    .join('');
}

export default function MenuReportPage() {
  const [data, setData] =
    useState<ReportsData | null>(
      null
    );

  const [period, setPeriod] =
    useState<Period>('7d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [search, setSearch] =
    useState('');

  const [categoryFilter, setCategoryFilter] =
    useState('all');

  const [
    availabilityFilter,
    setAvailabilityFilter,
  ] = useState<
    'all' |
    'available' |
    'unavailable'
  >('all');

  const [sortBy, setSortBy] =
    useState<
      'sold' |
      'revenue' |
      'name' |
      'price'
    >('revenue');

  const [
    sortDirection,
    setSortDirection,
  ] = useState<
    'asc' | 'desc'
  >('desc');

  /*
   * ==========================================================
   * PERIOD
   * ==========================================================
   */

  const {
    start: periodStart,
    end: periodEnd,
  } = useMemo(
    () =>
      getPeriodRange(period, customFrom, customTo),
    [period, customFrom, customTo]
  );

  /*
   * ==========================================================
   * LOAD REAL DATABASE DATA
   * ==========================================================
   */

  const loadReport = async (
    silent = false
  ) => {
    try {
      if (silent || data) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError(null);

      /*
       * Pass the REAL selected period to Supabase.
       *
       * This means the database itself returns only
       * orders whose created_at belongs to the period.
       */

      const result =
        await getReportsData({
          from:
            periodStart.toISOString(),

          to:
            periodEnd.toISOString(),
        });

      setData(result);
    } catch (err) {
      console.error(
        'Menu report loading failed:',
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : 'Could not load menu report.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  /*
   * Reload whenever the period changes.
   */

  useEffect(() => {
    loadReport();
  }, [
    periodStart.getTime(),
    periodEnd.getTime(),
  ]);

  /*
   * ==========================================================
   * REALTIME
   * ==========================================================
   *
   * If an order is changed from Preparing -> Delivered,
   * Orders table changes and this report reloads.
   */

  useEffect(() => {
    let channel:
      ReturnType<
        typeof supabase.channel
      > | null = null;

    let mounted = true;

    async function subscribe() {
      const restaurantId =
        await getCurrentRestaurantId();

      if (
        !mounted ||
        !restaurantId
      ) {
        return;
      }

      channel =
        supabase
          .channel(
            `menu-report-${restaurantId}`
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
            }
          )
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'order_items',
            },
            () => {
              loadReport(true);
            }
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
            }
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
            }
          )
          .subscribe();
    }

    subscribe();

    return () => {
      mounted = false;

      if (channel) {
        supabase.removeChannel(
          channel
        );
      }
    };
  }, [periodStart.getTime(), periodEnd.getTime()]);

  /*
   * ==========================================================
   * ORDERS
   * ==========================================================
   *
   * data.orders is already filtered by created_at by
   * getReportsData().
   */

  const periodOrders =
    useMemo(() => {
      if (!data) {
        return [];
      }

      return data.orders;
    }, [data]);

  const reportOrders =
    useMemo(() => {
      return periodOrders.filter(
        (order) =>
          isCompletedOrActiveSale(
            order.status
          )
      );
    }, [periodOrders]);

  /*
   * ==========================================================
   * MENU LOOKUPS
   * ==========================================================
   */

  const menuItemById =
    useMemo(() => {
      const map =
        new Map<
          string,
          ReportMenuItem
        >();

      if (!data) {
        return map;
      }

      for (const item of
        data.menuItems) {
        map.set(
          item.id,
          item
        );
      }

      return map;
    }, [data]);

  const menuItemsByName =
    useMemo(() => {
      const map =
        new Map<
          string,
          ReportMenuItem[]
        >();

      if (!data) {
        return map;
      }

      for (const item of
        data.menuItems) {
        const key =
          normalizeItemName(
            item.name
          );

        if (!key) {
          continue;
        }

        const current =
          map.get(key) ?? [];

        current.push(item);

        map.set(
          key,
          current
        );
      }

      return map;
    }, [data]);

  /*
   * ==========================================================
   * ACTUAL SALES
   * ==========================================================
   */

  const salesByMenuItem =
    useMemo(() => {
      const sales =
        new Map<
          string,
          {
            sold: number;
            revenue: number;
          }
        >();

      if (!data) {
        return sales;
      }

      /*
       * These are the ONLY orders allowed to
       * contribute to this report.
       */
      const validOrderIds =
        new Set(
          reportOrders.map(
            (order) =>
              order.id
          )
        );

      for (const orderItem of
        data.orderItems) {
        /*
         * The parent order determines the
         * item's date/period.
         */
        if (
          !validOrderIds.has(
            orderItem.order_id
          )
        ) {
          continue;
        }

        let menuItem:
          | ReportMenuItem
          | null = null;

        /*
         * FIRST:
         * Use the real menu_item_id.
         */
        if (
          orderItem.menu_item_id
        ) {
          menuItem =
            menuItemById.get(
              orderItem.menu_item_id
            ) ?? null;
        }

        /*
         * SECOND:
         * Old order_items may have NULL menu_item_id.
         *
         * In that case match the actual historical
         * item name against the CURRENT menu.
         */
        if (!menuItem) {
          const key =
            getHistoricalMenuItemName(
              orderItem.item_name
            );

          const matches =
            menuItemsByName.get(
              key
            ) ??
            data.menuItems.filter(
              (item) =>
                getHistoricalMenuItemName(
                  item.name
                ) === key
            );

          /*
           * Only map automatically if the name
           * identifies exactly one current item.
           */
          if (
            matches.length === 1
          ) {
            menuItem =
              matches[0];
          }
        }

        /*
         * Never invent a menu item.
         */
        if (!menuItem) {
          continue;
        }

        const quantity =
          Number(
            orderItem.quantity
          );

        const unitPrice =
          Number(
            orderItem.unit_price
          );

        if (
          !Number.isFinite(
            quantity
          ) ||
          quantity <= 0
        ) {
          continue;
        }

        if (
          !Number.isFinite(
            unitPrice
          ) ||
          unitPrice < 0
        ) {
          continue;
        }

        const current =
          sales.get(
            menuItem.id
          ) ?? {
            sold: 0,
            revenue: 0,
          };

        current.sold +=
          quantity;

        current.revenue +=
          quantity *
          unitPrice;

        sales.set(
          menuItem.id,
          current
        );
      }

      return sales;
    }, [
      data,
      reportOrders,
      menuItemById,
      menuItemsByName,
    ]);

  /*
   * ==========================================================
   * MENU ROWS
   * ==========================================================
   */

  const menuRows =
    useMemo(() => {
      if (!data) {
        return [];
      }

      const rows: MenuPerformanceRow[] =
        data.menuItems.map(
          (item) => {
            const sales =
              salesByMenuItem.get(
                item.id
              );

            return {
              id: item.id,

              name: item.name,

              categoryName:
                getCategoryName(
                  item.category_id,
                  data.categories
                ),

              isAvailable:
                item.is_available,

              /*
               * ALWAYS current Menu Management price.
               */
              price:
                Number(
                  item.price ?? 0
                ),

              promotion:
                getPromotionInfo(
                  item
                ),

              /*
               * REAL sales in selected period.
               */
              sold:
                sales?.sold ?? 0,

              /*
               * REAL historical revenue.
               */
              revenue:
                sales?.revenue ??
                0,

              rank: null,
            };
          }
        );

      /*
       * Rank based on actual period revenue.
       */
      const ranked =
        [...rows]
          .filter(
            (row) =>
              row.sold > 0
          )
          .sort((a, b) => {
            if (
              b.revenue !==
              a.revenue
            ) {
              return (
                b.revenue -
                a.revenue
              );
            }

            return (
              b.sold -
              a.sold
            );
          });

      const rankMap =
        new Map<
          string,
          number
        >();

      ranked.forEach(
        (row, index) => {
          rankMap.set(
            row.id,
            index + 1
          );
        }
      );

      return rows.map(
        (row) => ({
          ...row,
          rank:
            rankMap.get(
              row.id
            ) ?? null,
        })
      );
    }, [
      data,
      salesByMenuItem,
    ]);

  /*
   * ==========================================================
   * FILTER
   * ==========================================================
   */

  const filteredMenuRows =
    useMemo(() => {
      const q =
        search
          .trim()
          .toLowerCase();

      const rows =
        menuRows.filter(
          (row) => {
            if (
              q &&
              !row.name
                .toLowerCase()
                .includes(q) &&
              !row.categoryName
                .toLowerCase()
                .includes(q)
            ) {
              return false;
            }

            if (
              categoryFilter !==
                'all' &&
              row.categoryName !==
                categoryFilter
            ) {
              return false;
            }

            if (
              availabilityFilter ===
                'available' &&
              !row.isAvailable
            ) {
              return false;
            }

            if (
              availabilityFilter ===
                'unavailable' &&
              row.isAvailable
            ) {
              return false;
            }

            return true;
          }
        );

      rows.sort((a, b) => {
        let value = 0;

        if (
          sortBy === 'sold'
        ) {
          value =
            a.sold - b.sold;
        } else if (
          sortBy === 'revenue'
        ) {
          value =
            a.revenue -
            b.revenue;
        } else if (
          sortBy === 'price'
        ) {
          value =
            a.price - b.price;
        } else {
          value =
            a.name.localeCompare(
              b.name
            );
        }

        return sortDirection ===
          'asc'
          ? value
          : -value;
      });

      return rows;
    }, [
      menuRows,
      search,
      categoryFilter,
      availabilityFilter,
      sortBy,
      sortDirection,
    ]);

  /*
   * ==========================================================
   * CATEGORIES
   * ==========================================================
   */

  const categoryRows =
    useMemo(() => {
      if (!data) {
        return [];
      }

      const map =
        new Map<
          string,
          CategoryPerformanceRow
        >();

      /*
       * Start from CURRENT categories/menu items.
       */
      for (const item of
        data.menuItems) {
        const key =
          item.category_id ??
          '__uncategorized__';

        const name =
          getCategoryName(
            item.category_id,
            data.categories
          );

        const existing =
          map.get(key) ?? {
            id: key,
            name,
            items: 0,
            sold: 0,
            revenue: 0,
          };

        /*
         * Number of current menu items
         * in this category.
         */
        existing.items += 1;

        const sales =
          salesByMenuItem.get(
            item.id
          );

        if (sales) {
          existing.sold +=
            sales.sold;

          existing.revenue +=
            sales.revenue;
        }

        map.set(
          key,
          existing
        );
      }

      return Array.from(
        map.values()
      ).sort((a, b) => {
        if (
          b.revenue !==
          a.revenue
        ) {
          return (
            b.revenue -
            a.revenue
          );
        }

        return (
          b.sold - a.sold
        );
      });
    }, [
      data,
      salesByMenuItem,
    ]);

  /*
   * ==========================================================
   * TOTALS
   * ==========================================================
   */

  const totalRevenue =
    useMemo(() => {
      let total = 0;

      for (const value of
        salesByMenuItem.values()) {
        total +=
          value.revenue;
      }

      return total;
    }, [salesByMenuItem]);

  const totalItemsSold =
    useMemo(() => {
      let total = 0;

      for (const value of
        salesByMenuItem.values()) {
        total += value.sold;
      }

      return total;
    }, [salesByMenuItem]);

  const totalOrders =
    reportOrders.length;

  const averageOrderValue =
    totalOrders > 0
      ? totalRevenue /
        totalOrders
      : 0;

  const topItem =
    useMemo(() => {
      return (
        [...menuRows]
          .filter(
            (row) =>
              row.sold > 0
          )
          .sort((a, b) => {
            if (
              b.revenue !==
              a.revenue
            ) {
              return (
                b.revenue -
                a.revenue
              );
            }

            return (
              b.sold -
              a.sold
            );
          })[0] ??
        null
      );
    }, [menuRows]);

  const topCategory =
    categoryRows[0] ??
    null;

  const categoryOptions =
    useMemo(() => {
      if (!data) {
        return [];
      }

      return data.categories
        .slice()
        .sort(
          (a, b) =>
            (a.sort_order ??
              999999) -
            (b.sort_order ??
              999999)
        )
        .map(
          (category) =>
            category.name
        );
    }, [data]);

  /*
   * ==========================================================
   * COLORS
   * ==========================================================
   */

  const textColor =
    'var(--portal-text, #202534)';

  const mutedColor =
    'var(--portal-muted, #73798a)';

  const surfaceColor =
    'var(--portal-surface, rgba(255,255,255,0.72))';

  const borderColor =
    'var(--portal-border, rgba(32,37,52,0.10))';

  const accentColor =
    'var(--portal-accent, #536DFE)';

  const secondaryAccent =
    'var(--portal-accent-secondary, #765BD5)';

  /*
   * ==========================================================
   * LOADING
   * ==========================================================
   */

  if (loading) {
    return (
      <div
        className="flex min-h-[60vh] items-center justify-center"
        style={{
          color: mutedColor,
        }}
      >
        <div className="flex items-center gap-3">
          <RefreshCw
            className="h-5 w-5 animate-spin"
            style={{
              color: accentColor,
            }}
          />

          <span className="text-sm font-semibold">
            Loading menu performance...
          </span>
        </div>
      </div>
    );
  }

  /*
   * ==========================================================
   * ERROR
   * ==========================================================
   */

  if (error) {
    return (
      <div className="px-6 py-10">
        <div
          className="mx-auto max-w-2xl rounded-3xl border p-8 text-center"
          style={{
            background:
              surfaceColor,
            borderColor,
            color: textColor,
          }}
        >
          <BarChart3
            className="mx-auto h-8 w-8"
            style={{
              color: accentColor,
            }}
          />

          <h2 className="mt-4 text-lg font-black">
            Could not load report
          </h2>

          <p
            className="mt-2 text-sm"
            style={{
              color: mutedColor,
            }}
          >
            {error}
          </p>

          <button
            type="button"
            onClick={() =>
              loadReport(true)
            }
            className="mt-6 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white"
            style={{
              background:
                accentColor,
            }}
          >
            <RefreshCw className="h-4 w-4" />
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div
        className="flex min-h-[60vh] items-center justify-center text-sm"
        style={{
          color: mutedColor,
        }}
      >
        No restaurant data found.
      </div>
    );
  }

  /*
   * ==========================================================
   * UI
   * ==========================================================
   */

  return (
    <div className="space-y-6 px-4 pb-12 sm:px-6 lg:px-8">
      {/* HEADER */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div
            className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em]"
            style={{
              color: accentColor,
            }}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            Reports
          </div>

          <h1
            className="text-2xl font-black tracking-tight sm:text-3xl"
            style={{
              color: textColor,
            }}
          >
            Menu Performance
          </h1>

          <p
            className="mt-1 text-sm"
            style={{
              color: mutedColor,
            }}
          >
            Actual menu sales and
            performance from your orders.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            loadReport(true)
          }
          disabled={refreshing}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-bold transition hover:opacity-80 disabled:opacity-50"
          style={{
            borderColor,
            background:
              surfaceColor,
            color: textColor,
          }}
        >
          <RefreshCw
            className={
              refreshing
                ? 'h-4 w-4 animate-spin'
                : 'h-4 w-4'
            }
          />

          Refresh
        </button>
      </div>

      {/* PERIOD */}
      <div
        className="flex flex-col gap-3 rounded-2xl border p-3 sm:flex-row sm:items-center sm:justify-between"
        style={{
          background:
            surfaceColor,
          borderColor,
        }}
      >
        <div className="flex flex-wrap gap-2">
          {(
            [
              ['7d', '7 Days'],
              ['30d', '30 Days'],
              ['90d', '90 Days'],
              ['12m', '12 Months'],
            ] as [
              Period,
              string
            ][]
          ).map(
            ([value, label]) => {
              const active =
                period === value;

              return (
                <button
                  key={value}
                  type="button"
                  onClick={() =>
                    setPeriod(
                      value
                    )
                  }
                  className="rounded-xl px-4 py-2 text-xs font-black"
                  style={{
                    background:
                      active
                        ? accentColor
                        : 'transparent',
                    color: active
                      ? '#fff'
                      : mutedColor,
                  }}
                >
                  {label}
                </button>
              );
            }
          )}
          <ReportDateRangePicker
            period={period}
            onPeriodChange={(value) => setPeriod(value as Period)}
            from={customFrom}
            to={customTo}
            onFromChange={setCustomFrom}
            onToChange={setCustomTo}
          />
        </div>

        <div
          className="text-xs font-semibold"
          style={{
            color: mutedColor,
          }}
        >
          {formatDate(
            periodStart
          )}{' '}
          —{' '}
          {formatDate(
            new Date(
              periodEnd.getTime() -
                1
            )
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div
          className="rounded-2xl border p-5"
          style={{
            background:
              surfaceColor,
            borderColor,
          }}
        >
          <div className="flex items-start justify-between">
            <div>
              <p
                className="text-[10px] font-black uppercase tracking-[0.16em]"
                style={{
                  color: mutedColor,
                }}
              >
                Revenue
              </p>

              <p
                className="mt-2 text-2xl font-black"
                style={{
                  color: textColor,
                }}
              >
                {formatCurrency(
                  totalRevenue,
                  data.restaurant
                    .currency
                )}
              </p>
            </div>

            <CircleDollarSign
              className="h-5 w-5"
              style={{
                color: accentColor,
              }}
            />
          </div>
        </div>

        <div
          className="rounded-2xl border p-5"
          style={{
            background:
              surfaceColor,
            borderColor,
          }}
        >
          <div className="flex items-start justify-between">
            <div>
              <p
                className="text-[10px] font-black uppercase tracking-[0.16em]"
                style={{
                  color: mutedColor,
                }}
              >
                Orders
              </p>

              <p
                className="mt-2 text-2xl font-black"
                style={{
                  color: textColor,
                }}
              >
                {totalOrders.toLocaleString()}
              </p>
            </div>

            <ShoppingBag
              className="h-5 w-5"
              style={{
                color:
                  secondaryAccent,
              }}
            />
          </div>
        </div>

        <div
          className="rounded-2xl border p-5"
          style={{
            background:
              surfaceColor,
            borderColor,
          }}
        >
          <div className="flex items-start justify-between">
            <div>
              <p
                className="text-[10px] font-black uppercase tracking-[0.16em]"
                style={{
                  color: mutedColor,
                }}
              >
                Items Sold
              </p>

              <p
                className="mt-2 text-2xl font-black"
                style={{
                  color: textColor,
                }}
              >
                {totalItemsSold.toLocaleString()}
              </p>
            </div>

            <Package
              className="h-5 w-5"
              style={{
                color: accentColor,
              }}
            />
          </div>
        </div>

        <div
          className="rounded-2xl border p-5"
          style={{
            background:
              surfaceColor,
            borderColor,
          }}
        >
          <div className="flex items-start justify-between">
            <div>
              <p
                className="text-[10px] font-black uppercase tracking-[0.16em]"
                style={{
                  color: mutedColor,
                }}
              >
                Avg. Order
              </p>

              <p
                className="mt-2 text-2xl font-black"
                style={{
                  color: textColor,
                }}
              >
                {formatCurrency(
                  averageOrderValue,
                  data.restaurant
                    .currency
                )}
              </p>
            </div>

            <TrendingUp
              className="h-5 w-5"
              style={{
                color:
                  secondaryAccent,
              }}
            />
          </div>
        </div>
      </div>

      {/* TOP PERFORMERS */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div
          className="rounded-2xl border p-5"
          style={{
            background:
              surfaceColor,
            borderColor,
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p
                className="text-[10px] font-black uppercase tracking-[0.16em]"
                style={{
                  color: mutedColor,
                }}
              >
                Top Menu Item
              </p>

              <h2
                className="mt-1 text-lg font-black"
                style={{
                  color: textColor,
                }}
              >
                Best seller
              </h2>
            </div>

            <Flame
              className="h-5 w-5"
              style={{
                color: accentColor,
              }}
            />
          </div>

          {topItem ? (
            <div className="mt-5 flex items-center gap-4">
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-sm font-black text-white"
                style={{
                  background: `linear-gradient(135deg, ${accentColor}, ${secondaryAccent})`,
                }}
              >
                {getInitials(
                  topItem.name
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p
                  className="truncate font-black"
                  style={{
                    color: textColor,
                  }}
                >
                  {topItem.name}
                </p>

                <p
                  className="mt-1 text-xs"
                  style={{
                    color: mutedColor,
                  }}
                >
                  {topItem.sold.toLocaleString()}{' '}
                  sold
                </p>
              </div>

              <p
                className="font-black"
                style={{
                  color: textColor,
                }}
              >
                {formatCurrency(
                  topItem.revenue,
                  data.restaurant
                    .currency
                )}
              </p>
            </div>
          ) : (
            <p
              className="mt-6 text-sm"
              style={{
                color: mutedColor,
              }}
            >
              No sales in this period.
            </p>
          )}
        </div>

        <div
          className="rounded-2xl border p-5"
          style={{
            background:
              surfaceColor,
            borderColor,
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p
                className="text-[10px] font-black uppercase tracking-[0.16em]"
                style={{
                  color: mutedColor,
                }}
              >
                Top Category
              </p>

              <h2
                className="mt-1 text-lg font-black"
                style={{
                  color: textColor,
                }}
              >
                Best category
              </h2>
            </div>

            <UtensilsCrossed
              className="h-5 w-5"
              style={{
                color:
                  secondaryAccent,
              }}
            />
          </div>

          {topCategory ? (
            <div className="mt-5 flex items-center gap-4">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-2xl"
                style={{
                  background: `${secondaryAccent}12`,
                  color:
                    secondaryAccent,
                }}
              >
                <UtensilsCrossed className="h-5 w-5" />
              </div>

              <div className="min-w-0 flex-1">
                <p
                  className="truncate font-black"
                  style={{
                    color: textColor,
                  }}
                >
                  {topCategory.name}
                </p>

                <p
                  className="mt-1 text-xs"
                  style={{
                    color: mutedColor,
                  }}
                >
                  {topCategory.sold.toLocaleString()}{' '}
                  sold
                </p>
              </div>

              <p
                className="font-black"
                style={{
                  color: textColor,
                }}
              >
                {formatCurrency(
                  topCategory.revenue,
                  data.restaurant
                    .currency
                )}
              </p>
            </div>
          ) : (
            <p
              className="mt-6 text-sm"
              style={{
                color: mutedColor,
              }}
            >
              No category sales.
            </p>
          )}
        </div>
      </div>

      {/* FILTERS */}
      <div
        className="rounded-2xl border p-4"
        style={{
          background:
            surfaceColor,
          borderColor,
        }}
      >
        <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto_auto]">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
              style={{
                color: mutedColor,
              }}
            />

            <input
              value={search}
              onChange={(e) =>
                setSearch(
                  e.target.value
                )
              }
              placeholder="Search menu items..."
              className="h-10 w-full rounded-xl border bg-transparent pl-9 pr-3 text-sm outline-none"
              style={{
                borderColor,
                color: textColor,
              }}
            />
          </div>

          <div className="relative">
            <select
              value={
                categoryFilter
              }
              onChange={(e) =>
                setCategoryFilter(
                  e.target.value
                )
              }
              className="h-10 min-w-[170px] appearance-none rounded-xl border bg-transparent px-3 pr-9 text-sm font-semibold"
              style={{
                borderColor,
                color: textColor,
              }}
            >
              <option value="all">
                All categories
              </option>

              {categoryOptions.map(
                (category) => (
                  <option
                    key={category}
                    value={category}
                  >
                    {category}
                  </option>
                )
              )}
            </select>

            <ChevronDown
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2"
              style={{
                color: mutedColor,
              }}
            />
          </div>

          <div className="relative">
            <select
              value={
                availabilityFilter
              }
              onChange={(e) =>
                setAvailabilityFilter(
                  e.target
                    .value as
                    | 'all'
                    | 'available'
                    | 'unavailable'
                )
              }
              className="h-10 min-w-[150px] appearance-none rounded-xl border bg-transparent px-3 pr-9 text-sm font-semibold"
              style={{
                borderColor,
                color: textColor,
              }}
            >
              <option value="all">
                All availability
              </option>

              <option value="available">
                Available
              </option>

              <option value="unavailable">
                Unavailable
              </option>
            </select>

            <ChevronDown
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2"
              style={{
                color: mutedColor,
              }}
            />
          </div>

          <div className="flex gap-2">
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) =>
                  setSortBy(
                    e.target
                      .value as
                      | 'sold'
                      | 'revenue'
                      | 'name'
                      | 'price'
                  )
                }
                className="h-10 min-w-[135px] appearance-none rounded-xl border bg-transparent px-3 pr-9 text-sm font-semibold"
                style={{
                  borderColor,
                  color: textColor,
                }}
              >
                <option value="revenue">
                  Revenue
                </option>

                <option value="sold">
                  Sold
                </option>

                <option value="name">
                  Name
                </option>

                <option value="price">
                  Price
                </option>
              </select>

              <ChevronDown
                className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2"
                style={{
                  color: mutedColor,
                }}
              />
            </div>

            <button
              type="button"
              onClick={() =>
                setSortDirection(
                  (v) =>
                    v === 'asc'
                      ? 'desc'
                      : 'asc'
                )
              }
              className="flex h-10 w-10 items-center justify-center rounded-xl border"
              style={{
                borderColor,
                color: textColor,
              }}
            >
              {sortDirection ===
              'asc' ? (
                <ArrowUp className="h-4 w-4" />
              ) : (
                <ArrowDown className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* MENU TABLE */}
      <div
        className="overflow-hidden rounded-2xl border"
        style={{
          background:
            surfaceColor,
          borderColor,
        }}
      >
        <div className="flex flex-col gap-3 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <ShoppingBag
                className="h-5 w-5"
                style={{
                  color: accentColor,
                }}
              />

              <h2
                className="text-lg font-black"
                style={{
                  color: textColor,
                }}
              >
                Menu Items
              </h2>
            </div>

            <p
              className="mt-1 text-xs"
              style={{
                color: mutedColor,
              }}
            >
              Actual menu items and their
              actual sales during the selected
              period.
            </p>
          </div>

          <span
            className="text-xs font-bold"
            style={{
              color: mutedColor,
            }}
          >
            {filteredMenuRows.length} of{' '}
            {menuRows.length} items
          </span>
        </div>

        {filteredMenuRows.length ===
        0 ? (
          <div
            className="p-12 text-center"
            style={{
              color: mutedColor,
            }}
          >
            <Eye className="mx-auto h-6 w-6" />

            <p
              className="mt-3 font-bold"
              style={{
                color: textColor,
              }}
            >
              No menu items found
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px]">
              <thead>
                <tr
                  className="border-b text-left"
                  style={{
                    borderColor,
                  }}
                >
                  <th
                    className="px-5 py-3 text-[10px] font-black uppercase tracking-[0.14em]"
                    style={{
                      color: mutedColor,
                    }}
                  >
                    Item
                  </th>

                  <th
                    className="px-4 py-3 text-[10px] font-black uppercase tracking-[0.14em]"
                    style={{
                      color: mutedColor,
                    }}
                  >
                    Category
                  </th>

                  <th
                    className="px-4 py-3 text-[10px] font-black uppercase tracking-[0.14em]"
                    style={{
                      color: mutedColor,
                    }}
                  >
                    Status
                  </th>

                  <th
                    className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-[0.14em]"
                    style={{
                      color: mutedColor,
                    }}
                  >
                    Current Price
                  </th>

                  <th
                    className="px-4 py-3 text-center text-[10px] font-black uppercase tracking-[0.14em]"
                    style={{
                      color: mutedColor,
                    }}
                  >
                    Promotion
                  </th>

                  <th
                    className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-[0.14em]"
                    style={{
                      color: mutedColor,
                    }}
                  >
                    Sold
                  </th>

                  <th
                    className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-[0.14em]"
                    style={{
                      color: mutedColor,
                    }}
                  >
                    Revenue
                  </th>

                  <th
                    className="px-5 py-3 text-center text-[10px] font-black uppercase tracking-[0.14em]"
                    style={{
                      color: mutedColor,
                    }}
                  >
                    Rank
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredMenuRows.map(
                  (row) => (
                    <tr
                      key={row.id}
                      className="border-b"
                      style={{
                        borderColor,
                      }}
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="flex h-9 w-9 items-center justify-center rounded-xl text-[10px] font-black"
                            style={{
                              background: `${accentColor}12`,
                              color: accentColor,
                            }}
                          >
                            {getInitials(
                              row.name
                            )}
                          </div>

                          <span
                            className="text-sm font-black"
                            style={{
                              color: textColor,
                            }}
                          >
                            {row.name}
                          </span>
                        </div>
                      </td>

                      <td
                        className="px-4 py-4 text-sm font-semibold"
                        style={{
                          color: textColor,
                        }}
                      >
                        {
                          row.categoryName
                        }
                      </td>

                      <td className="px-4 py-4">
                        {row.isAvailable ? (
                          <span
                            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black"
                            style={{
                              background:
                                '#16a34a14',
                              color:
                                '#15803d',
                            }}
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            Available
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black"
                            style={{
                              background: `${textColor}0a`,
                              color:
                                mutedColor,
                            }}
                          >
                            <Clock3 className="h-3 w-3" />
                            Unavailable
                          </span>
                        )}
                      </td>

                      <td
                        className="px-4 py-4 text-right text-sm font-black"
                        style={{
                          color: textColor,
                        }}
                      >
                        {formatCurrency(
                          row.price,
                          data.restaurant
                            .currency
                        )}
                      </td>

                      <td className="px-4 py-4 text-center">
                        {row.promotion ? (
                          <span
                            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black"
                            style={{
                              background: `${secondaryAccent}12`,
                              color:
                                secondaryAccent,
                            }}
                          >
                            <Tag className="h-3 w-3" />
                            {
                              row.promotion
                            }
                          </span>
                        ) : (
                          <span
                            style={{
                              color:
                                mutedColor,
                            }}
                          >
                            —
                          </span>
                        )}
                      </td>

                      <td
                        className="px-4 py-4 text-right text-sm font-black"
                        style={{
                          color: textColor,
                        }}
                      >
                        {row.sold.toLocaleString()}
                      </td>

                      <td
                        className="px-4 py-4 text-right text-sm font-black"
                        style={{
                          color: textColor,
                        }}
                      >
                        {formatCurrency(
                          row.revenue,
                          data.restaurant
                            .currency
                        )}
                      </td>

                      <td className="px-5 py-4 text-center">
                        {row.rank ? (
                          <span
                            className="inline-flex h-7 min-w-7 items-center justify-center rounded-lg px-2 text-[10px] font-black"
                            style={{
                              background: `${accentColor}12`,
                              color:
                                accentColor,
                            }}
                          >
                            #{row.rank}
                          </span>
                        ) : (
                          <span
                            style={{
                              color:
                                mutedColor,
                            }}
                          >
                            —
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CATEGORY TABLE */}
      <div
        className="overflow-hidden rounded-2xl border"
        style={{
          background:
            surfaceColor,
          borderColor,
        }}
      >
        <div
          className="border-b p-5"
          style={{
            borderColor,
          }}
        >
          <div className="flex items-center gap-2">
            <UtensilsCrossed
              className="h-5 w-5"
              style={{
                color:
                  secondaryAccent,
              }}
            />

            <h2
              className="text-lg font-black"
              style={{
                color: textColor,
              }}
            >
              Category Performance
            </h2>
          </div>

          <p
            className="mt-1 text-xs"
            style={{
              color: mutedColor,
            }}
          >
            Every category is calculated from
            the actual menu items and their
            actual sales.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr
                className="border-b text-left"
                style={{
                  borderColor,
                }}
              >
                <th
                  className="px-5 py-3 text-[10px] font-black uppercase tracking-[0.14em]"
                  style={{
                    color: mutedColor,
                  }}
                >
                  Category
                </th>

                <th
                  className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-[0.14em]"
                  style={{
                    color: mutedColor,
                  }}
                >
                  Menu Items
                </th>

                <th
                  className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-[0.14em]"
                  style={{
                    color: mutedColor,
                  }}
                >
                  Sold
                </th>

                <th
                  className="px-5 py-3 text-right text-[10px] font-black uppercase tracking-[0.14em]"
                  style={{
                    color: mutedColor,
                  }}
                >
                  Revenue
                </th>
              </tr>
            </thead>

            <tbody>
              {categoryRows.map(
                (category) => (
                  <tr
                    key={
                      category.id
                    }
                    className="border-b"
                    style={{
                      borderColor,
                    }}
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <UtensilsCrossed
                          className="h-4 w-4"
                          style={{
                            color:
                              secondaryAccent,
                          }}
                        />

                        <span
                          className="text-sm font-black"
                          style={{
                            color:
                              textColor,
                          }}
                        >
                          {
                            category.name
                          }
                        </span>
                      </div>
                    </td>

                    <td
                      className="px-4 py-4 text-right text-sm font-semibold"
                      style={{
                        color:
                          mutedColor,
                      }}
                    >
                      {category.items.toLocaleString()}
                    </td>

                    <td
                      className="px-4 py-4 text-right text-sm font-black"
                      style={{
                        color:
                          textColor,
                      }}
                    >
                      {category.sold.toLocaleString()}
                    </td>

                    <td
                      className="px-5 py-4 text-right text-sm font-black"
                      style={{
                        color:
                          textColor,
                      }}
                    >
                      {formatCurrency(
                        category.revenue,
                        data.restaurant
                          .currency
                      )}
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* FOOTER */}
      <div
        className="flex flex-col gap-2 rounded-2xl border p-5 sm:flex-row sm:items-center sm:justify-between"
        style={{
          background:
            surfaceColor,
          borderColor,
        }}
      >
        <div className="flex items-center gap-3">
          <FileText
            className="h-5 w-5"
            style={{
              color: accentColor,
            }}
          />

          <div>
            <p
              className="text-sm font-black"
              style={{
                color: textColor,
              }}
            >
              {getPeriodLabel(
                period
              )}
            </p>

            <p
              className="text-xs"
              style={{
                color: mutedColor,
              }}
            >
              {periodOrders.length}{' '}
              orders found ·{' '}
              {totalItemsSold}{' '}
              menu items sold
            </p>
          </div>
        </div>

        <div
          className="text-xs font-semibold"
          style={{
            color: mutedColor,
          }}
        >
          Live data from Orders and Menu
          Management
        </div>
      </div>
    </div>
  );
}