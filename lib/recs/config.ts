import { RECS_ENABLED } from '@/lib/flags'

/**
 * recs-engine connection config. Secrets (feed token, ingest HMAC secret) are
 * read from server-side env only and MUST never be imported into a client
 * component. The whole integration no-ops when RECS_ENABLED is false or a URL
 * is missing, so the platform stays fully functional without recs-engine.
 */
export const recsConfig = {
  enabled: RECS_ENABLED,
  ingestUrl: process.env.RECS_INGEST_URL ?? '',
  feedUrl: process.env.RECS_FEED_URL ?? '',
  feedToken: process.env.RECS_FEED_API_TOKEN ?? '',
  ingestSecret: process.env.RECS_INGEST_HMAC_SECRET ?? '',
} as const

/** True only when the integration is on AND the feed endpoint is configured. */
export function feedReady(): boolean {
  return recsConfig.enabled && recsConfig.feedUrl.length > 0 && recsConfig.feedToken.length > 0
}

/** True only when the integration is on AND the ingest endpoint + secret exist. */
export function ingestReady(): boolean {
  return recsConfig.enabled && recsConfig.ingestUrl.length > 0 && recsConfig.ingestSecret.length > 0
}
