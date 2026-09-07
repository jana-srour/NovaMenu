import Link from "next/link";

export const metadata = {
  title: "Refund Policy | NOVAMENU",
  description: "Refund Policy for NOVAMENU.",
};

export default function RefundPolicyPage() {
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
            Refund Policy
          </h1>

          <p className="mt-4 text-sm text-[#171613]/55">
            Last updated: September 7, 2026
          </p>
        </div>

        <div className="space-y-10 text-[15px] leading-7 text-[#171613]/75">
          <section>
            <h2 className="mb-3 text-xl font-bold text-[#171613]">
              1. Overview
            </h2>
            <p>
              This Refund Policy explains how refunds are handled for paid
              NOVAMENU subscriptions and services provided by Novera Labs.
              By purchasing a NOVAMENU subscription, you acknowledge and agree
              to this policy.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-[#171613]">
              2. Free Trial
            </h2>
            <p>
              NOVAMENU may provide eligible customers with a free trial before
              a paid subscription begins. No refund is applicable to a free
              trial because no subscription charge is made during the trial
              period.
            </p>
            <p className="mt-3">
              If a paid subscription begins after the trial period, the
              applicable subscription and refund terms below will apply.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-[#171613]">
              3. Subscription Charges
            </h2>
            <p>
              NOVAMENU subscriptions are billed according to the plan and
              billing interval selected during checkout. Subscription prices
              are displayed before payment is completed.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-[#171613]">
              4. Refund Eligibility
            </h2>
            <p>
              Customers may request a refund for a recent subscription payment
              when there is a legitimate reason for the request. Refund
              requests are reviewed individually and may be approved at the
              discretion of Novera Labs, subject to applicable consumer
              protection laws.
            </p>
            <p className="mt-3">
              Where applicable law provides a mandatory right to a refund,
              cancellation, or withdrawal, those legal rights remain
              unaffected by this policy.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-[#171613]">
              5. Cancellation
            </h2>
            <p>
              Customers may cancel their subscription through the available
              NOVAMENU billing or customer portal tools. Cancellation normally
              prevents future subscription renewals but does not automatically
              refund charges that have already been processed.
            </p>
            <p className="mt-3">
              If you cancel after a payment has already been processed, you may
              contact us to request a refund for consideration.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-[#171613]">
              6. Duplicate or Incorrect Charges
            </h2>
            <p>
              If you believe you were charged more than once for the same
              subscription period or were charged incorrectly, please contact
              us as soon as possible. We will review the transaction and, when
              appropriate, correct the charge or issue a refund.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-[#171613]">
              7. Failed Payments
            </h2>
            <p>
              If a payment fails, your subscription may be placed into a
              restricted or past-due state. Failed payments do not
              automatically qualify for a refund because no successful charge
              may have occurred.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-[#171613]">
              8. Refund Processing
            </h2>
            <p>
              Approved refunds are generally returned through the original
              payment method used for the transaction. The time required for
              the refund to appear may depend on the payment provider and the
              customer's financial institution.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-[#171613]">
              9. How to Request a Refund
            </h2>
            <p>
              To request a refund, contact Novera Labs using the email address
              below. Please include the account email address and relevant
              subscription or transaction information so that we can identify
              the payment.
            </p>

            <p className="mt-4">
              Email:{" "}
              <a
                href="mailto:novera.labs1@gmail.com"
                className="font-semibold text-[#B08D57] hover:underline"
              >
                novera.labs1@gmail.com
              </a>
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-[#171613]">
              10. Abuse and Exceptional Circumstances
            </h2>
            <p>
              Refund requests may be declined where there is evidence of
              fraudulent activity, abuse of promotional offers, repeated
              improper refund requests, or other misuse of the service.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-[#171613]">
              11. Changes to This Policy
            </h2>
            <p>
              We may update this Refund Policy from time to time. Any changes
              will be published on this page with a revised effective date.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-[#171613]">
              12. Contact Us
            </h2>
            <p>
              For refund questions or billing assistance, contact Novera Labs
              at{" "}
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
            href="/privacy"
            className="font-semibold text-[#B08D57] hover:underline"
          >
            Privacy Policy
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