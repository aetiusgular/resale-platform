'use client'

import { ReactLenis } from 'lenis/react'

/**
 * Subtle smooth scroll — a light glide on desktop wheel only.
 *
 * Deliberately restrained for a browse-heavy shopping flow:
 *  - lerp 0.14 (snappier than the 0.1 default) so it never feels like molasses;
 *    shoppers scan fast, they don't want a "storytelling" float.
 *  - smoothWheel only. Touch stays native — mobile momentum scroll beats any
 *    JS smoothing, and native touch keeps the browse infinite-scroll snappy.
 *  - root mode scrolls the real page, so the IntersectionObserver infinite
 *    scroll on /browse keeps firing normally.
 * Easy to remove: delete this wrapper from layout.tsx.
 */
export default function SmoothScroll({ children }: { children: React.ReactNode }) {
  return (
    <ReactLenis
      root
      options={{
        lerp: 0.14,
        smoothWheel: true,
        wheelMultiplier: 1,
        syncTouch: false, // native touch scrolling on mobile
      }}
    >
      {children}
    </ReactLenis>
  )
}
