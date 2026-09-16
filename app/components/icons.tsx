export function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <path d="M16.8 16.8L22 22" />
    </svg>
  );
}

export function XIcon({ size = 8, strokeWidth = 1.1 }: { size?: number; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth={strokeWidth}>
      <path d="M1 1l6 6M7 1L1 7" />
    </svg>
  );
}

/*
 * No check here on purpose: every tick in the app is Phosphor's `Check` from
 * '@phosphor-icons/react/ssr'. Regular weight inline, weight="bold" inside a
 * filled `.checkbox`, where a regular stroke lands under a pixel and vanishes.
 */

/** The one save mark — a bookmark, used in the header, cards, and PDP. */
export function HeartIcon({ filled, size = 13 }: { filled: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.5 3.5h11v17L12 16.3l-5.5 4.2z" />
    </svg>
  );
}

export function SellIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="16" />
      <path d="M12 8.5v7M8.5 12h7" />
    </svg>
  );
}

export function BookmarkIcon({ filled = false, size = 15 }: { filled?: boolean; size?: number }) {
  return <HeartIcon filled={filled} size={size} />
}

export function ChatIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 4.5h16v11h-8.5L7 19.5v-4H4z" />
    </svg>
  );
}

export function PlusIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function ArrowLeftIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </svg>
  );
}

export function ArrowRightIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

/**
 * Chevrons step through a set in place (gallery, lots rail). Arrows move between
 * screens. Keeping the two apart is what makes either one mean anything.
 */
export function ChevronLeftIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 6l-6 6 6 6" />
    </svg>
  );
}

export function ChevronRightIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 6l6 6-6 6" />
    </svg>
  );
}

/** Paperclip — attach a photo to a message. */
export function PaperclipIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 11.5l-8 8a5 5 0 0 1-7-7l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7L9.7 17.2a1.7 1.7 0 0 1-2.4-2.4l7.8-7.8" />
    </svg>
  );
}

/** Three shrinking bars — the FILTERS cell of the mobile browse dock (mobile-web 01). */
export function FilterIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6h16M7 12h10M10 18h4" />
    </svg>
  );
}

export function FlagIcon({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 15.5s1-1 4-1 5 2 8 2 4-1 4-1V4.5s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <path d="M5 21v-6" />
    </svg>
  );
}
