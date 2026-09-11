/**
 * Colour tokens as shipped in app/globals.css (`:root` is light, `[data-theme='dark']`
 * is dark). The styleguide swatches and the tuner's defaults both read this table, so
 * keep it in step with the stylesheet when a token changes.
 */
export const TOKENS = [
  { name: '--bg',         light: '#f5f5f3', dark: '#131312', usage: 'Page ground' },
  { name: '--ink',        light: '#161616', dark: '#e7e7e4', usage: 'Primary text · filled surfaces' },
  { name: '--on-ink',     light: '#f5f5f3', dark: '#131312', usage: 'Text on top of --ink' },
  { name: '--sub',        light: '#3f3f3c', dark: '#b0b0ab', usage: 'Secondary text' },
  { name: '--faint',      light: '#53534e', dark: '#a0a09b', usage: 'Tertiary text · counts · notes' },
  { name: '--line',       light: '#dcdcd8', dark: '#262624', usage: 'Hairline dividers' },
  { name: '--line-row',   light: '#ececea', dark: '#1d1d1c', usage: 'Row separators inside panels' },
  { name: '--line-mid',   light: '#8a8a86', dark: '#646460', usage: 'Input + chip borders' },
  { name: '--line-hover', light: '#8a8a86', dark: '#5c5c58', usage: 'Border on hover' },
  { name: '--hover',      light: '#ececea', dark: '#1d1d1c', usage: 'Hover fill · unread rows' },
  { name: '--alert',      light: '#952e26', dark: '#de8981', usage: 'Errors + disputes only' },
] as const

export type Token = (typeof TOKENS)[number]
