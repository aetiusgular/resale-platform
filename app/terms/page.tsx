import LegalDoc from '@/app/components/legal-doc'
import { TERMS_HTML } from './content'

/**
 * /terms — public Terms of Service (DRAFT until counsel signs off; the on-page banner
 * says so). Source of truth: docs/legal/TERMS_OF_SERVICE.md → scripts/generate-legal.mjs.
 */
export const metadata = { title: 'Terms of Service', alternates: { canonical: '/terms' } }

export default function TermsPage() {
  return <LegalDoc kicker="LEGAL / TERMS" title="Terms of service" note="DRAFT — ATTORNEY REVIEW PENDING" html={TERMS_HTML} />
}
