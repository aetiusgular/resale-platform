'use client'

import { createContext, useContext, type ReactNode } from 'react'
import type { IconWeight } from '@phosphor-icons/react'

export type SaveStyle = 'mark' | 'word' | 'both'
export type NavStyle = 'text' | 'icon' | 'both'
export type FrameStyle = 'hairline' | 'none' | 'inset'
export type ImageFit = 'cover' | 'contain'

export type StudioValues = {
  ground: string
  ink: string
  inkSoft: string
  line: string
  alert: string
  radius: number
  gridGapX: number
  gridGapY: number
  iconWeight: IconWeight
  iconSize: number
  save: SaveStyle
  nav: NavStyle
  frame: FrameStyle
  imageFit: ImageFit
  titleWeight: number
  showFact: boolean
}

export const STUDIO_DEFAULTS: StudioValues = {
  ground: '#121110',
  ink: '#F4F1EA',
  inkSoft: '#C8C3B8',
  line: '#3A3833',
  alert: '#E07064',
  radius: 0,
  gridGapX: 24,
  gridGapY: 40,
  iconWeight: 'thin',
  iconSize: 18,
  save: 'mark',
  nav: 'both',
  frame: 'hairline',
  imageFit: 'cover',
  titleWeight: 500,
  showFact: true,
}

export const LOOKS = {
  paper: {
    ground: '#FFFFFF',
    ink: '#111111',
    inkSoft: '#696969',
    line: '#DEDEDE',
    alert: '#B93D3D',
  },
  cream: {
    ground: '#F6F1E8',
    ink: '#1A1714',
    inkSoft: '#7A7268',
    line: '#D8D0C4',
    alert: '#B93D3D',
  },
  night: {
    ground: '#121110',
    ink: '#F4F1EA',
    inkSoft: '#C8C3B8',
    line: '#3A3833',
    alert: '#E07064',
  },
} as const

const StudioContext = createContext<StudioValues>(STUDIO_DEFAULTS)

export function useStudio(): StudioValues {
  return useContext(StudioContext)
}

export function StudioProvider({
  value,
  children,
}: {
  value: StudioValues
  children: ReactNode
}) {
  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>
}

function hexLuminance(hex: string): number {
  const n = hex.replace('#', '')
  if (n.length !== 6) return 1
  const r = parseInt(n.slice(0, 2), 16) / 255
  const g = parseInt(n.slice(2, 4), 16) / 255
  const b = parseInt(n.slice(4, 6), 16) / 255
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function applyStudioVars(s: StudioValues) {
  const r = document.documentElement
  r.style.setProperty('--color-bg', s.ground)
  r.style.setProperty('--color-ink', s.ink)
  r.style.setProperty('--color-ink-soft', s.inkSoft)
  r.style.setProperty('--color-line', s.line)
  r.style.setProperty('--color-accent', s.ink)
  r.style.setProperty('--color-alert', s.alert)
  r.style.setProperty('--radius', `${s.radius}px`)
  r.style.setProperty('--grid-gap-x', `${s.gridGapX}px`)
  r.style.setProperty('--grid-gap-y', `${s.gridGapY}px`)
  r.style.setProperty('--icon-size', `${s.iconSize}px`)
  const light = hexLuminance(s.ground) > 0.45
  r.style.setProperty('--color-overlay', light ? 'rgba(247, 247, 247, 0.92)' : 'rgba(14, 14, 13, 0.88)')
}
