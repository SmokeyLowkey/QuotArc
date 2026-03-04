import { PrismaClient, LineItemCategory } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.SUPABASE_POOLER_URL! })
const prisma = new PrismaClient({ adapter })

type TemplateData = {
  name: string
  slug: string
  description: string
  icon: string
  labor_hours_min: number
  labor_hours_max: number
  price_range_min: number
  price_range_max: number
  sort_order: number
  items: {
    description: string
    category: LineItemCategory
    default_qty: number
    unit: string
    price_range_low: number
    price_range_high: number
    is_conditional?: boolean
    condition_note?: string
    sort_order: number
  }[]
}

const templates: TemplateData[] = [
  {
    name: 'Panel Upgrade (100A → 200A)',
    slug: 'panel-upgrade',
    description: 'Upgrade residential electrical panel from 100A to 200A service',
    icon: 'Zap',
    labor_hours_min: 6,
    labor_hours_max: 10,
    price_range_min: 2500,
    price_range_max: 4500,
    sort_order: 1,
    items: [
      { description: '200A main breaker panel', category: 'material', default_qty: 1, unit: 'ea', price_range_low: 350, price_range_high: 600, sort_order: 1 },
      { description: '200A main breaker', category: 'material', default_qty: 1, unit: 'ea', price_range_low: 80, price_range_high: 150, sort_order: 2 },
      { description: '#2/0 copper service entrance cable', category: 'material', default_qty: 15, unit: 'ft', price_range_low: 8, price_range_high: 14, sort_order: 3 },
      { description: 'Ground rod with clamp', category: 'material', default_qty: 2, unit: 'ea', price_range_low: 25, price_range_high: 40, sort_order: 4 },
      { description: '#6 copper ground wire', category: 'material', default_qty: 20, unit: 'ft', price_range_low: 3, price_range_high: 5, sort_order: 5 },
      { description: 'Breakers (transfer from old panel)', category: 'material', default_qty: 15, unit: 'ea', price_range_low: 8, price_range_high: 25, sort_order: 6 },
      { description: 'Electrical labor — panel swap + reconnection', category: 'labor', default_qty: 8, unit: 'hr', price_range_low: 85, price_range_high: 125, sort_order: 7 },
      { description: 'Electrical permit', category: 'permit', default_qty: 1, unit: 'ea', price_range_low: 150, price_range_high: 300, sort_order: 8 },
      { description: 'ESA inspection fee', category: 'permit', default_qty: 1, unit: 'ea', price_range_low: 100, price_range_high: 200, is_conditional: true, condition_note: 'Required in Ontario', sort_order: 9 },
    ],
  },
  {
    name: 'EV Charger Install (Level 2)',
    slug: 'ev-charger',
    description: 'Install Level 2 EV charger (240V/40A–50A circuit)',
    icon: 'Car',
    labor_hours_min: 3,
    labor_hours_max: 6,
    price_range_min: 800,
    price_range_max: 2000,
    sort_order: 2,
    items: [
      { description: 'Level 2 EV charger (customer-supplied or included)', category: 'material', default_qty: 1, unit: 'ea', price_range_low: 0, price_range_high: 800, sort_order: 1 },
      { description: '50A 2-pole breaker', category: 'material', default_qty: 1, unit: 'ea', price_range_low: 20, price_range_high: 45, sort_order: 2 },
      { description: '#6 AWG copper wire (3-conductor)', category: 'material', default_qty: 30, unit: 'ft', price_range_low: 5, price_range_high: 9, sort_order: 3 },
      { description: 'Weatherproof NEMA 14-50 outlet or hardwire box', category: 'material', default_qty: 1, unit: 'ea', price_range_low: 15, price_range_high: 45, sort_order: 4 },
      { description: 'Conduit + fittings (exterior run)', category: 'material', default_qty: 1, unit: 'lot', price_range_low: 40, price_range_high: 120, is_conditional: true, condition_note: 'If exterior or exposed run required', sort_order: 5 },
      { description: 'Electrical labor — circuit install + mounting', category: 'labor', default_qty: 4, unit: 'hr', price_range_low: 85, price_range_high: 125, sort_order: 6 },
      { description: 'Electrical permit', category: 'permit', default_qty: 1, unit: 'ea', price_range_low: 100, price_range_high: 200, sort_order: 7 },
    ],
  },
  {
    name: 'Pot Lights / Recessed Lighting',
    slug: 'pot-lights',
    description: 'Install recessed LED pot lights in existing ceiling',
    icon: 'Lightbulb',
    labor_hours_min: 3,
    labor_hours_max: 8,
    price_range_min: 600,
    price_range_max: 2000,
    sort_order: 3,
    items: [
      { description: '4" slim LED pot light (IC-rated)', category: 'material', default_qty: 6, unit: 'ea', price_range_low: 15, price_range_high: 35, sort_order: 1 },
      { description: '14/2 NMD90 cable', category: 'material', default_qty: 50, unit: 'ft', price_range_low: 1, price_range_high: 2, sort_order: 2 },
      { description: 'Dimmer switch (LED-compatible)', category: 'material', default_qty: 1, unit: 'ea', price_range_low: 25, price_range_high: 60, sort_order: 3 },
      { description: 'Wire connectors, staples, boxes', category: 'material', default_qty: 1, unit: 'lot', price_range_low: 20, price_range_high: 40, sort_order: 4 },
      { description: 'Electrical labor — fish wire + install', category: 'labor', default_qty: 5, unit: 'hr', price_range_low: 85, price_range_high: 125, sort_order: 5 },
      { description: 'Drywall patching (if needed)', category: 'other', default_qty: 1, unit: 'lot', price_range_low: 0, price_range_high: 200, is_conditional: true, condition_note: 'If access holes needed', sort_order: 6 },
    ],
  },
  {
    name: 'Knob & Tube Replacement',
    slug: 'knob-tube',
    description: 'Replace knob-and-tube wiring with modern NMD90',
    icon: 'AlertTriangle',
    labor_hours_min: 16,
    labor_hours_max: 40,
    price_range_min: 5000,
    price_range_max: 15000,
    sort_order: 4,
    items: [
      { description: '14/2 NMD90 cable', category: 'material', default_qty: 500, unit: 'ft', price_range_low: 1, price_range_high: 2, sort_order: 1 },
      { description: '12/2 NMD90 cable (kitchen/bath circuits)', category: 'material', default_qty: 200, unit: 'ft', price_range_low: 1.5, price_range_high: 2.5, sort_order: 2 },
      { description: 'New receptacles (tamper-resistant)', category: 'material', default_qty: 20, unit: 'ea', price_range_low: 3, price_range_high: 8, sort_order: 3 },
      { description: 'New switches', category: 'material', default_qty: 10, unit: 'ea', price_range_low: 3, price_range_high: 8, sort_order: 4 },
      { description: 'Device boxes (old work)', category: 'material', default_qty: 30, unit: 'ea', price_range_low: 2, price_range_high: 5, sort_order: 5 },
      { description: 'Arc-fault breakers (AFCI)', category: 'material', default_qty: 8, unit: 'ea', price_range_low: 35, price_range_high: 55, sort_order: 6 },
      { description: 'Electrical labor — full rewire', category: 'labor', default_qty: 28, unit: 'hr', price_range_low: 85, price_range_high: 125, sort_order: 7 },
      { description: 'Electrical permit', category: 'permit', default_qty: 1, unit: 'ea', price_range_low: 200, price_range_high: 400, sort_order: 8 },
    ],
  },
  {
    name: 'Hot Tub / Spa Hookup',
    slug: 'hot-tub',
    description: 'Install dedicated 240V circuit for hot tub or spa',
    icon: 'Waves',
    labor_hours_min: 3,
    labor_hours_max: 6,
    price_range_min: 800,
    price_range_max: 2000,
    sort_order: 5,
    items: [
      { description: '50A or 60A 2-pole GFCI breaker', category: 'material', default_qty: 1, unit: 'ea', price_range_low: 80, price_range_high: 150, sort_order: 1 },
      { description: '#6 AWG copper wire (3 or 4 conductor)', category: 'material', default_qty: 40, unit: 'ft', price_range_low: 6, price_range_high: 10, sort_order: 2 },
      { description: 'Outdoor disconnect box (within sight of tub)', category: 'material', default_qty: 1, unit: 'ea', price_range_low: 40, price_range_high: 80, sort_order: 3 },
      { description: 'PVC conduit + fittings (outdoor run)', category: 'material', default_qty: 1, unit: 'lot', price_range_low: 50, price_range_high: 150, sort_order: 4 },
      { description: 'Electrical labor — circuit + disconnect install', category: 'labor', default_qty: 4, unit: 'hr', price_range_low: 85, price_range_high: 125, sort_order: 5 },
      { description: 'Electrical permit', category: 'permit', default_qty: 1, unit: 'ea', price_range_low: 100, price_range_high: 200, sort_order: 6 },
    ],
  },
  {
    name: 'Smoke / CO Detector Install',
    slug: 'smoke-co',
    description: 'Install hardwired interconnected smoke and CO detectors',
    icon: 'Shield',
    labor_hours_min: 2,
    labor_hours_max: 5,
    price_range_min: 400,
    price_range_max: 1200,
    sort_order: 6,
    items: [
      { description: 'Hardwired smoke/CO combo detector', category: 'material', default_qty: 4, unit: 'ea', price_range_low: 35, price_range_high: 65, sort_order: 1 },
      { description: '14/3 NMD90 cable (for interconnect)', category: 'material', default_qty: 60, unit: 'ft', price_range_low: 1.5, price_range_high: 2.5, sort_order: 2 },
      { description: 'Octagon boxes + mounting brackets', category: 'material', default_qty: 4, unit: 'ea', price_range_low: 3, price_range_high: 8, sort_order: 3 },
      { description: 'Electrical labor — fish wire + install', category: 'labor', default_qty: 3, unit: 'hr', price_range_low: 85, price_range_high: 125, sort_order: 4 },
    ],
  },
  {
    name: 'Basement Finish Wiring',
    slug: 'basement-finish',
    description: 'Complete rough-in and finish wiring for basement renovation',
    icon: 'Home',
    labor_hours_min: 12,
    labor_hours_max: 24,
    price_range_min: 3000,
    price_range_max: 7000,
    sort_order: 7,
    items: [
      { description: '14/2 NMD90 cable', category: 'material', default_qty: 250, unit: 'ft', price_range_low: 1, price_range_high: 2, sort_order: 1 },
      { description: '12/2 NMD90 cable (kitchen/bath/laundry)', category: 'material', default_qty: 100, unit: 'ft', price_range_low: 1.5, price_range_high: 2.5, sort_order: 2 },
      { description: 'Receptacles (tamper-resistant)', category: 'material', default_qty: 12, unit: 'ea', price_range_low: 3, price_range_high: 8, sort_order: 3 },
      { description: 'Switches (single + 3-way)', category: 'material', default_qty: 6, unit: 'ea', price_range_low: 3, price_range_high: 12, sort_order: 4 },
      { description: 'Light fixtures (customer choice)', category: 'material', default_qty: 6, unit: 'ea', price_range_low: 20, price_range_high: 80, sort_order: 5 },
      { description: 'Device boxes + covers', category: 'material', default_qty: 18, unit: 'ea', price_range_low: 2, price_range_high: 5, sort_order: 6 },
      { description: 'AFCI breakers', category: 'material', default_qty: 4, unit: 'ea', price_range_low: 35, price_range_high: 55, sort_order: 7 },
      { description: 'Electrical labor — rough-in + finish', category: 'labor', default_qty: 18, unit: 'hr', price_range_low: 85, price_range_high: 125, sort_order: 8 },
      { description: 'Electrical permit', category: 'permit', default_qty: 1, unit: 'ea', price_range_low: 150, price_range_high: 300, sort_order: 9 },
    ],
  },
  {
    name: 'Service Call / Troubleshooting',
    slug: 'service-call',
    description: 'Diagnose and repair electrical issue (tripped breakers, dead outlets, flickering lights)',
    icon: 'Wrench',
    labor_hours_min: 1,
    labor_hours_max: 3,
    price_range_min: 150,
    price_range_max: 500,
    sort_order: 8,
    items: [
      { description: 'Service call / diagnostic fee', category: 'labor', default_qty: 1, unit: 'ea', price_range_low: 80, price_range_high: 150, sort_order: 1 },
      { description: 'Electrical labor — repair', category: 'labor', default_qty: 1, unit: 'hr', price_range_low: 85, price_range_high: 125, sort_order: 2 },
      { description: 'Misc parts (breaker, receptacle, wire nuts, etc.)', category: 'material', default_qty: 1, unit: 'lot', price_range_low: 10, price_range_high: 100, sort_order: 3 },
    ],
  },
]

async function main() {
  console.log('Seeding job templates...')

  for (const t of templates) {
    const { items, ...templateData } = t
    const template = await prisma.jobTemplate.upsert({
      where: { slug: t.slug },
      update: { ...templateData },
      create: { ...templateData },
    })

    // Delete existing items and re-create
    await prisma.jobTemplateItem.deleteMany({
      where: { template_id: template.id },
    })

    await prisma.jobTemplateItem.createMany({
      data: items.map((item) => ({
        template_id: template.id,
        ...item,
      })),
    })

    console.log(`  ✓ ${template.name} (${items.length} items)`)
  }

  console.log(`\nSeeded ${templates.length} templates.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
