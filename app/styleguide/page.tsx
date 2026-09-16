import type { Metadata } from 'next'
import AppShell from '@/app/components/app-shell'
import PrefetchLink from '@/app/components/prefetch-link'
import { CardGhost } from '@/app/components/skeletons'
import { Check } from '@phosphor-icons/react/ssr'
import { ArrowRightIcon } from '@/app/components/icons'
import { ThemeSegment } from '@/app/components/theme'
import { getViewerUsername } from '@/app/components/viewer'
import { TOKENS } from './tokens'

export const metadata: Metadata = {
  title: 'Styleguide',
  robots: { index: false, follow: false },
}

/* ─── Token data lives in ./tokens.ts (mirrors app/globals.css) ─────────── */

const TONES = [1, 2, 3, 4, 5, 6, 7, 8]

/** The proto tour, reachable from here only — the screens carry no banner of their own. */
const PROTO_SCREENS: Array<{ label: string; href: string }> = [
  { label: 'BROWSE', href: '/styleguide/proto' },
  { label: 'LISTING', href: '/styleguide/proto/proto-01' },
  { label: 'SAVED', href: '/styleguide/proto/saved' },
  { label: 'MESSAGES', href: '/styleguide/proto/messages' },
  { label: 'THREAD', href: '/styleguide/proto/messages/t1' },
  { label: 'SELL', href: '/styleguide/proto/sell' },
  { label: 'NEW LISTING', href: '/styleguide/proto/sell/new' },
  { label: 'SETTINGS', href: '/styleguide/proto/settings' },
  { label: 'ORDERS', href: '/styleguide/proto/settings/orders' },
]

const SANS_SCALE: Array<{ px: number; weight: number; label: string; sample: string }> = [
  { px: 30, weight: 300, label: 'PAGE TITLE / 30', sample: 'Saved.' },
  { px: 26, weight: 300, label: 'PAGE TITLE SM / 26', sample: 'Your sizes.' },
  { px: 22, weight: 300, label: 'SELLER NAME / 22', sample: 'Archive seller' },
  { px: 18, weight: 300, label: 'EMPTY TITLE / 18', sample: 'Nothing saved yet.' },
  { px: 15, weight: 300, label: 'ROW QUERY / 15', sample: 'Margiela tabi boots 41' },
  { px: 13, weight: 300, label: 'BODY / 13 (base)', sample: 'Every sale is held in escrow until you confirm delivery.' },
  { px: 12, weight: 400, label: 'CARD TITLE / 12', sample: 'Bomber jacket with removable liner' },
  { px: 11, weight: 300, label: 'NOTE / 11', sample: 'Shipping was paid by the buyer.' },
]

const MONO_SCALE: Array<{ px: number; weight: number; tracking: string; label: string; sample: string }> = [
  { px: 14, weight: 400, tracking: '0', label: 'TOTAL / 14', sample: '$1,240' },
  { px: 12, weight: 400, tracking: '0', label: 'PRICE · VALUE / 12', sample: '$385 · SIZE 48' },
  { px: 11, weight: 400, tracking: '0.14em', label: 'SECTION LABEL / 11', sample: '01 — SHIPPING ADDRESS' },
  { px: 10, weight: 400, tracking: '0.2em', label: 'BUTTON / 10', sample: 'BUY NOW — HELD IN ESCROW' },
  { px: 9, weight: 300, tracking: '0.12em', label: 'NOTE · CHIP / 9', sample: '2,418 ITEMS · US ONLY' },
  { px: 8, weight: 400, tracking: '0.12em', label: 'TAG / 8', sample: 'VERIFIED' },
]

/* ─── Small building blocks ──────────────────────────────────────────────── */

function Swatch({ name, light, dark, usage }: (typeof TOKENS)[number]) {
  return (
    <div className="row" style={{ gap: 14, padding: '8px 0', borderBottom: '1px solid var(--line-row)' }}>
      <div
        style={{ width: 56, height: 36, background: `var(${name})`, border: '1px solid var(--line-mid)', flexShrink: 0 }}
        aria-label={light}
        title={`${name}: ${light} light / ${dark} dark`}
      />
      <div className="grow">
        <div className="mono-note mono-note--ink">{name}</div>
        <div className="mono-note">LIGHT {light.toUpperCase()} · DARK {dark.toUpperCase()}</div>
      </div>
      <div className="settings-note" style={{ textAlign: 'right' }}>{usage}</div>
    </div>
  )
}

export default async function StyleguidePage() {
  const username = await getViewerUsername()

  return (
    <AppShell username={username}>
      <main className="page-main">
        <div className="crumb">INTERNAL / STYLEGUIDE</div>
        <div className="page-head page-head--ruled">
          <h1 className="page-title">Styleguide.</h1>
          <span className="page-note">TOKENS · TYPE · CONTROLS · CARDS · <PrefetchLink href="/styleguide/proto">PROTO</PrefetchLink></span>
        </div>

        {/* ── Prototype index ───────────────────────────────────────────── */}
        <div className="sec-head"><span className="sec-head__label">PROTOTYPE</span><span className="page-note">FIXTURE DATA — NOT A SESSION</span></div>
        <div className="proto-index">
          {PROTO_SCREENS.map((s) => (
            <PrefetchLink key={s.href} className="proto-index__row" href={s.href} aria-label={s.label}>
              <span className="proto-index__label">{s.label}</span>
              <span className="proto-index__path">{s.href.replace('/styleguide/proto', '') || '/'}</span>
              <ArrowRightIcon size={12} />
            </PrefetchLink>
          ))}
        </div>

        {/* ── Theme ─────────────────────────────────────────────────────── */}
        <div className="sec-head"><span className="sec-head__label">THEME</span><span className="page-note">STORED PER DEVICE · APPLIED BEFORE FIRST PAINT</span></div>
        <div className="save-row save-row--left">
          <ThemeSegment options={['light', 'dark', 'system']} />
          <span className="settings-note">Every colour below is a custom property, so flipping the theme restyles this page in place.</span>
        </div>

        {/* ── Colour ────────────────────────────────────────────────────── */}
        <div className="sec-head"><span className="sec-head__label">COLOUR — {TOKENS.length} TOKENS</span><span className="page-note">THE ONLY COLOURS COMPONENTS MAY USE</span></div>
        <div className="mt-8">
          {TOKENS.map((c) => <Swatch key={c.name} {...c} />)}
        </div>
        <div className="field-label" style={{ paddingTop: 22 }}>IMAGE PLACEHOLDER TONES — --tone-1 … --tone-8</div>
        <div className="row" style={{ gap: 6 }}>
          {TONES.map((t) => (
            <div key={t} style={{ flex: 1, height: 36, background: `var(--tone-${t})`, border: '1px solid var(--line)' }} title={`--tone-${t}`} />
          ))}
        </div>
        <div className="field-label" style={{ paddingTop: 22 }}>OVERLAYS — --scrim · --sold-scrim · --badge-bg / --badge-bd / --badge-fg</div>
        <div className="row" style={{ gap: 6 }}>
          <div style={{ flex: 1, height: 36, background: 'var(--tone-3)', position: 'relative' }}><div style={{ position: 'absolute', inset: 0, background: 'var(--scrim)' }} /></div>
          <div style={{ flex: 1, height: 36, background: 'var(--tone-3)', position: 'relative' }}><div style={{ position: 'absolute', inset: 0, background: 'var(--sold-scrim)' }} /></div>
          <div style={{ flex: 1, height: 36, background: 'var(--tone-3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--badge-bg)', border: '1px solid var(--badge-bd)', color: 'var(--badge-fg)', font: '400 8px var(--font-mono)', letterSpacing: '0.12em', padding: '2px 5px' }}><Check size={9} weight="bold" aria-hidden="true" />AUTH</span>
          </div>
        </div>

        {/* ── Type ──────────────────────────────────────────────────────── */}
        <div className="sec-head"><span className="sec-head__label">TYPE — TWO FAMILIES</span><span className="page-note">ARCHIVO FOR COPY · IBM PLEX MONO FOR ALL DATA</span></div>
        <div className="field-grid" style={{ gap: 40 }}>
          <div>
            <div className="field-label">ARCHIVO · 300 / 400 / 500</div>
            <p data-testid="font-sans" style={{ fontFamily: 'var(--font-sans)', fontSize: 22, fontWeight: 300, margin: '6px 0 0', lineHeight: 1.2 }}>
              Archivo — chrome, headings and every sentence a person reads.
            </p>
            <div className="mt-16">
              {SANS_SCALE.map((s) => (
                <div key={s.label} className="row" style={{ gap: 18, padding: '7px 0', borderBottom: '1px solid var(--line-row)', alignItems: 'baseline' }}>
                  <span className="mono-note" style={{ width: 120, flexShrink: 0 }}>{s.label}</span>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: s.px, fontWeight: s.weight, lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.sample}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="field-label">IBM PLEX MONO · 300 / 400</div>
            <p data-testid="font-mono" style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 400, margin: '6px 0 0', lineHeight: 1.4 }}>
              $385 · SIZE 48 · 2,418 ITEMS · 14M AGO
            </p>
            <div className="mt-16">
              {MONO_SCALE.map((s) => (
                <div key={s.label} className="row" style={{ gap: 18, padding: '7px 0', borderBottom: '1px solid var(--line-row)', alignItems: 'baseline' }}>
                  <span className="mono-note" style={{ width: 120, flexShrink: 0 }}>{s.label}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: s.px, fontWeight: s.weight, letterSpacing: s.tracking, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{s.sample}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Controls ──────────────────────────────────────────────────── */}
        <div className="sec-head"><span className="sec-head__label">CONTROLS</span><span className="page-note">0 RADIUS · 1PX BORDERS · MONO LABELS</span></div>
        <div className="field-grid" style={{ gap: 40 }}>
          <div>
            <div className="field-label">BUTTONS</div>
            <button type="button" className="btn-primary">BUY NOW — HELD IN ESCROW</button>
            <button type="button" className="btn-ink" style={{ marginTop: 8 }}>MAKE AN OFFER</button>
            <button type="button" className="btn-ghost" style={{ marginTop: 8 }}>MESSAGE SELLER</button>
            <div className="row row--wrap" style={{ gap: 8, paddingTop: 14 }}>
              <button type="button" className="btn-primary btn-primary--inline">INLINE PRIMARY</button>
              <button type="button" className="btn-ghost btn-ghost--inline">INLINE GHOST</button>
              <button type="button" className="btn-outline btn-outline--mono">OUTLINE</button>
              <button type="button" className="btn-follow">FOLLOW</button>
              <button type="button" className="btn-follow is-on">FOLLOWING</button>
              <button type="button" className="btn-mini btn-mini--solid">MINI SOLID</button>
              <button type="button" className="btn-mini btn-mini--outline">MINI OUTLINE</button>
              <button type="button" className="btn-primary btn-primary--inline" disabled>DISABLED</button>
            </div>
            <div className="field-label" style={{ paddingTop: 22 }}>TAGS</div>
            <div className="row row--wrap" style={{ gap: 6 }}>
              <span className="tag">TAG</span>
              <span className="tag tag--ink">SOLID</span>
              <span className="tag tag--alert">ALERT</span>
              <span className="tag tag--lg">LARGE</span>
            </div>
            <div className="field-label" style={{ paddingTop: 22 }}>TEXT LINES</div>
            <div className="mono-note">MONO NOTE — 9PX FAINT, TRACKED</div>
            <div className="alert-line" style={{ paddingTop: 6 }}>ALERT LINE — ERRORS ONLY</div>
            <div className="ok-line" style={{ paddingTop: 6 }}>OK LINE — CONFIRMATIONS</div>
            <p className="body-copy" style={{ margin: '10px 0 0' }}>Body copy at 13/300. Sentences, not labels. One idea per line where it can be helped.</p>
          </div>
          <div>
            <div className="field-label">INPUTS</div>
            <div className="field-block" style={{ paddingTop: 0 }}>
              <label className="field-label" htmlFor="sg-sans">SANS INPUT</label>
              <input id="sg-sans" className="input-sans" placeholder="Name on the label" />
            </div>
            <div className="field-block">
              <label className="field-label" htmlFor="sg-mono">MONO INPUT</label>
              <input id="sg-mono" className="input-mono" placeholder="NY 10001" />
            </div>
            <div className="field-block">
              <div className="field-label">SELECT ROW</div>
              <div className="select-row">United States<span className="select-row__caret">US</span></div>
            </div>
            <div className="field-block">
              <div className="field-label">OPTION CELLS</div>
              <div className="option-grid" style={{ paddingTop: 0 }}>
                <div className="option-cell is-on"><span className="option-cell__t">7 days</span><span className="option-cell__s">$6 · $0.86/DAY</span></div>
                <div className="option-cell"><span className="option-cell__t">14 days</span><span className="option-cell__s">$10 · $0.71/DAY</span></div>
                <div className="option-cell"><span className="option-cell__t">30 days</span><span className="option-cell__s">$18 · $0.60/DAY</span></div>
              </div>
            </div>
            <div className="field-block">
              <div className="field-label">KEY / VALUE + PANEL</div>
              <div className="panel">
                <div className="panel__title">YOUR ORDER</div>
                <div className="kv"><span className="kv__k">ITEM</span><span className="kv__v">$385</span></div>
                <div className="kv"><span className="kv__k">SHIPPING</span><span className="kv__v kv__v--dim">INCLUDED</span></div>
                <div className="kv kv--total"><span className="kv__k">TOTAL</span><span className="kv__v">$385</span></div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Listing card ──────────────────────────────────────────────── */}
        <div className="sec-head"><span className="sec-head__label">LISTING CARD — SKELETON</span><span className="page-note">3:4 MEDIA · BRAND / TITLE / PRICE ROWS</span></div>
        <div className="grid" style={{ paddingTop: 16 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} aria-label="Listing card skeleton">
              <CardGhost />
            </div>
          ))}
        </div>

        {/* ── Timeline ──────────────────────────────────────────────────── */}
        <div className="sec-head"><span className="sec-head__label">ESCROW TIMELINE</span><span className="page-note">DONE · NOW · NEXT</span></div>
        <div className="timeline" style={{ maxWidth: 440, paddingTop: 8 }}>
          <div className="timeline__step is-done"><span className="timeline__dot" /><div><div className="timeline__label">PAID — HELD IN ESCROW</div><div className="timeline__meta">SEP 1 · 14:02</div></div></div>
          <div className="timeline__step is-now"><span className="timeline__dot" /><div><div className="timeline__label">SELLER CONFIRMED</div><div className="timeline__meta">SHIPS WITHIN 3 DAYS</div></div></div>
          <div className="timeline__step"><span className="timeline__dot" /><div><div className="timeline__label">SHIPPED</div><div className="timeline__meta">PREPAID, TRACKED LABEL</div></div></div>
          <div className="timeline__step"><span className="timeline__dot" /><div><div className="timeline__label">DELIVERED — FUNDS RELEASE</div><div className="timeline__meta">AUTO-RELEASE 3 DAYS AFTER</div></div></div>
        </div>

        {/* ── Rules ─────────────────────────────────────────────────────── */}
        <div className="sec-head"><span className="sec-head__label">RULES</span><span className="page-note">FROM THE DESIGN REVIEW</span></div>
        <div className="mt-8">
          <div className="kv"><span className="kv__k">COLOUR</span><span className="kv__v kv__v--dim" style={{ textAlign: 'left', flex: 1 }}>ONLY THE TOKENS ABOVE — NO LITERAL HEX IN COMPONENTS, NO GRADIENTS, NO SHADOWS</span></div>
          <div className="kv"><span className="kv__k">DATA</span><span className="kv__v kv__v--dim" style={{ textAlign: 'left', flex: 1 }}>PRICES, SIZES, COUNTS, TIMESTAMPS, LABELS AND TAGS ARE ALWAYS MONO</span></div>
          <div className="kv"><span className="kv__k">SHAPE</span><span className="kv__v kv__v--dim" style={{ textAlign: 'left', flex: 1 }}>0PX RADIUS EVERYWHERE · 1PX HAIRLINES · 44PX CONTROL HEIGHT</span></div>
          <div className="kv"><span className="kv__k">THEME</span><span className="kv__v kv__v--dim" style={{ textAlign: 'left', flex: 1 }}>LIGHT, DARK AND SYSTEM — COMPONENTS NEVER BRANCH ON THEME, THEY USE TOKENS</span></div>
          <div className="kv"><span className="kv__k">MOTION</span><span className="kv__v kv__v--dim" style={{ textAlign: 'left', flex: 1 }}>OPACITY ON HOVER · 0.2S COLOUR TRANSITIONS · NOTHING ELSE MOVES</span></div>
        </div>
      </main>
    </AppShell>
  )
}
