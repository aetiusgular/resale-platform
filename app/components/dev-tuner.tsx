'use client'

/**
 * Mounts the design tuner on every page in development. The ternary is folded at
 * build time, so the import (dialkit + motion) never reaches a production bundle; in
 * production this renders nothing. Automated browsers (Playwright sets
 * navigator.webdriver) get nothing either, so the e2e suite never sees the panel.
 */
import dynamic from 'next/dynamic'
import { useSyncExternalStore } from 'react'

const TunerPanel = process.env.NODE_ENV === 'production' ? null : dynamic(() => import('./dev-tuner-panel'), { ssr: false })

const subscribe = () => () => {}
const isHuman = () => !navigator.webdriver
const onServer = () => false

export default function DevTuner() {
  const human = useSyncExternalStore(subscribe, isHuman, onServer)
  return TunerPanel && human ? <TunerPanel /> : null
}
