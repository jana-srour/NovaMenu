'use client';

import { FormEvent, useState } from 'react';
import { ArrowUpRight, Check, Mail, MessageSquare, Sparkles } from 'lucide-react';

const APP_VERSION = '0.2.0';
const FEEDBACK_EMAIL = 'novera.labs1@gmail.com';

export default function AboutPage() {
  const [feedback, setFeedback] = useState('');
  const [sent, setSent] = useState(false);

  const handleFeedbackSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const subject = encodeURIComponent('NOVAMENU feedback');
    const body = encodeURIComponent(feedback.trim());
    window.location.href = `mailto:${FEEDBACK_EMAIL}?subject=${subject}&body=${body}`;
    setSent(true);
  };

  return (
    <div className="min-h-screen px-5 py-8 sm:px-8 sm:py-10 lg:px-12 lg:py-12">
      <div className="mx-auto max-w-6xl">
        <header className="mb-10 flex flex-col justify-between gap-6 border-b pb-8 sm:flex-row sm:items-end" style={{ borderColor: 'var(--portal-border)' }}>
          <div>
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-lg" style={{ background: 'var(--portal-accent)' }}>
              <Sparkles className="h-5 w-5" />
            </div>
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--portal-accent)' }}>
              NOVAMENU portal
            </p>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl" style={{ color: 'var(--portal-text)' }}>
              Built for smoother service.
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-7" style={{ color: 'var(--portal-muted)' }}>
              NOVAMENU brings your menu, orders, pricing, and team tools into one calm workspace so your restaurant can focus on the guest experience.
            </p>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border px-4 py-3" style={{ borderColor: 'var(--portal-border)', background: 'var(--portal-surface)' }}>
            <span className="text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: 'var(--portal-muted)' }}>Version</span>
            <span className="rounded-full px-3 py-1 text-xs font-black" style={{ background: 'var(--portal-accent-soft)', color: 'var(--portal-accent)' }}>v{APP_VERSION}</span>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="rounded-3xl border p-6 sm:p-8" style={{ borderColor: 'var(--portal-border)', background: 'var(--portal-surface)' }}>
            <div className="mb-8 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'var(--portal-accent-soft)', color: 'var(--portal-accent)' }}>
                <MessageSquare className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-lg font-black" style={{ color: 'var(--portal-text)' }}>Tell us what you think</h2>
                <p className="text-xs" style={{ color: 'var(--portal-muted)' }}>Your feedback helps shape the next release.</p>
              </div>
            </div>

            <form onSubmit={handleFeedbackSubmit}>
              <label htmlFor="feedback" className="mb-2 block text-xs font-bold" style={{ color: 'var(--portal-text)' }}>
                Feedback or feature request
              </label>
              <textarea
                id="feedback"
                value={feedback}
                onChange={(event) => { setFeedback(event.target.value); setSent(false); }}
                required
                rows={7}
                placeholder="Share an idea, report a problem, or tell us what is working well..."
                className="w-full resize-y rounded-2xl border px-4 py-3 text-sm outline-none transition focus:ring-2"
                style={{ borderColor: 'var(--portal-border)', background: 'var(--portal-background)', color: 'var(--portal-text)', ['--tw-ring-color' as string]: 'var(--portal-accent)' }}
              />
              <button type="submit" className="mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-black text-white transition hover:opacity-90" style={{ background: 'var(--portal-accent)' }}>
                {sent ? <Check className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
                {sent ? 'Opening your email app' : 'Send feedback'}
                {!sent && <ArrowUpRight className="h-4 w-4" />}
              </button>
            </form>
          </section>

          <section className="rounded-3xl border p-6 sm:p-8" style={{ borderColor: 'var(--portal-border)', background: 'var(--portal-surface)' }}>
            <p className="mb-3 text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: 'var(--portal-accent)' }}>Contact us</p>
            <h2 className="text-2xl font-black" style={{ color: 'var(--portal-text)' }}>Have a question?</h2>
            <p className="mt-3 text-sm leading-7" style={{ color: 'var(--portal-muted)' }}>
              We would love to hear from you. Send the Novera Labs team a message and we will get back to you as soon as possible.
            </p>
            <a href={`mailto:${FEEDBACK_EMAIL}`} className="mt-8 inline-flex items-center gap-2 text-sm font-black" style={{ color: 'var(--portal-accent)' }}>
              {FEEDBACK_EMAIL}
              <ArrowUpRight className="h-4 w-4" />
            </a>
            <div className="mt-10 border-t pt-6" style={{ borderColor: 'var(--portal-border)' }}>
              <p className="text-xs font-bold" style={{ color: 'var(--portal-text)' }}>Powered by Novera Labs</p>
              <p className="mt-2 text-xs leading-6" style={{ color: 'var(--portal-muted)' }}>Digital restaurant tools made simple, practical, and ready to grow with you.</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}