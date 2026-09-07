import Link from "next/link";

export const metadata = {
  title: "Privacy Policy | NOVAMENU",
  description: "Privacy Policy for NOVAMENU.",
};

export default function PrivacyPolicyPage() {
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
            Privacy Policy
          </h1>

          <p className="mt-4 text-sm text-[#171613]/55">
            Last updated: September 7, 2026
          </p>
        </div>

        <div className="space-y-10 text-[15px] leading-7 text-[#171613]/75">
          <section>
            <h2 className="mb-3 text-xl font-bold text-[#171613]">
              1. Introduction
            </h2>
            <p>
              This Privacy Policy explains how Novera Labs collects, uses,
              stores, and protects information when you use NOVAMENU and its
              related services.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-[#171613]">
              2. Information We Collect
            </h2>
            <p>
              Depending on how you use NOVAMENU, we may collect information
              such as your name, email address, account information, restaurant
              information, menu content, subscription information, and
              information required to provide and secure the service.
            </p>
            <p className="mt-3">
              We may also collect technical information such as IP address,
              browser type, device information, usage information, and
              diagnostic data when necessary for security, reliability, and
              service improvement.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-[#171613]">
              3. How We Use Information
            </h2>
            <p>We may use collected information to:</p>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>Create and manage NOVAMENU accounts.</li>
              <li>Provide restaurant menu and management functionality.</li>
              <li>Process subscriptions and payments.</li>
              <li>Provide customer support.</li>
              <li>Maintain security and prevent misuse.</li>
              <li>Monitor and improve the reliability of the platform.</li>
              <li>Communicate important service-related information.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-[#171613]">
              4. Restaurant and Customer Data
            </h2>
            <p>
              Restaurants may publish information through NOVAMENU that is
              visible to their customers, including menus, prices, restaurant
              details, images, and ordering information.
            </p>
            <p className="mt-3">
              Restaurants are responsible for ensuring that information they
              provide through NOVAMENU is lawful and that they have the
              necessary rights and permissions to provide it.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-[#171613]">
              5. Payments
            </h2>
            <p>
              Payments and subscription transactions are processed through
              third-party payment providers. NOVAMENU does not intentionally
              store complete payment card information. Payment providers may
              collect and process payment information according to their own
              privacy policies and terms.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-[#171613]">
              6. Service Providers
            </h2>
            <p>
              We may use trusted third-party service providers to operate
              NOVAMENU, including providers for hosting, authentication,
              databases, payments, analytics, communications, and security.
              These providers receive only the information reasonably required
              to perform their services.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-[#171613]">
              7. Data Security
            </h2>
            <p>
              We use reasonable technical and organizational measures designed
              to protect information against unauthorized access, alteration,
              disclosure, or destruction. However, no internet-based service
              can guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-[#171613]">
              8. Data Retention
            </h2>
            <p>
              We retain information for as long as reasonably necessary to
              provide the service, maintain business and transaction records,
              comply with legal obligations, resolve disputes, and enforce our
              agreements.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-[#171613]">
              9. Your Choices and Rights
            </h2>
            <p>
              Depending on applicable law, you may have rights regarding your
              personal information, including rights to access, correct,
              delete, or otherwise control certain information.
            </p>
            <p className="mt-3">
              To request assistance regarding your information, contact us
              using the email address below. We may need to verify your request
              before taking action.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-[#171613]">
              10. Cookies and Similar Technologies
            </h2>
            <p>
              NOVAMENU may use cookies or similar technologies when necessary
              for authentication, security, functionality, analytics, or
              improving the service. Browser settings may allow you to control
              certain cookies, although disabling them may affect some
              functionality.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-[#171613]">
              11. Children&apos;s Privacy
            </h2>
            <p>
              NOVAMENU is intended for businesses and their authorized users.
              We do not knowingly collect personal information from children
              in violation of applicable law.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-[#171613]">
              12. Changes to This Policy
            </h2>
            <p>
              We may update this Privacy Policy from time to time. Changes
              will be published on this page with an updated date. Your
              continued use of NOVAMENU after changes take effect is subject
              to the updated policy, where permitted by law.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-[#171613]">
              13. Contact Us
            </h2>
            <p>
              If you have questions or requests regarding this Privacy Policy,
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
            href="/terms"
            className="font-semibold text-[#B08D57] hover:underline"
          >
            Terms of Service
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