import { jsonLdString } from '@/lib/seo-listing'

/**
 * Renders a schema.org JSON-LD data block. ld+json never executes (it is a
 * data block, not a script), so the CSP nonce does not apply and none is
 * attached. Serialization escapes `<` — listing titles/descriptions are
 * user-generated and a literal `</script>` must not break out of the block.
 */
export default function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: jsonLdString(data) }}
    />
  )
}
