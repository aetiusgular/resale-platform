'use client'

/**
 * Development-only VISUAL impersonation of the signed-in header.
 *
 * Localhost usually points at a placeholder Supabase project, so nobody can sign
 * in and the chrome always renders the guest variant — which makes it impossible
 * to compare the header against the deployed signed-in reference. This swaps the
 * header's DISPLAY props only.
 *
 * It is not auth and grants nothing: getUser(), middleware and every route gate
 * are untouched, so /settings, /sell, /saved, /orders and /messages still redirect
 * to /enter, and every API call still 401s.
 *
 * Two gates, both hard unless the guest proto tour is on:
 *  - production folds this off at build time, unless NEXT_PUBLIC_PROTO_TOUR=1
 *    (Hobby share: header nav uses /styleguide/proto, same as localhost);
 *  - automated browsers (navigator.webdriver) never see the SiteHeader swap, so
 *    the e2e suite — which runs against `pnpm dev` — still gets the real guest header.
 *
 * Set NEXT_PUBLIC_DEV_SIGNED_IN_CHROME=0 to get the guest header back in development.
 */
import { useSyncExternalStore } from 'react'
import { PROTO_TOUR } from '@/app/proto/viewer-fixture'

const ENABLED =
  PROTO_TOUR ||
  (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_DEV_SIGNED_IN_CHROME !== '0')

/** Header-only stand-in identity. Deliberately named so it can't read as a real account. */
export const DEV_CHROME_VIEWER = { username: 'devpreview', displayName: 'Dev Preview' }

const subscribe = () => () => {}
const isHuman = () => ENABLED && !navigator.webdriver
const onServer = () => false

/**
 * True when the guest header should be drawn as signed-in for review. Resolves
 * false on the server and on the first client render, so hydration still matches
 * the server's honest guest markup before the swap.
 */
export function useDevSignedInChrome(): boolean {
  return useSyncExternalStore(subscribe, isHuman, onServer)
}
