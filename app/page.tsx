export default function Home() {
  return (
    <main
      style={{
        maxWidth: 'var(--content-max)',
        margin: '0 auto',
        padding: 'var(--gutter)',
      }}
    >
      <h1 style={{ fontSize: 'var(--text-xl)', marginBottom: 'var(--spacing-2)' }}>
        Resale Platform
      </h1>
      <p style={{ color: 'var(--color-ink-soft)' }}>
        Bootstrap skeleton — B0 complete.{' '}
        <a href="/styleguide">View styleguide →</a>
      </p>
    </main>
  )
}
