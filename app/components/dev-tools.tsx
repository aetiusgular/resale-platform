'use client'

import { useEffect, useRef } from 'react'
import { Agentation } from 'agentation'
import { DialRoot, useDialKitController } from 'dialkit'
import 'dialkit/styles.css'
import {
  LOOKS,
  STUDIO_DEFAULTS,
  type FrameStyle,
  type ImageFit,
  type NavStyle,
  type SaveStyle,
  type StudioValues,
} from './studio'
import type { IconWeight } from '@phosphor-icons/react'

const CONFIG = {
  look: {
    ground: STUDIO_DEFAULTS.ground,
    ink: STUDIO_DEFAULTS.ink,
    inkSoft: STUDIO_DEFAULTS.inkSoft,
    line: STUDIO_DEFAULTS.line,
    alert: STUDIO_DEFAULTS.alert,
    radius: [STUDIO_DEFAULTS.radius, 0, 8, 1] as [number, number, number, number],
  },
  catalog: {
    gridGapX: [STUDIO_DEFAULTS.gridGapX, 8, 40, 1] as [number, number, number, number],
    gridGapY: [STUDIO_DEFAULTS.gridGapY, 8, 64, 1] as [number, number, number, number],
    frame: {
      type: 'select' as const,
      options: [
        { value: 'hairline', label: 'Hairline' },
        { value: 'none', label: 'No frame' },
        { value: 'inset', label: 'Inset' },
      ],
      default: STUDIO_DEFAULTS.frame,
    },
    imageFit: {
      type: 'select' as const,
      options: [
        { value: 'cover', label: 'Crop' },
        { value: 'contain', label: 'Letterbox' },
      ],
      default: STUDIO_DEFAULTS.imageFit,
    },
    titleWeight: {
      type: 'select' as const,
      options: [
        { value: '400', label: 'Roman 400' },
        { value: '500', label: 'Medium 500' },
        { value: '700', label: 'Bold 700' },
      ],
      default: '500',
    },
    showFact: STUDIO_DEFAULTS.showFact,
    save: {
      type: 'select' as const,
      options: [
        { value: 'mark', label: 'Bookmark' },
        { value: 'word', label: 'Word' },
        { value: 'both', label: 'Both' },
      ],
      default: STUDIO_DEFAULTS.save,
    },
  },
  marks: {
    iconWeight: {
      type: 'select' as const,
      options: [
        { value: 'thin', label: 'Thin' },
        { value: 'light', label: 'Light' },
        { value: 'regular', label: 'Regular' },
      ],
      default: STUDIO_DEFAULTS.iconWeight,
    },
    iconSize: [STUDIO_DEFAULTS.iconSize, 14, 24, 1] as [number, number, number, number],
    nav: {
      type: 'select' as const,
      options: [
        { value: 'text', label: 'Text' },
        { value: 'icon', label: 'Icon' },
        { value: 'both', label: 'Icon + text' },
      ],
      default: STUDIO_DEFAULTS.nav,
    },
  },
  looks: {
    paper: { type: 'action' as const, label: 'Are.na paper' },
    cream: { type: 'action' as const, label: 'Museum cream' },
    night: { type: 'action' as const, label: 'Night bunker' },
  },
}

function toStudio(p: ReturnType<typeof useDialKitController<typeof CONFIG>>['values']): StudioValues {
  const weight = p.marks.iconWeight
  return {
    ground: p.look.ground,
    ink: p.look.ink,
    inkSoft: p.look.inkSoft,
    line: p.look.line,
    alert: p.look.alert,
    radius: p.look.radius,
    gridGapX: p.catalog.gridGapX,
    gridGapY: p.catalog.gridGapY,
    iconWeight: (weight === 'thin' || weight === 'light' || weight === 'regular' ? weight : 'thin') as IconWeight,
    iconSize: p.marks.iconSize,
    save: (p.catalog.save as SaveStyle) || 'mark',
    nav: (p.marks.nav as NavStyle) || 'both',
    frame: (p.catalog.frame as FrameStyle) || 'hairline',
    imageFit: (p.catalog.imageFit as ImageFit) || 'cover',
    titleWeight: Number(p.catalog.titleWeight) || 400,
    showFact: p.catalog.showFact,
  }
}

type Props = {
  onChange: (values: StudioValues) => void
}

export default function DevTools({ onChange }: Props) {
  const dialRef = useRef<ReturnType<typeof useDialKitController<typeof CONFIG>> | null>(null)

  const dial = useDialKitController('Archive', CONFIG, {
    id: 'archive-system-v2',
    persist: true,
    onAction: (path) => {
      const next = path === 'looks.paper'
        ? LOOKS.paper
        : path === 'looks.cream'
          ? LOOKS.cream
          : path === 'looks.night'
            ? LOOKS.night
            : null
      if (next) dialRef.current?.setValues({ look: next })
    },
  })

  useEffect(() => {
    dialRef.current = dial
  }, [dial])

  useEffect(() => {
    onChange(toStudio(dial.values))
  }, [dial.values, onChange])

  return (
    <>
      <DialRoot />
      <Agentation />
    </>
  )
}
