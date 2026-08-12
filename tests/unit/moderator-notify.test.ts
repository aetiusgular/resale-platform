import { describe, it, expect } from 'vitest'
import { renderNotification } from '../../lib/notify/templates'
import { categoryOf, channelsFor } from '../../lib/notify/prefs'

describe('moderator_granted notification (G10)', () => {
  it('renders a promotion notice in the alerts category', () => {
    const r = renderNotification('moderator_granted', {})
    expect(r.title.toLowerCase()).toContain('moderator')
    expect(r.body.toLowerCase()).toContain('legit check')
    expect(r.category).toBe('alerts')
    expect(r.url).toBe('/browse')
  })

  it('is categorized as alerts and dispatches to all channels by default', () => {
    expect(categoryOf('moderator_granted')).toBe('alerts')
    const channels = channelsFor('moderator_granted', null)
    expect(channels).toContain('in_app')
    expect(channels).toContain('email')
    expect(channels).toContain('push')
  })

  it('honors an alerts opt-out for email/push (in_app always stays)', () => {
    const channels = channelsFor('moderator_granted', {
      email_alerts: false, push_alerts: false,
    })
    expect(channels).toEqual(['in_app'])
  })
})
