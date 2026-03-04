'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Customer } from '@/lib/types'
import type { PaginationMeta } from '@/lib/pagination'

const DEFAULT_LIMIT = 20

export function useCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [search, setSearchRaw] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [pagination, setPagination] = useState<PaginationMeta | null>(null)
  const supabase = createClient()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const setSearch = useCallback((value: string) => {
    setSearchRaw(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(value)
      setPage(1)
    }, 300)
  }, [])

  const fetchCustomers = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(DEFAULT_LIMIT) })
      if (debouncedSearch) params.set('search', debouncedSearch)
      const res = await fetch(`/api/customers?${params}`)
      if (res.ok) {
        const data = await res.json()
        setCustomers(data.customers)
        setPagination(data.pagination)
      }
    } catch {
      // Silently fail
    }
    setLoading(false)
  }, [page, debouncedSearch])

  useEffect(() => {
    fetchCustomers()
  }, [fetchCustomers])

  const addCustomer = useCallback(async (customer: Omit<Customer, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data, error } = await supabase
      .from('customers')
      .insert({ ...customer, user_id: user.id })
      .select()
      .single()

    if (!error && data) {
      await fetchCustomers()
    }
    return data
  }, [supabase, fetchCustomers])

  const updateCustomer = useCallback(async (id: string, updates: Partial<Customer>) => {
    const { data, error } = await supabase
      .from('customers')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (!error && data) {
      setCustomers(prev => prev.map(c => c.id === id ? data : c))
    }
    return { data, error }
  }, [supabase])

  return { customers, loading, page, setPage, search, setSearch, pagination, addCustomer, updateCustomer }
}
