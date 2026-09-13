'use client';

import {
  BarChart3,
  TrendingUp,
  ShoppingBag,
  Utensils,
  Tags,
  DollarSign,
  Users,
  Activity,
  ArrowUpRight,
  Download,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import {
  getReportPeriodRange,
  getReportsData,
  type ReportsData,
} from '@/lib/reports/data';

const reportCards = [
  {
    title: 'Sales & Revenue',
    description:
      'Revenue trends, growth, average order value and sales performance.',
    href: '/dashboard/reports/sales',
    icon: TrendingUp,
  },
  {
    title: 'Orders',
    description:
      'Order volume, statuses, order values and detailed order activity.',
    href: '/dashboard/reports/orders',
    icon: ShoppingBag,
  },
  {
    title: 'Menu Performance',
    description:
      'Best sellers, slow movers, products and category performance.',
    href: '/dashboard/reports/menu',
    icon: Utensils,
  },
  {
    title: 'Promotions',
    description:
      'Discount activity, promotion usage and promotional performance.',
    href: '/dashboard/reports/promotions',
    icon: Tags,
  },
  {
    title: 'Pricing',
    description:
      'Price changes, pricing history and item-level pricing activity.',
    href: '/dashboard/reports/pricing',
    icon: DollarSign,
  },
  {
    title: 'Customers',
    description:
      'Customer behavior, repeat activity and spending insights.',
    href: '/dashboard/reports/customers',
    icon: Users,
  },
  {
    title: 'Operations',
    description:
      'Peak periods, order status patterns and operational activity.',
    href: '/dashboard/reports/operations',
    icon: Activity,
  },
];

export default function ReportsPage() {
  const [data, setData] = useState<ReportsData | null>(null);
  const [previousData, setPreviousData] = useState<ReportsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadOverview() {
      try {
        const currentRange = getReportPeriodRange('30d');
        const currentStart = new Date(currentRange.from!);
        const currentEnd = new Date(currentRange.to!);
        const duration = currentEnd.getTime() - currentStart.getTime();
        const previousRange = {
          from: new Date(currentStart.getTime() - duration).toISOString(),
          to: currentStart.toISOString(),
        };

        const [current, previous] = await Promise.all([
          getReportsData(currentRange),
          getReportsData(previousRange),
        ]);

        if (active) {
          setData(current);
          setPreviousData(previous);
        }
      } catch (loadError) {
        console.error('Reports overview loading failed:', loadError);
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Could not load reports overview.',
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadOverview();
    return () => {
      active = false;
    };
  }, []);

  const overview = useMemo(() => {
    const validOrder = (status: string | null | undefined) =>
      !['cancelled', 'canceled', 'rejected', 'declined', 'voided'].includes(
        String(status || '').trim().toLowerCase(),
      );
    const summarize = (report: ReportsData | null) => {
      const orders = (report?.orders || []).filter((order) =>
        validOrder(order.status),
      );
      const revenue = orders.reduce(
        (sum, order) => sum + Number(order.total || 0),
        0,
      );
      return {
        orders: orders.length,
        revenue,
        average: orders.length > 0 ? revenue / orders.length : 0,
      };
    };

    const current = summarize(data);
    const previous = summarize(previousData);
    const growth =
      previous.revenue === 0
        ? current.revenue === 0
          ? 0
          : 100
        : ((current.revenue - previous.revenue) / Math.abs(previous.revenue)) *
          100;

    return { current, growth, currency: data?.restaurant.currency || 'USD' };
  }, [data, previousData]);

  const formatMoney = (value: number) => {
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: overview.currency,
        maximumFractionDigits: 2,
      }).format(value);
    } catch {
      return `${overview.currency} ${value.toFixed(2)}`;
    }
  };

  const cards = [
    [
      'Revenue',
      loading ? 'Loading…' : formatMoney(overview.current.revenue),
      'Valid orders in the last 30 days',
    ],
    [
      'Orders',
      loading ? 'Loading…' : overview.current.orders.toLocaleString(),
      'Valid orders in the last 30 days',
    ],
    [
      'Average Order',
      loading ? 'Loading…' : formatMoney(overview.current.average),
      'Average value per valid order',
    ],
    [
      'Growth',
      loading ? 'Loading…' : `${overview.growth >= 0 ? '+' : ''}${overview.growth.toFixed(1)}%`,
      'Revenue vs previous 30 days',
    ],
  ];

  return (
    <div className="px-4 pb-8 sm:px-6 sm:pb-10 lg:px-8 lg:pb-12">
      {/* HERO */}
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

        <div className="relative">
          <div
            className="text-[10px] font-black uppercase tracking-[0.2em]"
            style={{ color: 'var(--portal-accent)' }}
          >
            Restaurant intelligence
          </div>

          <div className="mt-3 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <h2
                className="text-3xl font-black tracking-tight sm:text-4xl"
                style={{ color: 'var(--portal-text)' }}
              >
                Know your business.
              </h2>

              <p
                className="mt-3 max-w-xl text-sm leading-6"
                style={{ color: 'var(--portal-text-muted)' }}
              >
                Turn your NOVAMENU activity into clear business insights,
                performance trends and actionable decisions.
              </p>
            </div>

            <Link
              href="/dashboard/reports/exports"
              className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-black transition hover:opacity-90"
              style={{
                background: 'var(--portal-accent)',
                color: '#ffffff',
                boxShadow: '0 10px 30px var(--portal-accent-soft)',
              }}
            >
              <Download className="h-4 w-4" />
              Export Reports
            </Link>
          </div>
        </div>
      </section>

      {error && (
        <div className="mt-6 rounded-xl border px-4 py-3 text-xs" style={{ borderColor: 'var(--portal-border)' }}>
          <span className="font-black">Report error:</span> {error}
        </div>
      )}

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value, description]) => (
          <div
            key={label}
            className="rounded-2xl border p-5"
            style={{
              background: 'var(--portal-surface)',
              borderColor: 'var(--portal-border)',
            }}
          >
            <div className="flex items-center justify-between">
              <span
                className="text-[10px] font-black uppercase tracking-[0.16em]"
                style={{ color: 'var(--portal-text-muted)' }}
              >
                {label}
              </span>

              <BarChart3
                className="h-4 w-4"
                style={{ color: 'var(--portal-accent)' }}
              />
            </div>

            <div
              className="mt-4 text-2xl font-black"
              style={{ color: 'var(--portal-text)' }}
            >
              {value}
            </div>

            <div
              className="mt-1 text-[10px]"
              style={{ color: 'var(--portal-text-muted)' }}
            >
              {description}
            </div>
          </div>
        ))}
      </section>

      {/* REPORT MODULES */}
      <section className="mt-8">
        <div className="mb-4">
          <div
            className="text-[10px] font-black uppercase tracking-[0.18em]"
            style={{ color: 'var(--portal-accent)' }}
          >
            Analytics modules
          </div>

          <h3
            className="mt-1 text-lg font-black"
            style={{ color: 'var(--portal-text)' }}
          >
            Explore your performance
          </h3>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {reportCards.map((card) => {
            const Icon = card.icon;

            return (
              <Link
                key={card.href}
                href={card.href}
                className="group rounded-2xl border p-5 transition hover:-translate-y-0.5"
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

                  <ArrowUpRight
                    className="h-4 w-4 opacity-40 transition group-hover:opacity-100"
                    style={{ color: 'var(--portal-accent)' }}
                  />
                </div>

                <h4
                  className="mt-5 text-sm font-black"
                  style={{ color: 'var(--portal-text)' }}
                >
                  {card.title}
                </h4>

                <p
                  className="mt-2 text-xs leading-5"
                  style={{ color: 'var(--portal-text-muted)' }}
                >
                  {card.description}
                </p>

                <div
                  className="mt-5 text-[10px] font-black uppercase tracking-[0.14em]"
                  style={{ color: 'var(--portal-accent)' }}
                >
                  Open report →
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}