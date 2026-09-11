/**
 * Development only: DialKit's stylesheet, inlined by the root layout with its Google Fonts
 * @import removed. Loaded the usual way (a JS import of dialkit/styles.css) the sheet
 * becomes a hoisted <link>; on a machine that blocks fonts.googleapis.com the failed
 * @import fires the link's error event, React leaves that as an unhandled rejection, and
 * the dev overlay reports "[object Event]" on every page. A <style> carries no such
 * promise, and the panel's font stack falls back to ui-monospace.
 *
 * The file is read by a plain path on purpose: `createRequire` or `require.resolve` would
 * let webpack see the CSS as a dependency and bundle it into every production page.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

function load(): string {
  if (process.env.NODE_ENV === 'production') return ''
  try {
    return readFileSync(join(process.cwd(), 'node_modules', 'dialkit', 'dist', 'styles.css'), 'utf8')
      .replace(/^@import\s+url\(['"]?https:\/\/fonts\.googleapis\.com[^)]*\)\s*;?[^\n]*\n/m, '')
  } catch {
    return '' // dialkit not installed: the panel will not load either
  }
}

const css = load()

export default function DevTunerStyles() {
  return css ? <style id="dev-tuner-vendor" dangerouslySetInnerHTML={{ __html: css }} /> : null
}
