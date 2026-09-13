'use client';

import { useEffect, useState } from 'react';

type ReportDateRangePickerProps = {
  period: string;
  onPeriodChange: (period: string) => void;
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
};

export default function ReportDateRangePicker({
  period,
  onPeriodChange,
  from,
  to,
  onFromChange,
  onToChange,
}: ReportDateRangePickerProps) {
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);

  useEffect(() => {
    setDraftFrom(from);
    setDraftTo(to);
  }, [from, to]);

  const canApply =
    Boolean(draftFrom && draftTo) &&
    draftFrom <= draftTo;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => onPeriodChange('custom')}
        className="rounded-lg border px-3 py-2 text-xs font-bold transition"
        style={{
          borderColor:
            period === 'custom'
              ? 'var(--portal-accent)'
              : 'var(--portal-border)',
          background:
            period === 'custom'
              ? 'var(--portal-accent-soft)'
              : 'var(--portal-surface)',
          color:
            period === 'custom'
              ? 'var(--portal-accent)'
              : 'var(--portal-text-muted)',
        }}
      >
        Custom range
      </button>

      {period === 'custom' && (
        <>
          <label className="flex items-center gap-1 text-[10px] font-bold">
            From
            <input
              type="date"
              value={draftFrom}
              onChange={(event) => setDraftFrom(event.target.value)}
              className="rounded-lg border bg-transparent px-2 py-2 text-xs"
              style={{ borderColor: 'var(--portal-border)' }}
            />
          </label>
          <label className="flex items-center gap-1 text-[10px] font-bold">
            To
            <input
              type="date"
              value={draftTo}
              onChange={(event) => setDraftTo(event.target.value)}
              className="rounded-lg border bg-transparent px-2 py-2 text-xs"
              style={{ borderColor: 'var(--portal-border)' }}
            />
          </label>
          <button
            type="button"
            disabled={!canApply}
            onClick={() => {
              onFromChange(draftFrom);
              onToChange(draftTo);
              onPeriodChange('custom');
            }}
            className="rounded-lg px-3 py-2 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-40"
            style={{
              background: 'var(--portal-accent)',
              color: '#fff',
            }}
          >
            Apply
          </button>
        </>
      )}
    </div>
  );
}
