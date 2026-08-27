import type { MetadataRoute } from 'next'
import { SEO_INDEXING_ENABLED } from '@/lib/flags'
import { absUrl } from '@/lib/seo'

/**
 * Utility/private surfaces stay disallowed in BOTH modes. The tester-window
 * deindex is done via meta robots in the root layout with crawling still
 * ALLOWED (a crawler must be able to fetch pages to see the noindex —
 * disallow-all would strand URL-only index entries). Only the sitemap
 * reference is gated on SEO_INDEXING_ENABLED.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      disallow: [
        '/api/',
        '/admin/',
        '/settings',
        '/messages',
        '/checkout',
        '/orders',
        '/onboarding',
        '/saved',
        '/sell',
        '/boost',
        '/banned',
        '/reset-password',
        '/styleguide',
      ],
    },
    ...(SEO_INDEXING_ENABLED ? { sitemap: absUrl('/sitemap.xml') } : {}),
  }
}
