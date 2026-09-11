import PrefetchLink from '@/app/components/prefetch-link'

/** Proto-only review control. Never mount on live `/browse`. */
export default function ProtoReviewChrome() {
  return (
    <div className="proto-review">
      <PrefetchLink href="/styleguide/changes" className="proto-review__link" data-testid="proto-changes">
        CHANGES
      </PrefetchLink>
      <span className="proto-review__sub">Diff vs 2nd1 browse.</span>
    </div>
  )
}
