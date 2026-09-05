'use client'

/**
 * /orders/[id]/dispute
 * Buyer opens a dispute: description + photo upload (≥1 required).
 */
import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/browser'

export default function DisputeForm() {
  const { id: orderId } = useParams<{ id: string }>()
  const router = useRouter()

  const [description, setDescription] = useState('')
  const [files, setFiles]             = useState<File[]>([])
  const [uploading, setUploading]     = useState(false)
  const [error, setError]             = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (files.length === 0) { setError('At least 1 photo required'); return }
    if (description.trim().length < 10) { setError('Description must be at least 10 characters'); return }

    setUploading(true)
    setError(null)

    try {
      const supabase = createClient()
      const photoUrls: string[] = []

      for (const file of files) {
        const ext  = file.name.split('.').pop() ?? 'jpg'
        // Must upload to listings/{uid}/... to match existing product-images RLS policy
        const supabaseUser = await supabase.auth.getUser()
        const uid = supabaseUser.data.user?.id
        if (!uid) throw new Error('Not authenticated')
        const path = `listings/${uid}/dispute-evidence/${orderId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const { error: upErr } = await supabase.storage.from('product-images').upload(path, file)
        if (upErr) throw new Error(`Upload failed: ${upErr.message}`)

        const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(path)
        photoUrls.push(publicUrl)
      }

      const res = await fetch(`/api/orders/${orderId}/dispute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description, photos: photoUrls }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }

      router.replace(`/orders/${orderId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error submitting dispute')
    } finally {
      setUploading(false)
    }
  }

  return (
    <main className="page-main page-main--narrow">
        <div className="crumb"><Link href="/orders">ORDERS</Link> / <Link href={`/orders/${orderId}`}>{`#A-${orderId.slice(0, 5).toUpperCase()}`}</Link> / DISPUTE</div>
        <div className="page-head page-head--ruled">
          <h1 className="page-title">Report an issue</h1>
          <span className="page-note">WITHIN 72H OF DELIVERY · PAUSES AUTO-RELEASE</span>
        </div>
        <p className="settings-note" style={{ paddingTop: 16 }}>
          A moderator reviews both sides with photos from the listing and from you. Escrow holds until it resolves. Be specific — what arrived, what was described, what&rsquo;s different.
        </p>
        <form onSubmit={handleSubmit}>
          <div className="review-label">PHOTOS <em>— AT LEAST ONE, REQUIRED</em></div>
          <div className="photo-row" style={{ flexWrap: 'wrap' }}>
            {files.map((f, i) => (
              <span key={i} className="photo-slot" style={{ background: `var(--tone-${(i % 8) + 2})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }} title={f.name}>
                <span className="mono-note" style={{ padding: 4, textAlign: 'center', wordBreak: 'break-all' }}>{f.name.slice(0, 12)}</span>
              </span>
            ))}
            <label className="photo-add" aria-label="Add photos">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M12 5v14M5 12h14" /></svg>
              <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={(e) => setFiles((prev) => [...prev, ...Array.from(e.target.files ?? [])])} />
            </label>
            <span className="photo-note">{files.length} SELECTED · JPG / PNG</span>
          </div>
          <div className="review-label">WHAT HAPPENED</div>
          <textarea
            className="review-text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the issue with your order — condition, authenticity, missing parts…"
            maxLength={2000}
            required
            aria-label="Describe the issue"
          />
          <div className="review-count"><span>MIN 10 CHARACTERS</span><span>{description.length} / 2000</span></div>
          {error && <div className="alert-line" role="alert">{error.toUpperCase()}</div>}
          <div className="save-row save-row--left">
            <button type="submit" className="btn-primary btn-primary--inline" disabled={uploading}>
              {uploading ? 'SUBMITTING…' : 'OPEN DISPUTE →'}
            </button>
            <Link href={`/orders/${orderId}`} className="btn-ghost btn-ghost--inline">CANCEL</Link>
          </div>
        </form>
    </main>
  )
}
