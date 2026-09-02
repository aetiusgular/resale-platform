import Link from 'next/link'
import Icon from '@/app/components/icon'

interface Props {
  sellerUsername: string | null
  sellerVerified: boolean
  listedAgo: string
}

/**
 * Compact seller block for the sticky commerce column.
 * "Saved by" avatar stubs intentionally omitted — founder feedback.
 */
export default function PdpSidebar({
  sellerUsername,
  sellerVerified,
  listedAgo,
}: Props) {
  return (
    <section className="pdp-seller" aria-label="Seller">
      <span className="pdp-seller-avatar" aria-hidden>
        {(sellerUsername ?? '?').charAt(0).toUpperCase()}
      </span>
      <div className="pdp-seller-meta">
        <Link
          href={sellerUsername ? `/sellers/${sellerUsername}` : '#'}
          className="pdp-seller-name"
        >
          @{sellerUsername ?? '—'}
        </Link>
        <span className="pdp-seller-detail">
          Listed {listedAgo}
          {sellerVerified && (
            <>
              <span className="pdp-seller-sep" aria-hidden> · </span>
              <span className="pdp-seller-verified">
                <Icon name="verified" size={14} weight="thin" label="ID verified" />
                verified
              </span>
            </>
          )}
        </span>
      </div>
    </section>
  )
}
