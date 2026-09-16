/** Complementary lots for the bottom rail — fixtures already on the page, no API. */

export type MoreLot = { id: string; category?: string }

export function pickMoreLots<T extends MoreLot>(
  pool: readonly T[],
  opts: {
    excludeIds?: Iterable<string>
    category?: string
    limit?: number
  } = {},
): T[] {
  const limit = opts.limit ?? 8
  const exclude = new Set(opts.excludeIds)
  const unseen = pool.filter((row) => !exclude.has(row.id))
  const preferred = opts.category
    ? unseen.filter((row) => row.category === opts.category)
    : []
  const otherUnseen = opts.category
    ? unseen.filter((row) => row.category !== opts.category)
    : unseen
  const picked: T[] = [...preferred, ...otherUnseen]
  if (picked.length >= limit) return picked.slice(0, limit)

  // Fill from the far end of the excluded set so the rail is not a copy of row 1.
  const fill = pool.filter((row) => exclude.has(row.id)).slice().reverse()
  const seen = new Set(picked.map((row) => row.id))
  for (const row of fill) {
    if (picked.length >= limit) break
    if (seen.has(row.id)) continue
    picked.push(row)
    seen.add(row.id)
  }
  return picked
}
