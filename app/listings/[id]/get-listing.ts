import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

/**
 * Single listing fetch shared by the segment layout (404 gate), generateMetadata,
 * and the page via React cache() — one DB round-trip per request no matter how
 * many of the three ask. RLS scoping is unchanged: user client, non-active rows
 * only visible to seller/admin.
 */
export const getListing = cache(async (id: string) => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('listings')
    .select(`
      id, title, brand, category, size, description,
      condition_score, condition_notes,
      price_cents, saves_count, is_price_dropped,
      images, possession_photo_url,
      status, rejection_reason, created_at,
      seller_id, authentication_status,
      profiles:seller_id (username, role, id_verification_status)
    `)
    .eq('id', id)
    .single()
  return data
})
