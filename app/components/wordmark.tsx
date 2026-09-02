import type { CSSProperties } from 'react'
import PrefetchLink from './prefetch-link'

/**
 * Interim mark until the real name exists. Lowercase, untracked — Are.na energy:
 * the word is the logo. Never a dash, never a drawn mark.
 */
const MARK = 'archive'

type Props = {
  href?: string | null
  testId?: string
  style?: CSSProperties
}

const markStyle: CSSProperties = {
  font: '300 15px var(--font-ui)',
  letterSpacing: '-0.01em',
  color: 'var(--color-ink)',
  textDecoration: 'none',
}

export default function Wordmark({ href = '/', testId = 'site-wordmark', style }: Props) {
  if (!href) {
    return (
      <span data-testid={testId} style={{ ...markStyle, ...style }}>
        {MARK}
      </span>
    )
  }

  return (
    <PrefetchLink
      href={href}
      data-testid={testId}
      style={{
        ...markStyle,
        flex: 'none',
        minHeight: '44px',
        display: 'inline-flex',
        alignItems: 'center',
        ...style,
      }}
    >
      {MARK}
    </PrefetchLink>
  )
}
