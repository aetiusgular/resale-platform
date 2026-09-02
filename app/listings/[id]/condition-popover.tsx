'use client'

import { useState } from 'react'

interface ConditionPopoverProps {
  score: number
  definition: string
}

export default function ConditionPopover({ score, definition }: ConditionPopoverProps) {
  const [open, setOpen] = useState(false)

  return (
    <div style={{ position: 'relative' }}>
      <button
        className="listing-buy-hit"
        onClick={() => setOpen((o) => !o)}
        style={{ font: '400 12px var(--font-ui)', color: 'var(--color-ink)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', textDecorationThickness: 'from-font', textUnderlineOffset: '3px', padding: 0 }}
      >
        what {score} means
      </button>
      {open && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 9 }}
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: '6px', width: '280px', background: 'var(--color-bg)', border: '1px solid var(--color-ink)', borderRadius: '2px', boxShadow: 'var(--shadow-1)', padding: '12px 16px', zIndex: 10 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '11px', letterSpacing: '0.08em', color: 'var(--color-ink)' }}>{score}/10</div>
            <div style={{ marginTop: '4px', fontSize: '13px', lineHeight: 1.6, color: 'var(--color-ink)' }}>{definition}</div>
          </div>
        </>
      )}
    </div>
  )
}
