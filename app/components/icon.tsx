'use client'

import {
  Bell,
  BookmarkSimple,
  CaretDown,
  CaretUp,
  ChatCircle,
  Check,
  MagnifyingGlass,
  SealCheck,
  Minus,
  Plus,
  Rows,
  ShareNetwork,
  User,
  X,
  type Icon as PhosphorIcon,
  type IconWeight,
} from '@phosphor-icons/react'
import { useStudio } from './studio'

export const ICON_NAMES = [
  'search',
  'save',
  'feed',
  'sell',
  'messages',
  'you',
  'bell',
  'caretDown',
  'caretUp',
  'check',
  'verified',
  'close',
  'plus',
  'minus',
  'share',
] as const

export type IconName = (typeof ICON_NAMES)[number]

const MAP: Record<IconName, PhosphorIcon> = {
  search: MagnifyingGlass,
  save: BookmarkSimple,
  feed: Rows,
  sell: Plus,
  messages: ChatCircle,
  you: User,
  bell: Bell,
  caretDown: CaretDown,
  caretUp: CaretUp,
  check: Check,
  verified: SealCheck,
  close: X,
  plus: Plus,
  minus: Minus,
  share: ShareNetwork,
}

type Props = {
  name: IconName
  size?: number
  weight?: IconWeight
  label?: string
}

/**
 * One mark family for the whole site. Phosphor Thin — line, not fill.
 * Weight and size come from the studio so the catalog stays consistent.
 */
export default function Icon({ name, size, weight, label }: Props) {
  const studio = useStudio()
  const Cmp = MAP[name]
  return (
    <Cmp
      size={size ?? studio.iconSize}
      weight={weight ?? studio.iconWeight}
      color="currentColor"
      aria-hidden={label ? undefined : true}
      aria-label={label}
    />
  )
}
