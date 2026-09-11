'use client'

/**
 * Design tuner (development only): a DialKit panel bound to the design system, mounted
 * on every page by app/layout.tsx through ./dev-tuner.tsx.
 *
 * Every entry in DIALS maps one panel path to one place in app/globals.css: a colour
 * token per theme, a numeric token on :root, or one declaration on one selector. Live
 * values are written to a <style> element kept at the end of <head>, after the app
 * stylesheet, so whatever page is open restyles in place; the panel survives client
 * navigations, so tune on /browse, a listing, /styleguide, anywhere. globals.css
 * itself is never touched.
 *
 * Applying tuned values: Copy in the panel puts { "folder.key": value } pairs on the
 * clipboard. For each pair whose value differs from the default here, find its DIALS
 * entry and write the value into globals.css at that selector and property (or that
 * token, in that theme), then update the default (TOKENS for colours) so the panel
 * starts from what shipped.
 *
 * Bounds encode the house rules: the control height bottoms out at 44px and operated
 * or read type at 11px. Every rule dial defaults to the value currently in the
 * stylesheet, so an untouched panel changes nothing. The contrast readout (bottom left,
 * shown only while the panel is open) recomputes the WCAG ratios from the live tokens
 * (text 7:1 AAA, control edges 3:1).
 *
 * Loaded only through ./dev-tuner.tsx, which drops this import from production builds.
 * DialKit's own stylesheet comes from ./dev-tuner-styles.tsx (inlined by the layout).
 */
import { useEffect, useMemo, useState } from 'react'
import { DialRoot, useDialKit, type DialConfig } from 'dialkit'
import { TOKENS } from '@/app/styleguide/tokens'

type Theme = 'light' | 'dark'
type ColorDial = { kind: 'color'; path: string; token: string; theme: Theme; value: string }
type VarDial = { kind: 'var'; path: string; token: string; unit: string; value: number; min: number; max: number; step?: number }
type RuleDial = { kind: 'rule'; path: string; selector: string; props: string[]; unit: string; value: number; min: number; max: number; step?: number; media?: string }
type Dial = ColorDial | VarDial | RuleDial

/* Breakpoints from globals.css: the header collapses to two rows at 720, the rail and
   the four-up grid go away at 960. Dials whose base rule is overridden inside a media
   block are scoped to the range where the base rule applies. */
const DESKTOP = '(min-width: 721px)'
const WIDE = '(min-width: 961px)'
const NARROW = '(max-width: 960px)'

/** '--on-ink' → 'onInk' (panel keys). */
const keyOf = (token: string) => token.slice(2).replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())

const DIALS: Dial[] = [
  ...TOKENS.map((t): ColorDial => ({ kind: 'color', path: `light.${keyOf(t.name)}`, token: t.name, theme: 'light', value: t.light })),
  ...TOKENS.map((t): ColorDial => ({ kind: 'color', path: `dark.${keyOf(t.name)}`, token: t.name, theme: 'dark', value: t.dark })),

  { kind: 'var',  path: 'controls.controlHeight', token: '--control-h', unit: 'px', value: 44, min: 44, max: 60 },
  { kind: 'rule', path: 'controls.buttonType', selector: '.btn-primary, .btn-ink, .btn-ghost', props: ['font-size'], unit: 'px', value: 11, min: 11, max: 14 },

  { kind: 'rule', path: 'header.logoSize', selector: '.header__logo', props: ['font-size'], unit: 'px', value: 15, min: 11, max: 20, media: DESKTOP },
  { kind: 'rule', path: 'header.navGlyph', selector: '.nav-icon svg', props: ['width', 'height'], unit: 'px', value: 15, min: 12, max: 24 },
  { kind: 'rule', path: 'header.navGlyphMobile', selector: '.header .nav-icon svg', props: ['width', 'height'], unit: 'px', value: 20, min: 16, max: 28, media: NARROW },
  { kind: 'rule', path: 'header.navLabel', selector: '.nav-icon__label', props: ['font-size'], unit: 'px', value: 11, min: 11, max: 13 },
  { kind: 'rule', path: 'header.searchType', selector: '.search input', props: ['font-size'], unit: 'px', value: 14, min: 11, max: 16 },
  { kind: 'rule', path: 'header.avatarBox', selector: '.avatar__box', props: ['width', 'height'], unit: 'px', value: 26, min: 22, max: 32 },

  { kind: 'rule', path: 'cards.rowGap', selector: '.grid', props: ['row-gap'], unit: 'px', value: 36, min: 8, max: 64, media: WIDE },
  { kind: 'rule', path: 'cards.columnGap', selector: '.grid', props: ['column-gap'], unit: 'px', value: 20, min: 8, max: 48, media: WIDE },
  { kind: 'rule', path: 'cards.brand', selector: '.card__brand', props: ['font-size'], unit: 'px', value: 12, min: 11, max: 14 },
  { kind: 'rule', path: 'cards.title', selector: '.card__title', props: ['font-size'], unit: 'px', value: 13, min: 11, max: 15 },
  { kind: 'rule', path: 'cards.price', selector: '.card__price', props: ['font-size'], unit: 'px', value: 14, min: 11, max: 16 },

  { kind: 'rule', path: 'type.pageTitle', selector: '.page-title:not(.page-title--sm)', props: ['font-size'], unit: 'px', value: 30, min: 20, max: 40 },
  { kind: 'rule', path: 'type.sectionLabel', selector: '.sec-head__label', props: ['font-size'], unit: 'px', value: 11, min: 11, max: 13 },
  { kind: 'rule', path: 'type.monoNote', selector: '.mono-note', props: ['font-size'], unit: 'px', value: 11, min: 11, max: 13 },
  { kind: 'rule', path: 'type.fieldLabel', selector: '.field-label', props: ['font-size'], unit: 'px', value: 9, min: 9, max: 12 },
  { kind: 'rule', path: 'type.pageNote', selector: '.page-note:not(.page-note--alert)', props: ['font-size'], unit: 'px', value: 9, min: 9, max: 12 },
  { kind: 'rule', path: 'type.tag', selector: '.tag:not(.tag--lg)', props: ['font-size'], unit: 'px', value: 10, min: 10, max: 12 },
]

/* Folders that start closed, so the panel sits at the bottom right instead of filling
   the viewport; controls and header stay open. */
const COLLAPSED = ['light', 'dark', 'cards', 'type']

function buildConfig(dials: Dial[]): DialConfig {
  const config: DialConfig = {}
  for (const d of dials) {
    const [folder, key] = d.path.split('.')
    const group = (config[folder] ??= {}) as DialConfig
    // Whole pixels unless a dial says otherwise (DialKit would infer tenths for small ranges).
    const step = d.kind === 'color' ? undefined : (d.step ?? (d.unit === 'px' ? 1 : undefined))
    group[key] = d.kind === 'color' ? d.value : step ? [d.value, d.min, d.max, step] : [d.value, d.min, d.max]
  }
  for (const folder of COLLAPSED) (config[folder] as DialConfig)._collapsed = true
  return config
}

const CONFIG = buildConfig(DIALS)

/* The floating readout's own rules ride in the injected sheet, so globals.css stays untouched.
   It sits above the Next dev indicator, which also lives bottom left. */
const READOUT_CSS = [
  '.dev-tuner-readout { position: fixed; left: 16px; bottom: 64px; z-index: 60; padding: 8px 12px; background: var(--bg); border: 1px solid var(--line-mid); font: 300 11px var(--font-mono); letter-spacing: 0.12em; color: var(--faint); line-height: 1.7; white-space: nowrap; }',
  '.dev-tuner-readout__line { display: block; }',
  '@media (max-width: 720px) { .dev-tuner-readout { display: none; } }',
].join('\n')

/* WCAG 2.x contrast. The canvas parses any colour notation the panel can produce. */
type Rgb = [number, number, number]
function rgbOf(color: string, ctx: CanvasRenderingContext2D): Rgb | null {
  ctx.fillStyle = '#010203'
  ctx.fillStyle = color
  if (ctx.fillStyle === '#010203' && !/^#010203$/i.test(color.trim())) return null
  ctx.clearRect(0, 0, 1, 1)
  ctx.fillRect(0, 0, 1, 1)
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
  return [r, g, b]
}
function luminance([r, g, b]: Rgb) {
  const lin = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}
function contrast(a: Rgb, b: Rgb) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/* Pairs the readout checks: label, foreground token, background token, required ratio. */
const PAIRS: Array<[string, string, string, number]> = [
  ['INK', '--ink', '--bg', 7],
  ['SUB', '--sub', '--bg', 7],
  ['FAINT', '--faint', '--bg', 7],
  ['ALERT', '--alert', '--bg', 7],
  ['ON-INK', '--on-ink', '--ink', 7],
  ['LINE-MID', '--line-mid', '--bg', 3],
]

export default function TunerPanel() {
  const values = useDialKit('Styleguide', CONFIG, { id: 'styleguide-tuner', persist: true }) as unknown as Record<string, Record<string, unknown>>

  /* One stylesheet from the live values. Colour tokens go on :root and the dark block
     (same specificity as globals.css, later in the cascade, so they win). */
  const css = useMemo(() => {
    const read = (path: string) => { const [f, k] = path.split('.'); return values[f]?.[k] }
    const light: string[] = []
    const dark: string[] = []
    const rules: string[] = []
    for (const d of DIALS) {
      const v = read(d.path)
      if (d.kind === 'color') {
        if (typeof v === 'string') (d.theme === 'dark' ? dark : light).push(`${d.token}: ${v};`)
      } else if (d.kind === 'var') {
        if (typeof v === 'number') light.push(`${d.token}: ${v}${d.unit};`)
      } else if (typeof v === 'number') {
        const decl = `${d.selector} { ${d.props.map((p) => `${p}: ${v}${d.unit};`).join(' ')} }`
        rules.push(d.media ? `@media ${d.media} { ${decl} }` : decl)
      }
    }
    return [READOUT_CSS, `:root { ${light.join(' ')} }`, `[data-theme='dark'] { ${dark.join(' ')} }`, ...rules].join('\n')
  }, [values])

  useEffect(() => {
    const el = document.createElement('style')
    el.id = 'dev-tuner'
    document.head.append(el)
    return () => el.remove()
  }, [])
  useEffect(() => {
    const el = document.getElementById('dev-tuner')
    if (!el) return
    el.textContent = css
    document.head.append(el) // keeps it last; a CSS hot reload in dev appends after it otherwise
  }, [css])

  /* Contrast readout, one line per theme, from the live token values. */
  const readout = useMemo(() => {
    const out: Record<Theme, string[]> = { light: [], dark: [] }
    const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })
    if (!ctx) return out
    for (const theme of ['light', 'dark'] as const) {
      const color = (token: string) => {
        const v = values[theme]?.[keyOf(token)]
        return typeof v === 'string' ? rgbOf(v, ctx) : null
      }
      for (const [label, fg, bg, need] of PAIRS) {
        const a = color(fg)
        const b = color(bg)
        if (!a || !b) { out[theme].push(`${label} ?`); continue }
        const ratio = contrast(a, b)
        const grade = need === 7 ? (ratio >= 7 ? 'AAA' : ratio >= 4.5 ? 'AA' : 'FAIL') : ratio >= 3 ? 'OK' : 'FAIL'
        out[theme].push(`${label} ${ratio.toFixed(1)} ${grade}`)
      }
    }
    return out
  }, [values])

  /* The readout follows the panel: collapse the panel and the page is clean. */
  const [open, setOpen] = useState(true)

  return (
    <>
      {open && <div className="dev-tuner-readout" aria-label="Token contrast">
        {(['light', 'dark'] as const).map((theme) => (
          <span key={theme} className="dev-tuner-readout__line">
            {theme.toUpperCase()}
            {readout[theme].map((item) => (
              <span key={item}><span className="sep" aria-hidden="true" />{item}</span>
            ))}
          </span>
        ))}
      </div>}
      <DialRoot position="bottom-right" theme="system" defaultOpen onOpenChange={setOpen} />
    </>
  )
}
