export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-sf-surface-0">
      <div className="max-w-[720px] mx-auto px-4 py-16">
        <h1 className="font-heading text-[28px] font-semibold text-sf-text-primary mb-2">Privacy Policy</h1>
        <p className="text-[13px] text-sf-text-tertiary mb-10">Last updated: March 2026</p>

        <div className="space-y-8 text-[14px] text-sf-text-secondary leading-relaxed">

          <section>
            <p>
              QuotArc (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;) is committed to protecting your personal
              information in accordance with the{' '}
              <em>Personal Information Protection and Electronic Documents Act</em> (PIPEDA) and, where applicable,
              Quebec&rsquo;s <em>Act Respecting the Protection of Personal Information in the Private Sector</em> (Law 25).
              This policy explains what we collect, why, and how we protect it — in plain language.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-[16px] font-semibold text-sf-text-primary mb-3">1. Who is responsible for your data</h2>
            <p>
              QuotArc is the organization responsible for personal information under our control. Our designated privacy
              officer can be reached at{' '}
              <a href="mailto:privacy@quotarc.com" className="text-sf-accent hover:underline">privacy@quotarc.com</a>.
              For general inquiries:{' '}
              <a href="mailto:contact@quotarc.com" className="text-sf-accent hover:underline">contact@quotarc.com</a>.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-[16px] font-semibold text-sf-text-primary mb-3">2. What we collect and why</h2>
            <p className="mb-3">We collect only the information needed to operate QuotArc and provide support:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong className="text-sf-text-primary">Account information</strong> — your name, company name, email address,
                and province when you sign up. Used to identify your account and apply correct regional defaults
                (e.g., tax rates).
              </li>
              <li>
                <strong className="text-sf-text-primary">Billing information</strong> — subscription and payment details
                handled by Stripe. We never see or store your full card number — Stripe processes and stores all
                payment data directly.
              </li>
              <li>
                <strong className="text-sf-text-primary">Business data you create</strong> — quotes, invoices, customer records,
                line items, and notes. This data belongs to you and is used solely to provide the service.
              </li>
              <li>
                <strong className="text-sf-text-primary">Your customers&rsquo; information</strong> — when you add a customer
                (name, email, phone, address), you are the data controller for that information. We process it only on
                your behalf. You are responsible for having a lawful basis to share your customers&rsquo; data with us.
              </li>
              <li>
                <strong className="text-sf-text-primary">Voice call data</strong> — if you use the AI receptionist, call
                recordings and transcripts are processed by VAPI. Transcripts are stored in your QuotArc account.
                Recording retention follows VAPI&rsquo;s own policies.
              </li>
              <li>
                <strong className="text-sf-text-primary">Usage data</strong> — aggregate product analytics (features used,
                session activity) to improve QuotArc and provide support. This does not identify your end customers.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-heading text-[16px] font-semibold text-sf-text-primary mb-3">3. How we use your information</h2>
            <p className="mb-3">Your information is used only for the purposes it was collected:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>To create and manage your QuotArc account</li>
              <li>To deliver, maintain, and improve the QuotArc service</li>
              <li>To send transactional emails — quote confirmations, invoice notifications, payment receipts, and account alerts</li>
              <li>To send automated follow-up emails to your customers based on rules you configure</li>
              <li>To process your subscription payments via Stripe</li>
              <li>To generate AI-assisted quotes and call summaries using your business data</li>
              <li>To respond to your support requests</li>
              <li>To comply with applicable legal obligations</li>
            </ul>
            <p className="mt-3 font-medium text-sf-text-primary">We do not sell your personal information. We do not use your data for advertising.</p>
          </section>

          <section>
            <h2 className="font-heading text-[16px] font-semibold text-sf-text-primary mb-3">4. Consent</h2>
            <p>
              By creating a QuotArc account, you consent to the collection, use, and disclosure of your personal
              information as described in this policy. You may withdraw consent at any time by closing your account
              (see &ldquo;Your rights&rdquo; below). Withdrawing consent may limit our ability to provide the service.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-[16px] font-semibold text-sf-text-primary mb-3">5. Third-party service providers and cross-border transfers</h2>
            <p className="mb-3">
              We share personal information with service providers only as needed to operate QuotArc. Each provider is
              contractually required to protect your information and may only use it for the specific purpose disclosed here.
            </p>
            <div className="overflow-x-auto rounded border border-sf-border">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-sf-border bg-sf-surface-1">
                    <th className="text-left px-3 py-2 text-sf-text-primary font-semibold">Provider</th>
                    <th className="text-left px-3 py-2 text-sf-text-primary font-semibold">Purpose</th>
                    <th className="text-left px-3 py-2 text-sf-text-primary font-semibold">Location</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-sf-border/50">
                    <td className="px-3 py-2 text-sf-text-primary">Supabase</td>
                    <td className="px-3 py-2">Database and authentication</td>
                    <td className="px-3 py-2">USA (AWS)</td>
                  </tr>
                  <tr className="border-b border-sf-border/50">
                    <td className="px-3 py-2 text-sf-text-primary">Stripe</td>
                    <td className="px-3 py-2">Subscription billing and payment processing</td>
                    <td className="px-3 py-2">USA</td>
                  </tr>
                  <tr className="border-b border-sf-border/50">
                    <td className="px-3 py-2 text-sf-text-primary">Resend</td>
                    <td className="px-3 py-2">Transactional and automated email delivery</td>
                    <td className="px-3 py-2">USA</td>
                  </tr>
                  <tr className="border-b border-sf-border/50">
                    <td className="px-3 py-2 text-sf-text-primary">OpenRouter / Anthropic</td>
                    <td className="px-3 py-2">AI quote assistance and suggestions</td>
                    <td className="px-3 py-2">USA</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 text-sf-text-primary">VAPI</td>
                    <td className="px-3 py-2">AI voice receptionist and call processing</td>
                    <td className="px-3 py-2">USA</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-3">
              All providers listed above are located in the United States. By using QuotArc, you acknowledge that your
              personal information will be transferred to and processed in the United States, where privacy laws may
              differ from those in your province or territory.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-[16px] font-semibold text-sf-text-primary mb-3">6. Data retention</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>Active account data is retained while your subscription is active.</li>
              <li>After account cancellation, your data is retained for 30 days then permanently deleted.</li>
              <li>Billing records may be retained longer where required by law (e.g., 7 years for tax records).</li>
              <li>Call recordings are subject to VAPI&rsquo;s own retention schedule — contact VAPI directly for details.</li>
              <li>You may request immediate deletion at any time — see &ldquo;Your rights&rdquo; below.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-heading text-[16px] font-semibold text-sf-text-primary mb-3">7. Security</h2>
            <p>
              We use reasonable technical and organizational safeguards to protect your personal information: encrypted
              data transmission (HTTPS/TLS), access controls limited to authorized personnel, and established cloud
              providers with SOC 2 compliance (Supabase, Stripe). No internet transmission is 100% secure. If you
              believe your account has been compromised, contact us immediately at{' '}
              <a href="mailto:privacy@quotarc.com" className="text-sf-accent hover:underline">privacy@quotarc.com</a>.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-[16px] font-semibold text-sf-text-primary mb-3">8. Breach notification</h2>
            <p>
              If we become aware of a security breach that poses a real risk of significant harm to you, we will notify
              you and the applicable privacy regulator as required under PIPEDA and, where applicable, Quebec Law 25.
              Notification will describe the nature of the breach, the information involved, and the steps we are taking
              to address it.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-[16px] font-semibold text-sf-text-primary mb-3">9. Your rights</h2>
            <p className="mb-3">You have the following rights regarding your personal information:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong className="text-sf-text-primary">Access</strong> — request a copy of the personal information we hold about you.
              </li>
              <li>
                <strong className="text-sf-text-primary">Correction</strong> — request correction of inaccurate or incomplete information.
              </li>
              <li>
                <strong className="text-sf-text-primary">Deletion</strong> — request deletion of your account and personal data.
                Some data (e.g., billing records required by law) may need to be retained.
              </li>
              <li>
                <strong className="text-sf-text-primary">Portability (Quebec)</strong> — request your personal information in a
                structured, machine-readable format, or ask us to transmit it to another organization where technically
                feasible, as required under Quebec Law 25.
              </li>
              <li>
                <strong className="text-sf-text-primary">De-indexation (Quebec)</strong> — if information you provided has been
                made publicly available, you may request that access be restricted or that it be de-indexed from search
                engines, as provided under Quebec Law 25.
              </li>
              <li>
                <strong className="text-sf-text-primary">Withdraw consent</strong> — you may withdraw consent to certain
                processing. Withdrawal may limit our ability to provide the service.
              </li>
              <li>
                <strong className="text-sf-text-primary">Complaints</strong> — you may file a complaint with the Office of the
                Privacy Commissioner of Canada (OPC) at{' '}
                <span className="text-sf-text-primary">priv.gc.ca</span>, or for Quebec residents, with the Commission
                d&rsquo;accès à l&rsquo;information (CAI) at{' '}
                <span className="text-sf-text-primary">cai.quebec.ca</span>.
              </li>
            </ul>
            <p className="mt-3">
              To exercise any of these rights, email our privacy officer at{' '}
              <a href="mailto:privacy@quotarc.com" className="text-sf-accent hover:underline">privacy@quotarc.com</a>.
              We will respond within 30 days.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-[16px] font-semibold text-sf-text-primary mb-3">10. Automated decision-making</h2>
            <p>
              QuotArc uses AI to generate quote suggestions and call summaries. These are provided as assistance only and
              do not constitute automated decisions with legal or similarly significant effects on you. You remain in full
              control of all quotes, invoices, and communications sent from your account. Quebec residents with questions
              about automated processing may contact our privacy officer.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-[16px] font-semibold text-sf-text-primary mb-3">11. Cookies</h2>
            <p>
              QuotArc uses session cookies required for authentication and to keep you logged in. We do not use
              third-party advertising or tracking cookies. We may use privacy-respecting analytics (aggregate page views
              only) to understand product usage.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-[16px] font-semibold text-sf-text-primary mb-3">12. Changes to this policy</h2>
            <p>
              We may update this policy from time to time. We will notify you of material changes by email or in-app
              notice at least 15 days before they take effect. Continued use of QuotArc after the effective date
              constitutes acceptance of the updated policy.
            </p>
          </section>

        </div>
      </div>
    </div>
  )
}
