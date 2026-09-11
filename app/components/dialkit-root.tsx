'use client'

import { useEffect } from 'react'
import { DialRoot, useDialKit } from 'dialkit'
import 'dialkit/styles.css'

const ARCHIVE_INK = '#161616'
const ARCHIVE_DISCOUNT = '#b3382f'
const ARCHIVE_LEGIT = '#161616'

export function DialkitRoot() {
  const values = useDialKit('Archive', {
    sectionDividers: true,
    ink: ARCHIVE_INK,
    discount: ARCHIVE_DISCOUNT,
    legit: ARCHIVE_LEGIT,
    badgeScale: [100, 80, 140, 1],
  })

  useEffect(() => {
    const root = document.documentElement
    root.dataset.dividers = values.sectionDividers ? 'on' : 'off'
    root.style.setProperty('--dial-ink', values.ink)
    root.style.setProperty('--dial-discount', values.discount)
    root.style.setProperty('--dial-legit', values.legit)
    root.style.setProperty('--dial-badge-scale', String(values.badgeScale / 100))
  }, [values.sectionDividers, values.ink, values.discount, values.legit, values.badgeScale])

  return <DialRoot />
}
