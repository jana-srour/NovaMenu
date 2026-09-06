'use client';

interface AccessRestrictedProps {
  title?: string;
  description?: string;
}

export function AccessRestricted({
  title = 'Access Restricted',
  description = 'You do not have access to this dashboard area.',
}: AccessRestrictedProps) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ background: 'var(--portal-background)', color: 'var(--portal-text)' }}>
      <div className="w-full max-w-md rounded-[28px] border p-8 text-center shadow-[0_25px_80px_rgba(23,22,19,0.08)]" style={{ borderColor: 'var(--portal-border)', background: 'var(--portal-surface)' }}>
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[24px] border" style={{ background: 'linear-gradient(135deg, var(--portal-accent-soft), transparent)', borderColor: 'var(--portal-border)' }}>
          <span className="text-3xl" aria-hidden="true">
            ðŸ”’
          </span>
        </div>

        <div className="mt-6">
          <div className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: 'var(--portal-accent)' }}>
            NOVAMENU
          </div>

          <h1 className="mt-3 text-2xl sm:text-3xl font-black tracking-tight" style={{ color: 'var(--portal-text)' }}>
            {title}
          </h1>

          <p className="mt-3 text-sm leading-6" style={{ color: 'var(--portal-text)' }}>
            {description}
          </p>
        </div>

        <div className="mt-7 rounded-2xl border p-4" style={{ borderColor: 'var(--portal-border)', background: 'var(--portal-background)' }}>
          <div className="flex items-center justify-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: 'var(--portal-accent)' }} />
            <span className="text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: 'var(--portal-text)' }}>
              Contact your restaurant owner
            </span>
          </div>
        </div>

        <div className="mt-7 flex items-center justify-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-xl text-[10px] font-black text-white" style={{ background: 'linear-gradient(135deg, var(--portal-accent), var(--portal-accent-soft))' }}>
            N
          </div>
          <span className="text-[9px] font-black tracking-[0.18em]" style={{ color: 'var(--portal-text)' }}>
            DIGITAL MENU PLATFORM
          </span>
        </div>
      </div>
    </div>
  );
}

