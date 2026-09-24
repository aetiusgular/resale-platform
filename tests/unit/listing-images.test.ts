import { describe, it, expect } from 'vitest'
import {
  MAX_PHOTOS,
  MIN_PHOTOS,
  photoIndexForSlot,
  photoLabel,
  photoSlotName,
  POSSESSION_SLOT,
  publicImages,
} from '../../lib/listings/images'

const POSSESSION = 'https://cdn.example/possession.jpg'

describe('publicImages', () => {
  it('limits: up to 15 photos, at least 3 to publish', () => {
    expect(MAX_PHOTOS).toBe(15)
    expect(MIN_PHOTOS).toBe(3)
  })
  it('keeps the seller order (cover first), dedupes, caps at MAX_PHOTOS', () => {
    const photos = Array.from({ length: 17 }, (_, i) => `p${i + 1}.jpg`)
    expect(publicImages(photos)).toEqual(photos.slice(0, MAX_PHOTOS))
    expect(publicImages(['b.jpg', 'a.jpg', 'b.jpg'])).toEqual(['b.jpg', 'a.jpg'])
  })
  it('drops blanks, non-strings and the possession proof it is told about', () => {
    expect(publicImages(['a.jpg', '', null, 7, POSSESSION, 'b.jpg', undefined], POSSESSION)).toEqual(['a.jpg', 'b.jpg'])
    expect(publicImages(null)).toEqual([])
    expect(publicImages('a.jpg')).toEqual([])
  })
  it('legacy six-slot rows: a blank marks the layout, index 5 is the proof even when unknown', () => {
    expect(publicImages(['f', '', 't', '', '', POSSESSION])).toEqual(['f', 't'])
    // Six real photos in the list shape are six photos — only a blank marks the old layout.
    expect(publicImages(['1', '2', '3', '4', '5', '6'])).toEqual(['1', '2', '3', '4', '5', '6'])
  })
})

describe('image_hashes slots', () => {
  it('names photos PHOTO_n from their index and maps back, legacy names included', () => {
    expect(photoSlotName(0)).toBe('PHOTO_1')
    expect(photoSlotName(14)).toBe('PHOTO_15')
    expect(photoIndexForSlot('PHOTO_1')).toBe(0)
    expect(photoIndexForSlot('PHOTO_15')).toBe(14)
    expect(photoIndexForSlot('PHOTO_16')).toBeNull()
    expect(photoIndexForSlot('FRONT')).toBe(0)
    expect(photoIndexForSlot('FLAW')).toBe(4)
    expect(photoIndexForSlot(POSSESSION_SLOT)).toBeNull()
    expect(photoIndexForSlot('nope')).toBeNull()
  })
  it('labels the cover and numbers the rest', () => {
    expect(photoLabel(0)).toBe('cover')
    expect(photoLabel(1)).toBe('photo 2')
  })
})
