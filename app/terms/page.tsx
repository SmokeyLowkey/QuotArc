export default function TermsPage() {
  return (
    <div className="min-h-screen bg-sf-surface-0">
      <div className="max-w-[720px] mx-auto px-4 py-16">
        <h1 className="font-heading text-[28px] font-semibold text-sf-text-primary mb-2">Terms of Service</h1>
        <p className="text-[13px] text-sf-text-tertiary mb-10">Last updated: March 2026</p>

        <div className="space-y-8 text-[14px] text-sf-text-secondary leading-relaxed">

          <section>
            <p>
              These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of QuotArc (&ldquo;Service&rdquo;), operated
              by QuotArc (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;). By creating an account, you agree to these Terms.
              If you do not agree, do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-[16px] font-semibold text-sf-text-primary mb-3">1. Service description</h2>
            <p>
              QuotArc is a quoting, invoicing, and AI receptionist platform for service contractors. You may use the
              Service only for lawful business purposes. You are responsible for all content you create and all activity
              that occurs under your account. You agree not to share account credentials with unauthorized individuals.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-[16px] font-semibold text-sf-text-primary mb-3">2. Acceptable use</h2>
            <p className="mb-3">You agree not to use QuotArc to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Violate any applicable law or regulation</li>
              <li>Transmit spam, unsolicited messages, or misleading communications to your customers</li>
              <li>Process payments for illegal goods or services</li>
              <li>Impersonate another person or organization</li>
              <li>Interfere with or disrupt the Service or its infrastructure</li>
              <li>Attempt to reverse-engineer, copy, or resell any part of the Service</li>
              <li>Use the Service in a way that violates Stripe&rsquo;s or our other providers&rsquo; acceptable use policies</li>
            </ul>
            <p className="mt-3">
              We reserve the right to suspend or terminate accounts that violate these terms, without prior notice
              where the violation is serious.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-[16px] font-semibold text-sf-text-primary mb-3">3. Subscriptions and payment</h2>
            <p className="mb-3">
              Paid plans are billed monthly in CAD. Your subscription renews automatically on the same day each month
              unless cancelled before the renewal date. All subscription payments are processed by Stripe.
            </p>
            <p className="mb-3">
              You must provide accurate billing information and keep it current. We reserve the right to update pricing
              with at least 30 days&rsquo; notice. Continued use after a price change takes effect constitutes acceptance
              of the new pricing.
            </p>
            <p>
              Free trial accounts are limited to 10 sent quotes. No credit card is required for the free trial.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-[16px] font-semibold text-sf-text-primary mb-3">4. Payment facilitation (Stripe Connect)</h2>
            <p className="mb-3">
              QuotArc offers an optional feature that allows your customers to pay invoices online using Stripe. If you
              enable this feature, you are connecting your own Stripe account to QuotArc as a third-party platform. The
              following terms apply:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong className="text-sf-text-primary">Stripe is the payment processor.</strong> QuotArc does not process,
                hold, or transmit funds on your behalf. Payments from your customers go directly to your connected
                Stripe account. QuotArc never takes custody of funds.
              </li>
              <li>
                <strong className="text-sf-text-primary">Stripe Connected Account Agreement.</strong> By connecting your Stripe
                account to QuotArc, you agree to the{' '}
                <a
                  href="https://stripe.com/connect-account/legal"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sf-accent hover:underline"
                >
                  Stripe Connected Account Agreement
                </a>
                , which includes the Stripe Services Agreement. This agreement is between you and Stripe, not QuotArc.
              </li>
              <li>
                <strong className="text-sf-text-primary">Disputes and chargebacks.</strong> You are solely responsible for
                resolving disputes and chargebacks initiated by your customers. QuotArc has no control over Stripe&rsquo;s
                dispute process and is not a party to any transaction between you and your customers.
              </li>
              <li>
                <strong className="text-sf-text-primary">KYC and compliance.</strong> Stripe performs identity verification
                (Know Your Customer / KYC) on connected accounts as required by financial regulations. You must provide
                accurate information to Stripe and comply with all applicable requirements. QuotArc does not have access
                to your Stripe KYC documents.
              </li>
              <li>
                <strong className="text-sf-text-primary">Platform fee.</strong> QuotArc may collect a platform service fee on
                transactions processed through the payment feature. Any applicable fee will be disclosed before you
                enable the feature.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-heading text-[16px] font-semibold text-sf-text-primary mb-3">5. Cancellation</h2>
            <p>
              You may cancel your subscription at any time from the Settings page. Your account remains active until the
              end of your current billing period. We do not offer refunds for partial months or unused time. After
              cancellation, your data is retained for 30 days, after which it may be permanently deleted.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-[16px] font-semibold text-sf-text-primary mb-3">6. Account termination by QuotArc</h2>
            <p>
              We may suspend or terminate your account at any time for violation of these Terms, non-payment, or if we
              determine continued operation poses a risk to other users or the integrity of the Service. Where possible,
              we will provide advance notice. Upon termination, your right to access the Service ceases immediately.
              Provisions that by their nature survive termination (including liability limitations and governing law)
              remain in effect.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-[16px] font-semibold text-sf-text-primary mb-3">7. AI features</h2>
            <p>
              AI-generated quotes, suggestions, and call summaries are provided as assistance tools only. You are
              responsible for reviewing all AI-generated content before sending it to customers. QuotArc does not
              guarantee the accuracy, completeness, or suitability of AI outputs. Use of AI features is subject to
              our providers&rsquo; terms (OpenRouter, Anthropic, VAPI) and applicable laws regarding automated communications.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-[16px] font-semibold text-sf-text-primary mb-3">8. Your data and content</h2>
            <p className="mb-3">
              You retain ownership of all data and content you create in QuotArc (quotes, invoices, customer records,
              etc.). By using the Service, you grant QuotArc a limited license to store, display, and process your
              content solely to provide and improve the Service.
            </p>
            <p>
              You are responsible for ensuring you have the right to share any personal information you input into
              QuotArc (including your customers&rsquo; contact details). You agree to handle your customers&rsquo; data in
              compliance with applicable privacy laws.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-[16px] font-semibold text-sf-text-primary mb-3">9. Intellectual property</h2>
            <p>
              All rights in the QuotArc platform, including its software, design, branding, and documentation, belong
              to QuotArc. These Terms do not grant you any rights to use our trademarks, trade names, or other
              intellectual property except as expressly permitted for normal use of the Service.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-[16px] font-semibold text-sf-text-primary mb-3">10. Disclaimer of warranties</h2>
            <p>
              QuotArc is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without warranties of any kind, either express or
              implied, including but not limited to warranties of merchantability, fitness for a particular purpose, or
              non-infringement. We do not warrant that the Service will be uninterrupted, error-free, or free from
              harmful components.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-[16px] font-semibold text-sf-text-primary mb-3">11. Limitation of liability</h2>
            <p className="mb-3">
              To the maximum extent permitted by applicable law, QuotArc shall not be liable for indirect, incidental,
              special, consequential, or punitive damages, including lost revenue, missed leads, lost profits, or data
              loss arising from:
            </p>
            <ul className="list-disc pl-5 space-y-1 mb-3">
              <li>Service interruptions or outages</li>
              <li>Errors or inaccuracies in AI-generated content</li>
              <li>Unauthorized access to your account</li>
              <li>Actions or decisions made by Stripe, VAPI, or other third-party providers</li>
              <li>Payment disputes or chargebacks</li>
            </ul>
            <p>
              Our total aggregate liability for any claim arising from use of QuotArc is limited to the amount you
              paid to us in the three (3) months immediately preceding the event giving rise to the claim.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-[16px] font-semibold text-sf-text-primary mb-3">12. Indemnification</h2>
            <p>
              You agree to indemnify and hold QuotArc, its officers, employees, and agents harmless from any claims,
              losses, or damages (including legal fees) arising from your use of the Service, your violation of these
              Terms, or your infringement of any third party&rsquo;s rights.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-[16px] font-semibold text-sf-text-primary mb-3">13. Governing law and disputes</h2>
            <p>
              These Terms are governed by the laws of Canada and the province of Ontario, without regard to conflict
              of law principles. Any disputes arising under these Terms shall be resolved in the courts of Ontario,
              Canada, and you consent to the personal jurisdiction of those courts. Nothing in this section limits your
              rights under applicable consumer protection legislation.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-[16px] font-semibold text-sf-text-primary mb-3">14. Changes to these Terms</h2>
            <p>
              We may update these Terms from time to time. We will notify you of material changes by email or in-app
              notice at least 15 days before they take effect. Continued use of QuotArc after the effective date
              constitutes acceptance of the updated Terms.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-[16px] font-semibold text-sf-text-primary mb-3">15. Contact</h2>
            <p>
              Questions about these Terms? Email us at{' '}
              <a href="mailto:contact@quotarc.com" className="text-sf-accent hover:underline">contact@quotarc.com</a>.
            </p>
          </section>

        </div>
      </div>
    </div>
  )
}
