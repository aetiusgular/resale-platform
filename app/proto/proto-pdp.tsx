import ListingGallery from '@/app/listings/[id]/listing-gallery'
import MeasurementsPanel from '@/app/listings/[id]/measurements-panel'
import ListingBack from '@/app/listings/[id]/listing-back'
import GuestAction from '@/app/components/guest-action'
import PrefetchLink from '@/app/components/prefetch-link'
import LotsCarousel from '@/app/components/lots-carousel'
import { Check } from '@phosphor-icons/react/ssr'
import { ChatIcon, FlagIcon, HeartIcon } from '@/app/components/icons'
import { pickMoreLots } from '@/app/browse/more-lots'
import { PROTO_LISTINGS, type ProtoListing } from './fixtures'

export default function ProtoPdp({ listing, backHref }: { listing: ProtoListing; backHref: string }) {
  const moreLots = pickMoreLots(PROTO_LISTINGS, {
    excludeIds: [listing.id],
    category: listing.category,
  })
  const when = listing.listed_line
  const spec = [listing.size, listing.color].filter(Boolean).map((part) => part.toUpperCase()).join(' ')
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
          <div className="pdp__lockup">
            <div className="pdp__meta">
              <span className="pdp__listed">{when}</span>
              <a className="pdp__legit" href="#lc-thread" title="Jumps to the legit check thread" data-testid="lc-chip">
                3 legit
              </a>
            </div>
            <div className="pdp__brand-row">
              <div className="pdp__brand">{listing.brand.toUpperCase()}</div>
              <GuestAction next={backHref} className="pdp__caption-save" testId="proto-save-caption">
                <HeartIcon filled={false} size={16} />
              </GuestAction>
            </div>
            <h1 className="pdp__title">{listing.title}</h1>
            {spec ? <div className="pdp__spec">{spec}</div> : null}
            <div className="pdp__pricerow">
              <span className={`pdp__price${listing.is_price_dropped && listing.original_price_cents ? ' is-drop' : ''}`} data-testid="listing-price">
                {listing.price_display}
              </span>
              <span className="pdp__ship">+ {listing.shipping_display} SHIPPING US</span>
              <span className="pdp__listed pdp__listed--m">{when}</span>
            </div>
          </div>
          <div className="pdp-specs">
            {listing.size && <div className="pdp-specs__row"><span className="pdp-specs__k">SIZE</span><span className="pdp-specs__v">{listing.size.toUpperCase()}</span></div>}
            {listing.color && <div className="pdp-specs__row"><span className="pdp-specs__k">COLOR</span><span className="pdp-specs__v">{listing.color.toUpperCase()}</span></div>}
            <div className="pdp-specs__row"><span className="pdp-specs__k">SHIPPING</span><span className="pdp-specs__v">{listing.shipping_display} US ONLY</span></div>
          </div>
          <div className="pdp__ctas">
            <div className="pdp__buyrow">
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
            </div>
            <GuestAction next={backHref} className="pdp__msg" testId="message-guest">
              <ChatIcon size={20} />
              Message seller
            </GuestAction>
          </div>
          <div className="pdp__desc">
            <div className="field-label field-label--row">
              <span>DESCRIPTION</span>
            </div>
            <p style={{ whiteSpace: 'pre-line' }}>{listing.description}</p>
          </div>
          <div className="spacer" />
          <div className="pdp__seller">
            <PrefetchLink className="pdp__seller-left" href={`/sellers/${listing.seller_handle}`} aria-label={`${listing.seller_handle} profile`}>
              <span className="seller-init seller-init--sm">{listing.seller_initials}</span>
              <span>
                <span className="pdp__seller-handle">@{listing.seller_handle.toUpperCase()}</span>
                <span className="pdp__seller-meta">
                  {listing.trust_line.split(' · ').map((part) => (
                    <span key={part}>{part}</span>
                  ))}
                </span>
              </span>
            </PrefetchLink>
            <span className="pdp__seller-right">
              <GuestAction next={backHref} className="link-underline link-underline--ink pdp__seller-msg"><ChatIcon size={16} />Message</GuestAction>
            </span>
          </div>
        </div>
      </div>

      <section className="lc-section" id="lc-thread" aria-labelledby="lc-heading">
        <header className="lc-head">
          <h2 id="lc-heading" className="lc-head__title">Legit check</h2>
          <p className="lc-head__tally">3 legit · 0 flagged</p>
        </header>
        <div className="lc-comment" data-testid="comment-row">
          <span className="lc-comment__avatar" />
          <div className="lc-comment__body">
            <div className="lc-comment__who">ATELIER.EAST<span className="lc-vote" title="Voted legit"><Check size={11} /></span></div>
            <p className="lc-comment__text">Stitching and lining match the period piece. Tags look correct.</p>
            <div className="lc-comment__actions">
              <button type="button" aria-label="Agree, 2"><Check size={10} />AGREE 2</button>
              <span className="sep" aria-hidden="true" />
              <button type="button"><FlagIcon size={10} />FLAG</button>
              <span className="sep" aria-hidden="true" />
              <button type="button">REPLY</button>
              <span className="lc-comment__meta" style={{ marginTop: 0, marginLeft: 'auto' }}>2D AGO</span>
            </div>
          </div>
        </div>
        {listing.sold ? (
          <div className="mono-note" style={{ paddingTop: 8 }}>Thread closed — this item has sold</div>
        ) : (
          <>
            <div className="lc-form">
              <input className="lc-input" type="text" placeholder="Add a comment or cast a vote —" aria-label="Add a legit check comment" data-testid="lc-input" disabled />
              <button type="button" className="btn-mini" disabled><Check size={11} /> LEGIT</button>
              <button type="button" className="btn-mini" disabled><FlagIcon size={10} /> FLAG</button>
              <button type="button" className="btn-mini btn-mini--solid" disabled>POST</button>
            </div>
            <div className="mono-note" style={{ paddingTop: 8 }}>Members vote once on each listing. If you can&apos;t yet, verify your ID in Settings.</div>
          </>
        )}
      </section>

      <LotsCarousel listings={moreLots} label="more lots" hrefBase={backHref} />

      {!listing.sold && (
        <div className="pdp-dock">
          <GuestAction next={backHref} className="btn-primary">BUY NOW</GuestAction>
          <GuestAction next={backHref} className="btn-ink">MAKE OFFER</GuestAction>
        </div>
      )}
    </div>
  )
}
