'use client'

import Icon from './icon'

type Props = {
  name?: string
  defaultValue?: string
  placeholder?: string
}

export default function SearchField({
  name = 'q',
  defaultValue = '',
  placeholder = 'search designers, items',
}: Props) {
  return (
    <label style={{ position: 'relative', display: 'block', width: '100%' }}>
      <span
        style={{
          position: 'absolute',
          left: 12,
          top: '50%',
          transform: 'translateY(-50%)',
          color: 'var(--color-ink-soft)',
          display: 'flex',
          pointerEvents: 'none',
        }}
      >
        <Icon name="search" size={16} />
      </span>
      <input
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="search-field-input"
        style={{
          width: '100%',
          height: 'var(--control-h)',
          boxSizing: 'border-box',
          border: 'none',
          borderBottom: '1px solid var(--color-line)',
          borderRadius: 0,
          padding: '0 12px 0 36px',
          fontFamily: 'var(--font-ui)',
          fontSize: 16,
          fontWeight: 'var(--font-weight-regular)',
          color: 'var(--color-ink)',
          background: 'transparent',
          outline: 'none',
        }}
      />
    </label>
  )
}
