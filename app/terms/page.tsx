import Link from "next/link";

export const metadata = {
  title: "Terms of Service | NOVAMENU",
  description: "Terms of Service for NOVAMENU.",
};

export default function TermsOfServicePage() {
  return (
    <main className="min-h-screen bg-[#F5F1E8] text-[#171613]">
      <div className="mx-auto max-w-4xl px-6 py-16 sm:px-8 lg:py-24">
        <div className="mb-12">
          <Link
            href="/"
            className="inline-flex items-center text-sm font-semibold tracking-wide text-[#B08D57] transition-opacity hover:opacity-70"
          >
            NOVAMENU
          </Link>

          <h1 className="mt-8 text-4xl font-black tracking-tight sm:text-5xl">
            Terms of Service
          </h1>

          <p className="mt-4 text-sm text-[#171613]/55">
            Last updated: September 7, 2026
          </p>
        </div>

        <div className="space-y-10 text-[15px] leading-7 text-[#171613]/75">
          <section>
            <h2 className="mb-3 text-xl font-bold text-[#171613]">
              1. About NOVAMENU
            </h2>
            <p>
              NOVAMENU is a restaurant technology platform operated by Novera
              Labs. NOVAMENU provides digital menu, restaurant management,
              ordering, QR code, and related tools that allow restaurants to
              create and manage digital experiences for their customers.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-[#171613]">
              2. Acceptance of These Terms
            </h2>
            <p>
              By creating an account, accessing, or using NOVAMENU, you agree
              to these Terms of Service. If you do not agree with these terms,
              you should not use the service.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-[#171613]">
              3. Accounts
            </h2>
            <p>
              You are responsible for providing accurate information when
              creating your account and for keeping your account credentials
              secure. You are responsible for activity performed through your
              account and should notify us if you believe your account has
              been accessed without authorization.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-[#171613]">
              4. Restaurant Content
            </h2>
            <p>
              Restaurants are responsible for the information and content they
              publish through NOVAMENU, including menus, prices, descriptions,
              images, contact information, and ordering information.
            </p>
            <p className="mt-3">
              You must have the necessary rights and permissions to upload and
              publish content through the service.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-[#171613]">
              5. Subscriptions and Payments
            </h2>
            <p>
              Certain NOVAMENU features require a paid subscription. Available
              plans, prices, billing intervals, and included features are
              displayed on the NOVAMENU pricing or billing page.
            </p>
            <p className="mt-3">
              Payments are processed by our third-party payment provider.
              Subscription charges are billed according to the plan and
              billing interval selected by the customer.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-[#171613]">
              6. Free Trials
            </h2>
            <p>
              NOVAMENU may offer a free trial for eligible customers. Trial
              duration and conditions may be displayed during registration or
              checkout. When a trial ends, continued use of paid features may
              require an active subscription.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-[#171613]">
              7. Acceptable Use
            </h2>
            <p>
              You agree not to misuse NOVAMENU, interfere with its operation,
              attempt to gain unauthorized access, distribute malicious code,
              or use the service for unlawful purposes.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-[#171613]">
              8. Service Availability
            </h2>
            <p>
              We aim to keep NOVAMENU available and reliable, but we do not
              guarantee uninterrupted or error-free operation. The service may
              occasionally be unavailable because of maintenance, updates,
              technical issues, or circumstances beyond our reasonable control.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-[#171613]">
              9. Intellectual Property
            </h2>
            <p>
              NOVAMENU, its software, branding, visual design, and related
              technology are owned by or licensed to Novera Labs and are
              protected by applicable intellectual property laws.
            </p>
            <p className="mt-3">
              Customers retain ownership of content they provide to NOVAMENU,
              subject to the rights necessary for us to operate and provide
              the service.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-[#171613]">
              10. Termination
            </h2>
            <p>
              You may stop using NOVAMENU at any time. We may suspend or
              terminate access when reasonably necessary, including in cases
              of serious violations of these Terms, unlawful activity, abuse
              of the service, or non-payment.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-[#171613]">
              11. Disclaimer
            </h2>
            <p>
              NOVAMENU is provided on an “as available” and “as is” basis to
              the extent permitted by applicable law. We do not guarantee that
              the service will meet every specific business requirement or
              operate without interruption or errors.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-[#171613]">
              12. Limitation of Liability
            </h2>
            <p>
              To the maximum extent permitted by applicable law, Novera Labs
              will not be liable for indirect, incidental, special,
              consequential, or similar damages arising from the use of or
              inability to use NOVAMENU.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-[#171613]">
              13. Changes to These Terms
            </h2>
            <p>
              We may update these Terms of Service from time to time. Updated
              terms will be published on this page with a revised effective
              date. Continued use of NOVAMENU after an update constitutes
              acceptance of the revised terms, subject to applicable law.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-[#171613]">
              14. Contact
            </h2>
            <p>
              If you have questions about these Terms of Service, you can
              contact Novera Labs at{" "}
              <a
                href="mailto:novera.labs1@gmail.com"
                className="font-semibold text-[#B08D57] hover:underline"
              >
                novera.labs1@gmail.com
              </a>
              .
            </p>
          </section>
        </div>

        <div className="mt-16 flex flex-wrap gap-5 border-t border-[#171613]/10 pt-8 text-sm">
          <Link
            href="/privacy"
            className="font-semibold text-[#B08D57] hover:underline"
          >
            Privacy Policy
          </Link>

          <Link
            href="/refund"
            className="font-semibold text-[#B08D57] hover:underline"
          >
            Refund Policy
          </Link>

          <Link
            href="/"
            className="font-semibold text-[#171613]/55 hover:text-[#171613]"
          >
            Back to NOVAMENU
          </Link>
        </div>
      </div>
    </main>
  );
}