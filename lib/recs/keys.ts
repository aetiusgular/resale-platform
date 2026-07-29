/**
 * Profile key convention (recs-engine feed API): a request is keyed by the
 * authenticated user when available, otherwise by the anonymous device.
 *   user_key = `u:{user_id}` when authenticated, else `d:{device_id}`.
 * Dependency-free on purpose so it's cheap to unit-test and reuse.
 */
export function userKeyFor(userId: string | null | undefined, deviceId: string): string {
  return userId ? `u:${userId}` : `d:${deviceId}`
}
