import { test, expect, type Page } from '@playwright/test'

/**
 * VS2 — search by image (design page 21: S0–S4 header states, R1/R2 results, M0–M2 mobile).
 * The engine is not required: `/api/search/image` is intercepted with fixtures, so these
 * specs run against a dev server with NEXT_PUBLIC_VISUAL_SEARCH_ENABLED=true and nothing
 * else. They skip themselves when the control is absent (flag off).
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

test.describe('Search by image — desktop header (S0–S4, R1/R2)', () => {
  test('S2: the glyph switches the field into image mode; ESC and × return to text', async ({ page }) => {
    test.skip(!(await scanControlPresent(page)), 'NEXT_PUBLIC_VISUAL_SEARCH_ENABLED is off')
    const field = page.getByTestId('search-field')
    await page.getByTestId('search-scan-btn').click()
    await expect(field).toHaveClass(/is-image/)
    await expect(field.locator('input[name="q"]')).toHaveAttribute('placeholder', /Paste an image/)
    await expect(page.getByTestId('search-choose-file')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(field).not.toHaveClass(/is-image/)
    await page.getByTestId('search-scan-btn').click()
    await page.getByTestId('search-clear').click()
    await expect(field).not.toHaveClass(/is-image/)
    await expect(page.getByTestId('search-scan-btn')).toBeVisible()
  })

  test('S1: focus shows the paste hint until the first keystroke', async ({ page }) => {
    test.skip(!(await scanControlPresent(page)), 'NEXT_PUBLIC_VISUAL_SEARCH_ENABLED is off')
    const input = page.getByTestId('search-field').locator('input[name="q"]')
    await input.click()
    await expect(page.locator('.search__hint')).toHaveText(/PASTE IMAGE (⌘V|CTRL\+V)/)
    await input.type('a')
    await expect(page.locator('.search__hint')).toHaveCount(0)
  })

  test('picker → SEARCHING… → /search/image with MATCHES + CLOSE; words re-run with the image; ALL CATEGORIES; NEW SEARCH; ×', async ({ page }) => {
    test.skip(!(await scanControlPresent(page)), 'NEXT_PUBLIC_VISUAL_SEARCH_ENABLED is off')
    const seen: string[] = []
    await interceptSearch(page, LISTED, seen)
    await page.getByTestId('search-scan-btn').click()
    await page.getByTestId('search-file-input').setInputFiles({ name: 'q.png', mimeType: 'image/png', buffer: PNG })
    await expect(page).toHaveURL(/\/search\/image$/)
    await expect(page.getByTestId('vs-headline')).toContainText('2')
    await expect(page.getByTestId('vs-headline')).toContainText('matches · 1 close in Outerwear')
    await expect(page.getByTestId('vs-matches').locator('[data-testid="listing-card"]')).toHaveCount(2)
    await expect(page.getByTestId('vs-close').locator('[data-testid="listing-card"]')).toHaveCount(1)
    await expect(page.getByTestId('vs-category-chip')).toHaveText(/OUTERWEAR/)
    await expect(page.getByTestId('search-chip')).toContainText('IMAGE')
    await expect(page.getByTestId('search-chip')).toContainText('OUTERWEAR')
    expect(seen).toHaveLength(1)
    expect(seen[0]).not.toContain('q=')

    // text + image: words typed in the header field re-run the search with the same image
    const input = page.getByTestId('search-field').locator('input[name="q"]')
    await input.fill('black leather')
    await input.press('Enter')
    await expect.poll(() => seen.length).toBe(2)
    expect(seen[1]).toContain('q=black+leather')

    // ALL CATEGORIES drops the guess: auto_category=0, no category
    await page.getByTestId('vs-all-categories').click()
    await expect.poll(() => seen.length).toBe(3)
    expect(new URL(seen[2]).searchParams.get('auto_category')).toBe('0')
    expect(new URL(seen[2]).searchParams.has('category')).toBe(false)

    // an explicit pick from the chip filters
    await page.getByTestId('vs-category-chip').click()
    await page.getByTestId('vs-category-menu').getByRole('option', { name: 'FOOTWEAR' }).click()
    await expect.poll(() => seen.length).toBe(4)
    expect(seen[3]).toContain('category=Footwear')

    // NEW SEARCH forgets the image: the page asks for a paste, the field is in image mode
    await page.getByTestId('vs-new-search').click()
    await expect(page.getByTestId('vs-empty')).toBeVisible()
    await expect(page.getByTestId('search-field')).toHaveClass(/is-image/)
    // × on the results field leaves the flow
    await page.getByTestId('search-clear').click()
    await expect(page).toHaveURL(/\/browse/)
  })

  test('R2: not listed → "Not listed." head + the disabled alert control', async ({ page }) => {
    test.skip(!(await scanControlPresent(page)), 'NEXT_PUBLIC_VISUAL_SEARCH_ENABLED is off')
    await interceptSearch(page, NOT_LISTED, [])
    await page.getByTestId('search-scan-btn').click()
    await page.getByTestId('search-file-input').setInputFiles({ name: 'q.png', mimeType: 'image/png', buffer: PNG })
    await expect(page).toHaveURL(/\/search\/image$/)
    await expect(page.getByTestId('vs-headline')).toContainText('Not listed.')
    await expect(page.getByTestId('vs-headline')).toContainText('These are the closest pieces · 1 close in Outerwear')
    await expect(page.getByTestId('vs-matches')).toHaveCount(0)
    await expect(page.getByTestId('vs-alert-btn')).toBeDisabled()
  })

  test('paste in the field and drop anywhere both start the search', async ({ page }) => {
    test.skip(!(await scanControlPresent(page)), 'NEXT_PUBLIC_VISUAL_SEARCH_ENABLED is off')
    const seen: string[] = []
    await interceptSearch(page, LISTED, seen)
    const input = page.getByTestId('search-field').locator('input[name="q"]')
    await input.click()
    await input.evaluate((el, b64) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
      const dt = new DataTransfer()
      dt.items.add(new File([bytes], 'shot.png', { type: 'image/png' }))
      el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
    }, PNG_B64)
    await expect(page).toHaveURL(/\/search\/image$/)
    expect(seen).toHaveLength(1)

    await page.goto('/browse')
    await page.waitForLoadState('networkidle')
    const dt = await page.evaluateHandle((b64) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
      const d = new DataTransfer()
      d.items.add(new File([bytes], 'drop.png', { type: 'image/png' }))
      return d
    }, PNG_B64)
    await page.dispatchEvent('body', 'dragover', { dataTransfer: dt })
    await expect(page.getByTestId('search-drop-cue')).toHaveText('Drop to search by image')
    await page.dispatchEvent('body', 'drop', { dataTransfer: dt })
    await expect(page).toHaveURL(/\/search\/image$/)
    expect(seen).toHaveLength(2)
  })

  test('reload on /search/image forgets the image and asks for a paste', async ({ page }) => {
    test.skip(!(await scanControlPresent(page)), 'NEXT_PUBLIC_VISUAL_SEARCH_ENABLED is off')
    await page.goto('/search/image')
    await expect(page.getByTestId('vs-empty')).toBeVisible()
    await expect(page.getByTestId('search-field')).toHaveClass(/is-image/)
  })
})

test.describe('Search by image — mobile (M0 / M1 / M2)', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test('M0/M1: the glyph in the search row opens the sheet; the library row starts the search (M2)', async ({ page }) => {
    test.skip(!(await scanControlPresent(page)), 'NEXT_PUBLIC_VISUAL_SEARCH_ENABLED is off')
    const seen: string[] = []
    await interceptSearch(page, LISTED, seen)
    await page.getByTestId('search-scan-btn').click()
    const sheet = page.getByTestId('image-search-sheet')
    await expect(sheet).toBeVisible()
    await expect(page.getByTestId('sheet-take-photo')).toContainText('Take a photo')
    await expect(page.getByTestId('sheet-choose-photos')).toContainText('Choose from photos')
    await expect(page.getByTestId('sheet-paste')).toContainText('Paste from clipboard')
    await expect(page.getByTestId('sheet-note')).toHaveText('Your photo is searched, not stored.')
    await expect(page.getByTestId('sheet-camera-input')).toHaveAttribute('capture', 'environment')
    await page.getByTestId('sheet-library-input').setInputFiles({ name: 'q.png', mimeType: 'image/png', buffer: PNG })
    await expect(page).toHaveURL(/\/search\/image$/)
    await expect(sheet).toHaveCount(0)
    await expect(page.getByTestId('vs-headline')).toContainText('2')
    await expect(page.getByTestId('search-chip')).toContainText('IMAGE')
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2)
    expect(overflow).toBe(false)
  })

  test('M1: scrim tap and Escape close the sheet without searching', async ({ page }) => {
    test.skip(!(await scanControlPresent(page)), 'NEXT_PUBLIC_VISUAL_SEARCH_ENABLED is off')
    await page.getByTestId('search-scan-btn').click()
    await expect(page.getByTestId('image-search-sheet')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('image-search-sheet')).toHaveCount(0)
    await page.getByTestId('search-scan-btn').click()
    await page.getByTestId('image-search-scrim').click({ position: { x: 10, y: 10 } })
    await expect(page.getByTestId('image-search-sheet')).toHaveCount(0)
  })
})
