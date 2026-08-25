import Link from 'next/link'

/**
 * Shared shell for the public legal/document pages (/terms, /privacy, /fees).
 * Server component. Content arrives either as pre-generated HTML (app/terms/content.ts,
 * app/privacy/content.ts — regenerated from docs/legal/*.md by scripts/generate-legal.mjs)
 * or as JSX children (/fees renders live from lib constants).
 *
 * Styling is scoped under .legal-doc and uses design tokens only. <mark> renders the
 * bracketed [PLACEHOLDER] values in alert color so unfilled fields are impossible to miss
 * while the documents are drafts.
 */

const CSS = `
.legal-doc { max-width: 720px; margin: 0 auto; padding: 40px 24px 96px; }
.legal-doc .legal-home { font: 600 16px var(--font-ui); letter-spacing: 0.08em; color: var(--color-ink); text-decoration: none; }
.legal-doc h1 { font: 400 28px var(--font-serif); margin: 32px 0 8px; }
.legal-doc h2 { font: 600 20px var(--font-ui); letter-spacing: -0.01em; margin: 40px 0 12px; }
.legal-doc h3 { font: 600 16px var(--font-ui); letter-spacing: -0.01em; margin: 28px 0 8px; }
.legal-doc p { margin: 0 0 12px; }
.legal-doc p, .legal-doc li { font-size: 14px; line-height: 1.65; color: var(--color-ink); }
.legal-doc p em { font-family: var(--font-serif); font-style: italic; font-size: 15px; color: var(--color-ink-soft); }
.legal-doc ul, .legal-doc ol { margin: 0 0 12px; padding-left: 22px; }
.legal-doc li { margin: 4px 0; }
.legal-doc blockquote { margin: 0 0 24px; padding: 12px 16px; border-left: 2px solid var(--color-alert); border-radius: var(--radius); }
.legal-doc blockquote p { font-size: 13px; color: var(--color-ink-soft); }
.legal-doc blockquote strong { color: var(--color-alert); }
.legal-doc table { width: 100%; border-collapse: collapse; margin: 8px 0 24px; }
.legal-doc th { font: 700 11px var(--font-mono); letter-spacing: 0.08em; text-transform: uppercase; text-align: left; color: var(--color-ink-soft); padding: 8px; border-bottom: 1px solid var(--color-line); }
.legal-doc td { font: 400 12px/1.6 var(--font-mono); padding: 8px; border-bottom: 1px solid var(--color-line); vertical-align: top; }
.legal-doc mark { background: transparent; color: var(--color-alert); font-family: var(--font-mono); font-size: 0.95em; }
.legal-doc hr { margin: 32px 0; }
`

export default function LegalDoc({
  html,
  children,
}: {
  html?: string
  children?: React.ReactNode
}) {
  return (
    <div className="legal-doc">
      <style>{CSS}</style>
      <Link href="/" aria-label="Home" className="legal-home">
        ———
      </Link>
      {html ? (
        <article dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <article>{children}</article>
      )}
    </div>
  )
}
