'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function ForgotPasswordPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleResetRequest = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const normalizedEmail = email.trim();

      if (!normalizedEmail) {
        setErrorMsg('Please enter your account email.');
        setLoading(false);
        return;
      }

      const redirectTo = `${window.location.origin}/reset-password`;

      const { error } = await supabase.auth.resetPasswordForEmail(
        normalizedEmail,
        {
          redirectTo,
        }
      );

      if (error) {
        setErrorMsg(error.message);
        setLoading(false);
        return;
      }

      setSuccessMsg(
        'If an account exists for this email, a password reset link has been sent. Please check your inbox.'
      );

      setLoading(false);
    } catch (error) {
      console.error('Password reset request error:', error);

      setErrorMsg(
        error instanceof Error
          ? error.message
          : 'Something went wrong while requesting a password reset.'
      );

      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen relative overflow-hidden bg-[#08090C] text-white selection:bg-[#C9A76A]/30 selection:text-white">

      {/* ========================================================= */}
      {/* AMBIENT BACKGROUND */}
      {/* ========================================================= */}

      <div className="absolute inset-0 pointer-events-none overflow-hidden">

        {/* Gold glow */}
        <div
          className="
            absolute
            -top-[300px]
            -left-[250px]
            w-[750px]
            h-[750px]
            rounded-full
            blur-[150px]
            opacity-[0.13]
            animate-pulse
          "
          style={{
            background:
              'radial-gradient(circle, #C9A76A 0%, transparent 65%)',
            animationDuration: '14s',
          }}
        />

        {/* Blue / violet glow */}
        <div
          className="
            absolute
            -bottom-[350px]
            -right-[250px]
            w-[850px]
            h-[850px]
            rounded-full
            blur-[170px]
            opacity-[0.14]
            animate-pulse
          "
          style={{
            background:
              'radial-gradient(circle, #536DFE 0%, #765BD5 35%, transparent 70%)',
            animationDuration: '17s',
          }}
        />

        {/* Center subtle glow */}
        <div
          className="
            absolute
            top-[35%]
            left-[45%]
            w-[500px]
            h-[500px]
            rounded-full
            blur-[180px]
            opacity-[0.045]
          "
          style={{
            background: '#FFFFFF',
          }}
        />

        {/* Grid */}
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
            backgroundSize: '70px 70px',
          }}
        />

        {/* Fine dots */}
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              'radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)',
            backgroundSize: '36px 36px',
          }}
        />

        {/* Decorative rings */}
        <div className="absolute -top-[240px] -right-[240px] w-[600px] h-[600px] rounded-full border border-white/[0.035]" />

        <div className="absolute -top-[160px] -right-[160px] w-[440px] h-[440px] rounded-full border border-[#C9A76A]/[0.08]" />

        <div className="absolute -bottom-[300px] -left-[280px] w-[700px] h-[700px] rounded-full border border-white/[0.025]" />

      </div>

      {/* ========================================================= */}
      {/* TOP BAR */}
      {/* ========================================================= */}

      <header
        className="
          relative
          z-20
          h-[82px]
          px-6
          lg:px-12
          flex
          items-center
          justify-between
          border-b
          border-white/[0.06]
          bg-[#08090C]/70
          backdrop-blur-2xl
        "
      >

        <button
          type="button"
          onClick={() => router.push('/login')}
          className="flex items-center gap-3 group"
        >

          <div
            className="
              relative
              w-10
              h-10
              rounded-xl
              flex
              items-center
              justify-center
              overflow-hidden
              border
              border-[#C9A76A]/30
              shadow-[0_0_35px_rgba(201,167,106,0.12)]
            "
          >

            <img
              src="/novamenu-icon.jpeg"
              alt="NOVAMENU"
              className="h-full w-full object-contain"
            />

          </div>

          <div className="text-left">

            <div className="text-sm font-black tracking-[0.22em] text-white">
              NOVAMENU
            </div>

            <div className="text-[8px] tracking-[0.22em] text-white/35 font-semibold">
              RESTAURANT OPERATING SYSTEM
            </div>

          </div>

        </button>

        {/* STATUS */}

        <div
          className="
            hidden
            sm:flex
            items-center
            gap-2.5
            px-3.5
            py-2
            rounded-full
            border
            border-white/[0.07]
            bg-white/[0.025]
            backdrop-blur-xl
          "
        >

          <span className="relative flex w-2 h-2">

            <span className="absolute inset-0 rounded-full bg-[#6EE7B7] opacity-40 animate-ping" />

            <span className="relative w-2 h-2 rounded-full bg-[#6EE7B7] shadow-[0_0_12px_rgba(110,231,183,0.7)]" />

          </span>

          <span className="text-[9px] uppercase tracking-[0.16em] text-white/45 font-semibold">
            Platform Online
          </span>

        </div>

      </header>

      {/* ========================================================= */}
      {/* MAIN */}
      {/* ========================================================= */}

      <section
        className="
          relative
          z-10
          min-h-[calc(100vh-82px)]
          flex
          items-center
          justify-center
          px-5
          py-12
        "
      >

        <div className="relative w-full max-w-[470px]">

          {/* Outer glow */}

          <div
            className="
              absolute
              -inset-[1px]
              rounded-[2rem]
              opacity-70
              blur-[1px]
            "
            style={{
              background:
                'linear-gradient(135deg, rgba(201,167,106,0.35), rgba(255,255,255,0.04), rgba(83,109,254,0.18))',
            }}
          />

          {/* CARD */}

          <div
            className="
              relative
              rounded-[2rem]
              border
              border-white/[0.09]
              bg-[#111318]/90
              backdrop-blur-3xl
              p-7
              sm:p-9
              shadow-[0_40px_100px_rgba(0,0,0,0.55)]
            "
          >

            {/* Top highlight */}

            <div
              className="
                absolute
                top-0
                left-[15%]
                right-[15%]
                h-px
                bg-gradient-to-r
                from-transparent
                via-[#C9A76A]/60
                to-transparent
              "
            />

            {/* HEADER */}

            <div className="mb-8">

              <div className="flex items-center justify-between mb-6">

                <div>

                  <span className="text-[9px] uppercase tracking-[0.2em] text-[#C9A76A] font-bold">
                    Account Recovery
                  </span>

                  <div className="flex items-center gap-2 mt-2">

                    <span className="w-1.5 h-1.5 rounded-full bg-[#6EE7B7] shadow-[0_0_10px_rgba(110,231,183,0.7)]" />

                    <span className="text-[8px] uppercase tracking-[0.14em] text-white/25">
                      Secure recovery
                    </span>

                  </div>

                </div>

                {/* Logo */}

                <div
                  className="
                    relative
                    w-11
                    h-11
                    rounded-xl
                    overflow-hidden
                    border
                    border-[#C9A76A]/25
                    shadow-[0_0_30px_rgba(201,167,106,0.12)]
                  "
                >

                  <img
                    src="/novamenu-icon.jpeg"
                    alt="NOVAMENU"
                    className="h-full w-full object-contain"
                  />

                </div>

              </div>

              <h1 className="text-3xl sm:text-[2.1rem] font-black tracking-[-0.035em] text-white">
                Forgot password?
              </h1>

              <p className="mt-2.5 text-xs leading-5 text-white/35">
                Enter your account email and we&apos;ll send you a secure
                link to create a new password.
              </p>

            </div>

            {/* ERROR */}

            {errorMsg && (
              <div
                className="
                  mb-5
                  p-3.5
                  rounded-xl
                  border
                  border-red-400/15
                  bg-red-400/[0.05]
                  flex
                  items-start
                  gap-3
                "
              >

                <span
                  className="
                    flex
                    items-center
                    justify-center
                    shrink-0
                    w-5
                    h-5
                    rounded-md
                    bg-red-400/10
                    text-red-300
                    text-[10px]
                    font-bold
                  "
                >
                  !
                </span>

                <span className="text-[11px] leading-5 text-red-200/70">
                  {errorMsg}
                </span>

              </div>
            )}

            {/* SUCCESS */}

            {successMsg && (
              <div
                className="
                  mb-5
                  p-4
                  rounded-xl
                  border
                  border-[#6EE7B7]/15
                  bg-[#6EE7B7]/[0.05]
                  flex
                  items-start
                  gap-3
                "
              >

                <span
                  className="
                    flex
                    items-center
                    justify-center
                    shrink-0
                    w-5
                    h-5
                    rounded-md
                    bg-[#6EE7B7]/10
                    text-[#6EE7B7]
                    text-[10px]
                    font-bold
                  "
                >
                  ✓
                </span>

                <span className="text-[11px] leading-5 text-[#B8F5D9]/80">
                  {successMsg}
                </span>

              </div>
            )}

            {/* FORM */}

            <form
              onSubmit={handleResetRequest}
              className="space-y-5"
            >

              {/* EMAIL */}

              <div className="space-y-2">

                <label
                  htmlFor="email"
                  className="
                    block
                    pl-1
                    text-[9px]
                    uppercase
                    tracking-[0.18em]
                    font-bold
                    text-white/35
                  "
                >
                  Account Email
                </label>

                <div className="relative">

                  <div
                    className="
                      absolute
                      left-4
                      top-1/2
                      -translate-y-1/2
                      w-5
                      h-5
                      rounded-md
                      border
                      border-white/[0.08]
                      flex
                      items-center
                      justify-center
                      text-[8px]
                      text-white/30
                    "
                  >
                    @
                  </div>

                  <input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="owner@restaurant.com"
                    className="
                      w-full
                      h-14
                      pl-12
                      pr-4
                      rounded-xl
                      bg-white/[0.025]
                      border
                      border-white/[0.08]
                      text-sm
                      text-white
                      placeholder:text-white/20
                      outline-none
                      transition-all
                      duration-300
                      focus:bg-white/[0.04]
                      focus:border-[#C9A76A]/45
                      focus:ring-4
                      focus:ring-[#C9A76A]/[0.06]
                    "
                  />

                </div>

              </div>

              {/* BUTTON */}

              <button
                type="submit"
                disabled={loading}
                className="
                  group
                  relative
                  overflow-hidden
                  w-full
                  h-14
                  rounded-xl
                  bg-gradient-to-r
                  from-[#C9A76A]
                  via-[#D8BA7E]
                  to-[#A98650]
                  text-[#14120E]
                  font-black
                  text-sm
                  shadow-[0_12px_35px_rgba(201,167,106,0.15)]
                  hover:shadow-[0_15px_45px_rgba(201,167,106,0.25)]
                  active:scale-[0.99]
                  transition-all
                  duration-300
                  disabled:opacity-50
                  disabled:cursor-not-allowed
                "
              >

                {/* Moving shine */}

                <span
                  className="
                    absolute
                    top-0
                    -left-[100%]
                    w-[70%]
                    h-full
                    skew-x-[-20deg]
                    bg-gradient-to-r
                    from-transparent
                    via-white/30
                    to-transparent
                    group-hover:left-[130%]
                    transition-all
                    duration-1000
                  "
                />

                <span className="relative flex items-center justify-center gap-2">

                  {loading ? (
                    <>
                      <span
                        className="
                          w-4
                          h-4
                          rounded-full
                          border-2
                          border-[#14120E]/30
                          border-t-[#14120E]
                          animate-spin
                        "
                      />

                      <span>
                        Sending recovery link...
                      </span>
                    </>
                  ) : (
                    <>
                      <span>
                        Send Reset Link
                      </span>

                      <span className="text-base transition-transform duration-300 group-hover:translate-x-1">
                        →
                      </span>
                    </>
                  )}

                </span>

              </button>

            </form>

            {/* BACK TO LOGIN */}

            <div className="mt-7 pt-5 border-t border-white/[0.055] text-center">

              <button
                type="button"
                onClick={() => router.push('/login')}
                className="
                  group
                  inline-flex
                  items-center
                  gap-1.5
                  text-xs
                  font-semibold
                  text-[#C9A76A]
                  hover:text-[#E2C98F]
                  transition-colors
                "
              >

                <span className="transition-transform duration-300 group-hover:-translate-x-1">
                  ←
                </span>

                Back to login

              </button>

            </div>

            {/* SECURITY FOOTER */}

            <div className="mt-5">

              <div className="flex items-center justify-center gap-2">

                <span className="text-[10px] text-[#6EE7B7]/70">
                  ◈
                </span>

                <span className="text-[8px] uppercase tracking-[0.18em] font-bold text-white/20">
                  Protected restaurant workspace
                </span>

              </div>

            </div>

          </div>

        </div>

      </section>

    </main>
  );
}