import { ImageResponse } from 'next/og'

/**
 * 180×180 apple-touch icon, generated at request time (no binary asset in the
 * repo). Placeholder Night Archive mark (bone bars on #131210) — swap alongside
 * app/icon.svg when the platform name lands.
 */
export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          background: '#131210',
          paddingLeft: 40,
        }}
      >
        <div style={{ width: 101, height: 11, background: '#EDE8DC', marginBottom: 17 }} />
        <div style={{ width: 101, height: 11, background: '#EDE8DC', marginBottom: 17 }} />
        <div style={{ width: 68, height: 11, background: '#EDE8DC' }} />
      </div>
    ),
    size
  )
}
