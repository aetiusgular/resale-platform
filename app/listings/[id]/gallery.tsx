'use client'

import { useState, type ReactNode } from 'react'
import ListingImagePlaceholder from '@/app/components/listing-image-placeholder'

const PUBLIC_SLOTS = ['FRONT', 'BACK', 'TAG', 'DETAIL', 'FLAW'] as const

type Props = {
  images: string[]
  title: string
  overlay?: ReactNode
}

export default function ListingGallery({ images, title, overlay }: Props) {
  const frames = PUBLIC_SLOTS
    .map((slot, idx) => ({ slot, url: images[idx] ?? null }))
    .filter((f) => f.url)

  const [active, setActive] = useState(0)
  const current = frames[active]

  return (
    <div>
      <div
        style={{
          position: 'relative',
          aspectRatio: '3/4',
          boxSizing: 'border-box',
          border: '1px solid var(--color-line)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          background: 'var(--color-bg)',
        }}
      >
        {current?.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={current.url}
            alt={`${title} — ${current.slot.toLowerCase()}`}
            fetchPriority="high"
            decoding="async"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <ListingImagePlaceholder showBorder={false} />
        )}
        {overlay}
      </div>

      {frames.length > 1 && (
        <div
          className="listing-thumbnails"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${Math.min(frames.length, 5)}, 1fr)`,
            gap: '10px',
            marginTop: '10px',
          }}
        >
          {frames.map((frame, idx) => (
            <button
              key={frame.slot}
              type="button"
              onClick={() => setActive(idx)}
              aria-label={`Show ${frame.slot.toLowerCase()} photo`}
              aria-pressed={idx === active}
              style={{
                padding: 0,
                margin: 0,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                minHeight: 0,
              }}
            >
              <div
                style={{
                  aspectRatio: '3/4',
                  boxSizing: 'border-box',
                  border: `1px solid ${idx === active ? 'var(--color-ink)' : 'var(--color-line)'}`,
                  overflow: 'hidden',
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={frame.url!}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
              <span
                style={{
                  font: '400 11px var(--font-ui)',
                  color: idx === active ? 'var(--color-ink)' : 'var(--color-ink-soft)',
                  textAlign: 'center',
                }}
              >
                {frame.slot.charAt(0) + frame.slot.slice(1).toLowerCase()}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
