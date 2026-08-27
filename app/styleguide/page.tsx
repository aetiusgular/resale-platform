import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Styleguide',
  robots: { index: false, follow: false },
}

/* ─── Token data ─────────────────────────────────────────────────────────── */

const COLORS = [
  { name: '--color-bg',       hex: '#1E1D1A', label: 'Background',    usage: 'All page backgrounds — warm charcoal' },
  { name: '--color-ink',      hex: '#E7E3DA', label: 'Ink',           usage: 'Primary text, solid buttons' },
  { name: '--color-ink-soft', hex: '#9C978C', label: 'Ink Soft',      usage: 'Secondary text, metadata' },
  { name: '--color-line',     hex: '#34322C', label: 'Line',          usage: 'All borders — 1px only' },
  { name: '--color-accent',   hex: '#F1EEE7', label: 'Accent',        usage: 'Highlight, active states, verified' },
  { name: '--color-alert',    hex: '#CE6A5C', label: 'Alert',         usage: 'Errors + disputes only' },
]

const TYPE_SCALE = [
  { size: '40px', var: '--text-2xl', label: 'Display / 40' },
  { size: '28px', var: '--text-xl',  label: 'Heading / 28' },
  { size: '20px', var: '--text-lg',  label: 'Subhead / 20' },
  { size: '16px', var: '--text-base',label: 'Body Large / 16' },
  { size: '14px', var: '--text-sm',  label: 'Body / 14 (base)' },
  { size: '12px', var: '--text-xs',  label: 'Caption / 12' },
]

/* ─── Components ─────────────────────────────────────────────────────────── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 'var(--section-gap)' }}>
      <h2
        style={{
          fontSize: 'var(--text-xs)',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: 'var(--tracking-caps)',
          color: 'var(--color-ink-soft)',
          marginBottom: 'var(--spacing-3)',
          paddingBottom: 'var(--spacing-1)',
          borderBottom: '1px solid var(--color-line)',
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  )
}

function ColorSwatch({ name, hex, label, usage }: typeof COLORS[0]) {
  const isDark = ['#1E1D1A', '#34322C'].includes(hex)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-3)', marginBottom: 'var(--spacing-2)' }}>
      <div
        style={{
          width: 64,
          height: 44,
          background: hex,
          border: '1px solid var(--color-line)',
          borderRadius: 'var(--radius)',
          flexShrink: 0,
        }}
        aria-label={hex}
      />
      <div>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: isDark ? 'var(--color-ink)' : 'var(--color-ink-soft)' }}>
          {name} · {hex}
        </p>
        <p style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>{label}</p>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink-soft)' }}>{usage}</p>
      </div>
    </div>
  )
}

/* ─── Listing card skeleton ──────────────────────────────────────────────── */
function ListingCardSkeleton() {
  return (
    <div
      style={{
        border: '1px solid var(--color-line)',
        borderRadius: 'var(--radius)',
        overflow: 'hidden',
        width: 240,
      }}
      aria-label="Listing card skeleton"
    >
      {/* Image placeholder */}
      <div style={{ background: 'var(--color-line)', aspectRatio: '3/4', width: '100%' }} />
      <div style={{ padding: 'var(--spacing-2)' }}>
        {/* Title */}
        <p
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-sm)',
            fontWeight: 700,
            marginBottom: 4,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          Brand · Item Name
        </p>
        {/* Size · Condition */}
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-ink-soft)', marginBottom: 8 }}>
          US 8 · Condition 9/10
        </p>
        {/* Price row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-base)', fontWeight: 700 }}>
            $125
          </span>
          <button
            style={{
              height: 'var(--control-h)',
              padding: '0 var(--spacing-2)',
              background: 'var(--color-ink)',
              color: 'var(--color-bg)',
              border: 'none',
              borderRadius: 'var(--radius)',
              fontFamily: 'var(--font-ui)',
              fontSize: 'var(--text-sm)',
              fontWeight: 500,
              cursor: 'pointer',
              letterSpacing: 'var(--tracking-tight)',
            }}
          >
            Buy
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Page ───────────────────────────────────────────────────────────────── */

export default function StyleguidePage() {
  return (
    <main
      style={{
        maxWidth: 'var(--content-max)',
        margin: '0 auto',
        padding: `var(--spacing-8) var(--gutter)`,
      }}
    >
      <div style={{ marginBottom: 'var(--section-gap)' }}>
        <p
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 'var(--text-lg)',
            color: 'var(--color-ink-soft)',
            marginBottom: 'var(--spacing-1)',
            fontStyle: 'italic',
          }}
          data-testid="specimen-garamond"
        >
          Secondhand, done properly.
        </p>
        <h1
          style={{ fontSize: 'var(--text-2xl)', letterSpacing: 'var(--tracking-tight)' }}
          data-testid="specimen-inter"
        >
          Styleguide
        </h1>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-ink-soft)', marginTop: 'var(--spacing-1)' }}>
          Design tokens extracted from <code>design-reference/tokens/</code>. Source of truth for all build prompts.
        </p>
      </div>

      {/* ── Fonts ── */}
      <Section title="Typography — Three Families">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)' }}>
          <div>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink-soft)', marginBottom: 4 }}>UI / Inter — headers, nav, buttons, body</p>
            <p
              style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--text-xl)' }}
              data-font="Inter"
            >
              Inter — The quick brown fox
            </p>
            <p style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--text-sm)', color: 'var(--color-ink-soft)' }}>
              400 / 500 / 600 / 700 · Sentence case in chrome · ALL CAPS for nav + labels
            </p>
          </div>
          <div>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink-soft)', marginBottom: 4 }}>Serif / EB Garamond — one moment per screen</p>
            <p
              style={{ fontFamily: 'var(--font-serif)', fontSize: 'var(--text-xl)', fontStyle: 'italic' }}
              data-font="EB Garamond"
            >
              EB Garamond — The quick brown fox
            </p>
            <p style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--text-sm)', color: 'var(--color-ink-soft)' }}>
              400 / 400 italic · 1.35–1.75rem · Editorial, section intros
            </p>
          </div>
          <div>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink-soft)', marginBottom: 4 }}>Mono / Space Mono — all listing data</p>
            <p
              style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xl)' }}
              data-font="Space Mono"
              data-testid="specimen-mono"
            >
              Space Mono — $125.00 · US 8 · 9/10
            </p>
            <p style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--text-sm)', color: 'var(--color-ink-soft)' }}>
              400 / 700 · Titles, prices, sizes, condition, timestamps, usernames
            </p>
          </div>
        </div>
      </Section>

      {/* ── Type scale ── */}
      <Section title="Type Scale — 12 / 14 / 16 / 20 / 28 / 40">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-2)' }}>
          {TYPE_SCALE.map(({ size, var: cssVar, label }) => (
            <div key={size} style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--spacing-3)' }}>
              <p
                style={{ fontSize: size, lineHeight: 1.2, minWidth: 200, flexShrink: 0 }}
              >
                {label}
              </p>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-ink-soft)' }}>
                {cssVar} · {size}
              </p>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Colors ── */}
      <Section title="Color Tokens — Six, Nothing Else">
        {COLORS.map((c) => <ColorSwatch key={c.name} {...c} />)}
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink-soft)', marginTop: 'var(--spacing-2)' }}>
          Shadow: <code>--shadow-1</code> · 0 1px 2px rgba(0,0,0,0.06) — floating surfaces only
        </p>
      </Section>

      {/* ── Spacing ── */}
      <Section title="Spacing — 8px Grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1, 2, 3, 4, 5, 6, 8, 12].map((n) => (
            <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-3)' }}>
              <div
                style={{
                  height: 20,
                  width: n * 8,
                  background: 'var(--color-ink)',
                  borderRadius: 'var(--radius)',
                  flexShrink: 0,
                }}
              />
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-ink-soft)' }}>
                --spacing-{n} · {n * 8}px
              </p>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink-soft)', marginTop: 'var(--spacing-2)' }}>
          Radius: 2px everywhere · Content max: 1280px · Gutters: 24px · Control height: 44px
        </p>
      </Section>

      {/* ── Controls ── */}
      <Section title="Controls">
        <div style={{ display: 'flex', gap: 'var(--spacing-2)', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            style={{
              height: 'var(--control-h)',
              padding: '0 var(--spacing-3)',
              background: 'var(--color-ink)',
              color: 'var(--color-bg)',
              border: 'none',
              borderRadius: 'var(--radius)',
              fontFamily: 'var(--font-ui)',
              fontSize: 'var(--text-sm)',
              fontWeight: 500,
              cursor: 'pointer',
              letterSpacing: 'var(--tracking-tight)',
            }}
          >
            Primary button
          </button>
          <button
            style={{
              height: 'var(--control-h)',
              padding: '0 var(--spacing-3)',
              background: 'transparent',
              color: 'var(--color-ink)',
              border: '1px solid var(--color-line)',
              borderRadius: 'var(--radius)',
              fontFamily: 'var(--font-ui)',
              fontSize: 'var(--text-sm)',
              fontWeight: 500,
              cursor: 'pointer',
              letterSpacing: 'var(--tracking-tight)',
            }}
          >
            Secondary button
          </button>
          <button
            style={{
              height: 'var(--control-h)',
              padding: '0 var(--spacing-3)',
              background: 'var(--color-accent)',
              color: 'var(--color-bg)',
              border: 'none',
              borderRadius: 'var(--radius)',
              fontFamily: 'var(--font-ui)',
              fontSize: 'var(--text-sm)',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Accent button
          </button>
          <button
            style={{
              height: 'var(--control-h)',
              padding: '0 var(--spacing-3)',
              background: 'var(--color-alert)',
              color: 'var(--color-bg)',
              border: 'none',
              borderRadius: 'var(--radius)',
              fontFamily: 'var(--font-ui)',
              fontSize: 'var(--text-sm)',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Destructive
          </button>
          <input
            style={{
              height: 'var(--control-h)',
              padding: '0 var(--spacing-2)',
              border: '1px solid var(--color-line)',
              borderRadius: 'var(--radius)',
              fontFamily: 'var(--font-ui)',
              fontSize: 'var(--text-sm)',
              background: 'var(--color-bg)',
              color: 'var(--color-ink)',
              minWidth: 200,
            }}
            placeholder="Input field"
            readOnly
          />
        </div>
      </Section>

      {/* ── Listing card skeleton ── */}
      <Section title="Listing Card Skeleton">
        <div style={{ display: 'flex', gap: 'var(--spacing-3)', flexWrap: 'wrap' }}>
          <ListingCardSkeleton />
          <ListingCardSkeleton />
          <ListingCardSkeleton />
        </div>
      </Section>

      {/* Hidden font specimens for Playwright font assertions */}
      <div aria-hidden="true" style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}>
        <span data-testid="font-inter"   style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>Inter</span>
        <span data-testid="font-garamond" style={{ fontFamily: "'EB Garamond', Georgia, serif" }}>EB Garamond</span>
        <span data-testid="font-mono"    style={{ fontFamily: "'Space Mono', monospace" }}>Space Mono</span>
      </div>
    </main>
  )
}
