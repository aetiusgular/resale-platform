import { describe, expect, it } from 'vitest'
import {
  countTiers, isAcceptedImage, isEditableTarget, normalizeQueryText, pasteKeyLabel, pickImageFile,
  resultsHeadline, tierOrder, QUERY_MAX_TEXT_CHARS,
} from '@/lib/visual-search/shared'

function file(type: string, name = 'x'): File {
  return new File([new Uint8Array([1, 2, 3])], name, { type })
}

/** A DataTransfer stand-in: `files` (drops, file pastes) and `items` (clipboard screenshots). */
function dt(files: File[], items: Array<{ kind: string; type: string; file: File | null }> = []) {
  return {
    files: Object.assign(files, { item: (i: number) => files[i] ?? null }) as unknown as FileList,
    items: items.map((it) => ({ kind: it.kind, type: it.type, getAsFile: () => it.file })) as unknown as DataTransferItemList,
  }
}

describe('pickImageFile', () => {
  it('takes the first accepted image from files, skipping other types', () => {
    const png = file('image/png', 'shot.png')
    expect(pickImageFile(dt([file('text/plain'), png]))).toBe(png)
  })
  it('falls back to clipboard items (screenshots have no File in files)', () => {
    const jpg = file('image/jpeg', '')
    expect(pickImageFile(dt([], [{ kind: 'string', type: 'text/plain', file: null }, { kind: 'file', type: 'image/jpeg', file: jpg }]))).toBe(jpg)
  })
  it('returns null for text-only pastes, unsupported images and no transfer', () => {
    expect(pickImageFile(dt([file('image/gif')]))).toBeNull()
    expect(pickImageFile(dt([], [{ kind: 'string', type: 'text/plain', file: null }]))).toBeNull()
    expect(pickImageFile(null)).toBeNull()
  })
  it('isAcceptedImage is case-insensitive and closed', () => {
    expect(isAcceptedImage('IMAGE/WEBP')).toBe(true)
    expect(isAcceptedImage('image/heic')).toBe(false)
  })
})

describe('query text + keys', () => {
  it('normalizes whitespace and caps the length', () => {
    expect(normalizeQueryText('  black   leather\n jacket ')).toBe('black leather jacket')
    expect(normalizeQueryText(null)).toBe('')
    expect(normalizeQueryText('x'.repeat(500))).toHaveLength(QUERY_MAX_TEXT_CHARS)
  })
  it('names the paste key per platform', () => {
    expect(pasteKeyLabel('MacIntel')).toBe('⌘V')
    expect(pasteKeyLabel('iPhone')).toBe('⌘V')
    expect(pasteKeyLabel('Win32')).toBe('CTRL+V')
    expect(pasteKeyLabel(undefined)).toBe('CTRL+V')
  })
  it('isEditableTarget covers inputs, textareas and contenteditable', () => {
    const mk = (tagName: string, editable = false) => ({ tagName, isContentEditable: editable }) as unknown as Element
    expect(isEditableTarget(mk('INPUT'))).toBe(true)
    expect(isEditableTarget(mk('TEXTAREA'))).toBe(true)
    expect(isEditableTarget(mk('DIV', true))).toBe(true)
    expect(isEditableTarget(mk('DIV'))).toBe(false)
    expect(isEditableTarget(null)).toBe(false)
  })
})

describe('results copy (R1 / R2 / M2)', () => {
  const hit = (id: string) => ({ listing_id: id }) as never
  it('counts tiers and writes the listed headline', () => {
    const counts = countTiers({ exact: [hit('a')], match: [hit('b')], close: [hit('c'), hit('d'), hit('e'), hit('f'), hit('g'), hit('h')] })
    expect(counts).toEqual({ exact: 1, match: 1, close: 6 })
    expect(resultsHeadline(counts, 'Outerwear')).toEqual({ lead: '2', meta: 'matches · 6 close in Outerwear' })
    expect(resultsHeadline({ exact: 1, match: 0, close: 3 }, null)).toEqual({ lead: '1', meta: 'match · 3 close' })
  })
  it('writes the not-listed headline', () => {
    expect(resultsHeadline({ exact: 0, match: 0, close: 6 }, 'Outerwear')).toEqual({
      lead: 'Not listed.', meta: 'These are the closest pieces · 6 close in Outerwear',
    })
  })
  it('tier order', () => {
    expect(tierOrder()).toEqual(['exact', 'match', 'close'])
  })
})
