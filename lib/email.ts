import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

// Verified sending domain — set EMAIL_FROM in .env.local
const BASE_FROM = process.env.EMAIL_FROM || 'notifications@quotarc.com'

/**
 * Build a "from" string that shows the company name.
 * e.g. "Spark Electric via QuotArc <notifications@quotarc.com>"
 */
function buildFrom(companyName?: string | null) {
  const displayName = companyName
    ? `${companyName} via QuotArc`
    : 'QuotArc'
  return `${displayName} <${BASE_FROM}>`
}

// ─── Verification ────────────────────────────────────────────────

export async function sendVerificationEmail({
  to,
  companyName,
  verifyUrl,
}: {
  to: string
  companyName: string
  verifyUrl: string
}) {
  return resend.emails.send({
    from: buildFrom(),
    to,
    subject: 'Verify your QuotArc email',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 0;">
        <h2 style="font-size: 20px; font-weight: 600; color: #1a1a1a; margin-bottom: 8px;">
          Welcome to QuotArc
        </h2>
        <p style="font-size: 14px; color: #666; line-height: 1.5; margin-bottom: 24px;">
          Hi ${companyName}, thanks for signing up. Please verify your email address to get started.
        </p>
        <a href="${verifyUrl}" style="display: inline-block; background-color: #f97316; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-size: 14px; font-weight: 500;">
          Verify Email Address
        </a>
        <p style="font-size: 12px; color: #999; margin-top: 24px; line-height: 1.5;">
          This link expires in 24 hours. If you didn't create a QuotArc account, you can safely ignore this email.
        </p>
        <p style="font-size: 12px; color: #999; margin-top: 16px;">
          Or copy this URL: ${verifyUrl}
        </p>
      </div>
    `,
  })
}

// ─── Password Reset ───────────────────────────────────────────────

export async function sendPasswordResetEmail({
  to,
  resetUrl,
}: {
  to: string
  resetUrl: string
}) {
  return resend.emails.send({
    from: buildFrom(),
    to,
    subject: 'Reset your QuotArc password',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 0;">
        <h2 style="font-size: 20px; font-weight: 600; color: #1a1a1a; margin-bottom: 8px;">
          Reset your password
        </h2>
        <p style="font-size: 14px; color: #666; line-height: 1.5; margin-bottom: 24px;">
          We received a request to reset the password for your QuotArc account. Click the button below to choose a new password.
        </p>
        <a href="${resetUrl}" style="display: inline-block; background-color: #f97316; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-size: 14px; font-weight: 500;">
          Reset Password
        </a>
        <p style="font-size: 12px; color: #999; margin-top: 24px; line-height: 1.5;">
          This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email — your password won't change.
        </p>
        <p style="font-size: 12px; color: #999; margin-top: 16px;">
          Or copy this URL: ${resetUrl}
        </p>
      </div>
    `,
  })
}

// ─── Quote Sent (to customer) ────────────────────────────────────

export async function sendQuoteEmail({
  to,
  customerName,
  companyName,
  companyPhone,
  quoteNumber,
  jobType,
  total,
  customerNote,
  quoteUrl,
  chatUrl,
  pdfBuffer,
}: {
  to: string
  customerName: string
  companyName: string
  companyPhone?: string | null
  quoteNumber: string
  jobType: string
  total: number
  customerNote?: string | null
  quoteUrl: string
  chatUrl: string
  pdfBuffer?: Buffer | null
}) {
  const formattedTotal = new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
  }).format(total)

  return resend.emails.send({
    from: buildFrom(companyName),
    to,
    subject: `Quote ${quoteNumber} from ${companyName}`,
    ...(pdfBuffer ? {
      attachments: [{
        filename: `${quoteNumber}.pdf`,
        content: pdfBuffer,
      }],
    } : {}),
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 0;">
        <div style="margin-bottom: 24px;">
          <h2 style="font-size: 20px; font-weight: 600; color: #1a1a1a; margin: 0 0 4px;">
            ${companyName}
          </h2>
          ${companyPhone ? `<p style="font-size: 13px; color: #888; margin: 0;">${companyPhone}</p>` : ''}
        </div>

        <p style="font-size: 15px; color: #333; line-height: 1.5; margin-bottom: 20px;">
          Hi ${customerName}, here's your quote for <strong>${jobType}</strong>.
        </p>

        <!-- Quote Card -->
        <div style="border: 1px solid #e5e5e5; border-radius: 8px; padding: 20px; margin-bottom: 20px; background-color: #fafafa;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <span style="font-family: monospace; font-size: 14px; font-weight: 600; color: #333;">${quoteNumber}</span>
            <span style="font-size: 12px; color: #888;">${jobType}</span>
          </div>
          <div style="font-size: 28px; font-weight: 700; color: #f97316; font-family: monospace;">
            ${formattedTotal}
          </div>
        </div>

        ${customerNote ? `
        <div style="border-left: 3px solid #f97316; padding: 12px 16px; margin-bottom: 20px; background-color: #fff8f3;">
          <p style="font-size: 13px; color: #555; line-height: 1.5; margin: 0;">
            "${customerNote}"
          </p>
        </div>
        ` : ''}

        <!-- CTA Buttons -->
        <div style="margin-bottom: 24px;">
          <a href="${quoteUrl}" style="display: inline-block; background-color: #f97316; color: white; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-size: 14px; font-weight: 600; margin-right: 8px;">
            View Quote
          </a>
          <a href="${chatUrl}" style="display: inline-block; background-color: #fff; color: #f97316; text-decoration: none; padding: 11px 28px; border-radius: 6px; font-size: 14px; font-weight: 600; border: 1px solid #f97316;">
            Reply to ${companyName}
          </a>
        </div>

        <p style="font-size: 12px; color: #999; line-height: 1.5;">
          You can view the full quote details and reply directly using the links above. If you have any questions, just hit reply.
        </p>

        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0 16px;" />
        <p style="font-size: 11px; color: #bbb; margin: 0;">
          Sent via QuotArc on behalf of ${companyName}
        </p>
      </div>
    `,
  })
}

// ─── New Message Notification (to customer) ──────────────────────

export async function sendNewMessageNotification({
  to,
  customerName,
  companyName,
  companyPhone,
  previewText,
  chatUrl,
}: {
  to: string
  customerName: string
  companyName: string
  companyPhone?: string | null
  previewText: string
  chatUrl: string
}) {
  return resend.emails.send({
    from: buildFrom(companyName),
    to,
    subject: `New message from ${companyName}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 0;">
        <h2 style="font-size: 18px; font-weight: 600; color: #1a1a1a; margin-bottom: 4px;">
          ${companyName}
        </h2>
        ${companyPhone ? `<p style="font-size: 12px; color: #888; margin: 0 0 16px;">${companyPhone}</p>` : '<div style="margin-bottom: 16px;"></div>'}

        <p style="font-size: 14px; color: #333; line-height: 1.5; margin-bottom: 8px;">
          Hi ${customerName}, you have a new message:
        </p>

        <div style="border-left: 3px solid #f97316; padding: 12px 16px; margin-bottom: 20px; background-color: #fafafa; border-radius: 0 6px 6px 0;">
          <p style="font-size: 14px; color: #444; line-height: 1.5; margin: 0;">
            "${previewText}"
          </p>
        </div>

        <a href="${chatUrl}" style="display: inline-block; background-color: #f97316; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-size: 14px; font-weight: 500;">
          View &amp; Reply
        </a>

        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0 16px;" />
        <p style="font-size: 11px; color: #bbb; margin: 0;">
          Sent via QuotArc on behalf of ${companyName}
        </p>
      </div>
    `,
  })
}

// ─── Customer Reply Notification (to electrician) ─────────────────

export async function sendCustomerReplyNotification({
  to,
  customerName,
  quoteNumber,
  previewText,
  dashboardUrl,
}: {
  to: string
  customerName: string
  quoteNumber: string
  previewText: string
  dashboardUrl: string
}) {
  return resend.emails.send({
    from: buildFrom(),
    to,
    subject: `${customerName} replied to quote ${quoteNumber}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 0;">
        <h2 style="font-size: 18px; font-weight: 600; color: #1a1a1a; margin-bottom: 16px;">
          New reply from ${customerName}
        </h2>

        <p style="font-size: 13px; color: #888; margin-bottom: 8px;">
          Quote ${quoteNumber}
        </p>

        <div style="border-left: 3px solid #3b82f6; padding: 12px 16px; margin-bottom: 20px; background-color: #f8faff; border-radius: 0 6px 6px 0;">
          <p style="font-size: 14px; color: #444; line-height: 1.5; margin: 0;">
            "${previewText}"
          </p>
        </div>

        <a href="${dashboardUrl}" style="display: inline-block; background-color: #f97316; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-size: 14px; font-weight: 500;">
          View Conversation
        </a>

        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0 16px;" />
        <p style="font-size: 11px; color: #bbb; margin: 0;">
          QuotArc
        </p>
      </div>
    `,
  })
}

// ─── Quote Accepted Notification (to electrician) ────────────

export async function sendQuoteAcceptedNotification({
  to,
  customerName,
  quoteNumber,
  jobType,
  total,
  dashboardUrl,
}: {
  to: string
  customerName: string
  quoteNumber: string
  jobType: string
  total: number
  dashboardUrl: string
}) {
  const formattedTotal = new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
  }).format(total)

  return resend.emails.send({
    from: buildFrom(),
    to,
    subject: `${customerName} accepted quote ${quoteNumber}!`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 0;">
        <h2 style="font-size: 18px; font-weight: 600; color: #1a1a1a; margin-bottom: 16px;">
          Quote Accepted
        </h2>

        <div style="border: 1px solid #e5e5e5; border-radius: 8px; padding: 20px; margin-bottom: 20px; background-color: #f0fdf4;">
          <p style="font-size: 15px; color: #333; margin: 0 0 8px;">
            <strong>${customerName}</strong> accepted your quote.
          </p>
          <div style="font-size: 13px; color: #555;">
            <div>${quoteNumber} &mdash; ${jobType}</div>
            <div style="font-size: 20px; font-weight: 700; color: #16a34a; font-family: monospace; margin-top: 8px;">
              ${formattedTotal}
            </div>
          </div>
        </div>

        <a href="${dashboardUrl}" style="display: inline-block; background-color: #f97316; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-size: 14px; font-weight: 500;">
          View Quote
        </a>

        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0 16px;" />
        <p style="font-size: 11px; color: #bbb; margin: 0;">
          QuotArc
        </p>
      </div>
    `,
  })
}

// ─── Invoice Sent (to customer) ──────────────────────────────

export async function sendInvoiceEmail({
  to,
  customerName,
  companyName,
  companyPhone,
  invoiceNumber,
  total,
  dueDate,
  lineItemsSummary,
  pdfBuffer,
  paymentLink,
}: {
  to: string
  customerName: string
  companyName: string
  companyPhone?: string | null
  invoiceNumber: string
  total: number
  dueDate?: string | null
  lineItemsSummary: string
  pdfBuffer?: Buffer | null
  paymentLink?: string | null
}) {
  const formattedTotal = new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
  }).format(total)

  const dueDateStr = dueDate
    ? new Date(dueDate).toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' })
    : null

  return resend.emails.send({
    from: buildFrom(companyName),
    to,
    subject: `Invoice ${invoiceNumber} from ${companyName}`,
    ...(pdfBuffer ? {
      attachments: [{
        filename: `${invoiceNumber}.pdf`,
        content: pdfBuffer,
      }],
    } : {}),
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 0;">
        <div style="margin-bottom: 24px;">
          <h2 style="font-size: 20px; font-weight: 600; color: #1a1a1a; margin: 0 0 4px;">
            ${companyName}
          </h2>
          ${companyPhone ? `<p style="font-size: 13px; color: #888; margin: 0;">${companyPhone}</p>` : ''}
        </div>

        <p style="font-size: 15px; color: #333; line-height: 1.5; margin-bottom: 20px;">
          Hi ${customerName}, here's your invoice.
        </p>

        <!-- Invoice Card -->
        <div style="border: 1px solid #e5e5e5; border-radius: 8px; padding: 20px; margin-bottom: 20px; background-color: #fafafa;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <span style="font-family: monospace; font-size: 14px; font-weight: 600; color: #333;">${invoiceNumber}</span>
            ${dueDateStr ? `<span style="font-size: 12px; color: #888;">Due ${dueDateStr}</span>` : ''}
          </div>
          <div style="font-size: 28px; font-weight: 700; color: #f97316; font-family: monospace; margin-bottom: 16px;">
            ${formattedTotal}
          </div>
          <div style="border-top: 1px solid #e5e5e5; padding-top: 12px; font-size: 13px; color: #555; line-height: 1.6;">
            ${lineItemsSummary}
          </div>
        </div>

        <p style="font-size: 13px; color: #666; line-height: 1.5; margin-bottom: 20px;">
          Please remit payment at your earliest convenience.${dueDateStr ? ` Payment is due by <strong>${dueDateStr}</strong>.` : ''}
        </p>

        ${paymentLink ? `
        <div style="margin-bottom: 24px;">
          <a href="${paymentLink}" style="display: inline-block; background-color: #f97316; color: white; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-size: 14px; font-weight: 600;">
            Pay Invoice Online
          </a>
        </div>
        ` : ''}

        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0 16px;" />
        <p style="font-size: 11px; color: #bbb; margin: 0;">
          Sent via QuotArc on behalf of ${companyName}
        </p>
      </div>
    `,
  })
}

// ─── Invoice Reminder (to customer) ──────────────────────────

export async function sendInvoiceReminderEmail({
  to,
  customerName,
  companyName,
  companyPhone,
  invoiceNumber,
  total,
  dueDate,
  paymentLink,
  reminderNumber,
}: {
  to: string
  customerName: string
  companyName: string
  companyPhone?: string | null
  invoiceNumber: string
  total: number
  dueDate?: string | null
  paymentLink?: string | null
  reminderNumber: number
}) {
  const formattedTotal = new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
  }).format(total)

  const dueDateStr = dueDate
    ? new Date(dueDate).toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' })
    : null

  const isOverdue = dueDate ? new Date(dueDate) < new Date() : false

  const subject = isOverdue
    ? `Payment overdue — Invoice ${invoiceNumber} from ${companyName}`
    : `Reminder: Invoice ${invoiceNumber} from ${companyName}`

  const urgency = isOverdue
    ? `This invoice was due on <strong>${dueDateStr}</strong> and is now overdue. Please arrange payment as soon as possible.`
    : reminderNumber === 1
      ? `Just a friendly reminder that invoice ${invoiceNumber} for <strong>${formattedTotal}</strong> is due${dueDateStr ? ` by <strong>${dueDateStr}</strong>` : ' soon'}.`
      : `This is a follow-up reminder for invoice ${invoiceNumber} for <strong>${formattedTotal}</strong>.${dueDateStr ? ` Payment was due by <strong>${dueDateStr}</strong>.` : ''}`

  return resend.emails.send({
    from: buildFrom(companyName),
    to,
    subject,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 0;">
        <div style="margin-bottom: 24px;">
          <h2 style="font-size: 20px; font-weight: 600; color: #1a1a1a; margin: 0 0 4px;">
            ${companyName}
          </h2>
          ${companyPhone ? `<p style="font-size: 13px; color: #888; margin: 0;">${companyPhone}</p>` : ''}
        </div>

        <p style="font-size: 15px; color: #333; line-height: 1.5; margin-bottom: 20px;">
          Hi ${customerName},
        </p>

        <p style="font-size: 14px; color: #333; line-height: 1.5; margin-bottom: 20px;">
          ${urgency}
        </p>

        <div style="border: 1px solid ${isOverdue ? '#fca5a5' : '#e5e5e5'}; border-radius: 8px; padding: 20px; margin-bottom: 20px; background-color: ${isOverdue ? '#fef2f2' : '#fafafa'};">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="font-family: monospace; font-size: 14px; font-weight: 600; color: #333;">${invoiceNumber}</span>
            ${isOverdue ? '<span style="font-size: 11px; font-weight: 600; color: #dc2626; text-transform: uppercase;">Overdue</span>' : ''}
          </div>
          <div style="font-size: 28px; font-weight: 700; color: #f97316; font-family: monospace;">
            ${formattedTotal}
          </div>
        </div>

        ${paymentLink ? `
        <div style="margin-bottom: 24px;">
          <a href="${paymentLink}" style="display: inline-block; background-color: #f97316; color: white; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-size: 14px; font-weight: 600;">
            Pay Invoice Online
          </a>
        </div>
        ` : `
        <p style="font-size: 13px; color: #666; line-height: 1.5; margin-bottom: 20px;">
          Please contact us if you have any questions about this invoice.
        </p>
        `}

        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0 16px;" />
        <p style="font-size: 11px; color: #bbb; margin: 0;">
          Sent via QuotArc on behalf of ${companyName}
        </p>
      </div>
    `,
  })
}

// ─── Schedule Notification (to customer) ─────────────────────

export async function sendScheduleNotification({
  to,
  customerName,
  companyName,
  companyPhone,
  jobType,
  scheduledDate,
  startTime,
  address,
  quoteUrl,
}: {
  to: string
  customerName: string
  companyName: string
  companyPhone?: string | null
  jobType: string
  scheduledDate: string
  startTime?: string | null
  address?: string | null
  quoteUrl?: string | null
}) {
  const dateStr = new Date(scheduledDate).toLocaleDateString('en-CA', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  return resend.emails.send({
    from: buildFrom(companyName),
    to,
    subject: `Job Scheduled — ${dateStr}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 0;">
        <div style="margin-bottom: 24px;">
          <h2 style="font-size: 20px; font-weight: 600; color: #1a1a1a; margin: 0 0 4px;">
            ${companyName}
          </h2>
          ${companyPhone ? `<p style="font-size: 13px; color: #888; margin: 0;">${companyPhone}</p>` : ''}
        </div>

        <p style="font-size: 15px; color: #333; line-height: 1.5; margin-bottom: 20px;">
          Hi ${customerName}, your <strong>${jobType}</strong> has been scheduled.
        </p>

        <div style="border: 1px solid #e5e5e5; border-radius: 8px; padding: 20px; margin-bottom: 20px; background-color: #fafafa;">
          <div style="font-size: 16px; font-weight: 600; color: #1a1a1a; margin-bottom: 8px;">
            ${dateStr}${startTime ? ` at ${startTime}` : ''}
          </div>
          <div style="font-size: 14px; color: #555;">${jobType}</div>
          ${address ? `<div style="font-size: 13px; color: #888; margin-top: 4px;">${address}</div>` : ''}
        </div>

        ${quoteUrl ? `
        <a href="${quoteUrl}" style="display: inline-block; background-color: #f97316; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-size: 14px; font-weight: 500;">
          View Details
        </a>
        ` : ''}

        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0 16px;" />
        <p style="font-size: 11px; color: #bbb; margin: 0;">
          Sent via QuotArc on behalf of ${companyName}
        </p>
      </div>
    `,
  })
}

// ─── Quote Follow-Up (to customer) ──────────────────────────

export async function sendFollowUpEmail({
  to,
  customerName,
  companyName,
  companyPhone,
  quoteNumber,
  jobType,
  total,
  quoteUrl,
  chatUrl,
  followUpNumber,
  customMessage,
}: {
  to: string
  customerName: string
  companyName: string
  companyPhone?: string | null
  quoteNumber: string
  jobType: string
  total: number
  quoteUrl: string
  chatUrl: string
  followUpNumber: number
  customMessage?: string | null
}) {
  const formattedTotal = new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
  }).format(total)

  const defaultMessage = followUpNumber === 1
    ? `Just following up on the quote I sent for ${jobType}. Let me know if you have any questions or would like to make changes.`
    : `Wanted to check in one more time about your ${jobType} quote. This quote will expire soon — happy to answer any questions before then.`

  const body = customMessage
    ? customMessage
        .replace('{customer_name}', customerName)
        .replace('{job_type}', jobType)
    : defaultMessage

  return resend.emails.send({
    from: buildFrom(companyName),
    to,
    subject: `Following up: Quote ${quoteNumber} for ${jobType}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 0;">
        <div style="margin-bottom: 24px;">
          <h2 style="font-size: 20px; font-weight: 600; color: #1a1a1a; margin: 0 0 4px;">
            ${companyName}
          </h2>
          ${companyPhone ? `<p style="font-size: 13px; color: #888; margin: 0;">${companyPhone}</p>` : ''}
        </div>

        <p style="font-size: 15px; color: #333; line-height: 1.5; margin-bottom: 20px;">
          Hi ${customerName},
        </p>

        <p style="font-size: 14px; color: #444; line-height: 1.6; margin-bottom: 20px;">
          ${body}
        </p>

        <!-- Quote Reminder Card -->
        <div style="border: 1px solid #e5e5e5; border-radius: 8px; padding: 16px; margin-bottom: 20px; background-color: #fafafa;">
          <div style="font-family: monospace; font-size: 13px; font-weight: 600; color: #333; margin-bottom: 4px;">${quoteNumber}</div>
          <div style="font-size: 12px; color: #888; margin-bottom: 8px;">${jobType}</div>
          <div style="font-size: 22px; font-weight: 700; color: #f97316; font-family: monospace;">
            ${formattedTotal}
          </div>
        </div>

        <div style="margin-bottom: 24px;">
          <a href="${quoteUrl}" style="display: inline-block; background-color: #f97316; color: white; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-size: 14px; font-weight: 600; margin-right: 8px;">
            View Quote
          </a>
          <a href="${chatUrl}" style="display: inline-block; background-color: #fff; color: #f97316; text-decoration: none; padding: 11px 28px; border-radius: 6px; font-size: 14px; font-weight: 600; border: 1px solid #f97316;">
            Reply
          </a>
        </div>

        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0 16px;" />
        <p style="font-size: 11px; color: #bbb; margin: 0;">
          Sent via QuotArc on behalf of ${companyName}
        </p>
      </div>
    `,
  })
}

// ─── Google Review Request ──────────────────────────────────────

export async function sendReviewRequestEmail({
  to,
  customerName,
  companyName,
  companyPhone,
  jobType,
  reviewUrl,
}: {
  to: string
  customerName: string
  companyName: string
  companyPhone?: string | null
  jobType: string
  reviewUrl: string
}) {
  return resend.emails.send({
    from: buildFrom(companyName),
    to,
    subject: `How was your experience with ${companyName}?`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 0;">
        <h2 style="font-size: 20px; font-weight: 600; color: #1a1a1a; margin: 0 0 4px;">
          ${companyName}
        </h2>
        ${companyPhone ? `<p style="font-size: 13px; color: #888; margin: 0 0 16px;">${companyPhone}</p>` : '<div style="margin-bottom: 16px;"></div>'}
        <p style="font-size: 15px; color: #333; line-height: 1.5; margin-bottom: 20px;">
          Hi ${customerName}, thank you for choosing us for your ${jobType}! We hope everything went well.
        </p>
        <p style="font-size: 14px; color: #444; line-height: 1.6; margin-bottom: 24px;">
          If you were happy with the work, we&rsquo;d really appreciate a quick Google review. It helps other homeowners find reliable electricians.
        </p>
        <a href="${reviewUrl}" style="display: inline-block; background-color: #f97316; color: white; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-size: 15px; font-weight: 600;">
          Leave a Review &#9733;
        </a>
        <p style="font-size: 12px; color: #999; line-height: 1.5; margin-top: 24px;">
          This usually takes less than 2 minutes. Thank you for your support!
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0 16px;" />
        <p style="font-size: 11px; color: #bbb; margin: 0;">
          Sent via QuotArc on behalf of ${companyName}
        </p>
      </div>
    `,
  })
}

// ─── Contact Form Submission ─────────────────────────────────────

export async function sendContactEmail({
  name,
  email,
  subject,
  message,
}: {
  name: string
  email: string
  subject: string
  message: string
}) {
  return resend.emails.send({
    from: 'QuotArc <notifications@quotarc.com>',
    to: 'contact@quotarc.com',
    replyTo: email,
    subject: `[Contact] ${subject}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 0;">
        <h2 style="font-size: 18px; font-weight: 600; color: #1a1a1a; margin-bottom: 20px;">
          New contact form submission
        </h2>
        <div style="border: 1px solid #e5e5e5; border-radius: 8px; padding: 20px; background-color: #fafafa; margin-bottom: 20px;">
          <div style="margin-bottom: 12px;">
            <span style="font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 0.05em;">From</span>
            <div style="font-size: 15px; font-weight: 600; color: #1a1a1a; margin-top: 2px;">${name}</div>
            <div style="font-size: 13px; color: #555; margin-top: 2px;">${email}</div>
          </div>
          <div style="margin-bottom: 12px;">
            <span style="font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 0.05em;">Subject</span>
            <div style="font-size: 14px; color: #333; margin-top: 2px;">${subject}</div>
          </div>
          <div style="border-top: 1px solid #e5e5e5; padding-top: 12px; margin-top: 4px;">
            <span style="font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 0.05em;">Message</span>
            <p style="font-size: 14px; color: #444; line-height: 1.6; margin: 6px 0 0; white-space: pre-wrap;">${message}</p>
          </div>
        </div>
        <p style="font-size: 12px; color: #999;">
          Reply directly to this email to respond to ${name}.
        </p>
      </div>
    `,
  })
}

// ─── AI Receptionist Call Summary ───────────────────────────────

export async function sendCallSummaryEmail({
  to,
  companyName,
  callerName,
  callerNumber,
  jobType,
  summary,
  duration,
  dashboardUrl,
}: {
  to: string
  companyName?: string | null
  callerName: string
  callerNumber: string
  jobType: string
  summary: string
  duration: string
  dashboardUrl: string
}) {
  return resend.emails.send({
    from: buildFrom(companyName),
    to,
    subject: `New call: ${callerName} \u2014 ${jobType}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 0;">
        <h2 style="font-size: 18px; font-weight: 600; color: #1a1a1a; margin-bottom: 16px;">
          New Lead from AI Receptionist
        </h2>
        <div style="border: 1px solid #e5e5e5; border-radius: 8px; padding: 20px; background-color: #fafafa; margin-bottom: 20px;">
          <div style="font-size: 15px; font-weight: 600; color: #333;">${callerName}</div>
          <div style="font-size: 13px; color: #666; margin-top: 4px;">${callerNumber}</div>
          <div style="font-size: 13px; color: #666; margin-top: 4px;">Job: ${jobType}</div>
          <div style="font-size: 13px; color: #666; margin-top: 4px;">Duration: ${duration}</div>
          <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e5e5e5;">
            <p style="font-size: 13px; color: #444; line-height: 1.5; margin: 0;">${summary}</p>
          </div>
        </div>
        <a href="${dashboardUrl}" style="display: inline-block; background-color: #f97316; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-size: 14px; font-weight: 500;">
          View in Dashboard
        </a>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0 16px;" />
        <p style="font-size: 11px; color: #bbb; margin: 0;">QuotArc AI Receptionist</p>
      </div>
    `,
  })
}
