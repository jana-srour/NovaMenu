'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  TrendingUp,
  ShoppingBag,
  Utensils,
  Tags,
  DollarSign,
  Users,
  Activity,
  FileSpreadsheet,
} from 'lucide-react';

const reportNavigation = [
  {
    name: 'Overview',
    href: '/dashboard/reports',
    icon: BarChart3,
  },
  {
    name: 'Sales & Revenue',
    href: '/dashboard/reports/sales',
    icon: TrendingUp,
  },
  {
    name: 'Orders',
    href: '/dashboard/reports/orders',
    icon: ShoppingBag,
  },
  {
    name: 'Menu Performance',
    href: '/dashboard/reports/menu',
    icon: Utensils,
  },
  {
    name: 'Promotions',
    href: '/dashboard/reports/promotions',
    icon: Tags,
  },
  {
    name: 'Pricing',
    href: '/dashboard/reports/pricing',
    icon: DollarSign,
  },
  {
    name: 'Customers',
    href: '/dashboard/reports/customers',
    icon: Users,
  },
  {
    name: 'Operations',
    href: '/dashboard/reports/operations',
    icon: Activity,
  },
  {
    name: 'Export Center',
    href: '/dashboard/reports/exports',
    icon: FileSpreadsheet,
  },
];

export default function ReportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div
      className="min-h-screen"
      style={{
        background: 'var(--portal-background)',
        color: 'var(--portal-text)',
      }}
    >
      {/* REPORTS HEADER */}
      <div
        className="border-b"
        style={{
          borderColor: 'var(--portal-border)',
          background: 'var(--portal-surface)',
        }}
      >
        <div className="px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-2xl"
              style={{
                background: 'var(--portal-accent-soft)',
                color: 'var(--portal-accent)',
                boxShadow: '0 0 30px var(--portal-accent-soft)',
              }}
            >
              <BarChart3 className="h-5 w-5" />
            </div>

            <div>
              <div
                className="text-[10px] font-black uppercase tracking-[0.2em]"
                style={{ color: 'var(--portal-accent)' }}
              >
                Business Intelligence
              </div>

              <h1
                className="mt-1 text-xl font-black tracking-tight sm:text-2xl"
                style={{ color: 'var(--portal-text)' }}
              >
                Reports & Analytics
              </h1>

              <p
                className="mt-1 text-xs"
                style={{ color: 'var(--portal-text-muted)' }}
              >
                Understand your restaurant performance at a glance.
              </p>
            </div>
          </div>

          {/* REPORT NAVIGATION */}
          <div className="mt-5 overflow-x-auto">
            <nav className="flex min-w-max gap-1.5">
              {reportNavigation.map((item) => {
                const active =
                  item.href === '/dashboard/reports'
                    ? pathname === '/dashboard/reports'
                    : pathname.startsWith(item.href);

                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="group flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition"
                    style={{
                      color: active
                        ? 'var(--portal-accent)'
                        : 'var(--portal-text-muted)',
                      background: active
                        ? 'var(--portal-accent-soft)'
                        : 'transparent',
                    }}
                  >
                    <Icon className="h-3.5 w-3.5" />

                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </div>

      {/* PAGE CONTENT */}
      <main>{children}</main>
    </div>
  );
}