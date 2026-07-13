/**
 * Dev-only seed route: POST /api/dev/seed
 * Creates 30 varied fixture listings for browse testing.
 * Idempotent — skips listings already seeded (title starts with "[SEED]").
 * Images: solid-color + text placeholders via sharp. NO real brand photos.
 *
 * Run with: curl -X POST http://localhost:3000/api/dev/seed
 * Requires: TEST_SELLER_EMAIL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { NextResponse } from 'next/server'
import { createClient as createBrowserClient } from '@supabase/supabase-js'
import sharp from 'sharp'

// dev-only — reject in production
export const runtime = 'nodejs'

const SEED_TAG = '[SEED]'

const FIXTURES = [
  { title: `${SEED_TAG} Raw Denim Trucker Jacket`,     brand: 'FORM STUDIO',  category: 'Outerwear',   department: 'menswear',   size: 'M',     condition: 8, price: 31000 },
  { title: `${SEED_TAG} Split-Toe Derby`,               brand: 'ATELIER 9',    category: 'Footwear',    department: 'menswear',   size: 'EU 43', condition: 9, price: 64000, priceWas: 78000 },
  { title: `${SEED_TAG} Wool Overcoat`,                 brand: 'MAISON ARCHIVE', category: 'Outerwear', department: 'menswear',   size: 'L',     condition: 9, price: 124000 },
  { title: `${SEED_TAG} Garment-Dye Hoodie`,            brand: 'COLD PRESS',   category: 'Tops',        department: 'menswear',   size: 'XL',    condition: 8, price: 34000, priceWas: 42000 },
  { title: `${SEED_TAG} Pleated Trouser`,               brand: 'OBJET GREY',   category: 'Bottoms',     department: 'menswear',   size: '32',    condition: 9, price: 26500 },
  { title: `${SEED_TAG} Leather Tote`,                  brand: 'STUDIO HALDE', category: 'Accessories', department: 'womenswear', size: 'OS',    condition: 7, price: 89000 },
  { title: `${SEED_TAG} Cashmere Crewneck`,             brand: 'SECOND ROOM',  category: 'Knitwear',    department: 'womenswear', size: 'M',     condition: 9, price: 38500 },
  { title: `${SEED_TAG} Boxy Tee 3-Pack`,               brand: 'PAPER LABEL',  category: 'Tops',        department: 'unisex',     size: 'L',     condition: 10, price: 8500 },
  { title: `${SEED_TAG} Down Liner Vest`,               brand: 'NORTH TERM',   category: 'Outerwear',   department: 'menswear',   size: 'M',     condition: 8, price: 23000 },
  { title: `${SEED_TAG} Split-Hem Cargo`,               brand: 'ARCHIVE 44',   category: 'Bottoms',     department: 'menswear',   size: '30',    condition: 7, price: 19500 },
  { title: `${SEED_TAG} Mohair Cardigan`,               brand: 'GALLERY WORK', category: 'Knitwear',    department: 'womenswear', size: 'M',     condition: 8, price: 54000 },
  { title: `${SEED_TAG} Canvas Chore Coat`,             brand: 'FORM STUDIO',  category: 'Outerwear',   department: 'menswear',   size: 'XL',    condition: 9, price: 240000 },
  { title: `${SEED_TAG} Silk Slip Dress`,               brand: 'VEIL PAPER',   category: 'Tops',        department: 'womenswear', size: 'S',     condition: 9, price: 72000 },
  { title: `${SEED_TAG} Raw Edge Blazer`,               brand: 'STUDIO NULL',  category: 'Tailoring',   department: 'menswear',   size: '48',    condition: 8, price: 98000, priceWas: 120000 },
  { title: `${SEED_TAG} Linen Wide-Leg Pant`,           brand: 'DUST & LINE',  category: 'Bottoms',     department: 'womenswear', size: 'S',     condition: 9, price: 31000 },
  { title: `${SEED_TAG} Selvedge Denim 501`,            brand: 'MARGIN BLUE',  category: 'Denim',       department: 'menswear',   size: '31/32', condition: 7, price: 44000 },
  { title: `${SEED_TAG} Chelsea Boot`,                  brand: 'VESSEL CO',    category: 'Footwear',    department: 'unisex',     size: 'EU 41', condition: 8, price: 57000, priceWas: 69000 },
  { title: `${SEED_TAG} Merino Turtleneck`,             brand: 'NORTH TERM',   category: 'Knitwear',    department: 'menswear',   size: 'L',     condition: 10, price: 19500 },
  { title: `${SEED_TAG} Structured Tote`,               brand: 'FORM STUDIO',  category: 'Accessories', department: 'unisex',     size: 'OS',    condition: 9, price: 48000 },
  { title: `${SEED_TAG} Crinkle Nylon Jacket`,          brand: 'COLD PRESS',   category: 'Outerwear',   department: 'unisex',     size: 'M',     condition: 7, price: 29500 },
  { title: `${SEED_TAG} Open-Collar Shirt`,             brand: 'PAPER LABEL',  category: 'Tops',        department: 'menswear',   size: 'M',     condition: 9, price: 12500 },
  { title: `${SEED_TAG} Knit Midi Skirt`,               brand: 'VEIL PAPER',   category: 'Bottoms',     department: 'womenswear', size: 'M',     condition: 8, price: 41000 },
  { title: `${SEED_TAG} Washed Canvas Backpack`,        brand: 'ARCHIVE 44',   category: 'Accessories', department: 'unisex',     size: 'OS',    condition: 6, price: 18500, priceWas: 24000 },
  { title: `${SEED_TAG} Technical Parka`,               brand: 'MARGIN BLUE',  category: 'Outerwear',   department: 'menswear',   size: 'L',     condition: 8, price: 136000 },
  { title: `${SEED_TAG} Drawstring Trousers`,           brand: 'OBJET GREY',   category: 'Bottoms',     department: 'womenswear', size: 'S',     condition: 9, price: 28500 },
  { title: `${SEED_TAG} Asymmetric Hem Tee`,            brand: 'GALLERY WORK', category: 'Tops',        department: 'unisex',     size: 'XS',    condition: 10, price: 7500 },
  { title: `${SEED_TAG} Suede Derby Shoe`,              brand: 'VESSEL CO',    category: 'Footwear',    department: 'menswear',   size: 'EU 44', condition: 7, price: 38000, priceWas: 48000 },
  { title: `${SEED_TAG} Ribbed Tank Top`,               brand: 'PAPER LABEL',  category: 'Tops',        department: 'womenswear', size: 'XS',    condition: 10, price: 4500 },
  { title: `${SEED_TAG} Patch-Pocket Field Jacket`,    brand: 'DUST & LINE',  category: 'Outerwear',   department: 'menswear',   size: 'XL',    condition: 8, price: 52000 },
  { title: `${SEED_TAG} Lambswool Scarf`,               brand: 'SECOND ROOM',  category: 'Accessories', department: 'unisex',     size: 'OS',    condition: 9, price: 15500 },
] as const

// Distinct solid colors for each listing image
const PALETTE = [
  '#D9D4CF', '#C8BEB7', '#B5A89E', '#E8E2DC', '#A09690',
  '#C5C0BB', '#D4CEC8', '#BFBAB5', '#E0D9D3', '#9B9590',
  '#CAC4BE', '#D8D2CC', '#B8B2AC', '#E5DFD9', '#A5A09A',
  '#C0BBB5', '#CDCAC4', '#BCB6B0', '#DDD7D1', '#989390',
  '#C3BEB8', '#D1CBC5', '#BAB4AE', '#E2DBD5', '#9D9893',
  '#C7C1BB', '#D6D0CA', '#B3ADA7', '#E7E1DB', '#A2A09A',
]

async function makeImage(idx: number, label: string): Promise<Buffer> {
  const hex = PALETTE[idx % PALETTE.length]
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)

  // 400×533 (3:4 ratio), solid color with text overlay via SVG
  const short = label.slice(0, 28).toUpperCase()
  const svg = `<svg width="400" height="533" xmlns="http://www.w3.org/2000/svg">
    <rect width="400" height="533" fill="rgb(${r},${g},${b})"/>
    <text x="200" y="266" text-anchor="middle" dominant-baseline="middle"
      font-family="monospace" font-size="14" fill="rgba(0,0,0,0.35)">${short}</text>
  </svg>`

  return sharp({ create: { width: 400, height: 533, channels: 3, background: { r, g, b } } })
    .composite([{ input: Buffer.from(svg), blend: 'over' }])
    .jpeg({ quality: 80 })
    .toBuffer()
}

export async function POST(req: Request) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Seed endpoint is development-only' }, { status: 403 })
  }

  // Secondary guard: require SEED_SECRET header to prevent accidental triggers
  const seedSecret = process.env.SEED_SECRET
  if (seedSecret) {
    const provided = req.headers.get('x-seed-secret')
    if (provided !== seedSecret) {
      return NextResponse.json({ error: 'Missing or invalid x-seed-secret header' }, { status: 403 })
    }
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY!

  if (!serviceKey) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY not set' }, { status: 500 })
  }

  const supabase = createBrowserClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  // Check idempotency — skip if already seeded
  const { count: existing } = await supabase
    .from('listings')
    .select('id', { count: 'exact', head: true })
    .like('title', `${SEED_TAG}%`)

  if ((existing ?? 0) >= FIXTURES.length) {
    return NextResponse.json({ message: 'Already seeded', count: existing })
  }

  // Get test seller user id
  const sellerEmail = process.env.TEST_SELLER_EMAIL
  if (!sellerEmail) {
    return NextResponse.json({ error: 'TEST_SELLER_EMAIL not set' }, { status: 500 })
  }

  const { data: { users } } = await supabase.auth.admin.listUsers()
  const seller = users.find(u => u.email === sellerEmail)
  if (!seller) {
    return NextResponse.json({ error: `No user found for TEST_SELLER_EMAIL=${sellerEmail}` }, { status: 404 })
  }
  const sellerId = seller.id

  // Ensure storage bucket exists
  const { data: buckets } = await supabase.storage.listBuckets()
  const hasBucket = buckets?.some(b => b.name === 'listing-images')
  if (!hasBucket) {
    await supabase.storage.createBucket('listing-images', { public: true })
  }

  const results: string[] = []

  for (let i = 0; i < FIXTURES.length; i++) {
    const f = FIXTURES[i]

    // Check if this specific listing already exists
    const { count: exists } = await supabase
      .from('listings')
      .select('id', { count: 'exact', head: true })
      .eq('title', f.title)
    if ((exists ?? 0) > 0) {
      results.push(`SKIP: ${f.title}`)
      continue
    }

    // Generate and upload placeholder image
    let imageUrl = ''
    let possessionUrl = ''
    try {
      const imgBuf  = await makeImage(i, `${f.brand} · ${f.category}`)
      const possBuf = await makeImage(i + 15, `POSSESSION · ${f.brand}`)
      const imgPath  = `seed/${i}-front.jpg`
      const possPath = `seed/${i}-possession.jpg`

      await supabase.storage.from('listing-images').upload(imgPath, imgBuf, { contentType: 'image/jpeg', upsert: true })
      await supabase.storage.from('listing-images').upload(possPath, possBuf, { contentType: 'image/jpeg', upsert: true })

      const { data: imgData }  = supabase.storage.from('listing-images').getPublicUrl(imgPath)
      const { data: possData } = supabase.storage.from('listing-images').getPublicUrl(possPath)
      imageUrl     = imgData.publicUrl
      possessionUrl = possData.publicUrl
    } catch (err) {
      results.push(`IMAGE_ERROR ${f.title}: ${err}`)
    }

    // Insert listing (active — bypass review for test fixtures)
    const { data: listingData, error: insertErr } = await supabase
      .from('listings')
      .insert({
        seller_id: sellerId,
        title: f.title,
        brand: f.brand,
        category: f.category,
        department: f.department,
        size: f.size,
        description: `Seed fixture — ${f.brand} ${f.category} in ${f.size}. Condition ${f.condition}/10.`,
        condition_score: f.condition,
        condition_notes: {},
        price_cents: f.price,
        images: imageUrl ? [imageUrl] : [],
        possession_photo_url: possessionUrl || imageUrl,
        status: 'active',
      })
      .select('id')
      .single()

    if (insertErr) {
      results.push(`INSERT_ERROR ${f.title}: ${insertErr.message}`)
      continue
    }

    // If this item had a price history (was more expensive before), insert the history row
    if ('priceWas' in f && f.priceWas && listingData) {
      await supabase.from('price_history').insert({
        listing_id: listingData.id,
        old_price_cents: f.priceWas,
        new_price_cents: f.price,
      })
      // Also mark is_price_dropped = true
      await supabase.from('listings').update({ is_price_dropped: true }).eq('id', listingData.id)
    }

    results.push(`OK: ${f.title}`)
  }

  return NextResponse.json({ seeded: results.filter(r => r.startsWith('OK')).length, results })
}
