'use client'

/**
 * /orders/[id]/dispute
 * Buyer opens a dispute: description + photo upload (≥1 required).
 */
import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/browser'

export default function DisputePage() {
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
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}>
      <div style={{ width: '100%', maxWidth: 480 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--color-ink)', marginBottom: 8 }}>
          Report an issue
        </h1>
        <p style={{ fontSize: 13, color: 'var(--color-ink-soft)', marginBottom: 32 }}>
          Disputes must be opened within 72h of delivery and require at least one photo.
          This will pause the auto-release of funds.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div>
            <label style={{ display: 'block', font: '500 11px var(--font-ui)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-ink-soft)', marginBottom: 8 }}>
              Photos (required)
            </label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={e => setFiles(Array.from(e.target.files ?? []))}
              style={{ font: '14px var(--font-ui)', color: 'var(--color-ink)' }}
            />
            {files.length > 0 && (
              <div style={{ marginTop: 8, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-ink-soft)' }}>
                {files.length} file{files.length > 1 ? 's' : ''} selected
              </div>
            )}
          </div>

          <div>
            <label style={{ display: 'block', font: '500 11px var(--font-ui)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-ink-soft)', marginBottom: 8 }}>
              Description
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={5}
              placeholder="Describe the issue with your order…"
              required
              style={{ width: '100%', border: '1px solid var(--color-line)', borderRadius: 2, padding: '10px 12px', fontSize: 14, fontFamily: 'var(--font-ui)', color: 'var(--color-ink)', background: 'var(--color-bg)', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
            />
          </div>

          {error && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-alert)' }}>{error}</div>
          )}

          <button
            type="submit"
            disabled={uploading}
            style={{ height: 44, background: 'var(--color-ink)', color: 'var(--color-bg)', border: '1px solid var(--color-ink)', borderRadius: 2, font: '500 14px var(--font-ui)', cursor: uploading ? 'not-allowed' : 'pointer' }}
          >
            {uploading ? 'Submitting…' : 'Submit dispute'}
          </button>
        </form>
      </div>
    </div>
  )
}
