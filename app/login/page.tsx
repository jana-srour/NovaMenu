'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setLoading(true);
    setErrorMsg('');

    try {
      // 1. Authenticate user credentials
      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (authError) {
        setErrorMsg(authError.message);
        setLoading(false);
        return;
      }

      const userId = authData.user?.id;

      if (!userId) {
        setErrorMsg('User ID not found.');
        setLoading(false);
        return;
      }

      // 2. Verify user belongs to a restaurant
      const { data: memberData, error: memberError } = await supabase
        .from('restaurant_members')
        .select('restaurant_id')
        .eq('user_id', userId)
        .maybeSingle();

      if (memberError) {
        setErrorMsg(memberError.message);
        setLoading(false);
        return;
      }

      if (!memberData) {
        setErrorMsg(
          'Access denied: Account is not associated with any restaurant.'
        );
        setLoading(false);
        return;
      }

      // 3. Refresh session and redirect
      router.refresh();
      router.push('/dashboard');
    } catch (error) {
      console.error('Login error:', error);

      setErrorMsg(
        error instanceof Error
          ? error.message
          : 'Something went wrong while signing in.'
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

        {/* BRAND */}
        <div className="flex items-center gap-3">

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

          <div>

            <div className="text-sm font-black tracking-[0.22em] text-white">
              NOVAMENU
            </div>

            <div className="text-[8px] tracking-[0.22em] text-white/35 font-semibold">
              RESTAURANT OPERATING SYSTEM
            </div>

          </div>

        </div>


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
          max-w-[1450px]
          mx-auto
          px-5
          sm:px-8
          lg:px-12
          xl:px-16
          py-10
          lg:py-14
          flex
          items-center
        "
      >

        <div className="w-full grid lg:grid-cols-12 gap-12 xl:gap-20 items-center">


          {/* ===================================================== */}
          {/* LEFT SIDE */}
          {/* ===================================================== */}

          <div className="hidden lg:block lg:col-span-7">

            <div className="max-w-[720px]">

              {/* EYEBROW */}

              <div
                className="
                  inline-flex
                  items-center
                  gap-2.5
                  px-3.5
                  py-2
                  rounded-full
                  border
                  border-[#C9A76A]/20
                  bg-[#C9A76A]/[0.045]
                  backdrop-blur-xl
                  mb-7
                "
              >

                <span className="w-1.5 h-1.5 rounded-full bg-[#C9A76A] shadow-[0_0_12px_rgba(201,167,106,0.7)]" />

                <span className="text-[9px] uppercase tracking-[0.22em] font-bold text-[#C9A76A]">
                  Hospitality Intelligence
                </span>

              </div>


              {/* HEADLINE */}

              <div>

                <h1
                  className="
                    text-5xl
                    xl:text-[4.5rem]
                    font-black
                    leading-[0.98]
                    tracking-[-0.045em]
                    text-white
                  "
                >
                  The intelligence
                  <br />

                  <span
                    className="
                      bg-gradient-to-r
                      from-[#F1D9A5]
                      via-[#C9A76A]
                      to-[#8C6A39]
                      bg-clip-text
                      text-transparent
                    "
                  >
                    behind your table.
                  </span>
                </h1>

                <p className="mt-7 text-sm xl:text-base leading-7 text-white/40 max-w-xl">
                  Manage your digital menu, monitor orders and keep your
                  restaurant operation beautifully connected — from one
                  intelligent workspace.
                </p>

              </div>


              {/* ================================================= */}
              {/* PREMIUM DASHBOARD PREVIEW */}
              {/* ================================================= */}

              <div className="relative mt-12">

                {/* Outer glow */}

                <div
                  className="
                    absolute
                    -inset-5
                    rounded-[2rem]
                    blur-3xl
                    opacity-20
                  "
                  style={{
                    background:
                      'linear-gradient(90deg, #C9A76A, transparent, #536DFE)',
                  }}
                />


                {/* WINDOW */}

                <div
                  className="
                    relative
                    rounded-[1.7rem]
                    border
                    border-white/[0.09]
                    bg-[#111318]/90
                    backdrop-blur-2xl
                    overflow-hidden
                    shadow-[0_35px_100px_rgba(0,0,0,0.55)]
                  "
                >

                  {/* Top line */}

                  <div className="h-[2px] bg-gradient-to-r from-transparent via-[#C9A76A]/60 to-transparent" />


                  {/* Window header */}

                  <div
                    className="
                      px-5
                      py-4
                      flex
                      items-center
                      justify-between
                      border-b
                      border-white/[0.055]
                    "
                  >

                    <div className="flex items-center gap-3">

                      <div className="flex gap-1.5">

                        <span className="w-2 h-2 rounded-full bg-white/10" />
                        <span className="w-2 h-2 rounded-full bg-white/10" />
                        <span className="w-2 h-2 rounded-full bg-white/10" />

                      </div>

                      <span className="text-[9px] tracking-[0.14em] uppercase text-white/25 font-semibold">
                        Operations / Live Overview
                      </span>

                    </div>


                    <div className="flex items-center gap-2">

                      <span className="w-1.5 h-1.5 rounded-full bg-[#6EE7B7] shadow-[0_0_10px_rgba(110,231,183,0.7)]" />

                      <span className="text-[8px] uppercase tracking-[0.15em] text-white/35">
                        Live
                      </span>

                    </div>

                  </div>


                  {/* Dashboard content */}

                  <div className="p-5">

                    <div className="grid grid-cols-3 gap-3">

                      {/* KPI 1 */}

                      <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-4">

                        <div className="text-[8px] uppercase tracking-[0.15em] text-white/25">
                          Orders Today
                        </div>

                        <div className="mt-2 text-2xl font-black text-white">
                          184
                        </div>

                        <div className="mt-1 text-[8px] text-[#6EE7B7]">
                          +18.4%
                        </div>

                      </div>


                      {/* KPI 2 */}

                      <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-4">

                        <div className="text-[8px] uppercase tracking-[0.15em] text-white/25">
                          Revenue
                        </div>

                        <div className="mt-2 text-2xl font-black text-white">
                          $4.82k
                        </div>

                        <div className="mt-1 text-[8px] text-[#C9A76A]">
                          Today
                        </div>

                      </div>


                      {/* KPI 3 */}

                      <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-4">

                        <div className="text-[8px] uppercase tracking-[0.15em] text-white/25">
                          Avg. Order
                        </div>

                        <div className="mt-2 text-2xl font-black text-white">
                          $26.20
                        </div>

                        <div className="mt-1 text-[8px] text-white/25">
                          Per table
                        </div>

                      </div>

                    </div>


                    {/* GRAPH */}

                    <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">

                      <div className="flex justify-between items-center mb-5">

                        <div>

                          <div className="text-[8px] uppercase tracking-[0.15em] text-white/25">
                            Order activity
                          </div>

                          <div className="text-xs font-bold text-white/70 mt-1">
                            Live performance
                          </div>

                        </div>

                        <span className="text-[8px] text-white/20">
                          Last 7 hours
                        </span>

                      </div>


                      <div className="h-[105px] relative">

                        {/* Grid */}

                        <div className="absolute inset-0 flex flex-col justify-between">

                          <div className="border-t border-white/[0.035]" />
                          <div className="border-t border-white/[0.035]" />
                          <div className="border-t border-white/[0.035]" />
                          <div className="border-t border-white/[0.035]" />

                        </div>


                        {/* SVG GRAPH */}

                        <svg
                          viewBox="0 0 700 120"
                          className="absolute inset-0 w-full h-full overflow-visible"
                          preserveAspectRatio="none"
                          aria-label="Order activity graph"
                          role="img"
                        >

                          <defs>

                            <linearGradient
                              id="goldGraph"
                              x1="0"
                              x2="1"
                              y1="0"
                              y2="0"
                            >
                              <stop offset="0%" stopColor="#8C6A39" />
                              <stop offset="50%" stopColor="#C9A76A" />
                              <stop offset="100%" stopColor="#F1D9A5" />
                            </linearGradient>

                            <linearGradient
                              id="graphFill"
                              x1="0"
                              x2="0"
                              y1="0"
                              y2="1"
                            >
                              <stop
                                offset="0%"
                                stopColor="#C9A76A"
                                stopOpacity="0.18"
                              />

                              <stop
                                offset="100%"
                                stopColor="#C9A76A"
                                stopOpacity="0"
                              />
                            </linearGradient>

                          </defs>


                          <path
                            d="M0 95 C55 92 70 75 120 80 C165 85 180 55 225 62 C270 69 295 42 335 50 C380 59 395 70 430 51 C465 32 495 44 530 36 C565 28 600 47 625 31 C650 18 675 28 700 12 L700 120 L0 120 Z"
                            fill="url(#graphFill)"
                          />


                          <path
                            d="M0 95 C55 92 70 75 120 80 C165 85 180 55 225 62 C270 69 295 42 335 50 C380 59 395 70 430 51 C465 32 495 44 530 36 C565 28 600 47 625 31 C650 18 675 28 700 12"
                            fill="none"
                            stroke="url(#goldGraph)"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            vectorEffect="non-scaling-stroke"
                          />

                        </svg>

                      </div>

                    </div>

                  </div>

                </div>


                {/* Floating notification */}

                <div
                  className="
                    absolute
                    -right-5
                    -bottom-5
                    rounded-2xl
                    border
                    border-white/[0.09]
                    bg-[#16181D]/95
                    backdrop-blur-xl
                    px-4
                    py-3
                    shadow-[0_20px_50px_rgba(0,0,0,0.45)]
                    animate-bounce
                  "
                  style={{
                    animationDuration: '4s',
                    animationIterationCount: 'infinite',
                  }}
                >

                  <div className="flex items-center gap-3">

                    <div
                      className="
                        w-9
                        h-9
                        rounded-xl
                        flex
                        items-center
                        justify-center
                        bg-[#C9A76A]/10
                        border
                        border-[#C9A76A]/15
                      "
                    >
                      <span className="text-[#C9A76A] text-sm">
                        ✦
                      </span>
                    </div>

                    <div>

                      <div className="text-[8px] uppercase tracking-[0.14em] text-white/25">
                        Latest order
                      </div>

                      <div className="text-xs font-bold text-white/80 mt-0.5">
                        Table 12 · Received
                      </div>

                    </div>

                  </div>

                </div>

              </div>


              {/* FEATURES */}

              <div className="mt-10 flex items-center gap-8">

                <Feature
                  icon="01"
                  title="Digital Menu"
                />

                <Feature
                  icon="02"
                  title="Live Orders"
                />

                <Feature
                  icon="03"
                  title="Smart Control"
                />

              </div>

            </div>

          </div>


          {/* ===================================================== */}
          {/* RIGHT LOGIN */}
          {/* ===================================================== */}

          <div className="w-full lg:col-span-5">

            <div className="relative max-w-[470px] mx-auto">

              {/* Card outer glow */}

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


              {/* Login Card */}

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


                {/* Header */}

                <div className="mb-8">

                  <div className="flex items-center justify-between mb-6">

                    <div>

                      <span className="text-[9px] uppercase tracking-[0.2em] text-[#C9A76A] font-bold">
                        Secure Access
                      </span>

                      <div className="flex items-center gap-2 mt-2">

                        <span className="w-1.5 h-1.5 rounded-full bg-[#6EE7B7] shadow-[0_0_10px_rgba(110,231,183,0.7)]" />

                        <span className="text-[8px] uppercase tracking-[0.14em] text-white/25">
                          Encrypted session
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


                  <h2 className="text-3xl sm:text-[2.1rem] font-black tracking-[-0.035em] text-white">
                    Welcome back.
                  </h2>

                  <p className="mt-2.5 text-xs leading-5 text-white/35">
                    Sign in to continue managing your restaurant.
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


                {/* FORM */}

                <form
                  onSubmit={handleLogin}
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


                  {/* PASSWORD */}

                  <div className="space-y-2">

                    <label
                      htmlFor="password"
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
                      Password
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
                        •
                      </div>

                      <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="
                          w-full
                          h-14
                          pl-12
                          pr-14
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

                      <button
                        type="button"
                        onClick={() =>
                          setShowPassword((value) => !value)
                        }
                        className="
                          absolute
                          right-3
                          top-1/2
                          -translate-y-1/2
                          w-9
                          h-9
                          rounded-lg
                          text-white/25
                          hover:text-white/60
                          hover:bg-white/[0.05]
                          transition-all
                        "
                        aria-label={
                          showPassword
                            ? 'Hide password'
                            : 'Show password'
                        }
                      >
                        {showPassword ? '◉' : '◌'}
                      </button>

                    </div>

                  </div>


                  {/* LOGIN BUTTON */}

                  <button
                    type="submit"
                    disabled={loading}
                    className="
                      group
                      relative
                      overflow-hidden
                      w-full
                      h-14
                      mt-2
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
                            Authenticating...
                          </span>
                        </>
                      ) : (
                        <>
                          <span>
                            Enter NOVAMENU
                          </span>

                          <span className="text-base transition-transform duration-300 group-hover:translate-x-1">
                            →
                          </span>
                        </>
                      )}

                    </span>

                  </button>

                </form>


                {/* SIGN UP */}

                <div className="mt-6 text-center">

                  <p className="text-[10px] text-white/25">
                    Are you a restaurant owner?
                  </p>

                  <button
                    type="button"
                    onClick={() => router.push('/signup')}
                    className="
                      group
                      mt-2
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
                    Create your restaurant workspace

                    <span
                      className="
                        transition-transform
                        duration-300
                        group-hover:translate-x-1
                      "
                    >
                      →
                    </span>
                  </button>

                </div>


                {/* SECURITY FOOTER */}

                <div className="mt-7 pt-5 border-t border-white/[0.055]">

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


            {/* MOBILE BRAND */}

            <div className="lg:hidden flex justify-center mt-7">

              <div className="flex items-center gap-2">

                <div
                  className="
                    relative
                    w-6
                    h-6
                    rounded-lg
                    overflow-hidden
                    border
                    border-[#C9A76A]/25
                    shadow-[0_0_20px_rgba(201,167,106,0.10)]
                  "
                >
                  <img
                    src="/novamenu-icon.jpeg"
                    alt="NOVAMENU"
                    className="h-full w-full object-contain"
                  />
                </div>

                <span className="text-[9px] font-bold tracking-[0.2em] text-white/25">
                  NOVAMENU
                </span>

              </div>

            </div>

          </div>

        </div>

      </section>


      {/* ========================================================= */}
      {/* FOOTER */}
      {/* ========================================================= */}

      <footer
        className="
          relative
          z-10
          px-6
          py-4
          border-t
          border-white/[0.045]
          bg-[#08090C]/40
        "
      >

        <div className="max-w-[1450px] mx-auto flex items-center justify-between">

          <p className="text-[8px] sm:text-[9px] uppercase tracking-[0.16em] text-white/15">
            NOVAMENU · DIGITAL DINING EXPERIENCE
          </p>

          <p className="hidden sm:block text-[8px] tracking-[0.12em] text-white/10">
            © {new Date().getFullYear()} NOVAMENU
          </p>

        </div>

      </footer>

    </main>
  );
}


/* ============================================================= */
/* FEATURE COMPONENT */
/* ============================================================= */

function Feature({
  icon,
  title,
}: {
  icon: string;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2.5">

      <div
        className="
          w-8
          h-8
          rounded-lg
          border
          border-white/[0.07]
          bg-white/[0.025]
          flex
          items-center
          justify-center
          text-[8px]
          font-bold
          tracking-wider
          text-[#C9A76A]/70
        "
      >
        {icon}
      </div>

      <span className="text-[9px] uppercase tracking-[0.12em] font-semibold text-white/25">
        {title}
      </span>

    </div>
  );
}