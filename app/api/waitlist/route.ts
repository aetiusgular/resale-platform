import { NextRequest, NextResponse } from 'next/server'
import { createServiceClientRaw } from '@/lib/supabase/service'
import { checkRateLimit } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  // Rate limit: 5 waitlist submissions per hour per IP
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const rl = checkRateLimit(`waitlist:${ip}`, 5, 60 * 60 * 1000)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } },
    )
  }

  const body = await request.json().catch(() => ({}))
  const email = (body.email ?? '').trim().toLowerCase()

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'invalid email' }, { status: 400 })
  }

  // Basic length cap
  if (email.length > 254) {
    return NextResponse.json({ error: 'invalid email' }, { status: 400 })
  }

  const service = createServiceClientRaw()
  const { error } = await service
    .from('waitlist')
    .insert({ email })

  if (error) {
    // 23505 = unique_violation: already on waitlist — treat as success
    if (error.code === '23505') {
      return NextResponse.json({ ok: true }, { status: 200 })
    }
    console.error('[waitlist] insert error:', error.message)
    return NextResponse.json({ error: 'server error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true }, { status: 200 })
}
