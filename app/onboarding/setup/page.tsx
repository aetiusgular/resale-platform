'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/browser'

type SizeCategory = 'tops' | 'bottoms' | 'shoes'

const TOP_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL']
const BOTTOM_SIZES = ['26', '28', '30', '32', '34', '36', '38']
const SHOE_SIZES = ['6', '7', '8', '9', '10', '11', '12', '13']

export default function SetupPage() {
  const router = useRouter()
  const [selectedSizes, setSelectedSizes] = useState<Record<SizeCategory, string[]>>({
    tops: [],
    bottoms: [],
    shoes: [],
  })
  const [address, setAddress] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggleSize(cat: SizeCategory, size: string) {
    setSelectedSizes((prev) => {
      const current = prev[cat]
      const next = current.includes(size)
        ? current.filter((s) => s !== size)
        : [...current, size]
      return { ...prev, [cat]: next }
    })
  }

  async function handleContinue() {
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      const quickSetup = {
        sizes: selectedSizes,
        address: address.trim() || null,
      }
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ quick_setup: quickSetup })
        .eq('id', user.id)

      if (updateError) {
        setLoading(false)
        setError(updateError.message)
        return
      }
    }

    setLoading(false)
    // Generate codes server-side then navigate
    await generateCodes()
    router.push('/onboarding/codes')
  }

  async function generateCodes() {
    await fetch('/api/onboarding/generate-codes', { method: 'POST' })
  }

  async function handleSkip() {
    await generateCodes()
    router.push('/onboarding/codes')
  }

  return (
    <div
      style={{
        background: 'var(--color-bg)',
        minHeight: '100svh',
        boxSizing: 'border-box',
        padding: '0 24px 40px',
      }}
    >
      <div style={{ padding: '40px 0 0' }}>
        <div
          style={{
            font: '500 11px var(--font-ui)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--color-ink-soft)',
          }}
        >
          Set up once, checkout in seconds
        </div>
      </div>

      <div style={{ maxWidth: '480px', margin: '0 auto' }}>
        {/* MY SIZES */}
        <div
          style={{
            marginTop: '24px',
            border: '1px solid var(--color-line)',
            borderRadius: '2px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 16px',
              borderBottom: '1px solid var(--color-line)',
            }}
          >
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-ink)' }}>
              1 · MY SIZES
            </span>
          </div>
          <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <SizeGroup
              label="Tops"
              sizes={TOP_SIZES}
              selected={selectedSizes.tops}
              onToggle={(s) => toggleSize('tops', s)}
            />
            <SizeGroup
              label="Bottoms"
              sizes={BOTTOM_SIZES}
              selected={selectedSizes.bottoms}
              onToggle={(s) => toggleSize('bottoms', s)}
            />
            <SizeGroup
              label="Shoes"
              sizes={SHOE_SIZES}
              selected={selectedSizes.shoes}
              onToggle={(s) => toggleSize('shoes', s)}
            />
          </div>
        </div>

        {/* SHIPPING ADDRESS */}
        <div
          style={{
            marginTop: '16px',
            border: '1px solid var(--color-line)',
            borderRadius: '2px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 16px',
              borderBottom: '1px solid var(--color-line)',
            }}
          >
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-ink)' }}>
              2 · SHIPPING ADDRESS
            </span>
          </div>
          <div style={{ padding: '14px 16px' }}>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="123 Main St, City, State ZIP"
              style={{
                width: '100%',
                border: 'none',
                outline: 'none',
                background: 'transparent',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                color: 'var(--color-ink)',
                letterSpacing: '0.04em',
              }}
            />
          </div>
        </div>

        {error && (
          <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--color-alert)' }}>
            {error}
          </div>
        )}

        {/* Actions */}
        <div
          style={{
            marginTop: '28px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            alignItems: 'center',
          }}
        >
          <button
            onClick={handleContinue}
            disabled={loading}
            style={{
              height: '44px',
              width: '100%',
              background: 'var(--color-ink)',
              color: 'var(--color-bg)',
              border: '1px solid var(--color-ink)',
              borderRadius: '2px',
              font: '500 14px var(--font-ui)',
              letterSpacing: '-0.01em',
              cursor: loading ? 'default' : 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? 'Saving…' : 'Continue'}
          </button>
          <button
            onClick={handleSkip}
            disabled={loading}
            style={{
              font: '500 13px var(--font-ui)',
              color: 'var(--color-ink)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            skip all — do this later
          </button>
        </div>
      </div>
    </div>
  )
}

function SizeGroup({
  label,
  sizes,
  selected,
  onToggle,
}: {
  label: string
  sizes: string[]
  selected: string[]
  onToggle: (size: string) => void
}) {
  return (
    <div>
      <div
        style={{
          font: '500 10px var(--font-ui)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--color-ink-soft)',
          marginBottom: '6px',
        }}
      >
        {label}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {sizes.map((size) => {
          const active = selected.includes(size)
          return (
            <button
              key={size}
              onClick={() => onToggle(size)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                height: '26px',
                padding: '0 9px',
                border: `1px solid ${active ? 'var(--color-ink)' : 'var(--color-line)'}`,
                borderRadius: '2px',
                background: active ? 'var(--color-ink)' : 'var(--color-bg)',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                color: active ? 'var(--color-bg)' : 'var(--color-ink)',
                cursor: 'pointer',
              }}
            >
              {size}
            </button>
          )
        })}
      </div>
    </div>
  )
}
