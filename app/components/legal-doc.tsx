/**
 * Shared shell for the public legal/document pages (/terms, /privacy, /fees).
 * Server component (design "Legal" board): section TOC on the left, the
 * document on the right under a ruled page-head. Content arrives either as
 * pre-generated HTML (app/terms/content.ts, app/privacy/content.ts — regenerated
 * from docs/legal/*.md by scripts/generate-legal.mjs) or as JSX children (/fees
 * renders live from lib constants).
 *
 * <h2> headings get ids so the TOC anchors work; bracketed [PLACEHOLDER] values
 * render in alert colour (see .legal-body article mark) so unfilled fields are
 * impossible to miss while the documents are drafts.
 */
import AppShell from './app-shell'
import { getViewerUsername } from './viewer'

const slug = (s: string) => s.toLowerCase().replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
const strip = (s: string) => s.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#39;/g, '’').trim()

function prepare(html: string): { html: string; toc: Array<{ id: string; label: string }> } {
  const toc: Array<{ id: string; label: string }> = []
  const out = html.replace(/<h2>([\s\S]*?)<\/h2>/g, (_m, inner: string) => {
    const label = strip(inner)
    const id = slug(label) || `s-${toc.length + 1}`
    toc.push({ id, label })
    return `<h2 id="${id}">${inner}</h2>`
  })
  return { html: out, toc }
}

export default async function LegalDoc({
  kicker,
  title,
  note,
  html,
  toc: tocOverride,
  children,
}: {
  kicker: string
  title: string
  note?: string
  html?: string
  toc?: Array<{ id: string; label: string }>
  children?: React.ReactNode
}) {
  const username = await getViewerUsername()
  const prepared = html ? prepare(html) : null
  const toc = tocOverride ?? prepared?.toc ?? []

  return (
    <AppShell username={username}>
      <div className="legal-split">
        <aside className="legal-toc">
          <div className="legal-toc__label">{kicker}</div>
          <nav aria-label="Sections">
            {toc.map((s, i) => (
              <a key={s.id} className="legal-toc__item" href={`#${s.id}`}>
                {String(i + 1).padStart(2, '0')} {s.label.toUpperCase().replace(/^\d+\.\s*/, '')}
              </a>
            ))}
          </nav>
        </aside>
        <main className="legal-body">
          <div className="page-head page-head--ruled">
            <h1 className="page-title">{title}</h1>
            {note && <span className="page-note">{note}</span>}
          </div>
          {prepared ? (
            <article dangerouslySetInnerHTML={{ __html: prepared.html }} />
          ) : (
            <article>{children}</article>
          )}
        </main>
      </div>
    </AppShell>
  )
}
