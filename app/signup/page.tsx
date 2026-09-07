'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function SignUpPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [restaurantEmail, setRestaurantEmail] = useState('');
  const [password, setPassword] = useState('');
  const [restaurantName, setRestaurantName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [website, setWebsite] = useState('');
  const [facebook, setFacebook] = useState('');
  const [instagram, setInstagram] = useState('');
  const [twitter, setTwitter] = useState('');
  const [address, setAddress] = useState('');

  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const handleSignUp = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!acceptedTerms) {
      setErrorMsg(
        'Please accept the Terms of Service and Privacy Policy before creating your workspace.'
      );
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      // 1. Create authentication account
      const { data: authData, error: authError } =
        await supabase.auth.signUp({
          email: email.trim(),
          password,
        });

      if (authError || !authData.user) {
        setErrorMsg(authError?.message || 'Sign up failed.');
        setLoading(false);
        return;
      }

      // 2. Generate restaurant slug
      const slug = restaurantName
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9 -]/g, '')
        .replace(/\s+/g, '-');

      const basePayload = {
        name: restaurantName.trim(),
        slug: `${slug}-${Math.floor(1000 + Math.random() * 9000)}`,
        email: restaurantEmail.trim(),
        whatsapp_number: whatsapp.trim(),
        phone_number: phoneNumber.trim(),
        website_url: website.trim(),
        facebook_url: facebook.trim(),
        instagram_url: instagram.trim(),
        twitter_url: twitter.trim(),
        address: address.trim(),
        currency: 'USD',
      };

      // 3. Create restaurant
      const { data: restData, error: restError } = await supabase
        .from('restaurants')
        .insert([basePayload])
        .select()
        .single();

      if (restError || !restData) {
        setErrorMsg(
          restError?.message || 'Failed to create restaurant record.'
        );
        setLoading(false);
        return;
      }

      // 4. Create restaurant owner membership
      const { error: memberError } = await supabase
        .from('restaurant_members')
        .insert([
          {
            restaurant_id: restData.id,
            user_id: authData.user.id,
            role: 'owner',
          },
        ]);

      if (memberError) {
        setErrorMsg(memberError.message);
        setLoading(false);
        return;
      }

      const { error: subscriptionError } = await supabase.rpc(
        'create_restaurant_trial',
        {
          p_restaurant_id: restData.id,
        }
      );

      if (subscriptionError) {
        setErrorMsg(subscriptionError.message);
        setLoading(false);
        return;
      }

      // 5. Save local restaurant settings
      localStorage.setItem(
        `nova-settings-${restData.id}`,
        JSON.stringify({
          website,
          facebook,
          instagram,
          twitter,
          address,
          markupMode: 'percentage',
          markupValue: '5',
        })
      );

      // 6. Enter workspace
      setLoading(false);

      router.refresh();
      router.push('/dashboard');
    } catch (error) {
      console.error('Signup error:', error);

      setErrorMsg(
        error instanceof Error
          ? error.message
          : 'Something went wrong while creating your workspace.'
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

        <button
          type="button"
          onClick={() => router.push('/login')}
          className="flex items-center gap-3"
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
          max-w-[1450px]
          mx-auto
          px-5
          sm:px-8
          lg:px-12
          xl:px-16
          py-10
          lg:py-14
        "
      >

        <div className="w-full grid lg:grid-cols-12 gap-12 xl:gap-20 items-start">


          {/* ===================================================== */}
          {/* LEFT SIDE */}
          {/* ===================================================== */}

          <div className="hidden lg:block lg:col-span-5 lg:sticky lg:top-10">

            <div className="max-w-[560px]">

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
                  Restaurant Onboarding
                </span>

              </div>


              {/* HEADLINE */}

              <h1
                className="
                  text-5xl
                  xl:text-[4.4rem]
                  font-black
                  leading-[0.98]
                  tracking-[-0.045em]
                  text-white
                "
              >
                Your restaurant.
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
                  One intelligent workspace.
                </span>
              </h1>


              <p className="mt-7 text-sm xl:text-base leading-7 text-white/40 max-w-lg">
                Create your NOVAMENU workspace and get seven days of full access
                to explore the platform, build your menu and start running your
                restaurant operations.
              </p>


              {/* ================================================= */}
              {/* SETUP STEPS */}
              {/* ================================================= */}

              <div className="mt-10 space-y-3">

                <SetupStep
                  number="01"
                  title="Create your workspace"
                  description="Tell us about your restaurant."
                  active
                />

                <SetupStep
                  number="02"
                  title="Build your digital menu"
                  description="Add categories, dishes and pricing."
                />

                <SetupStep
                  number="03"
                  title="Go live"
                  description="Connect your customers to NOVAMENU."
                />

              </div>


              {/* ================================================= */}
              {/* MINI PREVIEW */}
              {/* ================================================= */}

              <div className="relative mt-10">

                <div
                  className="
                    absolute
                    -inset-4
                    rounded-[1.8rem]
                    blur-3xl
                    opacity-20
                  "
                  style={{
                    background:
                      'linear-gradient(90deg, #C9A76A, transparent, #536DFE)',
                  }}
                />

                <div
                  className="
                    relative
                    rounded-[1.5rem]
                    border
                    border-white/[0.08]
                    bg-[#111318]/90
                    backdrop-blur-2xl
                    overflow-hidden
                    shadow-[0_30px_80px_rgba(0,0,0,0.45)]
                  "
                >

                  <div className="h-[2px] bg-gradient-to-r from-transparent via-[#C9A76A]/60 to-transparent" />

                  <div className="px-5 py-4 flex items-center justify-between border-b border-white/[0.05]">

                    <div className="flex items-center gap-3">

                      <div className="flex gap-1.5">

                        <span className="w-2 h-2 rounded-full bg-white/10" />
                        <span className="w-2 h-2 rounded-full bg-white/10" />
                        <span className="w-2 h-2 rounded-full bg-white/10" />

                      </div>

                      <span className="text-[8px] uppercase tracking-[0.14em] text-white/25 font-semibold">
                        Your workspace
                      </span>

                    </div>

                    <span className="text-[8px] uppercase tracking-[0.14em] text-[#6EE7B7]/60">
                      Ready
                    </span>

                  </div>


                  <div className="p-5">

                    <div className="flex items-center gap-4">

                      <div
                        className="
                          w-12
                          h-12
                          rounded-xl
                          bg-[#C9A76A]/10
                          border
                          border-[#C9A76A]/15
                          flex
                          items-center
                          justify-center
                        "
                      >
                        <span className="text-[#C9A76A] text-lg">
                          ✦
                        </span>
                      </div>

                      <div className="min-w-0">

                        <div className="text-[8px] uppercase tracking-[0.15em] text-white/25">
                          Restaurant
                        </div>

                        <div className="mt-1 text-sm font-bold text-white/80 truncate">
                          Your restaurant
                        </div>

                      </div>

                    </div>


                    <div className="grid grid-cols-3 gap-2 mt-5">

                      <PreviewStat
                        label="Menu"
                        value="Ready"
                      />

                      <PreviewStat
                        label="Orders"
                        value="Live"
                      />

                      <PreviewStat
                        label="Workspace"
                        value="Active"
                      />

                    </div>

                  </div>

                </div>

              </div>

            </div>

          </div>


          {/* ===================================================== */}
          {/* RIGHT SIGNUP */}
          {/* ===================================================== */}

          <div className="w-full lg:col-span-7">

            <div className="relative max-w-[700px] mx-auto">

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


              {/* Signup Card */}

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
                        New Restaurant
                      </span>

                      <div className="flex items-center gap-2 mt-2">

                        <span className="w-1.5 h-1.5 rounded-full bg-[#6EE7B7] shadow-[0_0_10px_rgba(110,231,183,0.7)]" />

                        <span className="text-[8px] uppercase tracking-[0.14em] text-white/25">
                          Workspace setup
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
                        flex
                        items-center
                        justify-center
                        overflow-hidden
                        border
                        border-[#C9A76A]/25
                        shadow-[0_0_30px_rgba(201,167,106,0.12)]
                      "
                    >

                      <div className="absolute inset-0 bg-gradient-to-br from-[#C9A76A] to-[#73562F]" />

                      <div className="absolute -top-3 -right-3 w-7 h-7 rounded-full bg-white/25 blur-md" />

                      <span className="relative text-[#11100D] font-black">
                        N
                      </span>

                    </div>

                  </div>


                  <h2 className="text-3xl sm:text-[2.1rem] font-black tracking-[-0.035em] text-white">
                    Build your workspace.
                  </h2>

                  <p className="mt-2.5 text-xs leading-5 text-white/35">
                    Create your restaurant account and get <span className="text-[#C9A76A] font-semibold">7 days of full access</span> to NOVAMENU.
                    No payment is required to start.
                  </p>

                </div>


                {/* ERROR */}

                {errorMsg && (
                  <div
                    className="
                      mb-6
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
                  onSubmit={handleSignUp}
                  className="space-y-7"
                >

                  {/* ================================================= */}
                  {/* RESTAURANT DETAILS */}
                  {/* ================================================= */}

                  <SignupSection
                    number="01"
                    title="Restaurant details"
                    description="Tell us about the restaurant you're setting up."
                  />

                  <div className="space-y-2">

                    <label
                      htmlFor="restaurantName"
                      className={labelClass}
                    >
                      Restaurant Name
                    </label>

                    <input
                      id="restaurantName"
                      type="text"
                      required
                      value={restaurantName}
                      onChange={(e) => setRestaurantName(e.target.value)}
                      placeholder="e.g. Cedar Bites"
                      className={inputClass}
                    />

                  </div>

                  <div className="space-y-2">

                  <label
                    htmlFor="restaurantEmail"
                    className={labelClass}
                  >
                    Restaurant Email
                  </label>

                  <input
                    id="restaurantEmail"
                    type="email"
                    required
                    autoComplete="email"
                    value={restaurantEmail}
                    onChange={(e) => setRestaurantEmail(e.target.value)}
                    placeholder="info@restaurant.com"
                    className={inputClass}
                  />

                </div>

                  <div className="grid sm:grid-cols-2 gap-4">

                    <Field
                      id="whatsapp"
                      label="WhatsApp Number"
                      value={whatsapp}
                      onChange={setWhatsapp}
                      placeholder="+961 70 000 000"
                    />

                    <Field
                      id="phoneNumber"
                      label="Phone Number"
                      value={phoneNumber}
                      onChange={setPhoneNumber}
                      placeholder="+961 70 000 000"
                    />

                  </div>


                  <div className="space-y-2">

                    <label
                      htmlFor="address"
                      className={labelClass}
                    >
                      Restaurant Address
                    </label>

                    <input
                      id="address"
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Street, city, country"
                      className={inputClass}
                    />

                  </div>


                  {/* ================================================= */}
                  {/* ONLINE PRESENCE */}
                  {/* ================================================= */}

                  <div className="pt-2">

                    <SignupSection
                      number="02"
                      title="Online presence"
                      description="Optional — you can always add or change these later."
                    />

                  </div>


                  <div className="grid sm:grid-cols-2 gap-4">

                    <Field
                      id="website"
                      label="Website"
                      value={website}
                      onChange={setWebsite}
                      placeholder="https://..."
                      type="url"
                    />

                    <Field
                      id="facebook"
                      label="Facebook"
                      value={facebook}
                      onChange={setFacebook}
                      placeholder="https://facebook.com/..."
                      type="url"
                    />

                  </div>


                  <div className="grid sm:grid-cols-2 gap-4">

                    <Field
                      id="instagram"
                      label="Instagram"
                      value={instagram}
                      onChange={setInstagram}
                      placeholder="https://instagram.com/..."
                      type="url"
                    />

                    <Field
                      id="twitter"
                      label="Twitter / X"
                      value={twitter}
                      onChange={setTwitter}
                      placeholder="https://x.com/..."
                      type="url"
                    />

                  </div>


                  {/* ================================================= */}
                  {/* OWNER ACCOUNT */}
                  {/* ================================================= */}

                  <div className="pt-2">

                    <SignupSection
                      number="03"
                      title="Owner account"
                      description="These credentials will be used to access your NOVAMENU workspace."
                    />

                  </div>


                  <div className="space-y-2">

                    <label
                      htmlFor="email"
                      className={labelClass}
                    >
                      Account Email
                    </label>

                    <input
                      id="email"
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="owner@restaurant.com"
                      className={inputClass}
                    />

                  </div>


                  <div className="space-y-2">

                    <label
                      htmlFor="password"
                      className={labelClass}
                    >
                      Password
                    </label>

                    <div className="relative">

                      <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        autoComplete="new-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Create a secure password"
                        className={`${inputClass} pr-14`}
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

                    <p className="text-[9px] text-white/20 pl-1 pt-1">
                      Minimum 6 characters.
                    </p>

                  </div>


                  {/* ================================================= */}
                  {/* TERMS & CONDITIONS */}
                  {/* ================================================= */}

                  <div className="pt-1">

                    <label
                      htmlFor="acceptedTerms"
                      className="
                        group
                        flex
                        items-start
                        gap-3
                        cursor-pointer
                        select-none
                      "
                    >

                      <input
                        id="acceptedTerms"
                        type="checkbox"
                        checked={acceptedTerms}
                        onChange={(e) => {
                          setAcceptedTerms(e.target.checked);

                          if (e.target.checked) {
                            setErrorMsg('');
                          }
                        }}
                        className="sr-only"
                      />

                      <span
                        className={`
                          relative
                          mt-0.5
                          shrink-0
                          w-5
                          h-5
                          rounded-md
                          border
                          flex
                          items-center
                          justify-center
                          transition-all
                          duration-200
                          ${
                            acceptedTerms
                              ? 'border-[#C9A76A] bg-[#C9A76A] shadow-[0_0_15px_rgba(201,167,106,0.18)]'
                              : 'border-white/[0.14] bg-white/[0.025] group-hover:border-[#C9A76A]/50 group-hover:bg-[#C9A76A]/[0.04]'
                          }
                        `}
                      >

                        {acceptedTerms && (
                          <svg
                            viewBox="0 0 24 24"
                            className="w-3.5 h-3.5 text-[#14120E]"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M5 12l4 4L19 7" />
                          </svg>
                        )}

                      </span>

                      <span className="text-[10px] leading-5 text-white/35">
                        I agree to the{' '}
                        <a
                          href="/terms"
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="font-semibold text-[#C9A76A] hover:text-[#E2C98F] hover:underline transition-colors"
                        >
                          Terms of Service
                        </a>{' '}
                        and{' '}
                        <a
                          href="/privacy"
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="font-semibold text-[#C9A76A] hover:text-[#E2C98F] hover:underline transition-colors"
                        >
                          Privacy Policy
                        </a>
                        .
                      </span>

                    </label>

                  </div>

                  {/* ================================================= */}
                  {/* CREATE WORKSPACE BUTTON */}
                  {/* ================================================= */}

                  <button
                    type="submit"
                    disabled={loading || !acceptedTerms}
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
                      disabled:opacity-40
                      disabled:cursor-not-allowed
                      disabled:hover:shadow-[0_12px_35px_rgba(201,167,106,0.15)]
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
                            Creating Workspace...
                          </span>
                        </>
                      ) : (
                        <>
                          <span>
                            Create NOVAMENU Workspace
                          </span>

                          <span className="text-base transition-transform duration-300 group-hover:translate-x-1">
                            →
                          </span>
                        </>
                      )}

                    </span>

                  </button>

                </form>


                {/* ================================================= */}
                {/* LOGIN LINK */}
                {/* ================================================= */}

                <div className="mt-7 pt-6 border-t border-white/[0.055]">

                  <div className="text-center">

                    <p className="text-[10px] text-white/25">
                      Already have a NOVAMENU account?
                    </p>

                    <button
                      type="button"
                      onClick={() => router.push('/login')}
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
                      Sign in to your workspace

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

                </div>


                {/* SECURITY FOOTER */}

                <div className="mt-6">

                  <div className="flex items-center justify-center gap-2">

                    <span className="text-[10px] text-[#6EE7B7]/70">
                      ◈
                    </span>

                    <span className="text-[8px] uppercase tracking-[0.18em] font-bold text-white/20">
                      Secure restaurant workspace
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
                    w-6
                    h-6
                    rounded-lg
                    bg-gradient-to-br
                    from-[#C9A76A]
                    to-[#73562F]
                    flex
                    items-center
                    justify-center
                  "
                >

                  <span className="text-[9px] font-black text-[#11100D]">
                    N
                  </span>

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
/* SHARED STYLES */
/* ============================================================= */

const labelClass = `
  block
  pl-1
  text-[9px]
  uppercase
  tracking-[0.18em]
  font-bold
  text-white/35
`;

const inputClass = `
  w-full
  h-14
  px-4
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
`;


/* ============================================================= */
/* FIELD COMPONENT */
/* ============================================================= */

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
}) {
  return (
    <div className="space-y-2">

      <label
        htmlFor={id}
        className={labelClass}
      >
        {label}
      </label>

      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={inputClass}
      />

    </div>
  );
}


/* ============================================================= */
/* SIGNUP SECTION */
/* ============================================================= */

function SignupSection({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3.5">

      <div
        className="
          shrink-0
          w-8
          h-8
          rounded-lg
          border
          border-[#C9A76A]/15
          bg-[#C9A76A]/[0.05]
          flex
          items-center
          justify-center
          text-[9px]
          font-bold
          tracking-wider
          text-[#C9A76A]/80
        "
      >
        {number}
      </div>

      <div>

        <h3 className="text-sm font-bold text-white/80">
          {title}
        </h3>

        <p className="mt-1 text-[10px] leading-5 text-white/25">
          {description}
        </p>

      </div>

    </div>
  );
}


/* ============================================================= */
/* SETUP STEP */
/* ============================================================= */

function SetupStep({
  number,
  title,
  description,
  active = false,
}: {
  number: string;
  title: string;
  description: string;
  active?: boolean;
}) {
  return (
    <div
      className={`
        flex
        items-center
        gap-4
        p-3.5
        rounded-xl
        border
        transition-all
        ${
          active
            ? 'border-[#C9A76A]/15 bg-[#C9A76A]/[0.035]'
            : 'border-white/[0.045] bg-white/[0.015]'
        }
      `}
    >

      <div
        className={`
          w-9
          h-9
          shrink-0
          rounded-lg
          flex
          items-center
          justify-center
          text-[9px]
          font-bold
          ${
            active
              ? 'bg-[#C9A76A]/10 text-[#C9A76A] border border-[#C9A76A]/15'
              : 'bg-white/[0.025] text-white/25 border border-white/[0.05]'
          }
        `}
      >
        {number}
      </div>

      <div className="min-w-0">

        <div
          className={`
            text-xs
            font-semibold
            ${active ? 'text-white/80' : 'text-white/45'}
          `}
        >
          {title}
        </div>

        <div className="text-[9px] text-white/20 mt-0.5">
          {description}
        </div>

      </div>

      {active && (
        <span className="ml-auto text-[#6EE7B7]/70 text-xs">
          ✓
        </span>
      )}

    </div>
  );
}


/* ============================================================= */
/* PREVIEW STAT */
/* ============================================================= */

function PreviewStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-3">

      <div className="text-[7px] uppercase tracking-[0.14em] text-white/20">
        {label}
      </div>

      <div className="mt-1 text-[10px] font-bold text-white/60">
        {value}
      </div>

    </div>
  );
}