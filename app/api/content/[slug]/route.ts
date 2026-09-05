/**
 * GET /api/content/[slug] — terms · privacy (HTML), help (FAQ), fees (structured schedule).
 * Public. One copy of the legal text and FAQ, shared with the web pages (lib/loaders/content).
 */
import { NextRequest, NextResponse } from 'next/server'
import { isContentSlug, loadContent } from '@/lib/loaders/content'

interface Ctx { params: Promise<{ slug: string }> }

export async function GET(_request: NextRequest, { params }: Ctx) {
  const { slug } = await params
  if (!isContentSlug(slug)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(loadContent(slug), { headers: { 'Cache-Control': 'public, max-age=300, s-maxage=3600' } })
}
