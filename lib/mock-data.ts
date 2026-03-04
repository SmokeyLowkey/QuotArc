// QuotArc — Realistic Calgary-area mock data for MVP

export type QuoteStatus = 'draft' | 'sent' | 'viewed' | 'accepted' | 'expired'
export type JobStatus = 'scheduled' | 'in-progress' | 'completed'
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue'

export interface Customer {
  id: string
  name: string
  phone: string
  email: string
  address: string
  area: string
  jobCount: number
  lifetimeValue: number
  lastJobDate: string
  notes: string
}

export interface LineItem {
  id: string
  description: string
  qty: number
  rate: number
  suggested?: boolean
}

export interface Quote {
  id: string
  number: string
  customerId: string
  customerName: string
  address: string
  jobType: string
  status: QuoteStatus
  lineItems: LineItem[]
  subtotal: number
  taxRate: number
  taxAmount: number
  total: number
  autoFollowUp: boolean
  followUpDays: number
  requireSignature: boolean
  note: string
  createdAt: string
  sentAt: string | null
  viewedAt: string | null
  acceptedAt: string | null
  nextFollowUp: string | null
}

export interface Job {
  id: string
  quoteId: string | null
  customerId: string
  customerName: string
  address: string
  jobType: string
  status: JobStatus
  date: string
  startTime: string
  estimatedHours: number
  elapsedHours: number
  assignedTo: string
  materials: string[]
  notes: string
  total: number
}

export interface Invoice {
  id: string
  number: string
  jobId: string | null
  quoteId: string | null
  customerId: string
  customerName: string
  jobType: string
  lineItems: LineItem[]
  subtotal: number
  taxRate: number
  taxAmount: number
  total: number
  status: InvoiceStatus
  sentAt: string | null
  paidAt: string | null
  dueDate: string
}

export interface TeamMember {
  id: string
  name: string
  initials: string
  phone: string
  hourlyRate: number
}

export const team: TeamMember[] = [
  { id: 't1', name: 'You (Kyle Brandt)', initials: 'KB', phone: '(403) 555-0112', hourlyRate: 95 },
  { id: 't2', name: 'Mike Torres', initials: 'MT', phone: '(403) 555-0187', hourlyRate: 75 },
  { id: 't3', name: 'Raj Patel', initials: 'RP', phone: '(403) 555-0203', hourlyRate: 65 },
]

export const customers: Customer[] = [
  {
    id: 'c1', name: 'Sarah Chen', phone: '(403) 555-0134', email: 'sarah.chen@email.com',
    address: '142 Riverside Dr SE, Calgary', area: 'Calgary SE',
    jobCount: 4, lifetimeValue: 6240, lastJobDate: '2026-02-23',
    notes: 'Main panel in basement. Dog in backyard (friendly). Gate code: 4521. 14/2 Romex throughout, aluminum wiring in kitchen — flagged for replacement.',
  },
  {
    id: 'c2', name: 'David Park', phone: '(403) 555-0198', email: 'david.park@email.com',
    address: '88 Bow Trail SW, Calgary', area: 'Calgary SW',
    jobCount: 1, lifetimeValue: 1200, lastJobDate: '2026-02-23',
    notes: 'New construction. Garage has 60A sub-panel. Wants Level 2 EV charger on south wall.',
  },
  {
    id: 'c3', name: 'James Morrison', phone: '(403) 555-0221', email: 'j.morrison@email.com',
    address: '45 Ranch Estates Dr, Airdrie', area: 'Airdrie',
    jobCount: 2, lifetimeValue: 8400, lastJobDate: '2026-02-12',
    notes: 'Basement development. Rough-in for 6 circuits, 4 pot lights. Builder is Landmark Homes, coordinate with site super.',
  },
  {
    id: 'c4', name: 'Linda James', phone: '(403) 555-0156', email: 'linda.james@email.com',
    address: '206 17th Ave SW, Calgary', area: 'Calgary SW',
    jobCount: 3, lifetimeValue: 2840, lastJobDate: '2026-02-23',
    notes: 'Commercial unit above restaurant. Old BX wiring. Intermittent tripping on circuit 12 — likely loose neutral.',
  },
  {
    id: 'c5', name: 'Tom Oberg', phone: '(403) 555-0175', email: 'tom.oberg@email.com',
    address: '310 Tuscany Hills Close NW, Calgary', area: 'Calgary NW',
    jobCount: 1, lifetimeValue: 180, lastJobDate: '2026-02-19',
    notes: 'Service call for GFCI tripping in master bath. Suspect moisture in junction box.',
  },
  {
    id: 'c6', name: 'Rachel Fenton', phone: '(403) 555-0143', email: 'rachel.fenton@email.com',
    address: '78 Elbow Park Lane SW, Calgary', area: 'Calgary SW',
    jobCount: 1, lifetimeValue: 2100, lastJobDate: '2026-02-26',
    notes: 'Heritage home, knob-and-tube in attic. Under-cabinet lighting in kitchen, 8 LED pucks. Wants dimmer.',
  },
  {
    id: 'c7', name: 'Gary Whitfield', phone: '(587) 555-0109', email: 'gary.w@email.com',
    address: '22 Sage Hill Green NW, Calgary', area: 'Calgary NW',
    jobCount: 0, lifetimeValue: 0, lastJobDate: '',
    notes: '',
  },
]

export const quotes: Quote[] = [
  {
    id: 'q1', number: 'Q-0047', customerId: 'c1', customerName: 'Sarah Chen',
    address: '142 Riverside Dr SE, Calgary', jobType: '200A Panel Upgrade',
    status: 'viewed',
    lineItems: [
      { id: 'li1', description: '200A Panel (Eaton BR)', qty: 1, rate: 485, suggested: true },
      { id: 'li2', description: '200A Main Breaker', qty: 1, rate: 127, suggested: true },
      { id: 'li3', description: '#2 Copper THHN (ft)', qty: 25, rate: 3.80, suggested: true },
      { id: 'li4', description: 'Permit Fee — City of Calgary', qty: 1, rate: 150 },
      { id: 'li5', description: 'Labor — Panel Swap (hrs)', qty: 6, rate: 95, suggested: true },
      { id: 'li6', description: 'Misc hardware & connectors', qty: 1, rate: 82 },
    ],
    subtotal: 1414, taxRate: 0.05, taxAmount: 70.70, total: 1484.70,
    autoFollowUp: true, followUpDays: 3, requireSignature: true,
    note: 'Price includes city permit and inspection. Valid for 30 days.',
    createdAt: '2026-02-23T08:15:00', sentAt: '2026-02-23T08:17:00',
    viewedAt: '2026-02-23T11:42:00', acceptedAt: null,
    nextFollowUp: '2026-02-26T09:00:00',
  },
  {
    id: 'q2', number: 'Q-0046', customerId: 'c2', customerName: 'David Park',
    address: '88 Bow Trail SW, Calgary', jobType: 'EV Charger Install',
    status: 'accepted',
    lineItems: [
      { id: 'li7', description: 'Tesla Wall Connector (Gen 3)', qty: 1, rate: 520, suggested: true },
      { id: 'li8', description: '6/3 NMD90 Cable (ft)', qty: 35, rate: 4.20, suggested: true },
      { id: 'li9', description: '50A GFCI Breaker', qty: 1, rate: 68, suggested: true },
      { id: 'li10', description: 'Labor — EV Install (hrs)', qty: 4, rate: 95, suggested: true },
      { id: 'li11', description: 'Mounting hardware & conduit', qty: 1, rate: 45 },
    ],
    subtotal: 1100, taxRate: 0.05, taxAmount: 55, total: 1155,
    autoFollowUp: true, followUpDays: 2, requireSignature: true,
    note: 'Includes wall mount and cable management. Warranty pass-through from Tesla.',
    createdAt: '2026-02-20T14:30:00', sentAt: '2026-02-20T14:32:00',
    viewedAt: '2026-02-20T16:05:00', acceptedAt: '2026-02-21T09:15:00',
    nextFollowUp: null,
  },
  {
    id: 'q3', number: 'Q-0045', customerId: 'c3', customerName: 'James Morrison',
    address: '45 Ranch Estates Dr, Airdrie', jobType: 'Basement Rough-In',
    status: 'sent',
    lineItems: [
      { id: 'li12', description: '14/2 NMD90 (ft)', qty: 450, rate: 0.85, suggested: true },
      { id: 'li13', description: '14/3 NMD90 (ft)', qty: 120, rate: 1.10, suggested: true },
      { id: 'li14', description: '4" LED Pot Lights', qty: 12, rate: 28, suggested: true },
      { id: 'li15', description: 'Decora Switches & Plates', qty: 8, rate: 12 },
      { id: 'li16', description: 'Receptacles & Covers', qty: 14, rate: 8 },
      { id: 'li17', description: 'Sub-panel 60A (if needed)', qty: 1, rate: 220 },
      { id: 'li18', description: 'Labor — Rough-In (hrs)', qty: 24, rate: 95, suggested: true },
      { id: 'li19', description: 'Permit Fee — City of Airdrie', qty: 1, rate: 175 },
    ],
    subtotal: 3737.50, taxRate: 0.05, taxAmount: 186.88, total: 3924.38,
    autoFollowUp: true, followUpDays: 3, requireSignature: true,
    note: 'Price based on plans rev 3. Additional circuits beyond scope quoted separately.',
    createdAt: '2026-02-19T10:00:00', sentAt: '2026-02-19T10:05:00',
    viewedAt: null, acceptedAt: null,
    nextFollowUp: '2026-02-24T09:00:00',
  },
  {
    id: 'q4', number: 'Q-0044', customerId: 'c4', customerName: 'Linda James',
    address: '206 17th Ave SW, Calgary', jobType: 'Outlet Troubleshoot',
    status: 'accepted',
    lineItems: [
      { id: 'li20', description: 'Service Call — Troubleshoot', qty: 1, rate: 125 },
      { id: 'li21', description: 'GFCI Receptacle (Leviton)', qty: 2, rate: 18, suggested: true },
      { id: 'li22', description: 'Labor — Repair (hrs)', qty: 1.5, rate: 95, suggested: true },
    ],
    subtotal: 303.50, taxRate: 0.05, taxAmount: 15.18, total: 318.68,
    autoFollowUp: false, followUpDays: 3, requireSignature: false,
    note: '',
    createdAt: '2026-02-22T16:00:00', sentAt: '2026-02-22T16:02:00',
    viewedAt: '2026-02-22T16:30:00', acceptedAt: '2026-02-22T17:00:00',
    nextFollowUp: null,
  },
  {
    id: 'q5', number: 'Q-0043', customerId: 'c6', customerName: 'Rachel Fenton',
    address: '78 Elbow Park Lane SW, Calgary', jobType: 'Lighting Install',
    status: 'viewed',
    lineItems: [
      { id: 'li23', description: 'LED Puck Light (Halo)', qty: 8, rate: 32, suggested: true },
      { id: 'li24', description: 'Lutron Caseta Dimmer', qty: 2, rate: 65, suggested: true },
      { id: 'li25', description: '14/2 NMD90 (ft)', qty: 60, rate: 0.85 },
      { id: 'li26', description: 'Labor — Lighting (hrs)', qty: 8, rate: 95, suggested: true },
      { id: 'li27', description: 'Misc supplies & wire nuts', qty: 1, rate: 35 },
    ],
    subtotal: 1687, taxRate: 0.05, taxAmount: 84.35, total: 1771.35,
    autoFollowUp: true, followUpDays: 2, requireSignature: true,
    note: 'Heritage home — will need fish tape for walls. May require extra time if lathe encountered.',
    createdAt: '2026-02-21T11:00:00', sentAt: '2026-02-21T11:05:00',
    viewedAt: '2026-02-22T08:15:00', acceptedAt: null,
    nextFollowUp: '2026-02-25T09:00:00',
  },
  {
    id: 'q6', number: 'Q-0042', customerId: 'c5', customerName: 'Tom Oberg',
    address: '310 Tuscany Hills Close NW, Calgary', jobType: 'Service Call',
    status: 'expired',
    lineItems: [
      { id: 'li28', description: 'Service Call — Diagnostic', qty: 1, rate: 125 },
      { id: 'li29', description: 'Parts (estimated)', qty: 1, rate: 50 },
    ],
    subtotal: 175, taxRate: 0.05, taxAmount: 8.75, total: 183.75,
    autoFollowUp: true, followUpDays: 3, requireSignature: false,
    note: '',
    createdAt: '2026-02-05T09:00:00', sentAt: '2026-02-05T09:02:00',
    viewedAt: '2026-02-05T12:00:00', acceptedAt: null,
    nextFollowUp: null,
  },
  {
    id: 'q7', number: 'Q-0041', customerId: 'c7', customerName: 'Gary Whitfield',
    address: '22 Sage Hill Green NW, Calgary', jobType: 'EV Charger Install',
    status: 'draft',
    lineItems: [
      { id: 'li30', description: 'ChargePoint Home Flex', qty: 1, rate: 649, suggested: true },
      { id: 'li31', description: '6/3 NMD90 Cable (ft)', qty: 20, rate: 4.20, suggested: true },
      { id: 'li32', description: '50A Breaker', qty: 1, rate: 42 },
      { id: 'li33', description: 'Labor — EV Install (hrs)', qty: 3, rate: 95, suggested: true },
    ],
    subtotal: 1060, taxRate: 0.05, taxAmount: 53, total: 1113,
    autoFollowUp: true, followUpDays: 3, requireSignature: true,
    note: '',
    createdAt: '2026-02-23T07:00:00', sentAt: null,
    viewedAt: null, acceptedAt: null,
    nextFollowUp: null,
  },
]

export const jobs: Job[] = [
  {
    id: 'j1', quoteId: 'q1', customerId: 'c1', customerName: 'Sarah Chen',
    address: '142 Riverside Dr SE, Calgary', jobType: 'Panel Upgrade',
    status: 'in-progress', date: '2026-02-23', startTime: '8:00 AM',
    estimatedHours: 6, elapsedHours: 3.5, assignedTo: 'Mike Torres',
    materials: ['200A Panel (Eaton BR)', '200A Main Breaker', '#2 Copper THHN', 'Misc hardware'],
    notes: 'Customer confirmed morning access. Panel in basement, clear path.',
    total: 1484.70,
  },
  {
    id: 'j2', quoteId: 'q2', customerId: 'c2', customerName: 'David Park',
    address: '88 Bow Trail SW, Calgary', jobType: 'EV Charger Install',
    status: 'scheduled', date: '2026-02-23', startTime: '1:30 PM',
    estimatedHours: 4, elapsedHours: 0, assignedTo: 'You',
    materials: ['Tesla Wall Connector', '6/3 NMD90', '50A GFCI Breaker', 'Mounting hardware'],
    notes: 'Customer will have garage cleared. Mount on south wall per site visit.',
    total: 1155,
  },
  {
    id: 'j3', quoteId: 'q4', customerId: 'c4', customerName: 'Linda James',
    address: '206 17th Ave SW, Calgary', jobType: 'Outlet Troubleshoot',
    status: 'scheduled', date: '2026-02-23', startTime: '3:30 PM',
    estimatedHours: 1.5, elapsedHours: 0, assignedTo: 'You',
    materials: ['GFCI Receptacle x2'],
    notes: 'Intermittent tripping on circuit 12. Check junction box for moisture.',
    total: 318.68,
  },
  {
    id: 'j4', quoteId: null, customerId: 'c2', customerName: 'David Park',
    address: '88 Bow Trail SW, Calgary', jobType: 'EV Charger — Final Inspection',
    status: 'scheduled', date: '2026-02-24', startTime: '10:00 AM',
    estimatedHours: 1, elapsedHours: 0, assignedTo: 'You',
    materials: [],
    notes: 'City inspector visit. Ensure all covers on, labels applied, permit posted.',
    total: 0,
  },
  {
    id: 'j5', quoteId: 'q3', customerId: 'c3', customerName: 'James Morrison',
    address: '45 Ranch Estates Dr, Airdrie', jobType: 'Basement Rough-In',
    status: 'scheduled', date: '2026-02-24', startTime: '8:00 AM',
    estimatedHours: 8, elapsedHours: 0, assignedTo: 'Raj Patel',
    materials: ['14/2 NMD90', '14/3 NMD90', 'Boxes & connectors'],
    notes: 'Day 1 of 3. Focus on bedroom and bathroom circuits.',
    total: 3924.38,
  },
  {
    id: 'j6', quoteId: null, customerId: 'c5', customerName: 'Tom Oberg',
    address: '310 Tuscany Hills Close NW, Calgary', jobType: 'Service Call',
    status: 'scheduled', date: '2026-02-24', startTime: '2:00 PM',
    estimatedHours: 1, elapsedHours: 0, assignedTo: 'You',
    materials: [],
    notes: 'GFCI in master bath. Bring replacement in case needed.',
    total: 183.75,
  },
  {
    id: 'j7', quoteId: 'q3', customerId: 'c3', customerName: 'James Morrison',
    address: '45 Ranch Estates Dr, Airdrie', jobType: 'Basement Rough-In (Day 2)',
    status: 'scheduled', date: '2026-02-25', startTime: '8:00 AM',
    estimatedHours: 8, elapsedHours: 0, assignedTo: 'Raj Patel',
    materials: ['14/2 NMD90', 'Pot light housings x12', 'Switches & plates'],
    notes: 'Day 2. Kitchen and living room circuits. Install pot light housings.',
    total: 0,
  },
  {
    id: 'j8', quoteId: 'q5', customerId: 'c6', customerName: 'Rachel Fenton',
    address: '78 Elbow Park Lane SW, Calgary', jobType: 'Under-Cabinet Lighting',
    status: 'scheduled', date: '2026-02-26', startTime: '9:00 AM',
    estimatedHours: 8, elapsedHours: 0, assignedTo: 'You',
    materials: ['LED Puck Lights x8', 'Lutron Caseta Dimmer x2', '14/2 NMD90'],
    notes: 'Heritage home — fish tape needed. Customer wants warm white (3000K).',
    total: 1771.35,
  },
]

export const invoices: Invoice[] = [
  {
    id: 'inv1', number: 'INV-031', jobId: null, quoteId: null, customerId: 'c1',
    customerName: 'Sarah Chen', jobType: 'Knob Replacement',
    lineItems: [
      { id: 'il1', description: 'Service Call', qty: 1, rate: 125 },
      { id: 'il2', description: 'Dimmer Switch (Leviton)', qty: 1, rate: 34 },
      { id: 'il3', description: 'Labor (hrs)', qty: 0.5, rate: 95 },
    ],
    subtotal: 206.50, taxRate: 0.05, taxAmount: 10.33, total: 216.83,
    status: 'paid', sentAt: '2026-02-18T10:00:00', paidAt: '2026-02-20T14:22:00',
    dueDate: '2026-03-04',
  },
  {
    id: 'inv2', number: 'INV-030', jobId: null, quoteId: 'q3', customerId: 'c3',
    customerName: 'James Morrison', jobType: 'Rough-In (Deposit)',
    lineItems: [
      { id: 'il4', description: 'Basement Rough-In — 50% Deposit', qty: 1, rate: 1962.19 },
    ],
    subtotal: 1962.19, taxRate: 0, taxAmount: 0, total: 1962.19,
    status: 'overdue', sentAt: '2026-02-12T09:00:00', paidAt: null,
    dueDate: '2026-02-19',
  },
  {
    id: 'inv3', number: 'INV-029', jobId: 'j2', quoteId: 'q2', customerId: 'c2',
    customerName: 'David Park', jobType: 'EV Charger Install',
    lineItems: [
      { id: 'il5', description: 'Tesla Wall Connector (Gen 3)', qty: 1, rate: 520 },
      { id: 'il6', description: '6/3 NMD90 Cable (ft)', qty: 35, rate: 4.20 },
      { id: 'il7', description: '50A GFCI Breaker', qty: 1, rate: 68 },
      { id: 'il8', description: 'Labor — EV Install (hrs)', qty: 4, rate: 95 },
      { id: 'il9', description: 'Mounting hardware & conduit', qty: 1, rate: 45 },
    ],
    subtotal: 1100, taxRate: 0.05, taxAmount: 55, total: 1155,
    status: 'sent', sentAt: '2026-02-23T08:00:00', paidAt: null,
    dueDate: '2026-03-09',
  },
  {
    id: 'inv4', number: 'INV-028', jobId: 'j3', quoteId: 'q4', customerId: 'c4',
    customerName: 'Linda James', jobType: 'Outlet Fix',
    lineItems: [
      { id: 'il10', description: 'Service Call — Troubleshoot', qty: 1, rate: 125 },
      { id: 'il11', description: 'GFCI Receptacle (Leviton)', qty: 2, rate: 18 },
      { id: 'il12', description: 'Labor — Repair (hrs)', qty: 1.5, rate: 95 },
    ],
    subtotal: 303.50, taxRate: 0.05, taxAmount: 15.18, total: 318.68,
    status: 'draft', sentAt: null, paidAt: null,
    dueDate: '2026-03-09',
  },
  {
    id: 'inv5', number: 'INV-027', jobId: null, quoteId: null, customerId: 'c1',
    customerName: 'Sarah Chen', jobType: 'Outdoor Lighting',
    lineItems: [
      { id: 'il13', description: 'LED Flood Light', qty: 2, rate: 45 },
      { id: 'il14', description: 'Photocell + Timer', qty: 1, rate: 38 },
      { id: 'il15', description: '14/2 UF-B (ft)', qty: 30, rate: 1.20 },
      { id: 'il16', description: 'Labor (hrs)', qty: 3, rate: 95 },
    ],
    subtotal: 449, taxRate: 0.05, taxAmount: 22.45, total: 471.45,
    status: 'paid', sentAt: '2026-02-10T10:00:00', paidAt: '2026-02-15T11:30:00',
    dueDate: '2026-02-24',
  },
  {
    id: 'inv6', number: 'INV-026', jobId: null, quoteId: null, customerId: 'c4',
    customerName: 'Linda James', jobType: 'Breaker Replacement',
    lineItems: [
      { id: 'il17', description: '20A Breaker (Siemens)', qty: 2, rate: 18 },
      { id: 'il18', description: 'Labor (hrs)', qty: 1, rate: 95 },
    ],
    subtotal: 131, taxRate: 0.05, taxAmount: 6.55, total: 137.55,
    status: 'paid', sentAt: '2026-02-08T09:00:00', paidAt: '2026-02-10T16:00:00',
    dueDate: '2026-02-22',
  },
]

// Job type templates for the quote builder
export const jobTypeTemplates: Record<string, { icon: string; lineItems: Omit<LineItem, 'id'>[] }> = {
  'Panel Upgrade': {
    icon: 'Zap',
    lineItems: [
      { description: '200A Panel (Eaton BR)', qty: 1, rate: 485, suggested: true },
      { description: '200A Main Breaker', qty: 1, rate: 127, suggested: true },
      { description: '#2 Copper THHN (ft)', qty: 25, rate: 3.80, suggested: true },
      { description: 'Permit Fee — City of Calgary', qty: 1, rate: 150 },
      { description: 'Labor — Panel Swap (hrs)', qty: 6, rate: 95, suggested: true },
    ],
  },
  'Lighting Install': {
    icon: 'Lightbulb',
    lineItems: [
      { description: '4" LED Pot Light', qty: 6, rate: 28, suggested: true },
      { description: 'Dimmer Switch (Lutron)', qty: 1, rate: 65, suggested: true },
      { description: '14/2 NMD90 (ft)', qty: 50, rate: 0.85, suggested: true },
      { description: 'Labor — Lighting (hrs)', qty: 4, rate: 95, suggested: true },
    ],
  },
  'Outlet/Circuit': {
    icon: 'Plug',
    lineItems: [
      { description: 'Receptacle (Decora)', qty: 2, rate: 8, suggested: true },
      { description: '14/2 NMD90 (ft)', qty: 30, rate: 0.85, suggested: true },
      { description: '15A Breaker', qty: 1, rate: 12, suggested: true },
      { description: 'Labor — Circuit Run (hrs)', qty: 2, rate: 95, suggested: true },
    ],
  },
  'Rewiring': {
    icon: 'Cable',
    lineItems: [
      { description: '14/2 NMD90 (ft)', qty: 200, rate: 0.85, suggested: true },
      { description: 'Junction Boxes', qty: 8, rate: 6, suggested: true },
      { description: 'Permit Fee', qty: 1, rate: 150 },
      { description: 'Labor — Rewire (hrs)', qty: 16, rate: 95, suggested: true },
    ],
  },
  'EV Charger': {
    icon: 'BatteryCharging',
    lineItems: [
      { description: 'EV Wall Connector', qty: 1, rate: 520, suggested: true },
      { description: '6/3 NMD90 Cable (ft)', qty: 30, rate: 4.20, suggested: true },
      { description: '50A GFCI Breaker', qty: 1, rate: 68, suggested: true },
      { description: 'Labor — EV Install (hrs)', qty: 4, rate: 95, suggested: true },
    ],
  },
  'Rough-In': {
    icon: 'Hammer',
    lineItems: [
      { description: '14/2 NMD90 (ft)', qty: 300, rate: 0.85, suggested: true },
      { description: '14/3 NMD90 (ft)', qty: 80, rate: 1.10, suggested: true },
      { description: 'Boxes & Connectors', qty: 20, rate: 4, suggested: true },
      { description: 'Permit Fee', qty: 1, rate: 175 },
      { description: 'Labor — Rough-In (hrs)', qty: 16, rate: 95, suggested: true },
    ],
  },
  'Troubleshoot': {
    icon: 'Search',
    lineItems: [
      { description: 'Service Call — Diagnostic', qty: 1, rate: 125, suggested: true },
      { description: 'Parts (estimated)', qty: 1, rate: 50 },
      { description: 'Labor — Repair (hrs)', qty: 1, rate: 95, suggested: true },
    ],
  },
  'Custom': {
    icon: 'Wrench',
    lineItems: [],
  },
}
