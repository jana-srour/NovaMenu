'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { subscribeRestaurantRealtime } from '@/lib/live-sync';
import { DashboardLoader } from '@/app/dashboard/components/dashboard-loader';
import { PlanRequired } from '@/app/dashboard/components/plan-required';
import { subscriptionAllows, type BillingPlan, type SubscriptionStatus } from '@/lib/billing/plans';

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

const statuses: OrderStatus[] = ['New', 'Preparing', 'Ready', 'Delivered'];
const statusStyles: Record<OrderStatus, string> = {
  New: '',
  Preparing: '',
  Ready: '',
  Delivered: '',
};

const getStatusAccent = (status: OrderStatus) => {
  switch (status) {
    case 'New':
      return '#536DFE';
    case 'Preparing':
      return '#765BD5';
    case 'Ready':
      return '#765BD5';
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
    channel: row.channel,
    total: Number(row.total),
    createdAt: new Date(row.created_at).toLocaleString(),
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
  const [restaurantName, setRestaurantName] = useState('Restaurant');
  const [currency, setCurrency] = useState('USD');
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<'All' | OrderStatus>('All');
  const [locationFilter, setLocationFilter] = useState<'All' | OrderLocation>('All');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [sortOption, setSortOption] = useState<SortOption>('newest');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [planAllowed, setPlanAllowed] = useState(true);

  const loadOrders = useCallback(async (id: string) => {
    const { data, error: queryError } = await supabase.from('orders')
        .select('id, order_number, customer_name, customer_phone, table_number, customer_address, status, channel, total, created_at, order_items(item_name, quantity, unit_price)')
        .eq('restaurant_id', id)
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
      if (!auth.user) { setLoading(false); return; }

      const { data: membership } = await supabase.from('restaurant_members').select('restaurant_id').eq('user_id', auth.user.id).limit(1).maybeSingle();
      if (!active) return;
      if (!membership?.restaurant_id) { setLoading(false); return; }

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
    const { error: updateError } = await supabase.from('orders').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
    if (updateError) { setError(updateError.message); return; }
    setOrders((current) => current.map((order) => order.id === id ? { ...order, status } : order));
  };

  const visibleOrders = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const dateCutoff = dateFilter === 'today'
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
      .sort((first, second) => sortOption === 'newest'
        ? second.createdAtTimestamp - first.createdAtTimestamp
        : first.createdAtTimestamp - second.createdAtTimestamp);
  }, [dateFilter, filter, locationFilter, orders, sortOption]);
  const revenue = orders.reduce((sum, order) => sum + order.total, 0);

  if (loading) return <DashboardLoader />;

  if (!planAllowed) {
    return (
      <PlanRequired
        featureName="Orders Management"
        requiredPlan="Pro"
      />
    );
  }

  return <div className="min-h-screen" style={{ background: 'var(--portal-background)', color: 'var(--portal-text)' }}><main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
    <header className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--portal-accent)' }}>Live orders</p><h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Orders Management - test456</h1><p className="mt-2 text-sm" style={{ color: 'var(--portal-text)' }}>Every order is synchronized with the restaurant database.</p></div><div className="rounded-2xl border px-4 py-3" style={{ borderColor: 'var(--portal-border)', background: 'var(--portal-surface)' }}><p className="text-[9px] font-black uppercase tracking-[0.16em]" style={{ color: 'var(--portal-text)' }}>Tracked sales</p><p className="mt-1 text-xl font-black">{currency}{formatPrice(revenue)}</p></div></header>
    {error && <div className="mb-5 rounded-xl border p-3 text-sm" style={{ borderColor: 'var(--portal-border)', background: 'var(--portal-surface)', color: 'var(--portal-text)' }}>{error}</div>}
    <section className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">{statuses.map((status) => <div key={status} className="rounded-2xl border p-5 shadow-sm" style={{ borderColor: 'var(--portal-border)', background: 'var(--portal-surface)', color: 'var(--portal-text)' }}><p className="text-[9px] font-black uppercase tracking-[0.16em]" style={{ color: 'var(--portal-text)' }}>{status}</p><p className="mt-4 text-3xl font-black">{orders.filter((order) => order.status === status).length}</p><p className="mt-1 text-xs" style={{ color: 'var(--portal-text)' }}>Orders in this stage</p></div>)}</section>
    <section className="rounded-3xl border p-4 shadow-sm sm:p-6" style={{ borderColor: 'var(--portal-border)', background: 'var(--portal-surface)' }}><div className="mb-5 flex flex-col gap-3"><div className="flex flex-wrap gap-2">{(['All', ...statuses] as const).map((option) => <button key={option} type="button" onClick={() => setFilter(option)} className="rounded-full px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em]" style={{ background: filter === option ? 'var(--portal-accent)' : 'var(--portal-background)', color: filter === option ? '#fff' : 'var(--portal-text)' }}>{option}</button>)}</div><div className="flex flex-wrap gap-3"><label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.12em]" style={{ color: 'var(--portal-text)' }}>Place<select value={locationFilter} onChange={(event) => setLocationFilter(event.target.value as 'All' | OrderLocation)} className="rounded-xl border px-3 py-2 text-xs font-bold normal-case tracking-normal outline-none" style={{ borderColor: 'var(--portal-border)', background: 'var(--portal-background)', color: 'var(--portal-text)' }}><option value="All">All places</option><option value="Restaurant">Inside restaurant</option><option value="Delivery">Delivery</option></select></label><label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.12em]" style={{ color: 'var(--portal-text)' }}>Date<select value={dateFilter} onChange={(event) => setDateFilter(event.target.value as DateFilter)} className="rounded-xl border px-3 py-2 text-xs font-bold normal-case tracking-normal outline-none" style={{ borderColor: 'var(--portal-border)', background: 'var(--portal-background)', color: 'var(--portal-text)' }}><option value="all">All dates</option><option value="today">Today</option><option value="last7">Last 7 days</option><option value="last30">Last 30 days</option></select></label><label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.12em]" style={{ color: 'var(--portal-text)' }}>Sort<select value={sortOption} onChange={(event) => setSortOption(event.target.value as SortOption)} className="rounded-xl border px-3 py-2 text-xs font-bold normal-case tracking-normal outline-none" style={{ borderColor: 'var(--portal-border)', background: 'var(--portal-background)', color: 'var(--portal-text)' }}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></label></div></div><div className="space-y-4">{visibleOrders.length === 0 && <div className="rounded-2xl border border-dashed p-10 text-center text-sm" style={{ borderColor: 'var(--portal-border)', color: 'var(--portal-text)' }}>No orders in this view.</div>}{visibleOrders.map((order) => <article key={order.id} className="rounded-2xl border p-4" style={{ borderColor: 'var(--portal-border)', background: 'var(--portal-background)' }}><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><div className="flex items-center gap-3"><strong className="text-sm tracking-[0.1em]">#{order.orderNumber}</strong><span
  className="rounded-full px-2.5 py-1 text-[9px] font-black uppercase"
  style={{
    background: `${getStatusAccent(order.status)}18`,
    color: getStatusAccent(order.status),
    border: `1px solid ${getStatusAccent(order.status)}33`,
  }}
>
  {order.status}
</span></div>
<div className="mt-2 space-y-1 text-xs" style={{ color: 'var(--portal-text)' }}>
  <p>
    {order.location === 'Restaurant'
      ? `${order.customer} · ${order.channel} · Inside restaurant`
      : `${order.customer} · Delivery`} · {order.createdAt}
  </p>

  {order.address ? (
    <>
      <p className="font-semibold">
        📍 Delivery: {order.address}
      </p>
      {order.customerPhone && (
        <p className="font-semibold">
          ☎️ {order.customerPhone}
        </p>
      )}
    </>
  ) : order.table ? (
    <p className="font-semibold">
      🍽️ Table: {order.table}
    </p>
  ) : null}
</div>
</div><div className="flex items-center gap-4"><strong>{currency}{formatPrice(order.total)}</strong><select
  value={order.status}
  onChange={(event) => updateStatus(order.id, event.target.value as OrderStatus)}
  className="rounded-xl border px-3 py-2 text-xs font-bold outline-none"
  style={{
    borderColor: 'var(--portal-border)',
    background: 'var(--portal-surface)',
    color: 'var(--portal-text)',
  }}
>{statuses.map((status) => <option key={status}>{status}</option>)}</select></div></div><div className="mt-4 space-y-2">{order.items.map((item) => <div
  key={`${order.id}-${item.name}`}
  className="flex justify-between rounded-xl border px-3 py-2 text-xs"
  style={{
    borderColor: 'var(--portal-border)',
    background: 'var(--portal-surface)',
    color: 'var(--portal-text)',
  }}
><span>{item.qty}x {item.name}</span><span className="font-bold">{currency}{formatPrice(item.qty * item.price)}</span></div>)}</div></article>)}</div></section>
  </main></div>;
}

