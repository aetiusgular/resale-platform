import { Suspense } from 'react'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { formatCents } from '@/lib/fees'
import SiteHeader from '@/app/components/site-header'
import SavedClient from './saved-client'

export const metadata: Metadata = {
  title: 'Saved — Resale Platform',
  description: 'Your saved items.',
}

export type SavedListing = {
  id: string
  title: string
  brand: string
  category: string
  department: string
  size: string
  condition_score: number
  price_cents: number
  saves_count: number
  is_price_dropped: boolean
  images: string[]
  created_at: string
  status: string
  seller: { username: string; id_verification_status: string } | null
  original_price_cents: number | null
  price_display: string
  saved_at: string
  price_at_save: number | null
}

export default async function SavedPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/enter')

  // Parallel: profile + saves + saved_searches count
  const [{ data: profileData }, { data: savesData }] = await Promise.all([
    supabase.from('profiles').select('username').eq('id', user.id).single(),
    supabase
      .from('saves')
      .select(`
        listing_id, created_at,
        listings:listing_id (
          id, title, brand, category, department, size,
          condition_score, price_cents, saves_count, is_price_dropped,
          images, created_at, status,
          profiles:seller_id (username, id_verification_status)
        )
      `)
      .order('created_at', { ascending: false }),
  ])

  const username: string = (profileData?.username as string) ?? ''

  // Build listing data from saves join
  const saves = (savesData ?? []).filter(s => s.listings !== null)

  // Fetch original prices for price-dropped listings
  const droppedIds = saves
    .filter(s => {
      const l = s.listings as unknown as { is_price_dropped: boolean; status: string }
      return l.is_price_dropped && l.status === 'active'
    })
    .map(s => s.listing_id)

  const origPriceMap = new Map<string, number>()
  if (droppedIds.length > 0) {
    const { data: history } = await supabase
      .from('price_history')
      .select('listing_id, old_price_cents, changed_at')
      .in('listing_id', droppedIds)
      .order('changed_at', { ascending: true })
    for (const row of history ?? []) {
      if (!origPriceMap.has(row.listing_id)) {
        origPriceMap.set(row.listing_id, row.old_price_cents)
      }
    }
  }

  // Also get the price at save time from price_history to compute "since saved" drops
  const priceAtSaveMap = new Map<string, number>()
  for (const s of saves) {
    const l = s.listings as unknown as { id: string; price_cents: number; is_price_dropped: boolean; status: string }
    if (l.is_price_dropped && l.status === 'active') {
      // Look up what price was at save time from the original price map
      // The price at save time = original price if saved before any drops,
      // or we use original_price as proxy (user saved → then price dropped)
      const orig = origPriceMap.get(l.id)
      if (orig && orig > l.price_cents) {
        priceAtSaveMap.set(l.id, orig)
      }
    }
  }

  const savedListings: SavedListing[] = saves.map(s => {
    const l = s.listings as unknown as {
      id: string; title: string; brand: string; category: string; department: string
      size: string; condition_score: number; price_cents: number; saves_count: number
      is_price_dropped: boolean; images: string[]; created_at: string; status: string
      profiles: { username: string; id_verification_status: string } | null
    }
    return {
      id: l.id,
      title: l.title,
      brand: l.brand,
      category: l.category,
      department: l.department,
      size: l.size,
      condition_score: l.condition_score,
      price_cents: l.price_cents,
      saves_count: l.saves_count,
      is_price_dropped: l.is_price_dropped,
      images: Array.isArray(l.images) ? l.images : [],
      created_at: l.created_at,
      status: l.status,
      seller: l.profiles,
      original_price_cents: origPriceMap.get(l.id) ?? null,
      price_display: formatCents(l.price_cents),
      saved_at: s.created_at,
      price_at_save: priceAtSaveMap.get(l.id) ?? null,
    }
  })

  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh' }}>
      <SiteHeader username={username} />
      <Suspense>
        <SavedClient listings={savedListings} />
      </Suspense>
    </div>
  )
}
