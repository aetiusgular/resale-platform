import { describe, it, expect } from 'vitest'
import {
  breadcrumbJsonLd,
  centsToPrice,
  jsonLdString,
  metaDescription,
  productJsonLd,
  schemaCondition,
  schemaImages,
} from '../../lib/seo-listing'

const POSSESSION = 'https://cdn.example/possession.jpg'

const baseListing = {
  id: '11111111-2222-3333-4444-555555555555',
  title: 'Archive bomber',
  brand: 'Raf Simons',
  category: 'Outerwear',
  department: 'menswear',
  size: '48',
  description: '',
  condition_score: 8,
  price_cents: 123456,
  shipping_cents: 1450,
  images: ['front.jpg', 'back.jpg', '', 'detail.jpg', '', POSSESSION],
  sellerUsername: 'tony',
}

describe('schemaCondition', () => {
  it('maps 10 (new with tags) to NewCondition', () => {
    expect(schemaCondition(10)).toBe('https://schema.org/NewCondition')
  })
  it('maps 9 (new without tags) and below to UsedCondition', () => {
    expect(schemaCondition(9)).toBe('https://schema.org/UsedCondition')
    expect(schemaCondition(5)).toBe('https://schema.org/UsedCondition')
    expect(schemaCondition(1)).toBe('https://schema.org/UsedCondition')
  })
})

describe('schemaImages', () => {
  it('passes the ordered photo list through, up to 15, cover first', () => {
    const photos = Array.from({ length: 15 }, (_, i) => `p${i + 1}.jpg`)
    expect(schemaImages(photos)).toEqual(photos)
    expect(schemaImages([...photos, 'p16.jpg'])).toEqual(photos)
    expect(schemaImages(['a.jpg', 'a.jpg', 'b.jpg'])).toEqual(['a.jpg', 'b.jpg'])
  })
  it('never includes the possession proof it is told about', () => {
    const out = schemaImages(['front.jpg', POSSESSION, 'back.jpg'], POSSESSION)
    expect(out).toEqual(['front.jpg', 'back.jpg'])
  })
  it('legacy six-slot rows: drops empty slots and NEVER includes index 5 (possession proof)', () => {
    const out = schemaImages(baseListing.images)
    expect(out).toEqual(['front.jpg', 'back.jpg', 'detail.jpg'])
    expect(out).not.toContain(POSSESSION)
  })
  it('legacy six-slot rows: excludes index 5 when all six slots are filled and the proof is known', () => {
    const out = schemaImages(['f', 'b', 't', 'd', 'fl', POSSESSION], POSSESSION)
    expect(out).toEqual(['f', 'b', 't', 'd', 'fl'])
  })
  it('returns [] for non-arrays', () => {
    expect(schemaImages(null)).toEqual([])
    expect(schemaImages('nope')).toEqual([])
  })
})

describe('centsToPrice', () => {
  it('formats cents as a schema price string', () => {
    expect(centsToPrice(123456)).toBe('1234.56')
    expect(centsToPrice(5000)).toBe('50.00')
    expect(centsToPrice(99)).toBe('0.99')
  })
})

describe('metaDescription', () => {
  it('uses a structured fallback when the description is empty', () => {
    const d = metaDescription(baseListing)
    expect(d).toContain('Archive bomber')
    expect(d).toContain('Raf Simons')
    expect(d).toContain('48')
    expect(d).toContain('$1,234.56')
  })
  it('passes short descriptions through with whitespace collapsed', () => {
    const d = metaDescription({ ...baseListing, description: 'Great  piece,\n barely worn.' })
    expect(d).toBe('Great piece, barely worn.')
  })
  it('truncates long descriptions to ≤160 chars on a word boundary with an ellipsis', () => {
    const long = 'word '.repeat(60).trim()
    const d = metaDescription({ ...baseListing, description: long })
    expect(d.length).toBeLessThanOrEqual(160)
    expect(d.endsWith('…')).toBe(true)
    expect(long.startsWith(d.slice(0, -1))).toBe(true)
  })
})

describe('jsonLdString', () => {
  it('escapes < so user content can never terminate the script block', () => {
    const out = jsonLdString({ name: '</script><script>alert(1)</script>' })
    expect(out).not.toContain('<')
    expect(out).toContain('\\u003c')
    expect(JSON.parse(out).name).toBe('</script><script>alert(1)</script>')
  })
})

type ProductShape = {
  ['@type']: string
  name: string
  sku: string
  brand: unknown
  itemCondition: string
  image: string[]
  hasMerchantReturnPolicy?: unknown
  offers: {
    price: string
    priceCurrency: string
    availability: string
    seller?: unknown
    hasMerchantReturnPolicy?: unknown
    shippingDetails?: { shippingRate: { value: string } }
  }
}

describe('productJsonLd', () => {
  const p = productJsonLd(baseListing) as ProductShape
  it('emits required merchant-listing fields', () => {
    expect(p['@type']).toBe('Product')
    expect(p.name).toBe('Archive bomber')
    expect(p.sku).toBe(baseListing.id)
    expect(p.brand).toEqual({ '@type': 'Brand', name: 'Raf Simons' })
    expect(p.offers.price).toBe('1234.56')
    expect(p.offers.priceCurrency).toBe('USD')
    expect(p.offers.availability).toBe('https://schema.org/InStock')
  })
  it('maps condition and excludes the possession photo', () => {
    expect(p.itemCondition).toBe('https://schema.org/UsedCondition')
    expect(p.image).not.toContain(POSSESSION)
    expect(p.image).toEqual(['front.jpg', 'back.jpg', 'detail.jpg'])
  })
  it('carries seller + shippingDetails, and never a return policy', () => {
    expect(p.offers.seller).toEqual({ '@type': 'Person', name: 'tony' })
    expect(p.offers.shippingDetails?.shippingRate.value).toBe('14.50')
    expect(p.offers.hasMerchantReturnPolicy).toBeUndefined()
    expect(p.hasMerchantReturnPolicy).toBeUndefined()
  })
  it('omits seller and shippingDetails when unknown', () => {
    const bare = productJsonLd({ ...baseListing, sellerUsername: null, shipping_cents: null }) as ProductShape
    expect(bare.offers.seller).toBeUndefined()
    expect(bare.offers.shippingDetails).toBeUndefined()
  })
})

describe('breadcrumbJsonLd', () => {
  const b = breadcrumbJsonLd(baseListing) as { itemListElement: Array<{ name: string; item?: string }> }
  it('builds Browse › Department › Category › title', () => {
    expect(b.itemListElement).toHaveLength(4)
    expect(b.itemListElement[0].name).toBe('Browse')
    expect(b.itemListElement[1].name).toBe('Menswear')
    expect(b.itemListElement[1].item).toContain('/browse?dept=menswear')
    expect(b.itemListElement[2].item).toContain('cat=Outerwear')
    expect(b.itemListElement[3].name).toBe('Archive bomber')
    expect(b.itemListElement[3].item).toBeUndefined()
  })
})
