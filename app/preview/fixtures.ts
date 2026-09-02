import type { BrowseListing } from '@/app/browse/page'
import { formatCents } from '@/lib/fees'

export type PreviewListing = BrowseListing & {
  description: string
  condition_notes: string
  shipping_cents: number
  seller_id: string
  status: 'active'
}

const ago = (days: number) => new Date(Date.now() - days * 86400000).toISOString()

function listing(
  partial: Omit<PreviewListing, 'price_display' | 'promoted' | 'status' | 'shipping_cents' | 'seller_id'> & {
    shipping_cents?: number
  },
): PreviewListing {
  return {
    ...partial,
    status: 'active',
    seller_id: 'preview-seller',
    shipping_cents: partial.shipping_cents ?? 1200,
    price_display: formatCents(partial.price_cents),
    promoted: false,
  }
}

export const PREVIEW_LISTINGS: PreviewListing[] = [
  listing({
    id: '11111111-1111-4111-8111-111111111111',
    title: 'Raf Simons Consumed parka',
    brand: 'Raf Simons',
    category: 'Outerwear',
    department: 'menswear',
    size: 'EU 48',
    condition_score: 8,
    price_cents: 185000,
    saves_count: 47,
    is_price_dropped: false,
    images: [],
    created_at: ago(2),
    seller: { username: 'objectdealer', id_verification_status: 'verified' },
    authentication_status: 'authenticated',
    original_price_cents: null,
    description:
      'AW03 Consumed. Rubberized cotton, original lining, no repairs. Bought from the original owner in Antwerp, 2019. Stored flat.',
    condition_notes: 'Light crease at the hem. Hardware original. No odor.',
  }),
  listing({
    id: '22222222-2222-4222-8222-222222222222',
    title: 'Helmut Lang 1998 painter denim',
    brand: 'Helmut Lang',
    category: 'Denim',
    department: 'unisex',
    size: 'W31',
    condition_score: 7,
    price_cents: 62000,
    saves_count: 7,
    is_price_dropped: true,
    images: [],
    created_at: ago(5),
    seller: { username: 'atelier', id_verification_status: 'verified' },
    authentication_status: 'pending',
    original_price_cents: 74000,
    description:
      'Classic painter cut. Fading is even. One small repair on the coin pocket, noted in the flaw photo.',
    condition_notes: 'Seat wear. Repair is period, not recent.',
  }),
  listing({
    id: '33333333-3333-4333-8333-333333333333',
    title: 'Maison Martin Margiela flat leather',
    brand: 'Maison Margiela',
    category: 'Footwear',
    department: 'menswear',
    size: 'EU 42',
    condition_score: 9,
    price_cents: 41000,
    saves_count: 4,
    is_price_dropped: false,
    images: [],
    created_at: ago(1),
    seller: { username: 'objectdealer', id_verification_status: 'verified' },
    authentication_status: 'authenticated',
    original_price_cents: null,
    description: 'Tabi-adjacent last, unmarked. Worn twice on carpet. Original box not included.',
    condition_notes: 'Sole is clean. No creasing on the vamp.',
  }),
  listing({
    id: '44444444-4444-4444-8444-444444444444',
    title: 'Comme des Garçons robe de chambre',
    brand: 'Comme des Garçons',
    category: 'Outerwear',
    department: 'womenswear',
    size: 'M',
    condition_score: 8,
    price_cents: 98000,
    saves_count: 9,
    is_price_dropped: false,
    images: [],
    created_at: ago(8),
    seller: { username: 'silentstock', id_verification_status: 'unverified' },
    authentication_status: 'pending',
    original_price_cents: null,
    description: 'Wool gabardine, 2004. Unlined. Label intact, no smell.',
    condition_notes: 'Two pinholes at the left cuff, shown.',
  }),
  listing({
    id: '55555555-5555-4555-8555-555555555555',
    title: 'Carol Christian Poell object dyed blazer',
    brand: 'Carol Christian Poell',
    category: 'Tailoring',
    department: 'menswear',
    size: 'IT 48',
    condition_score: 8,
    price_cents: 220000,
    saves_count: 18,
    is_price_dropped: false,
    images: [],
    created_at: ago(3),
    seller: { username: 'atelier', id_verification_status: 'verified' },
    authentication_status: 'authenticated',
    original_price_cents: null,
    description: 'Object-dyed cotton. Internal number matches the era. Shoulders unpadded.',
    condition_notes: 'Dye variation is original. No pulls.',
  }),
  listing({
    id: '66666666-6666-4666-8666-666666666666',
    title: 'Issey Miyake pleats scarf',
    brand: 'Issey Miyake',
    category: 'Accessories',
    department: 'unisex',
    size: 'OS',
    condition_score: 9,
    price_cents: 18000,
    saves_count: 3,
    is_price_dropped: false,
    images: [],
    created_at: ago(12),
    seller: { username: 'silentstock', id_verification_status: 'verified' },
    authentication_status: 'authenticated',
    original_price_cents: null,
    description: 'Pleats Please era scarf. Folded, never worn as a wrap.',
    condition_notes: 'No snags. Color is even.',
  }),
  listing({
    id: '77777777-7777-4777-8777-777777777777',
    title: 'Undercover scab replica tee',
    brand: 'Undercover',
    category: 'Tops',
    department: 'menswear',
    size: '3',
    condition_score: 7,
    price_cents: 34000,
    saves_count: 6,
    is_price_dropped: true,
    images: [],
    created_at: ago(15),
    seller: { username: 'objectdealer', id_verification_status: 'verified' },
    authentication_status: 'pending',
    original_price_cents: 39000,
    description: 'Reprint from the 00s run, not the original 2003. Tag photographed.',
    condition_notes: 'Collar stretch. Print is intact.',
  }),
  listing({
    id: '88888888-8888-4888-8888-888888888888',
    title: 'Ann Demeulemeester wrap boot',
    brand: 'Ann Demeulemeester',
    category: 'Footwear',
    department: 'womenswear',
    size: 'EU 38',
    condition_score: 8,
    price_cents: 52000,
    saves_count: 5,
    is_price_dropped: false,
    images: [],
    created_at: ago(4),
    seller: { username: 'atelier', id_verification_status: 'verified' },
    authentication_status: 'authenticated',
    original_price_cents: null,
    description: 'Leather wrap, original laces. Heel is straight.',
    condition_notes: 'Light scuff on the right outer. Shown.',
  }),
]

export function previewListing(id: string): PreviewListing | undefined {
  return PREVIEW_LISTINGS.find((l) => l.id === id)
}

/** Shape shared by layout / generateMetadata / PDP when using fixtures. */
export function previewListingRecord(id: string) {
  const preview = previewListing(id)
  if (!preview) return null
  return {
    ...preview,
    possession_photo_url: null as string | null,
    rejection_reason: null as string | null,
    profiles: preview.seller
      ? {
          username: preview.seller.username,
          role: 'seller',
          id_verification_status: preview.seller.id_verification_status,
        }
      : null,
  }
}

export function previewFilterCounts() {
  const departments: Record<string, number> = {}
  const categories: Record<string, number> = {}
  for (const l of PREVIEW_LISTINGS) {
    departments[l.department] = (departments[l.department] ?? 0) + 1
    categories[l.category] = (categories[l.category] ?? 0) + 1
  }
  return { departments, categories }
}
