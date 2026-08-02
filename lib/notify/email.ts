// Resend email adapter — SERVER ONLY. Uses the REST API via fetch (no SDK dependency).
// Fail-soft: with RESEND_API_KEY / NOTIFY_EMAIL_FROM unset it no-ops so the app runs
// without email configured. Never throws to the caller.
export async function sendEmail(input: { to: string; subject: string; text: string; html: string }): Promise<boolean> {
  const key = process.env.RESEND_API_KEY
  const from = process.env.NOTIFY_EMAIL_FROM
  if (!key || !from) return false
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: input.to, subject: input.subject, text: input.text, html: input.html }),
    })
    if (!res.ok) {
      console.warn('[notify/email] resend responded', res.status)
      return false
    }
    return true
  } catch (e) {
    console.warn('[notify/email] send failed:', e)
    return false
  }
}
