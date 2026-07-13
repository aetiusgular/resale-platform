import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const email = (body.email ?? '').trim().toLowerCase()

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'invalid email' }, { status: 400 })
  }

  // TODO(B8): persist to waitlist table
  // For now just log and ack — the UX is what matters for B1.
  console.log('[waitlist]', email)

  return NextResponse.json({ ok: true }, { status: 200 })
}
