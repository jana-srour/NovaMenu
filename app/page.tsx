import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Check,
  ChevronRight,
  Globe2,
  LayoutDashboard,
  Menu,
  QrCode,
  Sparkles,
  UtensilsCrossed,
  Zap,
} from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#08090C] text-white">
      {/* ========================================================= */}
      {/* BACKGROUND ATMOSPHERE */}
      {/* ========================================================= */}

      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-[-280px] h-[700px] w-[700px] -translate-x-1/2 rounded-full bg-[#B08D57]/10 blur-[140px]" />

        <div className="absolute -left-[250px] top-[35%] h-[500px] w-[500px] rounded-full bg-[#536DFE]/8 blur-[140px]" />

        <div className="absolute -right-[250px] top-[55%] h-[500px] w-[500px] rounded-full bg-[#765BD5]/8 blur-[140px]" />

        <div className="absolute inset-0 opacity-[0.025] [background-image:linear-gradient(rgba(255,255,255,0.5)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.5)_1px,transparent_1px)] [background-size:70px_70px]" />
      </div>

      {/* ========================================================= */}
      {/* NAVBAR */}
      {/* ========================================================= */}

      <header className="relative z-20 border-b border-white/[0.07]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
          {/* BRAND */}

          <Link href="/" className="flex items-center gap-3">
            <div
              className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border"
              style={{
                borderColor: "#B08D57",
                boxShadow: "0 0 30px rgba(176,141,87,0.18)",
              }}
            >
              <img
                src="/novamenu-icon.jpeg"
                alt="NOVAMENU"
                className="h-full w-full object-cover"
              />

              <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-[#B08D57] shadow-[0_0_8px_#B08D57]" />
            </div>

            <div className="leading-none">
              <p className="text-[11px] font-black tracking-[0.34em] text-white">
                NOVAMENU
              </p>

              <p className="mt-1 text-[8px] font-medium uppercase tracking-[0.25em] text-white/35">
                Restaurant Technology
              </p>
            </div>
          </Link>

          {/* NAV */}

          <nav className="hidden items-center gap-8 md:flex">
            <a
              href="#platform"
              className="text-sm text-white/55 transition hover:text-white"
            >
              Platform
            </a>

            <a
              href="#features"
              className="text-sm text-white/55 transition hover:text-white"
            >
              Features
            </a>

            <a
              href="#pricing"
              className="text-sm text-white/55 transition hover:text-white"
            >
              Pricing
            </a>
          </nav>

          {/* ACTIONS */}

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/login"
              className="rounded-xl px-3 py-2.5 text-sm font-semibold text-white/65 transition hover:bg-white/[0.05] hover:text-white sm:px-4"
            >
              Sign in
            </Link>

            <Link
              href="/signup"
              className="group flex items-center gap-2 rounded-xl border border-[#B08D57]/50 bg-[#B08D57] px-4 py-2.5 text-sm font-bold text-[#0B0B0A] shadow-[0_0_30px_rgba(176,141,87,0.15)] transition hover:bg-[#C4A66F] hover:shadow-[0_0_35px_rgba(176,141,87,0.25)] sm:px-5"
            >
              Get started
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* ========================================================= */}
      {/* HERO */}
      {/* ========================================================= */}

      <section className="relative z-10">
        <div className="mx-auto max-w-7xl px-5 pb-28 pt-20 sm:px-8 sm:pt-28 lg:pb-36 lg:pt-32">
          <div className="mx-auto max-w-5xl text-center">
            {/* EYEBROW */}

            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-[#B08D57]/25 bg-[#B08D57]/[0.06] px-4 py-2">
              <Sparkles className="h-3.5 w-3.5 text-[#B08D57]" />

              <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#B08D57]">
                The modern restaurant platform
              </span>
            </div>

            {/* HEADLINE */}

            <h1 className="text-5xl font-black tracking-[-0.04em] sm:text-6xl lg:text-8xl">
              Your restaurant.
              <br />

              <span className="bg-gradient-to-r from-[#C9A76A] via-[#B08D57] to-[#8C6D3F] bg-clip-text text-transparent">
                Reimagined.
              </span>
            </h1>

            <p className="mx-auto mt-8 max-w-2xl text-base leading-7 text-white/45 sm:text-lg">
              NOVAMENU brings your digital menu, QR experience, customer
              ordering, and restaurant operations into one beautifully
              connected platform.
            </p>

            {/* HERO ACTIONS */}

            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/signup"
                className="group flex w-full items-center justify-center gap-2 rounded-2xl bg-[#B08D57] px-7 py-4 text-sm font-black text-[#0A0908] shadow-[0_0_45px_rgba(176,141,87,0.18)] transition hover:bg-[#C4A66F] hover:shadow-[0_0_55px_rgba(176,141,87,0.28)] sm:w-auto"
              >
                Start your restaurant
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>

              <Link
                href="/login"
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.035] px-7 py-4 text-sm font-bold text-white/75 transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white sm:w-auto"
              >
                Sign in to NOVAMENU
              </Link>
            </div>

            {/* TRUST */}

            <div className="mt-10 flex items-center justify-center gap-5 text-[9px] font-semibold uppercase tracking-[0.18em] text-white/25 sm:gap-7">
              <span className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-[#B08D57]" />
                No setup complexity
              </span>

              <span className="hidden h-3 w-px bg-white/10 sm:block" />

              <span className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-[#B08D57]" />
                Built for restaurants
              </span>

              <span className="hidden h-3 w-px bg-white/10 sm:block" />

              <span className="hidden items-center gap-2 sm:flex">
                <Check className="h-3.5 w-3.5 text-[#B08D57]" />
                Start in minutes
              </span>
            </div>
          </div>

          {/* ===================================================== */}
          {/* PRODUCT VISUAL */}
          {/* ===================================================== */}

          <div className="relative mx-auto mt-20 max-w-6xl sm:mt-24">
            <div className="absolute left-1/2 top-1/2 h-[350px] w-[70%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#B08D57]/10 blur-[100px]" />

            <div className="relative overflow-hidden rounded-[28px] border border-white/[0.09] bg-[#111216]/90 shadow-[0_40px_120px_rgba(0,0,0,0.55)] backdrop-blur-xl">
              {/* WINDOW BAR */}

              <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
                <div className="flex gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
                  <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
                  <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
                </div>

                <div className="hidden rounded-full border border-white/[0.07] px-4 py-1 text-[8px] tracking-[0.2em] text-white/20 sm:block">
                  NOVAMENU WORKSPACE
                </div>

                <div className="h-2 w-16 rounded-full bg-white/[0.05]" />
              </div>

              {/* DASHBOARD MOCKUP */}

              <div className="grid min-h-[390px] grid-cols-1 md:grid-cols-[190px_1fr]">
                {/* SIDEBAR */}

                <div className="hidden border-r border-white/[0.07] p-5 md:block">
                  <div className="mb-8 flex items-center gap-2">
                    <div className="h-7 w-7 rounded-lg bg-[#B08D57]/15" />

                    <div className="h-2 w-20 rounded-full bg-white/10" />
                  </div>

                  <div className="space-y-2">
                    {[1, 2, 3, 4, 5].map((item) => (
                      <div
                        key={item}
                        className={`h-9 rounded-lg ${
                          item === 1 ? "bg-white/[0.07]" : "bg-transparent"
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* CONTENT */}

                <div className="p-5 sm:p-8">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="h-3 w-28 rounded-full bg-white/10" />
                      <div className="mt-2 h-2 w-40 rounded-full bg-white/[0.05]" />
                    </div>

                    <div className="h-9 w-9 rounded-xl bg-[#B08D57]/10" />
                  </div>

                  <div className="mt-7 grid gap-3 sm:grid-cols-3">
                    {[
                      ["Orders", "128"],
                      ["Menu Items", "46"],
                      ["Revenue", "$4,820"],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4"
                      >
                        <p className="text-[9px] uppercase tracking-[0.15em] text-white/25">
                          {label}
                        </p>

                        <p className="mt-3 text-2xl font-black text-white/85">
                          {value}
                        </p>

                        <div className="mt-3 h-1 w-16 rounded-full bg-[#B08D57]/30" />
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-[1.4fr_0.8fr]">
                    <div className="min-h-[180px] rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
                      <div className="flex items-center justify-between">
                        <div className="h-2 w-24 rounded-full bg-white/10" />
                        <div className="h-2 w-10 rounded-full bg-white/5" />
                      </div>

                      <div className="mt-8 flex h-24 items-end gap-2">
                        {[35, 55, 45, 75, 60, 90, 72, 100, 82, 110].map(
                          (height, index) => (
                            <div
                              key={index}
                              className="flex-1 rounded-t-md bg-[#B08D57]/25"
                              style={{ height: `${height}px` }}
                            />
                          )
                        )}
                      </div>
                    </div>

                    <div className="min-h-[180px] rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
                      <div className="h-2 w-20 rounded-full bg-white/10" />

                      <div className="mt-6 space-y-4">
                        {[1, 2, 3, 4].map((item) => (
                          <div
                            key={item}
                            className="flex items-center gap-3"
                          >
                            <div className="h-7 w-7 rounded-lg bg-white/[0.05]" />

                            <div className="flex-1">
                              <div className="h-1.5 w-20 rounded-full bg-white/10" />
                              <div className="mt-1.5 h-1 w-12 rounded-full bg-white/5" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* PLATFORM */}
      {/* ========================================================= */}

      <section
        id="platform"
        className="relative z-10 border-y border-white/[0.06] bg-white/[0.015]"
      >
        <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:py-28">
          <div className="grid gap-14 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#B08D57]">
                One platform
              </p>

              <h2 className="mt-5 text-4xl font-black tracking-tight sm:text-5xl">
                Everything your
                <br />
                restaurant needs.
              </h2>
            </div>

            <p className="max-w-xl text-sm leading-7 text-white/40 lg:justify-self-end">
              From the moment a guest scans your QR code to the moment an
              order reaches your team, NOVAMENU connects the experience into
              one elegant system.
            </p>
          </div>

          <div
            id="features"
            className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            {[
              {
                icon: Menu,
                title: "Digital Menu",
                text: "Build beautiful menus that are always up to date.",
              },
              {
                icon: QrCode,
                title: "QR Studio",
                text: "Turn every table into a direct gateway to your menu.",
              },
              {
                icon: BarChart3,
                title: "Operations",
                text: "Understand your restaurant with clear operational data.",
              },
              {
                icon: Zap,
                title: "Ordering",
                text: "Make customer ordering fast, simple, and connected.",
              },
            ].map((feature) => {
              const Icon = feature.icon;

              return (
                <div
                  key={feature.title}
                  className="group rounded-3xl border border-white/[0.07] bg-white/[0.025] p-6 transition duration-300 hover:-translate-y-1 hover:border-[#B08D57]/25 hover:bg-white/[0.04]"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#B08D57]/20 bg-[#B08D57]/[0.07]">
                    <Icon className="h-5 w-5 text-[#B08D57]" />
                  </div>

                  <h3 className="mt-6 text-base font-bold">{feature.title}</h3>

                  <p className="mt-2 text-sm leading-6 text-white/35">
                    {feature.text}
                  </p>

                  <div className="mt-6 flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.15em] text-white/20 transition group-hover:text-[#B08D57]">
                    Explore
                    <ChevronRight className="h-3 w-3" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* EXPERIENCE */}
      {/* ========================================================= */}

      <section className="relative z-10">
        <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:py-32">
          <div className="grid gap-5 lg:grid-cols-3">
            {[
              {
                icon: UtensilsCrossed,
                title: "Built around your restaurant",
                text: "Your menu, your branding, your pricing, your customer experience.",
              },
              {
                icon: LayoutDashboard,
                title: "Designed for daily operations",
                text: "A focused workspace that keeps the important things easy to reach.",
              },
              {
                icon: Globe2,
                title: "Made for the modern web",
                text: "Fast, responsive digital experiences your guests can access anywhere.",
              },
            ].map((item) => {
              const Icon = item.icon;

              return (
                <div
                  key={item.title}
                  className="rounded-3xl border border-white/[0.07] bg-[#0D0E12] p-7"
                >
                  <Icon className="h-6 w-6 text-[#B08D57]" />

                  <h3 className="mt-7 text-lg font-bold">{item.title}</h3>

                  <p className="mt-3 text-sm leading-7 text-white/35">
                    {item.text}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* CTA */}
      {/* ========================================================= */}

      <section id="pricing" className="relative z-10">
        <div className="mx-auto max-w-5xl px-5 pb-28 sm:px-8 lg:pb-36">
          <div className="relative overflow-hidden rounded-[32px] border border-[#B08D57]/20 bg-[#11100D] px-6 py-16 text-center shadow-[0_30px_100px_rgba(0,0,0,0.45)] sm:px-12">
            <div className="absolute left-1/2 top-0 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#B08D57]/15 blur-[90px]" />

            <div className="relative">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#B08D57]">
                Ready when you are
              </p>

              <h2 className="mx-auto mt-5 max-w-2xl text-4xl font-black tracking-tight sm:text-5xl">
                Give your restaurant
                <br />
                a better digital home.
              </h2>

              <p className="mx-auto mt-6 max-w-xl text-sm leading-7 text-white/40">
                Create your NOVAMENU workspace and start building a restaurant
                experience your guests will remember.
              </p>

              <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link
                  href="/signup"
                  className="group flex items-center gap-2 rounded-2xl bg-[#B08D57] px-7 py-4 text-sm font-black text-[#0A0908] transition hover:bg-[#C4A66F]"
                >
                  Create your restaurant
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>

                <Link
                  href="/login"
                  className="rounded-2xl border border-white/10 px-7 py-4 text-sm font-bold text-white/65 transition hover:border-white/20 hover:text-white"
                >
                  Already have an account?
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* FOOTER */}
      {/* ========================================================= */}

      <footer className="relative z-10 border-t border-white/[0.07]">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-8 sm:px-8 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full">
              <img
                src="/novamenu-icon.jpeg"
                alt="NOVAMENU"
                className="h-full w-full object-cover"
              />
            </div>

            <div>
              <p className="text-[9px] font-black tracking-[0.3em] text-white/65">
                NOVAMENU
              </p>

              <p className="mt-1 text-[8px] text-white/25">
                By Novera Labs
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-5 text-[11px] text-white/30">
            <Link href="/terms" className="transition hover:text-white/70">
              Terms
            </Link>

            <Link href="/privacy" className="transition hover:text-white/70">
              Privacy
            </Link>

            <Link href="/refund" className="transition hover:text-white/70">
              Refunds
            </Link>

            <Link href="/login" className="transition hover:text-white/70">
              Sign in
            </Link>
          </div>

          <p className="text-[10px] text-white/20">
            © {new Date().getFullYear()} Novera Labs
          </p>
        </div>
      </footer>
    </main>
  );
}