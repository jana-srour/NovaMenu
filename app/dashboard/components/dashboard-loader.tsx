'use client';

export function DashboardLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--portal-background)', color: 'var(--portal-text)' }}>
      <div className="text-center">
        <div className="w-16 h-16 rounded-full border flex items-center justify-center mx-auto" style={{ borderColor: 'var(--portal-border)' }}>
          <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--portal-accent)', borderTopColor: 'transparent' }} />
        </div>

        <p className="mt-6 text-[10px] tracking-[0.35em] uppercase font-bold" style={{ color: 'var(--portal-accent)' }}>
          Preparing your experience
        </p>

        <p className="mt-2 text-[9px] tracking-[0.18em] uppercase" style={{ color: 'var(--portal-text)' }}>
          Restaurant workspace
        </p>
      </div>
    </div>
  );
}

