import { test, expect, type Page } from '@playwright/test'

/**
 * VS2 — search by image (design page 21 S0 / S3 / S4 / R1 / R2 / M0–M2; founder decision
 * 2026-09-25: the glyph opens the picker, an attached image is STAGED in the field, Enter
 * runs ONE query with the image and the words). The engine is not required:
 * `/api/search/image` is intercepted with fixtures, so these specs run against a dev server
 * with NEXT_PUBLIC_VISUAL_SEARCH_ENABLED=true and nothing else. They skip themselves when
 * the control is absent (flag off).
 */

const PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAABgAAAAgCAIAAACHPC9vAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAALUlEQVRIiWPQoBJgGDWIIBgNI8JgNIwIg9EwIgxGw4gwGA0jwmA0jAiDYRxGAOlWaBC6HfLiAAAAAElFTkSuQmCC'
const PNG = Buffer.from(PNG_B64, 'base64')

const A = '00000000-0000-4000-8000-00000000000a'
const B = '00000000-0000-4000-8000-00000000000b'
const C = '00000000-0000-4000-8000-00000000000c'

function card(id: string, brand: string, title: string) {
  return {
    id, title, brand, category: 'Outerwear', department: 'menswear', subcategory: null, size: 'M', color: 'Black',
    condition_score: 8, price_cents: 42000, saves_count: 3, is_price_dropped: false, images: [`https://example.invalid/${id}.jpg`],
    created_at: '2026-09-24T00:00:00Z', seller: { username: 'mara', id_verification_status: 'verified' },
    authentication_status: 'none', sold: false, own: false, original_price_cents: null, price_display: '$420', promoted: false,
  }
}
function hit(id: string, tier: 'exact' | 'match' | 'close', brand: string, title: string) {
  return { listing_id: id, tier, score: 0.9, hamming: null, photo_index: 0, source: 'engine', matched_photo: `https://example.invalid/${id}.jpg`, listing: card(id, brand, title) }
}
const LISTED = {
  listed: true, category: 'Outerwear', category_source: 'guess', text: null, engine: 'ok',
  exact: [hit(A, 'exact', 'POST ARCHIVE FACTION', '5.0+ Technical Jacket Center, black')],
  match: [hit(B, 'match', 'POST ARCHIVE FACTION', '5.0+ Technical Jacket Right, black')],
  close: [hit(C, 'close', 'ACRONYM', 'J1A-GT Gore-Tex Pro Jacket, black')],
  saved_ids: [],
}
const NOT_LISTED = { ...LISTED, listed: false, exact: [], match: [] }

async function interceptSearch(page: Page, body: unknown, seen: string[]) {
  await page.route('**/api/search/image**', async (route) => {
    seen.push(route.request().url())
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  })
}

async function scanControlPresent(page: Page): Promise<boolean> {
  await page.goto('/browse')
  await page.waitForLoadState('networkidle')
  return (await page.getByTestId('search-scan-btn').count()) > 0
}

/** Click the glyph, feed the native picker, and wait for the staged chip. */
async function attachViaPicker(page: Page) {
  const chooser = page.waitForEvent('filechooser')
  await page.getByTestId('search-scan-btn').click()
  await (await chooser).setFiles({ name: 'q.png', mimeType: 'image/png', buffer: PNG })
  await expect(page.getByTestId('search-chip')).toHaveAttribute('data-state', 'staged')
}

const field = (page: Page) => page.getByTestId('search-field').locator('input[name="q"]')

test.describe('Search by image — desktop header', () => {
  test('the glyph opens the file picker; the image is staged, not searched; Enter runs ONE query with the words', async ({ page }) => {
    test.skip(!(await scanControlPresent(page)), 'NEXT_PUBLIC_VISUAL_SEARCH_ENABLED is off')
    const seen: string[] = []
    await interceptSearch(page, LISTED, seen)
    await attachViaPicker(page)
    await expect(page.getByTestId('search-chip')).toContainText('IMAGE')
    await expect(field(page)).toHaveAttribute('placeholder', 'Add words to narrow it')
    await expect(field(page)).toBeFocused()
    expect(seen).toHaveLength(0) // nothing sent yet
    await expect(page).toHaveURL(/\/browse/)

    await field(page).fill('black leather')
    await field(page).press('Enter')
    await expect(page).toHaveURL(/\/search\/image$/)
    expect(seen).toHaveLength(1) // image + words in one request
    expect(new URL(seen[0]).searchParams.get('q')).toBe('black leather')
    await expect(page.getByTestId('vs-headline')).toContainText('2')
    await expect(page.getByTestId('vs-headline')).toContainText('matches · 1 close in Outerwear')
    await expect(page.getByTestId('vs-matches').locator('[data-testid="listing-card"]')).toHaveCount(2)
    await expect(page.getByTestId('vs-close').locator('[data-testid="listing-card"]')).toHaveCount(1)
    await expect(page.getByTestId('search-chip')).toHaveAttribute('data-state', 'query')
    await expect(page.getByTestId('search-chip')).toContainText('OUTERWEAR')
    await expect(field(page)).toHaveValue('black leather')

    // new words re-run the same image
    await field(page).fill('grey wool')
    await field(page).press('Enter')
    await expect.poll(() => seen.length).toBe(2)
    expect(new URL(seen[1]).searchParams.get('q')).toBe('grey wool')

    // ALL CATEGORIES drops the guess: auto_category=0, no category
    await page.getByTestId('vs-all-categories').click()
    await expect.poll(() => seen.length).toBe(3)
    expect(new URL(seen[2]).searchParams.get('auto_category')).toBe('0')
    expect(new URL(seen[2]).searchParams.has('category')).toBe(false)

    // an explicit pick from the chip filters
    await page.getByTestId('vs-category-chip').click()
    await page.getByTestId('vs-category-menu').getByRole('option', { name: 'FOOTWEAR' }).click()
    await expect.poll(() => seen.length).toBe(4)
    expect(new URL(seen[3]).searchParams.get('category')).toBe('Footwear')

    // NEW SEARCH forgets the image; × on the field leaves the flow
    await page.getByTestId('vs-new-search').click()
    await expect(page.getByTestId('vs-empty')).toBeVisible()
    await expect(page.getByTestId('search-scan-btn')).toBeVisible()
  })

  test('hover on the glyph shows the tooltip; no image mode, no focus hint', async ({ page }) => {
    test.skip(!(await scanControlPresent(page)), 'NEXT_PUBLIC_VISUAL_SEARCH_ENABLED is off')
    const tip = page.getByTestId('search-scan-tip')
    await expect(tip).toHaveText(/PRESS TO ADD A LOCAL IMAGE · (⌘|CTRL\+)K TO PASTE AN IMAGE/)
    await expect(tip).toHaveCSS('opacity', '0')
    await page.getByTestId('search-scan-btn').hover()
    await expect(tip).toHaveCSS('opacity', '1', { timeout: 3000 })
    await field(page).click()
    await expect(page.locator('.search__hint')).toHaveCount(0)
    await expect(page.getByTestId('search-choose-file')).toHaveCount(0)
    await expect(field(page)).toHaveAttribute('placeholder', 'Search designers, items, sellers')
  })

  test('⌘K / Ctrl+K stages the clipboard image; an empty clipboard shows a note', async ({ page }) => {
    // Deterministic clipboard: the API is mocked, the wiring is what is under test.
    await page.addInitScript((b64) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
      let hasImage = false
      ;(window as unknown as { __setClipboardImage: (v: boolean) => void }).__setClipboardImage = (v) => { hasImage = v }
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          read: async () => (hasImage ? [{ types: ['image/png'], getType: async () => new Blob([bytes], { type: 'image/png' }) }] : []),
        },
      })
    }, PNG_B64)
    test.skip(!(await scanControlPresent(page)), 'NEXT_PUBLIC_VISUAL_SEARCH_ENABLED is off')
    const seen: string[] = []
    await interceptSearch(page, LISTED, seen)
    await page.keyboard.press('Control+k')
    await expect(page.getByTestId('search-note')).toHaveText('NO IMAGE ON THE CLIPBOARD')
    await page.evaluate(() => (window as unknown as { __setClipboardImage: (v: boolean) => void }).__setClipboardImage(true))
    await page.keyboard.press('Control+k')
    await expect(page.getByTestId('search-chip')).toHaveAttribute('data-state', 'staged')
    expect(seen).toHaveLength(0)
    await field(page).press('Enter')
    await expect(page).toHaveURL(/\/search\/image$/)
    expect(seen).toHaveLength(1)
    expect(new URL(seen[0]).searchParams.has('q')).toBe(false) // image only, no words
  })

  test('R2: not listed → "Not listed." head + the disabled alert control', async ({ page }) => {
    test.skip(!(await scanControlPresent(page)), 'NEXT_PUBLIC_VISUAL_SEARCH_ENABLED is off')
    await interceptSearch(page, NOT_LISTED, [])
    await attachViaPicker(page)
    await field(page).press('Enter')
    await expect(page).toHaveURL(/\/search\/image$/)
    await expect(page.getByTestId('vs-headline')).toContainText('Not listed.')
    await expect(page.getByTestId('vs-headline')).toContainText('These are the closest pieces · 1 close in Outerwear')
    await expect(page.getByTestId('vs-matches')).toHaveCount(0)
    await expect(page.getByTestId('vs-alert-btn')).toBeDisabled()
    // × on the results field clears and returns to browse
    await page.getByTestId('search-clear').click()
    await expect(page).toHaveURL(/\/browse/)
  })

  test('paste in the field and drop anywhere stage the image; × removes it without a request', async ({ page }) => {
    test.skip(!(await scanControlPresent(page)), 'NEXT_PUBLIC_VISUAL_SEARCH_ENABLED is off')
    const seen: string[] = []
    await interceptSearch(page, LISTED, seen)
    await field(page).click()
    await field(page).evaluate((el, b64) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
      const dt = new DataTransfer()
      dt.items.add(new File([bytes], 'shot.png', { type: 'image/png' }))
      el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
    }, PNG_B64)
    await expect(page.getByTestId('search-chip')).toHaveAttribute('data-state', 'staged')
    expect(seen).toHaveLength(0)
    await page.getByTestId('search-clear').click()
    await expect(page.getByTestId('search-chip')).toHaveCount(0)
    await expect(page.getByTestId('search-scan-btn')).toBeVisible()

    const dt = await page.evaluateHandle((b64) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
      const d = new DataTransfer()
      d.items.add(new File([bytes], 'drop.png', { type: 'image/png' }))
      return d
    }, PNG_B64)
    await page.dispatchEvent('body', 'dragover', { dataTransfer: dt })
    await expect(page.getByTestId('search-drop-cue')).toHaveText('Drop to add the image')
    await page.dispatchEvent('body', 'drop', { dataTransfer: dt })
    await expect(page.getByTestId('search-chip')).toHaveAttribute('data-state', 'staged')
    expect(seen).toHaveLength(0)
    await field(page).press('Enter')
    await expect(page).toHaveURL(/\/search\/image$/)
    expect(seen).toHaveLength(1)
  })

  test('reload on /search/image forgets the image and shows the empty state', async ({ page }) => {
    test.skip(!(await scanControlPresent(page)), 'NEXT_PUBLIC_VISUAL_SEARCH_ENABLED is off')
    await page.goto('/search/image')
    await expect(page.getByTestId('vs-empty')).toBeVisible()
    await expect(page.getByTestId('search-scan-btn')).toBeVisible()
  })
})

test.describe('Search by image — mobile (M0 / M1 / M2)', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test('M0/M1: the glyph opens the sheet; the library row stages the photo; the keyboard Search key runs it (M2)', async ({ page }) => {
    test.skip(!(await scanControlPresent(page)), 'NEXT_PUBLIC_VISUAL_SEARCH_ENABLED is off')
    const seen: string[] = []
    await interceptSearch(page, LISTED, seen)
    await page.getByTestId('search-scan-btn').click()
    const sheet = page.getByTestId('image-search-sheet')
    await expect(sheet).toBeVisible()
    await expect(page.getByTestId('sheet-take-photo')).toContainText('Take a photo')
    await expect(page.getByTestId('sheet-choose-photos')).toContainText('Choose from photos')
    await expect(page.getByTestId('sheet-paste')).toContainText('Paste from clipboard')
    await expect(page.getByTestId('sheet-camera-input')).toHaveAttribute('capture', 'environment')
    await page.getByTestId('sheet-library-input').setInputFiles({ name: 'q.png', mimeType: 'image/png', buffer: PNG })
    await expect(sheet).toHaveCount(0)
    await expect(page.getByTestId('search-chip')).toHaveAttribute('data-state', 'staged')
    expect(seen).toHaveLength(0)
    await field(page).press('Enter')
    await expect(page).toHaveURL(/\/search\/image$/)
    expect(seen).toHaveLength(1)
    await expect(page.getByTestId('vs-headline')).toContainText('2')
    await expect(page.getByTestId('search-chip')).toContainText('IMAGE')
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2)
    expect(overflow).toBe(false)
  })

  test('M1: scrim tap and Escape close the sheet without staging', async ({ page }) => {
    test.skip(!(await scanControlPresent(page)), 'NEXT_PUBLIC_VISUAL_SEARCH_ENABLED is off')
    await page.getByTestId('search-scan-btn').click()
    await expect(page.getByTestId('image-search-sheet')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('image-search-sheet')).toHaveCount(0)
    await page.getByTestId('search-scan-btn').click()
    await page.getByTestId('image-search-scrim').click({ position: { x: 10, y: 10 } })
    await expect(page.getByTestId('image-search-sheet')).toHaveCount(0)
    await expect(page.getByTestId('search-chip')).toHaveCount(0)
  })
})
