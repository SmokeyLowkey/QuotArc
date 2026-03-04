// Job type display config — maps template slugs to icons for the quote builder UI
// Actual template data (line items, prices) lives in the job_templates DB table

export const jobTypeConfig: Record<string, { icon: string; label: string }> = {
  'panel-upgrade': { icon: 'Zap', label: 'Panel Upgrade' },
  'ev-charger': { icon: 'BatteryCharging', label: 'EV Charger' },
  'dedicated-circuit': { icon: 'Plug', label: 'Dedicated Circuit' },
  'generator-hookup': { icon: 'Power', label: 'Generator Hookup' },
  'sub-panel': { icon: 'LayoutGrid', label: 'Sub-Panel Install' },
  'service-change': { icon: 'Cable', label: 'Service Change' },
  'lighting-install': { icon: 'Lightbulb', label: 'Lighting Install' },
  'outlet-switch': { icon: 'ToggleRight', label: 'Outlet/Switch Work' },
  'troubleshoot': { icon: 'Search', label: 'Troubleshoot' },
  'custom': { icon: 'Wrench', label: 'Custom' },
}
