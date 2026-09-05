import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

/**
 * Single listing fetch shared by the segment layout (404 gate), generateMetadata,
 * and the page via React cache() — one DB round-trip per request no matter how
 * many of the three ask. RLS scoping is unchanged: user client; active + sold
 * rows are public, other statuses only visible to seller/admin.
 */
export const getListing = cache(async (id: string) => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('listings')
    .select(`
      id, title, brand, category, department, subcategory, size, color, description,
      condition_score, condition_notes, measurements,
      price_cents, shipping_cents, saves_count, view_count, is_price_dropped,
      images, possession_photo_url,
      status, rejection_reason, created_at, updated_at,
      seller_id, authentication_status,
      profiles:seller_id (username, role, id_verification_status)
    `)
    .eq('id', id)
    .single()
  return data
})
