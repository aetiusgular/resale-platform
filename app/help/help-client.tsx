'use client'

import { useState } from 'react'
import { SearchIcon } from '@/app/components/icons'
import { BRAND_SUPPORT_EMAIL } from '@/app/components/brand'

const TOPICS = ['BUYING', 'SELLING', 'ESCROW & PAYOUTS', 'LEGIT CHECK', 'ACCOUNT']

export default function HelpClient({ faqs }: { faqs: Array<{ topic: string; q: string; a: string }> }) {
  const [topic, setTopic] = useState('BUYING')
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(0)
  const q = query.trim().toLowerCase()
  // A search spans every topic; otherwise the chip narrows the list.
  const list = faqs.filter((f) => (q ? f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q) : f.topic === topic))

  return (
    <main className="info-main info-main--help">
      <div className="page-head page-head--ruled">
        <h1 className="page-title">Help &amp; FAQ</h1>
        <span className="page-note">MOST QUESTIONS ANSWERED IN &lt; 1 MIN</span>
      </div>
      <div className="help-search">
        <SearchIcon />
        <input placeholder="Search help — escrow, shipping, offers" aria-label="Search help" value={query} onChange={(e) => { setQuery(e.target.value); setOpen(0) }} />
      </div>
      <div className="help-topics">
        {TOPICS.map((t) => (
          <button key={t} type="button" className={`chip${t === topic ? ' chip--solid' : ''}`} onClick={() => { setTopic(t); setOpen(0) }}>{t}</button>
        ))}
      </div>
      <div className="mt-24">
        {list.length === 0 && <div className="mono-note">NOTHING MATCHES — TRY ANOTHER WORD, OR WRITE TO SUPPORT BELOW.</div>}
        {list.map((f, i) => (
          <button key={f.q} type="button" className={`faq-row${open === i ? ' is-open' : ''}`} aria-expanded={open === i} onClick={() => setOpen(open === i ? -1 : i)}>
            <span className="faq-row__q">{f.q}<span className="faq-row__caret">{open === i ? '▴' : '▾'}</span></span>
            {open === i && <span className="faq-row__a">{f.a}</span>}
          </button>
        ))}
      </div>
      <div className="support-strip">
        <span>Still stuck? Support replies within a day.</span>
        {BRAND_SUPPORT_EMAIL ? (
          <a className="link-underline link-underline--ink" href={`mailto:${BRAND_SUPPORT_EMAIL}`}>MESSAGE SUPPORT →</a>
        ) : (
          <span className="mono-note">SUPPORT INBOX OPENS WITH THE PUBLIC LAUNCH — TESTERS: USE THE GROUP CHAT</span>
        )}
      </div>
    </main>
  )
}
