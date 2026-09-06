'use client';

import Link from 'next/link';
import { ArrowUpRight, Lock } from 'lucide-react';

interface PlanRequiredProps {
  featureName: string;
  requiredPlan: string;
}

export function PlanRequired({
  featureName,
  requiredPlan,
}: PlanRequiredProps) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6 py-12">
      <div className="w-full max-w-xl text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
          <Lock className="h-7 w-7 text-slate-500" />
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          {featureName} requires {requiredPlan}
        </h1>

        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-500">
          Your current plan does not include {featureName}. Upgrade your
          NOVAMENU plan to unlock this feature.
        </p>

        <Link
          href="/dashboard/billing"
          className="mt-7 inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90"
          style={{
            background: 'var(--portal-accent, #536DFE)',
          }}
        >
          View Plans
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}