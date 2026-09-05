import LegalDoc from '@/app/components/legal-doc'
import { PRIVACY_HTML } from './content'

/**
 * /privacy — public Privacy Policy (DRAFT until counsel signs off; the on-page banner
 * says so). Source of truth: docs/legal/PRIVACY_POLICY.md → scripts/generate-legal.mjs.
 * CalOPPA requires this to be conspicuously linked with the word "Privacy" (see footer).
 */
export const metadata = { title: 'Privacy Policy', alternates: { canonical: '/privacy' } }

export default function PrivacyPage() {
  return <LegalDoc kicker="LEGAL / PRIVACY" title="Privacy" note="DRAFT — ATTORNEY REVIEW PENDING" html={PRIVACY_HTML} />
}
