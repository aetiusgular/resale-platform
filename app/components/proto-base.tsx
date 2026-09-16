'use client'

/**
 * Href prefix for the proto tour (`/styleguide/proto`), read by the deep settings
 * tree so its internal links stay inside the walkthrough instead of bouncing off a
 * gated route. Empty string — the real paths — everywhere else, which is the
 * default when no provider is mounted.
 *
 * This is a link prefix and nothing more. It is never consulted by a gate, a
 * loader or an API route; authorization stays server-side on getUser().
 */
import { createContext, useContext } from 'react'

const ProtoBaseContext = createContext('')

export function ProtoBaseProvider({ base, children }: { base: string; children: React.ReactNode }) {
  return <ProtoBaseContext.Provider value={base}>{children}</ProtoBaseContext.Provider>
}

/** '' on real routes, '/styleguide/proto' inside the tour. */
export function useProtoBase(): string {
  return useContext(ProtoBaseContext)
}
