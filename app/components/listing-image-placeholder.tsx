import type { CSSProperties } from 'react'

type Props = {
  className?: string
  style?: CSSProperties
  /** When false, rely on a parent container border (e.g. PDP gallery frame). */
  showBorder?: boolean
}

/**
 * Intentional void for missing listing photos — edge-to-edge empty frame.
 * No text, no broken-image icon.
 */
export default function ListingImagePlaceholder({
  className,
  style,
  showBorder = true,
}: Props) {
  return (
    <div
      className={className}
      aria-hidden="true"
      style={{
        width: '100%',
        height: '100%',
        boxSizing: 'border-box',
        border: showBorder ? '1px solid var(--color-line)' : 'none',
        ...style,
      }}
    />
  )
}
