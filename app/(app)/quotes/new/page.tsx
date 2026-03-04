'use client'

import { useState, useCallback, useMemo, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowLeft, X, Plus, Send, Save, Sparkles,
  Zap, Lightbulb, Plug, Cable, BatteryCharging,
  Hammer, Search, Wrench, Power, LayoutGrid, ToggleRight,
  ClipboardCheck, ShieldAlert, BookOpen, Calendar, ChevronDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency, generateId } from '@/lib/format'
import { useCustomers } from '@/hooks/use-customers'
import { useUser } from '@/hooks/use-user'
import { createClient } from '@/lib/supabase/client'
import type { JobTemplate, JobTemplateItem } from '@/lib/types'
import { toast } from 'sonner'

const iconMap: Record<string, React.ElementType> = {
  Zap, Lightbulb, Plug, Cable, BatteryCharging, Hammer, Search, Wrench, Power, LayoutGrid, ToggleRight,
}

interface LocalLineItem {
  id: string
  description: string
  category: string
  quantity: number
  unit: string
  rate: number
  is_template_item: boolean
}

export default function NewQuotePage() {
  const router = useRouter()
  const { customers, loading: customersLoading, setSearch, addCustomer, updateCustomer } = useCustomers()
  const { profile } = useUser()
  const supabase = createClient()

  // Templates from DB
  const [templates, setTemplates] = useState<(JobTemplate & { items: JobTemplateItem[] })[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(true)

  useEffect(() => {
    async function fetchTemplates() {
      const { data: tpls } = await supabase
        .from('job_templates')
        .select('*, items:job_template_items(*)')
        .order('sort_order')
      if (tpls) setTemplates(tpls as (JobTemplate & { items: JobTemplateItem[] })[])
      setTemplatesLoading(false)
    }
    fetchTemplates()
  }, [supabase])

  // Customer state
  const [customerSearch, setCustomerSearch] = useState('')
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
  const [showNewCustomer, setShowNewCustomer] = useState(false)
  const [newCustomer, setNewCustomer] = useState({
    name: '', phone: '', email: '', address: '',
    province: 'AB', square_footage: '', panel_size: '', service_amps: '',
  })
  const [showDropdown, setShowDropdown] = useState(false)

  // Job state
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [scopeNotes, setScopeNotes] = useState('')

  // Line items
  const [lineItems, setLineItems] = useState<LocalLineItem[]>([])

  // Settings
  const [autoFollowUp, setAutoFollowUp] = useState(true)
  const [followUpDays, setFollowUpDays] = useState(3)
  const [customerNote, setCustomerNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [inspectionNotes, setInspectionNotes] = useState<string[]>([])
  const [safetyNotes, setSafetyNotes] = useState<string[]>([])
  const [technicalNotes, setTechnicalNotes] = useState<string[]>([])

  useEffect(() => {
    setSearch(customerSearch)
  }, [customerSearch, setSearch])

  // Pending jobs for the selected customer (unlinked to any quote)
  // Used to offer linking in the AI receptionist path (job exists before quote)
  const [pendingJobs, setPendingJobs] = useState<Array<{ id: string; job_type: string; scheduled_date: string }>>([])
  const [linkedJobId, setLinkedJobId] = useState<string | null>(null)

  // Customer expand/edit
  const [customerExpanded, setCustomerExpanded] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<{
    name: string; phone: string; email: string; address: string; city: string;
    province: string; square_footage: string; panel_size: string; service_amps: string;
  } | null>(null)
  const [savingCustomer, setSavingCustomer] = useState(false)

  useEffect(() => {
    if (!selectedCustomerId) {
      setPendingJobs([])
      setLinkedJobId(null)
      return
    }
    setLinkedJobId(null)
    fetch(`/api/jobs?customer_id=${selectedCustomerId}&unlinked=true&limit=5`)
      .then(r => r.ok ? r.json() : { jobs: [] })
      .then(d => {
        const open = (d.jobs ?? []).filter((j: { status: string }) => j.status !== 'completed')
        setPendingJobs(open)
        if (open.length === 1) setLinkedJobId(open[0].id)
      })
      .catch(() => {})
  }, [selectedCustomerId])

  // Seed editable fields whenever selected customer changes
  useEffect(() => {
    if (selectedCustomer) {
      setEditingCustomer({
        name: selectedCustomer.name ?? '',
        phone: selectedCustomer.phone ?? '',
        email: selectedCustomer.email ?? '',
        address: selectedCustomer.address ?? '',
        city: selectedCustomer.city ?? '',
        province: selectedCustomer.province ?? 'AB',
        square_footage: selectedCustomer.square_footage ? String(selectedCustomer.square_footage) : '',
        panel_size: selectedCustomer.panel_size ?? '',
        service_amps: selectedCustomer.service_amps ?? '',
      })
    } else {
      setEditingCustomer(null)
      setCustomerExpanded(false)
    }
  }, [selectedCustomerId]) // eslint-disable-line react-hooks/exhaustive-deps

  const saveCustomerEdit = useCallback(async () => {
    if (!selectedCustomerId || !editingCustomer) return
    setSavingCustomer(true)
    const { error } = await updateCustomer(selectedCustomerId, {
      name: editingCustomer.name,
      phone: editingCustomer.phone || null,
      email: editingCustomer.email || null,
      address: editingCustomer.address || null,
      city: editingCustomer.city || null,
      province: editingCustomer.province || null,
      square_footage: editingCustomer.square_footage ? parseInt(editingCustomer.square_footage) : null,
      panel_size: editingCustomer.panel_size || null,
      service_amps: editingCustomer.service_amps || null,
    })
    setSavingCustomer(false)
    if (error) {
      toast.error('Failed to update customer')
    } else {
      toast.success('Customer updated')
      setCustomerExpanded(false)
    }
  }, [selectedCustomerId, editingCustomer, updateCustomer])

  const filteredCustomers = customers.slice(0, 5)

  const selectedCustomer = selectedCustomerId ? customers.find(c => c.id === selectedCustomerId) : null

  // Receptionist services that don't already match a global template — show as extra job type options
  const extraServices = useMemo(() => {
    const templateNames = new Set(templates.map(t => t.name.toLowerCase()))
    return (profile?.receptionist_services ?? []).filter(
      s => !templateNames.has(s.name.toLowerCase())
    )
  }, [templates, profile?.receptionist_services])

  const [customJobType, setCustomJobType] = useState<string | null>(null)

  const selectTemplate = useCallback((template: JobTemplate & { items: JobTemplateItem[] }) => {
    setSelectedTemplateId(template.id)
    setCustomJobType(null)
    setLineItems(template.items.map(item => ({
      id: generateId(),
      description: item.description,
      category: item.category,
      quantity: item.default_qty,
      unit: item.unit,
      rate: item.price_range_low ?? 0,
      is_template_item: true,
    })))
  }, [])

  const selectService = useCallback((serviceName: string) => {
    setSelectedTemplateId(null)
    setCustomJobType(serviceName)
    setLineItems([])
  }, [])

  const updateLineItem = useCallback((id: string, field: keyof LocalLineItem, value: string | number) => {
    setLineItems(prev => prev.map(li => li.id === id ? { ...li, [field]: value } : li))
  }, [])

  const removeLineItem = useCallback((id: string) => {
    setLineItems(prev => prev.filter(li => li.id !== id))
  }, [])

  const addLineItem = useCallback(() => {
    setLineItems(prev => [...prev, {
      id: generateId(),
      description: '',
      category: 'material',
      quantity: 1,
      unit: 'ea',
      rate: 0,
      is_template_item: false,
    }])
  }, [])

  const enhanceWithAI = useCallback(async () => {
    const selectedTpl = selectedTemplateId ? templates.find(t => t.id === selectedTemplateId) : null
    const jobType = selectedTpl?.slug ?? customJobType ?? 'custom'
    setAiLoading(true)
    setInspectionNotes([])
    setSafetyNotes([])
    setTechnicalNotes([])

    // Gather customer info from selected customer or new customer form
    const cust = selectedCustomer
    const customerInfo = cust
      ? {
          customer_name: cust.name,
          address: cust.address || '',
          province: cust.province || 'AB',
          square_footage: cust.square_footage || null,
          panel_size: cust.panel_size || '',
          service_amps: cust.service_amps || '',
        }
      : {
          customer_name: newCustomer.name || '',
          address: newCustomer.address || '',
          province: newCustomer.province || 'AB',
          square_footage: newCustomer.square_footage ? parseInt(newCustomer.square_footage) : null,
          panel_size: newCustomer.panel_size || '',
          service_amps: newCustomer.service_amps || '',
        }

    try {
      const res = await fetch('/api/quotes/enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_type: jobType,
          scope_notes: scopeNotes,
          ...customerInfo,
        }),
      })

      if (!res.ok) {
        toast.error('AI suggestions unavailable right now')
        return
      }

      const data = await res.json()

      // Replace line items with AI suggestions (filter out labor/tax — frontend handles those)
      if (data.suggested_items?.length) {
        const newItems: LocalLineItem[] = data.suggested_items
          .filter((item: Record<string, unknown>) => {
            const cat = ((item.category as string) || '').toLowerCase()
            return cat !== 'labor' && cat !== 'tax'
          })
          .map((item: Record<string, unknown>) => ({
            id: generateId(),
            description: (item.description as string) || (item.name as string) || '',
            category: (item.category as string) || 'material',
            quantity: Number(item.quantity) || 1,
            unit: (item.unit as string) || 'ea',
            rate: Number(item.rate) ?? Number(item.unit_cost) ?? 0,
            is_template_item: false,
          }))
        setLineItems(newItems)
      }

      // Show code compliance notes by category
      if (data.inspection_notes?.length) setInspectionNotes(data.inspection_notes)
      if (data.safety_notes?.length) setSafetyNotes(data.safety_notes)
      if (data.technical_notes?.length) setTechnicalNotes(data.technical_notes)

      toast.success(`AI generated ${data.suggested_items?.length ?? 0} line items`)
    } catch {
      toast.error('AI suggestions unavailable right now')
    } finally {
      setAiLoading(false)
    }
  }, [selectedTemplateId, templates, scopeNotes, selectedCustomer, newCustomer])

  const subtotal = lineItems.reduce((sum, li) => sum + (li.quantity * li.rate), 0)
  const taxRate = (profile?.default_tax_rate as number | null) ?? 0.05
  const taxAmount = subtotal * taxRate
  const total = subtotal + taxAmount

  const customerHasEmail = selectedCustomer?.email || (showNewCustomer && newCustomer.email)

  const saveQuote = async (status: 'draft' | 'sent') => {
    if (status === 'sent' && !customerHasEmail) {
      toast.error('Customer needs an email address before you can send a quote.')
      return
    }

    setSaving(true)

    let customerId = selectedCustomerId

    // Create new customer if needed
    if (!customerId && showNewCustomer && newCustomer.name) {
      const created = await addCustomer({
        name: newCustomer.name,
        phone: newCustomer.phone || null,
        email: newCustomer.email || null,
        address: newCustomer.address || null,
        city: null,
        province: newCustomer.province || null,
        square_footage: newCustomer.square_footage ? parseInt(newCustomer.square_footage) : null,
        property_notes: null,
        panel_size: newCustomer.panel_size || null,
        service_amps: newCustomer.service_amps || null,
      })
      if (created) {
        customerId = created.id
      } else {
        toast.error('Failed to create customer')
        setSaving(false)
        return
      }
    }

    if (!customerId) {
      toast.error('Please select or add a customer')
      setSaving(false)
      return
    }

    const selectedTpl = selectedTemplateId ? templates.find(t => t.id === selectedTemplateId) : null

    const res = await fetch('/api/quotes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_id: customerId,
        status,
        job_type: selectedTpl?.name ?? customJobType ?? 'Custom',
        scope_notes: scopeNotes || null,
        subtotal,
        auto_follow_up: autoFollowUp,
        follow_up_days: followUpDays,
        customer_note: customerNote || null,
        ...(linkedJobId ? { job_id: linkedJobId } : {}),
        code_notes: (inspectionNotes.length || safetyNotes.length || technicalNotes.length)
          ? { inspection: inspectionNotes, safety: safetyNotes, technical: technicalNotes }
          : null,
        line_items: lineItems.map(li => ({
          description: li.description,
          category: li.category,
          quantity: li.quantity,
          unit: li.unit,
          rate: li.rate,
          is_template_item: li.is_template_item,
        })),
      }),
    })

    if (!res.ok) {
      toast.error('Failed to save quote')
      setSaving(false)
      return
    }

    const quote = await res.json()

    if (status === 'sent') {
      const sendRes = await fetch('/api/quotes/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quoteId: quote.id }),
      })
      if (!sendRes.ok) {
        const err = await sendRes.json().catch(() => ({ error: 'Send failed' }))
        toast.error(err.error || 'Failed to send quote')
        router.push(`/quotes/${quote.id}`)
        return
      }
      const customerName = selectedCustomer?.name || newCustomer.name || 'Customer'
      toast(`Quote sent to ${customerName} \u00B7 ${formatCurrency(total)}`)
    } else {
      toast('Quote saved as draft')
    }

    setSaving(false)
    router.push('/quotes')
  }

  return (
    <div className="px-4 md:px-6 py-4 md:py-6">
      {/* Pre-select customer and job type from URL params (e.g. from jobs kanban) */}
      <Suspense fallback={null}>
        <QueryPreselect
          customers={customers}
          customersLoading={customersLoading}
          selectedCustomerId={selectedCustomerId}
          onSelectCustomer={setSelectedCustomerId}
          templates={templates}
          templatesLoading={templatesLoading}
          onSelectTemplate={selectTemplate}
          onSelectService={selectService}
          extraServices={extraServices}
        />
      </Suspense>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push('/quotes')}
          className="btn-press flex items-center justify-center w-7 h-7 rounded-[4px] text-sf-text-secondary hover:bg-sf-surface-2 hover:text-sf-text-primary transition-colors duration-120"
          aria-label="Back to quotes"
        >
          <ArrowLeft size={16} strokeWidth={1.5} />
        </button>
        <h1 className="font-heading text-[18px] font-semibold tracking-tight text-sf-text-primary">
          New Quote
        </h1>
      </div>

      <div className="flex flex-col gap-6">
        {/* Section 1: Customer */}
        <section>
          <SectionLabel>Customer</SectionLabel>
          {!selectedCustomer && !showNewCustomer ? (
            <div className="relative">
              <input
                type="text"
                placeholder={customersLoading ? 'Loading customers...' : 'Search customers...'}
                value={customerSearch}
                onChange={(e) => { setCustomerSearch(e.target.value); setShowDropdown(true) }}
                onFocus={() => setShowDropdown(true)}
                className="w-full h-9 px-3 bg-sf-surface-2 border border-sf-border rounded-[4px] text-[14px] text-sf-text-primary placeholder:text-sf-text-tertiary focus:outline-none focus:ring-1 focus:ring-sf-accent"
              />
              {showDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-sf-surface-1 border border-sf-border rounded-[4px] z-10 max-h-48 overflow-y-auto">
                  {filteredCustomers.map(c => (
                    <button
                      key={c.id}
                      onClick={() => { setSelectedCustomerId(c.id); setShowDropdown(false); setCustomerSearch('') }}
                      className="w-full text-left px-3 py-2 hover:bg-sf-surface-2 transition-colors duration-120"
                    >
                      <div className="text-[13px] font-medium text-sf-text-primary">{c.name}</div>
                      <div className="text-[11px] text-sf-text-tertiary">{c.address ?? c.city ?? ''}</div>
                    </button>
                  ))}
                  <button
                    onClick={() => { setShowNewCustomer(true); setShowDropdown(false) }}
                    className="w-full text-left px-3 py-2 border-t border-sf-border hover:bg-sf-surface-2 transition-colors duration-120"
                  >
                    <div className="text-[13px] font-medium text-sf-accent flex items-center gap-1">
                      <Plus size={12} strokeWidth={2} /> New customer
                    </div>
                  </button>
                </div>
              )}
            </div>
          ) : showNewCustomer ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <InputField placeholder="Full name" value={newCustomer.name} onChange={v => setNewCustomer(p => ({ ...p, name: v }))} />
              <InputField placeholder="Phone" value={newCustomer.phone} onChange={v => setNewCustomer(p => ({ ...p, phone: v }))} />
              <InputField placeholder="Email" value={newCustomer.email} onChange={v => setNewCustomer(p => ({ ...p, email: v }))} />
              <InputField placeholder="Address" value={newCustomer.address} onChange={v => setNewCustomer(p => ({ ...p, address: v }))} />
              <select
                value={newCustomer.province}
                onChange={e => setNewCustomer(p => ({ ...p, province: e.target.value }))}
                className="h-9 px-3 bg-sf-surface-2 border border-sf-border rounded-[4px] text-[13px] text-sf-text-primary focus:outline-none focus:ring-1 focus:ring-sf-accent"
              >
                <option value="AB">Alberta</option>
                <option value="BC">British Columbia</option>
                <option value="MB">Manitoba</option>
                <option value="NB">New Brunswick</option>
                <option value="NL">Newfoundland</option>
                <option value="NS">Nova Scotia</option>
                <option value="NT">Northwest Territories</option>
                <option value="NU">Nunavut</option>
                <option value="ON">Ontario</option>
                <option value="PE">Prince Edward Island</option>
                <option value="QC">Quebec</option>
                <option value="SK">Saskatchewan</option>
                <option value="YT">Yukon</option>
              </select>
              <InputField placeholder="Sq ft (e.g. 1800)" value={newCustomer.square_footage} onChange={v => setNewCustomer(p => ({ ...p, square_footage: v }))} />
              <InputField placeholder="Current panel size (e.g. 100A)" value={newCustomer.panel_size} onChange={v => setNewCustomer(p => ({ ...p, panel_size: v }))} />
              <InputField placeholder="Service amps (e.g. 200A)" value={newCustomer.service_amps} onChange={v => setNewCustomer(p => ({ ...p, service_amps: v }))} />
            </div>
          ) : (
            <div className="bg-sf-surface-1 border border-sf-border rounded-[4px] overflow-hidden">
              {/* Header row */}
              <div className="flex items-center justify-between px-3 py-2">
                <button
                  onClick={() => setCustomerExpanded(p => !p)}
                  className="flex-1 flex items-center gap-2 text-left min-w-0"
                >
                  <ChevronDown
                    size={14}
                    strokeWidth={1.5}
                    className={cn('text-sf-text-tertiary transition-transform duration-150 shrink-0', customerExpanded && 'rotate-180')}
                  />
                  <div className="min-w-0">
                    <div className="text-[14px] font-semibold text-sf-text-primary">{selectedCustomer!.name}</div>
                    {!customerExpanded && (
                      <div className="text-[12px] text-sf-text-secondary">{selectedCustomer!.address ?? ''}</div>
                    )}
                  </div>
                </button>
                <button
                  onClick={() => { setSelectedCustomerId(null); setCustomerSearch(''); setCustomerExpanded(false) }}
                  className="text-sf-text-tertiary hover:text-sf-text-secondary ml-2 shrink-0"
                  aria-label="Remove customer"
                >
                  <X size={14} strokeWidth={1.5} />
                </button>
              </div>
              {/* Expanded edit form */}
              {customerExpanded && editingCustomer && (
                <div className="border-t border-sf-border px-3 pb-3 pt-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <InputField placeholder="Full name" value={editingCustomer.name} onChange={v => setEditingCustomer(p => p ? { ...p, name: v } : p)} />
                    <InputField placeholder="Phone" value={editingCustomer.phone} onChange={v => setEditingCustomer(p => p ? { ...p, phone: v } : p)} />
                    <InputField placeholder="Email" value={editingCustomer.email} onChange={v => setEditingCustomer(p => p ? { ...p, email: v } : p)} />
                    <InputField placeholder="Address" value={editingCustomer.address} onChange={v => setEditingCustomer(p => p ? { ...p, address: v } : p)} />
                    <InputField placeholder="City" value={editingCustomer.city} onChange={v => setEditingCustomer(p => p ? { ...p, city: v } : p)} />
                    <select
                      value={editingCustomer.province}
                      onChange={e => setEditingCustomer(p => p ? { ...p, province: e.target.value } : p)}
                      className="h-9 px-3 bg-sf-surface-2 border border-sf-border rounded-[4px] text-[13px] text-sf-text-primary focus:outline-none focus:ring-1 focus:ring-sf-accent"
                    >
                      <option value="AB">Alberta</option>
                      <option value="BC">British Columbia</option>
                      <option value="MB">Manitoba</option>
                      <option value="NB">New Brunswick</option>
                      <option value="NL">Newfoundland</option>
                      <option value="NS">Nova Scotia</option>
                      <option value="NT">Northwest Territories</option>
                      <option value="NU">Nunavut</option>
                      <option value="ON">Ontario</option>
                      <option value="PE">Prince Edward Island</option>
                      <option value="QC">Quebec</option>
                      <option value="SK">Saskatchewan</option>
                      <option value="YT">Yukon</option>
                    </select>
                    <InputField placeholder="Sq ft (e.g. 1800)" value={editingCustomer.square_footage} onChange={v => setEditingCustomer(p => p ? { ...p, square_footage: v } : p)} />
                    <InputField placeholder="Panel size (e.g. 100A)" value={editingCustomer.panel_size} onChange={v => setEditingCustomer(p => p ? { ...p, panel_size: v } : p)} />
                    <InputField placeholder="Service amps (e.g. 200A)" value={editingCustomer.service_amps} onChange={v => setEditingCustomer(p => p ? { ...p, service_amps: v } : p)} />
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={saveCustomerEdit}
                      disabled={savingCustomer}
                      className="btn-press h-7 px-3 rounded-[4px] bg-sf-accent hover:bg-sf-accent-hover text-white text-[12px] font-medium transition-colors duration-120 disabled:opacity-50"
                    >
                      {savingCustomer ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      onClick={() => {
                        setCustomerExpanded(false)
                        setEditingCustomer({
                          name: selectedCustomer!.name ?? '',
                          phone: selectedCustomer!.phone ?? '',
                          email: selectedCustomer!.email ?? '',
                          address: selectedCustomer!.address ?? '',
                          city: selectedCustomer!.city ?? '',
                          province: selectedCustomer!.province ?? 'AB',
                          square_footage: selectedCustomer!.square_footage ? String(selectedCustomer!.square_footage) : '',
                          panel_size: selectedCustomer!.panel_size ?? '',
                          service_amps: selectedCustomer!.service_amps ?? '',
                        })
                      }}
                      className="btn-press h-7 px-3 rounded-[4px] border border-sf-border text-[12px] font-medium text-sf-text-secondary hover:bg-sf-surface-2 hover:text-sf-text-primary transition-colors duration-120"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Link to existing scheduled job (AI receptionist path: job created before quote) */}
          {selectedCustomer && pendingJobs.length > 0 && (
            <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-sf-accent/5 border border-sf-accent/20 rounded-[4px]">
              <Calendar size={12} className="text-sf-accent shrink-0" />
              <span className="text-[12px] text-sf-text-secondary shrink-0">Link to scheduled job:</span>
              <select
                value={linkedJobId ?? ''}
                onChange={e => setLinkedJobId(e.target.value || null)}
                className="flex-1 h-6 px-2 bg-sf-surface-2 border border-sf-border rounded-[4px] text-[11px] text-sf-text-primary focus:outline-none focus:ring-1 focus:ring-sf-accent"
              >
                <option value="">None</option>
                {pendingJobs.map(j => (
                  <option key={j.id} value={j.id}>
                    {j.job_type} · {new Date(j.scheduled_date).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}
                  </option>
                ))}
              </select>
            </div>
          )}
        </section>

        {/* Section 2: Job Details */}
        <section>
          <SectionLabel>Job Type</SectionLabel>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 mb-3">
            {templatesLoading ? (
              <div className="col-span-full text-[12px] text-sf-text-tertiary">Loading templates...</div>
            ) : (
              <>
                {templates.map(tpl => {
                  const IconComponent = iconMap[tpl.icon] || Wrench
                  const isSelected = selectedTemplateId === tpl.id
                  return (
                    <button
                      key={tpl.id}
                      onClick={() => selectTemplate(tpl)}
                      className={cn(
                        'btn-press flex items-center gap-2 h-9 px-2.5 rounded-[4px] border text-[12px] font-medium transition-colors duration-120',
                        isSelected
                          ? 'border-sf-accent bg-sf-accent/10 text-sf-accent'
                          : 'border-sf-border bg-sf-surface-1 text-sf-text-secondary hover:bg-sf-surface-2 hover:text-sf-text-primary'
                      )}
                    >
                      <IconComponent size={14} strokeWidth={1.5} />
                      {tpl.name}
                    </button>
                  )
                })}
                {extraServices.map(svc => {
                  const isSelected = customJobType === svc.name
                  return (
                    <button
                      key={`svc-${svc.name}`}
                      onClick={() => selectService(svc.name)}
                      className={cn(
                        'btn-press flex items-center gap-2 h-9 px-2.5 rounded-[4px] border text-[12px] font-medium transition-colors duration-120',
                        isSelected
                          ? 'border-sf-accent bg-sf-accent/10 text-sf-accent'
                          : 'border-dashed border-sf-border bg-sf-surface-1 text-sf-text-secondary hover:bg-sf-surface-2 hover:text-sf-text-primary'
                      )}
                      title={`${svc.description} (${svc.priceRange})`}
                    >
                      <Wrench size={14} strokeWidth={1.5} />
                      {svc.name}
                    </button>
                  )
                })}
              </>
            )}
          </div>
          <textarea
            placeholder="Scope notes — e.g., Upgrade 100A to 200A, house built 1978, basement panel, need city permit"
            value={scopeNotes}
            onChange={e => setScopeNotes(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 bg-sf-surface-2 border border-sf-border rounded-[4px] text-[13px] text-sf-text-primary placeholder:text-sf-text-tertiary focus:outline-none focus:ring-1 focus:ring-sf-accent resize-none"
          />
          {/* AI Enhance Button */}
          {(selectedTemplateId || customJobType) && (
            <button
              onClick={enhanceWithAI}
              disabled={aiLoading}
              className="mt-2 btn-press inline-flex items-center gap-1.5 h-8 px-3 rounded-[4px] border border-sf-accent/30 text-[12px] font-medium text-sf-accent hover:bg-sf-accent/10 transition-colors duration-120 disabled:opacity-50"
            >
              <Sparkles size={14} strokeWidth={1.5} className={aiLoading ? 'animate-spin' : ''} />
              {aiLoading ? 'Analyzing code requirements...' : 'AI Suggest — CEC Aware'}
            </button>
          )}
          {/* Code Compliance Notes — grouped by category */}
          {(inspectionNotes.length > 0 || safetyNotes.length > 0 || technicalNotes.length > 0) && (
            <div className="mt-3 flex flex-col gap-2">
              {inspectionNotes.length > 0 && (
                <NoteGroup
                  icon={ClipboardCheck}
                  label="Inspection"
                  notes={inspectionNotes}
                  color="accent"
                />
              )}
              {safetyNotes.length > 0 && (
                <NoteGroup
                  icon={ShieldAlert}
                  label="Safety"
                  notes={safetyNotes}
                  color="warning"
                />
              )}
              {technicalNotes.length > 0 && (
                <NoteGroup
                  icon={BookOpen}
                  label="Technical / NEC"
                  notes={technicalNotes}
                  color="info"
                />
              )}
            </div>
          )}
        </section>

        {/* Section 3: Line Items */}
        <section>
          <SectionLabel>Line Items</SectionLabel>
          <div className="border border-sf-border rounded-[6px] overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-[1fr_60px_80px_80px_28px] md:grid-cols-[1fr_60px_100px_100px_28px] gap-2 px-3 py-1.5 bg-sf-surface-2 text-[11px] uppercase tracking-[0.05em] font-semibold text-sf-text-secondary">
              <span>Description</span>
              <span className="text-right">Qty</span>
              <span className="text-right">Rate</span>
              <span className="text-right">Total</span>
              <span />
            </div>
            {/* Rows */}
            {lineItems.map(li => (
              <div
                key={li.id}
                className="grid grid-cols-[1fr_60px_80px_80px_28px] md:grid-cols-[1fr_60px_100px_100px_28px] gap-2 px-3 py-1.5 border-t border-sf-border items-start"
              >
                <div className="min-w-0">
                  <input
                    type="text"
                    value={li.description}
                    onChange={e => updateLineItem(li.id, 'description', e.target.value)}
                    className="w-full bg-transparent text-[13px] text-sf-text-primary focus:outline-none"
                    placeholder="Description"
                  />
                  {li.is_template_item && (
                    <span className="text-[10px] text-sf-text-tertiary">From template</span>
                  )}
                </div>
                <input
                  type="number"
                  value={li.quantity}
                  onChange={e => updateLineItem(li.id, 'quantity', parseFloat(e.target.value) || 0)}
                  className="w-full bg-transparent text-[13px] text-sf-text-primary text-right font-mono focus:outline-none"
                  min={0}
                  step={1}
                />
                <div className="flex flex-col items-end">
                  <input
                    type="number"
                    value={li.rate}
                    onChange={e => updateLineItem(li.id, 'rate', parseFloat(e.target.value) || 0)}
                    className="w-full bg-transparent text-[13px] text-sf-text-primary text-right font-mono focus:outline-none"
                    min={0}
                    step={0.01}
                  />
                  {li.is_template_item && (
                    <span className="text-[10px] text-sf-text-tertiary">Suggested</span>
                  )}
                </div>
                <span className="text-[13px] text-sf-text-primary text-right font-mono">
                  {formatCurrency(li.quantity * li.rate)}
                </span>
                <button
                  onClick={() => removeLineItem(li.id)}
                  className="flex items-center justify-center w-6 h-6 rounded-[2px] text-sf-text-tertiary hover:text-sf-danger hover:bg-sf-surface-2 transition-colors"
                  aria-label="Remove line item"
                >
                  <X size={12} strokeWidth={1.5} />
                </button>
              </div>
            ))}
            {/* Add Row */}
            <button
              onClick={addLineItem}
              className="w-full px-3 py-2 border-t border-sf-border text-[12px] font-medium text-sf-accent hover:bg-sf-surface-2 transition-colors duration-120 text-left flex items-center gap-1"
            >
              <Plus size={12} strokeWidth={2} /> Add Line Item
            </button>
            {/* Totals */}
            <div className="border-t border-sf-border px-3 py-2">
              <div className="flex justify-end gap-8">
                <div className="text-right space-y-0.5">
                  <div className="text-[12px] text-sf-text-secondary">Subtotal:</div>
                  <div className="text-[12px] text-sf-text-secondary">Tax ({(taxRate * 100).toFixed(0)}%):</div>
                  <div className="text-[14px] font-semibold text-sf-text-primary">TOTAL:</div>
                </div>
                <div className="text-right space-y-0.5 font-mono">
                  <div className="text-[12px] text-sf-text-primary">{formatCurrency(subtotal)}</div>
                  <div className="text-[12px] text-sf-text-primary">{formatCurrency(taxAmount)}</div>
                  <div className="text-[14px] font-semibold text-sf-text-primary">{formatCurrency(total)}</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 4: Settings & Send */}
        <section>
          <SectionLabel>Settings</SectionLabel>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <ToggleSwitch checked={autoFollowUp} onChange={setAutoFollowUp} />
                <span className="text-[13px] text-sf-text-primary select-none">Auto follow-up if no response</span>
              </label>
              {autoFollowUp && (
                <select
                  value={followUpDays}
                  onChange={e => setFollowUpDays(Number(e.target.value))}
                  aria-label="Follow-up delay"
                  className="h-7 px-2 bg-sf-surface-2 border border-sf-border rounded-[4px] text-[12px] text-sf-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sf-accent"
                >
                  <option value={1}>After 1 day</option>
                  <option value={2}>After 2 days</option>
                  <option value={3}>After 3 days</option>
                  <option value={7}>After 1 week</option>
                </select>
              )}
            </div>

            <textarea
              placeholder="Note to customer (optional)…"
              aria-label="Note to customer"
              value={customerNote}
              onChange={e => setCustomerNote(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 bg-sf-surface-2 border border-sf-border rounded-[4px] text-[13px] text-sf-text-primary placeholder:text-sf-text-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sf-accent resize-none"
            />

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => saveQuote('draft')}
                disabled={saving}
                className="btn-press h-8 px-4 rounded-[4px] border border-sf-border text-[13px] font-medium text-sf-text-secondary hover:bg-sf-surface-2 hover:text-sf-text-primary transition-colors duration-120 disabled:opacity-50"
              >
                <Save size={14} strokeWidth={1.5} className="inline mr-1.5 -mt-0.5" />
                Save Draft
              </button>
              <button
                onClick={() => saveQuote('sent')}
                disabled={saving || !customerHasEmail}
                title={!customerHasEmail ? 'Add a customer email to send' : undefined}
                className="btn-press h-8 px-4 rounded-[4px] bg-sf-accent hover:bg-sf-accent-hover text-white text-[13px] font-medium transition-colors duration-120 flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send size={14} strokeWidth={1.5} />
                Send Quote
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

// Reads ?customerId= and ?jobType= from the URL and pre-selects them.
// Must be a separate component so useSearchParams() can be wrapped in <Suspense>.
function QueryPreselect({
  customers,
  customersLoading,
  selectedCustomerId,
  onSelectCustomer,
  templates,
  templatesLoading,
  onSelectTemplate,
  onSelectService,
  extraServices,
}: {
  customers: { id: string }[]
  customersLoading: boolean
  selectedCustomerId: string | null
  onSelectCustomer: (id: string) => void
  templates: (JobTemplate & { items: JobTemplateItem[] })[]
  templatesLoading: boolean
  onSelectTemplate: (tpl: JobTemplate & { items: JobTemplateItem[] }) => void
  onSelectService: (name: string) => void
  extraServices: { name: string }[]
}) {
  const searchParams = useSearchParams()
  useEffect(() => {
    const preselect = searchParams.get('customerId')
    if (preselect && !customersLoading && !selectedCustomerId) {
      const found = customers.find(c => c.id === preselect)
      if (found) onSelectCustomer(found.id)
    }
  }, [customersLoading, customers, searchParams, selectedCustomerId, onSelectCustomer])

  useEffect(() => {
    const jobType = searchParams.get('jobType')
    if (!jobType || templatesLoading) return
    // Try matching a global template first
    const tpl = templates.find(t => t.name.toLowerCase() === jobType.toLowerCase() || t.slug === jobType)
    if (tpl) { onSelectTemplate(tpl); return }
    // Then try extra services from receptionist config
    const svc = extraServices.find(s => s.name.toLowerCase() === jobType.toLowerCase())
    if (svc) { onSelectService(svc.name); return }
    // Fallback: use as custom job type directly
    onSelectService(jobType)
  }, [searchParams, templates, templatesLoading, extraServices, onSelectTemplate, onSelectService])

  return null
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] uppercase tracking-[0.05em] font-semibold text-sf-text-secondary mb-2">
      {children}
    </h2>
  )
}

function InputField({ placeholder, value, onChange }: { placeholder: string; value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="text"
      placeholder={placeholder}
      value={value}
      onChange={e => onChange(e.target.value)}
      className="h-9 px-3 bg-sf-surface-2 border border-sf-border rounded-[4px] text-[13px] text-sf-text-primary placeholder:text-sf-text-tertiary focus:outline-none focus:ring-1 focus:ring-sf-accent"
    />
  )
}

const noteStyles = {
  accent: { bg: 'bg-sf-accent/5', border: 'border-sf-accent/20', text: 'text-sf-accent', dot: 'bg-sf-accent' },
  warning: { bg: 'bg-amber-500/5', border: 'border-amber-500/20', text: 'text-amber-600', dot: 'bg-amber-500' },
  info: { bg: 'bg-sky-500/5', border: 'border-sky-500/20', text: 'text-sky-600', dot: 'bg-sky-500' },
} as const

function NoteGroup({ icon: Icon, label, notes, color }: { icon: React.ElementType; label: string; notes: string[]; color: keyof typeof noteStyles }) {
  const s = noteStyles[color]
  return (
    <div className={cn(s.bg, 'border', s.border, 'rounded-[4px] px-3 py-2')}>
      <div className={cn('flex items-center gap-1.5 text-[11px] uppercase tracking-[0.05em] font-semibold mb-1', s.text)}>
        <Icon size={12} strokeWidth={2} />
        {label}
      </div>
      <ul className="space-y-0.5">
        {notes.map((note, i) => (
          <li key={i} className="flex items-start gap-1.5 text-[12px] text-sf-text-secondary leading-relaxed">
            <span className={cn('mt-[6px] w-1 h-1 rounded-full shrink-0', s.dot)} />
            {note}
          </li>
        ))}
      </ul>
    </div>
  )
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  // Track: 40x22px (w-10 h-[22px]), knob: 16x16px, 2px inset, travel = 40-16-2-2-2(border) = 18px
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label="Toggle"
      onClick={() => onChange(!checked)}
      className={cn(
        'relative shrink-0 w-10 h-[22px] rounded-full border transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sf-accent focus-visible:ring-offset-1',
        checked ? 'bg-sf-accent border-sf-accent' : 'bg-sf-surface-2 border-sf-border'
      )}
    >
      <span
        className="block absolute top-[2px] left-[2px] w-4 h-4 rounded-full bg-white shadow-sm"
        style={{
          transform: checked ? 'translateX(18px)' : 'translateX(0)',
          transition: 'transform 150ms ease',
        }}
      />
    </button>
  )
}
