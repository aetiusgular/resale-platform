'use client'

import { useState } from 'react'
import ListingCard from '@/app/components/listing-card'
import Icon, { ICON_NAMES } from '@/app/components/icon'
import SearchField from '@/app/components/search-field'
import Wordmark from '@/app/components/wordmark'
import MobileTabBar from '@/app/components/mobile-tabbar'
import { useStudio } from '@/app/components/studio'
import { PREVIEW_LISTINGS } from '@/app/preview/fixtures'
import PrefetchLink from '@/app/components/prefetch-link'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 64 }}>
      <h2
        style={{
          font: '400 12px var(--font-ui)',
          color: 'var(--color-ink-soft)',
          marginBottom: 16,
          paddingBottom: 8,
          borderBottom: '1px solid var(--color-line)',
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  )
}

export default function LabClient() {
  const studio = useStudio()
  const [saved, setSaved] = useState<Set<string>>(new Set([PREVIEW_LISTINGS[0].id]))

  const toggle = (id: string, isSaved: boolean) => {
    setSaved((prev) => {
      const next = new Set(prev)
      if (isSaved) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <main style={{ maxWidth: 1280, margin: '0 auto', padding: '48px 24px 120px' }}>
      <style>{`
        @media (max-width: 767px) {
          .lab-card-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
        }
      `}</style>
      <header style={{ marginBottom: 64, maxWidth: 640 }}>
        <p style={{ font: '300 20px var(--font-ui)', letterSpacing: '-0.01em', color: 'var(--color-ink-soft)', marginBottom: 8 }}>
          Prototyping playground
        </p>
        <h1 style={{ font: '400 40px var(--font-ui)', letterSpacing: '-0.01em', marginBottom: 16 }}>
          Lab
        </h1>
        <p style={{ fontSize: 14, color: 'var(--color-ink-soft)', lineHeight: 1.6 }}>
          DialKit (bottom-right) writes the same tokens the live site reads. Agentation
          (toolbar) lets you pin notes on anything here or on{' '}
          <PrefetchLink href="/browse">/browse</PrefetchLink>. Changes persist in this browser.
        </p>
        <p style={{ marginTop: 12, fontSize: 13 }}>
          <PrefetchLink href="/styleguide">← token museum</PrefetchLink>
        </p>
      </header>

      <Section title="Where a mark earns its keep">
        <ol
          style={{
            margin: 0,
            paddingLeft: 18,
            fontSize: 14,
            lineHeight: 1.7,
            color: 'var(--color-ink)',
            maxWidth: 640,
          }}
        >
          <li>Navigation — five destinations at 375px need a shape, not five words of the same weight.</li>
          <li>Search — a leading glass is quieter than a labelled field repeating “search”.</li>
          <li>Save — a 20px bookmark on the type column, not a 16px mark floating under the photo.</li>
          <li>Notifications — the one status that is not the object itself.</li>
          <li>Catalog trust — one provenance signal in the facts line (auth icon or ID dot). Never on the image or price.</li>
        </ol>
      </Section>

      <Section title="What reads as designed, not vibe-coded">
        <ul
          style={{
            margin: 0,
            paddingLeft: 18,
            fontSize: 14,
            lineHeight: 1.7,
            maxWidth: 640,
          }}
        >
          <li>One stroke family (Phosphor Thin). No mixed Lucide/hand SVG weights.</li>
          <li>Radius is a token. Leftover 2px on chips while images are 0px is the tell.</li>
          <li>The photograph is the visual. Chrome stays hairline or disappears (try Frame).</li>
          <li>Accent is weight, not a second hue — unless you flip Night and want the old bunker.</li>
          <li>Serif once per screen, for a sentence, not for labels.</li>
        </ul>
      </Section>

      <Section title="Marks — Phosphor Thin">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))',
            gap: 16,
          }}
        >
          {ICON_NAMES.map((name) => (
            <div
              key={name}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
                padding: '20px 8px',
                border: '1px solid var(--color-line)',
              }}
            >
              <Icon name={name} />
              <span style={{ font: '400 11px var(--font-mono)', color: 'var(--color-ink-soft)' }}>
                {name}
              </span>
            </div>
          ))}
        </div>
        <p style={{ marginTop: 12, font: '400 12px var(--font-mono)', color: 'var(--color-ink-soft)' }}>
          {studio.iconWeight} · {studio.iconSize}px · nav {studio.nav}
        </p>
      </Section>

      <Section title="Search">
        <div style={{ maxWidth: 480 }}>
          <SearchField />
        </div>
      </Section>

      <Section title="Wordmark">
        <Wordmark href={null} />
      </Section>

      <Section title="Catalog — PAF caption (title + price + provenance)">
        <p style={{ fontSize: 13, color: 'var(--color-ink-soft)', marginBottom: 16, maxWidth: 640 }}>
          Weight hierarchy: brand medium · title medium · price medium · facts light.
          Facts line carries size, condition, and at most one trust signal —{' '}
          <span style={{ fontFamily: 'var(--font-mono)' }}>auth</span> (authenticated listing) or{' '}
          <span style={{ fontFamily: 'var(--font-mono)' }}>id verified</span> (seller only).
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: 'var(--grid-gap-y) var(--grid-gap-x)',
          }}
          className="lab-card-grid"
        >
          {PREVIEW_LISTINGS.map((listing, i) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              isSaved={saved.has(listing.id)}
              onSaveToggle={toggle}
              position={i}
            />
          ))}
        </div>
      </Section>

      <Section title="Record density — accession label (save + trust on price row)">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: 'var(--grid-gap-y) var(--grid-gap-x)',
            maxWidth: 720,
          }}
        >
          {PREVIEW_LISTINGS.slice(0, 2).map((listing, i) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              isSaved={saved.has(listing.id)}
              onSaveToggle={toggle}
              density="record"
              showSave
              position={i}
            />
          ))}
        </div>
      </Section>

      <Section title="Tab bar — resize below 768 to judge">
        <p style={{ fontSize: 13, color: 'var(--color-ink-soft)', marginBottom: 16 }}>
          The bar is fixed on browse. Here it is inlined so you can compare nav styles.
        </p>
        <div
          style={{
            position: 'relative',
            border: '1px solid var(--color-line)',
            maxWidth: 420,
            height: 56,
            overflow: 'hidden',
          }}
        >
          <div className="lab-tabbar-host">
            <MobileTabBar username="objectdealer" hasUnread pinned={false} />
          </div>
        </div>
      </Section>
    </main>
  )
}
