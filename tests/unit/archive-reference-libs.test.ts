import { describe, it, expect } from 'vitest'
import { parseBrowseParams, applyBrowseWhere, applyBrowseOrder, applyCategoryWhere, browseSearchParams, isDiscoveryView, browseScope } from '../../lib/browse/filters'
import {
  CATEGORIES, COLOR_LABELS, isValidSubcategory, measurementLabelsFor, normalizeMeasurements, formatMeasurement, subcategoriesOf,
  resolveCategorySelection, picksByCategory, categoryScopeLabel, departmentScopeLabel, subcatKey, parseSubcatKey,
} from '../../lib/taxonomy'
import { normalizeSizes, flattenSizes, sizesChipLabel, countSizes, sizeScaleFor, sizeKey } from '../../lib/sizes'
import { cleanAddress, addressLines } from '../../lib/addresses'
import { cleanDraftFields } from '../../lib/listings/draft-fields'
import { usernameFromEmail, passwordProblem } from '../../lib/auth/username'
import { sellerTrustLine, sellerRatingLine } from '../../lib/sellers/stats'

/** Records every builder call so WHERE/ORDER can be asserted without PostgREST. */
function recorder() {
  const calls: Array<[string, unknown[]]> = []
  const q: Record<string, unknown> = {}
  for (const m of ['eq', 'in', 'or', 'ilike', 'gte', 'lte', 'gt', 'textSearch', 'order', 'range']) {
    q[m] = (...args: unknown[]) => { calls.push([m, args]); return q }
  }
  return { q, calls }
}

describe('lib/browse/filters', () => {
  it('parses the rail URL contract (csv lists, dollars → cents, flags)', () => {
    const f = parseBrowseParams({
      q: ' helmut ', dept: 'menswear', cat: 'Tops', subcat: 'Short-sleeve tees,Polos', brand: 'HELMUT LANG,RICK OWENS',
      color: 'Black', min_price: '20', max_price: '400', verified: '1', sold: '1', sort: 'price_desc', offset: '48', cond: '7',
    })
    expect(f.q).toBe('helmut')
    expect(f.depts).toEqual(['menswear'])
    // Picks narrow their category: `cat=Tops` leaves the whole-category list, picks are qualified keys in tree order.
    expect(f.cats).toEqual([])
    expect(f.subcats).toEqual(['Tops:Short-sleeve tees', 'Tops:Polos'])
    expect(f.brands).toEqual(['HELMUT LANG', 'RICK OWENS'])
    expect(f.colors).toEqual(['Black'])
    expect(f.minPriceCents).toBe(2000)
    expect(f.maxPriceCents).toBe(40000)
    expect(f.verified).toBe(true)
    expect(f.sold).toBe(true)
    expect(f.sort).toBe('price_desc')
    expect(f.offset).toBe(48)
    expect(f.condMin).toBe(7)
    expect(isDiscoveryView(f)).toBe(false)
    expect(browseScope(f)).toEqual({ dept: 'Menswear', cat: 'Tops' })
  })

  it('defaults: empty params are a discovery view, bad sort/offset fall back', () => {
    const f = parseBrowseParams({ sort: 'nope', offset: '-3' })
    expect(f.sort).toBe('newest')
    expect(f.offset).toBe(0)
    expect(isDiscoveryView(f)).toBe(true)
    expect(browseScope(f)).toEqual({ dept: 'All', cat: 'All' })
  })

  it('accepts URLSearchParams sources and round-trips through browseSearchParams', () => {
    const sp = new URLSearchParams('dept=womenswear&brand=A,B&color=Navy,Grey&max_price=120&dropped=1')
    const f = parseBrowseParams(sp)
    const back = browseSearchParams(f)
    expect(back.get('dept')).toBe('womenswear')
    expect(back.get('cat')).toBeNull()
    expect(back.get('brand')).toBe('A,B')
    expect(back.get('color')).toBe('Navy,Grey')
    expect(back.get('max_price')).toBe('120')
    expect(back.get('dropped')).toBe('1')
    expect(back.get('sort')).toBeNull()
  })

  it('applyBrowseWhere: status follows the SOLD toggle, multi-values use in(), single brand uses ilike', () => {
    const { q, calls } = recorder()
    applyBrowseWhere(q, parseBrowseParams({ sold: '1', brand: 'Helmut Lang', subcat: 'Polos', color: 'Black,Grey', authenticated: '1' }))
    expect(calls[0]).toEqual(['eq', ['status', 'sold']])
    expect(calls).toContainEqual(['eq', ['category', 'Tops']]) // bare `Polos` resolves to Tops
    expect(calls).toContainEqual(['eq', ['subcategory', 'Polos']])
    expect(calls).toContainEqual(['ilike', ['brand', '%Helmut Lang%']])
    expect(calls).toContainEqual(['in', ['color', ['Black', 'Grey']]])
    expect(calls).toContainEqual(['eq', ['authentication_status', 'authenticated']])
    const active = recorder()
    applyBrowseWhere(active.q, parseBrowseParams({ brand: 'A,B', sizes: 'M,L' }))
    expect(active.calls[0]).toEqual(['eq', ['status', 'active']])
    expect(active.calls).toContainEqual(['in', ['brand', ['A', 'B']]])
    expect(active.calls).toContainEqual(['in', ['size', ['M', 'L']]])
  })

  it('DEPARTMENT + CATEGORY are multi-select: whole categories OR (category AND picks) in one or-group', () => {
    const multi = recorder()
    applyBrowseWhere(multi.q, parseBrowseParams({ dept: 'menswear,unisex', cat: 'Footwear,Knitwear', subcat: 'Tops:Polos,Tops:Jerseys,Bottoms:Denim' }))
    expect(multi.calls).toContainEqual(['in', ['department', ['menswear', 'unisex']]])
    expect(multi.calls).toContainEqual(['or', [
      'category.in.("Footwear","Knitwear"),and(category.eq."Tops",subcategory.in.("Polos","Jerseys")),and(category.eq."Bottoms",subcategory.in.("Denim"))',
    ]])
    // Whole categories only → plain in(); one category with picks → eq + in, no or-group.
    const wholeOnly = recorder()
    applyCategoryWhere(wholeOnly.q, { cats: ['Tops', 'Bottoms'], subcats: [] })
    expect(wholeOnly.calls).toEqual([['in', ['category', ['Tops', 'Bottoms']]]])
    const onePicked = recorder()
    applyCategoryWhere(onePicked.q, { cats: [], subcats: ['Tops:Polos', 'Tops:Jerseys'] })
    expect(onePicked.calls).toEqual([['eq', ['category', 'Tops']], ['in', ['subcategory', ['Polos', 'Jerseys']]]])
    // Ambiguous bare label without a category → both owners; unknown names are dropped.
    const f = parseBrowseParams({ dept: 'Menswear,mars', cat: 'Tops,Hats', subcat: 'Denim,Nope' })
    expect(f.depts).toEqual(['menswear'])
    expect(f.cats).toEqual(['Tops'])
    expect(f.subcats).toEqual(['Outerwear:Denim', 'Bottoms:Denim'])
    expect(isDiscoveryView(parseBrowseParams({ dept: 'unisex' }))).toBe(false)
  })

  it('applyBrowseOrder: price sorts are total orders (tie-break on id); NEWEST starts with boosts', () => {
    const asc = recorder()
    applyBrowseOrder(asc.q, parseBrowseParams({ sort: 'price_asc' }))
    expect(asc.calls).toEqual([['order', ['price_cents', { ascending: true }]], ['order', ['id']]])
    const newest = recorder()
    applyBrowseOrder(newest.q, parseBrowseParams({}))
    expect(newest.calls[0]).toEqual(['order', ['boosted_until', { ascending: false, nullsFirst: false }]])
    expect(newest.calls.at(-1)).toEqual(['order', ['id']])
  })
})

describe('lib/taxonomy', () => {
  it('category tree + subcategory validation', () => {
    expect(CATEGORIES).toContain('Tops')
    expect(subcategoriesOf('Tops')).toContain('Short-sleeve tees')
    expect(isValidSubcategory('Tops', 'Short-sleeve tees')).toBe(true)
    expect(isValidSubcategory('Tops', 'Boots')).toBe(false)
    expect(COLOR_LABELS).toEqual(['Black', 'White', 'Grey', 'Cream', 'Navy', 'Brown', 'Olive', 'Multi'])
  })

  it('rail selection: qualified picks, narrowing, ordering, scope labels', () => {
    expect(subcatKey('Tops', 'Polos')).toBe('Tops:Polos')
    expect(parseSubcatKey('Tops:Polos')).toEqual({ category: 'Tops', sub: 'Polos' })
    expect(parseSubcatKey('Tops:Boots')).toBeNull()
    // A whole category plus a pick in it → the pick narrows it; bare label resolves to the listed owner.
    const sel = resolveCategorySelection(['Bottoms', 'Tops', 'Footwear'], ['Denim', 'Tops:Jerseys', 'Tops:Polos'])
    expect(sel).toEqual({ cats: ['Footwear'], picks: ['Tops:Polos', 'Tops:Jerseys', 'Bottoms:Denim'] })
    expect(picksByCategory(sel.picks)).toEqual([{ category: 'Tops', subs: ['Polos', 'Jerseys'] }, { category: 'Bottoms', subs: ['Denim'] }])
    // Every child picked collapses to the whole category ("All <cat>" ticks itself).
    const allTailoring = ['Tailoring:Blazers', 'Tailoring:Suits', 'Tailoring:Trousers', 'Tailoring:Waistcoats']
    expect(resolveCategorySelection([], [...allTailoring, 'Tops:Polos'])).toEqual({ cats: ['Tailoring'], picks: ['Tops:Polos'] })
    expect(resolveCategorySelection([], allTailoring.slice(0, 3)).cats).toEqual([])
    expect(categoryScopeLabel({ cats: [], picks: [] })).toBe('All')
    expect(categoryScopeLabel({ cats: [], picks: ['Tops:Polos'] })).toBe('Polos')
    expect(categoryScopeLabel({ cats: ['Footwear'], picks: ['Tops:Polos', 'Tops:Jerseys'] })).toBe('Tops + Footwear')
    expect(categoryScopeLabel(sel)).toBe('3 categories')
    expect(departmentScopeLabel([])).toBe('All')
    expect(departmentScopeLabel(['womenswear', 'menswear'])).toBe('Menswear + Womenswear')
    expect(departmentScopeLabel(['menswear', 'womenswear', 'unisex'])).toBe('All')
  })

  it('measurement labels follow the category; normalisation drops unknown/invalid entries', () => {
    expect(measurementLabelsFor('Bottoms')).toEqual(['WAIST', 'INSEAM', 'RISE', 'LEG OPENING'])
    expect(measurementLabelsFor('Knitwear')).toEqual(['PIT TO PIT', 'LENGTH', 'SHOULDER', 'SLEEVE'])
    const m = normalizeMeasurements({ 'pit to pit': '21.5"', LENGTH: 27, SLEEVE: -2, WAIST: 30, bogus: 5 }, 'Tops')
    expect(m).toEqual({ 'PIT TO PIT': 21.5, LENGTH: 27 })
    expect(formatMeasurement(21.5, 'in')).toBe('21.5"')
    expect(formatMeasurement(10, 'cm')).toBe('25.4 CM')
  })
})

describe('lib/sizes', () => {
  it('normalises legacy flat keys to menswear and keeps dept-scoped keys', () => {
    const s = normalizeSizes({ tops: ['M', 'L'], 'womenswear:footwear': ['7'], junk: 'x', 'menswear:tops': ['XL'] })
    expect(s['menswear:tops']).toEqual(['M', 'L', 'XL'])
    expect(s['womenswear:footwear']).toEqual(['7'])
    expect(Object.keys(s)).not.toContain('junk')
  })

  it('flattens in section order, chip label caps at three tokens, counts every pick', () => {
    const s = { 'menswear:tops': ['L', 'M'], 'menswear:bottoms': ['29', '30', '31'], 'menswear:footwear': ['9'] }
    expect(flattenSizes(s)).toEqual(['M', 'L', '29', '30', '31', '9'])
    expect(sizesChipLabel(s)).toBe('M · L · 29 +3')
    expect(sizesChipLabel({})).toBe('NONE SET')
    expect(countSizes(s)).toBe(6)
    expect(sizeKey('womenswear', 'dresses')).toBe('womenswear:dresses')
  })

  it('wizard size scale follows department + category', () => {
    expect(sizeScaleFor('menswear', 'Bottoms')).toContain('32')
    expect(sizeScaleFor('menswear', 'Tailoring')).toContain('48R')
    expect(sizeScaleFor('womenswear', 'Tops')).toContain('M/6-8/42-44')
    expect(sizeScaleFor(null, 'Footwear')).toContain('9.5')
    expect(sizeScaleFor('menswear', 'Accessories')).toEqual(['ONE SIZE'])
  })
})

describe('lib/addresses', () => {
  it('validates a US address and formats lines', () => {
    const r = cleanAddress({ name: ' Jordan Demo ', street1: '2214 Fern St', street2: 'Apt 3', city: 'San Francisco', state: 'ca', zip: '94117' })
    expect('address' in r && r.address.state).toBe('CA')
    if ('address' in r) expect(addressLines(r.address)).toEqual(['2214 Fern St, Apt 3', 'San Francisco, CA 94117', 'United States'])
    expect('error' in cleanAddress({ name: 'x', street1: '', city: 'SF', state: 'CA', zip: '94117' })).toBe(true)
    expect('error' in cleanAddress({ name: 'x', street1: '1 Main', city: 'SF', state: 'California', zip: '94117' })).toBe(true)
    expect('error' in cleanAddress({ name: 'x', street1: '1 Main', city: 'SF', state: 'CA', zip: 'ABC' })).toBe(true)
  })
})

describe('lib/listings/draft-fields', () => {
  it('keeps title casing, upper-cases brand + size, validates taxonomy, drops junk', () => {
    const f = cleanDraftFields({
      title: '1998 painter-dyed tee', brand: 'helmut lang', category: 'Tops', subcategory: 'Polos', size: 'm',
      color: 'Pink', price_cents: 14500, condition_score: 11, images: ['a', 2, 'b'], measurements: { LENGTH: '27' },
    })
    expect(f.title).toBe('1998 painter-dyed tee')
    expect(f.brand).toBe('HELMUT LANG')
    expect(f.size).toBe('M')
    expect(f.subcategory).toBe('Polos')
    expect(f.color).toBeNull()
    expect(f.price_cents).toBe(14500)
    expect(f.condition_score).toBeNull()
    expect(f.images).toEqual(['a', 'b'])
    expect(f.measurements).toEqual({ LENGTH: 27 })
  })

  it('subcategory validates against current_category when the category is not in the patch', () => {
    expect(cleanDraftFields({ subcategory: 'Boots', current_category: 'Footwear' }).subcategory).toBe('Boots')
    expect(cleanDraftFields({ subcategory: 'Boots', current_category: 'Tops' }).subcategory).toBeNull()
  })
})

describe('lib/auth/username', () => {
  it('derives a safe username from the email and the reference password rule', () => {
    expect(usernameFromEmail('Jordan.Demo+test@archive.supply')).toBe('jordandemo')
    expect(usernameFromEmail('ab@x.io')).toBe('abuser')
    expect(usernameFromEmail('admin@x.io')).toBe('adminuser')
    expect(usernameFromEmail('jordandemo@x.io', 'K3F9')).toBe('jordandemo_k3f9')
    expect(usernameFromEmail('a-very-long-local-part-that-goes-on-and-on@x.io').length).toBeLessThanOrEqual(30)
    expect(passwordProblem('short1')).toContain('10 CHARACTERS')
    expect(passwordProblem('longenoughbutnonumber')).toContain('NUMBER')
    expect(passwordProblem('longenough1')).toBeNull()
  })
})

describe('lib/sellers/stats lines', () => {
  it('formats the reference trust lines', () => {
    expect(sellerTrustLine({ sales: 132, rating: 4.9, ratingCount: 40, listings: 3 }, true)).toBe('4.9 · 132 SALES · VERIFIED ID')
    expect(sellerTrustLine(undefined, false)).toBe('0 SALES')
    expect(sellerRatingLine({ sales: 61, rating: 4.8, ratingCount: 10, listings: 0 })).toBe('4.8 RATING · 61 SALES')
  })
})
