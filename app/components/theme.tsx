'use client'

/**
 * Theme — light / dark / system, persisted under `archive-theme` and applied as
 * `data-theme` on <html> (every colour is a CSS custom property, so the attribute
 * flip restyles the whole app). The inline script in app/layout.tsx applies the
 * stored value before first paint; this module keeps it in sync afterwards.
 *
 * Built on useSyncExternalStore so the server snapshot ('system' / 'light') never
 * touches localStorage and no setState runs synchronously inside an effect.
 */
import { useSyncExternalStore } from 'react'
import { THEME_STORAGE_KEY } from './theme-bootstrap'

export { THEME_STORAGE_KEY, THEME_BOOTSTRAP_SCRIPT } from './theme-bootstrap'

export type Theme = 'light' | 'dark'
export type ThemeSetting = Theme | 'system'

const listeners = new Set<() => void>()

function readSetting(): ThemeSetting {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY)
    return v === 'light' || v === 'dark' || v === 'system' ? v : 'system'
  } catch {
    return 'system'
  }
}

function systemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function resolve(setting: ThemeSetting): Theme {
  return setting === 'system' ? systemTheme() : setting
}

function apply() {
  document.documentElement.dataset.theme = resolve(readSetting())
}

function notify() {
  listeners.forEach((l) => l())
}

export function setThemeSetting(setting: ThemeSetting) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, setting)
  } catch {
    /* private mode — theme just won't persist */
  }
  apply()
  notify()
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  const onMq = () => { apply(); cb() }
  const onStorage = (e: StorageEvent) => { if (e.key === THEME_STORAGE_KEY) { apply(); cb() } }
  mq.addEventListener('change', onMq)
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(cb)
    mq.removeEventListener('change', onMq)
    window.removeEventListener('storage', onStorage)
  }
}

const getSettingSnapshot = () => readSetting()
const getThemeSnapshot = () => resolve(readSetting())
const serverSetting = (): ThemeSetting => 'system'
const serverTheme = (): Theme => 'light'

export function useTheme(): { setting: ThemeSetting; theme: Theme; setSetting: (s: ThemeSetting) => void } {
  const setting = useSyncExternalStore(subscribe, getSettingSnapshot, serverSetting)
  const theme = useSyncExternalStore(subscribe, getThemeSnapshot, serverTheme)
  return { setting, theme, setSetting: setThemeSetting }
}

import { Sun, Moon, Monitor } from '@phosphor-icons/react/ssr'

const THEME_ICON = { light: Sun, dark: Moon, system: Monitor } as const

/** Segmented LIGHT / DARK (/ SYSTEM) control — icon-only, used in the account popout and Settings. */
export function ThemeSegment({ options }: { options: ThemeSetting[]; compact?: boolean }) {
  const { setting, theme, setSetting } = useTheme()
  // Two-option control (popout) highlights the RESOLVED theme; the three-option
  // control (Settings) highlights the stored setting so SYSTEM is selectable.
  const current = options.includes('system') ? setting : theme
  return (
    <span className="seg" role="radiogroup" aria-label="Theme">
      {options.map((s) => (
        <button
          key={s}
          type="button"
          role="radio"
          aria-checked={current === s}
          className={`seg__opt${current === s ? ' is-on' : ''}`}
          onClick={() => setSetting(s)}
          aria-label={s.toUpperCase()}
          title={s.toUpperCase()}
        >
          {(() => { const Icon = THEME_ICON[s]; return <Icon size={16} aria-hidden="true" /> })()}
        </button>
      ))}
    </span>
  )
}
