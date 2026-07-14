'use client'

import { useState } from 'react'
import Link from 'next/link'

type Section = 'profile' | 'sizes' | 'addresses' | 'payments' | 'listings' | 'offers' | 'vacation' | 'verification' | 'privacy' | 'notifications'

interface SettingsClientProps {
  username: string
  userProfile: Record<string, unknown>
}

const SECTIONS = {
  account: [
    { id: 'profile', label: 'Profile' },
    { id: 'sizes', label: 'My Sizes' },
    { id: 'addresses', label: 'Addresses' },
    { id: 'payments', label: 'Payments' },
  ],
  selling: [
    { id: 'listings', label: 'Listings' },
    { id: 'offers', label: 'Offers' },
    { id: 'vacation', label: 'Vacation Mode' },
  ],
  trust: [
    { id: 'verification', label: 'Verification' },
    { id: 'privacy', label: 'Privacy' },
    { id: 'notifications', label: 'Notifications' },
  ],
}

export default function SettingsClient({ username, userProfile }: SettingsClientProps) {
  const [activeSection, setActiveSection] = useState<Section>('profile')

  const renderContent = () => {
    switch (activeSection) {
      case 'profile':
        return <ProfilePane username={username} profile={userProfile} />
      case 'sizes':
        return <MySizesPane profile={userProfile} />
      case 'addresses':
        return <AddressesPane />
      case 'payments':
        return <PaymentsPane />
      case 'listings':
        return <ListingsPane />
      case 'offers':
        return <OffersPane />
      case 'vacation':
      case 'verification':
      case 'privacy':
      case 'notifications':
        return <ComingSoonPane sectionName={SECTIONS.trust.find(s => s.id === activeSection)?.label || 'Coming Soon'} />
      default:
        return null
    }
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--color-bg)' }}>
      {/* Desktop nav rail */}
      <aside style={{
        width: '240px', borderRight: '1px solid var(--color-line)', padding: '24px 0',
        display: 'none', flexDirection: 'column'
      }}>
        {Object.entries(SECTIONS).map(([group, items]) => (
          <div key={group} style={{ paddingBottom: '24px' }}>
            <div style={{
              font: '500 11px var(--font-ui)', letterSpacing: '0.08em',
              textTransform: 'uppercase', color: 'var(--color-ink-soft)',
              padding: '0 24px 12px'
            }}>
              {group === 'account' && 'ACCOUNT'}
              {group === 'selling' && 'SELLING'}
              {group === 'trust' && 'TRUST'}
      <style>{`
        @media (min-width: 769px) {
          aside { display: flex !important; }
        }
        @media (max-width: 768px) {
          aside { display: none !important; }
        }
      `}</style>
    </div>
            {items.map(item => (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id as Section)}
                style={{
                  width: '100%', padding: '12px 24px', background: 'none', border: 'none',
                  textAlign: 'left', cursor: 'pointer',
                  font: activeSection === item.id ? '500 14px var(--font-ui)' : '400 14px var(--font-ui)',
                  color: activeSection === item.id ? 'var(--color-ink)' : 'var(--color-ink-soft)',
                  borderLeft: activeSection === item.id ? '2px solid var(--color-ink)' : '2px solid transparent',
                  transition: 'all 120ms linear'
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        ))}
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, padding: '32px 40px', maxWidth: '800px' }}>
        {renderContent()}
      </main>

      {/* Mobile nav (hidden on desktop) */}
      <style>{`
        @media (max-width: 768px) {
          aside { display: none !important; }
        }
      `}</style>
    </div>
  )
}

// ─── Profile Pane ─────────────────────────────────────────────────────────────
function ProfilePane({ username, profile }: { username: string; profile: Record<string, unknown> }) {
  return (
    <div>
      <h2 style={{ font: '500 20px var(--font-ui)', color: 'var(--color-ink)', marginBottom: '24px' }}>
        Profile
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div>
          <label style={{ display: 'block', font: '500 12px var(--font-ui)', color: 'var(--color-ink-soft)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Username
          </label>
          <div style={{ font: '400 14px var(--font-mono)', color: 'var(--color-ink)', padding: '12px', border: '1px solid var(--color-line)', borderRadius: '2px', background: 'var(--color-bg)' }}>
            @{username}
          </div>
          <div style={{ font: '400 12px var(--font-mono)', color: 'var(--color-ink-soft)', marginTop: '4px' }}>
            Permanent
          </div>
        </div>

        <div>
          <label style={{ display: 'block', font: '500 12px var(--font-ui)', color: 'var(--color-ink-soft)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Email
          </label>
          <input type="email" defaultValue={String(profile?.email ?? '')} disabled style={{
            width: '100%', height: '44px', padding: '0 12px', border: '1px solid var(--color-line)',
            borderRadius: '2px', font: '400 14px var(--font-mono)', color: 'var(--color-ink-soft)',
            background: 'var(--color-line)'
          }} />
        </div>

        <div>
          <label style={{ display: 'block', font: '500 12px var(--font-ui)', color: 'var(--color-ink-soft)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Location
          </label>
          <select disabled style={{
            width: '100%', height: '44px', padding: '0 12px', border: '1px solid var(--color-line)',
            borderRadius: '2px', font: '400 14px var(--font-mono)', color: 'var(--color-ink-soft)',
            background: 'var(--color-line)'
          }}>
            <option>Select location</option>
          </select>
        </div>
      </div>
    </div>
  )
}

// ─── My Sizes Pane ────────────────────────────────────────────────────────────
function MySizesPane({ profile }: { profile: Record<string, unknown> }) {
  const [sizes, setSizes] = useState<Record<string, string>>((profile?.quick_setup as Record<string, Record<string, string>> | undefined)?.sizes ?? {})
  const [dirty, setDirty] = useState(false)

  const handleSizeChange = (category: string, size: string) => {
    setSizes(prev => {
      const next = { ...prev }
      if (next[category] === size) delete next[category]
      else next[category] = size
      setDirty(true)
      return next
    })
  }

  const TOPS = ['XS', 'S', 'M', 'L', 'XL', 'XXL']
  const BOTTOMS = ['26', '28', '30', '32', '34', '36', '38', '40']
  const FOOTWEAR = ['5.5', '6', '6.5', '7', '7.5', '8', '8.5', '9', '9.5', '10', '10.5', '11', '11.5', '12', '12.5', '13', '13.5', '14']

  return (
    <div>
      <h2 style={{ font: '500 20px var(--font-ui)', color: 'var(--color-ink)', marginBottom: '12px' }}>
        My Sizes
      </h2>
      <p style={{ font: '400 12px var(--font-mono)', color: 'var(--color-ink-soft)', marginBottom: '24px' }}>
        Used by the MY SIZES filter and size alerts — never shown publicly
      </p>

      {/* TOPS */}
      <div style={{ marginBottom: '24px' }}>
        <label style={{ display: 'block', font: '500 12px var(--font-ui)', color: 'var(--color-ink-soft)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Tops
        </label>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {TOPS.map(size => (
            <button
              key={size}
              onClick={() => handleSizeChange('tops', size)}
              style={{
                height: '36px', padding: '0 12px', borderRadius: '2px', font: '500 12px var(--font-mono)',
                border: '1px solid var(--color-line)',
                background: sizes['tops'] === size ? 'var(--color-ink)' : 'var(--color-bg)',
                color: sizes['tops'] === size ? 'var(--color-bg)' : 'var(--color-ink)',
                cursor: 'pointer', transition: 'all 120ms linear'
              }}
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      {/* BOTTOMS */}
      <div style={{ marginBottom: '24px' }}>
        <label style={{ display: 'block', font: '500 12px var(--font-ui)', color: 'var(--color-ink-soft)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Bottoms
        </label>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {BOTTOMS.map(size => (
            <button
              key={size}
              onClick={() => handleSizeChange('bottoms', size)}
              style={{
                height: '36px', padding: '0 12px', borderRadius: '2px', font: '500 12px var(--font-mono)',
                border: '1px solid var(--color-line)',
                background: sizes['bottoms'] === size ? 'var(--color-ink)' : 'var(--color-bg)',
                color: sizes['bottoms'] === size ? 'var(--color-bg)' : 'var(--color-ink)',
                cursor: 'pointer', transition: 'all 120ms linear'
              }}
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      {/* FOOTWEAR */}
      <div style={{ marginBottom: '32px' }}>
        <label style={{ display: 'block', font: '500 12px var(--font-ui)', color: 'var(--color-ink-soft)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Footwear
        </label>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {FOOTWEAR.map(size => (
            <button
              key={size}
              onClick={() => handleSizeChange('footwear', size)}
              style={{
                height: '36px', padding: '0 12px', borderRadius: '2px', font: '500 12px var(--font-mono)',
                border: '1px solid var(--color-line)',
                background: sizes['footwear'] === size ? 'var(--color-ink)' : 'var(--color-bg)',
                color: sizes['footwear'] === size ? 'var(--color-bg)' : 'var(--color-ink)',
                cursor: 'pointer', transition: 'all 120ms linear'
              }}
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      <button
        disabled={!dirty}
        style={{
          height: '44px', padding: '0 32px', background: dirty ? 'var(--color-ink)' : 'var(--color-line)',
          color: dirty ? 'var(--color-bg)' : 'var(--color-ink-soft)',
          border: `1px solid ${dirty ? 'var(--color-ink)' : 'var(--color-line)'}`,
          borderRadius: '2px', font: '500 14px var(--font-ui)', cursor: dirty ? 'pointer' : 'not-allowed',
          transition: 'all 120ms linear'
        }}
      >
        Save
      </button>
    </div>
  )
}

// ─── Addresses Pane ───────────────────────────────────────────────────────────
function AddressesPane() {
  return (
    <div>
      <h2 style={{ font: '500 20px var(--font-ui)', color: 'var(--color-ink)', marginBottom: '24px' }}>
        Addresses
      </h2>
      <button style={{
        height: '44px', padding: '0 32px', background: 'var(--color-ink)',
        color: 'var(--color-bg)', border: '1px solid var(--color-ink)',
        borderRadius: '2px', font: '500 14px var(--font-ui)', cursor: 'pointer'
      }}>
        Add address
      </button>
    </div>
  )
}

// ─── Payments Pane ────────────────────────────────────────────────────────────
function PaymentsPane() {
  return (
    <div>
      <h2 style={{ font: '500 20px var(--font-ui)', color: 'var(--color-ink)', marginBottom: '24px' }}>
        Payments
      </h2>

      <div style={{ marginBottom: '32px' }}>
        <h3 style={{ font: '500 14px var(--font-ui)', color: 'var(--color-ink)', marginBottom: '16px' }}>
          Payment Methods
        </h3>
        <button style={{
          height: '44px', padding: '0 32px', background: 'var(--color-ink)',
          color: 'var(--color-bg)', border: '1px solid var(--color-ink)',
          borderRadius: '2px', font: '500 14px var(--font-ui)', cursor: 'pointer'
        }}>
          Add card
        </button>
      </div>

      <div style={{ marginBottom: '32px' }}>
        <h3 style={{ font: '500 14px var(--font-ui)', color: 'var(--color-ink)', marginBottom: '16px' }}>
          Payouts
        </h3>
        <p style={{ font: '400 12px var(--font-mono)', color: 'var(--color-ink-soft)', marginBottom: '12px' }}>
          Connect your bank account to receive payments. Required before your first listing goes live.
        </p>
        <button style={{
          height: '44px', padding: '0 32px', background: 'var(--color-ink)',
          color: 'var(--color-bg)', border: '1px solid var(--color-ink)',
          borderRadius: '2px', font: '500 14px var(--font-ui)', cursor: 'pointer'
        }}>
          Set up payouts
        </button>
      </div>
    </div>
  )
}

// ─── Listings Pane ────────────────────────────────────────────────────────────
function ListingsPane() {
  return (
    <div>
      <h2 style={{ font: '500 20px var(--font-ui)', color: 'var(--color-ink)', marginBottom: '24px' }}>
        Listings
      </h2>
      <Link href="/sell" style={{
        display: 'inline-flex', height: '44px', padding: '0 32px', alignItems: 'center',
        background: 'var(--color-ink)', color: 'var(--color-bg)', border: '1px solid var(--color-ink)',
        borderRadius: '2px', font: '500 14px var(--font-ui)', textDecoration: 'none', cursor: 'pointer'
      }}>
        Create listing
      </Link>
    </div>
  )
}

// ─── Offers Pane ──────────────────────────────────────────────────────────────
function OffersPane() {
  return (
    <div>
      <h2 style={{ font: '500 20px var(--font-ui)', color: 'var(--color-ink)', marginBottom: '24px' }}>
        Offers
      </h2>
      <Link href="/messages" style={{
        display: 'inline-flex', height: '44px', padding: '0 32px', alignItems: 'center',
        background: 'var(--color-ink)', color: 'var(--color-bg)', border: '1px solid var(--color-ink)',
        borderRadius: '2px', font: '500 14px var(--font-ui)', textDecoration: 'none', cursor: 'pointer'
      }}>
        View offers
      </Link>
    </div>
  )
}

// ─── Coming Soon Pane ─────────────────────────────────────────────────────────
function ComingSoonPane({ sectionName }: { sectionName: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '360px' }}>
      <p style={{
        fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: '1.4rem',
        color: 'var(--color-ink)', textAlign: 'center'
      }}>
        {sectionName} — coming soon
      </p>
    </div>
  )
}
