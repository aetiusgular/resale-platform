'use client'

import Link from 'next/link'
import SaveButton from './save-button'
import MessageSellerButton from './message-seller-button'
import ShareButton from './share-button'
import GuestAction from '@/app/components/guest-action'

interface Props {
  listingId: string
  title: string
  priceLabel: string
  initialSaved: boolean
  guest: boolean
  user: boolean
  /** When false, Buy / Offer / Message are omitted (seller/admin view of non-buyable). */
  showCommerce: boolean
  buyDisabledLabel?: string | null
}

function GuestMessageLink({ listingId }: { listingId: string }) {
  return (
    <GuestAction
      next={`/listings/${listingId}`}
      testId="message-guest-action"
      className="pdp-secondary-btn"
    >
      Message
    </GuestAction>
  )
}

export default function ListingActions({
  listingId,
  title,
  priceLabel,
  initialSaved,
  guest,
  user,
  showCommerce,
  buyDisabledLabel = null,
}: Props) {
  return (
    <div className="pdp-commerce-actions" role="group" aria-label="Listing actions">
      {showCommerce ? (
        <>
          {/* Primary — Buy now */}
          {user ? (
            <Link href={`/checkout/${listingId}`} className="pdp-buy-primary" data-testid="buy-now">
              Buy now — {priceLabel}
            </Link>
          ) : (
            <GuestAction
              next={`/checkout/${listingId}`}
              testId="buy-guest"
              className="pdp-buy-primary"
            >
              Buy now — {priceLabel}
            </GuestAction>
          )}

          {/* Secondary — Make offer + Message, same visual language */}
          <div className="pdp-secondary-row" role="group" aria-label="Offer and message">
            {user ? (
              <a href={`/messages?listing=${listingId}`} className="pdp-secondary-btn">
                Make offer
              </a>
            ) : (
              <GuestAction
                next={`/messages?listing=${listingId}`}
                testId="offer-guest"
                className="pdp-secondary-btn"
              >
                Make offer
              </GuestAction>
            )}
            {user ? (
              <MessageSellerButton listingId={listingId} variant="secondary" />
            ) : (
              <GuestMessageLink listingId={listingId} />
            )}
          </div>
        </>
      ) : buyDisabledLabel ? (
        <button type="button" disabled className="pdp-buy-primary">
          {buyDisabledLabel}
        </button>
      ) : null}

      {/* Tertiary — Save + Share, quiet icon strip */}
      <div className="pdp-tertiary-row" role="group" aria-label="Save and share">
        {guest ? (
          <SaveButton listingId={listingId} initialSaved={false} guest variant="action" />
        ) : (
          <SaveButton listingId={listingId} initialSaved={initialSaved} variant="action" />
        )}
        <ShareButton title={title} />
      </div>

      {showCommerce && (
        <p className="pdp-fee-note">no buyer fee — you pay the listed price</p>
      )}
    </div>
  )
}
