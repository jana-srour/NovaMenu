'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Printer,
  X,
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
import {
  ReceiptTemplateConfig,
  defaultReceiptTemplate,
  loadReceiptTemplate,
} from '@/lib/receipt-template';
import {
  ReceiptPreview,
  printOrderReceipt,
} from '@/app/dashboard/components/receipt-preview';
import {
  PRINTER_STORAGE_KEY,
  SavedPrinter,
  defaultPrinter,
} from '@/lib/printer-scanner';

type OrderStatus = 'New' | 'Preparing' | 'Ready' | 'Delivered';
type OrderLocation = 'Restaurant' | 'Delivery';
type SortOption = 'newest' | 'oldest';
type DateFilter = 'all' | 'today' | 'last7' | 'last30';

type Order = {
  id: string;
  orderNumber: number;
  customer: string;
  customerPhone: string;
  table: string;
  address: string;
  status: OrderStatus;
  channel: string;
  total: number;
  createdAt: string;
  createdAtTimestamp: number;
  location: OrderLocation;
  items: {
    name: string;
    qty: number;
    price: number;
  }[];
};

type OrderRow = {
  id: string;
  order_number: number;
  customer_name: string | null;
  customer_phone: string | null;
  table_number: string | null;
  customer_address: string | null;
  status: OrderStatus;
  channel: string;
  total: number;
  created_at: string;
  order_items: {
    item_name: string;
    quantity: number;
    unit_price: number;
  }[];
};

type DateGroup = {
  dateKey: string;
  displayDate: string;
  isToday: boolean;
  isYesterday: boolean;
  dateTimestamp: number;
  orders: Order[];
  totalRevenue: number;
  statusCounts: Record<OrderStatus, number>;
};

const statuses: OrderStatus[] = ['New', 'Preparing', 'Ready', 'Delivered'];

const getStatusAccent = (status: OrderStatus) => {
  switch (status) {
    case 'New':
      return '#536DFE';
    case 'Preparing':
      return '#F59E0B';
    case 'Ready':
      return '#10B981';
    case 'Delivered':
      return '#6B7280';
    default:
      return '#202534';
  }
};

const formatPrice = (price: number) => {
  const value = Number(price);
  if (Number.isInteger(value)) {
    return value.toString();
  }
  return value.toFixed(2);
};

function mapOrder(row: OrderRow): Order {
  return {
    id: row.id,
    orderNumber: row.order_number,
    customer: row.customer_name || 'Guest',
    customerPhone: row.customer_phone || '',
    table: row.table_number || '',
    address: row.customer_address || '',
    status: row.status,
    channel: row.channel || (row.customer_address ? 'Delivery' : 'Dine-in'),
    total: Number(row.total),
    createdAt: new Date(row.created_at).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
    createdAtTimestamp: new Date(row.created_at).getTime(),
    location: row.customer_address ? 'Delivery' : 'Restaurant',
    items: (row.order_items || []).map((item) => ({
      name: item.item_name,
      qty: item.quantity,
      price: Number(item.unit_price),
    })),
  };
}

export default function OrdersPage() {
  const [, setRestaurantName] = useState('Restaurant');
  const [currency, setCurrency] = useState('USD');
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<'All' | OrderStatus>('All');
  const [locationFilter, setLocationFilter] = useState<'All' | OrderLocation>('All');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [sortOption, setSortOption] = useState<SortOption>('newest');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [planAllowed, setPlanAllowed] = useState(true);

  // Printer & Receipt State
  const [configuredPrinter, setConfiguredPrinter] = useState<SavedPrinter | null>(null);
  const [receiptTemplate, setReceiptTemplate] = useState<ReceiptTemplateConfig>(defaultReceiptTemplate);
  const [printOrder, setPrintOrder] = useState<Order | null>(null);
  const [printing, setPrinting] = useState(false);
  const [printMessage, setPrintMessage] = useState('');

  // Date Grouping Collapsed State
  const [collapsedDates, setCollapsedDates] = useState<Record<string, boolean>>({});

  const toggleDateGroup = (dateKey: string) => {
    setCollapsedDates((prev) => ({
      ...prev,
      [dateKey]: !prev[dateKey],
    }));
  };

  const expandAllDates = () => {
    setCollapsedDates({});
  };

  const collapseAllDates = (keys: string[]) => {
    const newState: Record<string, boolean> = {};
    keys.forEach((k) => {
      newState[k] = true;
    });
    setCollapsedDates(newState);
  };

  const loadOrders = useCallback(async (id: string) => {
    const { data, error: queryError } = await supabase
      .from('orders')
      .select(
        'id, order_number, customer_name, customer_phone, table_number, customer_address, status, channel, total, created_at, order_items(item_name, quantity, unit_price)'
      )
      .eq('restaurant_id', id);

    if (queryError) {
      console.error('Failed to load restaurant orders:', queryError);
      setError(`Could not load orders: ${queryError.message}`);
      return;
    }

    setOrders(((data || []) as OrderRow[]).map(mapOrder));
  }, []);

  useEffect(() => {
    let unsubscribeRealtime: (() => void) | undefined;
    let active = true;

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

      if (!active) return;
      if (!membership?.restaurant_id) {
        setLoading(false);
        return;
      }

      const id = membership.restaurant_id;

      const { data: subscription } = await supabase
        .from('restaurant_subscriptions')
        .select('plan_code, status, trial_ends_at')
        .eq('restaurant_id', id)
        .maybeSingle();

      const allowed = subscriptionAllows(
        subscription as {
          plan_code: BillingPlan;
          status: SubscriptionStatus;
          trial_ends_at: string;
        } | null,
        'orders'
      );

      if (!active) return;

      setPlanAllowed(allowed);

      if (!allowed) {
        setLoading(false);
        return;
      }

      const { data: restaurant } = await supabase
        .from('restaurants')
        .select('name, currency')
        .eq('id', id)
        .single();

      if (!active) return;

      setRestaurantName(restaurant?.name || 'Restaurant');
      setCurrency(restaurant?.currency || 'USD');

      // Load Printer Settings & Receipt Template
      const storedPrinter = window.localStorage.getItem(PRINTER_STORAGE_KEY);
      if (storedPrinter) {
        try {
          setConfiguredPrinter({ ...defaultPrinter, ...JSON.parse(storedPrinter) });
        } catch {
          setConfiguredPrinter(defaultPrinter);
        }
      } else {
        setConfiguredPrinter(defaultPrinter);
      }

      const loadedTemplate = loadReceiptTemplate();
      setReceiptTemplate(loadedTemplate);

      await loadOrders(id);
      if (!active) return;

      unsubscribeRealtime = subscribeRestaurantRealtime(supabase, {
        restaurantId: id,
        name: 'dashboard-orders',
        tables: ['orders', 'order_items'],
        unfilteredTables: ['order_items'],
        onChange: () => loadOrders(id),
      });

      if (!active) {
        unsubscribeRealtime();
        return;
      }

      setLoading(false);
    };

    start();

    return () => {
      active = false;
      unsubscribeRealtime?.();
    };
  }, [loadOrders]);

  const updateStatus = async (id: string, status: OrderStatus) => {
    const { error: updateError } = await supabase
      .from('orders')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setOrders((current) =>
      current.map((order) => (order.id === id ? { ...order, status } : order))
    );
  };

  const requestPrintOrder = (order: Order) => {
    setPrintMessage('');
    const stored = window.localStorage.getItem(PRINTER_STORAGE_KEY);
    setConfiguredPrinter(
      stored ? ({ ...defaultPrinter, ...JSON.parse(stored) } as SavedPrinter) : defaultPrinter
    );
    setReceiptTemplate(loadReceiptTemplate());
    setPrintOrder(order);
  };

  const executePrintJob = async (orderToPrint: Order) => {
    const printerToUse = configuredPrinter || defaultPrinter;
    setPrinting(true);
    setPrintMessage('');

    try {
      if (printerToUse.connection === 'system') {
        printOrderReceipt({
          template: receiptTemplate,
          order: {
            orderNumber: orderToPrint.orderNumber,
            customer: orderToPrint.customer,
            customerPhone: orderToPrint.customerPhone,
            table: orderToPrint.table,
            address: orderToPrint.address,
            channel: orderToPrint.channel,
            createdAt: orderToPrint.createdAt,
            total: orderToPrint.total,
            currency,
            items: orderToPrint.items,
          },
          currency,
        });

        setPrintMessage(`Order #${orderToPrint.orderNumber} printed via System Print.`);
        setPrintOrder(null);
        return;
      }

      // Raw ESC/POS Network/USB/Bluetooth Printing
      if (!printerToUse.address || !printerToUse.port) {
        throw new Error('Configure a printer address in Settings > Printers first.');
      }

      const response = await fetch('/api/printer/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          printer: printerToUse,
          order: {
            orderNumber: orderToPrint.orderNumber,
            customer: orderToPrint.customer,
            customerPhone: orderToPrint.customerPhone,
            table: orderToPrint.table,
            address: orderToPrint.address,
            channel: orderToPrint.channel,
            createdAt: orderToPrint.createdAt,
            total: orderToPrint.total,
            currency,
            items: orderToPrint.items,
          },
          template: receiptTemplate,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Unable to print this order.');
      }

      setPrintMessage(
        `Order #${orderToPrint.orderNumber} sent to ${printerToUse.name || 'the configured printer'}.`
      );
      setPrintOrder(null);
    } catch (err) {
      setPrintMessage(err instanceof Error ? err.message : 'Unable to print this order.');
    } finally {
      setPrinting(false);
    }
  };

  // Filtered list of orders
  const visibleOrders = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    ).getTime();
    const dateCutoff =
      dateFilter === 'today'
        ? startOfToday
        : dateFilter === 'last7'
        ? now.getTime() - 7 * 24 * 60 * 60 * 1000
        : dateFilter === 'last30'
        ? now.getTime() - 30 * 24 * 60 * 60 * 1000
        : null;

    return orders
      .filter((order) => filter === 'All' || order.status === filter)
      .filter((order) => locationFilter === 'All' || order.location === locationFilter)
      .filter((order) => dateCutoff === null || order.createdAtTimestamp >= dateCutoff)
      .sort((first, second) =>
        sortOption === 'newest'
          ? second.createdAtTimestamp - first.createdAtTimestamp
          : first.createdAtTimestamp - second.createdAtTimestamp
      );
  }, [dateFilter, filter, locationFilter, orders, sortOption]);

  // Group orders by Calendar Date with relative labels (Today, Yesterday, etc.)
  const groupedOrders = useMemo<DateGroup[]>(() => {
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
    const yesterdayKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

    const groupsMap = new Map<string, Order[]>();

    visibleOrders.forEach((order) => {
      const d = new Date(order.createdAtTimestamp);
      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

      if (!groupsMap.has(dateKey)) {
        groupsMap.set(dateKey, []);
      }
      groupsMap.get(dateKey)!.push(order);
    });

    const groups: DateGroup[] = [];

    groupsMap.forEach((groupOrders, key) => {
      const firstOrderTimestamp = groupOrders[0]?.createdAtTimestamp || 0;
      const dateObj = new Date(firstOrderTimestamp);

      const isToday = key === todayKey;
      const isYesterday = key === yesterdayKey;

      const formattedDateString = dateObj.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });

      const displayDate = isToday
        ? `Today • ${formattedDateString}`
        : isYesterday
        ? `Yesterday • ${formattedDateString}`
        : formattedDateString;

      const totalRevenue = groupOrders.reduce((sum, o) => sum + o.total, 0);

      const statusCounts: Record<OrderStatus, number> = {
        New: 0,
        Preparing: 0,
        Ready: 0,
        Delivered: 0,
      };
      groupOrders.forEach((o) => {
        statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;
      });

      groups.push({
        dateKey: key,
        displayDate,
        isToday,
        isYesterday,
        dateTimestamp: firstOrderTimestamp,
        orders: groupOrders,
        totalRevenue,
        statusCounts,
      });
    });

    return groups.sort((a, b) =>
      sortOption === 'newest'
        ? b.dateTimestamp - a.dateTimestamp
        : a.dateTimestamp - b.dateTimestamp
    );
  }, [visibleOrders, sortOption]);

  const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0);
  const allDateKeys = useMemo(() => groupedOrders.map((g) => g.dateKey), [groupedOrders]);

  if (loading) return <DashboardLoader />;
  if (!planAllowed) return <PlanRequired featureName="Orders Management" requiredPlan="Pro" />;

  return (
    <div
      className="min-h-screen"
      style={{
        background: 'var(--portal-background)',
        color: 'var(--portal-text)',
      }}
    >
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header Banner */}
        <header className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p
              className="text-[9px] font-black uppercase tracking-[0.2em]"
              style={{ color: 'var(--portal-accent)' }}
            >
              Live Orders Feed
            </p>
            <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">
              Orders Management
            </h1>
            <p className="mt-1 text-sm opacity-75">
              Live orders grouped by date with real-time status updates and thermal receipt printing.
            </p>
          </div>

          <div
            className="flex items-center gap-3 rounded-2xl border px-5 py-3 shadow-sm self-start sm:self-auto"
            style={{
              borderColor: 'var(--portal-border)',
              background: 'var(--portal-surface)',
            }}
          >
            <div>
              <p
                className="text-[9px] font-black uppercase tracking-[0.16em]"
                style={{ color: 'var(--portal-text)', opacity: 0.7 }}
              >
                Total Tracked Sales
              </p>
              <p className="mt-0.5 text-2xl font-black">
                {currency}
                {formatPrice(totalRevenue)}
              </p>
            </div>
          </div>
        </header>

        {error && (
          <div
            className="mb-5 rounded-xl border p-3 text-sm text-red-600 bg-red-500/10 border-red-500/30"
          >
            {error}
          </div>
        )}

        {/* Status Breakdown KPI Cards */}
        <section className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
          {statuses.map((status) => (
            <div
              key={status}
              className="rounded-2xl border p-5 shadow-sm"
              style={{
                borderColor: 'var(--portal-border)',
                background: 'var(--portal-surface)',
                color: 'var(--portal-text)',
              }}
            >
              <div className="flex items-center justify-between">
                <p
                  className="text-[9px] font-black uppercase tracking-[0.16em]"
                  style={{ color: 'var(--portal-text)', opacity: 0.7 }}
                >
                  {status}
                </p>
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: getStatusAccent(status) }}
                />
              </div>
              <p className="mt-3 text-3xl font-black">
                {orders.filter((order) => order.status === status).length}
              </p>
              <p className="mt-1 text-xs opacity-70">Orders in this stage</p>
            </div>
          ))}
        </section>

        {/* Filter and Grouping Bar */}
        <section
          className="rounded-3xl border p-4 shadow-sm sm:p-6"
          style={{
            borderColor: 'var(--portal-border)',
            background: 'var(--portal-surface)',
          }}
        >
          <div className="mb-6 flex flex-col gap-4">
            {/* Status Pills */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                {(['All', ...statuses] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setFilter(option)}
                    className="rounded-full px-3.5 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] transition-all cursor-pointer"
                    style={{
                      background:
                        filter === option
                          ? 'var(--portal-accent)'
                          : 'var(--portal-background)',
                      color: filter === option ? '#ffffff' : 'var(--portal-text)',
                    }}
                  >
                    {option}
                  </button>
                ))}
              </div>

              {/* Expand / Collapse All Actions */}
              {groupedOrders.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={expandAllDates}
                    className="rounded-xl border px-3 py-1.5 text-[10px] font-black uppercase tracking-wider transition-all hover:bg-black/5"
                    style={{ borderColor: 'var(--portal-border)' }}
                  >
                    Expand All Dates
                  </button>
                  <button
                    type="button"
                    onClick={() => collapseAllDates(allDateKeys)}
                    className="rounded-xl border px-3 py-1.5 text-[10px] font-black uppercase tracking-wider transition-all hover:bg-black/5"
                    style={{ borderColor: 'var(--portal-border)' }}
                  >
                    Collapse All
                  </button>
                </div>
              )}
            </div>

            {/* Dropdown Filters */}
            <div className="flex flex-wrap gap-3 pt-3 border-t" style={{ borderColor: 'var(--portal-border)' }}>
              <label
                className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.12em]"
                style={{ color: 'var(--portal-text)' }}
              >
                Place
                <select
                  value={locationFilter}
                  onChange={(event) =>
                    setLocationFilter(event.target.value as 'All' | OrderLocation)
                  }
                  className="rounded-xl border px-3 py-2 text-xs font-bold normal-case tracking-normal outline-none"
                  style={{
                    borderColor: 'var(--portal-border)',
                    background: 'var(--portal-background)',
                    color: 'var(--portal-text)',
                  }}
                >
                  <option value="All">All places</option>
                  <option value="Restaurant">Inside restaurant</option>
                  <option value="Delivery">Delivery</option>
                </select>
              </label>

              <label
                className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.12em]"
                style={{ color: 'var(--portal-text)' }}
              >
                Date Filter
                <select
                  value={dateFilter}
                  onChange={(event) => setDateFilter(event.target.value as DateFilter)}
                  className="rounded-xl border px-3 py-2 text-xs font-bold normal-case tracking-normal outline-none"
                  style={{
                    borderColor: 'var(--portal-border)',
                    background: 'var(--portal-background)',
                    color: 'var(--portal-text)',
                  }}
                >
                  <option value="all">All dates</option>
                  <option value="today">Today only</option>
                  <option value="last7">Last 7 days</option>
                  <option value="last30">Last 30 days</option>
                </select>
              </label>

              <label
                className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.12em]"
                style={{ color: 'var(--portal-text)' }}
              >
                Sort Orders
                <select
                  value={sortOption}
                  onChange={(event) => setSortOption(event.target.value as SortOption)}
                  className="rounded-xl border px-3 py-2 text-xs font-bold normal-case tracking-normal outline-none"
                  style={{
                    borderColor: 'var(--portal-border)',
                    background: 'var(--portal-background)',
                    color: 'var(--portal-text)',
                  }}
                >
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                </select>
              </label>
            </div>
          </div>

          {/* Grouped Orders List */}
          <div className="space-y-6">
            {groupedOrders.length === 0 && (
              <div
                className="rounded-2xl border border-dashed p-12 text-center text-sm"
                style={{
                  borderColor: 'var(--portal-border)',
                  color: 'var(--portal-text)',
                }}
              >
                No orders match your filter criteria.
              </div>
            )}

            {groupedOrders.map((group) => {
              const isCollapsed = Boolean(collapsedDates[group.dateKey]);

              return (
                <section
                  key={group.dateKey}
                  className="rounded-2xl border overflow-hidden transition-all shadow-sm"
                  style={{
                    borderColor: group.isToday
                      ? 'var(--portal-accent)'
                      : 'var(--portal-border)',
                    background: 'var(--portal-surface)',
                  }}
                >
                  {/* Collapsible Date Group Header */}
                  <header
                    onClick={() => toggleDateGroup(group.dateKey)}
                    className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between cursor-pointer select-none transition-colors hover:bg-black/5"
                    style={{
                      background: group.isToday
                        ? 'var(--portal-accent-soft, rgba(83,109,254,0.08))'
                        : 'var(--portal-background)',
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                        style={{
                          background: group.isToday
                            ? 'var(--portal-accent)'
                            : 'rgba(0,0,0,0.06)',
                          color: group.isToday ? '#ffffff' : 'var(--portal-accent)',
                        }}
                      >
                        <Calendar className="h-4 w-4" />
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-sm font-black tracking-tight">
                            {group.displayDate}
                          </h2>
                          {group.isToday && (
                            <span className="rounded-full px-2 py-0.5 text-[9px] font-black uppercase bg-emerald-500/15 text-emerald-600">
                              Active Day
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] opacity-70">
                          {group.orders.length} {group.orders.length === 1 ? 'order' : 'orders'} · Total Sales: {currency}{formatPrice(group.totalRevenue)}
                        </p>
                      </div>
                    </div>

                    {/* Stage Distribution Chips & Toggle Chevron */}
                    <div className="flex items-center gap-3 self-end sm:self-auto">
                      <div className="hidden sm:flex items-center gap-1.5">
                        {statuses.map((s) => {
                          const count = group.statusCounts[s];
                          if (!count) return null;
                          return (
                            <span
                              key={s}
                              className="rounded-lg px-2 py-0.5 text-[10px] font-bold"
                              style={{
                                background: `${getStatusAccent(s)}15`,
                                color: getStatusAccent(s),
                              }}
                            >
                              {count} {s}
                            </span>
                          );
                        })}
                      </div>

                      <div className="flex items-center gap-1 text-xs font-black uppercase tracking-wider opacity-75">
                        <span>{isCollapsed ? 'Expand' : 'Collapse'}</span>
                        {isCollapsed ? (
                          <ChevronRight className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </div>
                    </div>
                  </header>

                  {/* Orders in this Date Group */}
                  {!isCollapsed && (
                    <div
                      className="p-4 space-y-4 border-t"
                      style={{ borderColor: 'var(--portal-border)' }}
                    >
                      {group.orders.map((order) => (
                        <article
                          key={order.id}
                          className="rounded-2xl border p-4 transition-all hover:border-black/30"
                          style={{
                            borderColor: 'var(--portal-border)',
                            background: 'var(--portal-background)',
                          }}
                        >
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                              <div className="flex items-center gap-3">
                                <strong className="text-sm tracking-[0.1em] font-black">
                                  #{order.orderNumber}
                                </strong>
                                <span
                                  className="rounded-full px-2.5 py-1 text-[9px] font-black uppercase"
                                  style={{
                                    background: `${getStatusAccent(order.status)}18`,
                                    color: getStatusAccent(order.status),
                                    border: `1px solid ${getStatusAccent(order.status)}33`,
                                  }}
                                >
                                  {order.status}
                                </span>
                              </div>

                              <div
                                className="mt-2 space-y-1 text-xs"
                                style={{ color: 'var(--portal-text)' }}
                              >
                                <p className="opacity-90">
                                  {order.location === 'Restaurant'
                                    ? `${order.customer} · ${order.channel} · Inside restaurant`
                                    : `${order.customer} · Delivery`}{' '}
                                  · {order.createdAt}
                                </p>

                                {order.address ? (
                                  <>
                                    <p className="font-semibold text-emerald-600">
                                      📍 Delivery: {order.address}
                                    </p>
                                    {order.customerPhone && (
                                      <p className="font-semibold opacity-85">
                                        ☎️ {order.customerPhone}
                                      </p>
                                    )}
                                  </>
                                ) : order.table ? (
                                  <p className="font-semibold">🍽️ Table: {order.table}</p>
                                ) : null}
                              </div>
                            </div>

                            {/* Total, Status Selector, and Print Button */}
                            <div className="flex flex-wrap items-center gap-3">
                              <strong className="text-base font-black">
                                {currency}
                                {formatPrice(order.total)}
                              </strong>

                              <select
                                value={order.status}
                                onChange={(event) =>
                                  updateStatus(order.id, event.target.value as OrderStatus)
                                }
                                className="rounded-xl border px-3 py-2 text-xs font-bold outline-none"
                                style={{
                                  borderColor: 'var(--portal-border)',
                                  background: 'var(--portal-surface)',
                                  color: 'var(--portal-text)',
                                }}
                              >
                                {statuses.map((status) => (
                                  <option key={status} value={status}>
                                    {status}
                                  </option>
                                ))}
                              </select>

                              <button
                                type="button"
                                onClick={() => requestPrintOrder(order)}
                                className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[10px] font-black uppercase tracking-[0.1em] text-white shadow-sm transition-transform active:scale-95 cursor-pointer"
                                style={{ background: 'var(--portal-accent)' }}
                              >
                                <Printer className="h-3.5 w-3.5" /> Print Receipt
                              </button>
                            </div>
                          </div>

                          {/* Order Items List */}
                          <div className="mt-3.5 space-y-1.5 pt-3 border-t" style={{ borderColor: 'var(--portal-border)' }}>
                            {order.items.map((item) => (
                              <div
                                key={`${order.id}-${item.name}`}
                                className="flex justify-between rounded-xl border px-3 py-1.5 text-xs font-medium"
                                style={{
                                  borderColor: 'var(--portal-border)',
                                  background: 'var(--portal-surface)',
                                  color: 'var(--portal-text)',
                                }}
                              >
                                <span>
                                  <span className="font-black mr-1.5">{item.qty}x</span>
                                  {item.name}
                                </span>
                                <span className="font-bold">
                                  {currency}
                                  {formatPrice(item.qty * item.price)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </section>
      </main>

      {/* Floating Status / Print Toast Alert */}
      {printMessage && (
        <div
          className="fixed bottom-5 right-5 z-40 max-w-sm rounded-2xl border p-4 text-sm shadow-xl flex items-center justify-between gap-3 animate-in fade-in"
          style={{
            borderColor: 'var(--portal-border)',
            background: 'var(--portal-surface)',
            color: 'var(--portal-text)',
          }}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <span className="font-semibold">{printMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setPrintMessage('')}
            className="p-1 opacity-60 hover:opacity-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Order Print Confirmation & Live Thermal Receipt Modal */}
      {printOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#171613]/70 px-4 py-6 backdrop-blur-sm animate-in fade-in overflow-y-auto">
          <section
            role="dialog"
            aria-modal="true"
            className="w-full max-w-lg rounded-[28px] border p-6 shadow-2xl my-auto"
            style={{
              borderColor: 'var(--portal-border)',
              background: 'var(--portal-surface)',
              color: 'var(--portal-text)',
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p
                  className="text-[10px] font-black uppercase tracking-[0.18em]"
                  style={{ color: 'var(--portal-accent)' }}
                >
                  Thermal Receipt Printing
                </p>
                <h2 className="mt-1 text-2xl font-black">
                  Print Order #{printOrder.orderNumber}
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close print dialog"
                onClick={() => setPrintOrder(null)}
                className="rounded-xl border p-2 hover:bg-black/5"
                style={{ borderColor: 'var(--portal-border)' }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Configured Destination Info */}
            <div
              className="mt-4 flex items-center gap-3 rounded-2xl border p-3.5 text-xs font-semibold"
              style={{
                borderColor: 'var(--portal-border)',
                background: 'var(--portal-background)',
              }}
            >
              <Printer
                className="h-4 w-4 shrink-0"
                style={{ color: 'var(--portal-accent)' }}
              />
              <div className="min-w-0">
                <span className="opacity-75">Target Printer: </span>
                <span className="font-bold">
                  {configuredPrinter?.name || 'System / Chrome Print Driver'}
                </span>
                <span className="block text-[10px] opacity-60">
                  {configuredPrinter?.connection === 'system'
                    ? 'Browser OS Print Dialog'
                    : `Network ESC/POS at ${configuredPrinter?.address}:${configuredPrinter?.port}`}
                </span>
              </div>
            </div>

            {/* Interactive Preview of the Customized Receipt */}
            <div className="my-5 max-h-[360px] overflow-y-auto p-2 flex justify-center rounded-2xl border bg-black/5" style={{ borderColor: 'var(--portal-border)' }}>
              <ReceiptPreview
                template={receiptTemplate}
                order={{
                  orderNumber: printOrder.orderNumber,
                  customer: printOrder.customer,
                  customerPhone: printOrder.customerPhone,
                  table: printOrder.table,
                  address: printOrder.address,
                  channel: printOrder.channel,
                  createdAt: printOrder.createdAt,
                  total: printOrder.total,
                  currency,
                  items: printOrder.items,
                }}
                currency={currency}
                showPrintButton={false}
              />
            </div>

            {/* Dialog Actions */}
            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={printing}
                onClick={() => setPrintOrder(null)}
                className="rounded-2xl border px-5 py-3 text-xs font-black uppercase tracking-[0.1em] hover:bg-black/5"
                style={{ borderColor: 'var(--portal-border)' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={printing}
                onClick={() => executePrintJob(printOrder)}
                className="inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-3 text-xs font-black uppercase tracking-[0.1em] text-white shadow-md disabled:opacity-60 cursor-pointer"
                style={{ background: 'var(--portal-accent)' }}
              >
                <Printer className="h-4 w-4" />
                {printing ? 'Printing...' : 'Confirm & Print'}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
