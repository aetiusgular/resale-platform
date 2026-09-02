'use client'

import { useLayoutEffect, useState, type ReactNode } from 'react'
import dynamic from 'next/dynamic'
import { STUDIO_DEFAULTS, StudioProvider, applyStudioVars, type StudioValues } from './studio'

const DevTools = dynamic(() => import('./dev-tools'), { ssr: false })

export default function StudioRoot({ children }: { children: ReactNode }) {
  const [values, setValues] = useState<StudioValues>(STUDIO_DEFAULTS)

  useLayoutEffect(() => {
    applyStudioVars(values)
  }, [values])

  return (
    <StudioProvider value={values}>
      {children}
      {process.env.NODE_ENV === 'development' ? <DevTools onChange={setValues} /> : null}
    </StudioProvider>
  )
}
