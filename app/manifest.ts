import type { MetadataRoute } from 'next'
import { SITE_NAME, SITE_TAGLINE } from '@/lib/seo'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: SITE_NAME,
    description: SITE_TAGLINE,
    start_url: '/browse',
    display: 'standalone',
    background_color: '#f5f5f3',
    theme_color: '#f5f5f3',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png' },
    ],
  }
}
