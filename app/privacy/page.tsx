import LegalDoc from '@/app/components/legal-doc'
import { PRIVACY_HTML } from './content'

/**
 * /privacy — public Privacy Policy (DRAFT until counsel signs off; the on-page banner
 * says so). Source of truth: docs/legal/PRIVACY_POLICY.md → scripts/generate-legal.mjs.
 * CalOPPA requires this to be conspicuously linked with the word "Privacy" (see /enter footer).
 */
export const metadata = { title: 'Privacy Policy' }

export default function PrivacyPage() {
  return <LegalDoc html={PRIVACY_HTML} />
}
