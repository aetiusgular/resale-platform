import type { InboxRow } from '@/lib/loaders/inbox'
import { PROTO_LISTINGS } from './fixtures'

/** Fixture inbox for the proto messages surface. Digest layout is a later design pass. */
export type ProtoLine = {
  mine: boolean
  body: string
  at: string
  kind?: 'offer'
  amount?: string
  state?: string
}
export type ProtoThread = InboxRow & { lines: ProtoLine[] }

const L = PROTO_LISTINGS

export const PROTO_THREADS: ProtoThread[] = [
  {
    id: 't1',
    handle: L[0].seller_handle,
    role: 'BUYING',
    brand: L[0].brand,
    title: L[0].title,
    price: L[0].price_display,
    status: 'active',
    image: null,
    preview: 'Still available?',
    previewMine: false,
    unread: 1,
    updated_at: '2026-09-06T18:00:00.000Z',
    lines: [
      { mine: true, body: 'Hi — is the coat still available?', at: '2026-09-06T12:00:00.000Z' },
      { mine: false, body: 'Still available?', at: '2026-09-06T18:00:00.000Z' },
    ],
  },
  {
    id: 't2',
    handle: L[2].seller_handle,
    role: 'BUYING',
    brand: L[2].brand,
    title: L[2].title,
    price: L[2].price_display,
    status: 'active',
    image: null,
    preview: 'Thanks — I’ll take them.',
    previewMine: true,
    unread: 0,
    updated_at: '2026-09-05T10:20:00.000Z',
    lines: [
      { mine: false, body: 'Box included, no extra laces.', at: '2026-09-05T09:00:00.000Z' },
      { mine: true, body: 'Thanks — I’ll take them.', at: '2026-09-05T10:20:00.000Z' },
    ],
  },
  {
    id: 't3',
    handle: L[3].seller_handle,
    role: 'SELLING',
    brand: L[3].brand,
    title: L[3].title,
    price: L[3].price_display,
    status: 'active',
    image: null,
    preview: 'Offer at $40.',
    previewMine: false,
    unread: 0,
    updated_at: '2026-09-04T16:00:00.000Z',
    lines: [
      { mine: false, kind: 'offer', body: 'Offer at $40.', amount: '$40', state: 'Pending', at: '2026-09-04T16:00:00.000Z' },
    ],
  },
]

const BY_ID = new Map(PROTO_THREADS.map((t) => [t.id, t]))

export function getProtoThread(id: string): ProtoThread | undefined {
  return BY_ID.get(id)
}
