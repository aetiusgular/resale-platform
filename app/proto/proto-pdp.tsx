import ListingGallery from '@/app/listings/[id]/listing-gallery'
import MeasurementsPanel from '@/app/listings/[id]/measurements-panel'
import ListingBack from '@/app/listings/[id]/listing-back'
import GuestAction from '@/app/components/guest-action'
import { ChatIcon, CheckIcon, FlagIcon, HeartIcon } from '@/app/components/icons'
import { listedWhen } from '@/app/components/format'
import type { ProtoListing } from './fixtures'

export default function ProtoPdp({ listing, backHref }: { listing: ProtoListing; backHref: string }) {
  const when = listedWhen(listing.listed_line)
  return (
    <div className="pdp-page">
      <div className="pdp">
        <div className="pdp__left">
          <ListingBack href={backHref} />
          <ListingGallery
            images={listing.images}
            title={listing.title}
            showPossession={false}
            saveSlot={(
              <GuestAction next={backHref} className="btn-square" testId="proto-save">
                <HeartIcon filled={false} size={20} />
              </GuestAction>
            )}
          />
          <MeasurementsPanel labels={listing.measurement_labels} values={listing.measurements} />
        </div>
        <div className="pdp__right">
          <div className="pdp__toprow">
            <span className="pdp__listed">{when}</span>
            <a className="lc-chip" href="#lc-thread" title="Open the legit check thread" data-testid="lc-chip">
              3 legit
            </a>
          </div>
          <div className="pdp__caption">
            <span className="pdp__brand">{listing.brand.toUpperCase()}</span>
            <span className="pdp__caption-meta">
              {listing.size && <span className="pdp__size">{listing.size.toUpperCase()}</span>}
              <GuestAction next={backHref} className="card__save" testId="proto-save-caption">
                <HeartIcon filled={false} size={20} />
              </GuestAction>
            </span>
          </div>
          <h1 className="pdp__title">{listing.title}</h1>
          <div className="pdp-facts">
            {listing.color && <span className="fact">{listing.color.toUpperCase()}</span>}
            <span className="fact">{listing.condition_score} / 10</span>
          </div>
          <div className="pdp__pricerow">
            <div className="pdp__priceblock">
              <span className={`pdp__price${listing.is_price_dropped && listing.original_price_cents ? ' is-drop' : ''}`} data-testid="listing-price">
                {listing.price_display}
              </span>
              <span className="pdp__ship">
                <span>Shipping {listing.shipping_display}</span>
                <span>US only</span>
              </span>
            </div>
            <span className="pdp__listed pdp__listed--m">{when.split(' · ')[0]}</span>
          </div>
          <div className="pdp-specs">
            {listing.size && <div className="pdp-specs__row"><span className="pdp-specs__k">SIZE</span><span className="pdp-specs__v">{listing.size.toUpperCase()}</span></div>}
            {listing.color && <div className="pdp-specs__row"><span className="pdp-specs__k">COLOR</span><span className="pdp-specs__v">{listing.color.toUpperCase()}</span></div>}
            <div className="pdp-specs__row"><span className="pdp-specs__k">CONDITION</span><span className="pdp-specs__v">{listing.condition_score} / 10</span></div>
            <div className="pdp-specs__row"><span className="pdp-specs__k">SHIPPING</span><span className="pdp-specs__v">{listing.shipping_display} US</span></div>
          </div>
          <div className="pdp__ctas">
            {listing.sold ? (
              <button type="button" className="btn-primary btn-primary--lg" disabled>SOLD</button>
            ) : (
              <GuestAction next={backHref} testId="buy-guest" className="btn-primary btn-primary--lg">
                BUY NOW
              </GuestAction>
            )}
            {listing.sold ? (
              <button type="button" className="btn-ink" disabled>MAKE OFFER</button>
            ) : (
              <GuestAction next={backHref} testId="offer-guest" className="btn-ink">
                MAKE OFFER
              </GuestAction>
            )}
            <div className="pdp__ctarow">
              <GuestAction next={backHref} className="btn-ghost btn-ghost--icon">
                <ChatIcon size={20} />MESSAGE SELLER
              </GuestAction>
            </div>
          </div>
          <div className="pdp__desc">
            <div className="field-label">DESCRIPTION</div>
            <p style={{ whiteSpace: 'pre-line' }}>{listing.description}</p>
          </div>
          <div className="pdp__seller">
            <span className="pdp__seller-left">
              <span className="seller-init seller-init--sm">{listing.seller_initials}</span>
              <span>
                <span className="pdp__seller-handle">@{listing.seller_handle.toUpperCase()}</span>
                <span className="pdp__seller-meta">
                  {listing.trust_line.split(' · ').map((part) => (
                    <span key={part}>{part}</span>
                  ))}
                </span>
              </span>
            </span>
          </div>
        </div>
      </div>

      <section className="lc-section" id="lc-thread" aria-labelledby="lc-heading">
        <h2 id="lc-heading" className="sr-only">The community weighs in.</h2>
        <div className="lc-strip">
          <span className="lc-strip__left">
            <span className="lc-tally"><CheckIcon size={12} />3 legit</span>
            <span className="lc-tally"><FlagIcon size={12} />0 flagged</span>
          </span>
        </div>
        <div className="lc-comment" data-testid="comment-row">
          <span className="lc-comment__avatar" />
          <div className="lc-comment__body">
            <div className="lc-comment__who">ATELIER.EAST<span className="lc-vote" title="Voted legit"><CheckIcon size={11} /></span></div>
            <p className="lc-comment__text">Stitching and lining match the period piece. Tags look correct.</p>
            <div className="lc-comment__actions">
              <button type="button" aria-label={`Agree, ${agreeCount([{ action: 'agree' }, { action: 'agree' }])}`}><CheckIcon size={12} /><span>{agreeCount([{ action: 'agree' }, { action: 'agree' }])}</span></button>
              <span className="lc-comment__meta" style={{ marginTop: 0, marginLeft: 'auto' }}>2D AGO</span>
            </div>
          </div>
        </div>
        <div className="lc-form">
          <input className="lc-input" type="text" placeholder="Add a comment or cast a vote —" aria-label="Add a legit check comment" data-testid="lc-input" disabled />
          <button type="button" className="btn-mini" disabled><CheckIcon size={10} /> LEGIT</button>
          <button type="button" className="btn-mini" disabled><FlagIcon size={10} /> FLAG</button>
          <button type="button" className="btn-mini btn-mini--solid" disabled>POST</button>
        </div>
        <div className="mono-note" style={{ paddingTop: 8 }}>One vote per member. Moderators lock the verdict.</div>
      </section>

      {!listing.sold && (
        <div className="pdp-dock">
          <GuestAction next={backHref} className="btn-primary">BUY NOW</GuestAction>
          <GuestAction next={backHref} className="btn-ink">MAKE OFFER</GuestAction>
        </div>
      )}
    </div>
  )
}

function agreeCount(actions: { action: string }[] | null | undefined): number {
  return (actions ?? []).filter((a) => a.action === 'agree').length
}
