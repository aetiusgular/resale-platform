/**
 * Pure SEO builders: listing structured data (merchant listings), site-level
 * JSON-LD, and meta text. No I/O, no Next imports — unit-testable
 * (tests/unit/seo-listing.test.ts).
 */
import { formatCents } from '@/lib/fees'
import { publicImages } from '@/lib/listings/images'
import { absUrl, baseUrl, SITE_NAME } from '@/lib/seo'

/**
 * Serialize for a <script type="application/ld+json"> block. `<` MUST be
 * escaped — titles/descriptions are user-generated; a literal `</script>`
 * must never be able to terminate the block.
 */
export function jsonLdString(data: object): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}

/**
 * Google merchant listings accept New/Refurbished/Used only. 10 = "new with
 * tags" → New; 9 ("new without tags") and below are Used by resale convention.
 */
export function schemaCondition(score: number | null | undefined): string {
  return typeof score === 'number' && score >= 10
    ? 'https://schema.org/NewCondition'
    : 'https://schema.org/UsedCondition'
}

/**
 * Public images for schema/OG: the seller's photos (lib/listings/images publicImages), never
 * the possession proof — pass the listing's possession_photo_url so it is dropped even from a
 * row the old six-slot form wrote.
 */
export function schemaImages(images: unknown, possessionUrl?: string | null): string[] {
  return publicImages(images, possessionUrl)
}

/** '12345' cents → '123.45' (schema.org price string). */
export function centsToPrice(cents: number): string {
  return (cents / 100).toFixed(2)
}

type ListingMetaInput = {
  title: string
  brand: string
  size: string
  description: string
  price_cents: number
}

/**
 * SERP snippet: the seller-written description, whitespace-collapsed and
 * trimmed to ≤160 chars on a word boundary; structured fallback when empty.
 */
export function metaDescription(l: ListingMetaInput): string {
  const d = (l.description ?? '').trim().replace(/\s+/g, ' ')
  if (!d) return `${l.title} by ${l.brand} — size ${l.size} — ${formatCents(l.price_cents)}`
  if (d.length <= 160) return d
  const cut = d.slice(0, 159)
  const lastSpace = cut.lastIndexOf(' ')
  return `${cut.slice(0, lastSpace > 80 ? lastSpace : 159).trimEnd()}…`
}

type ProductListingInput = ListingMetaInput & {
  id: string
  category: string
  department: string
  condition_score: number | null
  shipping_cents: number | null
  images: unknown
  possession_photo_url?: string | null
  sellerUsername: string | null
}

/**
 * schema.org Product for the merchant-listing experience (price/condition/
 * availability rich results + Shopping-tab eligibility).
 * - availability is always InStock this phase: public listing pages only ever
 *   render status='active' (sold → 404). The SoldOut branch lands with the
 *   public sold archive (SEO2, with HF7).
 * - No hasMerchantReturnPolicy: ToS attorney review pending — do not encode
 *   return terms in schema until reviewed. No GTIN (one-of-a-kind used goods).
 */
export function productJsonLd(l: ProductListingInput): object {
  const url = absUrl(`/listings/${l.id}`)
  const offer: Record<string, unknown> = {
    '@type': 'Offer',
    url,
    price: centsToPrice(l.price_cents),
    priceCurrency: 'USD',
    availability: 'https://schema.org/InStock',
    itemCondition: schemaCondition(l.condition_score),
  }
  if (l.sellerUsername) {
    offer.seller = { '@type': 'Person', name: l.sellerUsername }
  }
  if (typeof l.shipping_cents === 'number' && l.shipping_cents >= 0) {
    offer.shippingDetails = {
      '@type': 'OfferShippingDetails',
      shippingRate: {
        '@type': 'MonetaryAmount',
        value: centsToPrice(l.shipping_cents),
        currency: 'USD',
      },
      shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'US' },
    }
  }
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: l.title,
    description: metaDescription(l),
    image: schemaImages(l.images, l.possession_photo_url),
    sku: l.id,
    brand: { '@type': 'Brand', name: l.brand },
    category: `${l.department} > ${l.category}`,
    size: l.size,
    itemCondition: schemaCondition(l.condition_score),
    offers: offer,
  }
}

function titleCase(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

/** Browse › Department › Category › item (last element carries no URL). */
export function breadcrumbJsonLd(l: { title: string; department: string; category: string }): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Browse', item: absUrl('/browse') },
      {
        '@type': 'ListItem',
        position: 2,
        name: titleCase(l.department),
        item: absUrl(`/browse?dept=${encodeURIComponent(l.department)}`),
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: l.category,
        item: absUrl(`/browse?dept=${encodeURIComponent(l.department)}&cat=${encodeURIComponent(l.category)}`),
      },
      { '@type': 'ListItem', position: 4, name: l.title },
    ],
  }
}

/** Site-level blocks for the effective homepage (/browse — / redirects there). */
export function webSiteJsonLd(): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: baseUrl(),
  }
}

export function organizationJsonLd(): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: baseUrl(),
    logo: absUrl('/apple-icon'),
  }
}

export function profilePageJsonLd(username: string): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    mainEntity: {
      '@type': 'Person',
      name: username,
      alternateName: `@${username}`,
      url: absUrl(`/sellers/${username}`),
    },
  }
}
