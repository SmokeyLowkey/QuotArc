import PDFDocument from 'pdfkit'

// ─── Logo Fetcher ───────────────────────────────────────────

async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return Buffer.from(await res.arrayBuffer())
  } catch {
    return null
  }
}

// ─── Shared Helpers ─────────────────────────────────────────

function formatCAD(amount: number): string {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(amount)
}

function formatDateShort(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-CA', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function collectToBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = []
    doc.on('data', (chunk: Uint8Array) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
  })
}

// ─── Shared table drawing ───────────────────────────────────

interface LineItemRow {
  description: string
  category: string
  quantity: number
  unit: string
  rate: number
  total: number
}

const COL = {
  desc: 50,
  qty: 360,
  rate: 410,
  total: 480,
  right: 545,
} as const

function drawLineItemTable(
  doc: PDFKit.PDFDocument,
  lineItems: LineItemRow[],
  startY: number,
): number {
  let y = startY

  // Header
  doc.fontSize(8).fillColor('#888888')
  doc.text('DESCRIPTION', COL.desc, y)
  doc.text('QTY', COL.qty, y, { width: 40, align: 'right' })
  doc.text('RATE', COL.rate, y, { width: 60, align: 'right' })
  doc.text('TOTAL', COL.total, y, { width: 65, align: 'right' })
  y += 16
  doc.moveTo(COL.desc, y).lineTo(COL.right, y).lineWidth(1).strokeColor('#cccccc').stroke()
  y += 8

  // Rows
  doc.fontSize(9).fillColor('#333333')
  for (const item of lineItems) {
    if (y > 700) {
      doc.addPage()
      y = 50
    }

    const label = item.category !== 'material'
      ? `${item.description}  [${item.category}]`
      : item.description
    const qtyStr = item.unit !== 'ea' ? `${item.quantity} ${item.unit}` : `${item.quantity}`

    doc.text(label, COL.desc, y, { width: 300 })
    doc.text(qtyStr, COL.qty, y, { width: 40, align: 'right' })
    doc.text(formatCAD(item.rate), COL.rate, y, { width: 60, align: 'right' })
    doc.font('Helvetica-Bold').text(formatCAD(item.total), COL.total, y, { width: 65, align: 'right' })
    doc.font('Helvetica')

    y += 18
    doc.moveTo(COL.desc, y - 4).lineTo(COL.right, y - 4).lineWidth(0.5).strokeColor('#eeeeee').stroke()
  }

  return y
}

function drawTotals(
  doc: PDFKit.PDFDocument,
  subtotal: number,
  taxRate: number,
  tax: number,
  total: number,
  y: number,
): number {
  const labelX = 400
  const valueX = 480
  const w = 65

  doc.fontSize(9).fillColor('#666666').font('Helvetica')
  doc.text('Subtotal', labelX, y, { width: 70, align: 'right' })
  doc.text(formatCAD(subtotal), valueX, y, { width: w, align: 'right' })
  y += 16

  doc.text(`Tax (${(taxRate * 100).toFixed(0)}%)`, labelX, y, { width: 70, align: 'right' })
  doc.text(formatCAD(tax), valueX, y, { width: w, align: 'right' })
  y += 18

  doc.moveTo(labelX, y).lineTo(COL.right, y).lineWidth(1.5).strokeColor('#1a1a1a').stroke()
  y += 8

  doc.fontSize(14).fillColor('#1a1a1a').font('Helvetica-Bold')
  doc.text('Total', labelX, y, { width: 70, align: 'right' })
  doc.text(formatCAD(total), valueX, y, { width: w, align: 'right' })
  doc.font('Helvetica')
  y += 24

  return y
}

// ─── Quote PDF ──────────────────────────────────────────────

export interface QuotePdfData {
  companyName: string
  companyPhone?: string | null
  companyAddress?: string | null
  logoUrl?: string | null
  quoteNumber: string
  date: string
  customerName: string
  customerAddress?: string | null
  customerEmail?: string | null
  jobType: string
  lineItems: LineItemRow[]
  subtotal: number
  taxRate: number
  tax: number
  total: number
  customerNote?: string | null
  scopeNotes?: string | null
  // E-signature
  signatureData?: string | null
  signatureName?: string | null
  signedAt?: string | null
}

export async function generateQuotePdf(data: QuotePdfData): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'LETTER', margin: 50 })
  const bufferPromise = collectToBuffer(doc)

  const logoBuffer = data.logoUrl ? await fetchImageBuffer(data.logoUrl) : null

  // ── Header bar ──
  doc.rect(0, 0, 612, 80).fill('#1a1a1a')

  let textLeft = 50
  if (logoBuffer) {
    doc.image(logoBuffer, 50, 12, { height: 56, fit: [120, 56] })
    textLeft = 180
  }

  doc.fontSize(18).fillColor('#ffffff').font('Helvetica-Bold')
  doc.text(data.companyName, textLeft, 22)
  doc.font('Helvetica').fontSize(10).fillColor('#999999')
  if (data.companyPhone) doc.text(data.companyPhone, textLeft, 48)
  if (data.companyAddress) doc.text(data.companyAddress, textLeft, 62)

  doc.fontSize(9).fillColor('#999999').text('QUOTE', 440, 22)
  doc.fontSize(16).fillColor('#ffffff').font('Helvetica-Bold').text(data.quoteNumber, 440, 34)
  doc.font('Helvetica').fontSize(9).fillColor('#999999').text(formatDateShort(data.date), 440, 56)

  // ── Customer + Job Info ──
  let y = 100
  doc.fontSize(8).fillColor('#888888').text('PREPARED FOR', 50, y)
  y += 14
  doc.fontSize(11).fillColor('#1a1a1a').font('Helvetica-Bold').text(data.customerName, 50, y)
  doc.font('Helvetica')
  y += 16
  if (data.customerAddress) { doc.fontSize(9).fillColor('#555555').text(data.customerAddress, 50, y); y += 14 }
  if (data.customerEmail) { doc.fontSize(9).fillColor('#555555').text(data.customerEmail, 50, y); y += 14 }

  doc.fontSize(8).fillColor('#888888').text('JOB TYPE', 350, 100)
  doc.fontSize(11).fillColor('#1a1a1a').font('Helvetica-Bold').text(data.jobType, 350, 114)
  doc.font('Helvetica')

  y = Math.max(y, 140) + 10

  // ── Scope Notes ──
  if (data.scopeNotes) {
    doc.rect(50, y, 512, 2).fill('#f97316')
    y += 8
    doc.fontSize(8).fillColor('#888888').text('SCOPE', 50, y)
    y += 14
    doc.fontSize(9).fillColor('#444444').text(data.scopeNotes, 50, y, { width: 500 })
    y += doc.heightOfString(data.scopeNotes, { width: 500 }) + 12
  }

  // ── Line Items Table ──
  y = drawLineItemTable(doc, data.lineItems, y)
  y += 8

  // ── Totals ──
  y = drawTotals(doc, data.subtotal, data.taxRate, data.tax, data.total, y)

  // ── Customer Note ──
  if (data.customerNote) {
    y += 8
    doc.rect(50, y, 3, 40).fill('#f97316')
    doc.fontSize(9).fillColor('#555555').text(data.customerNote, 60, y + 6, { width: 480 })
    y += 50
  }

  // ── E-signature block ──
  if (data.signatureData && data.signatureName) {
    if (y > 620) {
      doc.addPage()
      y = 50
    }

    y += 12
    doc.moveTo(50, y).lineTo(COL.right, y).lineWidth(0.5).strokeColor('#cccccc').stroke()
    y += 16

    doc.fontSize(8).fillColor('#888888').text('ACCEPTED & SIGNED', 50, y)
    y += 14

    const base64Data = data.signatureData.split(',')[1]
    if (base64Data) {
      const sigBuffer = Buffer.from(base64Data, 'base64')
      doc.image(sigBuffer, 50, y, { width: 200, height: 80 })
      y += 88
    }

    doc.moveTo(50, y).lineTo(250, y).lineWidth(0.5).strokeColor('#333333').stroke()
    y += 10

    doc.fontSize(10).fillColor('#1a1a1a').font('Helvetica-Bold')
    doc.text(data.signatureName, 50, y)
    doc.font('Helvetica')
    y += 16

    if (data.signedAt) {
      doc.fontSize(8).fillColor('#888888')
      doc.text(`Signed: ${formatDateShort(data.signedAt)}`, 50, y)
      y += 14
    }
  }

  // ── Footer ──
  doc.fontSize(8).fillColor('#bbbbbb').text(
    'Powered by QuotArc',
    50,
    doc.page.height - 40,
    { align: 'center', width: 512 },
  )

  doc.end()
  return bufferPromise
}

// ─── Invoice PDF ────────────────────────────────────────────

export interface InvoicePdfData {
  companyName: string
  companyPhone?: string | null
  companyAddress?: string | null
  logoUrl?: string | null
  invoiceNumber: string
  date: string
  dueDate?: string | null
  customerName: string
  customerAddress?: string | null
  customerEmail?: string | null
  lineItems: LineItemRow[]
  subtotal: number
  taxRate: number
  tax: number
  total: number
}

export async function generateInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'LETTER', margin: 50 })
  const bufferPromise = collectToBuffer(doc)

  const logoBuffer = data.logoUrl ? await fetchImageBuffer(data.logoUrl) : null

  // ── Header bar ──
  doc.rect(0, 0, 612, 80).fill('#1a1a1a')

  let textLeft = 50
  if (logoBuffer) {
    doc.image(logoBuffer, 50, 12, { height: 56, fit: [120, 56] })
    textLeft = 180
  }

  doc.fontSize(18).fillColor('#ffffff').font('Helvetica-Bold')
  doc.text(data.companyName, textLeft, 22)
  doc.font('Helvetica').fontSize(10).fillColor('#999999')
  if (data.companyPhone) doc.text(data.companyPhone, textLeft, 48)
  if (data.companyAddress) doc.text(data.companyAddress, textLeft, 62)

  doc.fontSize(9).fillColor('#999999').text('INVOICE', 440, 22)
  doc.fontSize(16).fillColor('#ffffff').font('Helvetica-Bold').text(data.invoiceNumber, 440, 34)
  doc.font('Helvetica').fontSize(9).fillColor('#999999').text(formatDateShort(data.date), 440, 56)

  // ── Customer Info + Due Date ──
  let y = 100
  doc.fontSize(8).fillColor('#888888').text('BILL TO', 50, y)
  y += 14
  doc.fontSize(11).fillColor('#1a1a1a').font('Helvetica-Bold').text(data.customerName, 50, y)
  doc.font('Helvetica')
  y += 16
  if (data.customerAddress) { doc.fontSize(9).fillColor('#555555').text(data.customerAddress, 50, y); y += 14 }
  if (data.customerEmail) { doc.fontSize(9).fillColor('#555555').text(data.customerEmail, 50, y); y += 14 }

  if (data.dueDate) {
    doc.fontSize(8).fillColor('#888888').text('DUE DATE', 350, 100)
    doc.fontSize(11).fillColor('#1a1a1a').font('Helvetica-Bold').text(formatDateShort(data.dueDate), 350, 114)
    doc.font('Helvetica')
  }

  y = Math.max(y, 140) + 10

  // ── Line Items Table ──
  y = drawLineItemTable(doc, data.lineItems, y)
  y += 8

  // ── Totals ──
  y = drawTotals(doc, data.subtotal, data.taxRate, data.tax, data.total, y)

  // ── Payment Info ──
  y += 12
  doc.fontSize(9).fillColor('#666666').text(
    data.dueDate
      ? `Payment is due by ${formatDateShort(data.dueDate)}. Please remit payment at your earliest convenience.`
      : 'Please remit payment at your earliest convenience.',
    50,
    y,
    { width: 500 },
  )

  // ── Footer ──
  doc.fontSize(8).fillColor('#bbbbbb').text(
    'Powered by QuotArc',
    50,
    doc.page.height - 40,
    { align: 'center', width: 512 },
  )

  doc.end()
  return bufferPromise
}
