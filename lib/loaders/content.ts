/**
 * Static content for the native apps — GET /api/content/[slug]. One copy of the legal text
 * (generated from docs/legal by scripts/generate-legal.mjs) and the FAQ; the fee schedule is
 * structured from the same constants /fees renders from, so it can never drift from checkout.
 */
import { TERMS_HTML } from '@/app/terms/content'
import { PRIVACY_HTML } from '@/app/privacy/content'
import { helpFaqs, type HelpFaq } from '@/lib/content/help'
import {
  FEE_TIERS, MIN_FEE_CENTS, SMALL_ORDER_THRESHOLD_CENTS, SMALL_ORDER_CAP_BPS, WELCOME_SALES,
  STRIPE_PCT_BPS, STRIPE_FIXED_CENTS,
} from '@/lib/fees'
import { BOOST_PACKAGES, MAX_PROMOTED_PER_PAGE } from '@/lib/boosts'
import { SHIPPING_CATEGORIES, SHIPPING_MARGIN_CENTS, floorShippingCents } from '@/lib/shipping'

export const CONTENT_SLUGS = ['terms', 'privacy', 'help', 'fees'] as const
export type ContentSlug = (typeof CONTENT_SLUGS)[number]

export type ContentDoc =
  | { slug: 'terms' | 'privacy'; kind: 'html'; title: string; html: string }
  | { slug: 'help'; kind: 'faq'; title: string; faqs: HelpFaq[] }
  | {
    slug: 'fees'; kind: 'fees'; title: string
    buyer_fee_bps: 0
    tiers: Array<{ min_volume_cents: number; min_orders: number; bps: number }>
    small_order: { threshold_cents: number; cap_bps: number }
    min_fee_cents: number
    welcome: { sales: number; processing_bps: number; processing_fixed_cents: number }
    shipping: { margin_cents: number; categories: Array<{ category: string; from_cents: number }> }
    boosts: { max_promoted_per_page: number; packages: Array<{ key: string; label: string; duration_days: number; amount_cents: number }> }
  }

export function isContentSlug(s: string): s is ContentSlug {
  return (CONTENT_SLUGS as readonly string[]).includes(s)
}

export function loadContent(slug: ContentSlug): ContentDoc {
  switch (slug) {
    case 'terms': return { slug, kind: 'html', title: 'Terms of Service', html: TERMS_HTML }
    case 'privacy': return { slug, kind: 'html', title: 'Privacy Policy', html: PRIVACY_HTML }
    case 'help': return { slug, kind: 'faq', title: 'Help & FAQ', faqs: helpFaqs() }
    case 'fees': return {
      slug, kind: 'fees', title: 'Fee schedule',
      buyer_fee_bps: 0,
      tiers: [...FEE_TIERS].reverse().map((t) => ({ min_volume_cents: t.minVolumeCents, min_orders: t.minOrders, bps: t.bps })),
      small_order: { threshold_cents: SMALL_ORDER_THRESHOLD_CENTS, cap_bps: SMALL_ORDER_CAP_BPS },
      min_fee_cents: MIN_FEE_CENTS,
      welcome: { sales: WELCOME_SALES, processing_bps: STRIPE_PCT_BPS, processing_fixed_cents: STRIPE_FIXED_CENTS },
      shipping: { margin_cents: SHIPPING_MARGIN_CENTS, categories: SHIPPING_CATEGORIES.map((c) => ({ category: c, from_cents: floorShippingCents(c) })) },
      boosts: { max_promoted_per_page: MAX_PROMOTED_PER_PAGE, packages: BOOST_PACKAGES.map((b) => ({ key: b.key, label: b.label, duration_days: b.durationDays, amount_cents: b.amountCents })) },
    }
  }
}
