import Link from 'next/link'
import LegalDoc from '@/app/components/legal-doc'
import {
  FEE_TIERS,
  FIXED_FEE_CENTS,
  SMALL_ORDER_THRESHOLD_CENTS,
  SMALL_ORDER_CAP_BPS,
  WELCOME_SALES,
  STRIPE_PCT_BPS,
  STRIPE_FIXED_CENTS,
} from '@/lib/fees'
import { BOOST_PACKAGES, MAX_PROMOTED_PER_PAGE } from '@/lib/boosts'
import { SHIPPING_CATEGORIES, SHIPPING_MARGIN_CENTS, floorShippingCents } from '@/lib/shipping'
import { MAX_REGION_RATE_CENTS, REGION_LABELS } from '@/lib/shipping-regions'

/**
 * /fees — the Fee Schedule incorporated by reference into the Terms of Service (§ 8).
 * Renders LIVE from the money constants (lib/fees.ts, lib/boosts.ts, lib/shipping.ts) so
 * this page can never drift from what checkout actually charges. No hardcoded numbers.
 */
export const metadata = { title: 'Fee Schedule', alternates: { canonical: '/fees' } }

const pct = (bps: number) => `${(bps / 100).toFixed(1)}%`
const usd = (cents: number) =>
  `$${(cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`

export default function FeesPage() {
  const tiers = [...FEE_TIERS].reverse() // base tier first
  return (
    <LegalDoc
      kicker="LEGAL / FEES"
      title="Fee schedule"
      note="RENDERED LIVE FROM THE FEE CONSTANTS"
      toc={[
        { id: 'seller-commission', label: 'Seller commission' },
        { id: 'welcome-pricing', label: 'Welcome pricing' },
        { id: 'shipping', label: 'Shipping' },
        { id: 'boosts', label: 'Boosts' },
      ]}
    >
      <p>
        Free to join. Free to list. Buyers pay no platform fee: the total at checkout is
        the item price, shipping, and tax, and nothing else. This schedule is incorporated
        into the <Link href="/terms">Terms of Service</Link>; the fees that apply to a sale
        are those in effect at the time of the sale, and changes get at least 14 days&rsquo;
        notice.
      </p>

      <h2 id="seller-commission">Seller commission</h2>
      <p>
        Commission is charged on the item price (never on shipping) and already includes
        percentage payment processing. Every sale also carries a fixed {usd(FIXED_FEE_CENTS)}.
        Your rate falls as your trailing 365-day sales activity grows (both thresholds must
        be met; canceled and refunded orders never count):
      </p>
      <table>
        <thead>
          <tr>
            <th>Trailing 365-day sales</th>
            <th>Completed orders</th>
            <th>Commission</th>
          </tr>
        </thead>
        <tbody>
          {tiers.map((t) => (
            <tr key={t.bps}>
              <td>{t.minVolumeCents === 0 ? 'Any' : `≥ ${usd(t.minVolumeCents)}`}</td>
              <td>{t.minOrders === 0 ? 'Any' : `≥ ${t.minOrders}`}</td>
              <td>{pct(t.bps)} + {usd(FIXED_FEE_CENTS)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        Orders under {usd(SMALL_ORDER_THRESHOLD_CENTS)} are capped at{' '}
        {pct(SMALL_ORDER_CAP_BPS)} + {usd(FIXED_FEE_CENTS)}. The fee never exceeds the item price.
      </p>

      <h2 id="welcome-pricing">Welcome pricing</h2>
      <p>
        Your first {WELCOME_SALES} sales carry 0% commission. On those sales you cover only
        the payment-processing cost of {pct(STRIPE_PCT_BPS)} + {usd(STRIPE_FIXED_CENTS)}{' '}
        on the item price; from sale {WELCOME_SALES + 1} the table above applies.
      </p>

      <h2 id="shipping">Shipping</h2>
      <p>
        Buyers pay shipping; sellers never pay it. Within the United States, sellers never set
        it either: each listing is priced by category at the higher of a carrier-based quote
        and the category floor, includes a {usd(SHIPPING_MARGIN_CENTS)} handling component
        retained by the platform, and ships on a prepaid label we provide:
      </p>
      <table>
        <thead>
          <tr>
            <th>Category</th>
            <th>Shipping from</th>
          </tr>
        </thead>
        <tbody>
          {SHIPPING_CATEGORIES.map((c) => (
            <tr key={c}>
              <td>{c}</td>
              <td>{usd(floorShippingCents(c))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p>
        International shipping is optional and set by the seller: a flat rate per region
        ({Object.values(REGION_LABELS).filter((l) => l !== 'North America').join(', ')}; sellers
        outside the United States price North America instead of Canada), up to{' '}
        {usd(MAX_REGION_RATE_CENTS)}. The seller buys their own tracked label, and the shipping
        the buyer paid is added to the seller&rsquo;s payout in full. Duties and import taxes
        are the buyer&rsquo;s responsibility.
      </p>

      <h2 id="boosts">Boosts (promoted placement)</h2>
      <p>
        Bumping a listing is free (see the listing page for your next eligible bump).
        Boosts are one-time purchases that pin a listing to the top of browse with a
        &ldquo;Promoted&rdquo; label for a fixed period. They never renew automatically, at
        most {MAX_PROMOTED_PER_PAGE} promoted listings appear per page, and a Boost buys
        placement, not results:
      </p>
      <table>
        <thead>
          <tr>
            <th>Package</th>
            <th>Duration</th>
            <th>Price</th>
          </tr>
        </thead>
        <tbody>
          {BOOST_PACKAGES.map((b) => (
            <tr key={b.key}>
              <td>{b.label}</td>
              <td>{b.durationDays} days</td>
              <td>{usd(b.amountCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p>
        <em>
          This page renders directly from the platform&rsquo;s fee constants, so it always
          matches what checkout charges. Questions: <mark>[SUPPORT EMAIL]</mark>.
        </em>
      </p>
    </LegalDoc>
  )
}
