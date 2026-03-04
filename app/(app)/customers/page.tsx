'use client'

import { useState } from 'react'
import { Search, MapPin, FileText, Zap, Pencil, X, Check, Users, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useCustomers } from '@/hooks/use-customers'
import { PaginationControls } from '@/components/ui/pagination-controls'
import { PageHeader } from '@/components/page-header'
import type { Customer } from '@/lib/types'

type EditForm = {
  name: string
  email: string
  phone: string
  address: string
  city: string
  province: string
  square_footage: string
  property_notes: string
  panel_size: string
  service_amps: string
}

function toForm(c: Customer): EditForm {
  return {
    name: c.name,
    email: c.email ?? '',
    phone: c.phone ?? '',
    address: c.address ?? '',
    city: c.city ?? '',
    province: c.province ?? '',
    square_footage: c.square_footage != null ? String(c.square_footage) : '',
    property_notes: c.property_notes ?? '',
    panel_size: c.panel_size ?? '',
    service_amps: c.service_amps ?? '',
  }
}

export default function CustomersPage() {
  const { customers, loading, page, setPage, search, setSearch, pagination, updateCustomer, deleteCustomer } = useCustomers()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<EditForm | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // On mobile we keep accordion expand; on desktop we drive the right panel
  const [expandedMobile, setExpandedMobile] = useState<string | null>(null)

  const selectedCustomer = customers.find(c => c.id === selectedId) ?? null

  function selectCustomer(customer: Customer) {
    setSelectedId(customer.id)
    setEditingId(null)
    setEditForm(null)
  }

  function startEdit(customer: Customer) {
    setEditingId(customer.id)
    setEditForm(toForm(customer))
  }

  function cancelEdit() {
    setEditingId(null)
    setEditForm(null)
  }

  async function saveEdit(id: string) {
    if (!editForm) return
    setSaving(true)
    await updateCustomer(id, {
      name: editForm.name.trim(),
      email: editForm.email.trim() || null,
      phone: editForm.phone.trim() || null,
      address: editForm.address.trim() || null,
      city: editForm.city.trim() || null,
      province: editForm.province.trim() || null,
      square_footage: editForm.square_footage ? Number(editForm.square_footage) : null,
      property_notes: editForm.property_notes.trim() || null,
      panel_size: editForm.panel_size.trim() || null,
      service_amps: editForm.service_amps.trim() || null,
    })
    setSaving(false)
    cancelEdit()
  }

  async function handleDelete(id: string) {
    setDeleting(true)
    const ok = await deleteCustomer(id)
    setDeleting(false)
    setConfirmDeleteId(null)
    if (ok && selectedId === id) setSelectedId(null)
  }

  function field(key: keyof EditForm, value: string) {
    setEditForm(prev => prev ? { ...prev, [key]: value } : prev)
  }

  if (loading) {
    return (
      <div className="px-4 md:px-6 py-4 md:py-6">
        <PageHeader title="Customers" />
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-12 rounded-[6px] bg-sf-surface-2 animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 md:px-6 py-4 md:py-6">
      <PageHeader title="Customers" />

      {/* Search */}
      <div className="relative mb-4">
        <Search size={14} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-sf-text-tertiary" />
        <input
          type="text"
          placeholder="Search customers, addresses..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full h-9 pl-8 pr-3 bg-sf-surface-2 border border-sf-border rounded-[4px] text-[14px] text-sf-text-primary placeholder:text-sf-text-tertiary focus:outline-none focus:ring-1 focus:ring-sf-accent"
        />
      </div>

      {/* Desktop: two-panel layout */}
      <div className="hidden lg:flex gap-0 border border-sf-border rounded-[6px] overflow-hidden min-h-[400px]">
        {/* Left panel — list */}
        <div className="w-72 xl:w-80 shrink-0 border-r border-sf-border flex flex-col">
          <div className="flex-1 overflow-y-auto">
            {customers.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 gap-2">
                <Users size={24} strokeWidth={1.5} className="text-sf-text-tertiary" />
                <p className="text-sf-text-tertiary text-[13px]">No customers found</p>
              </div>
            ) : (
              customers.map(customer => (
                <button
                  key={customer.id}
                  onClick={() => selectCustomer(customer)}
                  className={`w-full text-left px-3 py-2.5 border-b border-sf-border transition-colors duration-120 ${
                    selectedId === customer.id
                      ? 'bg-sf-accent/8 border-l-2 border-l-sf-accent'
                      : 'hover:bg-sf-surface-2'
                  }`}
                >
                  <div className="text-[13px] font-semibold text-sf-text-primary">{customer.name}</div>
                  <div className="text-[11px] text-sf-text-tertiary mt-0.5">
                    {[customer.city, customer.phone].filter(Boolean).join(' · ')}
                  </div>
                </button>
              ))
            )}
          </div>
          {pagination && pagination.totalPages > 1 && (
            <div className="border-t border-sf-border p-2">
              <PaginationControls page={page} totalPages={pagination.totalPages} onPageChange={setPage} />
            </div>
          )}
        </div>

        {/* Right panel — detail */}
        <div className="flex-1 overflow-y-auto">
          {!selectedCustomer ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-sf-text-tertiary">
              <Users size={32} strokeWidth={1.5} />
              <p className="text-[13px]">Select a customer to view details</p>
            </div>
          ) : editingId === selectedCustomer.id && editForm ? (
            <EditPanel
              editForm={editForm}
              saving={saving}
              onField={field}
              onSave={() => saveEdit(selectedCustomer.id)}
              onCancel={cancelEdit}
            />
          ) : (
            <DetailPanel
              customer={selectedCustomer}
              onEdit={() => startEdit(selectedCustomer)}
              confirmDelete={confirmDeleteId === selectedCustomer.id}
              deleting={deleting}
              onDeleteRequest={() => setConfirmDeleteId(selectedCustomer.id)}
              onDeleteConfirm={() => handleDelete(selectedCustomer.id)}
              onDeleteCancel={() => setConfirmDeleteId(null)}
            />
          )}
        </div>
      </div>

      {/* Mobile: accordion list */}
      <div className="lg:hidden flex flex-col gap-1">
        {customers.length === 0 ? (
          <p className="text-sf-text-tertiary text-[13px] py-4">No customers found</p>
        ) : (
          customers.map(customer => (
            <div key={customer.id} className="border border-sf-border rounded-[6px] bg-sf-surface-1 overflow-hidden">
              <button
                onClick={() => {
                  if (editingId === customer.id) return
                  setExpandedMobile(expandedMobile === customer.id ? null : customer.id)
                }}
                className="w-full text-left px-3 py-2.5 hover:bg-sf-surface-2 transition-colors duration-120 flex items-center justify-between"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-[14px] font-semibold text-sf-text-primary">{customer.name}</span>
                  <span className="text-[12px] text-sf-text-secondary truncate">
                    {customer.city ?? customer.phone ?? ''}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {customer.city && (
                    <span className="text-[11px] text-sf-text-tertiary flex items-center gap-0.5">
                      <MapPin size={10} strokeWidth={1.5} />
                      {customer.city}
                    </span>
                  )}
                  <span className="text-sf-text-tertiary ml-1">{expandedMobile === customer.id ? '▲' : '▼'}</span>
                </div>
              </button>

              {expandedMobile === customer.id && editingId !== customer.id && (
                <div className="border-t border-sf-border px-3 py-3">
                  <DetailPanel
                    customer={customer}
                    onEdit={() => { startEdit(customer); setEditingId(customer.id) }}
                    compact
                    confirmDelete={confirmDeleteId === customer.id}
                    deleting={deleting}
                    onDeleteRequest={() => setConfirmDeleteId(customer.id)}
                    onDeleteConfirm={() => handleDelete(customer.id)}
                    onDeleteCancel={() => setConfirmDeleteId(null)}
                  />
                </div>
              )}

              {editingId === customer.id && editForm && (
                <div className="border-t border-sf-border px-3 py-3">
                  <EditPanel
                    editForm={editForm}
                    saving={saving}
                    onField={field}
                    onSave={() => saveEdit(customer.id)}
                    onCancel={cancelEdit}
                  />
                </div>
              )}
            </div>
          ))
        )}
        {pagination && pagination.totalPages > 1 && (
          <PaginationControls page={page} totalPages={pagination.totalPages} onPageChange={setPage} className="mt-2" />
        )}
      </div>
    </div>
  )
}

// ─── Detail Panel ──────────────────────────────────────────────────────────────

function DetailPanel({
  customer,
  onEdit,
  compact,
  confirmDelete,
  deleting,
  onDeleteRequest,
  onDeleteConfirm,
  onDeleteCancel,
}: {
  customer: Customer
  onEdit: () => void
  compact?: boolean
  confirmDelete: boolean
  deleting: boolean
  onDeleteRequest: () => void
  onDeleteConfirm: () => void
  onDeleteCancel: () => void
}) {
  return (
    <div className="p-4 space-y-4">
      {/* Name */}
      {!compact && (
        <div>
          <h2 className="text-[16px] font-semibold text-sf-text-primary">{customer.name}</h2>
        </div>
      )}

      {/* Contact */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <InfoBlock label="Phone" value={customer.phone ?? '—'} />
        <InfoBlock label="Email" value={customer.email ?? '—'} />
        <InfoBlock label="Address" value={customer.address ?? '—'} />
      </div>

      {/* Location extra */}
      {(customer.city || customer.province) && (
        <div className="grid grid-cols-2 gap-3">
          {customer.city && <InfoBlock label="City" value={customer.city} />}
          {customer.province && <InfoBlock label="Province" value={customer.province} />}
        </div>
      )}

      {/* Electrical */}
      {(customer.panel_size || customer.service_amps) && (
        <div className="flex items-center gap-4 text-[12px]">
          {customer.panel_size && (
            <div className="flex items-center gap-1.5 text-sf-text-secondary">
              <Zap size={12} strokeWidth={1.5} />
              <span>Panel: {customer.panel_size}</span>
            </div>
          )}
          {customer.service_amps && (
            <div className="flex items-center gap-1.5 text-sf-text-secondary">
              <Zap size={12} strokeWidth={1.5} />
              <span>Service: {customer.service_amps}A</span>
            </div>
          )}
        </div>
      )}

      {/* Property Notes */}
      <div>
        <span className="text-[10px] uppercase tracking-[0.05em] font-semibold text-sf-text-secondary block mb-1">
          Property Notes
        </span>
        {customer.property_notes ? (
          <p className="text-[12px] text-sf-text-secondary leading-relaxed bg-sf-surface-2 rounded-[4px] px-2.5 py-2">
            {customer.property_notes}
          </p>
        ) : (
          <p className="text-[12px] text-sf-text-tertiary">No notes yet</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <Link
          href="/quotes/new"
          className="btn-press inline-flex items-center h-7 px-2.5 rounded-[4px] border border-sf-border text-[11px] font-medium text-sf-text-secondary hover:bg-sf-surface-2 transition-colors"
        >
          <FileText size={12} strokeWidth={1.5} className="mr-1" />
          New Quote
        </Link>
        <button
          onClick={onEdit}
          className="btn-press inline-flex items-center h-7 px-2.5 rounded-[4px] border border-sf-border text-[11px] font-medium text-sf-text-secondary hover:bg-sf-surface-2 transition-colors"
        >
          <Pencil size={12} strokeWidth={1.5} className="mr-1" />
          Edit
        </button>
        {!confirmDelete ? (
          <button
            onClick={onDeleteRequest}
            className="btn-press inline-flex items-center h-7 px-2.5 rounded-[4px] border border-red-300 text-[11px] font-medium text-red-500 hover:bg-red-50 transition-colors ml-auto"
          >
            <Trash2 size={12} strokeWidth={1.5} className="mr-1" />
            Delete
          </button>
        ) : (
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-[11px] text-red-500 font-medium">Delete customer and all related data?</span>
            <button
              onClick={onDeleteConfirm}
              disabled={deleting}
              className="btn-press inline-flex items-center h-7 px-2.5 rounded-[4px] bg-red-500 text-[11px] font-medium text-white disabled:opacity-50 transition-opacity"
            >
              {deleting ? 'Deleting...' : 'Confirm'}
            </button>
            <button
              onClick={onDeleteCancel}
              disabled={deleting}
              className="btn-press inline-flex items-center h-7 px-2.5 rounded-[4px] border border-sf-border text-[11px] font-medium text-sf-text-secondary hover:bg-sf-surface-2 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Edit Panel ────────────────────────────────────────────────────────────────

function EditPanel({
  editForm,
  saving,
  onField,
  onSave,
  onCancel,
}: {
  editForm: EditForm
  saving: boolean
  onField: (key: keyof EditForm, value: string) => void
  onSave: () => void
  onCancel: () => void
}) {
  return (
    <div className="p-4 space-y-4">
      {/* Contact */}
      <div>
        <p className="text-[10px] uppercase tracking-[0.05em] font-semibold text-sf-text-tertiary mb-2">Contact</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <FormField label="Name *" value={editForm.name} onChange={v => onField('name', v)} />
          <FormField label="Phone" value={editForm.phone} onChange={v => onField('phone', v)} />
          <FormField label="Email" value={editForm.email} onChange={v => onField('email', v)} type="email" />
        </div>
      </div>

      {/* Location */}
      <div>
        <p className="text-[10px] uppercase tracking-[0.05em] font-semibold text-sf-text-tertiary mb-2">Location</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="sm:col-span-2">
            <FormField label="Address" value={editForm.address} onChange={v => onField('address', v)} />
          </div>
          <FormField label="City" value={editForm.city} onChange={v => onField('city', v)} />
          <FormField label="Province / State" value={editForm.province} onChange={v => onField('province', v)} />
          <FormField label="Sq. Footage" value={editForm.square_footage} onChange={v => onField('square_footage', v)} type="number" />
        </div>
      </div>

      {/* Electrical */}
      <div>
        <p className="text-[10px] uppercase tracking-[0.05em] font-semibold text-sf-text-tertiary mb-2">Electrical</p>
        <div className="grid grid-cols-2 gap-2">
          <FormField label="Panel Size" value={editForm.panel_size} onChange={v => onField('panel_size', v)} placeholder="e.g. 200A" />
          <FormField label="Service Amps" value={editForm.service_amps} onChange={v => onField('service_amps', v)} placeholder="e.g. 200" />
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="text-[10px] uppercase tracking-[0.05em] font-semibold text-sf-text-tertiary block mb-1">
          Property Notes
        </label>
        <textarea
          value={editForm.property_notes}
          onChange={e => onField('property_notes', e.target.value)}
          rows={3}
          className="w-full px-2.5 py-2 bg-sf-surface-2 border border-sf-border rounded-[4px] text-[12px] text-sf-text-primary placeholder:text-sf-text-tertiary focus:outline-none focus:ring-1 focus:ring-sf-accent resize-none"
        />
      </div>

      {/* Save / Cancel */}
      <div className="flex items-center gap-2">
        <button
          onClick={onSave}
          disabled={saving || !editForm.name.trim()}
          className="btn-press inline-flex items-center h-7 px-2.5 rounded-[4px] bg-sf-accent text-[11px] font-medium text-white disabled:opacity-50 transition-opacity"
        >
          <Check size={12} strokeWidth={2} className="mr-1" />
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          onClick={onCancel}
          disabled={saving}
          className="btn-press inline-flex items-center h-7 px-2.5 rounded-[4px] border border-sf-border text-[11px] font-medium text-sf-text-secondary hover:bg-sf-surface-2 transition-colors"
        >
          <X size={12} strokeWidth={1.5} className="mr-1" />
          Cancel
        </button>
      </div>
    </div>
  )
}

// ─── Helper components ─────────────────────────────────────────────────────────

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-[10px] uppercase tracking-[0.05em] font-semibold text-sf-text-tertiary">{label}</span>
      <div className="text-[12px] text-sf-text-primary mt-0.5">{value}</div>
    </div>
  )
}

function FormField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
}) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-[0.05em] font-semibold text-sf-text-tertiary block mb-1">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-7 px-2.5 bg-sf-surface-2 border border-sf-border rounded-[4px] text-[12px] text-sf-text-primary placeholder:text-sf-text-tertiary focus:outline-none focus:ring-1 focus:ring-sf-accent"
      />
    </div>
  )
}
