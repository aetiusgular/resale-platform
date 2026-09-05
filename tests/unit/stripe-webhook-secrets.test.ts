/**
 * Webhook signature verification with TWO endpoint secrets (go-live audit 2026-09-05, P0-3).
 *
 * Stripe delivers `account.updated` for the sellers' Express accounts only to a "Connected
 * accounts" endpoint, which signs with its own secret. lib/stripe must accept a payload signed
 * by either the platform endpoint or the Connect endpoint, and reject everything else.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Stripe from 'stripe'

const PLATFORM = 'whsec_test_platform_secret_000000000000'
const CONNECT  = 'whsec_test_connect_secret_1111111111111'
const OTHER    = 'whsec_test_unrelated_secret_22222222222'

const payload = JSON.stringify({
  id: 'evt_test_1',
  object: 'event',
  type: 'account.updated',
  data: { object: { id: 'acct_test', object: 'account', payouts_enabled: true } },
})

function sign(secret: string): string {
  return Stripe.webhooks.generateTestHeaderString({ payload, secret })
}

let constructWebhookEvent: typeof import('../../lib/stripe').constructWebhookEvent
let webhookSecrets: typeof import('../../lib/stripe').webhookSecrets

const saved = { ...process.env }

beforeAll(async () => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_dummy_for_unit_tests'
  process.env.STRIPE_WEBHOOK_SECRET = PLATFORM
  process.env.STRIPE_CONNECT_WEBHOOK_SECRET = CONNECT
  const mod = await import('../../lib/stripe')
  constructWebhookEvent = mod.constructWebhookEvent
  webhookSecrets = mod.webhookSecrets
})

afterAll(() => {
  process.env = saved
})

describe('webhookSecrets', () => {
  it('lists the platform secret first, then the Connect secret', () => {
    expect(webhookSecrets({ STRIPE_WEBHOOK_SECRET: 'a', STRIPE_CONNECT_WEBHOOK_SECRET: 'b' })).toEqual(['a', 'b'])
  })
  it('omits an unset or empty Connect secret (single-endpoint setup)', () => {
    expect(webhookSecrets({ STRIPE_WEBHOOK_SECRET: 'a' })).toEqual(['a'])
    expect(webhookSecrets({ STRIPE_WEBHOOK_SECRET: 'a', STRIPE_CONNECT_WEBHOOK_SECRET: '' })).toEqual(['a'])
  })
  it('is empty when nothing is configured', () => {
    expect(webhookSecrets({})).toEqual([])
  })
})

describe('constructWebhookEvent', () => {
  it('accepts a payload signed by the platform endpoint secret', () => {
    const event = constructWebhookEvent(payload, sign(PLATFORM))
    expect(event.type).toBe('account.updated')
  })

  it('accepts a payload signed by the Connect endpoint secret', () => {
    const event = constructWebhookEvent(payload, sign(CONNECT))
    expect(event.id).toBe('evt_test_1')
  })

  it('rejects a payload signed with an unknown secret', () => {
    expect(() => constructWebhookEvent(payload, sign(OTHER))).toThrow()
  })

  it('rejects a tampered body even with a valid signature header', () => {
    const header = sign(PLATFORM)
    expect(() => constructWebhookEvent(payload.replace('true', 'false'), header)).toThrow()
  })
})
