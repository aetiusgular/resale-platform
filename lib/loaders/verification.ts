/**
 * Identity verification status — /onboarding/verify and GET /api/idv/status.
 * Also the ban reason for /banned and GET /api/me (service client, own row: `banned_reason` is
 * service-role only since migration 0044).
 */
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { createServiceClientRaw } from '@/lib/supabase/service'
import { VERIFICATION_ENABLED } from '@/lib/flags'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<any>

export type VerificationStatus = {
  /** unverified · pending · verified (null when there is no profile row). */
  status: string | null
  verified: boolean
  pending: boolean
  status_label: 'VERIFIED' | 'IN REVIEW' | 'NOT STARTED'
  handle: string
  enabled: boolean
  /** Where the web sends a verified member afterwards for `?required=sell|payout`. */
  after: string
}

export function afterVerifyPath(required: string | undefined | null): string {
  return required === 'sell' ? '/sell/new' : required === 'payout' ? '/settings/payouts' : '/browse'
}

export async function loadVerificationStatus(opts: { supabase: Client; user: User | null; required?: string | null }): Promise<VerificationStatus> {
  const { supabase, user } = opts
  let status: string | null = null
  let handle = ''
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('id_verification_status, username')
      .eq('id', user.id)
      .single()
    const row = data as { id_verification_status?: string; username?: string } | null
    status = row?.id_verification_status ?? null
    handle = row?.username ? `@${row.username.toUpperCase()}` : ''
  }
  const verified = status === 'verified'
  const pending = status === 'pending'
  return {
    status,
    verified,
    pending,
    status_label: verified ? 'VERIFIED' : pending ? 'IN REVIEW' : 'NOT STARTED',
    handle,
    enabled: VERIFICATION_ENABLED,
    after: afterVerifyPath(opts.required),
  }
}

export async function loadBanReason(userId: string): Promise<string | null> {
  const { data } = await createServiceClientRaw()
    .from('profiles')
    .select('banned_reason')
    .eq('id', userId)
    .single()
  return (data as { banned_reason?: string | null } | null)?.banned_reason ?? null
}
