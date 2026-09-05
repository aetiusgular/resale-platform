/**
 * docs/api/openapi.yaml is the contract archive-ios/android are built against. This test keeps it
 * honest: every documented path must exist as an app/api route file that exports every documented
 * method, and the spec must parse. (It does not assert the reverse: internal routes such as admin,
 * cron and webhooks are deliberately not part of the native contract.)
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'yaml'

const ROOT = join(__dirname, '..', '..')
const SPEC_PATH = join(ROOT, 'docs', 'api', 'openapi.yaml')

type Spec = { openapi: string; paths: Record<string, Record<string, unknown>>; components: { schemas: Record<string, unknown> } }

function routeFileFor(apiPath: string): string {
  // /api/listings/{id}/comments → app/api/listings/[id]/comments/route.ts
  const segs = apiPath.replace(/^\//, '').split('/').map((s) => s.replace(/^\{(.+)\}$/, '[$1]'))
  return join(ROOT, 'app', ...segs, 'route.ts')
}

const METHODS = ['get', 'post', 'put', 'patch', 'delete']

describe('docs/api/openapi.yaml', () => {
  const spec = parse(readFileSync(SPEC_PATH, 'utf8')) as Spec

  it('parses as OpenAPI 3.1 with paths and schemas', () => {
    expect(spec.openapi).toMatch(/^3\.1\./)
    expect(Object.keys(spec.paths).length).toBeGreaterThan(40)
    expect(Object.keys(spec.components.schemas)).toEqual(expect.arrayContaining(['Me', 'BrowsePage', 'ListingDetail', 'ThreadBundle', 'OrderDetail', 'SettingsBundle']))
  })

  it('every documented path has a route file exporting every documented method', () => {
    const missing: string[] = []
    for (const [apiPath, ops] of Object.entries(spec.paths)) {
      const file = routeFileFor(apiPath)
      if (!existsSync(file)) { missing.push(`${apiPath} → ${file} (no route file)`); continue }
      const src = readFileSync(file, 'utf8')
      for (const method of Object.keys(ops).filter((k) => METHODS.includes(k))) {
        const re = new RegExp(`export\\s+(async\\s+)?function\\s+${method.toUpperCase()}\\b`)
        if (!re.test(src)) missing.push(`${method.toUpperCase()} ${apiPath} (not exported by ${file.replace(ROOT, '')})`)
      }
    }
    expect(missing).toEqual([])
  })

  it('documents the native-only endpoints the app boots from', () => {
    for (const p of ['/api/mobile/config', '/api/me', '/api/profile', '/api/content/{slug}', '/api/notifications/devices', '/api/stripe/connect/link', '/api/idv/start', '/api/checkout/preview']) {
      expect(spec.paths[p]).toBeDefined()
    }
  })
})
